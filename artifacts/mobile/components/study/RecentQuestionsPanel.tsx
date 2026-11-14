import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { QueryHistoryItem } from "@/services/api";
import { filterQuestions } from "@/services/recentQuestions";
import { useTheme } from "@/context/theme";
import StemAnswerBody from "./StemAnswerBody";

type Props = {
  history: QueryHistoryItem[];
  onSelect: (question: string) => void;
  onToggle: (id: number) => void;
  pendingIds: ReadonlySet<number>;
  uncertainIds: ReadonlySet<number>;
  loading: boolean;
  error: string | null;
  notice: string | null;
  onRefresh: () => void;
  sourceType?: string;
  phase: "shared" | "personal";
};

const CAP = 50, WARN = 40, SEARCH_MIN = 5;
const LIGHT = {
  border: "#c7d2fe", bg: "#eef2ff", header: "#4338ca", sep: "#c7d2fe", text: "#3730a3", press: "#e0e7ff",
  bmRow: "#fffbeb", bmIcon: "#fbbf24", unIcon: "#a5b4fc", badgeBg: "#fef3c7", badgeText: "#b45309",
  warnBg: "#fffbeb", warnText: "#b45309", searchBg: "#ffffff", searchBorder: "#c7d2fe", searchText: "#312e81",
  placeholder: "#a5b4fc", focus: "#818cf8", error: "#b91c1c",
};
const DARK = {
  border: "rgba(99,102,241,0.4)", bg: "rgba(30,27,75,0.5)", header: "#a5b4fc", sep: "rgba(99,102,241,0.2)", text: "#c7d2fe", press: "rgba(99,102,241,0.25)",
  bmRow: "rgba(245,158,11,0.1)", bmIcon: "#fbbf24", unIcon: "#4f46e5", badgeBg: "rgba(245,158,11,0.2)", badgeText: "#fcd34d",
  warnBg: "rgba(245,158,11,0.15)", warnText: "#fcd34d", searchBg: "rgba(49,46,129,0.4)", searchBorder: "rgba(99,102,241,0.3)", searchText: "#e0e7ff",
  placeholder: "#818cf8", focus: "#818cf8", error: "#fca5a5",
};

