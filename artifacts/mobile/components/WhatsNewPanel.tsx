import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";

import { openExternal, T, shadow } from "@/components/onboarding/ui";
import api, { AppConfig, WhatsNewItem } from "@/services/api";

type Feat = React.ComponentProps<typeof Feather>["name"];
const RESOURCES: { key: string; title: string; sub: string; cfg: string | null; fallback: string; colors: [string, string]; icon: Feat; badge: boolean }[] = [
  { key: "yt", title: "EDUwAI YouTube Channel", sub: "Tutorials, tips & subject walkthroughs", cfg: "social_youtube", fallback: "https://youtube.com/@edwai", colors: ["#ef4444", "#e11d48"], icon: "youtube", badge: true },
  { key: "tg", title: "Telegram Community", sub: "Ask questions, share notes, get help", cfg: "social_telegram", fallback: "https://t.me/edwai", colors: ["#0ea5e9", "#2563eb"], icon: "send", badge: true },
  { key: "ig", title: "Instagram", sub: "Updates, tips & student stories", cfg: "social_instagram", fallback: "https://instagram.com/edwai", colors: ["#ec4899", "#f43f5e"], icon: "instagram", badge: true },
  { key: "sr", title: "Study Resources", sub: "Curated links, guides & exam prep", cfg: "social_resources", fallback: "https://edwai.com/resources", colors: ["#8b5cf6", "#9333ea"], icon: "book-open", badge: true },
  { key: "hs", title: "Help & Support", sub: "FAQs, troubleshooting & contact", cfg: null, fallback: "mailto:support@edwai.com", colors: ["#10b981", "#0d9488"], icon: "help-circle", badge: false },
];

type Load<D> = { status: "loading" | "error" | "ready"; data: D };
const CARD_W = 255;
const GAP = 12;

function Card({ item }: { item: WhatsNewItem }) {
  const board = item.type === "board";
  const c = board ? { bd: "#ede9fe", bg: "#ede9fe", fg: "#6d28d9", soft: "#f5f3ff", icon: "home" as Feat } : { bd: "#dbeafe", bg: "#dbeafe", fg: "#1d4ed8", soft: "#eff6ff", icon: "book" as Feat };
  return (
    <View style={[w.card, { borderColor: c.bd }]} accessible accessibilityLabel={`${item.is_new ? "New. " : ""}${board ? "Board" : "Class"}: ${item.name}. ${item.state || "Available now"}${item.date ? `, ${item.date}` : ""}`}>
      <View style={w.cardTop}>
        <View style={[w.tile, { backgroundColor: c.bg }]}><Feather name={c.icon} size={18} color={c.fg} /></View>
        <View style={w.badges}>
          {item.is_new ? <View style={[w.badge, { backgroundColor: c.bg }]}><Text style={[w.badgeText, { color: c.fg }]}>NEW</Text></View> : null}
          <View style={[w.badge, { backgroundColor: c.soft }]}><Text style={[w.badgeText, { color: c.fg }]}>{board ? "BOARD" : "CLASS"}</Text></View>
        </View>
      </View>
      <View style={{ marginTop: 16 }}>
        <Text style={w.name} numberOfLines={2}>{item.name}</Text>
        <View style={w.meta}>
          <Text style={w.metaText} numberOfLines={1}>{item.state || "Available now"}</Text>
          {item.date ? <><Text style={{ color: T.g300 }}>•</Text><Text style={w.metaText}>{item.date}</Text></> : null}
        </View>
      </View>
    </View>
  );
}

