import { Feather, Ionicons } from "@expo/vector-icons";
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
import StemAnswerBody from "./StemAnswerBody";
import { preprocessLatex } from "@/services/stemFormatting";
import api from "@/services/api";

import StudyResources from "@/components/study/StudyResources";
import { useFocusEffect } from "expo-router";
import type { StudyAnswerContext } from "@/services/studyResources";
import { useTheme } from "@/context/theme";
import {
  BoardPageConfig,
  CitationImage,
  DiagramImage,
  DisclaimerMessages,
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
export function preprocessMarkdown(text: string): string {
  return preprocessLatex(text);
}

/* ─── Dynamic markdown styles ────────────────────────────────────────────── */
export function getMdStyles(isDark: boolean, typography?: TypographySettings | null) {
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
function ImageZoomModal({ visible, uri, label, onClose, imageOnly = false }: { visible: boolean; uri: string; label?: string; onClose: () => void; imageOnly?: boolean }) {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    if (!visible || !uri) return;
    let active = true;
    setRatio(null);
    Image.getSize(uri, (w, h) => { if (active && w > 0 && h > 0) setRatio(w / h); }, () => {});
    return () => { active = false; };
  }, [visible, uri]);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose} testID="image-zoom-backdrop">
        <View style={[zm.backdrop, imageOnly && { backgroundColor: "rgba(0,0,0,0.75)" }]}>
          <View style={zm.container}>
            <Pressable style={zm.closeBtn} onPress={onClose} hitSlop={12} testID="image-zoom-close" accessibilityRole="button" accessibilityLabel="Close">
              <Feather name="x" size={20} color="#fff" />
            </Pressable>
            <TouchableWithoutFeedback>
              <View style={zm.card}>
                <ScrollView maximumZoomScale={4} minimumZoomScale={1} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center" }} style={{ maxHeight: imageOnly ? ("90%" as `${number}%`) : ("85%" as `${number}%`) }}>
                  <Image
                    source={{ uri }}
                    style={ratio ? { width: "100%", aspectRatio: ratio } : zm.image}
                    resizeMode="contain"
                    accessibilityLabel={imageOnly ? "Related study page" : label}
                    testID="image-zoom-image"
                  />
                </ScrollView>
                {!imageOnly && !!label && (
                  <View style={zm.footer}>
                    <Text style={zm.footerText}>{label}</Text>
                  </View>
                )}
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
  container: { position: "relative", width: "100%", maxWidth: 1152, alignSelf: "center", paddingTop: 44 },
  closeBtn: { position: "absolute", top: 0, right: 0, zIndex: 20, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 22, padding: 8 },
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

/* ─── BOX 3 — Sources (notice only) ─────────────────────────────────────── */
function SourcesBox({ noticeText, isDark }: { noticeText?: string; isDark: boolean }) {
  const cardBg = isDark ? "rgba(30,30,46,0.90)" : "#ffffff";
  const cardBorder = isDark ? "rgba(102,126,234,0.30)" : "#e5e7eb";
  const headingColor = isDark ? "#ffffff" : "#111827";
  const noticeColor = isDark ? "#9ca3af" : "#6b7280";
  return (
    <View style={[sb.card, { backgroundColor: cardBg, borderColor: cardBorder }]} testID="answer-sources-card">
      <View style={sb.headerRow}>
        <Feather name="file-text" size={18} color={headingColor} />
        <Text style={[sb.heading, { color: headingColor }]}>Sources</Text>
      </View>
      {!!noticeText && (
        <Text style={[sb.notice, { color: noticeColor }]} testID="answer-sources-notice">{noticeText}</Text>
      )}
    </View>
  );
}
const sb = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginTop: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  heading: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notice: { fontSize: 12, fontStyle: "italic", lineHeight: 17, marginLeft: 28, marginBottom: 12 },
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

/* ─── BOX 4 — Shared-book Page Citations / AI Study Pages ───────────────── */
type SharedCitation = { page: number; data: string | null; ncert_url?: string; image_role?: string };

function SharedStudyImage({ uri, onPress, index }: { uri: string; onPress: () => void; index: number }) {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    Image.getSize(uri, (w, h) => { if (active && w > 0 && h > 0) setRatio(w / h); }, () => {});
    return () => { active = false; };
  }, [uri]);
  return (
    <Pressable onPress={onPress} testID={`shared-citation-image-${index}`} accessibilityRole="imagebutton" accessibilityLabel="Related study page">
      <Image
        source={{ uri }}
        style={{ width: "100%", aspectRatio: ratio ?? 0.75 }}
        resizeMode="contain"
        accessibilityLabel="Related study page"
        onLoad={(e) => {
          const src = e.nativeEvent?.source;
          if (src?.width && src?.height) setRatio(src.width / src.height);
        }}
      />
    </Pressable>
  );
}

