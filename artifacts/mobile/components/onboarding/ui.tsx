import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export const T = {
  primary: "#667eea",
  primaryDark: "#5568d3",
  ink: "#280e5c",
  orange: "#f06c1e",
  g900: "#111827", g800: "#1f2937", g700: "#374151", g600: "#4b5563", g500: "#6b7280",
  g400: "#9ca3af", g300: "#d1d5db", g200: "#e5e7eb", g100: "#f3f4f6", g50: "#f9fafb",
  red700: "#b91c1c", red500: "#ef4444", red400: "#f87171", red50: "#fef2f2", red200: "#fecaca",
  blue50: "#eff6ff", blue200: "#bfdbfe", blue300: "#93c5fd", blue600: "#2563eb", blue700: "#1d4ed8",
  blue800: "#1e40af", blue900: "#1e3a8a",
  amber50: "#fffbeb", amber100: "#fef3c7", amber200: "#fde68a", amber300: "#fcd34d",
  amber500: "#f59e0b", amber600: "#d97706", amber700: "#b45309", amber800: "#92400e",
  indigo50: "#eef2ff", indigo200: "#c7d2fe", indigo100: "#e0e7ff",
  green50: "#f0fdf4", green200: "#bbf7d0", green500: "#22c55e", green600: "#16a34a", green700: "#15803d",
  white: "#ffffff",
};

export const shadow = {
  shadowColor: "#111827", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
};

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, lineHeight: size * 1.2, fontWeight: "700" }} accessibilityRole="header">
      <Text style={{ color: T.ink }}>EDUw</Text>
      <Text style={{ color: T.orange }}>AI</Text>
    </Text>
  );
}

export async function openExternal(url: string): Promise<boolean> {
  try {
    if (!/^(https?:|mailto:)/i.test(url)) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function ErrorLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Text style={s.err} accessibilityRole="alert" accessibilityLiveRegion="polite">{text}</Text>
  );
}

/** 48pt high action button with busy/disabled handling. */
export function ActionButton({
  label, busyLabel, busy, disabled, onPress, colors, textColor = T.white, icon, testID,
}: {
  label: string; busyLabel?: string; busy?: boolean; disabled?: boolean; onPress: () => void;
  colors: [string, string]; textColor?: string; icon?: React.ComponentProps<typeof Feather>["name"]; testID?: string;
}) {
  const off = !!busy || !!disabled;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={busy ? busyLabel ?? label : label}
      accessibilityState={{ disabled: off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [s.btn, off && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnInner}>
        {busy ? <ActivityIndicator size="small" color={textColor} /> : null}
        <Text style={[s.btnText, { color: textColor }]}>{busy ? busyLabel ?? label : label}</Text>
        {!busy && icon ? <Feather name={icon} size={16} color={textColor} /> : null}
      </LinearGradient>
    </Pressable>
  );
}

export function TextLink({ label, onPress, color = T.primary, disabled }: { label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={s.link} hitSlop={6}>
      <Text style={{ color, fontSize: 14, fontWeight: "500", textDecorationLine: "underline", opacity: disabled ? 0.5 : 1 }}>{label}</Text>
    </Pressable>
  );
}

export function Checkbox({ checked, onToggle, children, color = T.primary, disabled }: {
  checked: boolean; onToggle: () => void; children: React.ReactNode; color?: string; disabled?: boolean;
}) {
  return (
    <View style={s.cbRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
        accessibilityState={{ checked, disabled: !!disabled }}
        disabled={disabled}
        onPress={onToggle}
        hitSlop={12}
        style={s.cbHit}
      >
        <View style={[s.cb, { borderColor: checked ? color : T.g300, backgroundColor: checked ? color : T.white }]}>
          {checked ? <Feather name="check" size={13} color={T.white} /> : null}
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export const s = StyleSheet.create({
  err: { color: T.red500, fontSize: 13, lineHeight: 18, marginTop: 4 },
  btn: { borderRadius: 10, overflow: "hidden", minHeight: 48 },
  btnInner: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { fontSize: 15, fontWeight: "600", textAlign: "center", flexShrink: 1 },
  link: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  cbRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  cbHit: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
  cb: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
