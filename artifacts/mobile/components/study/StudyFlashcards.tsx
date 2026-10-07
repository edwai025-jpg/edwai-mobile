import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { STUDY_ACTION_COLORS } from "@/constants/studyActionColors";
import { useTheme } from "@/context/theme";
import type { Flashcard } from "@/services/api";
import { studyResources, type StudyAnswerContext } from "@/services/studyResources";

import { errMsg, type StudyRun } from "./studyRequests";

type Status = "idle" | "loading" | "error" | "ready";

export default function StudyFlashcards({
  context,
  run,
  open,
  onCollapse,
}: {
  context: StudyAnswerContext;
  run: StudyRun;
  open: boolean;
  onCollapse: () => void;
}) {
  const { isDark } = useTheme();
  const c = STUDY_ACTION_COLORS[isDark ? "dark" : "light"];
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [mastered, setMastered] = useState<Set<number>>(new Set());
  const [flipped, setFlipped] = useState(false);
  const [reduce, setReduce] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const lock = useRef(false);
  const alive = useRef(true);
  const ctl = useRef<AbortController | null>(null);
  const ctxRef = useRef(context);
  ctxRef.current = context;

  useEffect(() => {
    alive.current = true;
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive.current = false;
      ctl.current?.abort();
      scale.stopAnimation();
      sub.remove();
    };
  }, []);

  const generate = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    const controller = new AbortController();
    ctl.current = controller;
    setStatus("loading");
    setError("");
    try {
      const res = await run((t, signal) => studyResources.flashcards(t, ctxRef.current, signal), controller);
      if (!alive.current || controller.signal.aborted) return;
      if (!res || res.length === 0) {
        setError("No flashcards could be made from this answer.");
        setStatus("error");
      } else {
        setCards(res);
        setIndex(0);
        setMastered(new Set());
        setFlipped(false);
        setStatus("ready");
      }
    } catch (e) {
      if (!alive.current || controller.signal.aborted) return;
      setError(errMsg(e, "Flashcards took too long or failed. Please try again."));
      setStatus("error");
    } finally {
      lock.current = false;
    }
  }, [run]);

  useEffect(() => {
    if (open && status === "idle") generate();
  }, [open, status, generate]);

  const flip = () => {
    if (reduce) {
      setFlipped((f) => !f);
      return;
    }
    scale.stopAnimation();
    Animated.timing(scale, { toValue: 0, duration: 120, useNativeDriver: true }).start(({ finished }) => {
      if (!finished || !alive.current) return;
      setFlipped((f) => !f);
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    });
  };
  const go = (i: number) => {
    scale.stopAnimation();
    scale.setValue(1);
    setIndex(i);
    setFlipped(false);
  };
  const toggleMastered = () =>
    setMastered((p) => {
      const n = new Set(p);
      if (n.has(index)) n.delete(index);
      else n.add(index);
      return n;
    });

  if (!open) return null;

  const text = isDark ? "#f3f4f6" : "#1f2937";
  const muted = isDark ? "#9ca3af" : "#6b7280";
  const wrap = { backgroundColor: c.cards.bg, borderColor: c.cards.border };
  const card = cards[index];
  const IconBtn = ({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} style={[s.icon, disabled && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={20} color={c.cards.text} />
    </Pressable>
  );

  return (
    <View style={[s.box, wrap]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: c.cards.text }]}>Flashcard Practice</Text>
          {status === "ready" ? (
            <Text style={[s.small, { color: muted }]}>{cards.length} cards · {mastered.size} mastered</Text>
          ) : null}
        </View>
        <IconBtn icon="refresh" label="Regenerate flashcards" onPress={generate} disabled={status === "loading"} />
        <IconBtn icon="reload-circle-outline" label="Reset progress" onPress={() => { setMastered(new Set()); go(0); }} disabled={status !== "ready"} />
        <IconBtn icon="chevron-up" label="Collapse flashcards" onPress={onCollapse} />
      </View>

      {status === "loading" ? (
        <View accessibilityLiveRegion="polite">
          <View style={[s.face, { backgroundColor: c.cards.border, opacity: 0.5 }]} />
          <Text style={[s.small, { color: muted, marginTop: 8 }]}>Creating your study cards… this can take up to a minute.</Text>
        </View>
      ) : null}

      {status === "error" ? (
        <View accessibilityLiveRegion="polite">
          <Text style={s.err}>{error}</Text>
          <Pressable onPress={generate} accessibilityRole="button" style={[s.nav, { borderColor: c.cards.border }]}>
            <Text style={[s.navText, { color: c.cards.text }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "ready" && card ? (
        <>
          <Pressable
            onPress={flip}
            accessibilityRole="button"
            accessibilityLabel={`Card ${index + 1} of ${cards.length}, ${flipped ? "answer" : "question"}: ${flipped ? card.back : card.front}. Double tap to flip.`}
          >
            <Animated.View style={[s.face, { backgroundColor: isDark ? "#1f1a3a" : "#ffffff", borderColor: c.cards.border, transform: [{ scaleX: scale }] }]}>
              <Text style={[s.type, { color: c.cards.text }]}>{flipped ? "ANSWER" : String(card.type).toUpperCase()} · {index + 1}/{cards.length}</Text>
              <Text style={[flipped ? s.back : s.front, { color: text }]}>{flipped ? card.back : card.front}</Text>
              <Text style={[s.small, { color: muted }]}>{flipped ? "Tap to see question" : "Tap to reveal answer"}</Text>
            </Animated.View>
          </Pressable>
          <Pressable
            onPress={toggleMastered}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: mastered.has(index) }}
            style={[s.nav, { borderColor: mastered.has(index) ? "#10b981" : c.cards.border, marginTop: 10 }]}
          >
            <Ionicons name={mastered.has(index) ? "checkmark-circle" : "ellipse-outline"} size={18} color={mastered.has(index) ? "#10b981" : c.cards.text} />
            <Text style={[s.navText, { color: mastered.has(index) ? "#10b981" : c.cards.text }]}>{mastered.has(index) ? "Mastered" : "Mark mastered"}</Text>
          </Pressable>
          <View style={s.navRow}>
            <Pressable onPress={() => go(index - 1)} disabled={index === 0} accessibilityRole="button" accessibilityLabel="Previous card" style={[s.nav, { flex: 1, borderColor: c.cards.border }, index === 0 && { opacity: 0.4 }]}>
              <Ionicons name="chevron-back" size={18} color={c.cards.text} />
              <Text style={[s.navText, { color: c.cards.text }]}>Prev</Text>
            </Pressable>
            <Pressable onPress={() => go(index + 1)} disabled={index >= cards.length - 1} accessibilityRole="button" accessibilityLabel="Next card" style={[s.nav, { flex: 1, borderColor: c.cards.border }, index >= cards.length - 1 && { opacity: 0.4 }]}>
              <Text style={[s.navText, { color: c.cards.text }]}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color={c.cards.text} />
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  small: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  icon: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  face: { minHeight: 180, borderRadius: 12, borderWidth: 1, padding: 16, justifyContent: "space-between", gap: 10 },
  type: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  front: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 24 },
  back: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  err: { color: "#e11d48", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
  nav: { minHeight: 48, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14 },
  navText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  navRow: { flexDirection: "row", gap: 8, marginTop: 8 },
});
