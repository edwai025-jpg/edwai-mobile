import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/context/theme";
import api, { Flashcard } from "@/services/api";

/* ─── Type config ─────────────────────────────────────────────────────────── */
const TYPE_CONFIG: Record<
  Flashcard["type"],
  { front: [string, string]; back: [string, string]; icon: string }
> = {
  definition: { front: ["#667eea", "#764ba2"], back: ["#764ba2", "#667eea"], icon: "📖" },
  concept:    { front: ["#0ea5e9", "#2563eb"], back: ["#2563eb", "#0ea5e9"], icon: "💡" },
  process:    { front: ["#10b981", "#0d9488"], back: ["#0d9488", "#10b981"], icon: "⚙️" },
  fact:       { front: ["#f59e0b", "#ef4444"], back: ["#ef4444", "#f59e0b"], icon: "⚡" },
  diagram:    { front: ["#ec4899", "#8b5cf6"], back: ["#8b5cf6", "#ec4899"], icon: "🖼️" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type as Flashcard["type"]] ?? TYPE_CONFIG.concept;
}

/* ─── Animated skeleton ──────────────────────────────────────────────────── */
function LoadingSkeleton() {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[sk.wrap, { opacity: pulse }]}>
      <LinearGradient colors={["#667eea", "#764ba2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sk.gradient}>
        <View style={sk.badgePh} />
        <View style={sk.line1} />
        <View style={sk.line2} />
        <Text style={sk.label}>Creating your study cards...</Text>
      </LinearGradient>
    </Animated.View>
  );
}
const sk = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: "hidden", minHeight: 220, marginTop: 4 },
  gradient: { minHeight: 220, padding: 20, justifyContent: "space-between" },
  badgePh: { width: 90, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.25)" },
  line1: { height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.25)", width: "80%", marginTop: 24 },
  line2: { height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.18)", width: "55%", marginTop: 10 },
  label: { fontSize: 12, color: "rgba(255,255,255,0.7)", textAlign: "center", fontFamily: "Inter_500Medium" },
});

