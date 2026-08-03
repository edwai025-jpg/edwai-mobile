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

// The backend always redirects here after Google OAuth
const FIREBASE_BASE = "https://edwai-prod-70474.web.app";

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
  const [loading, setLoading] = useState(true);
  const handledRef = useRef(false);

  const handleNavigationChange = (state: WebViewNavigation) => {
    const url = state.url;
    if (!url) return;

    // Backend redirects to:
    //   https://edwai-prod-70474.web.app/complete-profile?token={jwt}
    //   https://edwai-prod-70474.web.app/student?token={jwt}
    if (url.startsWith(FIREBASE_BASE) && !handledRef.current) {
      // Extract token from query string
      const tokenMatch = url.match(/[?&#]token=([^&#]+)/);
      const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

      if (token) {
        handledRef.current = true;
        const profileComplete = url.includes("/student");
        onResult({ type: "success", token, profileComplete });
        return;
      }
    }
  };

  const handleClose = () => {
    if (!handledRef.current) {
      onResult({ type: "cancel" });
    }
  };

  const handleError = () => {
    if (!handledRef.current) {
      onResult({ type: "error", message: "Failed to load Google sign-in." });
    }
  };

  // Reset handled flag when modal opens
  React.useEffect(() => {
    if (visible) handledRef.current = false;
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header bar */}
        <View style={s.header}>
          <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={12}>
            <Text style={s.closeTxt}>✕</Text>
          </Pressable>
          <Text style={s.title}>Sign in with Google</Text>
          <View style={s.closeBtn} />
        </View>

        {/* WebView */}
        <WebView
          source={{ uri: authUrl }}
          style={s.webview}
          onNavigationStateChange={handleNavigationChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={handleError}
          // Allow cookies so Google's OAuth consent screen works correctly
          sharedCookiesEnabled={Platform.OS === "ios"}
          thirdPartyCookiesEnabled
          // Clear prior sessions so the user always picks a Google account
          incognito={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
        />

        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
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
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeTxt: {
    fontSize: 16,
    color: "#6b7280",
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
});
