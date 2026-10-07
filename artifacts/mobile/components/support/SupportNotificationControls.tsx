import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { nativeSupportPush } from "@/services/nativeSupportPush";
import { supportPush } from "@/services/supportPush";
import type { SupportPushState } from "@/services/supportPushManager";

export function SupportNotificationControls({ state, canEnable }: {
  state: SupportPushState;
  canEnable: boolean;
}) {
  const [settingsError, setSettingsError] = useState(false);
  const busy = state.status === "busy";
  const unavailable = state.status === "unavailable";
  return (
    <View testID="support-notifications-panel" style={s.panel}>
      <Text style={s.title}>Support notifications</Text>
      <Text style={s.help} accessibilityLiveRegion="polite">
        {busy ? "Updating notification settings…"
          : state.message || (state.optedIn
            ? "Receive an alert when the team replies."
            : "Optional. Foreground chat works even when notifications are off.")}
      </Text>
      {!canEnable && !unavailable && !state.optedIn
        ? <Text style={s.help}>Send your first message or restore a conversation before enabling.</Text> : null}
      <View style={s.actions}>
        {busy ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        {state.status === "blocked" ? (
          <Pressable testID="support-notifications-cleanup" disabled={busy} style={s.button}
            accessibilityRole="button" onPress={() => void supportPush.recover()}>
            <Text style={s.label}>Retry cleanup</Text>
          </Pressable>
        ) : !unavailable && !busy ? (
          <>
            <Pressable testID="support-notifications-enable"
              disabled={!canEnable && !state.optedIn}
              style={[s.button, !canEnable && !state.optedIn && s.disabled]}
              accessibilityRole="button"
              onPress={() => state.optedIn ? void supportPush.disable() : void supportPush.enable()}>
              <Text style={s.label}>{state.optedIn ? "Turn off" : "Enable notifications"}</Text>
            </Pressable>
            {state.status === "error" && state.optedIn ? (
              <Pressable testID="support-notifications-retry" style={s.button}
                accessibilityRole="button" onPress={() => void supportPush.retry()}>
                <Text style={s.label}>Retry registration</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {!busy && nativeSupportPush.available() ? (
          <Pressable testID="support-notifications-settings" style={s.button}
            accessibilityRole="button" onPress={() => {
              setSettingsError(false);
              void nativeSupportPush.openSettings().catch(() => setSettingsError(true));
            }}>
            <Text style={s.label}>Open Settings</Text>
          </Pressable>
        ) : null}
      </View>
      {settingsError ? <Text style={s.help}>Device settings could not be opened. Open them from your phone instead.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { backgroundColor: Colors.primaryUltraLight, padding: 14, gap: 7 },
  title: { color: Colors.navy, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  help: { color: Colors.gray600, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  button: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, backgroundColor: Colors.white },
  label: { color: Colors.primaryDark, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  disabled: { opacity: 0.45 },
});