/* ─── Flip card ──────────────────────────────────────────────────────────── */
function FlipCard({ card, index, total }: { card: Flashcard; index: number; total: number }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    setIsFlipped(false);
  }, [index]);

  const flip = () => {
    Animated.timing(anim, {
      toValue: isFlipped ? 0 : 1,
      duration: 550,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const frontRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate  = anim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const cfg = getTypeConfig(card.type);

  return (
    <Pressable onPress={flip} style={fc.wrapper}>
      <Animated.View style={[fc.face, { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}>
        <LinearGradient colors={cfg.front} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fc.gradient}>
          <View style={fc.topRow}>
            <View style={fc.badge}>
              <Text style={fc.badgeText}>{cfg.icon}  {card.type.toUpperCase()}</Text>
            </View>
            <Text style={fc.counter}>{index + 1} / {total}</Text>
          </View>
          <View style={fc.body}>
            <Text style={fc.frontText}>{card.front}</Text>
          </View>
          <Text style={fc.hint}>Tap to reveal answer ↓</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[fc.face, fc.faceAbsolute, { transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}>
        <LinearGradient colors={cfg.back} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fc.gradient}>
          <View style={fc.topRow}>
            <View style={fc.badge}>
              <Text style={fc.badgeText}>✓ Answer</Text>
            </View>
            <Text style={fc.counter}>{index + 1} / {total}</Text>
          </View>
          <View style={fc.body}>
            <Text style={fc.backText}>{card.back}</Text>
          </View>
          <Text style={fc.hint}>Tap to flip back ↑</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}
const fc = StyleSheet.create({
  wrapper:      { minHeight: 220 },
  face:         { borderRadius: 16, overflow: "hidden", backfaceVisibility: "hidden", minHeight: 220 },
  faceAbsolute: { position: "absolute", top: 0, left: 0, right: 0 },
  gradient:     { minHeight: 220, padding: 20, justifyContent: "space-between" },
  topRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge:        { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:    { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  counter:      { fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium" },
  body:         { flex: 1, justifyContent: "center", paddingVertical: 14 },
  frontText:    { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 24 },
  backText:     { fontSize: 14, fontFamily: "Inter_400Regular", color: "#fff", lineHeight: 22 },
  hint:         { fontSize: 11, color: "rgba(255,255,255,0.65)", textAlign: "center", fontFamily: "Inter_400Regular" },
});

/* ─── Main component ─────────────────────────────────────────────────────── */
type Status = "idle" | "loading" | "ready";

type Props = {
  question: string;
  answer: string;
  accessToken: string;
};

export default function FlashcardsSection({ question, answer, accessToken }: Props) {
  const { isDark } = useTheme();
  const [status, setStatus]         = useState<Status>("idle");
  const [cards, setCards]           = useState<Flashcard[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mastered, setMastered]     = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed]   = useState(false);

  useEffect(() => {
    setStatus("idle");
    setCards([]);
    setActiveIndex(0);
    setMastered(new Set());
    setCollapsed(false);
  }, [answer]);

  const generate = async () => {
    if (!question || !answer) return;
    setStatus("loading");
    setActiveIndex(0);
    setMastered(new Set());
    try {
      const res = await api.study.generateFlashcards(accessToken, question, answer);
      setCards(res.flashcards ?? []);
      setStatus(res.flashcards?.length ? "ready" : "idle");
    } catch {
      setStatus("idle");
    }
  };

  const toggleMastered = (i: number) => {
    setMastered((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  /* ── theme tokens ── */
  const cardBg       = isDark ? "rgba(255,255,255,0.05)" : "#ffffff";
  const cardBorder   = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const titleColor   = isDark ? "#ffffff" : "#111827";
  const subtitleColor = isDark ? "#9ca3af" : "#6b7280";
  const navBg        = isDark ? "rgba(255,255,255,0.10)" : "#f3f4f6";
  const navText      = isDark ? "#ffffff" : "#374151";
  const trackBg      = isDark ? "rgba(255,255,255,0.10)" : "#f3f4f6";
  const dotInactive  = isDark ? "rgba(255,255,255,0.22)" : "#d1d5db";

  const masteredCount = mastered.size;
  const allMastered   = cards.length > 0 && masteredCount === cards.length;

  /* ── idle: Generate button ── */
  if (status === "idle") {
    return (
      <Pressable onPress={generate} style={gen.btn}>
        <LinearGradient colors={["#667eea", "#764ba2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={gen.gradient}>
          <Text style={gen.icon}>🃏</Text>
          <Text style={gen.label}>Generate Flashcards</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  /* ── loading: skeleton ── */
  if (status === "loading") {
    return (
      <View style={[fs.container, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={fs.headerRow}>
          <View style={fs.headerLeft}>
            <LinearGradient colors={["#8b5cf6", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fs.iconBox}>
              <Text style={{ fontSize: 16 }}>🃏</Text>
            </LinearGradient>
            <Text style={[fs.title, { color: titleColor }]}>Flashcards</Text>
          </View>
        </View>
        <LoadingSkeleton />
      </View>
    );
  }

  /* ── ready: full deck ── */
  const card = cards[activeIndex];

  return (
    <View style={[fs.container, { backgroundColor: cardBg, borderColor: cardBorder }]}>

      {/* Header */}
      <View style={fs.headerRow}>
        <View style={fs.headerLeft}>
          <LinearGradient colors={["#8b5cf6", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fs.iconBox}>
            <Text style={{ fontSize: 16 }}>🃏</Text>
          </LinearGradient>
          <View>
            <Text style={[fs.title, { color: titleColor }]}>Flashcards</Text>
            <Text style={[fs.subtitle, { color: subtitleColor }]}>
              {cards.length} card{cards.length !== 1 ? "s" : ""} · {masteredCount} mastered
            </Text>
          </View>
        </View>
        <View style={fs.headerActions}>
          <Pressable onPress={generate} style={[fs.actionBtn, { backgroundColor: navBg }]}>
            <Text style={[fs.actionBtnText, { color: navText }]}>↺</Text>
          </Pressable>
          <Pressable onPress={() => setCollapsed((v) => !v)} style={[fs.actionBtn, { backgroundColor: navBg }]}>
            <Text style={[fs.actionBtnText, { color: navText }]}>{collapsed ? "▼" : "▲"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[fs.progressTrack, { backgroundColor: trackBg }]}>
        {masteredCount > 0 && (
          <LinearGradient
            colors={["#10b981", "#3b82f6"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[fs.progressFill, { width: `${(masteredCount / cards.length) * 100}%` as `${number}%` }]}
          />
        )}
      </View>

      {!collapsed && (
        <>
          {/* Celebration */}
          {allMastered && (
            <LinearGradient colors={["#10b981", "#3b82f6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fs.celebration}>
              <Text style={fs.celebrationText}>🎉 You've mastered all {cards.length} cards! Great work!</Text>
            </LinearGradient>
          )}

          {/* Card */}
          <FlipCard card={card} index={activeIndex} total={cards.length} />

          {/* Mastered toggle */}
          <Pressable
            onPress={() => toggleMastered(activeIndex)}
            style={[
              fs.masteredBtn,
              { borderColor: isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb", backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f9fafb" },
              mastered.has(activeIndex) && fs.masteredBtnOn,
            ]}
          >
            <Text style={[fs.masteredText, { color: isDark ? "#9ca3af" : "#6b7280" }, mastered.has(activeIndex) && fs.masteredTextOn]}>
              {mastered.has(activeIndex) ? "✓  Mastered" : "○  Mark Mastered"}
            </Text>
          </Pressable>

          {/* Navigation */}
          <View style={fs.navRow}>
            <Pressable
              style={[fs.navBtn, { backgroundColor: navBg }, activeIndex === 0 && fs.navBtnDim]}
              onPress={() => setActiveIndex((i) => Math.max(0, i - 1))}
              disabled={activeIndex === 0}
            >
              <Text style={[fs.navBtnText, { color: navText }]}>‹ Prev</Text>
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fs.dots}>
              {cards.map((_, i) => {
                const isMastered = mastered.has(i);
                const isActive   = i === activeIndex;
                const cfg        = getTypeConfig(cards[i].type);
                return (
                  <Pressable key={i} onPress={() => setActiveIndex(i)} hitSlop={6}>
                    <View
                      style={[
                        fs.dot,
                        { backgroundColor: dotInactive },
                        isActive && { width: 20, borderRadius: 5, backgroundColor: cfg.front[0] },
                        !isActive && isMastered && { backgroundColor: "#10b981" },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={[fs.navBtn, { backgroundColor: navBg }, activeIndex === cards.length - 1 && fs.navBtnDim]}
              onPress={() => setActiveIndex((i) => Math.min(cards.length - 1, i + 1))}
              disabled={activeIndex === cards.length - 1}
            >
              <Text style={[fs.navBtnText, { color: navText }]}>Next ›</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const gen = StyleSheet.create({
  btn:      { borderRadius: 12, overflow: "hidden", marginTop: 12 },
  gradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 20 },
  icon:     { fontSize: 18 },
  label:    { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

const fs = StyleSheet.create({
  container:       { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 12 },
  headerRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerLeft:      { flexDirection: "row", alignItems: "center", gap: 10 },
  headerActions:   { flexDirection: "row", gap: 6 },
  iconBox:         { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  title:           { fontSize: 15, fontFamily: "Inter_700Bold" },
  subtitle:        { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  actionBtn:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, minWidth: 34, alignItems: "center" },
  actionBtnText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  progressTrack:   { height: 4, borderRadius: 2, marginBottom: 14, overflow: "hidden" },
  progressFill:    { height: 4, borderRadius: 2 },
  celebration:     { borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" },
  celebrationText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center", lineHeight: 20 },
  masteredBtn:     { marginTop: 12, borderRadius: 8, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  masteredBtnOn:   { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "#10b981" },
  masteredText:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  masteredTextOn:  { color: "#10b981" },
  navRow:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  navBtn:          { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  navBtnDim:       { opacity: 0.3 },
  navBtnText:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dots:            { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 4 },
  dot:             { width: 8, height: 8, borderRadius: 4 },
});
