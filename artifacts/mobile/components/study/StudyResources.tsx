import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { STUDY_ACTION_COLORS } from "@/constants/studyActionColors";
import { useTheme } from "@/context/theme";
import { useStudyAudio } from "@/hooks/useStudyAudio";
import {
  studyResources,
  type ExplainQuota,
  type ReportPayload,
  type StudyAnswerContext,
} from "@/services/studyResources";

import StudyFlashcards from "./StudyFlashcards";
import StudyQuizModal from "./StudyQuizModal";
import StudyReportForm from "./StudyReportForm";
import { useStudyRequests } from "./studyRequests";

type Tone = { bg: string; border: string; text: string };

function ActionButton({
  tone, label, icon, onPress, disabled, bold, a11yLabel, children,
}: {
  tone: Tone;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  bold?: boolean;
  a11yLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={[s.btn, { backgroundColor: tone.bg, borderColor: tone.border }, disabled && { opacity: 0.5 }]}
    >
      <View style={s.inner}>
        <Ionicons name={icon} size={bold ? 14 : 16} color={tone.text} />
        <Text style={[s.label, { color: tone.text, fontFamily: bold ? "Inter_700Bold" : "Inter_600SemiBold" }]}>{label}</Text>
      </View>
      {children}
    </Pressable>
  );
}

