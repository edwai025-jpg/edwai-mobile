import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";

import StudyResources from "@/components/study/StudyResources";
import { useFocusEffect } from "expo-router";
import type { StudyAnswerContext } from "@/services/studyResources";
import { useTheme } from "@/context/theme";
import {
  BoardPageConfig,
  CitationImage,
  DiagramImage,
  DisclaimerMessages,
  PageCitation,
  Phase1CitationImage,
  QueryResponse,
  TypographySettings,
} from "@/services/api";

const BORDER_DARK = "rgba(255,255,255,0.10)";

/* ─── Typography helpers ─────────────────────────────────────────────────── */
function parseTypography(t?: TypographySettings | null) {
  const fontSize = parseInt(t?.font_size ?? "16") || 16;
  const lineHeightMult = parseFloat(t?.line_height ?? "1.7") || 1.7;
  const lineHeight = Math.round(fontSize * lineHeightMult);
  let fontFamily = "Inter_400Regular";
  if (t?.font_family === "serif") fontFamily = "Georgia";
  return { fontSize, lineHeight, fontFamily };
}

/* ─── Preprocess markdown text ───────────────────────────────────────────── */
function preprocessMarkdown(text: string): string {
  let out = text;
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);
  out = out.replace(/\[Page (\d+)\]/g, (_, n) => `**[Page ${n}]**`);
  return out;
}

/* ─── Dynamic markdown styles ────────────────────────────────────────────── */
function getMdStyles(isDark: boolean, typography?: TypographySettings | null) {
  const { fontSize, lineHeight, fontFamily } = parseTypography(typography);
  const body = isDark ? "#e5e7eb" : "#1f2937";
  const heading = isDark ? "#fff" : "#111827";
  const h3 = isDark ? "#c4b5fd" : "#6d28d9";
  const em = isDark ? "#d1d5db" : "#4b5563";
  const item = isDark ? "#e5e7eb" : "#374151";
  const border = isDark ? BORDER_DARK : "#e5e7eb";
  const thBg = isDark ? "rgba(102,126,234,0.2)" : "rgba(102,126,234,0.10)";
  const tdColor = isDark ? "#e5e7eb" : "#374151";
  const fenceBg = isDark ? "#111827" : "#f3f4f6";
  const codeColor = isDark ? "#a7f3d0" : "#065f46";

  return {
    body: { color: body, fontFamily, fontSize, lineHeight },
    heading1: { color: heading, fontFamily: "Inter_700Bold", fontSize: fontSize + 4, marginTop: 10, marginBottom: 4 },
    heading2: { color: heading, fontFamily: "Inter_700Bold", fontSize: fontSize + 2, marginTop: 8, marginBottom: 4 },
    heading3: { color: h3, fontFamily: "Inter_600SemiBold", fontSize: fontSize + 1, marginTop: 6, marginBottom: 2 },
    strong: { color: heading, fontFamily: "Inter_700Bold" },
    em: { color: em, fontStyle: "italic" as const },
    bullet_list: { marginLeft: 4 },
    ordered_list: { marginLeft: 4 },
    bullet_list_item: { color: item },
    ordered_list_item: { color: item },
    code_inline: { backgroundColor: "rgba(102,126,234,0.2)", color: "#a78bfa", fontFamily: "Inter_500Medium", borderRadius: 4, paddingHorizontal: 4 },
    fence: { backgroundColor: fenceBg, borderRadius: 8, padding: 12, marginVertical: 8 },
    code_block: { color: codeColor, fontFamily: "Inter_400Regular", fontSize: 12 },
    blockquote: { borderLeftWidth: 4, borderLeftColor: "#60a5fa", paddingLeft: 12, opacity: 0.9 },
    table: { borderWidth: 1, borderColor: border, borderRadius: 4 },
    th: { backgroundColor: thBg, color: heading, fontFamily: "Inter_600SemiBold", padding: 8 },
    td: { color: tdColor, padding: 8, borderTopWidth: 1, borderTopColor: border },
  };
}

/* ─── Spinner Ring ───────────────────────────────────────────────────────── */
function SpinnerRing() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={[sp.ring, { transform: [{ rotate }] }]} />;
}
const sp = StyleSheet.create({
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, borderColor: "#667eea", borderTopColor: "transparent" },
});