function Skeleton() {
  return (
    <View style={{ flexDirection: "row", gap: GAP, paddingHorizontal: 20, paddingVertical: 8 }} accessibilityLabel="Loading announcements" accessibilityLiveRegion="polite">
      {[0, 1].map((i) => (
        <View key={i} style={[w.card, { width: CARD_W, borderColor: "transparent", opacity: 0.7 }]}>
          <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: T.g200, marginBottom: 16 }} />
          <View style={{ height: 12, width: "75%", borderRadius: 4, backgroundColor: T.g200 }} />
          <View style={{ height: 8, width: "50%", borderRadius: 4, backgroundColor: T.g100, marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={w.errBox} accessibilityRole="alert">
      <Feather name="alert-circle" size={18} color={T.white} />
      <Text style={w.errText}>{text}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry} style={w.retry}>
        <Feather name="refresh-cw" size={14} color={T.g800} /><Text style={{ fontWeight: "700", color: T.g800, fontSize: 13 }}>Retry</Text>
      </Pressable>
    </View>
  );
}

export default function WhatsNewPanel() {
  const [tab, setTab] = useState<"new" | "res">("new");
  const [news, setNews] = useState<Load<{ items: WhatsNewItem[]; total: number | null }>>({ status: "loading", data: { items: [], total: null } });
  const [cfg, setCfg] = useState<Load<AppConfig>>({ status: "loading", data: {} });
  const [pos, setPos] = useState(0);
  const [linkErr, setLinkErr] = useState("");
  const scroller = useRef<ScrollView>(null);
  const alive = useRef(true);
  const nTok = useRef(0); const cTok = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const loadNews = useCallback(() => {
    const t = ++nTok.current;
    setNews({ status: "loading", data: { items: [], total: null } }); setPos(0);
    api.data.getWhatsNew().then((r) => {
      if (alive.current && t === nTok.current) setNews({ status: "ready", data: { items: r.items ?? [], total: typeof r.total_boards === "number" ? r.total_boards : null } });
    }).catch(() => { if (alive.current && t === nTok.current) setNews({ status: "error", data: { items: [], total: null } }); });
  }, []);
  const loadCfg = useCallback(() => {
    const t = ++cTok.current;
    setCfg({ status: "loading", data: {} });
    api.data.getAppConfig().then((r) => {
      if (alive.current && t === cTok.current) setCfg({ status: "ready", data: r ?? {} });
    }).catch(() => { if (alive.current && t === cTok.current) setCfg({ status: "error", data: {} }); });
  }, []);
  useEffect(() => { loadNews(); loadCfg(); }, [loadNews, loadCfg]);

  const items = news.data.items;
  const newCount = items.filter((i) => i.is_new).length;
  const go = (i: number) => {
    const n = Math.max(0, Math.min(items.length - 1, i));
    scroller.current?.scrollTo({ x: n * (CARD_W + GAP), animated: true });
    setPos(n);
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPos(Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP)))));
  };
  const open = async (url: string) => {
    setLinkErr("");
    if (!(await openExternal(url))) setLinkErr("Could not open that link on this device.");
  };

  const tabBtn = (key: "new" | "res", label: string, icon: Feat, extra?: string) => {
    const on = tab === key;
    return (
      <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={extra ? `${label}, ${extra}` : label}
        onPress={() => setTab(key)} style={[w.tabBtn, on && w.tabOn]}>
        <Feather name={icon} size={16} color={on ? T.white : "rgba(255,255,255,0.6)"} />
        <Text style={[w.tabText, { color: on ? T.white : "rgba(255,255,255,0.6)" }]}>{label}</Text>
        {extra ? <View style={w.cap}><Text style={w.capText}>{extra}</Text></View> : null}
      </Pressable>
    );
  };

  return (
    <View>
      <LinearGradient colors={["#7c3aed", "#6366f1", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={w.root}>
        <View style={w.tabs} accessibilityRole="tablist">
          {tabBtn("new", "What's New", "zap", newCount > 0 ? `${newCount} new` : undefined)}
          {tabBtn("res", "Resources", "link")}
        </View>

        {tab === "new" ? (
          <View>
            <Text style={w.subtitle}>New boards and classes stream here as soon as they are onboarded.</Text>
            {news.status === "loading" ? <Skeleton /> : news.status === "error" ? (
              <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}><ErrorBox text="Couldn’t load what’s new." onRetry={loadNews} /></View>
            ) : items.length === 0 ? (
              <View style={w.empty}>
                <Feather name="sunrise" size={30} color="rgba(255,255,255,0.85)" />
                <Text style={w.emptyT}>Content is being onboarded</Text>
                <Text style={w.emptyS}>Check back soon — boards and classes will appear here as they’re added.</Text>
              </View>
            ) : (
              <View>
                <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD_W + GAP} decelerationRate="fast"
                  onMomentumScrollEnd={onEnd} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: GAP }} accessibilityLabel="Announcements, swipe sideways">
                  {items.map((it, i) => <Card key={`${it.type}-${it.name}-${i}`} item={it} />)}
                </ScrollView>
                {items.length > 1 ? (
                  <View style={w.pager}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Previous announcement" disabled={pos === 0} onPress={() => go(pos - 1)} style={[w.pgBtn, pos === 0 && { opacity: 0.35 }]}>
                      <Feather name="chevron-left" size={20} color={T.white} />
                    </Pressable>
                    <Text style={w.pgText} accessibilityLiveRegion="polite">{pos + 1} of {items.length}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Next announcement" disabled={pos >= items.length - 1} onPress={() => go(pos + 1)} style={[w.pgBtn, pos >= items.length - 1 && { opacity: 0.35 }]}>
                      <Feather name="chevron-right" size={20} color={T.white} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
            <View style={w.hint}>
              <Feather name="arrow-right" size={13} color="rgba(255,255,255,0.7)" style={{ marginTop: 2 }} />
              <Text style={w.hintText}>Don’t see yours? Select your state in the form and send us the board or class name to prioritise it.</Text>
            </View>
          </View>
        ) : (
          <View style={{ paddingBottom: 20 }}>
            <Text style={w.subtitle}>Everything you need to get the most out of EDUwAI — tutorials, community, and study materials.</Text>
            {cfg.status === "loading" ? (
              <View style={{ paddingVertical: 12 }}><ActivityIndicator color={T.white} /></View>
            ) : null}
            {cfg.status === "error" ? (
              <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}><ErrorBox text="Couldn’t load the latest links. Default links are shown." onRetry={loadCfg} /></View>
            ) : null}
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              {RESOURCES.map((r) => {
                const conf = r.cfg ? cfg.data[r.cfg] : undefined;
                const url = typeof conf === "string" && conf.trim() ? conf.trim() : r.fallback;
                return (
                  <Pressable key={r.key} accessibilityRole="link" accessibilityLabel={`${r.title}. ${r.sub}${r.badge ? ". Coming soon" : ""}`}
                    onPress={() => open(url)} style={({ pressed }) => [w.res, pressed && { opacity: 0.85 }]}>
                    <LinearGradient colors={r.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={w.resIcon}>
                      <Feather name={r.icon} size={18} color={T.white} />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Text style={w.resTitle}>{r.title}</Text>
                        {r.badge ? <View style={w.soon}><Text style={w.soonText}>COMING SOON</Text></View> : null}
                      </View>
                      <Text style={w.resSub}>{r.sub}</Text>
                    </View>
                    <Feather name="external-link" size={16} color={T.g400} />
                  </Pressable>
                );
              })}
            </View>
            {linkErr ? <Text style={w.linkErr} accessibilityRole="alert">{linkErr}</Text> : null}
            <View style={w.note}>
              <Feather name="info" size={16} color={T.white} style={{ marginTop: 2 }} />
              <Text style={w.noteText}>More resources are being set up. Your dashboard will have the latest links once you complete your profile.</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <View style={w.tiles}>
        <View style={w.tile3}><Feather name="users" size={18} color={T.primaryDark} /><Text style={w.tileT}>Tested by Trusted Teachers</Text></View>
        <View style={w.tile3} accessible accessibilityLabel={`${news.data.total ?? "unavailable"} boards`}>
          <Feather name="award" size={18} color={T.primaryDark} />
          <Text style={w.tileNum}>{news.data.total === null ? "—" : news.data.total}</Text>
          <Text style={w.tileS}>Boards</Text>
        </View>
        <View style={w.tile3}><Feather name="bookmark" size={18} color={T.primaryDark} /><Text style={w.tileT}>Citations Included</Text></View>
      </View>
    </View>
  );
}

const w = StyleSheet.create({
  root: { borderRadius: 16, overflow: "hidden", ...shadow },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)" },
  tabBtn: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: "transparent", flexWrap: "wrap" },
  tabOn: { backgroundColor: "rgba(255,255,255,0.15)", borderBottomColor: T.white },
  tabText: { fontSize: 14, fontWeight: "600" },
  cap: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  capText: { color: T.white, fontSize: 11, fontWeight: "700" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 20, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  card: { width: CARD_W, minHeight: 130, backgroundColor: T.white, borderRadius: 12, borderWidth: 1, padding: 16, justifyContent: "space-between", ...shadow, elevation: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badges: { flexDirection: "row", gap: 6, flexShrink: 1 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  name: { fontSize: 14, fontWeight: "700", color: T.g900, lineHeight: 19 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  metaText: { fontSize: 12, color: T.g500, flexShrink: 1 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pgBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)" },
  pgText: { color: T.white, fontSize: 13, fontWeight: "600", minWidth: 64, textAlign: "center" },
  empty: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 24, gap: 8 },
  emptyT: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500" },
  emptyS: { color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 18, textAlign: "center" },
  hint: { flexDirection: "row", gap: 8, margin: 20, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  hintText: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 19 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 12, padding: 12 },
  errText: { flex: 1, minWidth: 140, color: T.white, fontSize: 13, lineHeight: 18 },
  retry: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.white, borderRadius: 10, paddingHorizontal: 14 },
  res: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64, backgroundColor: T.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, ...shadow, elevation: 2 },
  resIcon: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resTitle: { fontSize: 14, fontWeight: "600", color: T.g900 },
  resSub: { fontSize: 12, color: T.g500, marginTop: 2, lineHeight: 17 },
  soon: { backgroundColor: T.g100, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  soonText: { fontSize: 10, fontWeight: "700", color: T.g500, letterSpacing: 0.4 },
  linkErr: { color: T.white, backgroundColor: "rgba(0,0,0,0.25)", margin: 20, marginBottom: 0, padding: 10, borderRadius: 8, fontSize: 13 },
  note: { flexDirection: "row", gap: 10, margin: 20, marginBottom: 0, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  noteText: { flex: 1, color: "rgba(255,255,255,0.9)", fontSize: 12, lineHeight: 19 },
  tiles: { flexDirection: "row", gap: 12, marginTop: 16 },
  tile3: { flex: 1, minHeight: 92, backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: T.white, borderRadius: 12, padding: 12, alignItems: "center", justifyContent: "center", gap: 4, ...shadow, elevation: 1, shadowOpacity: 0.05 },
  tileT: { fontSize: 12, fontWeight: "600", color: T.g700, textAlign: "center", lineHeight: 16 },
  tileNum: { fontSize: 15, fontWeight: "700", color: T.g900 },
  tileS: { fontSize: 12, color: T.g500 },
});
