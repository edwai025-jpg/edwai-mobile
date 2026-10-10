import { Platform } from "react-native";
import { requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import type { AudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { MAX_VOICE_BYTES } from "./inputModes";

export type VoiceFile = { file: Blob | { uri: string; type: string; name: string }; size: number; dispose: () => Promise<void> };
export type VoiceCapture = { stop: () => Promise<VoiceFile>; cancel: () => Promise<void> };
export class MicrophonePermissionError extends Error {
  constructor(public permanent: boolean) { super(permanent ? "Microphone access is blocked. Enable it in Settings, or type your question." : "Microphone permission was denied. You can try again or type your question."); }
}
function aborted() { return Object.assign(new Error("Recording cancelled"), { name: "AbortError" }); }
function validateSize(size: number) {
  if (!size) throw new Error("The recording was empty. Please record your question again.");
  if (size > MAX_VOICE_BYTES) throw new Error("The recording exceeds 10 MB. Please record a shorter question.");
}
export async function startVoiceCapture(recorder: AudioRecorder, signal: AbortSignal, onInterrupted?: () => void): Promise<VoiceCapture> {
  if (signal.aborted) throw aborted();
  if (Platform.OS === "web") {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Voice recording is not supported in this browser. Please type your question.");
    }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { throw new MicrophonePermissionError(false); }
    const interrupted = () => onInterrupted?.();
    stream.getTracks().forEach(track => track.addEventListener("ended", interrupted));
    const release = () => stream.getTracks().forEach(track => { track.removeEventListener("ended", interrupted); track.stop(); });
    if (signal.aborted) { release(); throw aborted(); }
    let recording: MediaRecorder;
    try { recording = new MediaRecorder(stream); }
    catch {
      const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus"].find(mime => MediaRecorder.isTypeSupported(mime));
      if (!mimeType) { release(); throw new Error("This browser cannot record a supported audio format. Please type your question."); }
      try { recording = new MediaRecorder(stream, { mimeType }); } catch (error) { release(); throw error; }
    }
    const chunks: Blob[] = [];
    let finish: Promise<VoiceFile> | null = null;
    recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recording.onerror = interrupted;
    try { recording.start(); } catch (error) { release(); throw error; }
    const stop = () => finish ??= new Promise<VoiceFile>((resolve, reject) => {
      recording.onstop = () => {
        release();
        const blob = new Blob(chunks, { type: recording.mimeType || chunks[0]?.type || "audio/webm" });
        try { validateSize(blob.size); resolve({ file: blob, size: blob.size, dispose: async () => {} }); }
        catch (error) { reject(error); }
      };
      recording.onerror = () => { release(); reject(new Error("Recording failed. Please try a new recording.")); };
      try { recording.stop(); } catch (error) { release(); reject(error); }
    });
    return { stop, cancel: async () => { release(); await stop().then(file => file.dispose()).catch(() => {}); } };
  }
  const permission = await requestRecordingPermissionsAsync();
  if (signal.aborted) throw aborted();
  if (!permission.granted) throw new MicrophonePermissionError(!permission.canAskAgain);
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
  try {
    await recorder.prepareToRecordAsync();
    if (signal.aborted) { await recorder.stop().catch(() => {}); throw aborted(); }
    recorder.record({ forDuration: 60 });
  } catch (error) {
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (recorder.uri) await FileSystem.deleteAsync(recorder.uri, { idempotent: true }).catch(() => {});
    throw error;
  }
  let finish: Promise<VoiceFile> | null = null;
  const stop = () => finish ??= (async () => {
    try {
      if (recorder.isRecording || !recorder.uri) await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("The recording could not be finalized. Please try again.");
      const dispose = () => FileSystem.deleteAsync(uri, { idempotent: true });
      const info = await FileSystem.getInfoAsync(uri);
      const size = info.exists && !info.isDirectory ? info.size : 0;
      try { validateSize(size); } catch (error) { await dispose().catch(() => {}); throw error; }
      return { file: { uri, type: "audio/mp4", name: "voice-question.m4a" }, size, dispose };
    } finally { await setAudioModeAsync({ allowsRecording: false }).catch(() => {}); }
  })();
  return { stop, cancel: async () => { await stop().then(file => file.dispose()).catch(() => {}); } };
}
export function voiceFormData(file: VoiceFile, duration: number): FormData {
  const form = new FormData();
  if (!("uri" in file.file)) {
    const extension = file.file.type.includes("mp4") ? "m4a" : file.file.type.includes("ogg") ? "ogg" : "webm";
    form.append("audio", file.file, `voice-question.${extension}`);
  } else {
    const nativeFile = file.file;
    // Expo 57's default fetch encoder cannot upload legacy URI-only parts.
    // Keep the MIME/name while exposing the actual cached file bytes.
    form.append("audio", {
      name: nativeFile.name,
      type: nativeFile.type,
      bytes: () => new File(nativeFile.uri).bytes(),
    } as unknown as Blob);
  }
  form.append("duration_seconds", String(duration));
  return form;
}
