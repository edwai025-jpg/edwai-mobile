import { platformShadow } from "@/constants/shadow";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DimensionValue,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnswerCard from "@/components/study/AnswerCard";
import { resolveStudyLanguage, type StudyAnswerContext } from "@/services/studyResources";
import QuestionComposer, { type QuestionComposerHandle } from "@/components/study/QuestionComposer";
import RecentQuestionsPanel from "@/components/study/RecentQuestionsPanel";
import { useRecentQuestions } from "@/hooks/useRecentQuestions";
import { useSourceSettings } from "@/hooks/useSourceSettings";
import { attachStudyPages, fetchStudyPages, streamedAnswerForDisplay } from "@/services/studyPages";
import { HomeBanner, UpgradeModal } from "@/components/shared/HomeBanner";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useBannerUsage } from "@/hooks/useBannerUsage";
import { useTheme } from "@/context/theme";
import { pickStudyImage } from "@/services/studyImageCapture";
import { academicClassName, initialAcademicClass, isInstituteStudent } from "@/services/academicClassSelection";
import api, {
  ApiError,
  BoardStatus,
  Phase1Document,
  QueryResponse,
  TypographySettings,
} from "@/services/api";

const PRIMARY = "#667eea";
const CARD_BG = "#1e1e3a";
const BORDER = "rgba(255,255,255,0.10)";
const TEXT_COLOR = "#f9fafb";
const MUTED = "#9ca3af";

