import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EdwAILogo } from "@/components/EdwAILogo";
import { Colors } from "@/constants/colors";

type HistoryItem = {
  id: string;
  question: string;
  subject: string;
  textbook: string;
  mode: "book" | "concept";
  timestamp: Date;
};

const DEMO_HISTORY: HistoryItem[] = [
  {
    id: "1",
    question: "What is photosynthesis and how does it work?",
    subject: "Science",
    textbook: "NCERT Science",
    mode: "book",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "2",
    question: "Explain Newton's second law of motion with examples",
    subject: "Physics",
    textbook: "NCERT Physics Part 1",
    mode: "concept",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: "3",
    question: "What are the properties of acids and bases?",
    subject: "Chemistry",
    textbook: "NCERT Chemistry Part 1",
    mode: "book",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
];

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function HistoryCard({ item }: { item: HistoryItem }) {
  return (
    <Pressable style={({ pressed }) => [styles.histCard, pressed && { opacity: 0.9 }]}>
      <View style={styles.histTop}>
        <View style={[styles.modeBadge, item.mode === "concept" && styles.modeBadgeConcept]}>
          {item.mode === "book" ? (
            <Ionicons name="search" size={10} color={Colors.primary} />
          ) : (
            <Ionicons name="bulb-outline" size={10} color={Colors.warning} />
          )}
          <Text style={[styles.modeBadgeText, item.mode === "concept" && styles.modeBadgeTextConcept]}>
            {item.mode === "book" ? "Book Answer" : "Concept"}
          </Text>
        </View>
        <Text style={styles.timeText}>{timeAgo(item.timestamp)}</Text>
      </View>
      <Text style={styles.questionText} numberOfLines={2}>
        {item.question}
      </Text>
      <View style={styles.histBottom}>
        <View style={styles.metaChip}>
          <Ionicons name="book-outline" size={11} color={Colors.gray500} />
          <Text style={styles.metaText}>{item.subject}</Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialIcons name="school" size={11} color={Colors.gray500} />
          <Text style={styles.metaText} numberOfLines={1}>{item.textbook}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [showDemo, setShowDemo] = useState(false);
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const data = showDemo ? DEMO_HISTORY : [];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientMid]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
      />

      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <EdwAILogo size="sm" />
        <Text style={styles.screenTitle}>History</Text>
        {data.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{data.length}</Text>
          </View>
        )}
      </View>

      {data.length === 0 ? (
        <ScrollView
          contentContainerStyle={[
            styles.emptyContainer,
            { paddingBottom: bottomInset + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyIconWrap}>
            <LinearGradient
              colors={[Colors.indigoBg, Colors.indigoLight]}
              style={styles.emptyIconBg}
            >
              <MaterialIcons name="history" size={40} color={Colors.primary} />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>No Questions Yet</Text>
          <Text style={styles.emptyDesc}>
            Your past questions and answers will appear here as you use EdwAI.
          </Text>

          <View style={styles.emptyTips}>
            {[
              "Ask your first question from the Home tab",
              "Questions are saved automatically",
              "Access any past answer anytime",
            ].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowDemo(true)}
          >
            <Ionicons name="eye-outline" size={16} color={Colors.primary} />
            <Text style={styles.demoBtnText}>Preview Sample History</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryCard item={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomInset + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!data.length}
          ListHeaderComponent={
            showDemo ? (
              <Pressable style={styles.clearDemo} onPress={() => setShowDemo(false)}>
                <Text style={styles.clearDemoText}>Clear sample data</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoRow: { flexDirection: "row", alignItems: "baseline" },
  logoEdw: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary },
  logoAI: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.gray900 },
  screenTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    flex: 1,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  emptyIconWrap: { marginBottom: 24 },
  emptyIconBg: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.gray600,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  emptyTips: {
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 24,
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  tipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray700,
  },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
    backgroundColor: Colors.indigoBg,
  },
  demoBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 4,
  },
  histCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  histTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.indigoBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
  },
  modeBadgeConcept: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warningLight,
  },
  modeBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  modeBadgeTextConcept: { color: Colors.warning },
  timeText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.gray400,
  },
  questionText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.gray900,
    lineHeight: 20,
  },
  histBottom: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.gray50,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
    maxWidth: 100,
  },
  clearDemo: { alignItems: "center", marginBottom: 8 },
  clearDemoText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray400,
  },
});
