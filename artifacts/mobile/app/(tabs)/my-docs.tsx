import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname } from "expo-router";
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
import QuestionComposer, { type QuestionComposerHandle } from "@/components/study/QuestionComposer";
import RecentQuestionsPanel from "@/components/study/RecentQuestionsPanel";
import { useRecentQuestions } from "@/hooks/useRecentQuestions";
import { useSourceSettings } from "@/hooks/useSourceSettings";
import { resolveStudyLanguage, type StudyAnswerContext } from "@/services/studyResources";
import { HomeBanner, UpgradeModal } from "@/components/shared/HomeBanner";
import { useAuth } from "@/context/auth";
import { useBannerUsage } from "@/hooks/useBannerUsage";
import { useTheme } from "@/context/theme";
import api, {
  ApiError,
  DocumentItem,
  QueryResponse,
} from "@/services/api";

const PRIMARY = "#667eea";
const CARD_BG = "#1e1e3a";
const BORDER = "rgba(255,255,255,0.10)";
const TEXT_COLOR = "#f9fafb";
const MUTED = "#9ca3af";
const GREEN = "#22c55e";

const STATUS_COLOR: Record<DocumentItem["processing_status"], string> = {
  completed: "#10b981",
  processing: "#f59e0b",
  uploaded: "#60a5fa",
  failed: "#ef4444",
};
const STATUS_LABEL: Record<DocumentItem["processing_status"], string> = {
  completed: "Ready",
  processing: "Processing…",
  uploaded: "Queued",
  failed: "Failed",
};

type YouTubeMode = "notes" | "qa";
const NOTES_PROMPT =
  "Generate comprehensive study notes from this video. Include key concepts, important points, main arguments, and a clear summary with sections.";

