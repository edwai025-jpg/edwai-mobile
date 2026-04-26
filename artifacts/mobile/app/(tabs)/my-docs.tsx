import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NavHeader } from "@/components/NavHeader";
import { Colors } from "@/constants/colors";

type FeatherName = React.ComponentProps<typeof Feather>["name"];
type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const FEATURES = [
  {
    icon: "upload" as FeatherName,
    color: "#818cf8",
    bg: "rgba(129,140,248,0.15)",
    title: "Upload PDF",
    desc: "Books, notes, or any study material",
  },
  {
    icon: "youtube" as FeatherName,
    color: "#f87171",
    bg: "rgba(248,113,113,0.15)",
    title: "YouTube Links",
    desc: "Ask questions from any video",
  },
  {
    icon: "mic" as FeatherName,
    color: "#34d399",
    bg: "rgba(52,211,153,0.15)",
    title: "Voice Notes",
    desc: "Record lectures and study from them",
  },
  {
    icon: "image" as FeatherName,
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.15)",
    title: "Image Scan",
    desc: "Photograph a page for instant answers",
  },
];

export default function OwnBooksScreen() {
  const insets = useSafeAreaInsets();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handlePdfUpload = () =>
    Alert.alert("Phase 2 — Coming Soon", "PDF upload will be available in the next update.");

  const handleYoutubeAdd = () => {
    if (!youtubeUrl.trim()) {
      Alert.alert("URL required", "Please paste a YouTube video URL");
      return;
    }
    Alert.alert("Phase 2 — Coming Soon", "YouTube Q&A will be available in the next update.");
  };

  return (
    <View style={styles.root}>
      <NavHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBanner}>
          <LinearGradient
            colors={["rgba(129,140,248,0.22)", "rgba(102,126,234,0.08)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.heroIcon}>
            <Text style={{ fontSize: 38 }}>📖</Text>
          </View>
          <Text style={styles.heroTitle}>Own Books</Text>
          <Text style={styles.heroSub}>
            Upload your own study materials and get AI-powered answers, citations, and explanations — just like with textbooks.
          </Text>
          <View style={styles.badge}>
            <View style={styles.pulseDot} />
            <Text style={styles.badgeText}>Phase 2 — Coming Soon</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: "rgba(129,140,248,0.18)" }]}>
              <Feather name={"upload-cloud" as FeatherName} size={20} color="#818cf8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Upload PDF</Text>
              <Text style={styles.cardSub}>Add books, notes, or any study material</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.uploadBtn, pressed && { opacity: 0.8 }]}
            onPress={handlePdfUpload}
          >
            <Feather name={"plus" as FeatherName} size={16} color={Colors.white} />
            <Text style={styles.uploadBtnText}>Choose PDF File</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: "rgba(248,113,113,0.18)" }]}>
              <Feather name={"youtube" as FeatherName} size={20} color="#f87171" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Add YouTube Video</Text>
              <Text style={styles.cardSub}>Paste a video URL to ask questions from it</Text>
            </View>
          </View>
          <View style={styles.urlRow}>
            <View style={styles.urlInput}>
              <TextInput
                style={styles.urlInputText}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={Colors.darkTextDim}
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable
              style={({ pressed }) => [styles.urlBtn, pressed && { opacity: 0.8 }]}
              onPress={handleYoutubeAdd}
            >
              <Feather name={"plus" as FeatherName} size={18} color={Colors.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                <Feather name={f.icon} size={20} color={f.color} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name={"information-circle-outline" as IoniconsName} size={16} color={Colors.primary} />
          <Text style={styles.infoText}>
            Phase 2 features are under development. Meanwhile, use the Textbooks tab for full AI-powered study help.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  heroBanner: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    backgroundColor: Colors.darkCard,
    padding: 24,
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(129,140,248,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.darkText,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextSub,
    textAlign: "center",
    lineHeight: 20,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(102,126,234,0.2)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    marginTop: 4,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#22c55e",
  },
  card: {
    backgroundColor: Colors.darkCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.darkText,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
    marginTop: 2,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#818cf8",
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: "#818cf8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  urlRow: { flexDirection: "row", gap: 10 },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.darkInputBorder,
    borderRadius: 12,
    backgroundColor: Colors.darkInputBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  urlInputText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.darkText,
  },
  urlBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f87171",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureCard: {
    width: "47.5%",
    backgroundColor: Colors.darkCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    padding: 16,
    gap: 8,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.darkText,
  },
  featureDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
    lineHeight: 16,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(102,126,234,0.1)",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextSub,
    flex: 1,
    lineHeight: 18,
  },
});
