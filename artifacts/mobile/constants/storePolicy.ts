import { Platform } from "react-native";

/**
 * App Store (3.1.1) and Google Play (Payments policy) require their own in-app
 * billing for digital subscriptions and forbid links or calls to action that send
 * users to buy elsewhere. Until in-app purchases exist, the native apps show plan
 * usage but no upgrade/payment UI. Web keeps the existing eduwai.in flow.
 */
export const SHOW_WEB_PAYMENTS = Platform.OS === "web";

/**
 * Sign in with Apple needs a backend endpoint (POST /api/auth/apple) that verifies
 * Apple's identity token and returns an EDUwAI session. Turn this on with
 * EXPO_PUBLIC_APPLE_SIGNIN_ENABLED=true once that endpoint is live.
 */
export const APPLE_SIGNIN_ENABLED =
  Platform.OS === "ios" && process.env.EXPO_PUBLIC_APPLE_SIGNIN_ENABLED === "true";

/**
 * App Store 4.8: an app that offers Google login must also offer Sign in with Apple.
 * So iOS shows Google only when Apple sign-in is available.
 */
export const SHOW_GOOGLE_LOGIN = Platform.OS !== "ios" || APPLE_SIGNIN_ENABLED;
