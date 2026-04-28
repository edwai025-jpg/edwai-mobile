import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";

import { CitationImage, DiagramImage, PageCitation, QueryResponse } from "@/services/api";

const PRIMARY = "#667eea";
const CARD_BG = "#1e1e3a";
const BORDER = "rgba(255,255,255,0.10)";

function ImageZoomModal({
  visible,
  uri,
  label,
  onClose,
}: {
  visible: boolean;
  uri: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={zm.backdrop}>
          <TouchableWithoutFeedback>
            <View style={zm.sheet}>
              <Pressable style={zm.closeBtn} onPress={onClose}>
                <Feather name="x" size={20} color="#333" />
              </Pressable>
              <ScrollView
                maximumZoomScale={4}
                minimumZoomScale={1}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center" }}
              >
                <Image source={{ uri }} style={zm.image} resizeMode="contain" />
              </ScrollView>
              <View style={zm.footer}>
                <Text style={zm.footerText}>{label}</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const zm = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  sheet: {
    backgroundColor: "#fff", borderRadius: 12,
    width: "100%", maxHeight: "90%", overflow: "hidden",
  },
  closeBtn: {
    position: "absolute", top: 8, right: 8, zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 20, padding: 6,
  },
  image: { width: "100%", height: 420 },
  footer: { backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb", padding: 10 },
  footerText: { fontSize: 12, color: "#6b7280", textAlign: "center" },
});

function SourcesSection({ sources }: { sources: PageCitation[] }) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  const pageNumbers = Array.from(new Set(sources.map((s) => s.page))).sort((a, b) => a - b);
  const allImages = sources.flatMap((s) => s.base64_images ?? []);
  const isNcert = allImages.some((i) => i.ncert_url);

  return (
    <>
      <View style={src.card}>
        <Text style={src.heading}>📄 Sources</Text>
        <View style={src.pillRow}>
          {pageNumbers.map((pg) => (
            <View key={pg} style={src.pill}>
              <Text style={src.pillText}>Page {pg}</Text>
            </View>
          ))}
        </View>

        {isNcert ? (
          <View style={src.ncertBox}>
            <Text style={src.ncertTitle}>NCERT Source:</Text>
            <Text style={src.ncertDesc}>Please refer to the listed pages in your NCERT textbook.</Text>
          </View>
        ) : (
          allImages.slice(0, 6).map((img, idx) => (
            <Pressable
              key={idx}
              onPress={() => { setZoomUri(img.data); setZoomLabel(`Page Citation — Page ${img.page}`); }}
            >
              <View style={src.imageCard}>
                <Image source={{ uri: img.data }} style={src.image} resizeMode="contain" />
                <View style={src.imageFooter}>
                  <Text style={src.imageFooterText}>Page {img.page}</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
      <ImageZoomModal
        visible={!!zoomUri}
        uri={zoomUri ?? ""}
        label={zoomLabel}
        onClose={() => setZoomUri(null)}
      />
    </>
  );
}

const src = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, padding: 16, marginTop: 12,
  },
  heading: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 10 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  pill: {
    backgroundColor: "rgba(102,126,234,0.25)", borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(102,126,234,0.40)",
    paddingHorizontal: 12, paddingVertical: 4,
  },
  pillText: { fontSize: 12, color: "#d1d5db" },
  ncertBox: {
    backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(16,185,129,0.3)", padding: 12, marginTop: 8,
  },
  ncertTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#10b981", marginBottom: 4 },
  ncertDesc: { fontSize: 12, color: "#a7f3d0" },
  imageCard: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8, overflow: "hidden", marginTop: 8,
  },
  image: { width: "100%", height: 160 },
  imageFooter: { backgroundColor: "#111827", padding: 6 },
  imageFooterText: { fontSize: 11, color: "#9ca3af", textAlign: "center" },
});

function DiagramsSection({ diagrams }: { diagrams: DiagramImage[] }) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  return (
    <>
      <View style={dg.card}>
        <Text style={dg.heading}>🖼️ Diagrams from Textbook</Text>
        <View style={dg.grid}>
          {diagrams.map((d, idx) => (
            <Pressable
              key={idx}
              style={dg.item}
              onPress={() => { setZoomUri(d.data); setZoomLabel(`Diagram — Page ${d.page}`); }}
            >
              <Image source={{ uri: d.data }} style={dg.image} resizeMode="contain" />
              <Text style={dg.label}>Page {d.page}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ImageZoomModal
        visible={!!zoomUri}
        uri={zoomUri ?? ""}
        label={zoomLabel}
        onClose={() => setZoomUri(null)}
      />
    </>
  );
}

const dg = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, padding: 16, marginTop: 12,
  },
  heading: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: { width: "47%", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: BORDER },
  image: { width: "100%", height: 100 },
  label: { fontSize: 10, color: "#9ca3af", textAlign: "center", padding: 4, backgroundColor: "#111827" },
});

