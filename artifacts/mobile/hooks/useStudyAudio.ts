import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "@/context/auth";
import { ApiError } from "@/services/api";
import { studyResources, withStudyAuth, type ExplainQuota, type StudyAnswerContext, type StudyAudio } from "@/services/studyResources";

type Kind = "read" | "tutor";
export type StudyPlaybackState = "idle" | "loading" | "playing" | "paused" | "replay";
type AudioFile = { uri: string; dispose: () => Promise<void> };

async function storeAudio(audio: StudyAudio): Promise<AudioFile> {
  if (Platform.OS === "web") {
    const uri = URL.createObjectURL(new Blob([new Uint8Array(audio.bytes).buffer], { type: audio.mime }));
    return { uri, dispose: async () => URL.revokeObjectURL(uri) };
  }
  if (!FileSystem.cacheDirectory) throw new Error("Temporary audio storage is unavailable.");
  const suffix = audio.mime.includes("wav") || audio.mime === "audio/wave" ? "wav" : "mp3";
  const uri = `${FileSystem.cacheDirectory}study-audio-${Date.now()}-${Math.random().toString(36).slice(2)}.${suffix}`;
  let binary = "";
  for (let i = 0; i < audio.bytes.length; i += 8192) binary += String.fromCharCode(...audio.bytes.subarray(i, i + 8192));
  try {
    await FileSystem.writeAsStringAsync(uri, btoa(binary), { encoding: FileSystem.EncodingType.Base64 });
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    throw error;
  }
  return { uri, dispose: () => FileSystem.deleteAsync(uri, { idempotent: true }) };
}

/** One player, private downloaded bytes, no microphone access or persisted protected audio. */
export function useStudyAudio(context: StudyAnswerContext, accessToken: string) {
  const { refreshAccessToken } = useAuth();
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [readState, setReadState] = useState<StudyPlaybackState>("idle");
  const [tutorState, setTutorState] = useState<StudyPlaybackState>("idle");
  const [active, setActive] = useState<Kind | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generationRevision, setGenerationRevision] = useState(0);
  const [quotaDenied, setQuotaDenied] = useState<ExplainQuota | null>(null);
  const activeRef = useRef<Kind | null>(null);
  const files = useRef<Partial<Record<Kind, AudioFile>>>({});
  const states = useRef({ read: readState, tutor: tutorState });
  states.current = { read: readState, tutor: tutorState };
  const version = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stateFor = useCallback((kind: Kind, value: StudyPlaybackState) => {
    states.current[kind] = value;
    (kind === "read" ? setReadState : setTutorState)(value);
  }, []);
  const clearStartTimer = useCallback(() => {
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = null;
  }, []);
  const stop = useCallback(() => {
    version.current++;
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
    clearStartTimer();
    try { player.pause(); void player.seekTo(0).catch(() => {}); } catch {}
    const kind = activeRef.current;
    if (kind) stateFor(kind, kind === "tutor" && files.current.tutor ? "replay" : "idle");
    activeRef.current = null;
    setActive(null);
  }, [player, stateFor, clearStartTimer]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state !== "active") stop();
    });
    const hidden = () => { if (document.hidden) stop(); };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", hidden);
    return () => {
      sub.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", hidden);
      version.current++;
      controller.current?.abort();
      clearStartTimer();
      try { player.pause(); } catch {}
      // useAudioPlayer releases the native player on unmount.
      Object.values(files.current).forEach(file => { void file?.dispose().catch(() => {}); });
      files.current = {};
    };
  }, [player, stop, clearStartTimer]);

  useEffect(() => {
    const kind = activeRef.current;
    if (!kind) return;
    if (status.playbackState === "error") {
      stop();
      setError("Audio playback failed. Tap the audio action to retry the downloaded file.");
    } else if (status.playing) {
      clearStartTimer();
      stateFor(kind, "playing");
    } else if (status.didJustFinish && states.current[kind] !== "loading") {
      clearStartTimer();
      activeRef.current = null;
      setActive(null);
      stateFor(kind, kind === "tutor" ? "replay" : "idle");
    } else if (states.current[kind] === "playing") {
      stateFor(kind, "paused"); // Includes OS interruptions / disconnected headphones.
    }
  }, [status.playing, status.didJustFinish, status.playbackState, stateFor, stop, clearStartTimer]);

  const operate = useCallback(async (kind: Kind) => {
    const other = kind === "read" ? "tutor" : "read";
    if (busy.current || (activeRef.current === other
      && (kind === "tutor" || states.current[other] !== "paused"))) return;
    const state = states.current[kind];
    if (activeRef.current === kind && state === "playing") {
      player.pause();
      stateFor(kind, "paused");
      return;
    }
    if (activeRef.current === other) stop();
    const current = ++version.current;
    const ctrl = new AbortController();
    controller.current = ctrl;
    const valid = () => current === version.current && !ctrl.signal.aborted;
    busy.current = true;
    setError(null);
    activeRef.current = kind;
    setActive(kind);
    stateFor(kind, "loading");
    try {
      if (!files.current[kind]) {
        const audio = await withStudyAuth(accessToken, refreshAccessToken, token =>
          studyResources.audio(token, kind, context.answer, context.language, ctrl.signal));
        if (!valid()) return;
        // Generation may consume quota even if storage or playback later fails.
        if (kind === "tutor") {
          setTranscript(audio.transcript);
          setGenerationRevision(revision => revision + 1);
        }
        const file = await storeAudio(audio);
        if (!valid()) { await file.dispose(); return; }
        files.current[kind] = file;
      }
      if (Platform.OS !== "web") await setAudioModeAsync({
        playsInSilentMode: true, shouldPlayInBackground: false,
        interruptionMode: "doNotMix", shouldRouteThroughEarpiece: false,
      });
      if (!valid()) return;
      if (state !== "paused") {
        player.replace({ uri: files.current[kind]!.uri });
      }
      player.play();
      // "Pause" is shown only after actual playback starts, not merely after download.
      startTimer.current = setTimeout(() => {
        if (!valid() || states.current[kind] === "playing") return;
        stop();
        setError("Audio could not start. Tap the audio action to retry playback; no new generation is needed.");
      }, 15_000);
    } catch (failure) {
      if (!valid()) return;
      if (kind === "tutor") {
        setGenerationRevision(revision => revision + 1);
        if (failure instanceof ApiError && failure.statusCode === 429) {
          const detail = (failure.data as { detail?: { quota_exceeded?: boolean; explains_used?: number; explain_limit?: number } })?.detail;
          const used = detail?.explains_used;
          const limit = detail?.explain_limit;
          if (detail?.quota_exceeded && typeof used === "number" && Number.isFinite(used) && used >= 0
            && typeof limit === "number" && Number.isFinite(limit) && limit >= 0) {
            setQuotaDenied({ allowed: false, used, limit, remaining: Math.max(0, limit - used) });
          }
        }
      }
      stateFor(kind, kind === "tutor" && files.current.tutor ? "replay" : "idle");
      activeRef.current = null;
      setActive(null);
      setError(failure instanceof Error ? failure.message : "Could not load audio. Please try again.");
    } finally {
      if (current === version.current) busy.current = false;
    }
  }, [accessToken, context.answer, context.language, refreshAccessToken, player, stateFor, stop]);

  return {
    readState, tutorState, active, transcript, error, generationRevision, quotaDenied,
    read: () => operate("read"), tutor: () => operate("tutor"), stop,
  };
}
