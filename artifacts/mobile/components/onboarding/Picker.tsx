import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { T } from "./ui";

export type Item = { id: number; name: string };

export default function Picker({ label, items, selectedId, onSelect, placeholder, disabled }: {
  label: string; items: Item[]; selectedId: number | null; onSelect: (i: Item) => void; placeholder: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sel = items.find((i) => i.id === selectedId)?.name;
  return (
    <View style={p.wrap}>
      <Text style={p.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${sel ?? placeholder}`}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen((o) => !o)}
        style={[p.sel, disabled && { opacity: 0.5 }]}
      >
        <Text style={[p.selText, !sel && { color: T.g400 }]} numberOfLines={1}>{sel ?? placeholder}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={T.g500} />
      </Pressable>
      {open ? (
        <View style={p.dd}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
            {items.map((i) => (
              <Pressable key={i.id} accessibilityRole="menuitem" accessibilityState={{ selected: i.id === selectedId }}
                onPress={() => { setOpen(false); onSelect(i); }}
                style={[p.opt, i.id === selectedId && { backgroundColor: T.indigo50 }]}>
                <Text style={[p.optText, i.id === selectedId && { color: T.primaryDark, fontWeight: "600" }]}>{i.name}</Text>
                {i.id === selectedId ? <Feather name="check" size={16} color={T.primaryDark} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export function LoadingRow({ text }: { text: string }) {
  return (
    <View style={p.loading} accessibilityLiveRegion="polite" accessibilityLabel={text}>
      <ActivityIndicator size="small" color={T.primary} />
      <Text style={{ color: T.g500, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

export function RetryRow({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={p.retry} accessibilityRole="alert">
      <Text style={{ color: T.red700, fontSize: 13, lineHeight: 18, flex: 1 }}>{text}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry} style={p.retryBtn}>
        <Feather name="refresh-cw" size={14} color={T.red700} />
        <Text style={{ color: T.red700, fontWeight: "600", fontSize: 13 }}>Retry</Text>
      </Pressable>
    </View>
  );
}

const p = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: "500", color: T.g700, marginBottom: 4 },
  sel: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: T.g300, backgroundColor: T.g50, borderRadius: 8, paddingHorizontal: 14 },
  selText: { flex: 1, fontSize: 15, color: T.g900 },
  dd: { marginTop: 4, borderWidth: 1, borderColor: T.g200, borderRadius: 8, backgroundColor: T.white, overflow: "hidden" },
  opt: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: T.g100 },
  optText: { flex: 1, fontSize: 14, color: T.g800 },
  loading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, minHeight: 44 },
  retry: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.red50, borderColor: T.red200, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 },
  retryBtn: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, justifyContent: "center" },
});
