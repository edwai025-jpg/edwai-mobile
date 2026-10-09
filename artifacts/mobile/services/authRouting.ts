export function getAuthRedirect(
  state: {
    isRestored: boolean;
    isLoggedIn: boolean;
    isProfileComplete: boolean;
    canUseOwnResources?: boolean;
    requiresOrgTerms?: boolean;
  },
  segments: readonly string[],
): "/login" | "/complete-profile" | "/(tabs)" | null {
  if (!state.isRestored) return null;
  const inTabs = segments[0] === "(tabs)";
  const inProfile = segments[0] === "complete-profile";
  const inLogin = segments.length === 0 || segments[0] === "index" || segments[0] === "login";
  const inOtp = segments[0] === "otp";
  if (!state.isLoggedIn && (inTabs || inProfile)) return "/login";
  const hasAccess = !state.requiresOrgTerms && (state.isProfileComplete || state.canUseOwnResources);
  if (state.isLoggedIn && !hasAccess && !inProfile) return "/complete-profile";
  if (state.isLoggedIn && hasAccess && (inLogin || inOtp)) return "/(tabs)";
  return null;
}