function SharedCitationsBox({
  citations, generatedMode, embeddedMode, disclaimerText,
}: {
  citations: SharedCitation[];
  generatedMode: boolean;
  embeddedMode: boolean;
  disclaimerText?: string;
}) {
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const isEmbedded = !generatedMode && embeddedMode && citations.some((c) => !!c.ncert_url);
  const images = citations.filter((c) => !!c.data);

  return (
    <>
      <View style={pc.card} testID="shared-citations-card">
        <View style={pc.headerRow}>
          {generatedMode
            ? <Ionicons name="color-palette-outline" size={24} color="#111827" />
            : <Feather name="book-open" size={24} color="#111827" />}
          <Text style={pc.heading}>{generatedMode ? "AI Study Pages" : "Page Citations"}</Text>
        </View>

        {!!disclaimerText && (
          <View style={pc.contextBox} testID="shared-citations-notice">
            <Text style={pc.contextText}>ℹ️ {disclaimerText}</Text>
          </View>
        )}

        {isEmbedded ? (
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
          <View style={pc.stack}>
            {images.map((c, i) => {
              const direct = c.image_role === "direct_match";
              return (
                <View key={i} style={[pc.imgCard, { borderColor: direct ? "#93c5fd" : "#e5e7eb" }]} testID={`shared-citation-card-${i}`}>
                  <SharedStudyImage uri={c.data!} index={i} onPress={() => setZoomUri(c.data!)} />
                  <View style={pc.imgFooter}>
                    <Text style={[pc.roleLabel, { color: direct ? "#1d4ed8" : "#6b7280" }]} testID={`shared-citation-role-${i}`}>
                      {direct ? "BEST MATCH" : "NEARBY CONTEXT"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} imageOnly onClose={() => setZoomUri(null)} />
    </>
  );
}
const pc = StyleSheet.create({
  card: { borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#ffffff", padding: 24, marginTop: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  heading: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  contextBox: { backgroundColor: "#eff6ff", borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe", padding: 12, marginBottom: 16 },
  contextText: { fontSize: 14, color: "#1e3a8a", lineHeight: 20 },
  ncertWrap: { backgroundColor: "#ecfdf5", borderRadius: 10, borderWidth: 2, borderColor: "#34d399", padding: 14 },
  ncertTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#065f46", marginBottom: 4 },
  ncertDesc: { fontSize: 12, color: "#047857", lineHeight: 18, marginBottom: 10 },
  ncertLinks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ncertBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff", borderRadius: 8, borderWidth: 2, borderColor: "#34d399", paddingHorizontal: 12, paddingVertical: 7 },
  ncertBtnText: { fontSize: 12, color: "#065f46", fontFamily: "Inter_600SemiBold" },
  stack: { gap: 16 },
  imgCard: { borderRadius: 8, borderWidth: 1, overflow: "hidden", backgroundColor: "#ffffff" },
  imgFooter: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 8 },
  roleLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
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
  isOwnBook?: boolean;
};

export default function AnswerCard({
  streaming, streamText, response, loading, mode,
  disclaimerMessages, boardPageConfig, typographySettings, imagesLoading,
  question, accessToken, studyContext, isOwnBook = false,
}: AnswerCardProps) {
  const { isDark } = useTheme();
  const [fetchedTypography, setFetchedTypography] = useState<TypographySettings | null>(null);
  useEffect(() => {
    if (typographySettings !== undefined || !accessToken) return;
    let active = true;
    api.study.getTypographySettings(accessToken).then(value => { if (active) setFetchedTypography(value); }).catch(() => {});
    return () => { active = false; };
  }, [accessToken, typographySettings]);
  const effectiveTypography = typographySettings ?? fetchedTypography;
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
  /* ── theme tokens for BOX 2 ── */
  const answerBorder = isDark ? "rgba(102,126,234,0.30)" : "#bfdbfe";
  const iconBg = isDark ? "rgba(102,126,234,0.25)" : "#ffffff";
  const labelColor = isDark ? "#ffffff" : "#111827";

  /* ── Shared-book citations: ONLY response.sources[0].base64_images ── */
  const answerNotFound = !!response?.answer_not_found;
  const generatedMode = boardPageConfig?.page_display_mode === "edwai_generated";
  const sharedCitations: SharedCitation[] =
    !isOwnBook && !answerNotFound
      ? ((response?.sources?.[0]?.base64_images ?? []) as SharedCitation[])
      : [];
  const sharedVisible = generatedMode ? sharedCitations.filter((c) => !!c.data) : sharedCitations;

  const phase2Citations = answerNotFound || !isOwnBook ? [] : (response?.citation_images ?? []);
  const showShared   = !streaming && sharedVisible.length > 0;
  const showPhase2   = !streaming && !showShared && phase2Citations.length > 0;
  const diagrams     = answerNotFound || (generatedMode && !isOwnBook) ? [] : (response?.diagram_images ?? []);
  const hasDiagrams  = !streaming && diagrams.length > 0;

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
          <StemAnswerBody content={rawText} isDark={isDark} typography={effectiveTypography} streaming={streaming} />
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
          <StemAnswerBody content={rawText} isDark={isDark} typography={effectiveTypography} streaming={streaming} />
          {!streaming && response?.validation && mode === "explain" && (
            <ValidationBadge v={response.validation} />
          )}
          {resourceActions}
        </LinearGradient>
      )}

      {/* BOX 3 — Sources (notice only) */}
      {!streaming && (response?.sources?.length ?? 0) > 0 && (
        <SourcesBox noticeText={disclaimerMessages?.source_citation_text} isDark={isDark} />
      )}

      {/* BOX 4 — Page Citations / AI Study Pages (or loading row) */}
      {!streaming && imagesLoading && !answerNotFound && (
        <ImagesLoadingRow isDark={isDark} />
      )}
      {!imagesLoading && showShared && (
        <SharedCitationsBox
          citations={sharedVisible}
          generatedMode={generatedMode}
          embeddedMode={boardPageConfig?.page_display_mode === "embedded"}
          disclaimerText={disclaimerMessages?.page_context_text}
        />
      )}
      {!imagesLoading && showPhase2 && (
        <Phase2CitationsBox citations={phase2Citations} isDark={isDark} />
      )}

      {/* BOX 5 — Diagrams from Textbook */}
      {hasDiagrams && (
        <DiagramsBox diagrams={diagrams} isDark={isDark} />
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
