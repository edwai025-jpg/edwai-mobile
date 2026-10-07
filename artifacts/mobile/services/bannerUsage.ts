import type { UsageInfo } from "./api";

const finiteCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

/** Billing is authoritative; never invent a quota when the response lacks one. */
export function getBannerUsage(usage: UsageInfo | null) {
  const used = finiteCount(usage?.questions_used);
  const limit = finiteCount(usage?.question_limit ?? usage?.questions_limit);
  const remaining = used !== null && limit !== null ? Math.max(0, limit - used) : null;
  const suppliedPercent = usage?.percent_used;
  const percent = typeof suppliedPercent === "number" && Number.isFinite(suppliedPercent)
    ? Math.max(0, Math.min(100, suppliedPercent))
    : used !== null && limit !== null && limit > 0 ? Math.min(100, used / limit * 100) : 0;
  return { used, limit, remaining, percent, countLabel: `${used ?? "—"}/${limit ?? "—"} Q` };
}
