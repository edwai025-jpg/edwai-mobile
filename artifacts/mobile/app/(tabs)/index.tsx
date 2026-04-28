import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnswerCard from "@/components/study/AnswerCard";
import FlashcardsSection from "@/components/study/FlashcardsSection";
import { useAuth } from "@/context/auth";
import api, {
  ApiError,
  BoardStatus,
  Flashcard,
  Phase1Document,
  QueryHistoryItem,
  QueryResponse,
} from "@/services/api";

const PRIMARY = "#667eea";
const CARD_BG = "#1e1e3a";
const BORDER = "rgba(255,255,255,0.10)";
const TEXT_COLOR = "#f9fafb";
const MUTED = "#9ca3af";

/* ─── Picker ─────────────────────────────────────────────────────────────── */
function DarkPicker({
  label,
  options,
  selected,
  onSelect,
  disabled,
  placeholder,
  loading,
}: {
  label: string;
  options: { id: string | number; name: string }[];
  selected: string | number | null;
  onSelect: (v: { id: string | number; name: string }) => void;
  disabled?: boolean;
  placeholder: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedName = options.find((o) => String(o.id) === String(selected))?.name ?? "";

  return (
    <View style={dp.wrap}>
      <Text style={dp.label}>{label}</Text>
      <Pressable
        style={[dp.sel, disabled && dp.disabled]}
        onPress={() => !disabled && !loading && setOpen((v) => !v)}
      >
        {loading ? (
          <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
        ) : (
          <Text style={[dp.selText, !selectedName && dp.placeholder]} numberOfLines={1}>
            {selectedName || placeholder}
          </Text>
        )}
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={MUTED} />
      </Pressable>
      {open && (
        <View style={dp.dropdown}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 164 }}>
            {options.map((opt) => (
              <Pressable
                key={String(opt.id)}
                style={[dp.option, String(opt.id) === String(selected) && dp.optSel]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[dp.optText, String(opt.id) === String(selected) && dp.optTextSel]}>
                  {opt.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const dp = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 },
  sel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(102,126,234,0.35)", borderRadius: 10, backgroundColor: "#2a2a3e", paddingHorizontal: 14, height: 46 },
  disabled: { opacity: 0.4 },
  selText: { fontSize: 14, color: TEXT_COLOR, fontFamily: "Inter_400Regular", flex: 1 },
  placeholder: { color: MUTED },
  dropdown: { marginTop: 4, borderWidth: 1, borderColor: BORDER, borderRadius: 8, backgroundColor: "#2a2a3e", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8, overflow: "hidden", zIndex: 99 },
  option: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  optSel: { backgroundColor: "rgba(102,126,234,0.22)" },
  optText: { fontSize: 14, color: TEXT_COLOR },
  optTextSel: { color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
});

/* ─── Board Processing Card ──────────────────────────────────────────────── */
function BoardProcessingCard({
  status,
  delayMinutes,
  onStart,
  starting,
}: {
  status: BoardStatus["processing_status"];
  delayMinutes: number;
  onStart: () => void;
  starting: boolean;
}) {
  if (status === "in_progress") {
    return (
      <View style={bp.card}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginBottom: 12 }} />
        <Text style={bp.title}>Processing Your Board's Textbooks</Text>
        <Text style={bp.desc}>
          We're indexing your textbooks. This may take up to {delayMinutes} minutes.{"\n"}
          You'll be able to ask questions once processing completes.
        </Text>
        <View style={bp.progressBg}>
          <View style={[bp.progressFill, { width: "60%" }]} />
        </View>
        <Text style={bp.note}>Processing in progress — check back soon</Text>
      </View>
    );
  }

  if (status === "failed") {
    return (
      <View style={bp.card}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
        <Text style={bp.title}>Processing Failed</Text>
        <Text style={bp.desc}>There was an issue processing your board's textbooks. Please try again.</Text>
        <Pressable style={bp.btn} onPress={onStart} disabled={starting}>
          {starting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={bp.btnText}>🔄 Retry Processing</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={bp.card}>
      <View style={bp.iconCircle}><Text style={{ fontSize: 40 }}>📚</Text></View>
      <Text style={bp.title}>Unlock Your Board's Textbooks</Text>
      <Text style={bp.desc}>
        Your board's textbooks need to be indexed before you can search them. This takes around {delayMinutes} minute{delayMinutes !== 1 ? "s" : ""}.
      </Text>
      <Pressable style={[bp.btn, starting && { opacity: 0.6 }]} onPress={onStart} disabled={starting}>
        {starting
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={bp.btnText}>📄 Process Official Documents</Text>}
      </Pressable>
      <Text style={bp.note}>One-time setup · Takes ~{delayMinutes} min</Text>
    </View>
  );
}

const bp = StyleSheet.create({
  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 24, marginBottom: 12, alignItems: "center" },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(102,126,234,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT_COLOR, textAlign: "center", marginBottom: 8 },
  desc: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20, marginBottom: 18 },
  btn: { backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 13, marginBottom: 10 },
  btnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  note: { fontSize: 11, color: MUTED },
  progressBg: { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, width: "100%", marginBottom: 10 },
  progressFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 3 },
});

/* ─── Recent Questions ───────────────────────────────────────────────────── */
function RecentQuestionsPanel({ history, onSelect }: { history: QueryHistoryItem[]; onSelect: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  if (history.length === 0) return null;
  const filtered = search ? history.filter((h) => h.question.toLowerCase().includes(search.toLowerCase())) : history;

  return (
    <View style={rq.card}>
      <Pressable style={rq.header} onPress={() => setOpen((v) => !v)}>
        <Text style={rq.headerText}>🕐 Recent Questions ({history.length})</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={15} color={MUTED} />
      </Pressable>
      {open && (
        <View>
          {history.length > 5 && (
            <TextInput style={rq.search} placeholder="Search questions…" placeholderTextColor={MUTED} value={search} onChangeText={setSearch} />
          )}
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            {filtered.map((h) => (
              <Pressable key={h.id} style={rq.row} onPress={() => { onSelect(h.question); setOpen(false); }}>
                <Text style={rq.modeIcon}>{h.mode === "retrieve" ? "📖" : "💡"}</Text>
                <Text style={rq.rowText} numberOfLines={1}>{h.question}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const rq = StyleSheet.create({
  card: { backgroundColor: "rgba(99,71,234,0.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(99,102,241,0.25)", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
  headerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#a5b4fc" },
  search: { marginHorizontal: 12, marginBottom: 6, backgroundColor: "#2a2a3e", borderRadius: 8, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 8, color: TEXT_COLOR, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  modeIcon: { fontSize: 13 },
  rowText: { flex: 1, fontSize: 13, color: "#d1d5db" },
});

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function TextbooksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const topPad = Platform.OS === "web" ? 16 : insets.top + 16;

  /* board status */
  const [boardStatus, setBoardStatus] = useState<BoardStatus | null>(null);
  const [boardStatusLoading, setBoardStatusLoading] = useState(true);
  const [startingProcess, setStartingProcess] = useState(false);

  /* book selection */
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Phase1Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [selectedClass, setSelectedClass] = useState<{ id: number; name: string } | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Phase1Document | null>(null);

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

  /* ocr */
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const abortCtrl = useRef<AbortController | null>(null);
  const boardId = user?.boardId;

  /* ── load board status ── */
  useEffect(() => {
    if (!accessToken) return;
    setBoardStatusLoading(true);
    api.study.getBoardStatus(accessToken)
      .then(setBoardStatus)
      .catch(() => setBoardStatus(null))
      .finally(() => setBoardStatusLoading(false));
  }, [accessToken]);

  /* ── poll while processing ── */
  useEffect(() => {
    if (boardStatus?.processing_status !== "in_progress") return;
    const t = setInterval(async () => {
      if (!accessToken) return;
      try {
        const s = await api.study.getBoardStatus(accessToken);
        setBoardStatus(s);
        if (s.processing_status !== "in_progress") clearInterval(t);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [boardStatus?.processing_status, accessToken]);

  /* ── load classes when board ready ── */
  useEffect(() => {
    if (!accessToken || !boardId || boardStatus?.processing_status !== "completed") return;
    setClassesLoading(true);
    api.data.getClassesForBoard(boardId)
      .then(setClasses)
      .catch(() => {})
      .finally(() => setClassesLoading(false));
  }, [accessToken, boardId, boardStatus?.processing_status]);

  /* ── class selected ── */
  const onClassSelect = useCallback(async (cls: { id: number; name: string }) => {
    setSelectedClass(cls);
    setSelectedSubject(null);
    setSelectedDoc(null);
    setSubjects([]);
    setDocuments([]);
    if (!accessToken || !boardId) return;
    setDocsLoading(true);
    try {
      const docs = await api.study.getDocuments(accessToken, boardId, cls.id);
      setDocuments(docs);
      const unique = Array.from(new Set(docs.map((d) => d.subject).filter(Boolean))) as string[];
      setSubjects(unique);
    } catch {}
    finally { setDocsLoading(false); }
  }, [accessToken, boardId]);

  /* ── subject selected ── */
  const onSubjectSelect = useCallback(async (subj: string) => {
    setSelectedSubject(subj);
    setSelectedDoc(null);
    if (!accessToken || !boardId || !selectedClass) return;
    setDocsLoading(true);
    try {
      const docs = await api.study.getDocuments(accessToken, boardId, selectedClass.id, subj);
      setDocuments(docs);
    } catch {}
    finally { setDocsLoading(false); }
  }, [accessToken, boardId, selectedClass]);

  /* ── doc selected ── */
  const onDocSelect = useCallback(async (doc: Phase1Document) => {
    setSelectedDoc(doc);
    setQuestion("");
    setResponse(null);
    setStreamText("");
    setFlashcards([]);
    if (!accessToken) return;
    try {
      const h = await api.study.getQueryHistory(accessToken, doc.id);
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
      const res = await api.study.streamQuery(
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

  /* ── image / OCR ── */
  const handleImageCapture = useCallback(async (fromCamera: boolean) => {
    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      setCaptureUri(uri);
      if (!accessToken) return;
      setOcrLoading(true);
      try {
        const { text } = await api.study.extractQuestionFromImage(accessToken, uri);
        if (text) setQuestion(text);
      } catch {}
      finally { setOcrLoading(false); }
    } catch {}
  }, [accessToken]);

  /* ── start board processing ── */
  const handleStartProcessing = useCallback(async () => {
    if (!accessToken) return;
    setStartingProcess(true);
    try {
      await api.study.startBoardProcessing(accessToken);
      setBoardStatus((s) => s ? { ...s, processing_status: "in_progress" } : s);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to start processing");
    } finally { setStartingProcess(false); }
  }, [accessToken]);

  const isQuerying = queryLoading || streaming;
  const isRestricted = boardStatus?.is_restricted && boardStatus.processing_status !== "completed";
  const boardReady = !boardStatusLoading && boardStatus !== null && !isRestricted;

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
            <View style={[sc.toggleBtn, sc.toggleActive]}>
              <Text style={sc.toggleTextActive}>📚 Textbooks</Text>
            </View>
            <Pressable style={sc.toggleBtn} onPress={() => router.replace("/(tabs)/my-docs")}>
              <Text style={sc.toggleText}>📖 Own Books</Text>
            </Pressable>
          </View>
        </View>

        {/* ─── BOARD STATUS ─── */}
        {boardStatusLoading && (
          <View style={[sc.card, { alignItems: "center", paddingVertical: 28 }]}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={{ color: MUTED, marginTop: 10, fontSize: 13 }}>Checking board status…</Text>
          </View>
        )}

        {!boardStatusLoading && isRestricted && boardStatus && (
          <BoardProcessingCard
            status={boardStatus.processing_status}
            delayMinutes={boardStatus.processing_delay_minutes}
            onStart={handleStartProcessing}
            starting={startingProcess}
          />
        )}

        {/* ─── BOOK SELECTION ─── */}
        {boardReady && (
          <View style={sc.card}>
            <Text style={sc.cardTitle}>📖 Select Your Textbook</Text>

            <DarkPicker
              label="Class / Year"
              options={classes}
              selected={selectedClass?.id ?? null}
              onSelect={(v) => onClassSelect({ id: v.id as number, name: v.name })}
              placeholder="Select Class"
              loading={classesLoading}
              disabled={classes.length === 0 && !classesLoading}
            />
            <DarkPicker
              label="Subject"
              options={subjects.map((s) => ({ id: s, name: s }))}
              selected={selectedSubject}
              onSelect={(v) => onSubjectSelect(v.name)}
              placeholder="Select Subject"
              disabled={!selectedClass || subjects.length === 0}
              loading={docsLoading && !!selectedClass && !selectedSubject}
            />
            <DarkPicker
              label="Textbook"
              options={documents.map((d) => ({ id: d.id, name: d.title }))}
              selected={selectedDoc?.id ?? null}
              onSelect={(v) => { const d = documents.find((x) => x.id === v.id); if (d) onDocSelect(d); }}
              placeholder="Select Textbook"
              disabled={!selectedSubject || documents.length === 0}
              loading={docsLoading && !!selectedSubject && !selectedDoc}
            />

            {!selectedClass && classes.length > 0 && (
              <View style={sc.hint}><Text style={sc.hintText}>👆 Select a class to see available subjects</Text></View>
            )}
            {selectedClass && subjects.length === 0 && !docsLoading && (
              <View style={[sc.hint, sc.hintAmber]}><Text style={sc.hintAmberText}>📚 No subjects available for this class yet</Text></View>
            )}
          </View>
        )}

        {/* ─── HELP (no doc) ─── */}
        {boardReady && !selectedDoc && (
          <View style={sc.card}>
            <Text style={sc.cardTitle}>💬 How to use EdwAI</Text>
            {[
              ["📚", "Select your class, subject, and textbook above"],
              ["✍️", "Type your question in the box below"],
              ["🔍", "Choose Answer from Book to get the exact answer"],
              ["💡", "Choose Learn Concept for a detailed explanation"],
            ].map(([icon, text], i) => (
              <View key={i} style={sc.helpRow}>
                <Text style={sc.helpIcon}>{icon}</Text>
                <Text style={sc.helpText}>{text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── QUESTION INTERFACE ─── */}
        {selectedDoc && (
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

            {/* Mode tabs */}
            <View style={sc.modeTabs}>
              <Pressable style={[sc.modeTab, mode === "retrieve" && sc.modeTabActive]} onPress={() => setMode("retrieve")}>
                <Text style={mode === "retrieve" ? sc.modeTabTextActive : sc.modeTabText}>📖 Answer from Book</Text>
              </Pressable>
              <Pressable style={[sc.modeTab, mode === "explain" && sc.modeTabActive]} onPress={() => setMode("explain")}>
                <Text style={mode === "explain" ? sc.modeTabTextActive : sc.modeTabText}>💡 Learn Concept</Text>
              </Pressable>
            </View>

            {/* Textarea */}
            <View style={sc.textareaWrap}>
              <TextInput
                style={sc.textarea}
                multiline
                numberOfLines={4}
                placeholder="e.g., What are the main relief features of India?"
                placeholderTextColor={MUTED}
                value={question}
                onChangeText={setQuestion}
                editable={!isQuerying && !ocrLoading}
                textAlignVertical="top"
              />
              <View style={sc.toolbar}>
                <Pressable style={sc.toolBtn} onPress={() => handleImageCapture(true)} disabled={isQuerying}>
                  <Feather name="camera" size={15} color={isQuerying ? MUTED : "#a78bfa"} />
                </Pressable>
                <Pressable style={sc.toolBtn} onPress={() => handleImageCapture(false)} disabled={isQuerying}>
                  <Feather name="image" size={15} color={isQuerying ? MUTED : "#a78bfa"} />
                </Pressable>
              </View>
            </View>

            {/* OCR feedback */}
            {captureUri && (
              <View style={sc.captureRow}>
                <Image source={{ uri: captureUri }} style={sc.captureThumb} />
                {ocrLoading
                  ? <View style={{ flex: 1 }}><ActivityIndicator size="small" color={PRIMARY} /><Text style={sc.captureLabel}>Extracting question…</Text></View>
                  : <View style={{ flex: 1 }}>
                    <Text style={[sc.captureLabel, { color: "#10b981" }]}>✓ Question extracted</Text>
                    <Pressable onPress={() => setCaptureUri(null)}><Text style={sc.clearBtn}>Clear</Text></Pressable>
                  </View>
                }
              </View>
            )}

            {/* Action buttons */}
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
            mode={mode}
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
  hint: { backgroundColor: "rgba(99,102,241,0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", padding: 10, marginTop: 4 },
  hintText: { fontSize: 12, color: "#a5b4fc" },
  hintAmber: { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)" },
  hintAmberText: { fontSize: 12, color: "#fcd34d" },
  helpRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  helpIcon: { fontSize: 18, width: 26 },
  helpText: { flex: 1, fontSize: 13, color: MUTED, lineHeight: 20 },
  qHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  qIconBox: { width: 42, height: 42, borderRadius: 8, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center" },
  qDocName: { fontSize: 11, color: MUTED, marginTop: 2 },
  modeTabs: { flexDirection: "row", gap: 8, marginBottom: 10 },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: "#2a2a3e" },
  modeTabActive: { backgroundColor: "#2d2a4a", borderColor: "rgba(102,126,234,0.6)" },
  modeTabText: { fontSize: 12, color: MUTED, fontFamily: "Inter_500Medium" },
  modeTabTextActive: { fontSize: 12, color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
  textareaWrap: { position: "relative", marginBottom: 8 },
  textarea: { backgroundColor: "#2a2a3e", borderWidth: 1, borderColor: "rgba(102,126,234,0.35)", borderRadius: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 48, fontSize: 14, color: TEXT_COLOR, minHeight: 100, fontFamily: "Inter_400Regular" },
  toolbar: { position: "absolute", bottom: 10, right: 10, flexDirection: "row", gap: 8 },
  toolBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(102,126,234,0.15)", alignItems: "center", justifyContent: "center" },
  captureRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  captureThumb: { width: 60, height: 60, borderRadius: 8, borderWidth: 2, borderColor: PRIMARY },
  captureLabel: { fontSize: 12, color: MUTED, marginTop: 4 },
  clearBtn: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  actionBtnDim: { opacity: 0.4 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  footer: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingTop: 8, paddingBottom: 16 },
  footerText: { fontSize: 11, color: MUTED },
});