export default function StudyResources({ context, accessToken }: { context: StudyAnswerContext; accessToken: string }) {
  const { isDark } = useTheme();
  const c = STUDY_ACTION_COLORS[isDark ? "dark" : "light"];
  const audio = useStudyAudio(context, accessToken);
  const { run, mounted } = useStudyRequests(accessToken);
  const [quota, setQuota] = useState<ExplainQuota | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [flashOpen, setFlashOpen] = useState(false);
  const [flashUsed, setFlashUsed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const quotaCtl = useRef<AbortController | null>(null);

  const hasAnswer = context.answer.trim().length > 0;
  const hasQuestion = context.question.trim().length > 0;

  const refreshQuota = useCallback(async () => {
    quotaCtl.current?.abort();
    const controller = new AbortController();
    quotaCtl.current = controller;
    try {
      const q = await run((t, signal) => studyResources.quota(t, signal), controller);
      if (mounted.current && !controller.signal.aborted) setQuota(q);
    } catch {
      /* keep last known quota; never fake one */
    }
  }, [run, mounted]);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota, audio.generationRevision]);
  useEffect(() => {
    if (audio.quotaDenied) setQuota(audio.quotaDenied);
  }, [audio.quotaDenied]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") refreshQuota();
    });
    if (Platform.OS === "web") window.addEventListener("focus", refreshQuota);
    return () => {
      sub.remove();
      if (Platform.OS === "web") window.removeEventListener("focus", refreshQuota);
      quotaCtl.current?.abort();
    };
  }, [refreshQuota]);

  const sendReport = useCallback(
    (p: ReportPayload, controller?: AbortController) => run((t, signal) => studyResources.report(t, p, signal), controller),
    [run],
  );

  const reportBase = useMemo(
    () => ({
      book_title: context.bookTitle || "",
      page_number: context.pageNumber ?? null,
      question: context.question,
      ai_response: context.answer.slice(0, 500),
    }),
    [context],
  );

  const notes = useMemo(() => {
    const out: string[] = [];
    const words = context.answer.trim().split(/\s+/).length;
    if (words > 400) out.push("Long answers are abbreviated when spoken.");
    if (/\$|\\\(|\\\[|\\frac/.test(context.answer)) out.push("Formulas are omitted from audio.");
    if (/odia|oriya|^or$/i.test(context.language)) out.push("Odia audio falls back to English.");
    return out;
  }, [context.answer, context.language]);

  if (!hasAnswer) return null;

  const r = audio.readState;
  const t = audio.tutorState;
  const readBusy = r === "loading" || r === "playing" || r === "paused";
  const readDisabled = r === "loading" || t === "loading" || t === "playing";
  const tutorDisabled = readBusy || t === "loading";
  const exhausted = quota !== null && (!quota.allowed || quota.remaining <= 0) && t === "idle";
  const amber = quota !== null && quota.remaining >= 1 && quota.remaining <= 3;
  const readLabel = r === "loading" ? "Loading…" : r === "playing" ? "Pause" : r === "paused" ? "Resume" : "Read Aloud";
  const readIcon: keyof typeof Ionicons.glyphMap = r === "playing" ? "pause" : r === "paused" ? "play" : "volume-high-outline";
  const tutorLabel =
    t === "loading" ? "Generating…" : t === "playing" ? "Pause" : t === "paused" ? "Resume" : t === "replay" ? "Play again" : "Tutor Explanation";
  const tutorIcon: keyof typeof Ionicons.glyphMap = t === "playing" ? "pause" : t === "paused" ? "play" : t === "replay" ? "refresh" : "school-outline";
  const muted = isDark ? "#9ca3af" : "#6b7280";

  const stop = (on: boolean) =>
    on ? (
      <Pressable onPress={audio.stop} accessibilityRole="button" accessibilityLabel="Stop audio" style={[s.btn, { backgroundColor: c.report.bg, borderColor: c.report.border }]}>
        <View style={s.inner}>
          <Ionicons name="stop" size={14} color={c.report.text} />
          <Text style={[s.label, { color: c.report.text, fontFamily: "Inter_600SemiBold" }]}>Stop</Text>
        </View>
      </Pressable>
    ) : null;

  return (
    <View>
      {audio.transcript ? (
        <View style={[s.transcript, { backgroundColor: c.tutor.bg, borderColor: c.tutor.border }]} accessibilityLiveRegion="polite">
          <Text style={[s.tText, { color: isDark ? "#f3e8ff" : "#581c87" }]}>
            <Text style={{ fontFamily: "Inter_700Bold" }}>Explanation: </Text>
            {audio.transcript}
          </Text>
        </View>
      ) : null}
      {audio.error ? (
        <Text style={s.error} accessibilityLiveRegion="polite">{audio.error}</Text>
      ) : null}
      {notes.length ? <Text style={[s.note, { color: muted }]}>{notes.join(" ")}</Text> : null}

      <View style={[s.bar, { borderTopColor: c.barDivider }]}>
        <ActionButton tone={c.read} label={readLabel} icon={readIcon} disabled={readDisabled} onPress={() => { audio.read(); }} />
        {stop(r === "playing" || r === "paused")}

        {exhausted ? (
          <View style={[s.btn, { backgroundColor: c.tutor.bg, borderColor: c.tutor.border }]} accessibilityRole="text">
            <Text style={[s.label, { color: c.tutor.text, fontFamily: "Inter_600SemiBold" }]}>Voice limit reached</Text>
          </View>
        ) : (
          <ActionButton
            tone={c.tutor}
            label={tutorLabel}
            icon={tutorIcon}
            disabled={tutorDisabled}
            onPress={() => { audio.tutor(); }}
            a11yLabel={quota && t === "idle" ? `Tutor Explanation, ${quota.remaining} of ${quota.limit} voice explanations left` : tutorLabel}
          >
            {quota ? (
              <View style={[s.quota, { backgroundColor: c.tutor.quotaBg, borderLeftColor: c.tutor.quotaDivider }]} importantForAccessibility="no-hide-descendants">
                <Text style={[s.label, { color: amber ? c.amberText : c.tutor.quotaText, fontFamily: "Inter_600SemiBold" }]}>
                  {quota.remaining}/{quota.limit}
                </Text>
              </View>
            ) : null}
          </ActionButton>
        )}
        {stop(t === "playing" || t === "paused")}

        <ActionButton tone={c.quiz} label="Quiz Me" icon="create-outline" onPress={() => setQuizOpen(true)} />
        {hasQuestion ? (
          <ActionButton
            tone={c.cards}
            label="Flashcards"
            icon="sparkles-outline"
            onPress={() => {
              setFlashUsed(true);
              setFlashOpen((v) => !v);
            }}
          />
        ) : null}
        {hasQuestion ? (
          <ActionButton tone={c.report} label="Report Issue" icon="warning-outline" bold onPress={() => setReportOpen((v) => !v)} />
        ) : null}
      </View>

      {flashUsed && hasQuestion ? (
        <StudyFlashcards context={context} run={run} open={flashOpen} onCollapse={() => setFlashOpen(false)} />
      ) : null}
      {reportOpen && hasQuestion ? (
        <StudyReportForm base={reportBase} submit={sendReport} onClose={() => setReportOpen(false)} />
      ) : null}

      {quizOpen ? (
        <StudyQuizModal visible={quizOpen} context={context} run={run} sendReport={sendReport} onClose={() => setQuizOpen(false)} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-start", gap: 8 },
  btn: {
    flexDirection: "row",
    maxWidth: "100%",
    alignItems: "center",
    alignSelf: "flex-start",
    minHeight: Platform.OS === "android" ? 48 : 44,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  inner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, flexShrink: 1, minWidth: 0 },
  label: { fontSize: 14, flexShrink: 1 },
  quota: { alignSelf: "stretch", justifyContent: "center", paddingHorizontal: 12, borderLeftWidth: 1 },
  transcript: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  tText: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  error: { color: "#e11d48", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 10 },
  note: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
});
