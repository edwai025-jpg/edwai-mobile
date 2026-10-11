import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth";
import api, { type BoardPageConfig, type DisclaimerMessages } from "@/services/api";

/** Portal-mount settings; board config is fetched only for shared textbooks. */
export function useSourceSettings(shared: boolean) {
  const { user, accessToken, runAuthenticatedRequest } = useAuth();
  const run = useRef(runAuthenticatedRequest);
  run.current = runAuthenticatedRequest;
  const [disclaimerMessages, setDisclaimerMessages] = useState<DisclaimerMessages | null>(null);
  const [boardPageConfig, setBoardPageConfig] = useState<BoardPageConfig | null>(null);
  const pendingBoard = useRef<Promise<BoardPageConfig | null>>(Promise.resolve(null));
  const authenticated = !!accessToken;
  const boardId = shared ? user?.boardId : undefined;

  useEffect(() => {
    const controller = new AbortController();
    setDisclaimerMessages(null);
    if (authenticated) {
      void run.current(token => api.study.getDisclaimerMessages(token, controller.signal)).then(value => {
        if (!controller.signal.aborted) setDisclaimerMessages({
          source_citation_text: value.source_citation_text || "",
          page_context_text: value.page_context_text || "",
          // Own Books previously had no answer-warning banner; that banner is outside this handoff.
          ai_warning_text: shared ? value.ai_warning_text || "" : "",
        });
      }).catch(() => {});
    }
    return () => controller.abort();
  }, [authenticated, user?.id, shared]);

  useEffect(() => {
    const controller = new AbortController();
    setBoardPageConfig(null);
    if (!authenticated || !boardId) {
      pendingBoard.current = Promise.resolve(null);
      return () => controller.abort();
    }
    pendingBoard.current = run.current(token => api.study.getBoardPageConfig(token, boardId, controller.signal))
      .then(value => ({ ...value, page_display_mode: value.page_display_mode || "original" } as BoardPageConfig))
      .catch(() => ({ board_id: boardId, page_display_mode: "original", ncert_book_code: null } as BoardPageConfig));
    void pendingBoard.current.then(value => { if (!controller.signal.aborted) setBoardPageConfig(value); });
    return () => controller.abort();
  }, [authenticated, user?.id, boardId]);

  return { disclaimerMessages, boardPageConfig, pendingBoard };
}