function CitationsSection({ citations }: { citations: CitationImage[] }) {
  const [zoomUri, setZoomUri] = React.useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = React.useState("");

  return (
    <>
      <View style={src.card}>
        <Text style={src.heading}>📄 Sources</Text>
        {citations.map((c, idx) => (
          <Pressable
            key={idx}
            onPress={() => {
              setZoomUri(`data:image/jpeg;base64,${c.base64_image}`);
              setZoomLabel(`Page Citation — Page ${c.page_number}`);
            }}
          >
            <View style={src.imageCard}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${c.base64_image}` }}
                style={src.image}
                resizeMode="contain"
              />
              <View style={src.imageFooter}>
                <Text style={src.imageFooterText}>Page {c.page_number}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
      <ImageZoomModal
        visible={!!zoomUri}
        uri={zoomUri ?? ""}
        label={zoomLabel}
        onClose={() => setZoomUri(null)}
      />
    </>
  );
}

const mdStyles = {
  body: { color: "#e5e7eb", fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 },
  heading1: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 8, marginBottom: 4 },
  heading2: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 8, marginBottom: 4 },
  heading3: { color: "#c4b5fd", fontFamily: "Inter_600SemiBold", fontSize: 15, marginTop: 6, marginBottom: 2 },
  strong: { color: "#fff", fontFamily: "Inter_700Bold" },
  em: { color: "#d1d5db", fontStyle: "italic" as const },
  bullet_list: { marginLeft: 4 },
  ordered_list: { marginLeft: 4 },
  bullet_list_item: { color: "#e5e7eb" },
  ordered_list_item: { color: "#e5e7eb" },
  code_inline: {
    backgroundColor: "rgba(102,126,234,0.2)", color: "#a78bfa",
    fontFamily: "Inter_500Medium", borderRadius: 4, paddingHorizontal: 4,
  },
  fence: {
    backgroundColor: "#111827", borderRadius: 8,
    padding: 12, marginVertical: 8,
  },
  code_block: { color: "#a7f3d0", fontFamily: "Inter_400Regular", fontSize: 12 },
  blockquote: {
    borderLeftWidth: 4, borderLeftColor: "#60a5fa",
    paddingLeft: 12, opacity: 0.9,
  },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4 },
  th: { backgroundColor: "rgba(102,126,234,0.2)", color: "#fff", fontFamily: "Inter_600SemiBold", padding: 8 },
  td: { color: "#e5e7eb", padding: 8, borderTopWidth: 1, borderTopColor: BORDER },
};

type AnswerCardProps = {
  streaming: boolean;
  streamText: string;
  response: QueryResponse | null;
  loading: boolean;
  mode?: "retrieve" | "explain";
};

export default function AnswerCard({ streaming, streamText, response, loading, mode }: AnswerCardProps) {
  if (loading && !streaming) {
    return (
      <View style={an.loadingCard}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={an.loadingText}>Searching through your textbook...</Text>
        <Text style={an.loadingSubtext}>This may take a few moments</Text>
      </View>
    );
  }

  const displayText = streaming ? streamText : (response?.answer ?? "");
  if (!displayText) return null;

  return (
    <View style={an.card}>
      <View style={an.header}>
        <View style={an.iconBox}>
          <Text style={{ fontSize: 18 }}>✨</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={an.answerLabel}>Answer</Text>
          {streaming && <Text style={an.typing}>typing...</Text>}
        </View>
      </View>

      <Markdown style={mdStyles as never}>{displayText}</Markdown>

      {!streaming && response?.validation && mode === "explain" && (
        <ValidationBadge v={response.validation} />
      )}

      {!streaming && response?.sources && response.sources.length > 0 && (
        <SourcesSection sources={response.sources} />
      )}

      {!streaming && response?.diagram_images && response.diagram_images.length > 0 && (
        <DiagramsSection diagrams={response.diagram_images} />
      )}

      {!streaming && response?.citation_images && response.citation_images.length > 0 && (
        <CitationsSection citations={response.citation_images} />
      )}
    </View>
  );
}

function ValidationBadge({ v }: { v: NonNullable<QueryResponse["validation"]> }) {
  const bg = v.is_reliable
    ? "rgba(16,185,129,0.1)"
    : v.confidence >= 0.6
    ? "rgba(245,158,11,0.1)"
    : "rgba(239,68,68,0.1)";
  const color = v.is_reliable ? "#10b981" : v.confidence >= 0.6 ? "#f59e0b" : "#ef4444";
  const icon = v.is_reliable ? "✅" : v.confidence >= 0.6 ? "⚠️" : "❌";

  return (
    <View style={[an.validationBox, { backgroundColor: bg, borderColor: color + "40" }]}>
      <Text style={[an.validationText, { color }]}>
        {icon} Answer Validation: {Math.round(v.confidence * 100)}% Verified
      </Text>
      <Text style={[an.validationSub, { color }]}>
        {v.validated_facts} verified · {v.partial_facts} partial · {v.unverified_facts} unverified
      </Text>
    </View>
  );
}

const an = StyleSheet.create({
  loadingCard: {
    backgroundColor: "rgba(102,126,234,0.1)", borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    padding: 40, alignItems: "center", marginTop: 12,
  },
  loadingText: { fontSize: 15, color: "#e5e7eb", fontFamily: "Inter_600SemiBold", marginTop: 16 },
  loadingSubtext: { fontSize: 12, color: "#6b7280", marginTop: 6 },
  card: {
    backgroundColor: CARD_BG, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, padding: 16, marginTop: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  iconBox: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: "rgba(102,126,234,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  answerLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  typing: { fontSize: 11, color: "#a78bfa", fontFamily: "Inter_400Regular" },
  validationBox: {
    borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 10,
  },
  validationText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  validationSub: { fontSize: 11, marginTop: 2 },
});
