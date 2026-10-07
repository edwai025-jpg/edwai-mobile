import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { STUDY_ACTION_COLORS } from "@/constants/studyActionColors";
import { useTheme } from "@/context/theme";
import {
  plainStudyText,
  studyResources,
  type QuizQuestion,
  type ReportPayload,
  type StudyAnswerContext,
} from "@/services/studyResources";

import StudyReportForm from "./StudyReportForm";
import { errMsg, type StudyRun } from "./studyRequests";

function validQuestions(list: QuizQuestion[]): QuizQuestion[] {
  return (Array.isArray(list) ? list : []).filter(
    (q) =>
      q && typeof q.question === "string" && q.question.trim() &&
      Array.isArray(q.options) && q.options.length >= 2 &&
      q.options.every((o) => typeof o === "string") &&
      Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length,
  );
}

export default function StudyQuizModal({
  visible,
  context,
  run,
  sendReport,
  onClose,
}: {
  visible: boolean;
  context: StudyAnswerContext;
  run: StudyRun;
  sendReport: (p: ReportPayload, controller?: AbortController) => Promise<unknown>;
  onClose: () => void;
}) {
  const { isDark } = useTheme();
  const c = STUDY_ACTION_COLORS[isDark ? "dark" : "light"];
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [reporting, setReporting] = useState<number | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const ctl = useRef<AbortController | null>(null);
  const ctxRef = useRef(context);
  ctxRef.current = context;

  const load = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    const controller = new AbortController();
    ctl.current = controller;
    setStatus("loading");
    setError("");
    setPicked({});
    setChecked({});
    setSubmitted(false);
    setReporting(null);
    try {
      const text = plainStudyText(ctxRef.current.answer);
      const res = await run((t, signal) => studyResources.quiz(t, text, ctxRef.current.language, signal), controller);
      if (!alive.current || controller.signal.aborted) return;
      const ok = validQuestions(res);
      if (!ok.length) {
        setError("The quiz could not be generated. Please try again.");
        setStatus("error");
      } else {
        setQs(ok);
        setStatus("ready");
      }
    } catch (e) {
      if (!alive.current || controller.signal.aborted) return;
      setError(errMsg(e, "Could not load the quiz. Please try again."));
      setStatus("error");
    } finally {
      lock.current = false;
    }
  }, [run]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ctl.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (visible) load();
    else {
      ctl.current?.abort();
      lock.current = false;
    }
  }, [visible, load]);

  const score = qs.reduce((n, q, i) => (picked[i] === q.correct ? n + 1 : n), 0);
  const text = isDark ? "#f3f4f6" : "#1f2937";
  const muted = isDark ? "#9ca3af" : "#6b7280";
  const bg = isDark ? "#14122b" : "#f5f3ff";
  const L = "ABCDEFGH";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <View style={s.head}>
          <Text style={[s.title, { color: c.quiz.text }]}>Quiz Me</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close quiz" style={s.x}>
            <Ionicons name="close" size={24} color={text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {status === "loading" ? (
            <View accessibilityLiveRegion="polite">
              {[0, 1, 2].map((i) => (
                <View key={i} style={[s.skel, { backgroundColor: c.quiz.bg, borderColor: c.quiz.border }]} />
              ))}
              <Text style={[s.small, { color: muted }]}>Writing your questions…</Text>
            </View>
          ) : null}

          {status === "error" ? (
            <View accessibilityLiveRegion="polite">
              <Text style={s.err}>{error}</Text>
              <Pressable onPress={load} accessibilityRole="button" style={[s.btn, { borderColor: c.quiz.border, backgroundColor: c.quiz.bg }]}>
                <Text style={[s.btnText, { color: c.quiz.text }]}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {status === "ready" ? (
            <>
              {submitted ? (
                <View style={[s.score, { backgroundColor: c.quiz.bg, borderColor: c.quiz.border }]} accessibilityLiveRegion="polite">
                  <Text style={[s.title, { color: c.quiz.text }]}>Score: {score} / {qs.length}</Text>
                  <Text style={[s.small, { color: muted }]}>Unanswered questions count as wrong.</Text>
                </View>
              ) : null}
              {qs.map((q, i) => {
                const reveal = submitted || checked[i];
                return (
                  <View key={i} style={[s.q, { borderColor: c.quiz.border, backgroundColor: isDark ? "#ffffff0d" : "#ffffff" }]}>
                    <Text style={[s.qText, { color: text }]}>{i + 1}. {q.question}</Text>
                    {q.difficulty ? <Text style={[s.small, { color: muted, textAlign: "left" }]}>{q.difficulty}</Text> : null}
                    {q.options.map((o, oi) => {
                      const sel = picked[i] === oi;
                      const right = reveal && oi === q.correct;
                      const wrong = reveal && sel && oi !== q.correct;
                      const col = right ? "#10b981" : wrong ? "#e11d48" : sel ? c.quiz.text : c.quiz.border;
                      return (
                        <Pressable
                          key={oi}
                          disabled={!!reveal}
                          onPress={() => setPicked((p) => ({ ...p, [i]: oi }))}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: sel, disabled: !!reveal }}
                          accessibilityLabel={`Option ${L[oi] ?? oi + 1}: ${o}${right ? ", correct" : wrong ? ", incorrect" : ""}`}
                          style={[s.opt, { borderColor: col, backgroundColor: sel || right ? c.quiz.bg : "transparent" }]}
                        >
                          <Text style={[s.optText, { color: text }]}>{L[oi] ?? oi + 1}. {o}</Text>
                        </Pressable>
                      );
                    })}
                    {reveal ? (
                      <Text style={[s.expl, { color: muted }]}>
                        Correct: {L[q.correct] ?? q.correct + 1}. {q.options[q.correct]}
                        {q.explanation ? `\n${q.explanation}` : ""}
                      </Text>
                    ) : null}
                    <View style={s.rowBtns}>
                      {!reveal ? (
                        <Pressable
                          disabled={picked[i] === undefined}
                          onPress={() => setChecked((p) => ({ ...p, [i]: true }))}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: picked[i] === undefined }}
                          style={[s.btn, { flex: 1, borderColor: c.quiz.border, backgroundColor: c.quiz.bg }, picked[i] === undefined && { opacity: 0.5 }]}
                        >
                          <Text style={[s.btnText, { color: c.quiz.text }]}>Check Answer</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => setReporting(reporting === i ? null : i)}
                        accessibilityRole="button"
                        accessibilityLabel={`Report issue with question ${i + 1}`}
                        style={[s.btn, { borderColor: c.report.border, backgroundColor: c.report.bg }]}
                      >
                        <Ionicons name="warning-outline" size={16} color={c.report.text} />
                        <Text style={[s.btnText, { color: c.report.text }]}>Report</Text>
                      </Pressable>
                    </View>
                    {reporting === i ? (
                      <StudyReportForm
                        title="Report this question"
                        base={{
                          book_title: "MCQ Question",
                          page_number: null,
                          question: q.question,
                          ai_response: [
                            q.question,
                            ...q.options.map((o, oi) => `${L[oi] ?? oi + 1}. ${o}`),
                            `Correct: ${L[q.correct] ?? q.correct + 1}`,
                            q.explanation ?? "",
                          ].join("\n").slice(0, 500),
                        }}
                        submit={sendReport}
                        onClose={() => setReporting(null)}
                      />
                    ) : null}
                  </View>
                );
              })}
              <View style={s.rowBtns}>
                {!submitted ? (
                  <Pressable onPress={() => setSubmitted(true)} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: isDark ? "#4338ca" : "#4f46e5", borderColor: "transparent" }]}>
                    <Text style={[s.btnText, { color: "#fff" }]}>Submit Quiz</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={load} accessibilityRole="button" style={[s.btn, { flex: 1, borderColor: c.quiz.border, backgroundColor: c.quiz.bg }]}>
                  <Ionicons name="refresh" size={16} color={c.quiz.text} />
                  <Text style={[s.btnText, { color: c.quiz.text }]}>{submitted ? "Retake with new questions" : "Regenerate"}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  x: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  skel: { height: 120, borderRadius: 12, borderWidth: 1, opacity: 0.6, marginBottom: 12 },
  small: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  err: { color: "#e11d48", fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 10 },
  score: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  q: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  qText: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  opt: { minHeight: 48, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  optText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  expl: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19 },
  rowBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
