import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnswerCard from "@/components/study/AnswerCard";
import FlashcardsSection from "@/components/study/FlashcardsSection";
import { useAuth } from "@/context/auth";
import api, {
  ApiError,
  DocumentItem,
  Flashcard,
  QueryHistoryItem,
  QueryResponse,
} from "@/services/api";

const PRIMARY = "#667eea";
const CARD_BG = "#1e1e3a";
const BORDER = "rgba(255,255,255,0.10)";
const TEXT_COLOR = "#f9fafb";
const MUTED = "#9ca3af";

const STATUS_COLOR: Record<DocumentItem["processing_status"], string> = {
  completed: "#10b981",
  processing: "#f59e0b",
  pending: "#60a5fa",
  failed: "#ef4444",
};

const STATUS_LABEL: Record<DocumentItem["processing_status"], string> = {
  completed: "Ready",
  processing: "Processing…",
  pending: "Queued",
  failed: "Failed",
};

/* ─── Delete Confirmation Modal ────────────────────────────────────────────── */
function DeleteModal({
  doc,
  onConfirm,
  onCancel,
  loading,
}: {
  doc: DocumentItem;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Modal visible transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={dm.backdrop}>
          <TouchableWithoutFeedback>
            <View style={dm.sheet}>
              <View style={dm.iconBox}>
                <Feather name="trash-2" size={24} color="#ef4444" />
              </View>
              <Text style={dm.title}>
                Delete {doc.source_type === "youtube" ? "Video" : "Book"}?
              </Text>
              <Text style={dm.docName} numberOfLines={2}>{doc.title}</Text>

              <View style={dm.infoBox}>
                <Text style={dm.infoText}>This will permanently delete:</Text>
                <Text style={dm.infoItem}>• The uploaded {doc.source_type === "youtube" ? "video transcript" : "book file"}</Text>
                <Text style={dm.infoItem}>• All AI processing and indexing</Text>
                <Text style={dm.infoItem}>• All cached data and query history</Text>
                <Text style={[dm.infoItem, { color: "#ef4444", fontFamily: "Inter_600SemiBold" }]}>
                  This cannot be undone.
                </Text>
              </View>

              <View style={dm.btnRow}>
                <Pressable style={dm.cancelBtn} onPress={onCancel}>
                  <Text style={dm.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[dm.deleteBtn, loading && { opacity: 0.6 }]} onPress={onConfirm} disabled={loading}>
                  {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={dm.deleteBtnText}>Delete Permanently</Text>}
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const dm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: "#1e1e3a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 },
  iconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(239,68,68,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 14, alignSelf: "center" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: TEXT_COLOR, textAlign: "center", marginBottom: 6 },
  docName: { fontSize: 13, color: MUTED, textAlign: "center", marginBottom: 14 },
  infoBox: { backgroundColor: "rgba(239,68,68,0.07)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", padding: 12, marginBottom: 18, gap: 4 },
  infoText: { fontSize: 12, color: MUTED, marginBottom: 4 },
  infoItem: { fontSize: 12, color: "#fca5a5" },
  btnRow: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: "#2a2a3e", borderRadius: 10, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: BORDER },
  cancelBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: MUTED },
  deleteBtn: { flex: 1, backgroundColor: "#dc2626", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  deleteBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

/* ─── Document Card ─────────────────────────────────────────────────────── */
function DocCard({
  doc,
  selected,
  onSelect,
  onDelete,
}: {
  doc: DocumentItem;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const isProcessing = doc.processing_status === "processing" || doc.processing_status === "pending";
  const statusColor = STATUS_COLOR[doc.processing_status];

  return (
    <Pressable
      style={[dc.card, selected && dc.cardSelected, !doc.is_ready && dc.cardDim]}
      onPress={doc.is_ready ? onSelect : undefined}
    >
      <View style={dc.row}>
        <View style={dc.iconWrap}>
          <Text style={{ fontSize: 22 }}>{doc.source_type === "youtube" ? "🎬" : "📄"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={dc.title} numberOfLines={2}>{doc.title}</Text>
          <View style={dc.meta}>
            {doc.page_count && <Text style={dc.metaText}>{doc.page_count} pages</Text>}
            {doc.page_count && <Text style={dc.dot}>·</Text>}
            <View style={[dc.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[dc.statusText, { color: statusColor }]}>{STATUS_LABEL[doc.processing_status]}</Text>
            {isProcessing && <ActivityIndicator size="small" color={statusColor} style={{ marginLeft: 4 }} />}
          </View>
        </View>
        <Pressable style={dc.deleteBtn} onPress={onDelete} hitSlop={10}>
          <Feather name="trash-2" size={16} color="#6b7280" />
        </Pressable>
      </View>
    </Pressable>
  );
}

const dc = StyleSheet.create({
  card: { backgroundColor: "#2a2a3e", borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 8 },
  cardSelected: { borderColor: PRIMARY, backgroundColor: "rgba(102,126,234,0.15)" },
  cardDim: { opacity: 0.7 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_COLOR, marginBottom: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: MUTED },
  dot: { fontSize: 11, color: MUTED },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  deleteBtn: { padding: 6 },
});

/* ─── Recent Questions ────────────────────────────────────────────────────── */
function RecentQuestionsPanel({ history, onSelect }: { history: QueryHistoryItem[]; onSelect: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;
  return (
    <View style={rq.card}>
      <Pressable style={rq.header} onPress={() => setOpen((v) => !v)}>
        <Text style={rq.headerText}>🕐 Recent Questions ({history.length})</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={15} color={MUTED} />
      </Pressable>
      {open && (
        <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
          {history.map((h) => (
            <Pressable key={h.id} style={rq.row} onPress={() => { onSelect(h.question); setOpen(false); }}>
              <Text style={rq.icon}>{h.mode === "retrieve" ? "📖" : "💡"}</Text>
              <Text style={rq.text} numberOfLines={1}>{h.question}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const rq = StyleSheet.create({
  card: { backgroundColor: "rgba(99,71,234,0.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(99,102,241,0.25)", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
  headerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#a5b4fc" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  icon: { fontSize: 13 },
  text: { flex: 1, fontSize: 13, color: "#d1d5db" },
});

/* ─── Main Screen ─────────────────────────────────────────────────────────── */
export default function OwnBooksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accessToken } = useAuth();
  const topPad = Platform.OS === "web" ? 16 : insets.top + 16;

  /* tab: "pdf" | "youtube" */
  const [activeTab, setActiveTab] = useState<"pdf" | "youtube">("pdf");

  /* documents */
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* pdf upload */
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfDocType, setPdfDocType] = useState("book");
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  /* youtube */
  const [ytUrl, setYtUrl] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ytSubmitting, setYtSubmitting] = useState(false);

  /* query */
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"retrieve" | "explain">("retrieve");
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);

  /* flashcards */
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);

  const abortCtrl = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── load + poll docs ── */
  const loadDocs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const list = await api.phase2.listDocuments(accessToken);
      setDocs(list);
      return list;
    } catch { return null; }
  }, [accessToken]);

  useEffect(() => {
    setDocsLoading(true);
    loadDocs().finally(() => setDocsLoading(false));
  }, [loadDocs]);

  useEffect(() => {
    const startPoll = () => {
      pollRef.current = setInterval(async () => {
        const list = await loadDocs();
        if (!list) return;
        const hasProcessing = list.some(
          (d) => d.processing_status === "processing" || d.processing_status === "pending"
        );
        if (!hasProcessing && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 3000);
    };

    const hasProcessing = docs.some(
      (d) => d.processing_status === "processing" || d.processing_status === "pending"
    );
    if (hasProcessing && !pollRef.current) startPoll();
    if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [docs, loadDocs]);

  /* ── pick PDF ── */
  const handlePickPdf = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPdfFile({ uri: asset.uri, name: asset.name });
      if (!pdfTitle) setPdfTitle(asset.name.replace(/\.pdf$/i, ""));
    } catch {}
  }, [pdfTitle]);

  /* ── upload PDF ── */
  const handleUploadPdf = useCallback(async () => {
    if (!pdfFile || !pdfTitle.trim() || !accessToken) return;
    setUploading(true);
    try {
      const doc = await api.phase2.uploadPdf(accessToken, pdfFile.uri, pdfFile.name, pdfTitle.trim(), pdfDocType);
      setDocs((prev) => [doc, ...prev]);
      setPdfFile(null);
      setPdfTitle("");
      Alert.alert("Uploaded", "Your PDF is being processed. It will be ready shortly.");
    } catch (e) {
      Alert.alert("Upload Failed", e instanceof ApiError ? e.message : "Could not upload PDF");
    } finally { setUploading(false); }
  }, [pdfFile, pdfTitle, pdfDocType, accessToken]);

  /* ── submit YouTube ── */
  const handleAddYoutube = useCallback(async () => {
    if (!ytUrl.trim() || !accessToken) return;
    setYtSubmitting(true);
    try {
      const doc = await api.phase2.addYoutube(accessToken, ytUrl.trim(), ytTitle.trim() || undefined);
      setDocs((prev) => [doc, ...prev]);
      setYtUrl("");
      setYtTitle("");
      Alert.alert("Added", "Your YouTube video is being processed.");
    } catch (e) {
      Alert.alert("Failed", e instanceof ApiError ? e.message : "Could not add YouTube link");
    } finally { setYtSubmitting(false); }
  }, [ytUrl, ytTitle, accessToken]);

  /* ── delete doc ── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget || !accessToken) return;
    setDeleting(true);
    try {
      await api.phase2.deleteDocument(accessToken, deleteTarget.id);
      setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      if (selectedDoc?.id === deleteTarget.id) {
        setSelectedDoc(null);
        setResponse(null);
        setStreamText("");
        setFlashcards([]);
      }
      setDeleteTarget(null);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not delete document");
    } finally { setDeleting(false); }
  }, [deleteTarget, accessToken, selectedDoc]);

  /* ── select doc ── */
  const onDocSelect = useCallback(async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setQuestion("");
    setResponse(null);
    setStreamText("");
    setFlashcards([]);
    if (!accessToken) return;
    try {
      const h = await api.phase2.getQueryHistory(accessToken, doc.id);
      setHistory(h);
    } catch {}
  }, [accessToken]);

  /* ── query ── */
  const handleQuery = useCallback(async (qMode: "retrieve" | "explain") => {
    if (!question.trim() || !selectedDoc || !accessToken) return;
    abortCtrl.current?.abort();
    const ctrl = new AbortController();
    abortCtrl.current = ctrl;

    setMode(qMode);
    setQueryLoading(true);
    setStreaming(true);
    setStreamText("");
    setResponse(null);
    setFlashcards([]);
    setFlashcardsLoading(false);

    let accumulated = "";
    try {
      const res = await api.phase2.streamQuery(
        accessToken,
        { document_id: selectedDoc.id, question: question.trim(), mode: qMode },
        (chunk) => { accumulated += chunk; setStreamText((t) => t + chunk); },
        ctrl.signal
      );
      const finalRes = res.answer ? res : { ...res, answer: accumulated };
      setResponse(finalRes);
      setStreaming(false);
      setQueryLoading(false);

      if (finalRes.answer) {
        setFlashcardsLoading(true);
        api.study.generateFlashcards(accessToken, question.trim(), finalRes.answer)
          .then((r) => setFlashcards(r.flashcards ?? []))
          .catch(() => {})
          .finally(() => setFlashcardsLoading(false));
      }

      setHistory((prev) => [
        { id: Date.now(), question: question.trim(), mode: qMode, created_at: new Date().toISOString() },
        ...prev.slice(0, 49),
      ]);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        Alert.alert("Error", e instanceof ApiError ? e.message : "Query failed. Please try again.");
      }
      setStreaming(false);
      setQueryLoading(false);
    }
  }, [question, selectedDoc, accessToken]);

  const isQuerying = queryLoading || streaming;
  const pdfDocs = docs.filter((d) => d.source_type !== "youtube");
  const ytDocs = docs.filter((d) => d.source_type === "youtube");
  const displayDocs = activeTab === "pdf" ? pdfDocs : ytDocs;

  return (
    <View style={sc.root}>
      <ScrollView
        contentContainerStyle={[sc.scroll, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── SOURCE TOGGLE ─── */}
        <View style={sc.card}>
          <View style={sc.toggleRow}>
            <Pressable style={sc.toggleBtn} onPress={() => router.replace("/(tabs)")}>
              <Text style={sc.toggleText}>📚 Textbooks</Text>
            </Pressable>
            <View style={[sc.toggleBtn, sc.toggleActive]}>
              <Text style={sc.toggleTextActive}>📖 Own Books</Text>
            </View>
          </View>
        </View>

        {/* ─── PDF / YOUTUBE TABS ─── */}
        <View style={sc.card}>
          <View style={sc.subTabRow}>
            <Pressable style={[sc.subTab, activeTab === "pdf" && sc.subTabActive]} onPress={() => setActiveTab("pdf")}>
              <Text style={activeTab === "pdf" ? sc.subTabTextActive : sc.subTabText}>📄 PDF Books</Text>
            </Pressable>
            <Pressable style={[sc.subTab, activeTab === "youtube" && sc.subTabActive]} onPress={() => setActiveTab("youtube")}>
              <Text style={activeTab === "youtube" ? sc.subTabTextActive : sc.subTabText}>🎬 YouTube Videos</Text>
            </Pressable>
          </View>

          {/* ─ PDF Upload ─ */}
          {activeTab === "pdf" && (
            <View style={sc.uploadSection}>
              <Text style={sc.uploadHeading}>Upload a PDF Book or Notes</Text>

              <Pressable style={sc.filePicker} onPress={handlePickPdf}>
                {pdfFile
                  ? <><Feather name="file" size={18} color="#10b981" /><Text style={[sc.filePickerText, { color: "#10b981" }]} numberOfLines={1}>{pdfFile.name}</Text></>
                  : <><Feather name="upload-cloud" size={18} color={MUTED} /><Text style={sc.filePickerText}>Tap to choose PDF file</Text></>
                }
              </Pressable>

              <TextInput
                style={sc.input}
                placeholder="Book title (required)"
                placeholderTextColor={MUTED}
                value={pdfTitle}
                onChangeText={setPdfTitle}
              />

              <View style={sc.docTypeRow}>
                {["book", "notes", "paper"].map((t) => (
                  <Pressable key={t} style={[sc.docTypeBtn, pdfDocType === t && sc.docTypeBtnActive]} onPress={() => setPdfDocType(t)}>
                    <Text style={pdfDocType === t ? sc.docTypeBtnTextActive : sc.docTypeBtnText}>
                      {t === "book" ? "📚 Book" : t === "notes" ? "📝 Notes" : "📋 Paper"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[sc.uploadBtn, (!pdfFile || !pdfTitle.trim() || uploading) && sc.uploadBtnDim]}
                onPress={handleUploadPdf}
                disabled={!pdfFile || !pdfTitle.trim() || uploading}
              >
                {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.uploadBtnText}>⬆️ Upload PDF</Text>}
              </Pressable>
            </View>
          )}

          {/* ─ YouTube ─ */}
          {activeTab === "youtube" && (
            <View style={sc.uploadSection}>
              <Text style={sc.uploadHeading}>Add a YouTube Video</Text>
              <TextInput
                style={sc.input}
                placeholder="YouTube URL (e.g., https://youtu.be/…)"
                placeholderTextColor={MUTED}
                value={ytUrl}
                onChangeText={setYtUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TextInput
                style={sc.input}
                placeholder="Title (optional)"
                placeholderTextColor={MUTED}
                value={ytTitle}
                onChangeText={setYtTitle}
              />
              <Pressable
                style={[sc.uploadBtn, { backgroundColor: "#dc2626" }, (!ytUrl.trim() || ytSubmitting) && sc.uploadBtnDim]}
                onPress={handleAddYoutube}
                disabled={!ytUrl.trim() || ytSubmitting}
              >
                {ytSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.uploadBtnText}>🎬 Add Video</Text>}
              </Pressable>
            </View>
          )}
        </View>

        {/* ─── DOCUMENTS LIST ─── */}
        <View style={sc.card}>
          <Text style={sc.cardTitle}>
            {activeTab === "pdf" ? "📄 Your Books" : "🎬 Your Videos"}
            {" "}<Text style={{ fontSize: 12, color: MUTED, fontFamily: "Inter_400Regular" }}>({displayDocs.length})</Text>
          </Text>

          {docsLoading && (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={{ color: MUTED, marginTop: 8, fontSize: 12 }}>Loading documents…</Text>
            </View>
          )}

          {!docsLoading && displayDocs.length === 0 && (
            <View style={sc.emptyBox}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>{activeTab === "pdf" ? "📄" : "🎬"}</Text>
              <Text style={sc.emptyTitle}>No {activeTab === "pdf" ? "books" : "videos"} yet</Text>
              <Text style={sc.emptyDesc}>
                {activeTab === "pdf" ? "Upload a PDF above to get started" : "Add a YouTube URL above to get started"}
              </Text>
            </View>
          )}

          {displayDocs.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              selected={selectedDoc?.id === doc.id}
              onSelect={() => onDocSelect(doc)}
              onDelete={() => setDeleteTarget(doc)}
            />
          ))}
        </View>

        {/* ─── QUESTION INTERFACE ─── */}
        {selectedDoc && selectedDoc.is_ready && (
          <View style={sc.card}>
            <View style={sc.qHeader}>
              <View style={sc.qIconBox}><Text style={{ fontSize: 18 }}>💬</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={sc.cardTitle}>Ask a Question</Text>
                <Text style={sc.qDocName} numberOfLines={1}>
                  From: <Text style={{ color: PRIMARY }}>{selectedDoc.title}</Text>
                </Text>
              </View>
            </View>

            <RecentQuestionsPanel history={history} onSelect={setQuestion} />

            <View style={sc.modeTabs}>
              <Pressable style={[sc.modeTab, mode === "retrieve" && sc.modeTabActive]} onPress={() => setMode("retrieve")}>
                <Text style={mode === "retrieve" ? sc.modeTabTextActive : sc.modeTabText}>📖 Answer from Book</Text>
              </Pressable>
              <Pressable style={[sc.modeTab, mode === "explain" && sc.modeTabActive]} onPress={() => setMode("explain")}>
                <Text style={mode === "explain" ? sc.modeTabTextActive : sc.modeTabText}>💡 Learn Concept</Text>
              </Pressable>
            </View>

            <TextInput
              style={sc.textarea}
              multiline
              numberOfLines={4}
              placeholder="e.g., What is the main argument of chapter 3?"
              placeholderTextColor={MUTED}
              value={question}
              onChangeText={setQuestion}
              editable={!isQuerying}
              textAlignVertical="top"
            />

            <View style={sc.actionRow}>
              <Pressable
                style={[sc.actionBtn, { backgroundColor: PRIMARY }, (!question.trim() || isQuerying) && sc.actionBtnDim]}
                onPress={() => handleQuery("retrieve")}
                disabled={!question.trim() || isQuerying}
              >
                {isQuerying && mode === "retrieve" ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.actionBtnText}>📖 Answer from Book</Text>}
              </Pressable>
              <Pressable
                style={[sc.actionBtn, { backgroundColor: "#059669" }, (!question.trim() || isQuerying) && sc.actionBtnDim]}
                onPress={() => handleQuery("explain")}
                disabled={!question.trim() || isQuerying}
              >
                {isQuerying && mode === "explain" ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.actionBtnText}>💡 Learn Concept</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* ─── ANSWER ─── */}
        {(queryLoading || streaming || response) && (
          <AnswerCard
            loading={queryLoading && !streaming}
            streaming={streaming}
            streamText={streamText}
            response={response}
          />
        )}

        {/* ─── FLASHCARDS ─── */}
        {(flashcardsLoading || flashcards.length > 0) && (
          <FlashcardsSection loading={flashcardsLoading} cards={flashcards} />
        )}

        {/* Footer */}
        <View style={sc.footer}>
          <Feather name="alert-triangle" size={11} color={MUTED} />
          <Text style={sc.footerText}>AI responses should be verified with citations.</Text>
        </View>
      </ScrollView>

      {/* Delete Modal */}
      {deleteTarget && (
        <DeleteModal
          doc={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </View>
  );
}

const sc = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1a1a2e" },
  scroll: { paddingHorizontal: 16, paddingBottom: 110 },
  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT_COLOR, marginBottom: 12 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: "#2a2a3e" },
  toggleActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  toggleText: { fontSize: 14, color: MUTED, fontFamily: "Inter_500Medium" },
  toggleTextActive: { fontSize: 14, color: "#fff", fontFamily: "Inter_600SemiBold" },
  subTabRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  subTab: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: "#2a2a3e" },
  subTabActive: { backgroundColor: "rgba(102,126,234,0.2)", borderColor: PRIMARY },
  subTabText: { fontSize: 13, color: MUTED },
  subTabTextActive: { fontSize: 13, color: PRIMARY, fontFamily: "Inter_600SemiBold" },
  uploadSection: { gap: 10 },
  uploadHeading: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_COLOR, marginBottom: 2 },
  filePicker: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2a2a3e", borderRadius: 10, borderWidth: 2, borderColor: BORDER, borderStyle: "dashed", paddingHorizontal: 16, paddingVertical: 16 },
  filePickerText: { fontSize: 13, color: MUTED, flex: 1 },
  input: { backgroundColor: "#2a2a3e", borderRadius: 10, borderWidth: 1, borderColor: "rgba(102,126,234,0.3)", paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: TEXT_COLOR, fontFamily: "Inter_400Regular" },
  docTypeRow: { flexDirection: "row", gap: 8 },
  docTypeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: "#2a2a3e" },
  docTypeBtnActive: { backgroundColor: "rgba(102,126,234,0.2)", borderColor: PRIMARY },
  docTypeBtnText: { fontSize: 12, color: MUTED },
  docTypeBtnTextActive: { fontSize: 12, color: PRIMARY, fontFamily: "Inter_600SemiBold" },
  uploadBtn: { backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  uploadBtnDim: { opacity: 0.4 },
  uploadBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyBox: { alignItems: "center", paddingVertical: 28 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT_COLOR, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: MUTED, textAlign: "center" },
  qHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  qIconBox: { width: 42, height: 42, borderRadius: 8, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center" },
  qDocName: { fontSize: 11, color: MUTED, marginTop: 2 },
  modeTabs: { flexDirection: "row", gap: 8, marginBottom: 10 },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: "#2a2a3e" },
  modeTabActive: { backgroundColor: "#2d2a4a", borderColor: "rgba(102,126,234,0.6)" },
  modeTabText: { fontSize: 12, color: MUTED, fontFamily: "Inter_500Medium" },
  modeTabTextActive: { fontSize: 12, color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
  textarea: { backgroundColor: "#2a2a3e", borderWidth: 1, borderColor: "rgba(102,126,234,0.35)", borderRadius: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 14, color: TEXT_COLOR, minHeight: 90, fontFamily: "Inter_400Regular", marginBottom: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  actionBtnDim: { opacity: 0.4 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  footer: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingTop: 8, paddingBottom: 16 },
  footerText: { fontSize: 11, color: MUTED },
});