/* ─── Delete Modal ──────────────────────────────────────────────────────── */
function DeleteModal({ doc, onConfirm, onCancel, loading }: { doc: DocumentItem; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <Modal visible transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={dm.backdrop}>
          <TouchableWithoutFeedback>
            <View style={dm.sheet}>
              <View style={dm.iconBox}><Feather name="trash-2" size={24} color="#ef4444" /></View>
              <Text style={dm.title}>Delete {doc.source_type === "youtube" ? "Video" : "Book"}?</Text>
              <Text style={dm.docName} numberOfLines={2}>{doc.title}</Text>
              <View style={dm.infoBox}>
                <Text style={dm.infoText}>This will permanently delete:</Text>
                <Text style={dm.infoItem}>• The uploaded {doc.source_type === "youtube" ? "video transcript" : "book file"}</Text>
                <Text style={dm.infoItem}>• All AI processing and indexing</Text>
                <Text style={dm.infoItem}>• All cached data and query history</Text>
                <Text style={[dm.infoItem, { color: "#ef4444" }]}>This cannot be undone.</Text>
              </View>
              <View style={dm.btnRow}>
                <Pressable style={dm.cancelBtn} onPress={onCancel}><Text style={dm.cancelBtnText}>Cancel</Text></Pressable>
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

/* ─── Doc Card ──────────────────────────────────────────────────────────── */
function DocCard({ doc, selected, onSelect, onDelete }: { doc: DocumentItem; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const isProcessing = doc.processing_status === "processing" || doc.processing_status === "uploaded";
  const canSelect = doc.processing_status === "completed";
  const statusColor = STATUS_COLOR[doc.processing_status];
  return (
    <Pressable testID={`personal-resource-${doc.id}`} accessibilityState={{ disabled: !canSelect, selected }} style={[dc.card, selected && dc.cardSelected, !canSelect && dc.cardDim]} onPress={canSelect ? onSelect : undefined}>
      <View style={dc.row}>
        <View style={dc.iconWrap}><Text style={{ fontSize: 22 }}>{doc.source_type === "youtube" ? "🎬" : "📄"}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={dc.title} numberOfLines={2}>{doc.title}</Text>
          <View style={dc.meta}>
            {!!doc.page_count && <Text style={dc.metaText}>{doc.page_count} pages</Text>}
            {!!doc.page_count && <Text style={dc.dot}>·</Text>}
            <View style={[dc.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[dc.statusText, { color: statusColor }]}>{STATUS_LABEL[doc.processing_status]}</Text>
            {isProcessing && <ActivityIndicator size="small" color={statusColor} style={{ marginLeft: 4 }} />}
          </View>
          {isProcessing && typeof doc.processing_progress === "number" && doc.processing_progress > 0 && (
            <View style={dc.progressTrack}>
              <View style={[dc.progressFill, { width: `${doc.processing_progress}%` as `${number}%`, backgroundColor: statusColor }]} />
            </View>
          )}
        </View>
        <Pressable style={dc.deleteBtn} onPress={onDelete} hitSlop={10}><Feather name="trash-2" size={16} color="#6b7280" /></Pressable>
      </View>
    </Pressable>
  );
}
const dc = StyleSheet.create({
  card: { backgroundColor: "#2a2a3e", borderRadius: 10, borderWidth: 1, borderColor: "rgba(102,126,234,0.25)", padding: 14, marginBottom: 8 },
  cardSelected: { borderColor: PRIMARY, backgroundColor: "rgba(102,126,234,0.15)" },
  cardDim: { opacity: 0.55 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_COLOR, marginBottom: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: MUTED },
  dot: { fontSize: 11, color: MUTED },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  deleteBtn: { padding: 6 },
  progressTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden", marginTop: 5 },
  progressFill: { height: 3, borderRadius: 2 },
});

/* ─── Recent Questions ──────────────────────────────────────────────────── */
/* ─── Upload Progress Bar ───────────────────────────────────────────────── */
function UploadProgress({ progress }: { progress: number }) {
  return (
    <View style={up.wrap}>
      <View style={up.track}>
        <View style={[up.fill, { width: `${progress}%` as `${number}%` }]} />
      </View>
      <Text style={up.label}>{Math.round(progress)}% Uploading…</Text>
    </View>
  );
}
const up = StyleSheet.create({
  wrap: { marginTop: 8 },
  track: { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, backgroundColor: GREEN, borderRadius: 3 },
  label: { fontSize: 11, color: MUTED, marginTop: 4, textAlign: "center" },
});

/* ─── Main Screen ───────────────────────────────────────────────────────── */
export default function OwnBooksScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const location = useRef(pathname);
  location.current = pathname;
  const documentEpoch = useRef(0);
  const { accessToken, logout, user } = useAuth();
  const { disclaimerMessages } = useSourceSettings(false);
  const { isDark, toggleTheme } = useTheme();

  /* usage / upgrade */
  const { usage, usageLoading, refreshUsage } = useBannerUsage();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleLogout = useCallback(async () => {
    try { await logout(); } catch {}
  }, [logout]);

  const [activeTab, setActiveTab] = useState<"pdf" | "youtube">("pdf");
  const resourceTab = useRef(activeTab);
  resourceTab.current = activeTab;

  /* documents */
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* pdf upload */
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfDocType, setPdfDocType] = useState("textbook");
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /* youtube */
  const [ytUrl, setYtUrl] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ytSubmitting, setYtSubmitting] = useState(false);

  /* youtube interaction mode */
  const [ytMode, setYtMode] = useState<YouTubeMode | null>(null);

  /* query */
  const [question, setQuestion] = useState("");
  const [queryMode, setQueryMode] = useState<"retrieve" | "explain">("retrieve");
  const selectionAccount = useRef(user?.id);
  const recentQuestions = useRecentQuestions("personal", selectionAccount.current === user?.id ? selectedDoc?.id : undefined);
  useEffect(() => {
    if (selectionAccount.current !== user?.id) {
      selectionAccount.current = user?.id; setSelectedDoc(null); setQuestion("");
    }
  }, [user?.id]);
  const composer = useRef<QuestionComposerHandle>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [studyContext, setStudyContext] = useState<StudyAnswerContext | null>(null);

  const abortCtrl = useRef<AbortController | null>(null);
  useEffect(() => {
    abortCtrl.current?.abort();
    setResponse(null); setStudyContext(null); setStreaming(false); setQueryLoading(false);
    setStreamText("");
    return () => abortCtrl.current?.abort();
  }, [user?.id, selectedDoc?.id]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onDocSelect = useCallback((doc: DocumentItem | null, fromPolling = false) => {
    if (doc && (fromPolling ? !doc.is_ready : doc.processing_status !== "completed")) return;
    abortCtrl.current?.abort();
    setStudyContext(null); setStreaming(false); setQueryLoading(false);
    setSelectedDoc(doc); setQuestion(""); setResponse(null); setStreamText("");
    setYtMode(null);
  }, []);

  useEffect(() => {
    if (pathname === "/") onDocSelect(null);
  }, [pathname, onDocSelect]);

  useEffect(() => {
    documentEpoch.current++;
    return () => { documentEpoch.current++; };
  }, [user?.id]);

  const changeResourceTab = useCallback((tab: "pdf" | "youtube") => {
    resourceTab.current = tab;
    setActiveTab(tab);
    if (selectedDoc && (selectedDoc.source_type === "youtube" ? "youtube" : "pdf") !== tab) onDocSelect(null);
  }, [selectedDoc, onDocSelect]);

  /* ── load docs ── */
  const loadDocs = useCallback(async () => {
    if (!accessToken) return null;
    const epoch = documentEpoch.current;
    try {
      const list = await api.phase2.listDocuments(accessToken);
      if (epoch !== documentEpoch.current) return null;
      setDocs(list); return list;
    } catch { return null; }
  }, [accessToken]);

  useEffect(() => {
    setDocsLoading(true);
    loadDocs().finally(() => setDocsLoading(false));
  }, [loadDocs]);

  useEffect(() => {
    const hasProcessing = docs.some((d) => d.processing_status === "processing" || d.processing_status === "uploaded");
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const list = await loadDocs();
        if (!list) return;
        // Selection follows a processing-to-ready polling result, never the upload itself.
        const ready = list.find(doc =>
          doc.is_ready &&
          docs.some(previous => previous.id === doc.id && !previous.is_ready && (previous.processing_status === "processing" || previous.processing_status === "uploaded")) &&
          (doc.source_type === "youtube" ? "youtube" : "pdf") === resourceTab.current
        );
        if (ready && location.current === "/my-docs") onDocSelect(ready, true);
        if (!list.some((d) => d.processing_status === "processing" || d.processing_status === "uploaded")) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      }, 3000);
    }
    if (!hasProcessing && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [docs, loadDocs, onDocSelect]);

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
  const startProgressSimulation = useCallback(() => {
    setUploadProgress(3);
    let current = 3;
    if (progressRef.current) clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      current = current + Math.random() * 4;
      if (current >= 90) { current = 90; if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; } }
      setUploadProgress(Math.round(current));
    }, 400);
  }, []);

  const handleUploadPdf = useCallback(async () => {
    if (!pdfFile || !pdfTitle.trim() || !accessToken) return;
    setUploading(true);
    startProgressSimulation();
    try {
      const doc = await api.phase2.uploadPdf(accessToken, pdfFile.uri, pdfFile.name, pdfTitle.trim(), pdfDocType);
      if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
      setUploadProgress(100);
      setTimeout(() => { setUploading(false); setUploadProgress(0); }, 600);
      setDocs((prev) => [doc, ...prev]);
      setPdfFile(null); setPdfTitle(""); setShowUploadForm(false);
      Alert.alert("Uploaded", "Your PDF is being processed. It will be ready shortly.");
    } catch (e) {
      if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
      setUploading(false); setUploadProgress(0);
      Alert.alert("Upload Failed", e instanceof ApiError ? e.message : "Could not upload PDF");
    }
  }, [pdfFile, pdfTitle, pdfDocType, accessToken, startProgressSimulation]);

  /* ── add YouTube ── */
  const handleAddYoutube = useCallback(async () => {
    if (!ytUrl.trim() || !accessToken) return;
    setYtSubmitting(true);
    try {
      const doc = await api.phase2.addYoutube(accessToken, ytUrl.trim(), ytTitle.trim() || undefined);
      setDocs((prev) => [doc, ...prev]);
      setYtUrl(""); setYtTitle("");
      Alert.alert("Added", "Your YouTube video is being processed.");
    } catch (e) {
      Alert.alert("Failed", e instanceof ApiError ? e.message : "Could not add YouTube link");
    } finally { setYtSubmitting(false); }
  }, [ytUrl, ytTitle, accessToken]);

  /* ── delete ── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget || !accessToken) return;
    setDeleting(true);
    try {
      await api.phase2.deleteDocument(accessToken, deleteTarget.id);
      setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      if (selectedDoc?.id === deleteTarget.id) { setSelectedDoc(null); setResponse(null); setStreamText(""); setYtMode(null); }
      setDeleteTarget(null);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not delete document");
    } finally { setDeleting(false); }
  }, [deleteTarget, accessToken, selectedDoc]);

  /* ── query ── */
  const handleQuery = useCallback(async (qMode: "retrieve" | "explain", overrideQuestion?: string) => {
    const q = overrideQuestion ?? question;
    if (!q.trim() || !selectedDoc || !accessToken) return;
    abortCtrl.current?.abort();
    const ctrl = new AbortController();
    abortCtrl.current = ctrl;
    setQueryMode(qMode); setQueryLoading(true); setStreaming(true);
    setStreamText(""); setResponse(null);
    setStudyContext(null);
    const originalQuestion = q.trim();
    const bookTitle = selectedDoc.title;
    const valid = () => abortCtrl.current === ctrl && !ctrl.signal.aborted;
    let accumulated = "";
    try {
      const res = await api.phase2.streamQuery(
        accessToken,
        { document_id: selectedDoc.id, question: q.trim(), mode: qMode },
        (chunk) => { if (valid()) { accumulated += chunk; setStreamText((t) => t + chunk); } },
        ctrl.signal
      );
      const finalRes = res.answer ? res : { ...res, answer: accumulated };
      if (!valid()) return;
      setStudyContext({
        id: `${selectedDoc.id}:${Date.now()}`, question: originalQuestion, answer: finalRes.answer,
        language: resolveStudyLanguage(finalRes.answer_language ?? finalRes.language, user?.medium, finalRes.answer),
        bookTitle, pageNumber: finalRes.sources?.[0]?.page ?? null,
      });
      setResponse(finalRes); setStreaming(false); setQueryLoading(false);
      void refreshUsage();
      if (finalRes.answer && !finalRes.answer.startsWith("Error:")) recentQuestions.refreshAfterAnswer();
    } catch (e) {
      if (!valid()) return;
      if ((e as Error)?.name !== "AbortError") {
        const msg = e instanceof ApiError
          ? e.message
          : ((e as Error)?.message || String(e) || "Query failed. Please try again.");
        Alert.alert("Error", msg);
      }
      setStreaming(false); setQueryLoading(false);
    }
  }, [question, selectedDoc, accessToken, refreshUsage, user?.medium, recentQuestions.refreshAfterAnswer]);

  /* ── youtube: generate notes ── */
  const handleGenerateNotes = useCallback(() => {
    setYtMode("notes");
    setQuestion(NOTES_PROMPT);
    handleQuery("retrieve", NOTES_PROMPT);
  }, [handleQuery]);

  const isQuerying = queryLoading || streaming;
  const pdfDocs = docs.filter((d) => d.source_type !== "youtube");
  const ytDocs = docs.filter((d) => d.source_type === "youtube");
  const displayDocs = activeTab === "pdf" ? pdfDocs : ytDocs;
  const isYoutube = selectedDoc?.source_type === "youtube";
  const showQAInterface = Boolean(selectedDoc && (!isYoutube || ytMode !== null));

  return (
    <LinearGradient
      colors={isDark ? ["#1a1a2e", "#16213e"] : ["#eff6ff", "#ffffff", "#faf5ff"]}
      style={sc.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <HomeBanner
        usage={usage}
        usageLoading={usageLoading}
        onUpgrade={() => setShowUpgrade(true)}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <ScrollView contentContainerStyle={sc.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ─── PDF / YOUTUBE TABS ─── */}
        <View style={sc.card}>
          <View style={sc.subTabRow}>
            <Pressable style={[sc.subTab, activeTab === "pdf" && sc.subTabActive]} onPress={() => changeResourceTab("pdf")}>
              <Text style={activeTab === "pdf" ? sc.subTabTextActive : sc.subTabText}>📄 PDF Books</Text>
            </Pressable>
            <Pressable style={[sc.subTab, activeTab === "youtube" && sc.subTabActive]} onPress={() => changeResourceTab("youtube")}>
              <Text style={activeTab === "youtube" ? sc.subTabTextActive : sc.subTabText}>🎬 YouTube Videos</Text>
            </Pressable>
          </View>

          {/* ─ PDF Upload Form (6c) ─ */}
          {activeTab === "pdf" && (
            <View style={{ marginTop: 12 }}>
              {!showUploadForm ? (
                <Pressable style={sc.collapsedUpload} onPress={() => setShowUploadForm(true)}>
                  <Feather name="upload-cloud" size={20} color={MUTED} />
                  <View style={{ flex: 1 }}>
                    <Text style={sc.collapsedUploadTitle}>📤 Click to upload a new book</Text>
                    <Text style={sc.collapsedUploadSub}>PDF files up to 50MB</Text>
                  </View>
                  <Feather name="plus" size={18} color={PRIMARY} />
                </Pressable>
              ) : (
                <View style={sc.uploadForm}>
                  <View style={sc.uploadFormHeader}>
                    <Text style={sc.uploadFormTitle}>📤 Upload a PDF Book</Text>
                    <Pressable onPress={() => { setShowUploadForm(false); setPdfFile(null); setPdfTitle(""); }} hitSlop={10}>
                      <Feather name="x" size={18} color={MUTED} />
                    </Pressable>
                  </View>

                  <Text style={sc.fieldLabel}>Select PDF File *</Text>
                  <Pressable style={sc.filePicker} onPress={handlePickPdf}>
                    {pdfFile
                      ? <><Feather name="file" size={16} color="#10b981" /><Text style={[sc.filePickerText, { color: "#10b981" }]} numberOfLines={1}>{pdfFile.name}</Text><Feather name="check-circle" size={14} color="#10b981" /></>
                      : <><Feather name="upload-cloud" size={16} color={MUTED} /><Text style={sc.filePickerText}>Choose PDF file…</Text></>
                    }
                  </Pressable>

                  <Text style={sc.fieldLabel}>Book Name</Text>
                  <TextInput style={sc.input} placeholder="Enter book title (required)" placeholderTextColor={MUTED} value={pdfTitle} onChangeText={setPdfTitle} />

                  <Text style={sc.fieldLabel}>Book Type</Text>
                  <View style={sc.docTypeRow}>
                    {[["textbook", "📚 Textbook"], ["notes", "📝 Notes"], ["reference", "📋 Reference"], ["other", "📁 Other"]].map(([t, label]) => (
                      <Pressable key={t} style={[sc.docTypeBtn, pdfDocType === t && sc.docTypeBtnActive]} onPress={() => setPdfDocType(t)}>
                        <Text style={pdfDocType === t ? sc.docTypeBtnTextActive : sc.docTypeBtnText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {uploading && <UploadProgress progress={uploadProgress} />}

                  <Pressable
                    style={[sc.uploadBtn, (!pdfFile || !pdfTitle.trim() || uploading) && sc.uploadBtnDim]}
                    onPress={handleUploadPdf}
                    disabled={!pdfFile || !pdfTitle.trim() || uploading}
                  >
                    {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.uploadBtnText}>📤 Upload Book</Text>}
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* ─ YouTube Form (6b) ─ */}
          {activeTab === "youtube" && (
            <View style={sc.ytForm}>
              <Text style={sc.ytHeading}>▶️ Add YouTube Video</Text>
              <Text style={sc.ytSubtitle}>
                Paste any YouTube link. We'll extract the transcript automatically — works for English, Hindi, Telugu, and more.
              </Text>
              <TextInput
                style={[sc.input, { borderColor: ytUrl.trim() ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.2)" }]}
                placeholder="https://www.youtube.com/watch?v=..."
                placeholderTextColor={MUTED}
                value={ytUrl}
                onChangeText={setYtUrl}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={handleAddYoutube}
              />
              <TextInput style={sc.input} placeholder="Video title (optional)" placeholderTextColor={MUTED} value={ytTitle} onChangeText={setYtTitle} />
              <Pressable
                style={[sc.ytAddBtn, !ytUrl.trim() && sc.ytAddBtnDim, ytUrl.trim() && { backgroundColor: GREEN }]}
                onPress={handleAddYoutube}
                disabled={!ytUrl.trim() || ytSubmitting}
              >
                {ytSubmitting
                  ? <><ActivityIndicator size="small" color="#fff" /><Text style={sc.ytAddBtnText}> Extracting transcript…</Text></>
                  : <Text style={sc.ytAddBtnText}>▶️ Add Video</Text>
                }
              </Pressable>
            </View>
          )}
        </View>

        {/* ─── DOCUMENTS LIST ─── */}
        <View style={sc.card}>
          <Text style={sc.cardTitle}>
            {activeTab === "pdf" ? "📄 Your Books" : "🎬 Your Videos"}
            {"  "}<Text style={{ fontSize: 12, color: MUTED, fontFamily: "Inter_400Regular" }}>({displayDocs.length})</Text>
          </Text>

          {docsLoading && (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={{ color: MUTED, marginTop: 8, fontSize: 12 }}>Loading…</Text>
            </View>
          )}

          {!docsLoading && displayDocs.length === 0 && (
            <View style={sc.emptyBox}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>{activeTab === "pdf" ? "📄" : "🎬"}</Text>
              <Text style={sc.emptyTitle}>No {activeTab === "pdf" ? "books" : "videos"} yet</Text>
              <Text style={sc.emptyDesc}>{activeTab === "pdf" ? "Upload a PDF above to get started" : "Add a YouTube URL above to get started"}</Text>
            </View>
          )}

          {displayDocs.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              selected={selectedDoc?.id === doc.id}
              onSelect={() => onDocSelect(doc)}
              onDelete={() => {
                if (doc.processing_status === "processing") {
                  Alert.alert("Processing in Progress", "This document is still being indexed. Please wait until processing is complete before deleting.");
                  return;
                }
                setDeleteTarget(doc);
              }}
            />
          ))}
        </View>

        {/* ─── YOUTUBE MODE PICKER (6f) ─── */}
        {selectedDoc && isYoutube && ytMode === null && (
          <View style={sc.card}>
            <Text style={sc.cardTitle}>🎬 How do you want to use this video?</Text>
            <Text style={{ fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 18 }}>
              Choose how you'd like to interact with <Text style={{ color: PRIMARY }}>{selectedDoc.title}</Text>
            </Text>
            <View style={ymp.grid}>
              <Pressable style={[ymp.modeCard, ymp.notesCard]} onPress={handleGenerateNotes}>
                <Text style={ymp.modeIcon}>📝</Text>
                <Text style={[ymp.modeTitle, { color: "#c084fc" }]}>Generate Notes</Text>
                <Text style={ymp.modeDesc}>Auto-create study notes from the video transcript</Text>
              </Pressable>
              <Pressable style={[ymp.modeCard, ymp.qaCard]} onPress={() => setYtMode("qa")}>
                <Text style={ymp.modeIcon}>❓</Text>
                <Text style={[ymp.modeTitle, { color: "#60a5fa" }]}>Ask Questions</Text>
                <Text style={ymp.modeDesc}>Type your own questions about the video content</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ─── QUESTION INTERFACE ─── */}
        {showQAInterface && (
          <View testID="personal-question-section" style={sc.card}>
            <View style={sc.qHeader}>
              <View style={sc.qIconBox}><Text style={{ fontSize: 18 }}>💬</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={sc.cardTitle}>Ask Your Question</Text>
                <Text style={sc.qDocName} numberOfLines={1}>
                  Get answers from: <Text style={{ color: PRIMARY }}>{selectedDoc!.title}</Text>
                </Text>
              </View>
            </View>

            {/* YouTube mode mini-switcher */}
            {isYoutube && ytMode !== null && (
              <View style={ymp.miniSwitcher}>
                <Pressable style={[ymp.miniBtn, ytMode === "notes" && ymp.miniBtnActive]} onPress={handleGenerateNotes}>
                  <Text style={[ymp.miniBtnText, ytMode === "notes" && ymp.miniBtnTextActive]}>📝 Generate Notes</Text>
                </Pressable>
                <Pressable style={[ymp.miniBtn, ytMode === "qa" && ymp.miniBtnActive]} onPress={() => setYtMode("qa")}>
                  <Text style={[ymp.miniBtnText, ytMode === "qa" && ymp.miniBtnTextActive]}>❓ Ask Questions</Text>
                </Pressable>
              </View>
            )}

            {ytMode === "qa" || !isYoutube ? (
              <>
                <RecentQuestionsPanel key={recentQuestions.scopeKey} {...recentQuestions} phase="personal"
                  sourceType={selectedDoc?.source_type}
                  onSelect={q => { if (composer.current) composer.current.replaceDraft(q); else setQuestion(q); }} />

                <QuestionComposer ref={composer} value={question} onChange={setQuestion} documentKey={`own-book:${selectedDoc!.id}`}
                  isDark={isDark} disabled={isQuerying} placeholder={isYoutube ? "Ask anything about this video…" : undefined} />

                <View style={sc.actionRow}>
                  <Pressable
                    style={[sc.actionBtn, { backgroundColor: PRIMARY }, (!question.trim() || isQuerying) && sc.actionBtnDim]}
                    onPress={() => handleQuery("retrieve")}
                    disabled={!question.trim() || isQuerying}
                  >
                    {isQuerying && queryMode === "retrieve"
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={sc.actionBtnText}>{isYoutube ? "▶️ Generate from Video" : "📖 Answer from Book"}</Text>
                    }
                  </Pressable>
                  <Pressable
                    style={[sc.actionBtn, { backgroundColor: "#059669" }, (!question.trim() || isQuerying) && sc.actionBtnDim]}
                    onPress={() => handleQuery("explain")}
                    disabled={!question.trim() || isQuerying}
                  >
                    {isQuerying && queryMode === "explain"
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={sc.actionBtnText}>💡 Learn Concept</Text>
                    }
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        )}

        {/* ─── ANSWER ─── */}
        {(queryLoading || streaming || response) && (
          <AnswerCard loading={queryLoading && !streaming} streaming={streaming} streamText={streamText} response={response} mode={queryMode} studyContext={studyContext} accessToken={accessToken ?? undefined} disclaimerMessages={disclaimerMessages} isOwnBook />
        )}

        <View style={sc.footer}>
          <Feather name="alert-triangle" size={11} color={MUTED} />
          <Text style={sc.footerText}>AI responses should be verified with source material.</Text>
        </View>
      </ScrollView>

      {deleteTarget && <DeleteModal doc={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />}
      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </LinearGradient>
  );
}

const ymp = StyleSheet.create({
  grid: { flexDirection: "row", gap: 12 },
  modeCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 16, alignItems: "center", gap: 8 },
  notesCard: { borderColor: "rgba(168,85,247,0.35)", backgroundColor: "rgba(168,85,247,0.08)" },
  qaCard: { borderColor: "rgba(59,130,246,0.35)", backgroundColor: "rgba(59,130,246,0.08)" },
  modeIcon: { fontSize: 28 },
  modeTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  modeDesc: { fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 16 },
  miniSwitcher: { flexDirection: "row", gap: 8, marginBottom: 12 },
  miniBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: "#2a2a3e" },
  miniBtnActive: { backgroundColor: "#2d2a4a", borderColor: "rgba(102,126,234,0.6)" },
  miniBtnText: { fontSize: 12, color: MUTED, fontFamily: "Inter_500Medium" },
  miniBtnTextActive: { color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
});

const sc = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 110, paddingTop: 12 },
  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT_COLOR, marginBottom: 8 },
  cardSubtitle: { fontSize: 13, lineHeight: 20, color: MUTED, marginBottom: 10 },
  subTabRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  subTab: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: "#2a2a3e" },
  subTabActive: { backgroundColor: "#2d2a4a", borderColor: "rgba(102,126,234,0.6)" },
  subTabText: { fontSize: 13, color: MUTED, fontFamily: "Inter_500Medium" },
  subTabTextActive: { fontSize: 13, color: "#a78bfa", fontFamily: "Inter_600SemiBold" },

  /* PDF collapsed */
  collapsedUpload: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.18)", borderRadius: 10, padding: 16 },
  collapsedUploadTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_COLOR },
  collapsedUploadSub: { fontSize: 11, color: MUTED, marginTop: 2 },

  /* PDF expanded */
  uploadForm: { borderRadius: 10, borderWidth: 1, borderColor: "rgba(102,126,234,0.25)", padding: 14, backgroundColor: "rgba(102,126,234,0.04)" },
  uploadFormHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  uploadFormTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: TEXT_COLOR },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  filePicker: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 12 },
  filePickerText: { flex: 1, fontSize: 13, color: MUTED },
  input: { backgroundColor: "#2a2a3e", borderWidth: 1, borderColor: "rgba(102,126,234,0.3)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: TEXT_COLOR, marginBottom: 12 },
  docTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  docTypeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: "#1e1e3a" },
  docTypeBtnActive: { backgroundColor: "rgba(102,126,234,0.2)", borderColor: PRIMARY },
  docTypeBtnText: { fontSize: 12, color: MUTED },
  docTypeBtnTextActive: { fontSize: 12, color: PRIMARY, fontFamily: "Inter_600SemiBold" },
  uploadBtn: { backgroundColor: PRIMARY, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  uploadBtnDim: { opacity: 0.4 },
  uploadBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },

  /* YouTube form */
  ytForm: { backgroundColor: "rgba(34,197,94,0.04)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(34,197,94,0.18)", padding: 14, marginTop: 10 },
  ytHeading: { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT_COLOR, marginBottom: 6 },
  ytSubtitle: { fontSize: 12, color: MUTED, lineHeight: 18, marginBottom: 12 },
  ytAddBtn: { borderRadius: 8, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", backgroundColor: "#4b5563" },
  ytAddBtnDim: { opacity: 0.45 },
  ytAddBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },

  /* Docs list */
  emptyBox: { alignItems: "center", paddingVertical: 24 },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: MUTED, marginBottom: 6 },
  emptyDesc: { fontSize: 12, color: MUTED, textAlign: "center" },

  /* Q&A interface */
  qHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  qIconBox: { width: 42, height: 42, borderRadius: 10, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center" },
  qDocName: { fontSize: 11, color: MUTED, marginTop: 2 },
  textareaWrap: { position: "relative", marginBottom: 12 },
  textarea: { backgroundColor: "#2a2a3e", borderWidth: 1, borderColor: "rgba(102,126,234,0.35)", borderRadius: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, fontSize: 14, color: TEXT_COLOR, minHeight: 100, fontFamily: "Inter_400Regular" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  actionBtnDim: { opacity: 0.4 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },

  footer: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingTop: 8, paddingBottom: 16 },
  footerText: { fontSize: 11, color: MUTED },
});
