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

// All domains the backend may land on after Google OAuth
// (edwai-prod-70474.web.app = Firebase hosting; eduwai.in = custom domain)
const AUTH_DONE_HOSTS = ["edwai-prod-70474.web.app", "eduwai.in"];

// Spoof a real mobile browser — Google blocks OAuth flows it detects as WebViews
const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const USER_AGENT = Platform.OS === "ios" ? SAFARI_UA : CHROME_UA;

export type GoogleAuthResult =
  | { type: "success"; token: string; profileComplete: boolean }
  | { type: "cancel" }
  | { type: "error"; message: string };

type Props = {
  visible: boolean;
  authUrl: string;
  onResult: (result: GoogleAuthResult) => void;
};

/** Check if URL belongs to one of our known post-auth domains using simple string matching */
function isAuthDoneUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  // Use simple string matching — avoids new URL() which can throw on unusual schemes
  return AUTH_DONE_HOSTS.some((host) => url.includes(host));
}

/** Extract token from URL — handles both ?token= and #token= */
function extractToken(url: string): string | null {
  try {
    const m = url.match(/[?&#]token=([^&#\s]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

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

  // Called on every navigation state change inside the WebView
  const handleNavigationChange = (state: WebViewNavigation) => {
    try {
      const url = state.url;
      if (!url || handledRef.current) return;
      if (!isAuthDoneUrl(url)) return;

      const token = extractToken(url);
      if (!token) return; // redirect URL hit but no token yet (e.g. landing page loading)

      const profileComplete = url.includes("/student");
      finish({ type: "success", token, profileComplete });
    } catch {
      // Never let errors here crash the component
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

        {/* WebView */}
        <WebView
          source={{ uri: authUrl }}
          style={s.webview}
          userAgent={USER_AGENT}
          onNavigationStateChange={handleNavigationChange}
          onLoadEnd={() => {
            if (!firstLoadRef.current) {
              firstLoadRef.current = true;
              setInitialLoading(false);
            }
          }}
          onError={handleError}
          sharedCookiesEnabled={Platform.OS === "ios"}
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          startInLoadingState={false}
        />

        {/* Show spinner only on the very first page load */}
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
