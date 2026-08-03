import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, type WebViewNavigation, type WebViewNavigation as WebViewRequest } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

// All domains the backend may redirect to after Google OAuth
// (edwai-prod-70474.web.app is Firebase hosting; eduwai.in is the custom domain)
const AUTH_DONE_HOSTS = ["edwai-prod-70474.web.app", "eduwai.in"];

// Spoof a real mobile browser so Google doesn't block the WebView OAuth flow
const USER_AGENT =
  Platform.OS === "ios"
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
    : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

export type GoogleAuthResult =
  | { type: "success"; token: string; profileComplete: boolean }
  | { type: "cancel" }
  | { type: "error"; message: string };

type Props = {
  visible: boolean;
  authUrl: string;
  onResult: (result: GoogleAuthResult) => void;
};

/** Extract token from URL (handles both ?token= and #token= patterns) */
function extractToken(url: string): string | null {
  const m = url.match(/[?&#]token=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Return true if this URL is the post-OAuth landing page */
function isAuthDoneUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return AUTH_DONE_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return AUTH_DONE_HOSTS.some((h) => url.includes(h));
  }
}

export function GoogleAuthWebView({ visible, authUrl, onResult }: Props) {
  const insets = useSafeAreaInsets();
  // Only show spinner on the very first load, not during the OAuth flow
  const [initialLoading, setInitialLoading] = useState(true);
  const handledRef = useRef(false);
  const firstLoadDoneRef = useRef(false);

  const finish = (result: GoogleAuthResult) => {
    if (handledRef.current) return;
    handledRef.current = true;
    onResult(result);
  };

  const tryHandleUrl = (url: string) => {
    if (!url || handledRef.current) return false;
    if (!isAuthDoneUrl(url)) return false;

    const token = extractToken(url);
    if (!token) return false; // the landing page loaded but token isn't in URL yet

    const profileComplete = url.includes("/student");
    finish({ type: "success", token, profileComplete });
    return true;
  };

  // onShouldStartLoadWithRequest fires BEFORE loading begins — most reliable intercept
  const handleShouldStartLoad = (request: WebViewRequest): boolean => {
    const intercepted = tryHandleUrl(request.url);
    // returning false blocks the navigation (we don't need to load the page)
    return !intercepted;
  };

  // onNavigationStateChange fires on every state update — belt-and-suspenders
  const handleNavigationChange = (state: WebViewNavigation) => {
    tryHandleUrl(state.url);
  };

  const handleClose = () => finish({ type: "cancel" });
  const handleError = () =>
    finish({ type: "error", message: "Failed to load Google sign-in. Please try again." });

  React.useEffect(() => {
    if (visible) {
      handledRef.current = false;
      firstLoadDoneRef.current = false;
      setInitialLoading(true);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={14}>
            <Text style={s.closeTxt}>✕</Text>
          </Pressable>
          <Text style={s.title}>Sign in with Google</Text>
          <View style={s.closeBtn} />
        </View>

        {/* WebView — spoof user-agent so Google allows OAuth in WebView */}
        <WebView
          source={{ uri: authUrl }}
          style={s.webview}
          userAgent={USER_AGENT}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={handleNavigationChange}
          onLoadEnd={() => {
            if (!firstLoadDoneRef.current) {
              firstLoadDoneRef.current = true;
              setInitialLoading(false);
            }
          }}
          onError={handleError}
          onHttpError={(e) => {
            // Ignore normal HTTP errors during the OAuth flow (redirects, etc.)
            if (e.nativeEvent.statusCode >= 500) handleError();
          }}
          sharedCookiesEnabled={Platform.OS === "ios"}
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          // Allow Google's sign-in popup patterns
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
          startInLoadingState={false}
        />

        {/* Spinner only on the very first page load */}
        {initialLoading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#111827" },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeTxt: { fontSize: 16, color: "#6b7280" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
});
