import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { RecordingPresets, useAudioRecorder } from "expo-audio";
import { useAuth } from "@/context/auth";
import api, { ApiError } from "@/services/api";
import { withStudyAuth } from "@/services/studyResources";
import { voiceDuration, type VoiceQuestionUsage } from "@/services/inputModes";
import { MicrophonePermissionError, startVoiceCapture, voiceFormData, type VoiceCapture, type VoiceFile } from "@/services/voiceCapture";

type Phase = "idle" | "preparing" | "recording" | "transcribing";
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 };
export function useVoiceQuestion(scope: string, onTranscript: (text: string) => void) {
  const { accessToken, refreshAccessToken, user } = useAuth();
  const auth = useRef({ accessToken, refreshAccessToken }); auth.current = { accessToken, refreshAccessToken };
  const transcript = useRef(onTranscript); transcript.current = onTranscript;
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [usage, setUsage] = useState<VoiceQuestionUsage | null>(null);
  const [usageError, setUsageError] = useState("");
  const [error, setError] = useState("");
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [language, setLanguage] = useState("");
  const mounted = useRef(true), focused = useRef(false), sequence = useRef(0), lock = useRef(false);
  const lockOwner = useRef(0), previousScope = useRef(`${scope}:${user?.id}`);
  const phaseRef = useRef<Phase>("idle"), usageRef = useRef<VoiceQuestionUsage | null>(null);
  const capture = useRef<VoiceCapture | null>(null), controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0), quotaSequence = useRef(0);
  const quotaRequest = useRef<Promise<VoiceQuestionUsage | null> | null>(null);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const cancelRef = useRef<() => void>(() => {});
  const recorder = useAudioRecorder(OPTIONS, status => {
    if (Platform.OS === "web") return;
    if (status.hasError && phaseRef.current === "recording") {
      cancelRef.current();
      if (mounted.current) setError("Recording was interrupted. Please record your question again.");
    } else if (status.isFinished && phaseRef.current === "recording") void stopRef.current();
  });
  const updatePhase = useCallback((value: Phase) => {
    phaseRef.current = value;
    if (mounted.current) setPhase(value);
  }, []);
  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);
  const refreshUsage = useCallback(async (): Promise<VoiceQuestionUsage | null> => {
    if (!auth.current.accessToken) return null;
    if (quotaRequest.current) return quotaRequest.current;
    const revision = ++quotaSequence.current;
    const pending = withStudyAuth(auth.current.accessToken, auth.current.refreshAccessToken, token => api.study.getVoiceQuestionUsage(token))
      .then(value => {
        if (typeof value.allowed !== "boolean" || ![value.used, value.limit, value.remaining].every(n => typeof n === "number" && Number.isFinite(n))) {
          throw new Error("Unexpected allowance response");
        }
        if (mounted.current && revision === quotaSequence.current) {
          usageRef.current = value; setUsage(value); setUsageError("");
        }
        return value;
      }).catch(() => {
        if (mounted.current && revision === quotaSequence.current) setUsageError("Voice allowance could not be refreshed. The server will check it when you transcribe.");
        return null;
      }).finally(() => { if (quotaRequest.current === pending) quotaRequest.current = null; });
    quotaRequest.current = pending;
    return pending;
  }, []);
  const cancel = useCallback(() => {
    const owner = sequence.current;
    sequence.current++;
    controller.current?.abort(); controller.current = null;
    clearTimer();
    const wasUploading = phaseRef.current === "transcribing";
    const activeCapture = capture.current; capture.current = null;
    updatePhase("idle");
    if (mounted.current) { setReady(false); setLanguage(""); setSeconds(0); }
    if (activeCapture) void activeCapture.cancel().finally(() => { if (lockOwner.current === owner) lock.current = false; });
    if (wasUploading) void refreshUsage();
  }, [clearTimer, refreshUsage, updatePhase]);
  cancelRef.current = cancel;
  const stop = useCallback(async () => {
    if (phaseRef.current !== "recording" || !capture.current || !controller.current) return;
    const revision = sequence.current, activeCapture = capture.current, ctrl = controller.current;
    const valid = () => mounted.current && revision === sequence.current;
    const duration = voiceDuration((Date.now() - started.current) / 1000);
    clearTimer(); updatePhase("transcribing");
    let file: VoiceFile | null = null, deadline: ReturnType<typeof setTimeout> | null = null, timedOut = false;
    try {
      file = await activeCapture.stop();
      if (!valid()) return;
      const token = auth.current.accessToken;
      if (!token) throw new Error("Please sign in again to transcribe your question.");
      const form = voiceFormData(file, duration);
      deadline = setTimeout(() => { timedOut = true; ctrl.abort(); }, 120_000);
      const result = await withStudyAuth(token, auth.current.refreshAccessToken, fresh => {
        if (ctrl.signal.aborted) throw new Error("Transcription cancelled");
        return api.study.transcribeVoiceQuestion(fresh, form, ctrl.signal);
      });
      if (!valid() || ctrl.signal.aborted) return;
      if (typeof result.transcript !== "string" || !result.transcript.trim()) throw new Error("No speech was detected. Please record your question again.");
      if (!result.voice_question_usage || typeof result.voice_question_usage.allowed !== "boolean") throw new Error("The transcription returned an unexpected allowance response. Please check your usage before recording again.");
      quotaSequence.current++;
      const nextUsage = { ...result.voice_question_usage, period_end: usageRef.current?.period_end };
      usageRef.current = nextUsage; setUsage(nextUsage); setUsageError("");
      transcript.current(result.transcript.trim()); setReady(true);
      setLanguage(typeof result.detected_language === "string" && result.detected_language.trim() ? result.detected_language.trim() : "und");
    } catch (failure) {
      if (valid()) {
        const incomplete = failure instanceof ApiError && Array.isArray((failure.data as { detail?: unknown })?.detail);
        setError(timedOut ? "Transcription timed out and may have used an allowance. Check your balance before making a new recording."
          : incomplete ? "The voice recording upload was incomplete. Please record your question again."
          : failure instanceof Error ? failure.message : "Could not transcribe your question. Please try a new recording.");
        void refreshUsage();
      }
    } finally {
      if (deadline) clearTimeout(deadline);
      await file?.dispose().catch(() => {});
      if (capture.current === activeCapture) capture.current = null;
      if (lockOwner.current === revision) lock.current = false;
      if (valid()) updatePhase("idle");
    }
  }, [clearTimer, refreshUsage, updatePhase]);
  stopRef.current = stop;
  const start = useCallback(async () => {
    if (lock.current || phaseRef.current !== "idle") return;
    if (usageRef.current?.allowed === false) { setError("Your voice-question allowance is exhausted for this billing period. You can still type your question."); return; }
    lock.current = true;
    const revision = ++sequence.current, ctrl = new AbortController(); controller.current = ctrl;
    lockOwner.current = revision;
    const valid = () => mounted.current && revision === sequence.current && !ctrl.signal.aborted;
    let beganRecording = false;
    setReady(false); setLanguage(""); setError(""); setPermissionBlocked(false); setSeconds(0); updatePhase("preparing");
    try {
      const currentUsage = await refreshUsage();
      if (!valid()) return;
      if (currentUsage?.allowed === false) throw new Error("Your voice-question allowance is exhausted for this billing period. You can still type your question.");
      const currentCapture = await startVoiceCapture(recorder, ctrl.signal, () => {
        if (valid() && phaseRef.current === "recording") { cancelRef.current(); setError("Recording was interrupted. Please record your question again."); }
      });
      if (!valid()) { await currentCapture.cancel(); return; }
      capture.current = currentCapture;
      started.current = Date.now(); beganRecording = true; updatePhase("recording");
      timer.current = setInterval(() => {
        if (!valid()) return;
        const elapsed = (Date.now() - started.current) / 1000;
        setSeconds(Math.min(60, Math.floor(elapsed)));
        if (elapsed >= 59.75) void stopRef.current();
      }, 250);
    } catch (failure) {
      if (valid()) {
        setPermissionBlocked(failure instanceof MicrophonePermissionError && failure.permanent);
        setError(failure instanceof Error ? failure.message : "Could not start recording. Please try again.");
      }
    } finally {
      if (!beganRecording || !valid()) {
        if (lockOwner.current === revision) lock.current = false;
        if (valid()) updatePhase("idle");
      }
    }
  }, [recorder, refreshUsage, updatePhase]);
  useFocusEffect(useCallback(() => {
    focused.current = true; void refreshUsage();
    return () => { focused.current = false; cancel(); };
  }, [cancel, refreshUsage]));
  useEffect(() => {
    mounted.current = true;
    const poll = setInterval(() => { if (focused.current && AppState.currentState === "active") void refreshUsage(); }, 60_000);
    const activity = AppState.addEventListener("change", state => {
      if (state === "background" || (state === "inactive" && phaseRef.current === "recording")) cancel();
      if (state === "active" && focused.current) void refreshUsage();
    });
    const visibility = () => { if (document.hidden) cancel(); else if (focused.current) void refreshUsage(); };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false; quotaSequence.current++; clearInterval(poll); activity.remove(); cancel();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", visibility);
    };
  }, [cancel, refreshUsage]);
  useEffect(() => {
    const nextScope = `${scope}:${user?.id}`;
    if (nextScope === previousScope.current) return;
    previousScope.current = nextScope;
    cancel(); quotaSequence.current++; quotaRequest.current = null;
    usageRef.current = null; setUsage(null); setError(""); setUsageError(""); void refreshUsage();
  }, [scope, user?.id, cancel, refreshUsage]);
  return { phase, seconds, usage, usageError, error, permissionBlocked, ready, language, start, stop, cancel, clearError: () => setError("") };
}
