import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { T } from "./ui";

export type Item = { id: number; name: string };

export default function Picker({ label, items, selectedId, onSelect, placeholder, disabled, searchable = false, searchPlaceholder = "Search..." }: {
  label: string; items: Item[]; selectedId: number | null; onSelect: (i: Item) => void; placeholder: string; disabled?: boolean;
  searchable?: boolean; searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scroll, setScroll] = useState({ viewport: 0, content: 0, offset: 0 });
  const list = useRef<ScrollView>(null);
  const sel = items.find((i) => i.id === selectedId)?.name;
  const search = query.trim().toLocaleLowerCase();
  const visibleItems = searchable ? items.filter(i => i.name.toLocaleLowerCase().includes(search)) : items;
  const overflowing = scroll.viewport > 0 && scroll.content > scroll.viewport;
  const trackHeight = Math.max(0, scroll.viewport - 12);
  const thumbHeight = Math.min(trackHeight, Math.max(24, trackHeight * scroll.viewport / Math.max(1, scroll.content)));
  const thumbTop = Math.max(0, Math.min(scroll.offset / Math.max(1, scroll.content - scroll.viewport), 1)) * (trackHeight - thumbHeight);
  const changeQuery = (value: string) => {
    setQuery(value);
    list.current?.scrollTo({ y: 0, animated: false });
    setScroll(s => ({ ...s, offset: 0 }));
  };
  return (
    <View style={p.wrap}>
      <Text style={p.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${sel ?? placeholder}`}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => {
          setQuery("");
          setScroll({ viewport: 0, content: 0, offset: 0 });
          if (open && searchable) Keyboard.dismiss();
          setOpen(o => !o);
        }}
        style={[p.sel, disabled && { opacity: 0.5 }]}
      >
        <Text style={[p.selText, !sel && { color: T.g400 }]} numberOfLines={1}>{sel ?? placeholder}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={T.g500} />
      </Pressable>
      {open ? (
        <View style={p.dd}>
          {searchable ? (
            <View style={p.searchRow}>
              <Feather name="search" size={16} color={T.g500} />
              <TextInput style={p.searchInput} value={query} onChangeText={changeQuery}
                placeholder={searchPlaceholder} placeholderTextColor={T.g400}
                accessibilityLabel={`Search ${label.toLowerCase()} options`} editable={!disabled}
                autoCapitalize="none" autoCorrect={false} returnKeyType="done" />
              {query ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" disabled={disabled}
                  onPress={() => changeQuery("")} style={p.clearSearch}>
                  <Feather name="x" size={18} color={T.g500} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View>
          <ScrollView ref={list} nestedScrollEnabled style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={!searchable} scrollEventThrottle={16}
            onLayout={searchable ? e => {
              const viewport = e.nativeEvent.layout.height;
              setScroll(s => ({ ...s, viewport }));
            } : undefined}
            onContentSizeChange={searchable ? (_, height) => setScroll(s => ({ ...s, content: height })) : undefined}
            onScroll={searchable ? e => {
              const offset = e.nativeEvent.contentOffset.y;
              setScroll(s => ({ ...s, offset }));
            } : undefined}>
            {visibleItems.map((i) => (
              <Pressable key={i.id} accessibilityRole="menuitem" accessibilityState={{ selected: i.id === selectedId }}
                disabled={disabled}
                onPress={() => { setOpen(false); setQuery(""); if (searchable) Keyboard.dismiss(); onSelect(i); }}
                style={[p.opt, searchable && { paddingRight: 24 }, i.id === selectedId && { backgroundColor: T.indigo50 }]}>
                <Text style={[p.optText, i.id === selectedId && { color: T.primaryDark, fontWeight: "600" }]}>{i.name}</Text>
                {i.id === selectedId ? <Feather name="check" size={16} color={T.primaryDark} /> : null}
              </Pressable>
            ))}
            {searchable && visibleItems.length === 0 ? (
              <Text style={p.noMatches} accessibilityLiveRegion="polite">
                {search ? "No matches found. Try another search." : "No options available."}
              </Text>
            ) : null}
          </ScrollView>
          {searchable && overflowing ? (
            <View style={p.scrollTrack} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[p.scrollThumb, { height: thumbHeight, top: thumbTop }]} />
            </View>
          ) : null}
          </View>
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
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 4, backgroundColor: T.g50, borderBottomWidth: 1, borderBottomColor: T.g200 },
  searchInput: { flex: 1, minHeight: 48, paddingVertical: 8, fontSize: 14, color: T.g900 },
  clearSearch: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  noMatches: { padding: 16, fontSize: 13, lineHeight: 20, color: T.g500 },
  scrollTrack: { position: "absolute", top: 6, bottom: 6, right: 5, width: 4, borderRadius: 2, backgroundColor: T.g100 },
  scrollThumb: { position: "absolute", width: 4, borderRadius: 2, backgroundColor: T.primary },
  opt: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: T.g100 },
  optText: { flex: 1, fontSize: 14, color: T.g800 },
  loading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, minHeight: 44 },
  retry: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.red50, borderColor: T.red200, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 },
  retryBtn: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, justifyContent: "center" },
});
