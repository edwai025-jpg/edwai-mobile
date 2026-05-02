import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
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

import { useTheme } from "@/context/theme";
import { CitationImage, DiagramImage, PageCitation, QueryResponse } from "@/services/api";

const PRIMARY = "#667eea";
const CARD_BG = "#1e1e3a";
const BORDER = "rgba(255,255,255,0.10)";

/* ─── Preprocess markdown text ─────────────────────────────────────────── */
function preprocessMarkdown(text: string): string {
  let out = text;
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);
  out = out.replace(/\[Page (\d+)\]/g, (_, n) => `**[Page ${n}]**`);
  return out;
}

/* ─── Dynamic markdown styles ───────────────────────────────────────────── */
function getMdStyles(isDark: boolean) {
  const body = isDark ? "#e5e7eb" : "#374151";
  const heading = isDark ? "#fff" : "#111827";
  const h3 = isDark ? "#c4b5fd" : "#6d28d9";
  const em = isDark ? "#d1d5db" : "#4b5563";
  const item = isDark ? "#e5e7eb" : "#374151";
  const border = isDark ? BORDER : "#e5e7eb";
  const thBg = isDark ? "rgba(102,126,234,0.2)" : "rgba(102,126,234,0.10)";
  const tdColor = isDark ? "#e5e7eb" : "#374151";
  const fenceBg = isDark ? "#111827" : "#f3f4f6";
  const codeColor = isDark ? "#a7f3d0" : "#065f46";

  return {
    body: { color: body, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 },
    heading1: { color: heading, fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 10, marginBottom: 4 },
    heading2: { color: heading, fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 8, marginBottom: 4 },
    heading3: { color: h3, fontFamily: "Inter_600SemiBold", fontSize: 15, marginTop: 6, marginBottom: 2 },
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

/* ─── Animated Spinner Ring ─────────────────────────────────────────────── */
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
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, borderColor: PRIMARY, borderTopColor: "transparent" },
});

/* ─── Image Zoom Modal ───────────────────────────────────────────────────── */
function ImageZoomModal({ visible, uri, label, onClose }: { visible: boolean; uri: string; label: string; onClose: () => void }) {
  const isDiagram = label.toLowerCase().startsWith("🖼️");
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
                  <Text style={zm.footerText}>{isDiagram ? "🖼️ Diagram" : label}</Text>
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", justifyContent: "center", padding: 16 },
  container: { position: "relative" },
  closeBtn: { position: "absolute", top: -44, right: 0, zIndex: 20, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 22, padding: 8 },
  card: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, elevation: 20 },
  image: { width: "100%", height: 420 },
  footer: { backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingVertical: 10, paddingHorizontal: 14 },
  footerText: { fontSize: 12, color: "#6b7280", textAlign: "center" },
});

