import { platformShadow } from "@/constants/shadow";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";

const FEATURES = [
  {
    emoji: "📚",
    title: "Textbook Answers",
    subtitle: "Direct from your books",
  },
  {
    emoji: "🎯",
    title: "100% Accurate",
    subtitle: "Exam-ready responses",
  },
  {
    emoji: "📖",
    title: "Page Citations",
    subtitle: "Know your sources",
  },
  {
    emoji: "🤖",
    title: "AI Explanations",
    subtitle: "Understand concepts",
  },
];

export function FeatureCards() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {FEATURES.slice(0, 2).map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </View>
      <View style={styles.row}>
        {FEATURES.slice(2).map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </View>
    </View>
  );
}

function FeatureCard({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 28,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingVertical: Platform.OS === "ios" ? 22 : 18,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 8,
    ...platformShadow(Colors.navy, 0, 4, 0.07, 12),
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  emoji: {
    fontSize: Platform.OS === "ios" ? 38 : 34,
    lineHeight: Platform.OS === "ios" ? 46 : 44,
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    textAlign: "center",
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
    textAlign: "center",
    lineHeight: 16,
  },
});
