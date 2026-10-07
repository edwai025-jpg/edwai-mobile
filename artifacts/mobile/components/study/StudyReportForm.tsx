import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { REPORT_ISSUES, STUDY_ACTION_COLORS } from "@/constants/studyActionColors";
import { useTheme } from "@/context/theme";
import type { ReportPayload } from "@/services/studyResources";

import { errMsg } from "./studyRequests";

type Base = Omit<ReportPayload, "issue_type" | "description">;

export default function StudyReportForm({
  base,
  submit,
  onClose,
  title = "Report an issue",
}: {
  base: Base;
  submit: (p: ReportPayload, controller?: AbortController) => Promise<unknown>;
  onClose: () => void;
  title?: string;
}) {
  const { isDark } = useTheme();
  const c = STUDY_ACTION_COLORS[isDark ? "dark" : "light"];
  const [issue, setIssue] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const send = async () => {
    if (!issue || lock.current) return;
    lock.current = true;
    setStatus("submitting");
    setError("");
    try {
      const controller = new AbortController();
      request.current = controller;
      await submit({ ...base, issue_type: issue, description: desc.trim() || null }, controller);
      if (!alive.current) return;
      setStatus("success");
      timer.current = setTimeout(() => closeRef.current(), 15000);
    } catch (e) {
      if (!alive.current) return;
      setError(errMsg(e, "Could not send the report. Check your connection and try again."));
      setStatus("error");
    } finally {
      lock.current = false;
    }
  };

  const text = isDark ? "#f3f4f6" : "#1f2937";
  const muted = isDark ? "#9ca3af" : "#6b7280";
  const box = { backgroundColor: c.report.bg, borderColor: c.report.border };

  if (status === "success") {
    return (
      <View style={[s.box, box]} accessibilityLiveRegion="polite">
        <Text style={[s.title, { color: c.report.text }]}>Report sent. Thank you.</Text>
        <Text style={[s.small, { color: muted }]}>This closes in 15 seconds.</Text>
        <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, { borderColor: c.report.border }]}>
          <Text style={[s.btnText, { color: c.report.text }]}>Close</Text>
        </Pressable>
      </View>
    );
  }
  const busy = status === "submitting";
  return (
    <View style={[s.box, box]}>
      <View style={s.head}>
        <Text style={[s.title, { color: c.report.text, flex: 1 }]}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close report form" style={s.x}>
          <Ionicons name="close" size={20} color={c.report.text} />
        </Pressable>
      </View>
      <View accessibilityRole="radiogroup">
        {REPORT_ISSUES.map((it) => {
          const on = issue === it.id;
          return (
            <Pressable
              key={it.id}
              disabled={busy}
              onPress={() => setIssue(it.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: busy }}
              style={s.row}
            >
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? c.report.text : muted} />
              <Text style={[s.label, { color: text }]}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={desc}
        onChangeText={setDesc}
        editable={!busy}
        multiline
        placeholder="Details (optional)"
        placeholderTextColor={muted}
        accessibilityLabel="Report details"
        style={[s.input, { color: text, borderColor: c.report.border }]}
      />
      {status === "error" ? <Text style={s.err} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Pressable
        onPress={send}
        disabled={!issue || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !issue || busy, busy }}
        style={[s.submit, { backgroundColor: isDark ? "#be123c" : "#e11d48" }, (!issue || busy) && { opacity: 0.5 }]}
      >
        <Text style={s.submitText}>{busy ? "Submitting…" : status === "error" ? "Retry" : "Submit Report"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  head: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  small: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  x: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium", flexShrink: 1 },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 72, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", textAlignVertical: "top", marginTop: 8 },
  err: { color: "#e11d48", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 8 },
  submit: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 10 },
  submitText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  btn: { minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 10 },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