/* ─── Sources Section ───────────────────────────────────────────────────── */
function SourcesSection({ sources, isDark }: { sources: PageCitation[]; isDark: boolean }) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  const cardBg = isDark ? CARD_BG : "#ffffff";
  const cardBorder = isDark ? BORDER : "#e5e7eb";
  const headingColor = isDark ? "#fff" : "#111827";
  const pillTextColor = isDark ? "#d1d5db" : "#4b5563";

  const pageNumbers = Array.from(new Set(sources.map((s) => s.page))).sort((a, b) => a - b);
  const allImages = sources.flatMap((s) => s.base64_images ?? []);
  const isNcert = allImages.some((i) => i.ncert_url);

  return (
    <>
      <View style={[src.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <Text style={[src.heading, { color: headingColor }]}>📄 Sources</Text>
        <View style={src.pillRow}>
          {pageNumbers.map((pg) => (
            <View key={pg} style={[src.pill, !isDark && { backgroundColor: "rgba(102,126,234,0.10)", borderColor: "rgba(102,126,234,0.30)" }]}>
              <Text style={[src.pillText, { color: pillTextColor }]}>Page {pg}</Text>
            </View>
          ))}
        </View>
        {isNcert && (
          <View style={src.ncertCard}>
            <Text style={src.ncertTitle}>NCERT Source:</Text>
            <Text style={[src.ncertDesc, !isDark && { color: "#065f46" }]}>Please refer to all the listed pages in your NCERT textbook.</Text>
            <View style={src.ncertLinks}>
              {allImages.filter((img) => img.ncert_url).map((img, i) => (
                <Pressable key={i} style={src.ncertPageBtn} onPress={() => img.ncert_url && Linking.openURL(img.ncert_url)}>
                  <Text style={src.ncertPageBtnText}>Page {img.page}</Text>
                  <Feather name="external-link" size={11} color="#065f46" />
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {!isNcert && allImages.slice(0, 8).map((img, idx) => (
          <Pressable key={idx} style={[src.imageCard, !isDark && { borderColor: "#e5e7eb" }]} onPress={() => { setZoomUri(img.data); setZoomLabel(`📖 Page Citation — Page ${img.page}`); }}>
            <Image source={{ uri: img.data }} style={src.image} resizeMode="contain" />
            <View style={src.imageFooter}>
              <Text style={src.imageFooterText}>Page {img.page}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} label={zoomLabel} onClose={() => setZoomUri(null)} />
    </>
  );
}
const src = StyleSheet.create({
  card: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16, marginTop: 12 },
  heading: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 10 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  pill: { backgroundColor: "rgba(102,126,234,0.25)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(102,126,234,0.40)", paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontSize: 12, color: "#d1d5db" },
  ncertCard: { backgroundColor: "rgba(16,185,129,0.07)", borderRadius: 10, borderWidth: 2, borderColor: "#34d399", padding: 14 },
  ncertTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#10b981", marginBottom: 4 },
  ncertDesc: { fontSize: 12, color: "#a7f3d0", lineHeight: 18, marginBottom: 10 },
  ncertLinks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ncertPageBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff", borderRadius: 6, borderWidth: 2, borderColor: "#34d399", paddingHorizontal: 10, paddingVertical: 6 },
  ncertPageBtnText: { fontSize: 12, color: "#065f46", fontFamily: "Inter_600SemiBold" },
  imageCard: { borderRadius: 10, borderWidth: 1, borderColor: BORDER, overflow: "hidden", marginTop: 10, backgroundColor: "#fff" },
  image: { width: "100%", height: 180 },
  imageFooter: { backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb", padding: 8 },
  imageFooterText: { fontSize: 11, color: "#6b7280", textAlign: "center" },
});

/* ─── Diagrams Section ───────────────────────────────────────────────────── */
function DiagramsSection({ diagrams, isDark }: { diagrams: DiagramImage[]; isDark: boolean }) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  const cardBg = isDark ? CARD_BG : "#ffffff";
  const cardBorder = isDark ? BORDER : "#e5e7eb";
  const headingColor = isDark ? "#fff" : "#111827";

  return (
    <>
      <View style={[dg.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <Text style={[dg.heading, { color: headingColor }]}>🖼️ Diagrams from Textbook</Text>
        <View style={dg.grid}>
          {diagrams.map((d, idx) => (
            <Pressable key={idx} style={[dg.item, !isDark && { borderColor: "#e5e7eb" }]} onPress={() => { setZoomUri(d.data); setZoomLabel(`🖼️ Diagram — Page ${d.page}`); }}>
              <Image source={{ uri: d.data }} style={dg.image} resizeMode="contain" />
              <View style={dg.itemFooter}>
                <Text style={dg.itemFooterText}>Page {d.page}</Text>
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
  card: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16, marginTop: 12 },
  heading: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  item: { width: "47%", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: BORDER, backgroundColor: "#fff" },
  image: { width: "100%", height: 110 },
  itemFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingVertical: 5 },
  itemFooterText: { fontSize: 10, color: "#6b7280" },
});

/* ─── Citations Section ──────────────────────────────────────────────────── */
function CitationsSection({ citations, isDark }: { citations: CitationImage[]; isDark: boolean }) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  const cardBg = isDark ? CARD_BG : "#ffffff";
  const cardBorder = isDark ? BORDER : "#e5e7eb";
  const headingColor = isDark ? "#fff" : "#111827";

  return (
    <>
      <View style={[src.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <Text style={[src.heading, { color: headingColor }]}>📄 Sources</Text>
        {citations.map((c, idx) => {
          const uri = `data:image/jpeg;base64,${c.base64_image}`;
          return (
            <Pressable key={idx} style={[src.imageCard, !isDark && { borderColor: "#e5e7eb" }]} onPress={() => { setZoomUri(uri); setZoomLabel(`📖 Page Citation — Page ${c.page_number}`); }}>
              <Image source={{ uri }} style={src.image} resizeMode="contain" />
              <View style={src.imageFooter}>
                <Text style={src.imageFooterText}>Page {c.page_number}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} label={zoomLabel} onClose={() => setZoomUri(null)} />
    </>
  );
}

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

/* ─── Main AnswerCard ────────────────────────────────────────────────────── */
type AnswerCardProps = {
  streaming: boolean;
  streamText: string;
  response: QueryResponse | null;
  loading: boolean;
  mode?: "retrieve" | "explain";
};

export default function AnswerCard({ streaming, streamText, response, loading, mode }: AnswerCardProps) {
  const { isDark } = useTheme();

  const cardBg = isDark ? CARD_BG : "#ffffff";
  const cardBorder = isDark ? BORDER : "#e5e7eb";
  const answerLabelColor = isDark ? "#fff" : "#111827";
  const loadingTextColor = isDark ? "#e5e7eb" : "#374151";
  const loadingCardBg = isDark ? "rgba(102,126,234,0.15)" : "rgba(102,126,234,0.06)";
  const loadingCardBorder = isDark ? BORDER : "rgba(102,126,234,0.25)";

  if (loading && !streaming) {
    return (
      <View style={[an.loadingCard, { backgroundColor: loadingCardBg, borderColor: loadingCardBorder }]}>
        <SpinnerRing />
        <Text style={[an.loadingText, { color: loadingTextColor }]}>Searching through your textbook...</Text>
        <Text style={an.loadingSubtext}>This may take a few moments</Text>
      </View>
    );
  }

  const rawText = streaming ? streamText : (response?.answer ?? "");
  if (!rawText) return null;

  const displayText = preprocessMarkdown(rawText);

  return (
    <View style={[an.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={an.header}>
        <View style={[an.iconBox, !isDark && { backgroundColor: "rgba(102,126,234,0.10)" }]}>
          <Text style={{ fontSize: 20 }}>✨</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[an.answerLabel, { color: answerLabelColor }]}>Answer</Text>
          {streaming && <Text style={an.typing}>typing...</Text>}
        </View>
      </View>

      <Markdown style={getMdStyles(isDark) as never}>{displayText}</Markdown>

      {!streaming && response?.validation && mode === "explain" && (
        <ValidationBadge v={response.validation} />
      )}

      {!streaming && response?.sources && response.sources.length > 0 && (
        <SourcesSection sources={response.sources} isDark={isDark} />
      )}

      {!streaming && response?.diagram_images && response.diagram_images.length > 0 && (
        <DiagramsSection diagrams={response.diagram_images} isDark={isDark} />
      )}

      {!streaming && response?.citation_images && response.citation_images.length > 0 && (
        <CitationsSection citations={response.citation_images} isDark={isDark} />
      )}
    </View>
  );
}

const an = StyleSheet.create({
  loadingCard: { backgroundColor: "rgba(102,126,234,0.15)", borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingVertical: 48, paddingHorizontal: 20, alignItems: "center", marginTop: 12 },
  loadingText: { fontSize: 15, color: "#e5e7eb", fontFamily: "Inter_600SemiBold", marginTop: 18, textAlign: "center" },
  loadingSubtext: { fontSize: 12, color: "#6b7280", marginTop: 6 },
  card: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16, marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(102,126,234,0.2)", alignItems: "center", justifyContent: "center" },
  answerLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  typing: { fontSize: 11, color: "#a78bfa", fontFamily: "Inter_400Regular", marginTop: 1 },
});