const INDIC = /[\u0900-\u0DFF]/;
const needsRenderer = (q: string) =>
  /[$\\^_*`#|{}~]|\[.*\]\(|^\s*[-+>]\s|\d+\.\s/m.test(q) || (INDIC.test(q) && /[0-9=+×÷√π<>]/.test(q));

export default function RecentQuestionsPanel(p: Props) {
  const { isDark } = useTheme();
  const c = isDark ? DARK : LIGHT;
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [viewport, setViewport] = useState({ y: 0, height: 192 });
  const [rowLayouts, setRowLayouts] = useState<Record<number, { y: number; height: number }>>({});

  const total = p.history.length;
  const bmCount = useMemo(() => p.history.filter(h => h.is_bookmarked).length, [p.history]);
  const remaining = CAP - bmCount;
  const atCap = bmCount >= CAP;
  const filtered = useMemo(() => {
    return filterQuestions(p.history, search);
  }, [p.history, search]);

  const errorBox = p.error ? (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { borderColor: c.border, backgroundColor: c.bg }]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={14} color={c.error} />
      <Text style={[styles.noticeText, { color: c.error }]}>{p.error}</Text>
      <Pressable onPress={p.onRefresh} disabled={p.loading} accessibilityRole="button" accessibilityLabel="Retry loading recent questions" hitSlop={8} style={styles.retry} testID="recent-retry">
        {p.loading ? <ActivityIndicator size="small" color={c.header} /> : <Text style={[styles.retryText, { color: c.header }]}>Retry</Text>}
      </Pressable>
    </View>
  ) : null;

  if (total === 0) return errorBox;

  const rowIcon = p.phase === "shared"
    ? (mode?: string | null) => (mode === "retrieve" ? "book-open-variant" : "lightbulb-on-outline")
    : () => (p.sourceType === "youtube" ? "movie-open-outline" : "file-pdf-box");

  const select = (q: string) => { setExpanded(false); setSearch(""); p.onSelect(q); };

  return (
    <View>
      {errorBox}
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.bg }]}>
        <Pressable onPress={() => setExpanded(e => !e)} accessibilityRole="button" accessibilityState={{ expanded }}
          accessibilityLabel={`Recent Questions, ${total}${bmCount ? `, ${bmCount} bookmarked` : ""}`}
          style={({ pressed }) => [styles.header, pressed && { backgroundColor: c.press }]} testID="recent-header">
          <MaterialCommunityIcons name="clock-outline" size={16} color={c.header} />
          <Text style={[styles.headerText, { color: c.header }]}>Recent Questions ({total})</Text>
          {bmCount > 0 && (
            <View style={[styles.badge, { backgroundColor: c.badgeBg }]}>
              <MaterialCommunityIcons name="bookmark" size={11} color={c.badgeText} />
              <Text style={[styles.badgeText, { color: c.badgeText }]}>{bmCount}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {p.loading && <ActivityIndicator size="small" color={c.header} accessibilityLabel="Loading recent questions" />}
          <MaterialCommunityIcons name="chevron-down" size={20} color={c.header} style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }} />
        </Pressable>

        {expanded && (
          <View style={[styles.body, { borderTopColor: c.sep }]}>
            {p.notice && (
              <View accessibilityLiveRegion="polite" style={[styles.warn, { backgroundColor: c.warnBg }]}>
                <Text style={[styles.warnText, { color: c.warnText }]}>{p.notice}</Text>
              </View>
            )}
            {uncertainAny(p.uncertainIds) && (
              <Pressable onPress={p.onRefresh} disabled={p.loading} accessibilityRole="button" style={[styles.warn, { backgroundColor: c.warnBg }]} testID="recent-reconcile">
                <Text style={[styles.warnText, { color: c.warnText }]}>A bookmark change could not be confirmed. Tap to refresh.</Text>
              </Pressable>
            )}
            {bmCount >= WARN && (
              <View style={[styles.warn, { backgroundColor: c.warnBg }]}>
                <Text style={[styles.warnText, { color: c.warnText }]}>
                  {atCap ? `Bookmark limit reached (${CAP}/${CAP})` : `Only ${remaining} bookmark${remaining === 1 ? "" : "s"} left`}
                </Text>
              </View>
            )}
            {total > SEARCH_MIN && (
              <TextInput value={search} onChangeText={setSearch} placeholder="Search questions..." placeholderTextColor={c.placeholder}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} accessibilityLabel="Search recent questions"
                autoCorrect={false} returnKeyType="search" testID="recent-search"
                style={[styles.search, { backgroundColor: c.searchBg, borderColor: focused ? c.focus : c.searchBorder, color: c.searchText }]} />
            )}
            <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled" scrollEventThrottle={48}
              onScroll={event => setViewport({ y: event.nativeEvent.contentOffset.y, height: event.nativeEvent.layoutMeasurement.height })}
              onLayout={event => {
                // Native events may be released before React runs the updater.
                const height = event.nativeEvent.layout.height;
                setViewport(value => value.height === height ? value : { ...value, height });
              }}>
              {filtered.length === 0 ? (
                <Text style={[styles.empty, { color: c.text }]}>No matching questions</Text>
              ) : filtered.map((h, index) => {
                const pending = p.pendingIds.has(h.id), uncertain = p.uncertainIds.has(h.id);
                const disabled = pending || uncertain;
                const subdued = atCap && !h.is_bookmarked;
                const layout = rowLayouts[h.id];
                // Keep only nearby math WebViews mounted, not up to 100 native browser processes.
                // Retain measured offscreen heights so scrolling remains stable.
                const visible = !layout ? index < 8
                  : layout.y + layout.height >= viewport.y - viewport.height
                    && layout.y <= viewport.y + viewport.height * 2;
                return (
                  <View key={h.id} style={[styles.row, h.is_bookmarked && { backgroundColor: c.bmRow }]}
                    onLayout={event => {
                      const { y, height } = event.nativeEvent.layout;
                      setRowLayouts(previous => previous[h.id]?.y === y && previous[h.id]?.height === height
                        ? previous : { ...previous, [h.id]: { y, height } });
                    }}>
                    <Pressable onPress={() => select(h.question)} accessibilityRole="button" accessibilityLabel={`Use question: ${h.question}`}
                      style={({ pressed }) => [styles.qTarget, pressed && { backgroundColor: c.press }]} testID={`recent-row-${h.id}`}>
                      <MaterialCommunityIcons name={rowIcon(h.mode) as any} size={12} color={c.text} style={styles.icon} />
                      <View style={{ flex: 1, minWidth: 0 }} pointerEvents="none">
                        {needsRenderer(h.question)
                          ? visible ? <StemAnswerBody content={h.question} isDark={isDark} compact />
                            : <View style={{ height: Math.max(28, (layout?.height ?? 56) - 16) }} />
                          : <Text style={[styles.qText, { color: c.text }]}>{h.question}</Text>}
                      </View>
                    </Pressable>
                    <Pressable onPress={() => p.onToggle(h.id)} disabled={disabled} hitSlop={4}
                      accessibilityRole="button" accessibilityState={{ disabled, busy: pending, selected: h.is_bookmarked }}
                      accessibilityLabel={h.is_bookmarked ? "Remove bookmark" : subdued ? "Bookmark (limit reached)" : "Bookmark question"}
                      accessibilityHint={uncertain ? "Refresh history before changing this bookmark" : undefined}
                      style={({ pressed }) => [styles.bmTarget, pressed && { backgroundColor: c.press }]} testID={`recent-bookmark-${h.id}`}>
                      {pending ? <ActivityIndicator size="small" color={c.bmIcon} /> : (
                        <MaterialCommunityIcons name={h.is_bookmarked ? "bookmark" : "tag-outline"} size={18}
                          color={h.is_bookmarked ? c.bmIcon : c.unIcon} style={{ opacity: uncertain ? 0.35 : subdued ? 0.4 : 1 }} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const uncertainAny = (s: ReadonlySet<number>) => s.size > 0;

const styles = StyleSheet.create({
  panel: { borderRadius: 12, borderWidth: 2, marginBottom: 16, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
  headerText: { fontSize: 14, fontWeight: "600" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  body: { borderTopWidth: 1, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 10, gap: 8 },
  search: { fontSize: 14, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, minHeight: 40 },
  list: { maxHeight: 192 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, marginBottom: 2 },
  qTarget: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minHeight: 44 },
  icon: { marginRight: 8, flexShrink: 0 },
  qText: { fontSize: 14 },
  bmTarget: { padding: 8, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, flexShrink: 0 },
  empty: { fontSize: 14, textAlign: "center", paddingVertical: 12, opacity: 0.75 },
  warn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  warnText: { fontSize: 12, fontWeight: "500" },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, paddingLeft: 12, marginBottom: 8 },
  noticeText: { flex: 1, fontSize: 13 },
  retry: { minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  retryText: { fontSize: 13, fontWeight: "600" },
});