/* ─── Picker ─────────────────────────────────────────────────────────────── */
function DarkPicker({
  label, options, selected, onSelect, disabled, placeholder, loading, onClear,
}: {
  label: string;
  options: { id: string | number; name: string }[];
  selected: string | number | null;
  onSelect: (v: { id: string | number; name: string }) => void;
  disabled?: boolean;
  placeholder: string;
  loading?: boolean;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();
  const inputBg = isDark ? "#2a2a3e" : "#ffffff";
  const textCol = isDark ? TEXT_COLOR : "#111827";
  const borderCol = isDark ? BORDER : "#e5e7eb";
  const selectedName = options.find((o) => String(o.id) === String(selected))?.name ?? "";
  return (
    <View style={dp.wrap}>
      <Text style={[dp.label, !isDark && { color: "#374151" }]}>{label}</Text>
      <Pressable style={[dp.sel, disabled && dp.disabled, { backgroundColor: inputBg }]} onPress={() => !disabled && !loading && setOpen((v) => !v)}>
        {loading
          ? <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
          : <Text style={[dp.selText, !selectedName && dp.placeholder, { color: selectedName ? textCol : MUTED }]} numberOfLines={1}>{selectedName || placeholder}</Text>
        }
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={isDark ? MUTED : Colors.gray500} />
      </Pressable>
      {open && (
        <View style={[dp.dropdown, { backgroundColor: inputBg, borderColor: borderCol }]}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 164 }}>
            {onClear && (
              <Pressable style={[dp.option, { borderBottomColor: borderCol }]} onPress={() => { onClear(); setOpen(false); }}>
                <Text style={[dp.optText, { color: MUTED }]}>{placeholder}</Text>
              </Pressable>
            )}
            {options.map((opt) => (
              <Pressable key={String(opt.id)} style={[dp.option, { borderBottomColor: borderCol }, String(opt.id) === String(selected) && dp.optSel]} onPress={() => { onSelect(opt); setOpen(false); }}>
                <Text style={[dp.optText, { color: textCol }, String(opt.id) === String(selected) && dp.optTextSel]}>{opt.name}</Text>
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
  dropdown: { marginTop: 4, borderWidth: 1, borderColor: BORDER, borderRadius: 8, backgroundColor: "#2a2a3e", ...platformShadow("#000", 0, 4, 0.5, 12), elevation: 8, overflow: "hidden", zIndex: 99 },
  option: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  optSel: { backgroundColor: "rgba(102,126,234,0.22)" },
  optText: { fontSize: 14, color: TEXT_COLOR },
  optTextSel: { color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
});

/* ─── Board Processing Card ──────────────────────────────────────────────── */
function BoardProcessingCard({ status, delayMinutes, onStart, starting }: {
  status: BoardStatus["processing_status"];
  delayMinutes: number;
  onStart: () => void;
  starting: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== "in_progress") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const total = delayMinutes * 60;
  const pct = Math.max(5, Math.min(95, Math.round((elapsed / Math.max(total, 1)) * 100)));
  const remaining = Math.max(0, total - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (status === "in_progress") {
    return (
      <View style={bp.card}>
        <View style={bp.timerRing}>
          <View style={bp.timerInner}>
            <Text style={bp.timerText}>{mm}:{ss}</Text>
            <Text style={bp.timerLabel}>remaining</Text>
          </View>
        </View>
        <Text style={bp.title}>Processing Your Board's Textbooks</Text>
        <Text style={bp.desc}>Indexing your textbooks. This may take up to {delayMinutes} minutes.</Text>
        <View style={bp.progressBg}>
          <View style={[bp.progressFill, { width: `${pct}%` as `${number}%` }]} />
        </View>
        <Text style={bp.note}>{pct}% complete — check back soon</Text>
      </View>
    );
  }
  if (status === "failed") {
    return (
      <View style={bp.card}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
        <Text style={bp.title}>Processing Failed</Text>
        <Text style={bp.desc}>There was an issue. Please try again.</Text>
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
        {starting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={bp.btnText}>📄 Process Official Documents</Text>}
      </Pressable>
      <Text style={bp.note}>One-time setup · Takes ~{delayMinutes} min</Text>
    </View>
  );
}
const bp = StyleSheet.create({
  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 24, marginBottom: 12, alignItems: "center" },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(102,126,234,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  timerRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: PRIMARY, alignItems: "center", justifyContent: "center", marginBottom: 16, backgroundColor: "rgba(102,126,234,0.08)" },
  timerInner: { alignItems: "center" },
  timerText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#a78bfa" },
  timerLabel: { fontSize: 9, color: MUTED, marginTop: 1 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT_COLOR, textAlign: "center", marginBottom: 8 },
  desc: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  btn: { backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 13, marginBottom: 10 },
  btnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  note: { fontSize: 11, color: MUTED },
  progressBg: { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, width: "100%", marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 3 },
});

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function TextbooksScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const catalogRequest = useRef(0);
  const { accessToken, user, logout, runAuthenticatedRequest } = useAuth();
  const { disclaimerMessages, boardPageConfig, pendingBoard } = useSourceSettings(true);

  /* usage */
  const { usage, usageLoading, refreshUsage } = useBannerUsage();
  const [showUpgrade, setShowUpgrade] = useState(false);

  /* board status */
  const [boardStatus, setBoardStatus] = useState<BoardStatus | null>(null);
  const [boardStatusLoading, setBoardStatusLoading] = useState(true);
  const [boardStatusError, setBoardStatusError] = useState(false);
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

  /* session config */
  const [typographySettings, setTypographySettings] = useState<TypographySettings | null>(null);

  /* query */
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"retrieve" | "explain">("retrieve");
  const selectionAccount = useRef(user?.id);
  const recentQuestions = useRecentQuestions("shared", selectionAccount.current === user?.id ? selectedDoc?.id : undefined);
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
  const [imagesLoading, setImagesLoading] = useState(false);

  /* ocr */
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const abortCtrl = useRef<AbortController | null>(null);
  useEffect(() => {
    abortCtrl.current?.abort();
    setResponse(null); setStudyContext(null); setStreaming(false); setQueryLoading(false);
    setStreamText(""); setImagesLoading(false);
    return () => abortCtrl.current?.abort();
  }, [user?.id, user?.boardId, selectedDoc?.id]);
  const boardId = user?.boardId;
  const instituteStudent = isInstituteStudent(user);
  const classScope = JSON.stringify([user?.id, boardId, user?.orgRole, user?.orgId]);
  const initialClassChosen = useRef(false);
  const loadedClassesScope = useRef<string | null>(null);
  const bottomInset = Platform.OS === "web" ? 84 : insets.bottom + 84;

  /* Start without a source; entering Own Books clears the academic selection. */
  useEffect(() => {
    if (pathname !== "/my-docs") return;
    catalogRequest.current++;
    abortCtrl.current?.abort();
    setSelectedDoc(null); setDocsLoading(false);
    setResponse(null); setStudyContext(null); setStreamText("");
    setStreaming(false); setQueryLoading(false); setImagesLoading(false);
  }, [pathname]);

  /* ── Session setup: typography + disclaimer messages ── */
  useEffect(() => {
    if (!accessToken) return;
    api.study.getTypographySettings(accessToken).then(setTypographySettings).catch(() => {});
  }, [accessToken]);

  const handleLogout = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  }, [logout]);

  /* ── board status ── */
  const loadBoardStatus = useCallback(async () => {
    if (!accessToken) return;
    setBoardStatusLoading(true);
    setBoardStatusError(false);
    try {
      const s = await api.study.getBoardStatus(accessToken);
      setBoardStatus(s);
    } catch {
      setBoardStatus(null);
      setBoardStatusError(true);
    } finally {
      setBoardStatusLoading(false);
    }
  }, [accessToken]);

  /* Re-fetch board status whenever boardId changes (e.g. after profile edit) */
  useEffect(() => {
    if (!accessToken) { setBoardStatusLoading(false); return; }
    loadBoardStatus();
  }, [accessToken, boardId]);

  /* Never retain or combine class lists from another board, account, or institute. */
  useEffect(() => {
    catalogRequest.current++;
    initialClassChosen.current = false;
    loadedClassesScope.current = null;
    setSelectedClass(null);
    setSelectedSubject(null);
    setSelectedDoc(null);
    setSubjects([]);
    setDocuments([]);
    setClasses([]);
    setResponse(null);
    setStreamText("");
    return () => { catalogRequest.current++; };
  }, [classScope]);

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

  /* The existing endpoint owns board/org scope; keep every returned class. */
  useEffect(() => {
    if (!accessToken || (!boardId && !instituteStudent)) return;
    if (boardStatus?.processing_status === "in_progress") return;
    let active = true;
    loadedClassesScope.current = null;
    setClassesLoading(true);
    api.study.getAvailableClasses(accessToken).then(list => {
      if (!active) return;
      loadedClassesScope.current = classScope;
      setClasses(list);
    }).catch(() => {}).finally(() => { if (active) setClassesLoading(false); });
    return () => { active = false; };
  }, [accessToken, classScope, instituteStudent, boardStatus?.processing_status]);

  /* ── class select: load subjects via dedicated endpoint ── */
  const onClassSelect = useCallback(async (cls: { id: number; name: string }) => {
    initialClassChosen.current = true;
    const request = ++catalogRequest.current;
    abortCtrl.current?.abort();
    setSelectedClass(cls); setSelectedSubject(null); setSelectedDoc(null); setSubjects([]); setDocuments([]);
    if (!accessToken) return;
    setDocsLoading(true);
    try {
      const subjs = await api.study.getAvailableSubjects(accessToken, cls.id);
      if (request !== catalogRequest.current) return;
      setSubjects(subjs);
      if (subjs.length === 1) {
        setSelectedSubject(subjs[0]);
        const books = await api.study.getDocuments(accessToken, cls.id, subjs[0]);
        if (request !== catalogRequest.current) return;
        setDocuments(books);
        if (books.length === 1) setSelectedDoc(books[0]);
      }
    } catch {} finally { if (request === catalogRequest.current) setDocsLoading(false); }
  }, [accessToken]);

  /* One-time profile default: wait for both profile and the scoped API list.
     A deliberate choice (including another grade) must never be overwritten. */
  useEffect(() => {
    if (pathname !== "/" || classesLoading || initialClassChosen.current || loadedClassesScope.current !== classScope) return;
    if (boardStatusLoading || (boardStatus?.is_restricted && boardStatus.processing_status !== "completed")) return;
    const cls = initialAcademicClass(classes, user);
    if (cls) void onClassSelect(cls);
  }, [classes, classesLoading, classScope, user?.classId, user?.className, user?.orgRole, user?.orgId, pathname, onClassSelect, boardStatusLoading, boardStatus?.is_restricted, boardStatus?.processing_status]);

  /* ── subject select: load documents — server applies board+medium from profile ── */
  const onSubjectSelect = useCallback(async (subj: string) => {
    const request = ++catalogRequest.current;
    abortCtrl.current?.abort();
    setSelectedSubject(subj); setSelectedDoc(null); setDocuments([]);
    if (!accessToken || !selectedClass) return;
    setDocsLoading(true);
    try {
      const books = await api.study.getDocuments(accessToken, selectedClass.id, subj);
      if (request !== catalogRequest.current) return;
      setDocuments(books);
      if (books.length === 1) setSelectedDoc(books[0]);
    } catch {} finally { if (request === catalogRequest.current) setDocsLoading(false); }
  }, [accessToken, selectedClass]);

  const onDocSelect = useCallback((doc: Phase1Document | null) => {
    catalogRequest.current++;
    abortCtrl.current?.abort();
    setStudyContext(null);
    setStreaming(false); setQueryLoading(false); setImagesLoading(false);
    setSelectedDoc(doc); setResponse(null); setStreamText("");
  }, []);

  /* ── query ── */
  const handleQuery = useCallback(async (qMode: "retrieve" | "explain") => {
    if (!question.trim() || !selectedDoc || !accessToken) return;
    abortCtrl.current?.abort();
    const ctrl = new AbortController();
    abortCtrl.current = ctrl;
    setMode(qMode); setQueryLoading(true); setStreaming(true);
    setImagesLoading(false);
    setStreamText(""); setResponse(null);
    setStudyContext(null);
    const originalQuestion = question.trim();
    const bookTitle = selectedDoc.title;
    const configForAnswer = pendingBoard.current;
    const valid = () => abortCtrl.current === ctrl && !ctrl.signal.aborted;
    let accumulated = "";
    try {
      const res = await api.study.streamQuery(
        accessToken,
        { document_id: selectedDoc.id, question: question.trim(), mode: qMode },
        (chunk) => { if (valid()) { accumulated += chunk; setStreamText((t) => t + chunk); } },
        ctrl.signal
      );
      const displayMode = (await configForAnswer)?.page_display_mode ?? "original";
      const finalRes = streamedAnswerForDisplay(res.answer ? res : { ...res, answer: accumulated }, displayMode);
      if (!valid()) return;
      setStudyContext({
        id: `${selectedDoc.id}:${Date.now()}`, question: originalQuestion, answer: finalRes.answer,
        language: resolveStudyLanguage(finalRes.answer_language ?? finalRes.language, user?.medium, finalRes.answer),
        bookTitle, pageNumber: finalRes.sources?.[0]?.page ?? null,
      });
      setResponse(finalRes); setStreaming(false); setQueryLoading(false);
      /* Phase 1: fetch citation/diagram images asynchronously after stream */
      if (finalRes.answerTransport !== "json" && !finalRes.answer_not_found && finalRes.document_id && finalRes.image_source_pages?.length) {
        setImagesLoading(true);
        void (async () => {
          try {
            const imgRes = await fetchStudyPages(finalRes, displayMode, ctrl.signal, {
              generated: (docId, filename) => runAuthenticatedRequest(token => api.study.fetchAiPage(token, docId, filename, ctrl.signal)),
              standard: body => runAuthenticatedRequest(token => api.study.fetchQueryImages(token, body, ctrl.signal)),
            });
            if (!valid() || !imgRes) return;
            setResponse(prev => prev ? attachStudyPages(prev, imgRes, displayMode) : prev);
          } catch {}
          finally { if (valid()) setImagesLoading(false); }
        })();
      }
      if (finalRes.answer && !finalRes.answer.startsWith("Error:")) recentQuestions.refreshAfterAnswer();
      /* Refresh usage after each query */
      void refreshUsage();
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
  }, [question, selectedDoc, accessToken, refreshUsage, user?.medium, recentQuestions.refreshAfterAnswer, pendingBoard, runAuthenticatedRequest]);

  /* ── image / OCR ── */
  const handleImageCapture = useCallback(async (fromCamera: boolean) => {
    try {
      const result = await pickStudyImage(fromCamera, {
        retryCamera: () => { void handleImageCapture(true); },
        choosePhoto: () => { void handleImageCapture(false); },
      });
      if (!result || result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      setCaptureUri(uri);
      if (!accessToken) return;
      setOcrLoading(true);
      try { const { text } = await api.study.extractQuestionFromImage(accessToken, uri); if (text) setQuestion(text); }
      catch {} finally { setOcrLoading(false); }
    } catch {
      Alert.alert("Could not open photo capture", "Please try again, choose a photo from your library, or type your question.");
    }
  }, [accessToken]);

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

  const { isDark, toggleTheme } = useTheme();
  const isQuerying = queryLoading || streaming;
  const isRestricted = !!boardStatus?.is_restricted && boardStatus.processing_status !== "completed";
  const boardReady = !boardStatusLoading && !isRestricted;
  const hasNoBoard = !boardId && !instituteStudent;
  const cardBg = isDark ? CARD_BG : "#ffffff";
  const cardBorder = isDark ? BORDER : "#e5e7eb";
  const textCol = isDark ? TEXT_COLOR : "#111827";
  const mutedCol = isDark ? MUTED : "#6b7280";

  return (
    <LinearGradient
      colors={isDark ? ["#1a1a2e", "#16213e"] : ["#eff6ff", "#ffffff", "#faf5ff"]}
      style={sc.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      {/* ── Sticky Banner ── */}
      <HomeBanner
        usage={usage}
        usageLoading={usageLoading}
        onUpgrade={() => setShowUpgrade(true)}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <ScrollView
        contentContainerStyle={[sc.scroll, { paddingBottom: bottomInset + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* ─── BOARD STATUS ─── */}
        {boardStatusLoading && (
          <View style={[sc.card, { alignItems: "center", paddingVertical: 28, backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={{ color: mutedCol, marginTop: 10, fontSize: 13 }}>Checking board status…</Text>
          </View>
        )}

        {!boardStatusLoading && boardStatusError && (
          <View style={sc.errorBanner}>
            <Feather name="wifi-off" size={14} color="#fcd34d" />
            <Text style={sc.errorBannerText}>Couldn't reach server</Text>
            <Pressable onPress={loadBoardStatus} style={sc.retryBtn}>
              <Text style={sc.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!boardStatusLoading && isRestricted && boardStatus && (
          <BoardProcessingCard status={boardStatus.processing_status} delayMinutes={boardStatus.processing_delay_minutes} onStart={handleStartProcessing} starting={startingProcess} />
        )}

        {!boardStatusLoading && !isRestricted && hasNoBoard && (
          <View style={sc.setupCard}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🎓</Text>
            <Text style={sc.setupTitle}>Complete Your Profile First</Text>
            <Text style={sc.setupDesc}>Select your state, board, and class so EdwAI can find the right textbooks for you.</Text>
          </View>
        )}

        {/* ─── BOOK SELECTION ─── */}
        {boardReady && !hasNoBoard && (
          <View style={[sc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[sc.cardTitle, { color: textCol }]}>📖 Select Your Textbook</Text>
            <DarkPicker label="Class / Year" options={classes.map(cls => ({ ...cls, name: academicClassName(cls, user) }))} selected={selectedClass?.id ?? null} onSelect={(v) => onClassSelect({ id: v.id as number, name: v.name })} placeholder="Select Class" loading={classesLoading} disabled={classes.length === 0 && !classesLoading} />
            <DarkPicker label="Subject" options={subjects.map((s) => ({ id: s, name: s }))} selected={selectedSubject} onSelect={(v) => onSubjectSelect(v.name)} placeholder="Select Subject" disabled={!selectedClass || subjects.length === 0} loading={docsLoading && !!selectedClass && !selectedSubject} />
            <DarkPicker label="Textbook" options={documents.map((d) => ({ id: d.id, name: d.title }))} selected={selectedDoc?.id ?? null} onSelect={(v) => { const d = documents.find((x) => x.id === v.id); if (d) onDocSelect(d); }} onClear={() => onDocSelect(null)} placeholder="Select Textbook" disabled={!selectedSubject || documents.length === 0} loading={docsLoading && !!selectedSubject && !selectedDoc} />
            {!selectedClass && classes.length > 0 && (
              <View style={sc.hint}><Text style={sc.hintText}>👆 Select a class to see available subjects</Text></View>
            )}
            {!selectedClass && !classesLoading && classes.length === 0 && !boardStatusError && (
              <View style={[sc.hint, sc.hintAmber]}><Text style={sc.hintAmberText}>📚 No classes available yet for your {instituteStudent ? "institute" : "board"}</Text></View>
            )}
            {selectedClass && subjects.length === 0 && !docsLoading && (
              <View style={[sc.hint, sc.hintAmber]}><Text style={sc.hintAmberText}>📚 No subjects with textbooks available for this class yet.</Text></View>
            )}
            {selectedClass && subjects.length > 1 && !selectedSubject && !docsLoading && (
              <View style={sc.hint}><Text style={sc.hintText}>Select a subject to see available textbooks.</Text></View>
            )}
            {selectedClass && selectedSubject && documents.length === 0 && !docsLoading && (
              <View style={[sc.hint, sc.hintAmber]}><Text style={sc.hintAmberText}>📚 No textbooks available for this combination yet.</Text></View>
            )}
          </View>
        )}

        {/* ─── HELP ─── */}
        {boardReady && !hasNoBoard && !selectedDoc && (
          <View style={[sc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[sc.cardTitle, { color: textCol }]}>💬 How to use EdwAI</Text>
            {[["📚","Select your class, subject, and textbook above"],["✍️","Type your question in the box below"],["🔍","Choose Answer from Book to get the exact answer"],["💡","Choose Learn Concept for a detailed explanation"]].map(([icon, text], i) => (
              <View key={i} style={sc.helpRow}><Text style={sc.helpIcon}>{icon}</Text><Text style={[sc.helpText, { color: mutedCol }]}>{text}</Text></View>
            ))}
          </View>
        )}

        {/* ─── QUESTION INTERFACE ─── */}
        {selectedDoc && <View testID="academic-question-section" style={[sc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={sc.qHeader}>
              <View style={[sc.qIconBox, !isDark && { backgroundColor: "rgba(102,126,234,0.10)" }]}><Text style={{ fontSize: 18 }}>💬</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[sc.cardTitle, { color: textCol }]}>Ask a Question</Text>
                <Text style={[sc.qDocName, { color: mutedCol }]} numberOfLines={1}>{selectedDoc ? `From: ${selectedDoc.title}` : "Select a textbook before submitting"}</Text>
              </View>
            </View>

            <RecentQuestionsPanel key={recentQuestions.scopeKey} {...recentQuestions} phase="shared"
              onSelect={q => { if (composer.current) composer.current.replaceDraft(q); else setQuestion(q); }} />

            <QuestionComposer
              ref={composer}
              value={question} onChange={setQuestion} documentKey={`textbook:${selectedDoc?.id ?? "none"}`} isDark={isDark}
              disabled={isQuerying} imageBusy={ocrLoading}
              tools={<>
                <Pressable accessibilityRole="button" accessibilityLabel="Capture question with camera" style={sc.toolBtn} onPress={() => handleImageCapture(true)} disabled={isQuerying || ocrLoading}>
                  <Feather name="camera" size={15} color={isQuerying ? MUTED : "#a78bfa"} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Choose question image" style={sc.toolBtn} onPress={() => handleImageCapture(false)} disabled={isQuerying || ocrLoading}>
                  <Feather name="image" size={15} color={isQuerying ? MUTED : "#a78bfa"} />
                </Pressable>
              </>}
            />

            {/* OCR feedback */}
            {captureUri && (
              <View style={sc.captureRow}>
                <Image source={{ uri: captureUri }} style={sc.captureThumb} />
                {ocrLoading
                  ? <View style={{ flex: 1 }}><ActivityIndicator size="small" color={PRIMARY} /><Text style={sc.captureLabel}>Extracting question…</Text></View>
                  : <View style={{ flex: 1 }}><Text style={[sc.captureLabel, { color: "#10b981" }]}>✓ Question extracted</Text><Pressable onPress={() => setCaptureUri(null)}><Text style={sc.clearBtn}>Clear</Text></Pressable></View>
                }
              </View>
            )}

            {/* Action buttons */}
            <View style={sc.actionRow}>
              <Pressable style={[sc.actionBtn, { backgroundColor: PRIMARY }, (!selectedDoc || !question.trim() || isQuerying) && sc.actionBtnDim]} onPress={() => handleQuery("retrieve")} disabled={!selectedDoc || !question.trim() || isQuerying}>
                {isQuerying && mode === "retrieve" ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.actionBtnText}>📖 Answer from Book</Text>}
              </Pressable>
              <Pressable style={[sc.actionBtn, { backgroundColor: "#059669" }, (!selectedDoc || !question.trim() || isQuerying) && sc.actionBtnDim]} onPress={() => handleQuery("explain")} disabled={!selectedDoc || !question.trim() || isQuerying}>
                {isQuerying && mode === "explain" ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.actionBtnText}>💡 Learn Concept</Text>}
              </Pressable>
            </View>
        </View>}

        {/* ─── ANSWER ─── */}
        {(queryLoading || streaming || response) && (
          <AnswerCard
            loading={queryLoading && !streaming}
            streaming={streaming}
            streamText={streamText}
            response={response}
            mode={mode}
            disclaimerMessages={disclaimerMessages}
            boardPageConfig={boardPageConfig}
            typographySettings={typographySettings}
            imagesLoading={imagesLoading}
            question={question}
            accessToken={accessToken ?? undefined}
            studyContext={studyContext}
          />
        )}

        <View style={sc.footer}>
          <Feather name="alert-triangle" size={11} color={MUTED} />
          <Text style={sc.footerText}>AI responses should be verified with citations.</Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </LinearGradient>
  );
}

const im = StyleSheet.create({
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: "#2a2a3e" },
  btnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  btnText: { fontSize: 13, color: MUTED, fontFamily: "Inter_500Medium" },
  btnTextActive: { fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" },
  langBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(102,126,234,0.12)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(102,126,234,0.3)", paddingHorizontal: 12, paddingVertical: 7 },
  langBtnText: { fontSize: 13, color: PRIMARY, fontFamily: "Inter_600SemiBold" },
  langList: { backgroundColor: "#2a2a3e", borderRadius: 10, borderWidth: 1, borderColor: BORDER, marginTop: 4, maxHeight: 56 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: "#1e1e3a" },
  langChipActive: { backgroundColor: "rgba(102,126,234,0.25)", borderColor: PRIMARY },
  langChipText: { fontSize: 12, color: MUTED },
  langChipTextActive: { color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
  transHint: { fontSize: 11, color: MUTED, marginTop: 6, fontStyle: "italic" },
  keyboardTrigger: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(102,126,234,0.1)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(102,126,234,0.3)", paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  keyboardTriggerIcon: { fontSize: 18 },
  keyboardTriggerText: { flex: 1, fontSize: 13, color: "#a5b4fc", fontFamily: "Inter_500Medium" },
  suggestionsWrap: { backgroundColor: "rgba(102,126,234,0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(102,126,234,0.25)", padding: 10, marginBottom: 8 },
  suggestionsLabel: { fontSize: 11, color: MUTED, marginBottom: 4 },
  suggestionChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(102,126,234,0.25)", borderRadius: 20, borderWidth: 1, borderColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 6 },
  suggestionChipNum: { fontSize: 10, color: "#a78bfa", fontFamily: "Inter_700Bold", backgroundColor: "rgba(102,126,234,0.4)", width: 16, height: 16, borderRadius: 8, textAlign: "center", lineHeight: 16 },
  suggestionChipText: { fontSize: 14, color: "#fff", fontFamily: "Inter_500Medium" },
});

const sc = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT_COLOR, marginBottom: 12 },
  hint: { backgroundColor: "rgba(99,102,241,0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", padding: 10, marginTop: 4 },
  hintText: { fontSize: 12, color: "#a5b4fc" },
  hintAmber: { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)" },
  hintAmberText: { fontSize: 12, color: "#fcd34d" },
  helpRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  helpIcon: { fontSize: 18, width: 26 },
  helpText: { flex: 1, fontSize: 13, color: MUTED, lineHeight: 20 },
  qHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  qIconBox: { width: 42, height: 42, borderRadius: 10, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center" },
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
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorBannerText: { flex: 1, fontSize: 13, color: "#fcd34d", fontFamily: "Inter_500Medium" },
  retryBtn: { backgroundColor: "rgba(245,158,11,0.25)", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  retryBtnText: { fontSize: 12, color: "#fde68a", fontFamily: "Inter_600SemiBold" },
  setupCard: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 28, marginBottom: 12, alignItems: "center" },
  setupTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: TEXT_COLOR, textAlign: "center", marginBottom: 8 },
  setupDesc: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20, marginBottom: 20 },
});
