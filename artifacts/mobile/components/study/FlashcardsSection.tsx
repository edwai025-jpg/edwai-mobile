import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Flashcard } from "@/services/api";

const CARD_GRADIENTS: Record<Flashcard["type"], [string, string]> = {
  definition: ["#7c3aed", "#4338ca"],
  concept: ["#0ea5e9", "#2563eb"],
  process: ["#10b981", "#0d9488"],
  fact: ["#f59e0b", "#ef4444"],
  diagram: ["#ec4899", "#9333ea"],
};

function FlipCard({ card, index, total }: { card: Flashcard; index: number; total: number }) {
  const [flipped, setFlipped] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const flip = () => {
    Animated.spring(anim, {
      toValue: flipped ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setFlipped(!flipped);
  };

  const frontRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  const [bg1, bg2] = CARD_GRADIENTS[card.type] ?? ["#6366f1", "#4f46e5"];

  return (
    <Pressable onPress={flip} style={fc.wrapper}>
      <Animated.View
        style={[fc.card, { backgroundColor: bg1, transform: [{ rotateY: frontRotate }] }]}
      >
        <View style={fc.typeLabel}>
          <Text style={fc.typeLabelText}>{card.type.toUpperCase()}</Text>
        </View>
        <View style={fc.center}>
          <Text style={fc.frontText}>{card.front}</Text>
        </View>
        <Text style={fc.tapHint}>Tap to reveal answer</Text>
        <Text style={fc.counter}>{index + 1} / {total}</Text>
      </Animated.View>

      <Animated.View
        style={[
          fc.card,
          fc.cardBack,
          { backgroundColor: bg2, transform: [{ rotateY: backRotate }] },
        ]}
      >
        <View style={fc.center}>
          <Text style={fc.backText}>{card.back}</Text>
        </View>
        <Text style={fc.tapHint}>Tap to flip back</Text>
        <Text style={fc.counter}>{index + 1} / {total}</Text>
      </Animated.View>
    </Pressable>
  );
}

const fc = StyleSheet.create({
  wrapper: { minHeight: 220 },
  card: {
    borderRadius: 16, padding: 20, minHeight: 220,
    justifyContent: "space-between", backfaceVisibility: "hidden",
  },
  cardBack: {
    position: "absolute", top: 0, left: 0, right: 0,
  },
  typeLabel: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  typeLabelText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  center: { flex: 1, justifyContent: "center", paddingVertical: 12 },
  frontText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 24 },
  backText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#fff", lineHeight: 22 },
  tapHint: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  counter: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "right" },
});

export default function FlashcardsSection({
  loading,
  cards,
}: {
  loading: boolean;
  cards: Flashcard[];
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => { setIndex(0); }, [cards]);

  if (loading) {
    return (
      <View style={fs.card}>
        <Text style={fs.heading}>🃏 Flashcards</Text>
        <View style={fs.loadRow}>
          <ActivityIndicator color="#a78bfa" />
          <Text style={fs.loadText}>Generating flashcards...</Text>
        </View>
      </View>
    );
  }

  if (cards.length === 0) return null;

  const card = cards[index];

  return (
    <View style={fs.card}>
      <Text style={fs.heading}>🃏 Flashcards</Text>
      <FlipCard card={card} index={index} total={cards.length} />

      <View style={fs.navRow}>
        <Pressable
          style={[fs.navBtn, index === 0 && fs.navBtnDim]}
          onPress={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
        >
          <Text style={fs.navBtnText}>‹ Prev</Text>
        </Pressable>

        <View style={fs.dots}>
          {cards.map((_, i) => (
            <Pressable key={i} onPress={() => setIndex(i)}>
              <View style={[fs.dot, i === index && fs.dotActive]} />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[fs.navBtn, index === cards.length - 1 && fs.navBtnDim]}
          onPress={() => setIndex(Math.min(cards.length - 1, index + 1))}
          disabled={index === cards.length - 1}
        >
          <Text style={fs.navBtnText}>Next ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const fs = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e3a", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 16, marginTop: 12,
  },
  heading: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 12 },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  loadText: { color: "#9ca3af", fontSize: 13 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  navBtn: {
    backgroundColor: "rgba(102,126,234,0.2)", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  navBtnDim: { opacity: 0.3 },
  navBtnText: { color: "#a78bfa", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  dotActive: { backgroundColor: "#a78bfa" },
});
