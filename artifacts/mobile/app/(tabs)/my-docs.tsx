import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EdwAILogo } from "@/components/EdwAILogo";
import { Colors } from "@/constants/colors";

type FeatureItem =
  | {
      iconSet: "MaterialCommunity";
      icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
      title: string;
      desc: string;
    }
  | {
      iconSet: "Ionicons";
      icon: React.ComponentProps<typeof Ionicons>["name"];
      title: string;
      desc: string;
    }
  | {
      iconSet: "Feather";
      icon: React.ComponentProps<typeof Feather>["name"];
      title: string;
      desc: string;
    };

const FEATURES: FeatureItem[] = [
  {
    icon: "file-pdf-box",
    iconSet: "MaterialCommunity",
    title: "PDF Upload",
    desc: "Upload your own textbooks and study materials as PDFs",
  },
  {
    icon: "logo-youtube",
    iconSet: "Ionicons",
    title: "YouTube Videos",
    desc: "Add YouTube lecture links and ask questions about them",
  },
  {
    icon: "book-open",
    iconSet: "Feather",
    title: "Custom Documents",
    desc: "Notes, handwritten scans, and any study document",
  },
];

export default function MyDocsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

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
        <Text style={styles.screenTitle}>My Docs</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroIconWrap}>
              <Feather name="upload-cloud" size={40} color={Colors.white} />
            </View>
            <Text style={styles.heroTitle}>Upload Your Own Resources</Text>
            <Text style={styles.heroSub}>
              Soon you'll be able to upload PDFs, YouTube videos, and more — then ask
              questions and get AI-powered answers directly from your content.
            </Text>
            <View style={styles.comingSoonBadge}>
              <Ionicons name="time-outline" size={13} color={Colors.primary} />
              <Text style={styles.comingSoonText}>Coming Soon — Phase 2</Text>
            </View>
          </LinearGradient>
        </View>

        <Text style={styles.sectionLabel}>What you'll be able to do</Text>

        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureCard}>
            <View style={styles.featureIconWrap}>
              {f.iconSet === "MaterialCommunity" ? (
                <MaterialCommunityIcons
                  name={f.icon}
                  size={24}
                  color={Colors.primary}
                />
              ) : f.iconSet === "Ionicons" ? (
                <Ionicons name={f.icon} size={24} color="#FF0000" />
              ) : (
                <Feather name={f.icon} size={24} color={Colors.primary} />
              )}
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
            <View style={styles.featureBadge}>
              <Text style={styles.featureBadgeText}>Soon</Text>
            </View>
          </View>
        ))}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>
            In the meantime, use{" "}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: Colors.primary }}>
              Use Textbooks
            </Text>{" "}
            on the Home tab to get answers from our curated library of NCERT and
            state board textbooks.
          </Text>
        </View>
      </ScrollView>
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
    gap: 12,
  },
  logoRow: { flexDirection: "row", alignItems: "baseline" },
  logoEdw: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary },
  logoAI: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.gray900 },
  screenTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  heroCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  heroGradient: {
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 22,
  },
  comingSoonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 4,
  },
  comingSoonText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.gray600,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.indigoBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.gray900,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
    lineHeight: 18,
  },
  featureBadge: {
    backgroundColor: Colors.warningLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featureBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.warning,
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.indigoBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray700,
    lineHeight: 20,
  },
});