/* ─── Image Zoom Modal ───────────────────────────────────────────────────── */
function ImageZoomModal({ visible, uri, label, onClose }: { visible: boolean; uri: string; label: string; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={zm.backdrop}>
          <View style={zm.container}>
            <Pressable style={zm.closeBtn} onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color="#fff" />
            </Pressable>
            <TouchableWithoutFeedback>
              <View style={zm.card}>
                <ScrollView maximumZoomScale={4} minimumZoomScale={1} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center" }} style={{ maxHeight: "85%" as `${number}%` }}>
                  <Image source={{ uri }} style={zm.image} resizeMode="contain" />
                </ScrollView>
                <View style={zm.footer}>
                  <Text style={zm.footerText}>{label}</Text>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
const zm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 16 },
  container: { position: "relative" },
  closeBtn: { position: "absolute", top: -44, right: 0, zIndex: 20, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 22, padding: 8 },
  card: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden" },
  image: { width: "100%", height: 420 },
  footer: { backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingVertical: 10, paddingHorizontal: 14 },
  footerText: { fontSize: 12, color: "#6b7280", textAlign: "center" },
});

/* ─── Validation Badge ───────────────────────────────────────────────────── */
function ValidationBadge({ v }: { v: NonNullable<QueryResponse["validation"]> }) {
  const bg = v.is_reliable ? "rgba(16,185,129,0.1)" : v.confidence >= 0.6 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const border = v.is_reliable ? "rgba(16,185,129,0.3)" : v.confidence >= 0.6 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)";
  const color = v.is_reliable ? "#10b981" : v.confidence >= 0.6 ? "#f59e0b" : "#ef4444";
  const icon = v.is_reliable ? "✅" : v.confidence >= 0.6 ? "⚠️" : "❌";
  return (
    <View style={[vb.box, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[vb.title, { color }]}>{icon} Answer Validation: {Math.round(v.confidence * 100)}% Verified</Text>
      <Text style={[vb.sub, { color }]}>{v.validated_facts} verified · {v.partial_facts} partial · {v.unverified_facts} unverified</Text>
      {!!v.warnings?.length && <Text style={[vb.warn, { color }]}>{v.warnings.join(" · ")}</Text>}
    </View>
  );
}
const vb = StyleSheet.create({
  box: { borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 12 },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 11, marginTop: 3 },
  warn: { fontSize: 11, marginTop: 2, fontStyle: "italic" },
});

/* ─── BOX 1 — AI Warning Disclaimer ─────────────────────────────────────── */
function DisclaimerBox({ text, isDark }: { text: string; isDark: boolean }) {
  const bg = isDark ? "rgba(120,85,10,0.22)" : "#fefce8";
  const border = isDark ? "rgba(245,158,11,0.30)" : "#facc15";
  const color = isDark ? "#fde68a" : "#713f12";
  return (
    <View style={[db.box, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[db.text, { color }]}>{text}</Text>
    </View>
  );
}
const db = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  text: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
});

