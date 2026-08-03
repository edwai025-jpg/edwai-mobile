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
import { WebView, type WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

// Exact hostnames the backend redirects to after Google OAuth
const AUTH_DONE_HOSTS = ["edwai-prod-70474.web.app", "eduwai.in"];

// Spoof a real mobile Chrome browser — avoids Google's "unsupported browser" block
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

// Injected into every page after it loads. Uses window.location.hostname (exact
// host match) so Google's own consent URL — which contains the redirect domain
// as a query param — never triggers a false positive.
const TOKEN_EXTRACTOR_JS = `
(function() {
  try {
    var hostname = window.location.hostname;
    var knownHosts = ${JSON.stringify(AUTH_DONE_HOSTS)};
    var isAuthDone = knownHosts.some(function(h) { return hostname === h; });
    if (!isAuthDone) return;
    var url = window.location.href;
    var m = url.match(/[?&#]token=([^&#\\s]+)/);
    if (m) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "auth_token",
        url: url,
        token: decodeURIComponent(m[1])
      }));
    }
  } catch (e) {}
})();
true;
`;

export type GoogleAuthResult =
  | { type: "success"; token: string; profileComplete: boolean }
  | { type: "cancel" }
  | { type: "error"; message: string };

type Props = {
  visible: boolean;
  authUrl: string;
  onResult: (result: GoogleAuthResult) => void;
};

export function GoogleAuthWebView({ visible, authUrl, onResult }: Props) {
  const insets = useSafeAreaInsets();
  const [initialLoading, setInitialLoading] = useState(true);
  const handledRef = useRef(false);
  const firstLoadRef = useRef(false);

  const finish = (result: GoogleAuthResult) => {
    if (handledRef.current) return;
    handledRef.current = true;
    onResult(result);
  };

  // Primary token extraction — runs after each page load via injectedJavaScript
  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type !== "auth_token" || !data.token) return;
      const profileComplete = (data.url as string).includes("/student");
      finish({ type: "success", token: data.token, profileComplete });
    } catch {
      // Ignore malformed messages
    }
  };

  // Belt-and-suspenders fallback via navigation state (uses exact host check, not substring)
  const handleNavigationChange = (state: WebViewNavigation) => {
    try {
      const url = state.url;
      if (!url || handledRef.current) return;
      // Exact host match only — prevents false positives when host appears as a query param
      const isAuthDone = AUTH_DONE_HOSTS.some(
        (h) =>
          url.startsWith(`https://${h}/`) ||
          url.startsWith(`https://${h}?`) ||
          url === `https://${h}`
      );
      if (!isAuthDone) return;
      const m = url.match(/[?&#]token=([^&#\s]+)/);
      if (!m) return;
      const token = decodeURIComponent(m[1]);
      const profileComplete = url.includes("/student");
      finish({ type: "success", token, profileComplete });
    } catch {
      // Never let this crash the component
    }
  };

  const handleClose = () => finish({ type: "cancel" });
  const handleError = () =>
    finish({ type: "error", message: "Failed to load Google sign-in. Please try again." });

  React.useEffect(() => {
    if (visible) {
      handledRef.current = false;
      firstLoadRef.current = false;
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

        {/* WebView — Chrome UA bypasses Google's "unsupported browser" block */}
        <WebView
          source={{ uri: authUrl }}
          style={s.webview}
          userAgent={USER_AGENT}
          // Token extraction via injected JS (exact hostname match, no false positives)
          injectedJavaScript={TOKEN_EXTRACTOR_JS}
          onMessage={handleMessage}
          // Fallback via navigation state
          onNavigationStateChange={handleNavigationChange}
          onLoadEnd={() => {
            if (!firstLoadRef.current) {
              firstLoadRef.current = true;
              setInitialLoading(false);
            }
          }}
          onError={handleError}
          // Do NOT use sharedCookiesEnabled — on iOS it shares Safari's cookie store
          // which can interfere with Expo Go's own browser-based development tooling
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
        />

        {/* Spinner only during the very first page load */}
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
