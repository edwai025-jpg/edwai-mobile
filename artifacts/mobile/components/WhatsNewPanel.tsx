import { platformShadow } from "@/constants/shadow";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import api, { AppConfig, WhatsNewItem } from "@/services/api";

const RESOURCE_LINKS = [
  {
    key: "youtube",
    label: "EdwAI YouTube Channel",
    configKey: "social_youtube",
    fallback: "https://youtube.com/@edwai",
    gradientColors: ["#EF4444", "#E11D48"] as [string, string],
    icon: "youtube" as const,
  },
  {
    key: "telegram",
    label: "Telegram Community",
    configKey: "social_telegram",
    fallback: "https://t.me/edwai",
    gradientColors: ["#0EA5E9", "#2563EB"] as [string, string],
    icon: "send" as const,
  },
  {
    key: "instagram",
    label: "Instagram",
    configKey: "social_instagram",
    fallback: "https://instagram.com/edwai",
    gradientColors: ["#EC4899", "#F43F5E"] as [string, string],
    icon: "instagram" as const,
  },
  {
    key: "resources",
    label: "Study Resources",
    configKey: "social_resources",
    fallback: "https://edwai.com/resources",
    gradientColors: ["#7C3AED", "#9333EA"] as [string, string],
    icon: "book-open" as const,
  },
  {
    key: "support",
    label: "Help & Support",
    configKey: null,
    fallback: "mailto:support@edwai.com",
    gradientColors: ["#10B981", "#0D9488"] as [string, string],
    icon: "help-circle" as const,
  },
];

function SkeletonCard() {
  const anim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  return (
    <Animated.View style={[sk.card, { opacity }]}>
      <View style={sk.iconBox} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={sk.line1} />
        <View style={sk.line2} />
      </View>
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.gray200 },
  line1: { width: "70%", height: 14, borderRadius: 4, backgroundColor: Colors.gray200 },
  line2: { width: "45%", height: 11, borderRadius: 4, backgroundColor: Colors.gray100 },
});