/* ─── BOX 3 — Sources (page badge pills) ────────────────────────────────── */
function SourcesPillsBox({ sources, disclaimerText, isDark }: { sources: PageCitation[]; disclaimerText?: string; isDark: boolean }) {
  const cardBg = isDark ? "rgba(30,30,58,0.90)" : "#ffffff";
  const cardBorder = isDark ? "rgba(102,126,234,0.30)" : "#e5e7eb";
  const headingColor = isDark ? "#fff" : "#111827";
  const pillBg = isDark ? "rgba(102,126,234,0.30)" : "#ffffff";
  const pillBorder = isDark ? "rgba(102,126,234,0.40)" : "#e5e7eb";
  const pillText = isDark ? "#d1d5db" : "#374151";
  const disclaimerColor = isDark ? "#9ca3af" : "#6b7280";

  const pageNums = Array.from(new Set(sources.map((s) => s.page))).sort((a, b) => a - b);

  return (
    <View style={[sb.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={sb.headerRow}>
        <Text style={sb.icon}>📄</Text>
        <Text style={[sb.heading, { color: headingColor }]}>Sources</Text>
      </View>
      {!!disclaimerText && (
        <Text style={[sb.disclaimer, { color: disclaimerColor }]}>{disclaimerText}</Text>
      )}
      <View style={sb.pillRow}>
        {pageNums.map((pg) => (
          <View key={pg} style={[sb.pill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
            <Text style={[sb.pillText, { color: pillText }]}>Page {pg}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const sb = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  icon: { fontSize: 16 },
  heading: { fontSize: 14, fontFamily: "Inter_700Bold" },
  disclaimer: { fontSize: 12, fontStyle: "italic", lineHeight: 17, marginBottom: 8 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

/* ─── BOX 4 — Images loading row ────────────────────────────────────────── */
function ImagesLoadingRow({ isDark }: { isDark: boolean }) {
  const color = isDark ? "#9ca3af" : "#6b7280";
  const cardBg = isDark ? "rgba(30,30,58,0.90)" : "#ffffff";
  const cardBorder = isDark ? "rgba(102,126,234,0.30)" : "#e5e7eb";
  return (
    <View style={[il.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <ActivityIndicator size="small" color="#667eea" />
      <Text style={[il.text, { color }]}>Loading source images...</Text>
    </View>
  );
}
const il = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  text: { fontSize: 13, fontFamily: "Inter_400Regular" },
});

/* ─── BOX 4 — Phase 1 Page Citations ────────────────────────────────────── */
function Phase1CitationsBox({
  citations, boardPageConfig, disclaimerText, isDark,
}: {
  citations: Phase1CitationImage[];
  boardPageConfig?: BoardPageConfig | null;
  disclaimerText?: string;
  isDark: boolean;
}) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  const cardBg = isDark ? "rgba(30,30,58,0.90)" : "#ffffff";
  const cardBorder = isDark ? "rgba(102,126,234,0.30)" : "#e5e7eb";
  const headingColor = isDark ? "#fff" : "#111827";

  const isEmbedded =
    boardPageConfig?.page_display_mode === "embedded" &&
    citations.some((c) => !!c.ncert_url);

  return (
    <>
      <View style={[pc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={pc.headerRow}>
          <Text style={pc.icon}>{isEmbedded ? "📚" : "📖"}</Text>
          <Text style={[pc.heading, { color: headingColor }]}>Page Citations</Text>
        </View>

        {!!disclaimerText && (
          <View style={pc.contextBox}>
            <Text style={pc.contextText}>ℹ️  {disclaimerText}</Text>
          </View>
        )}

        {isEmbedded ? (
          /* EMBEDDED MODE — NCERT links */
          <View style={pc.ncertWrap}>
            <Text style={pc.ncertTitle}>📚 NCERT Source:</Text>
            <Text style={pc.ncertDesc}>Please refer to all the listed pages and any adjacent pages for complete context.</Text>
            <View style={pc.ncertLinks}>
              {citations.filter((c) => c.ncert_url).map((c, i) => (
                <Pressable key={i} style={pc.ncertBtn} onPress={() => c.ncert_url && Linking.openURL(c.ncert_url!)}>
                  <Text style={pc.ncertBtnText}>🔗 Page {c.page}</Text>
                  <Feather name="external-link" size={11} color="#065f46" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          /* IMAGE MODE — original or edwai_generated (identical rendering) */
          citations.filter((c) => !!c.data).map((c, i) => (
            <Pressable key={i} style={pc.imgCard} onPress={() => { setZoomUri(c.data!); setZoomLabel(`Page ${c.page}`); }}>
              <Image source={{ uri: c.data! }} style={pc.img} resizeMode="contain" />
              <View style={pc.imgFooter}>
                <Text style={pc.imgCaption}>Page {c.page}</Text>
                <Feather name="zoom-in" size={11} color="#9ca3af" />
              </View>
            </Pressable>
          ))
        )}
      </View>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} label={zoomLabel} onClose={() => setZoomUri(null)} />
    </>
  );
}
const pc = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  icon: { fontSize: 16 },
  heading: { fontSize: 14, fontFamily: "Inter_700Bold" },
  contextBox: { backgroundColor: "rgba(59,130,246,0.10)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(59,130,246,0.25)", padding: 10, marginBottom: 12 },
  contextText: { fontSize: 12, color: "#3b82f6", lineHeight: 17 },
  ncertWrap: { backgroundColor: "#ecfdf5", borderRadius: 10, borderWidth: 2, borderColor: "#34d399", padding: 14 },
  ncertTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#065f46", marginBottom: 4 },
  ncertDesc: { fontSize: 12, color: "#047857", lineHeight: 18, marginBottom: 10 },
  ncertLinks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ncertBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff", borderRadius: 8, borderWidth: 2, borderColor: "#34d399", paddingHorizontal: 12, paddingVertical: 7 },
  ncertBtnText: { fontSize: 12, color: "#065f46", fontFamily: "Inter_600SemiBold" },
  imgCard: { borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginTop: 10, backgroundColor: "#fff" },
  img: { width: "100%", height: 200 },
  imgFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 8 },
  imgCaption: { fontSize: 12, color: "#6b7280", fontFamily: "Inter_500Medium" },
});

/* ─── BOX 4 — Phase 2 Citations (own docs / YouTube) ────────────────────── */
function Phase2CitationsBox({ citations, isDark }: { citations: CitationImage[]; isDark: boolean }) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  const cardBg = isDark ? "rgba(30,30,58,0.90)" : "#ffffff";
  const cardBorder = isDark ? "rgba(102,126,234,0.30)" : "#e5e7eb";
  const headingColor = isDark ? "#fff" : "#111827";

  return (
    <>
      <View style={[p2.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={p2.headerRow}>
          <Text style={p2.icon}>📖</Text>
          <Text style={[p2.heading, { color: headingColor }]}>Page Citations</Text>
        </View>
        {citations.map((c, i) => {
          const uri = `data:image/jpeg;base64,${c.base64_image}`;
          return (
            <Pressable key={i} style={p2.imgCard} onPress={() => { setZoomUri(uri); setZoomLabel(`Page ${c.page_number}`); }}>
              <Image source={{ uri }} style={p2.img} resizeMode="contain" />
              <View style={p2.imgFooter}>
                <Text style={p2.imgCaption}>Page {c.page_number}</Text>
                <Feather name="zoom-in" size={11} color="#9ca3af" />
              </View>
            </Pressable>
          );
        })}
      </View>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} label={zoomLabel} onClose={() => setZoomUri(null)} />
    </>
  );
}
const p2 = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  icon: { fontSize: 16 },
  heading: { fontSize: 14, fontFamily: "Inter_700Bold" },
  imgCard: { borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginTop: 10, backgroundColor: "#fff" },
  img: { width: "100%", height: 200 },
  imgFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 8 },
  imgCaption: { fontSize: 12, color: "#6b7280", fontFamily: "Inter_500Medium" },
});

/* ─── BOX 5 — Diagrams from Textbook ────────────────────────────────────── */
function DiagramsBox({ diagrams, isDark }: { diagrams: DiagramImage[]; isDark: boolean }) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  const cardBg = isDark ? "rgba(30,30,58,0.90)" : "#ffffff";
  const cardBorder = isDark ? "rgba(102,126,234,0.30)" : "#e5e7eb";
  const headingColor = isDark ? "#fff" : "#111827";

  return (
    <>
      <View style={[dg.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={dg.headerRow}>
          <Text style={dg.icon}>🖼️</Text>
          <Text style={[dg.heading, { color: headingColor }]}>Diagrams from Textbook</Text>
        </View>
        <View style={dg.grid}>
          {diagrams.map((d, i) => (
            <Pressable key={i} style={dg.item} onPress={() => { setZoomUri(d.data); setZoomLabel(`Page ${d.page}`); }}>
              <Image source={{ uri: d.data }} style={dg.img} resizeMode="contain" />
              <View style={dg.itemFooter}>
                <Text style={dg.caption}>Page {d.page}</Text>
                <Feather name="zoom-in" size={10} color="#9ca3af" />
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} label={zoomLabel} onClose={() => setZoomUri(null)} />
    </>
  );
}
const dg = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  icon: { fontSize: 16 },
  heading: { fontSize: 14, fontFamily: "Inter_700Bold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  item: { width: "47%", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  img: { width: "100%", height: 120 },
  itemFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 8, paddingVertical: 5 },
  caption: { fontSize: 10, color: "#6b7280" },
});

/* ─── Main AnswerCard ────────────────────────────────────────────────────── */
export type AnswerCardProps = {
  streaming: boolean;
  streamText: string;
  response: QueryResponse | null;
  loading: boolean;
  mode?: "retrieve" | "explain";
  disclaimerMessages?: DisclaimerMessages | null;
  boardPageConfig?: BoardPageConfig | null;
  typographySettings?: TypographySettings | null;
  imagesLoading?: boolean;
  question?: string;
  accessToken?: string;
  studyContext?: StudyAnswerContext | null;
};

export default function AnswerCard({
  streaming, streamText, response, loading, mode,
  disclaimerMessages, boardPageConfig, typographySettings, imagesLoading,
  question, accessToken, studyContext,
}: AnswerCardProps) {
  const { isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setIsFocused(true);
    return () => setIsFocused(false);
  }, []));
  const resourceActions = !streaming && isFocused && response?.answer && studyContext && accessToken
    ? <StudyResources key={studyContext.id} context={studyContext} accessToken={accessToken} />
    : null;

  /* ── loading spinner ── */
  if (loading && !streaming) {
    const loadBg = isDark ? "rgba(102,126,234,0.15)" : "rgba(102,126,234,0.06)";
    const loadBorder = isDark ? BORDER_DARK : "rgba(102,126,234,0.25)";
    const loadText = isDark ? "#e5e7eb" : "#374151";
    return (
      <View style={[an.loadCard, { backgroundColor: loadBg, borderColor: loadBorder }]}>
        <SpinnerRing />
        <Text style={[an.loadText, { color: loadText }]}>Searching through your textbook...</Text>
        <Text style={an.loadSub}>This may take a few moments</Text>
      </View>
    );
  }

  const rawText = streaming ? streamText : (response?.answer ?? "");
  if (!rawText) return null;
  const displayText = preprocessMarkdown(rawText);

  /* ── theme tokens for BOX 2 ── */
  const answerBorder = isDark ? "rgba(102,126,234,0.30)" : "#bfdbfe";
  const iconBg = isDark ? "rgba(102,126,234,0.25)" : "#ffffff";
  const labelColor = isDark ? "#ffffff" : "#111827";

  /* ── Phase 1 citations: check new field + backward-compat from sources ── */
  const phase1Citations: Phase1CitationImage[] =
    response?.phase1_citations?.length
      ? response.phase1_citations
      : (response?.sources?.flatMap((s) =>
          (s.base64_images ?? []).map((img) => ({
            page: img.page,
            data: img.data,
            ncert_url: img.ncert_url,
          }))
        ) ?? []);

  const phase2Citations = response?.citation_images ?? [];
  const hasCitations = !streaming && (phase1Citations.length > 0 || phase2Citations.length > 0);
  const hasDiagrams  = !streaming && (response?.diagram_images?.length ?? 0) > 0;

  return (
    <>
      {/* BOX 1 — AI Warning Disclaimer */}
      {!!disclaimerMessages?.ai_warning_text && (
        <DisclaimerBox text={disclaimerMessages.ai_warning_text} isDark={isDark} />
      )}

      {/* BOX 2 — Answer Text */}
      {isDark ? (
        <View style={[an.answerCard, { backgroundColor: "rgba(102,126,234,0.18)", borderColor: answerBorder }]}>
          <View style={an.header}>
            <View style={[an.iconBox, { backgroundColor: iconBg }]}>
              <Text style={{ fontSize: 20 }}>✨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[an.answerLabel, { color: labelColor }]}>Answer</Text>
              {streaming && <Text style={an.typing}>typing...</Text>}
            </View>
          </View>
          <Markdown style={getMdStyles(isDark, typographySettings) as never}>{displayText}</Markdown>
          {!streaming && response?.validation && mode === "explain" && (
            <ValidationBadge v={response.validation} />
          )}
          {resourceActions}
        </View>
      ) : (
        <LinearGradient colors={["#eff6ff", "#faf5ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[an.answerCard, { borderColor: answerBorder }]}>
          <View style={an.header}>
            <View style={[an.iconBox, { backgroundColor: iconBg }]}>
              <Text style={{ fontSize: 20 }}>✨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[an.answerLabel, { color: labelColor }]}>Answer</Text>
              {streaming && <Text style={an.typing}>typing...</Text>}
            </View>
          </View>
          <Markdown style={getMdStyles(isDark, typographySettings) as never}>{displayText}</Markdown>
          {!streaming && response?.validation && mode === "explain" && (
            <ValidationBadge v={response.validation} />
          )}
          {resourceActions}
        </LinearGradient>
      )}

      {/* BOX 3 — Sources (page badge pills) */}
      {!streaming && (response?.sources?.length ?? 0) > 0 && (
        <SourcesPillsBox
          sources={response!.sources!}
          disclaimerText={disclaimerMessages?.source_citation_text}
          isDark={isDark}
        />
      )}

      {/* BOX 4 — Page Citations (or loading row) */}
      {!streaming && imagesLoading && (
        <ImagesLoadingRow isDark={isDark} />
      )}
      {hasCitations && !imagesLoading && (
        phase1Citations.length > 0
          ? <Phase1CitationsBox citations={phase1Citations} boardPageConfig={boardPageConfig} disclaimerText={disclaimerMessages?.page_context_text} isDark={isDark} />
          : <Phase2CitationsBox citations={phase2Citations} isDark={isDark} />
      )}

      {/* BOX 5 — Diagrams from Textbook */}
      {hasDiagrams && (
        <DiagramsBox diagrams={response!.diagram_images!} isDark={isDark} />
      )}
    </>
  );
}

const an = StyleSheet.create({
  loadCard: { borderRadius: 14, borderWidth: 1, paddingVertical: 48, paddingHorizontal: 20, alignItems: "center", marginTop: 12 },
  loadText: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 18, textAlign: "center" },
  loadSub: { fontSize: 12, color: "#6b7280", marginTop: 6 },
  answerCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  answerLabel: { fontSize: 18, fontFamily: "Inter_700Bold" },
  typing: { fontSize: 11, color: "#a78bfa", fontFamily: "Inter_400Regular", marginTop: 1 },
});
