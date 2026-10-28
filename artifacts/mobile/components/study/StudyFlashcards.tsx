import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { FLASHCARD_COLORS as F, flashcardType } from "@/constants/flashcardPalette";
import { STUDY_ACTION_COLORS } from "@/constants/studyActionColors";
import { useTheme } from "@/context/theme";
import type { Flashcard } from "@/services/api";
import { studyResources, type StudyAnswerContext } from "@/services/studyResources";

import { errMsg, type StudyRun } from "./studyRequests";

type Status = "idle" | "loading" | "error" | "ready";

const START = { x: 0, y: 0 };
const END = { x: 1, y: 1 };

function usable(res: unknown): res is Flashcard[] {
  return (
    Array.isArray(res) &&
    res.length > 0 &&
    res.every((c) => c && typeof c.front === "string" && c.front.trim() && typeof c.back === "string" && c.back.trim())
  );
}

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
  const [hFront, setHFront] = useState(0);
  const [hBack, setHBack] = useState(0);
  const rot = useRef(new Animated.Value(0)).current;
  const lock = useRef(false);
  const alive = useRef(true);
  const gen = useRef(0);
  const ctl = useRef<AbortController | null>(null);
  const ctxRef = useRef(context);
  ctxRef.current = context;
  const ctxKey = JSON.stringify([context.id, context.question, context.answer, context.orgSubdomain]);

  useEffect(() => {
    alive.current = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive.current && setReduce(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive.current = false;
      gen.current++;
      ctl.current?.abort();
      rot.stopAnimation();
      sub.remove();
    };
  }, []);

  const resetFace = useCallback(() => {
    rot.stopAnimation();
    rot.setValue(0);
    setFlipped(false);
  }, [rot]);

  // Protect against stale responses if the answer context changes while mounted.
  const firstKey = useRef(ctxKey);
  useEffect(() => {
    if (firstKey.current === ctxKey) return;
    firstKey.current = ctxKey;
    gen.current++;
    ctl.current?.abort();
    lock.current = false;
    setCards([]);
    setIndex(0);
    setMastered(new Set());
    resetFace();
    setError("");
    setStatus("idle");
  }, [ctxKey, resetFace]);

  const generate = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    const my = ++gen.current;
    const controller = new AbortController();
    const snapshot = ctxRef.current;
    ctl.current = controller;
    setCards([]);
    setIndex(0);
    setMastered(new Set());
    resetFace();
    setError("");
    setStatus("loading");
    const stale = () => !alive.current || controller.signal.aborted || my !== gen.current;
    try {
      const res = await run((t, signal) => studyResources.flashcards(t, snapshot, signal), controller);
      if (stale()) return;
      if (!usable(res)) {
        setError("No flashcards could be made from this answer. Please try again.");
        setStatus("error");
      } else {
        setCards(res);
        setStatus("ready");
      }
    } catch (e) {
      if (stale()) return;
      setError(errMsg(e, "Flashcard generation is temporarily unavailable. Please try again."));
      setStatus("error");
    } finally {
      if (my === gen.current) lock.current = false;
    }
  }, [run, resetFace]);

  useEffect(() => {
    if (open && status === "idle") generate();
  }, [open, status, generate]);

  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    rot.stopAnimation();
    if (reduce) {
      rot.setValue(next ? 1 : 0);
      return;
    }
    Animated.timing(rot, {
      toValue: next ? 1 : 0,
      duration: 550,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  };
  const go = (i: number) => {
    resetFace();
    setIndex(Math.max(0, Math.min(cards.length - 1, i)));
  };
  const toggleMastered = () =>
    setMastered((p) => {
      const n = new Set(p);
      if (n.has(index)) n.delete(index);
      else n.add(index);
      return n;
    });

  if (!open) return null;

  const muted = isDark ? "#9ca3af" : "#6b7280";
  const card = cards[index];
  const ty = card ? flashcardType(card.type) : flashcardType("concept");
  const total = cards.length;
  const pct = total ? (mastered.size / total) * 100 : 0;
  const isM = mastered.has(index);
  const faceH = Math.max(220, hFront, hBack);
  const frontRot = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRot = rot.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  // Reduce-motion: plain swap via opacity (no rotation travel).
  const frontOp = reduce ? (flipped ? 0 : 1) : 1;
  const backOp = reduce ? (flipped ? 1 : 0) : 1;

  const IconBtn = ({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} style={[s.icon, disabled && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={20} color={c.cards.text} />
    </Pressable>
  );

  return (
    <View style={[s.box, { backgroundColor: c.cards.bg, borderColor: c.cards.border }]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: c.cards.text }]}>Flashcard Practice</Text>
          {status === "ready" && total > 0 ? (
            <Text style={[s.sub, { color: muted }]}>{total} cards · {mastered.size} mastered</Text>
          ) : null}
        </View>
        <IconBtn icon="refresh" label="Regenerate flashcards" onPress={generate} disabled={status === "loading"} />
        <IconBtn icon="reload-circle-outline" label="Reset progress" onPress={() => { setMastered(new Set()); go(0); }} disabled={status !== "ready"} />
        <IconBtn icon="chevron-up" label="Collapse flashcards" onPress={onCollapse} />
      </View>

      {status === "loading" ? (
        <View accessibilityLiveRegion="polite">
          <LinearGradient colors={F.skeleton} start={START} end={END} style={[s.skel, { opacity: isDark ? 0.35 : 1 }]}>
            <View style={[s.skelBar, { width: "40%" }]} />
            <View style={[s.skelBar, { width: "80%", height: 18 }]} />
            <View style={[s.skelBar, { width: "60%", height: 18 }]} />
          </LinearGradient>
          <Text style={[s.small, { color: muted, marginTop: 8 }]}>Creating your study cards...</Text>
          <Text style={[s.small, { color: muted }]}>Generating… please keep this screen open.</Text>
        </View>
      ) : null}

      {status === "error" ? (
        <View accessibilityLiveRegion="polite">
          <Text style={s.err}>{error}</Text>
          <Text style={[s.small, { color: muted, marginBottom: 8 }]}>Please contact the EDUwAI team through in-app chat or the “Contact Us” section on the home page for help.</Text>
          <Pressable onPress={generate} accessibilityRole="button" accessibilityLabel="Retry flashcards" style={[s.nav, { borderColor: c.cards.border }]}>
            <Ionicons name="refresh" size={16} color={c.cards.text} />
            <Text style={[s.navText, { color: c.cards.text }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "ready" && card ? (
        <>
          <View style={s.progressTrack} accessibilityLabel={`${mastered.size} of ${total} mastered`}>
            <LinearGradient colors={F.progress} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[s.progressFill, { width: `${pct}%` }]} />
          </View>

          <Pressable
            onPress={flip}
            accessibilityRole="button"
            accessibilityLabel={`Card ${index + 1} of ${total}, ${flipped ? "answer" : ty.label + " question"}: ${flipped ? card.back : card.front}`}
            accessibilityHint={flipped ? "Double tap to flip back" : "Double tap to reveal answer"}
            style={{ height: faceH }}
          >
            <Animated.View
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              onLayout={(e) => setHFront(Math.ceil(e.nativeEvent.layout.height))}
              style={[s.faceWrap, { opacity: frontOp, transform: [{ perspective: 1200 }, { rotateY: frontRot }] }]}
            >
              <LinearGradient colors={[ty.from, ty.to]} start={START} end={END} style={[s.face, { minHeight: faceH }]}>
                <View style={s.faceTop}>
                  <View style={s.pill}><Text style={s.pillText}>{ty.icon} {ty.label}</Text></View>
                  <Text style={s.dim}>{index + 1} / {total}</Text>
                </View>
                <Text style={s.front}>{card.front}</Text>
                <Text style={[s.dim, s.center]}>Tap to reveal answer</Text>
              </LinearGradient>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              onLayout={(e) => setHBack(Math.ceil(e.nativeEvent.layout.height))}
              style={[s.faceWrap, { opacity: backOp, transform: [{ perspective: 1200 }, { rotateY: backRot }] }]}
            >
              <LinearGradient colors={[ty.to, ty.from]} start={START} end={END} style={[s.face, { minHeight: faceH }]}>
                <View style={s.faceTop}>
                  <View style={s.pill}><Text style={s.pillText}>✓ Answer</Text></View>
                  <Text style={s.dim}>{index + 1} / {total}</Text>
                </View>
                <Text style={s.back}>{card.back}</Text>
                <Text style={[s.dim, s.center]}>Tap to flip back</Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>

          <Pressable
            onPress={toggleMastered}
            accessibilityRole="checkbox"
            accessibilityLabel="Mastered"
            accessibilityState={{ checked: isM }}
            style={[s.nav, { marginTop: 10, borderColor: isM ? F.mastered : c.cards.border, backgroundColor: isM ? F.masteredBg : "transparent" }]}
          >
            <Text style={[s.navText, { color: isM ? F.masteredText : c.cards.text }]}>{isM ? "✓ Mastered" : "○ Mark Mastered"}</Text>
          </Pressable>

          <View style={s.navRow}>
            <Pressable onPress={() => go(index - 1)} disabled={index === 0} accessibilityRole="button" accessibilityLabel="Previous card" accessibilityState={{ disabled: index === 0 }} style={[s.nav, { flex: 1, borderColor: c.cards.border }, index === 0 && { opacity: 0.4 }]}>
              <Ionicons name="chevron-back" size={18} color={c.cards.text} />
              <Text style={[s.navText, { color: c.cards.text }]}>Prev</Text>
            </Pressable>
            <Pressable onPress={() => go(index + 1)} disabled={index >= total - 1} accessibilityRole="button" accessibilityLabel="Next card" accessibilityState={{ disabled: index >= total - 1 }} style={[s.nav, { flex: 1, borderColor: c.cards.border }, index >= total - 1 && { opacity: 0.4 }]}>
              <Text style={[s.navText, { color: c.cards.text }]}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color={c.cards.text} />
            </Pressable>
          </View>

          <View style={s.dots}>
            {cards.map((cd, i) => {
              const active = i === index;
              const m = mastered.has(i);
              const dt = flashcardType(cd.type);
              return (
                <Pressable
                  key={i}
                  onPress={() => go(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to card ${i + 1}${m ? ", mastered" : ""}`}
                  accessibilityState={{ selected: active }}
                  style={s.dotHit}
                >
                  {active ? (
                    <LinearGradient colors={[dt.from, dt.to]} start={START} end={END} style={s.dotActive} />
                  ) : (
                    <View style={m ? s.dotM : [s.dot, { backgroundColor: isDark ? F.dotDark : F.dotLight }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {mastered.size === total ? (
            <LinearGradient colors={F.progress} start={START} end={END} style={s.celebrate} accessibilityLiveRegion="polite">
              <Ionicons name="trophy" size={22} color={F.white} />
              <View style={{ flex: 1 }}>
                <Text style={s.celebTitle}>All {total} cards mastered</Text>
                <Text style={s.celebSub}>Regenerate for a fresh deck, or reset to practise again.</Text>
              </View>
            </LinearGradient>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  small: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  icon: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  skel: { minHeight: 220, borderRadius: 16, padding: 24, gap: 14, justifyContent: "center" },
  skelBar: { height: 12, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.6)" },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(148,163,184,0.25)", overflow: "hidden", marginBottom: 10 },
  progressFill: { height: 6, borderRadius: 3 },
  faceWrap: { position: "absolute", top: 0, left: 0, right: 0, backfaceVisibility: "hidden" },
  face: { borderRadius: 16, padding: 24, justifyContent: "space-between", gap: 14 },
  faceTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pill: { backgroundColor: F.pill, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  pillText: { color: F.white, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dim: { color: F.dim, fontSize: 12, fontFamily: "Inter_500Medium" },
  center: { textAlign: "center" },
  front: { color: F.white, fontSize: 20, lineHeight: 27.5, fontFamily: "Inter_700Bold", textAlign: "center", textShadowColor: "rgba(0,0,0,0.15)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  back: { color: F.white, fontSize: 18, lineHeight: 29.25, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  err: { color: F.error, fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
  nav: { minHeight: 48, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14 },
  navText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  navRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  dots: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 4 },
  dotHit: { minWidth: 30, minHeight: 44, alignItems: "center", justifyContent: "center" },
  dotActive: { width: 20, height: 10, borderRadius: 5 },
  dotM: { width: 10, height: 10, borderRadius: 5, backgroundColor: F.mastered },
  dot: { width: 8, height: 8, borderRadius: 4 },
  celebrate: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, marginTop: 8 },
  celebTitle: { color: F.white, fontSize: 15, fontFamily: "Inter_700Bold" },
  celebSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_400Regular" },
});
