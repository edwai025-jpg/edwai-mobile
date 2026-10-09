/** Advance by a card, respecting the actual viewport; restart after the last card. */
export function nextAnnouncementOffset(offset: number, contentWidth: number, viewportWidth: number, step: number): number {
  if (viewportWidth <= 0 || step <= 0) return 0;
  const end = Math.max(0, contentWidth - viewportWidth);
  if (end <= 0 || offset >= end - 1) return 0;
  return Math.min(Math.max(0, offset) + step, end);
}
