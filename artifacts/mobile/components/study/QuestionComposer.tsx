import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from "react-native";
import Markdown from "react-native-markdown-display";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import api from "@/services/api";
import { caretWord, INPUT_LANGUAGES, replaceWord, voicePeriodEnd, type InputMode, type WordRange } from "@/services/inputModes";
import { useVoiceQuestion } from "@/hooks/useVoiceQuestion";
import { getMdStyles, preprocessMarkdown } from "./AnswerCard";
import QuestionKeyboard from "./QuestionKeyboard";

const MODES: { value: InputMode; label: string }[] = [
  { value: "normal", label: "✍️ Normal" }, { value: "transliterate", label: "🔤 Transliterate" },
  { value: "keyboard", label: "⌨️ Keyboard" }, { value: "voice", label: "🎙️ Voice" },
];
type Props = { value: string; onChange: (text: string) => void; documentKey: string; isDark: boolean; disabled?: boolean; imageBusy?: boolean; tools?: React.ReactNode; placeholder?: string };
export default function QuestionComposer({ value, onChange, documentKey, isDark, disabled, imageBusy, tools, placeholder }: Props) {
  const { accessToken } = useAuth();
  const input = useRef<TextInput>(null);
  const valueRef = useRef(value); valueRef.current = value;
  const emitted = useRef(value);
  const commit = (text: string) => { emitted.current = text; valueRef.current = text; onChange(text); };
  const selectionRef = useRef({ start: value.length, end: value.length });
  const [selection, setSelection] = useState(selectionRef.current);
  const [mode, setMode] = useState<InputMode>("normal");
  const [language, setLanguage] = useState("te");
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [transError, setTransError] = useState("");
  const range = useRef<WordRange | null>(null);
  const cache = useRef(new Map<string, string[]>());
  const request = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null), blur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(0);
  const voice = useVoiceQuestion(documentKey, text => { commit(text); setCaret(text.length); setEditing(false); });
  const textColor = isDark ? Colors.darkText : Colors.heading;
  const muted = isDark ? Colors.gray400 : Colors.muted;
  const border = isDark ? Colors.darkInputBorder : Colors.inputBorder;
  const background = isDark ? Colors.darkInputBg : Colors.inputBg;
  const busy = voice.phase === "preparing" || voice.phase === "transcribing";
  const recording = voice.phase === "recording";
  const startDisabled = !!disabled || !!imageBusy || busy || voice.usage?.allowed === false;
  const preview = mode === "voice" && voice.ready && !!value.trim() && !editing && !recording && !busy;
  const setCaret = (caret: number, focus = false) => {
    const next = { start: caret, end: caret }; selectionRef.current = next; setSelection(next);
    if (focus) requestAnimationFrame(() => {
      const node = input.current; node?.focus();
      if (Platform.OS === "web") (node as unknown as HTMLTextAreaElement | null)?.setSelectionRange?.(caret, caret);
      else node?.setNativeProps?.({ selection: next });
    });
  };
  const clearCandidates = useCallback(() => {
    revision.current++; request.current?.abort(); request.current = null;
    if (debounce.current) clearTimeout(debounce.current);
    if (blur.current) clearTimeout(blur.current);
    range.current = null; setCandidates([]); setCandidateIndex(0); setTransError("");
  }, []);
  const suggest = (text: string, caret: number) => {
    clearCandidates();
    if (mode !== "transliterate") return;
    const word = caretWord(text, caret);
    if (!word) return;
    range.current = word;
    const generation = revision.current, cacheKey = `${language}:${word.word}`;
    const show = (items: string[]) => {
      if (generation !== revision.current || valueRef.current !== text) return;
      setCandidates([...new Set([...items.filter(item => typeof item === "string" && !!item), word.word])]); setCandidateIndex(0);
    };
    const cached = cache.current.get(cacheKey);
    if (cached) { show(cached); return; }
    debounce.current = setTimeout(async () => {
      const ctrl = new AbortController(); request.current = ctrl;
      try {
        const response = await api.study.transliterate(accessToken ?? "", language, word.word, ctrl.signal);
        if (!response.success || !Array.isArray(response.result)) throw new Error(response.error || "Transliteration is temporarily unavailable.");
        const items = response.result.slice(0, 5).filter(item => typeof item === "string");
        cache.current.set(cacheKey, items); show(items);
      } catch (error) {
        if (ctrl.signal.aborted || generation !== revision.current) return;
        show([]); setTransError("Could not load suggestions. Your original word is unchanged; continue typing to retry.");
      }
    }, 250);
  };
  const choose = (index: number, space = true) => {
    const activeRange = range.current, candidate = candidates[index];
    if (!activeRange || !candidate || valueRef.current.slice(activeRange.start, activeRange.end) !== activeRange.word) { clearCandidates(); return; }
    const replacement = replaceWord(valueRef.current, activeRange, candidate, space);
    commit(replacement.text); clearCandidates(); setCaret(replacement.caret, true);
  };
  const change = (raw: string) => {
    const text = raw.normalize("NFC"), old = valueRef.current, position = selectionRef.current;
    const added = text.slice(position.start, position.start + Math.max(0, text.length - old.length + position.end - position.start));
    if (mode === "transliterate" && candidates.length && range.current) {
      if (added === " ") { choose(candidateIndex); return; }
      if (added === "\n" || added === "\t") { choose(candidateIndex, false); return; }
      if (/^[1-5]$/.test(added) && candidates[Number(added) - 1]) { choose(Number(added) - 1); return; }
    }
    const caret = Math.max(0, Math.min(text.length, position.start + text.length - old.length + position.end - position.start));
    commit(text); setCaret(caret); suggest(text, caret);
  };
  const keyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (mode !== "transliterate" || !candidates.length) return;
    const key = event.nativeEvent.key;
    if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(key)) {
      event.preventDefault(); setCandidateIndex(index => (index + (key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1) + candidates.length) % candidates.length);
    } else if (key === "Escape") { event.preventDefault(); clearCandidates(); }
    else if (key === "Tab" || (Platform.OS === "web" && (key === "Enter" || key === " " || /^[1-5]$/.test(key)))) {
      event.preventDefault(); choose(/^[1-5]$/.test(key) ? Number(key) - 1 : candidateIndex, key === " " || /^[1-5]$/.test(key));
    }
  };
  const switchMode = (next: InputMode) => {
    clearCandidates(); setLanguagesOpen(false); setEditing(false);
    if (next !== "voice") voice.cancel(); else voice.clearError();
    if (next === "keyboard") { Keyboard.dismiss(); setKeyboardOpen(open => mode === "keyboard" ? !open : true); }
    else setKeyboardOpen(false);
    setMode(next);
  };
  const start = () => { setMode("voice"); setKeyboardOpen(false); setEditing(false); clearCandidates(); Keyboard.dismiss(); void voice.start(); };
  useEffect(() => {
    clearCandidates(); setKeyboardOpen(false); setMode("normal"); setEditing(false);
    setCaret(valueRef.current.length);
  }, [documentKey, clearCandidates]);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value; clearCandidates(); voice.cancel(); setEditing(false); setCaret(value.length);
  }, [value, clearCandidates, voice.cancel]);
  useEffect(() => { if (imageBusy) { voice.cancel(); clearCandidates(); } }, [imageBusy, voice.cancel, clearCandidates]);
  useEffect(() => () => { request.current?.abort(); if (debounce.current) clearTimeout(debounce.current); if (blur.current) clearTimeout(blur.current); }, []);
  const expiry = voicePeriodEnd(voice.usage?.period_end);
  const elapsed = `${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")}`;
  return (
    <View>
      <View style={s.modes}>
        {MODES.map(item => {
          const active = mode === item.value && (item.value !== "keyboard" || keyboardOpen);
          return <Pressable key={item.value} testID={`input-mode-${item.value}`} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active }}
            onPress={() => switchMode(item.value)} style={[s.mode, { backgroundColor: active ? Colors.primary : background, borderColor: active ? Colors.primary : border }]}>
            <Text style={[s.modeText, { color: active ? Colors.white : textColor }]}>{item.label}</Text>
          </Pressable>;
        })}
      </View>
      {mode === "transliterate" && <View>
        <Pressable testID="transliteration-language" accessibilityRole="button" accessibilityState={{ expanded: languagesOpen }} onPress={() => setLanguagesOpen(open => !open)} style={[s.language, { borderColor: border }]}>
          <Text style={{ color: textColor, flex: 1 }}>{INPUT_LANGUAGES.find(item => item.code === language)?.label}</Text>
          <Feather name={languagesOpen ? "chevron-up" : "chevron-down"} size={16} color={muted} />
        </Pressable>
        {languagesOpen && <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={s.languages}>
          {INPUT_LANGUAGES.map(item => <Pressable key={item.code} testID={`transliteration-language-${item.code}`} accessibilityRole="button" accessibilityState={{ selected: language === item.code }}
            onPress={() => { setLanguage(item.code); setLanguagesOpen(false); clearCandidates(); }} style={[s.chip, { backgroundColor: language === item.code ? Colors.primary : background }]}>
            <Text style={{ color: language === item.code ? Colors.white : textColor }}>{item.label}</Text>
          </Pressable>)}
        </ScrollView>}
        <Text style={[s.hint, { color: muted }]}>Type an English word and choose a suggestion. Space selects; Enter/Tab select without a space.</Text>
      </View>}
      {mode === "voice" && <View testID="voice-question-panel" style={[s.voicePanel, { backgroundColor: isDark ? Colors.darkSurface : Colors.primaryUltraLight, borderColor: border }]}>
        <View style={s.voiceHeading}>
          <Text accessibilityLiveRegion="polite" style={[s.title, { color: textColor }]}>
            {recording ? `Listening… ${elapsed}` : voice.phase === "preparing" ? "Preparing your microphone…" : voice.phase === "transcribing" ? "Transcribing your question…" : voice.ready ? "Transcript ready" : "Speak your question"}
          </Text>
          {busy && <ActivityIndicator color={Colors.primary} size="small" />}
        </View>
        <Text style={[s.hint, { color: muted }]}>{voice.phase === "transcribing" ? "Sending audio securely for transcription…" : "Record up to 60 seconds. You can edit the transcript before submitting."}</Text>
        {voice.usage && <Text testID="voice-question-usage" style={[s.hint, { color: muted }]}>{voice.usage.remaining} of {voice.usage.limit} voice questions left this billing period{expiry ? ` · Ends ${expiry}` : ""}</Text>}
        {voice.usage?.allowed === false && <Text style={[s.hint, { color: muted }]}>Your voice-question allowance is exhausted for this billing period. You can still type your question.</Text>}
        {!!voice.usageError && <Text style={[s.hint, { color: muted }]}>{voice.usageError}</Text>}
        {voice.ready && !!voice.language && <Text style={[s.hint, { color: isDark ? Colors.successLight : Colors.success }]}>Detected language: {voice.language}</Text>}
        <Pressable testID="voice-record-button" accessibilityRole="button" accessibilityLabel={recording ? "Stop recording" : "Start recording"} accessibilityState={{ disabled: !recording && startDisabled }}
          disabled={!recording && startDisabled} onPress={recording ? () => { void voice.stop(); } : start} style={[s.record, { backgroundColor: recording ? Colors.danger : Colors.primary }, !recording && startDisabled && s.disabled]}>
          <Text style={s.recordText}>{recording ? `Stop recording (${elapsed})` : busy ? "Please wait…" : "Start recording"}</Text>
        </Pressable>
        {!!voice.error && <View>
          <Text testID="voice-question-error" accessibilityRole="alert" style={[s.hint, { color: isDark ? Colors.dangerLight : Colors.danger }]}>{voice.error}</Text>
          {voice.permissionBlocked && Platform.OS !== "web"
            ? <Pressable accessibilityRole="button" style={s.edit} onPress={() => { void Linking.openSettings(); }}><Text style={{ color: Colors.primary }}>Open Settings</Text></Pressable>
            : <Pressable testID="voice-try-again" accessibilityRole="button" disabled={recording || startDisabled} style={[s.edit, (recording || startDisabled) && s.disabled]} onPress={start}><Text style={{ color: Colors.primary }}>Try again</Text></Pressable>}
        </View>}
        {voice.ready && !busy && !recording && <Pressable testID="voice-edit-transcript" accessibilityRole="button" style={s.edit} onPress={() => { setEditing(current => !current); if (!editing) requestAnimationFrame(() => input.current?.focus()); }}>
          <Text style={{ color: Colors.primary }}>{editing ? "Done editing" : "Edit transcript"}</Text>
        </Pressable>}
      </View>}
      <View style={[s.textareaWrap, { backgroundColor: background, borderColor: border }]}>
        {preview ? <View testID="voice-transcript-preview" accessibilityLiveRegion="polite" style={s.preview}><Markdown style={getMdStyles(isDark) as never} onLinkPress={() => false}>{preprocessMarkdown(value)}</Markdown></View>
          : <TextInput ref={input} testID="question-input" accessibilityLabel="Your question" style={[s.textarea, { color: textColor }]} multiline numberOfLines={4} value={value}
            selection={selection} onChangeText={change} onKeyPress={keyPress} editable={!disabled && !imageBusy}
            showSoftInputOnFocus={!(mode === "keyboard" && keyboardOpen)} textAlignVertical="top"
            placeholder={mode === "transliterate" ? "Type your question in English letters…" : placeholder ?? "e.g., What are the main relief features of India?"} placeholderTextColor={muted}
            onSelectionChange={event => { selectionRef.current = event.nativeEvent.selection; setSelection(event.nativeEvent.selection); }}
            onBlur={() => { blur.current = setTimeout(clearCandidates, 200); }} />}
        <View style={s.toolbar}>
          <View style={s.tools}>{tools}</View>
          <View style={s.voiceBottom}>
            {voice.usage && <Text style={[s.balance, { color: muted }]}>{voice.usage.remaining}/{voice.usage.limit} voice questions left</Text>}
            <Pressable testID="voice-mic-action" accessibilityRole="button" accessibilityLabel={recording ? "Stop recording" : busy ? "Please wait for transcription" : "Record a voice question"} disabled={!recording && startDisabled}
              onPress={recording ? () => { void voice.stop(); } : start} style={[s.mic, { backgroundColor: recording ? Colors.danger : Colors.primary }, !recording && startDisabled && s.disabled]}>
              <Feather name={recording ? "square" : busy ? "loader" : "mic"} size={16} color={Colors.white} /><Text style={s.micText}>{recording ? "Stop" : busy ? "Wait" : "Mic"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {!!candidates.length && mode === "transliterate" && <View testID="transliteration-candidates" style={[s.candidates, { borderColor: border }]}>
        <Text style={[s.hint, { color: muted }]}>Suggestions for "{range.current?.word}"</Text>
        <View style={s.candidateBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous suggestion" style={s.arrow} onPress={() => setCandidateIndex(index => (index - 1 + candidates.length) % candidates.length)}><Feather name="chevron-left" size={18} color={textColor} /></Pressable>
          <ScrollView horizontal keyboardShouldPersistTaps="always" contentContainerStyle={s.languages}>
            {candidates.map((candidate, index) => <Pressable key={`${candidate}-${index}`} testID={`transliteration-candidate-${index}`} accessibilityRole="button" accessibilityState={{ selected: index === candidateIndex }}
              onPress={() => choose(index)} style={[s.chip, { backgroundColor: index === candidateIndex ? Colors.primary : background }]}>
              <Text style={{ color: index === candidateIndex ? Colors.white : textColor }}>{index < 5 ? `${index + 1} · ` : "Original · "}{candidate}</Text>
            </Pressable>)}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Next suggestion" style={s.arrow} onPress={() => setCandidateIndex(index => (index + 1) % candidates.length)}><Feather name="chevron-right" size={18} color={textColor} /></Pressable>
        </View>
      </View>}
      {!!transError && <Text accessibilityRole="alert" style={[s.hint, { color: muted }]}>{transError}</Text>}
      {mode === "keyboard" && keyboardOpen && <QuestionKeyboard isDark={isDark} disabled={disabled || imageBusy} onClose={() => setKeyboardOpen(false)}
        onInput={text => { const next = valueRef.current + text; commit(next); setCaret(next.length, true); }}
        onBackspace={() => { const next = valueRef.current.slice(0, -1); commit(next); setCaret(next.length, true); }} />}
    </View>
  );
}
const s = StyleSheet.create({
  modes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }, mode: { flexBasis: "23%", flexGrow: 1, minWidth: 130, minHeight: 48, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, justifyContent: "center" },
  modeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" }, language: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 6 },
  languages: { gap: 6, paddingVertical: 4 }, chip: { minHeight: 48, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" },
  hint: { fontSize: 13, lineHeight: 20, marginVertical: 5 }, voicePanel: { padding: 14, borderWidth: 1, borderRadius: 8, marginBottom: 12 },
  voiceHeading: { flexDirection: "row", alignItems: "center", gap: 8 }, title: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  record: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, paddingHorizontal: 16, marginTop: 8 },
  recordText: { color: Colors.white, fontSize: 14, fontFamily: "Inter_600SemiBold" }, disabled: { opacity: 0.5 }, edit: { minHeight: 48, justifyContent: "center", paddingVertical: 10 },
  textareaWrap: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 10 }, textarea: { minHeight: 136, fontSize: 15, lineHeight: 23, padding: 14, fontFamily: "Inter_400Regular" },
  preview: { minHeight: 136, paddingHorizontal: 14, paddingVertical: 10 }, toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6, paddingHorizontal: 10, paddingBottom: 8 },
  tools: { flexDirection: "row", alignItems: "center", gap: 6 }, voiceBottom: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  balance: { fontSize: 10 }, mic: { minHeight: 44, minWidth: 64, borderRadius: 8, paddingHorizontal: 10, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  micText: { color: Colors.white, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" }, candidates: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 10 },
  candidateBar: { flexDirection: "row", alignItems: "center", gap: 4 }, arrow: { minWidth: 44, minHeight: 48, justifyContent: "center", alignItems: "center" },
});
