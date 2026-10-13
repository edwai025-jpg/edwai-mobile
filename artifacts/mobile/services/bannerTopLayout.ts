import type { UsageInfo } from "./api";

/** The actual first visible layer owns the inset, not the presence of usage data. */
export function getBannerTopLayout(
  status: UsageInfo["status"] | null | undefined,
  phoneNudgeDismissed: boolean,
  topInset: number,
  platform: string,
) {
  const alert = status === "grace_period" || status === "past_due"
    ? status
    : !phoneNudgeDismissed ? "phone" : null;
  const safeTop = platform === "web" ? 0 : topInset;

  return {
    alert,
    alertPaddingTop: safeTop + 10,
    navPaddingTop: (alert ? 0 : safeTop) + 12,
    statusBarStyle: alert === "grace_period" || alert === "phone"
      ? "dark-content" as const
      : "light-content" as const,
  };
}
