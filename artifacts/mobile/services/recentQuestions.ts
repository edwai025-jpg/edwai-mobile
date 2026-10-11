import type { BookmarkResult, QueryHistoryItem } from "./api";

export const BOOKMARK_LIMIT = 50;
export function bookmarkedFirst(rows: QueryHistoryItem[]): QueryHistoryItem[] {
  return [...rows.filter(row => row.is_bookmarked), ...rows.filter(row => !row.is_bookmarked)];
}
export function filterQuestions(rows: QueryHistoryItem[], search: string): QueryHistoryItem[] {
  return rows.filter(row => row.question.toLowerCase().includes(search.toLowerCase()));
}
type Snapshot = {
  history: QueryHistoryItem[]; loading: boolean; error: string | null; notice: string | null;
  pendingIds: ReadonlySet<number>; uncertainIds: ReadonlySet<number>;
};
type Client = {
  load: (signal: AbortSignal) => Promise<QueryHistoryItem[]>;
  toggle: (historyId: number) => Promise<BookmarkResult>;
};
/** One ephemeral controller per account/phase/book. The backend alone owns persistence. */
export class RecentQuestionsController {
  private state: Snapshot = { history: [], loading: false, error: null, notice: null, pendingIds: new Set(), uncertainIds: new Set() };
  private listeners = new Set<() => void>();
  private active = true;
  private sequence = 0;
  private mutationRevision = 0;
  private getRequest?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private client: Client) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<Snapshot>) {
    if (!this.active) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  start() { this.active = true; void this.refresh(); }
  dispose() {
    this.active = false; this.sequence++;
    this.getRequest?.abort();
    clearTimeout(this.timer);
  }
  refresh = async (): Promise<void> => {
    if (!this.active) return;
    this.getRequest?.abort();
    const request = new AbortController();
    this.getRequest = request;
    const sequence = ++this.sequence, revision = this.mutationRevision;
    const valid = () => this.active && sequence === this.sequence && revision === this.mutationRevision;
    this.update({ loading: true, error: null });
    try {
      const history = await this.client.load(request.signal);
      if (!Array.isArray(history)) throw new Error("Unexpected history response.");
      if (valid()) this.update({ history, uncertainIds: new Set(), loading: false });
    } catch (error) {
      if (valid() && !request.signal.aborted) this.update({ loading: false, error: "Could not load recent questions. Refresh to try again." });
    } finally {
      if (this.active && sequence === this.sequence) this.update({ loading: false });
    }
  };
  /** Streaming done can precede persistence: one immediate GET and one bounded follow-up. */
  refreshAfterAnswer = () => {
    if (!this.active) return;
    clearTimeout(this.timer);
    void this.refresh();
    this.timer = setTimeout(() => { void this.refresh(); }, 1200);
  };
  toggle = async (id: number): Promise<void> => {
    if (!this.active || this.state.pendingIds.has(id) || this.state.uncertainIds.has(id)
      || !this.state.history.some(row => row.id === id)) return;
    this.mutationRevision++;
    this.update({ pendingIds: new Set([...this.state.pendingIds, id]), notice: null });
    try {
      const result = await this.client.toggle(id);
      if (!this.active) return;
      if (result.id !== id || typeof result.is_bookmarked !== "boolean") throw new Error("Unexpected bookmark response.");
      this.mutationRevision++;
      this.update({ history: bookmarkedFirst(this.state.history.map(row => row.id === id ? { ...row, is_bookmarked: result.is_bookmarked } : row)) });
    } catch (error) {
      if (!this.active) return;
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 409) {
        this.update({ notice: "You've reached the 50 bookmark limit for this book." });
      } else if (status && status >= 400 && status < 500) {
        this.update({ notice: (error as Error).message || "Could not update this bookmark. Refresh to try again." });
      } else {
        // Never replay an ambiguous toggle; another POST could undo a successful write.
        this.update({
          notice: "The bookmark response was lost. Refreshing saved status; check the icon before trying again.",
          uncertainIds: new Set([...this.state.uncertainIds, id]),
        });
        this.mutationRevision++;
        await this.refresh();
      }
    } finally {
      if (this.active) {
        const pendingIds = new Set(this.state.pendingIds); pendingIds.delete(id);
        this.update({ pendingIds });
        if (this.state.uncertainIds.size && !pendingIds.size) void this.refresh();
      }
    }
  };
}