export default function WhatsNewPanel() {
  const [activeTab, setActiveTab] = useState<"whats-new" | "resources">("whats-new");
  const [items, setItems] = useState<WhatsNewItem[]>([]);
  const [totalBoards, setTotalBoards] = useState<number>(0);
  const [appConfig, setAppConfig] = useState<AppConfig>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [wnRes, cfgRes] = await Promise.all([
          api.data.getWhatsNew(),
          api.data.getAppConfig(),
        ]);
        setItems(wnRes.items ?? []);
        setTotalBoards(wnRes.total_boards ?? 0);
        setAppConfig(cfgRes ?? {});
      } catch {
        // silent — show empty state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const newCount = items.filter((i) => i.is_new).length;

  return (
    <View style={p.root}>
      {/* Header */}
      <View style={p.header}>
        <View style={p.logoRow}>
          <View style={p.logoIcon}>
            <Feather name="book-open" size={14} color={Colors.indigo} />
          </View>
          <Text style={p.logoText}>
            <Text style={p.logoEdw}>Edw</Text>
            <Text style={p.logoAI}>AI</Text>
          </Text>
        </View>
        <Text style={p.headerSub}>AI-powered learning from your textbooks</Text>
      </View>

      {/* Tab bar */}
      <View style={p.tabBar}>
        <Pressable
          style={[p.tab, activeTab === "whats-new" && p.tabActive]}
          onPress={() => setActiveTab("whats-new")}
        >
          {activeTab === "whats-new" ? (
            <LinearGradient
              colors={[Colors.indigo, "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={p.tabActiveBg}
            >
              <Feather name="zap" size={13} color={Colors.white} />
              <Text style={p.tabTextActive}>What's New</Text>
              {newCount > 0 && (
                <View style={p.newBadge}>
                  <Text style={p.newBadgeText}>{newCount} new</Text>
                </View>
              )}
            </LinearGradient>
          ) : (
            <View style={p.tabInactiveBg}>
              <Feather name="zap" size={13} color={Colors.gray500} />
              <Text style={p.tabTextInactive}>What's New</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[p.tab, activeTab === "resources" && p.tabActive]}
          onPress={() => setActiveTab("resources")}
        >
          {activeTab === "resources" ? (
            <LinearGradient
              colors={[Colors.indigo, "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={p.tabActiveBg}
            >
              <Feather name="link" size={13} color={Colors.white} />
              <Text style={p.tabTextActive}>Resources</Text>
            </LinearGradient>
          ) : (
            <View style={p.tabInactiveBg}>
              <Feather name="link" size={13} color={Colors.gray500} />
              <Text style={p.tabTextInactive}>Resources</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === "whats-new" ? (
        <View style={p.contentBox}>
          <Text style={p.contentDesc}>
            New states, boards, and classes are added regularly. Here's what's been onboarded recently.
          </Text>

          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </>
          ) : items.length === 0 ? (
            <View style={p.emptyState}>
              <Text style={p.emptyIcon}>🌱</Text>
              <Text style={p.emptyText}>Content is being onboarded — check back soon</Text>
            </View>
          ) : (
            <>
              {items.map((item, idx) => (
                <View key={idx} style={p.itemRow}>
                  <View style={p.itemIconBox}>
                    <Text style={p.itemIcon}>{item.type === "board" ? "🏫" : "📚"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={p.itemTitleRow}>
                      <Text style={p.itemName} numberOfLines={1}>{item.name}</Text>
                      {item.is_new && (
                        <View style={p.newItemBadge}>
                          <Text style={p.newItemBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>
                    <View style={p.itemMetaRow}>
                      <Text style={p.itemState}>{item.state}</Text>
                      <View style={[p.typeBadge, item.type === "class" ? p.typeBadgeClass : p.typeBadgeBoard]}>
                        <Text style={[p.typeBadgeText, item.type === "class" ? p.typeBadgeTextClass : p.typeBadgeTextBoard]}>
                          {item.type.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={p.itemDate}>{item.date}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Bottom note */}
          <View style={p.bottomNote}>
            <Text style={p.bottomNoteText}>
              Don't see your board? Complete your profile above — we'll work with resources and onboard as soon as possible.
            </Text>
          </View>
        </View>
      ) : (
        <View style={p.contentBox}>
          {RESOURCE_LINKS.map((link) => {
            const url =
              (link.configKey ? appConfig[link.configKey] : undefined) ??
              link.fallback;
            return (
              <Pressable
                key={link.key}
                style={({ pressed }) => [p.resourceRow, pressed && { opacity: 0.75 }]}
                onPress={() => Linking.openURL(url)}
              >
                <LinearGradient
                  colors={link.gradientColors}
                  style={p.resourceIcon}
                >
                  <Feather name={link.icon} size={16} color={Colors.white} />
                </LinearGradient>
                <Text style={p.resourceLabel}>{link.label}</Text>
                <View style={p.comingSoonBadge}>
                  <Text style={p.comingSoonText}>Coming soon</Text>
                </View>
                <Feather name="external-link" size={14} color={Colors.gray400} />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Stats strip */}
      <View style={p.statsStrip}>
        <View style={p.statCard}>
          <Text style={p.statIcon}>👨‍🎓</Text>
          <Text style={p.statText}>Tested by 10K+ Students & Teachers</Text>
        </View>
        <View style={p.statCard}>
          <Text style={p.statIcon}>🏫</Text>
          <Text style={p.statText}>
            {loading ? "—" : totalBoards}{" "}
            <Text style={p.statLabel}>Boards</Text>
          </Text>
        </View>
        <View style={p.statCard}>
          <Text style={p.statIcon}>📌</Text>
          <Text style={p.statText}>Citations Included</Text>
        </View>
      </View>
    </View>
  );
}

const p = StyleSheet.create({
  root: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    ...platformShadow("#4F46E5", 0, 4, 0.07, 16),
    elevation: 4,
    marginBottom: 20,
    overflow: "hidden",
  },

  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  logoIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {},
  logoEdw: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.indigo },
  logoAI: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.gray900 },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
    marginLeft: 38,
  },

  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.gray100,
    margin: 12,
    marginBottom: 0,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1 },
  tabActive: {},
  tabActiveBg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  tabInactiveBg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  tabTextActive: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  tabTextInactive: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.gray500,
  },
  newBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },

  contentBox: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
  },
  contentDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.gray600,
    lineHeight: 18,
    marginBottom: 12,
    backgroundColor: "#F5F3FF",
    borderRadius: 8,
    padding: 10,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  itemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.gray50,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIcon: { fontSize: 18 },
  itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  itemName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.gray900,
    flex: 1,
  },
  newItemBadge: {
    backgroundColor: "#EDE9FE",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newItemBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.indigo,
    letterSpacing: 0.5,
  },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemState: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
  },
  typeBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  typeBadgeClass: { backgroundColor: "#EDE9FE" },
  typeBadgeBoard: { backgroundColor: "#E0F2FE" },
  typeBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  typeBadgeTextClass: { color: Colors.indigo },
  typeBadgeTextBoard: { color: "#0284C7" },
  itemDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.gray400,
  },

  emptyState: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyIcon: { fontSize: 28 },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
    textAlign: "center",
  },

  bottomNote: {
    backgroundColor: "#F5F3FF",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  bottomNoteText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.indigo,
    textAlign: "center",
    lineHeight: 18,
  },

  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  resourceIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  resourceLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.gray800,
  },
  comingSoonBadge: {
    backgroundColor: Colors.gray100,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.gray500,
  },

  statsStrip: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 8,
    gap: 4,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  statIcon: { fontSize: 20 },
  statText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.gray800,
    textAlign: "center",
    lineHeight: 15,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
  },
});
