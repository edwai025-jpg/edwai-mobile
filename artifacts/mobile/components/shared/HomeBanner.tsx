import { Feather } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  DimensionValue,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { Colors } from "@/constants/colors";
import { UsageInfo } from "@/services/api";

const PRIMARY = "#667eea";

/* ─── Upgrade Modal ──────────────────────────────────────────────────────── */
export function UpgradeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={um.backdrop}>
        <View style={um.card}>
          <Text style={um.emoji}>🚀</Text>
          <Text style={um.title}>Upgrade Your Plan</Text>
          <Text style={um.body}>
            Visit edwai.com to explore plans and upgrade your subscription for unlimited questions and premium features.
          </Text>
          <TouchableOpacity style={um.primaryBtn} onPress={() => { Linking.openURL("https://edwai.com").catch(() => {}); onClose(); }}>
            <Text style={um.primaryBtnText}>Open edwai.com →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={um.secondaryBtn} onPress={onClose}>
            <Text style={um.secondaryBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const um = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: Colors.darkCard, borderRadius: 20, borderWidth: 1, borderColor: Colors.darkCardBorder, padding: 28, alignItems: "center", width: "100%" },
  emoji: { fontSize: 44, marginBottom: 12 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 10, textAlign: "center" },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center", marginBottom: 10 },
  primaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  secondaryBtn: { paddingVertical: 10 },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
});

/* ─── Plan emoji helper ───────────────────────────────────────────────────── */
export function planEmoji(slug?: string | null) {
  if (!slug) return "🆓";
  if (slug === "free") return "🆓";
  if (slug.includes("tier1") || slug.includes("starter") || slug.includes("bronze")) return "🥉";
  if (slug.includes("tier2") || slug.includes("pro") || slug.includes("silver")) return "🥈";
  if (slug.includes("tier3") || slug.includes("premium") || slug.includes("gold")) return "🥇";
  return "💎";
}

/* ─── Banner Area ────────────────────────────────────────────────────────── */
export function HomeBanner({
  usage,
  usageLoading,
  onUpgrade,
  onLogout,
  isDark,
  onToggleTheme,
}: {
  usage: UsageInfo | null;
  usageLoading: boolean;
  onUpgrade: () => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [phoneNudgeDismissed, setPhoneNudgeDismissed] = useState(true);
  const [payhallVisible, setPayhallVisible] = useState(false);

  const displayName = user?.name ?? "Student";
  const nameShort = displayName.split(" ")[0] ?? "Student";
  const photoUrl = user?.profilePhotoUrl;
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  /* phone nudge */
  useEffect(() => {
    AsyncStorage.getItem("phoneNudgeDismissed").then((v) => {
      const noPhone = !user?.phone;
      const profileComplete = !!user?.profileComplete;
      setPhoneNudgeDismissed(!!v || !noPhone || !profileComplete);
    }).catch(() => setPhoneNudgeDismissed(true));
  }, [user?.phone, user?.profileComplete]);

  const dismissPhoneNudge = () => {
    AsyncStorage.setItem("phoneNudgeDismissed", "1").catch(() => {});
    setPhoneNudgeDismissed(true);
  };

  /* payhall — show when questions exhausted */
  useEffect(() => {
    if (usage && (usage.percent_used ?? 0) >= 100) setPayhallVisible(true);
  }, [usage?.percent_used]);

  const usedQ = usage?.questions_used ?? 0;
  const limitQ = usage?.questions_limit ?? 0;
  const usagePct = usage?.percent_used ?? (limitQ > 0 ? Math.min((usedQ / limitQ) * 100, 100) : 0);
  const barColor = usagePct >= 90 ? "#ef4444" : usagePct >= 70 ? "#f59e0b" : "#818cf8";
  const statusBanner = usage?.status;

  return (
    <View>
      {/* ── Layer 0: Past Due Banner ── */}
      {statusBanner === "past_due" && (
        <View style={[bn.pastDue, { paddingTop: topPad + 10 }]}>
          <View style={bn.pastDueInner}>
            <View style={{ flex: 1 }}>
              <Text style={bn.pastDueText}>⛔ Your account has been downgraded. Questions are now limited. Renew to restore full access.</Text>
            </View>
            <Pressable onPress={onUpgrade} style={bn.pastDueCta}>
              <Text style={bn.pastDueCtaText}>Restore Access →</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Layer 0: Grace Period Banner ── */}
      {statusBanner === "grace_period" && (
        <View style={[bn.grace, { paddingTop: topPad + 10 }]}>
          <View style={bn.graceInner}>
            <View style={{ flex: 1 }}>
              <Text style={bn.graceText}>
                ⚠️ Your last payment failed. Update your payment method to avoid losing access.
                {usage?.grace_period_ends
                  ? ` (${Math.max(0, Math.ceil((new Date(usage.grace_period_ends).getTime() - Date.now()) / 86400000))} days remaining)`
                  : ""}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (usage?.payment_method_update_url) {
                  Linking.openURL(usage.payment_method_update_url).catch(() => {});
                } else {
                  onUpgrade();
                }
              }}
              style={bn.graceCta}
            >
              <Text style={bn.graceCtaText}>
                {usage?.payment_method_update_url ? "Update Card →" : "Resolve Now →"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Layer 0: Phone Nudge Banner ── */}
      {!phoneNudgeDismissed && statusBanner !== "past_due" && statusBanner !== "grace_period" && (
        <View style={[bn.phone, { paddingTop: topPad + 10 }]}>
          <View style={bn.phoneInner}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push("/(tabs)/profile")}>
              <Text style={bn.phoneText}>
                📱 Add your mobile number to enable phone OTP login and faster payments →{" "}
                <Text style={bn.phoneCta}>My Profile › Account</Text>
              </Text>
            </Pressable>
            <Pressable onPress={dismissPhoneNudge} hitSlop={12} style={bn.phoneDismiss}>
              <Feather name="x" size={14} color="#1e3a5f" />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Layer 1: Main Nav ── */}
      <LinearGradient
        colors={isDark
          ? ["#1a1040", "#251662", "#2e1875", "#1d0e5c"]
          : ["#3730a3", "#4f46e5", "#6d28d9", "#4338ca"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          nb.nav,
          { paddingTop: statusBanner || !phoneNudgeDismissed ? 12 : topPad + 12 },
        ]}
      >
        {/* Decorative dot-grid (28×28 repeat, 1.5px dots) */}
        <View style={nb.dotGrid} pointerEvents="none">
          {Array.from({ length: 45 }).map((_, i) => (
            <View key={i} style={nb.dot} />
          ))}
        </View>

        <View style={nb.navRow}>
          {/* Logo */}
          <View style={nb.logoWrap}>
            <Text style={nb.logoEdw}>Edw</Text>
            <Text style={nb.logoAI}>AI</Text>
          </View>

          {/* Divider */}
          <View style={nb.divider} />

          {/* Avatar + Name */}
          <View style={nb.userBlock}>
            <View style={nb.avatarWrap}>
              {photoUrl
                ? <Image source={{ uri: photoUrl }} style={nb.avatarImg} />
                : (
                  <LinearGradient colors={["#7c3aed", "#4f46e5"]} style={nb.avatarImg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={nb.avatarInitials}>{initials || "S"}</Text>
                  </LinearGradient>
                )
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={nb.userName} numberOfLines={1}>{nameShort}</Text>
              {(user?.email || user?.phone) && (
                <Text style={nb.userSub} numberOfLines={1}>{user?.email || user?.phone}</Text>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View style={nb.actions}>
            <Pressable style={nb.themeBtn} onPress={onToggleTheme} hitSlop={6}>
              <Text style={nb.themeBtnIcon}>{isDark ? "☀️" : "🌙"}</Text>
            </Pressable>
            <Pressable style={nb.logoutBtn} onPress={onLogout} hitSlop={6}>
              <Ionicons name="log-out-outline" size={17} color="#fff" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* ── Layer 2: Sub-Row ── */}
      <LinearGradient
        colors={["#1d0e5c", "#251662"]}
        style={nb.subRow}
      >
        {/* Board + Class chips */}
        <View style={nb.chipsGroup}>
          {user?.board ? (
            <View style={nb.chip}>
              <Feather name="grid" size={10} color="rgba(255,255,255,0.5)" />
              <Text style={nb.chipLabel}>Board: </Text>
              <Text style={nb.chipValue} numberOfLines={1}>{user.board}</Text>
            </View>
          ) : null}
          <View style={nb.chip}>
            <Feather name="book-open" size={10} color="rgba(255,255,255,0.5)" />
            <Text style={nb.chipLabel}>Class: </Text>
            <Text style={nb.chipValue}>{user?.className ?? "Individual"}</Text>
          </View>
        </View>

        {/* Plan widget + Upgrade */}
        <View style={nb.planGroup}>
          {usageLoading ? (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
          ) : (
            <Pressable style={nb.planWidget} onPress={onUpgrade}>
              <Text style={nb.planEmoji}>{planEmoji(usage?.tier_slug)}</Text>
              <View style={{ gap: 2 }}>
                <Text style={nb.planName} numberOfLines={1}>{usage?.tier_name ?? usage?.plan_name ?? "Free"}</Text>
                <View style={nb.planBarBg}>
                  <View style={[nb.planBarFill, { width: `${usagePct}%` as DimensionValue, backgroundColor: barColor }]} />
                </View>
                <Text style={nb.planCount}>{usedQ}/{limitQ} Q</Text>
              </View>
            </Pressable>
          )}
          <Pressable style={nb.upgradeBtn} onPress={onUpgrade}>
            <Text style={nb.upgradeBtnText}>Upgrade</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* ── Payhall Banner ── */}
      {payhallVisible && (
        <View style={bn.payhall}>
          <Text style={bn.payhallText}>🎯 You've used your last free question. Upgrade to keep learning!</Text>
          <View style={bn.payhallActions}>
            <Pressable style={bn.payhallUpgrade} onPress={onUpgrade}>
              <Text style={bn.payhallUpgradeText}>Upgrade Now</Text>
            </Pressable>
            <Pressable onPress={() => setPayhallVisible(false)} hitSlop={10}>
              <Feather name="x" size={16} color="#92400e" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

/* Banner styles */
const bn = StyleSheet.create({
  pastDue: { backgroundColor: "#dc2626", paddingBottom: 10, paddingHorizontal: 14 },
  pastDueInner: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pastDueText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#fff", lineHeight: 19 },
  pastDueCta: { marginLeft: 4, marginTop: 2 },
  pastDueCtaText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", textDecorationLine: "underline", textAlign: "right" },
  grace: { backgroundColor: "#f59e0b", paddingBottom: 10, paddingHorizontal: 14 },
  graceInner: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  graceText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#451a03", lineHeight: 19 },
  graceCta: { marginLeft: 4, marginTop: 2 },
  graceCtaText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#451a03", textDecorationLine: "underline" },
  phone: { backgroundColor: "#eff6ff", borderBottomWidth: 1, borderBottomColor: "#bfdbfe", paddingBottom: 10, paddingHorizontal: 14 },
  phoneInner: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  phoneText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#1e3a5f", lineHeight: 19 },
  phoneCta: { fontFamily: "Inter_700Bold", textDecorationLine: "underline" },
  phoneDismiss: { padding: 4, marginTop: 2 },
  payhall: { backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", marginHorizontal: 12, marginTop: 10, borderRadius: 10, padding: 12 },
  payhallText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#fcd34d", lineHeight: 20, marginBottom: 10 },
  payhallActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  payhallUpgrade: { backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  payhallUpgradeText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

/* Nav styles */
const nb = StyleSheet.create({
  nav: { paddingHorizontal: 14, paddingBottom: 12, overflow: "hidden" },
  dotGrid: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", flexWrap: "wrap", gap: 26, padding: 8, opacity: 0.07 },
  dot: { width: 2, height: 2, borderRadius: 1, backgroundColor: "#fff" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoWrap: { flexDirection: "row", alignItems: "baseline" },
  logoEdw: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.navLogoEdw, letterSpacing: -0.5 },
  logoAI: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.5 },
  divider: { width: 1, height: 22, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 4 },
  userBlock: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  avatarWrap: { width: 32, height: 32, borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(167,139,250,0.6)" },
  avatarImg: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  userName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", maxWidth: 110 },
  userSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", maxWidth: 110 },
  actions: { flexDirection: "row", gap: 6 },
  themeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  themeBtnIcon: { fontSize: 14 },
  logoutBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.70)", borderWidth: 1, borderColor: "rgba(252,165,165,0.40)", alignItems: "center", justifyContent: "center" },
  subRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  chipsGroup: { flexDirection: "row", gap: 6, flex: 1, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.navChipBg, borderWidth: 1, borderColor: Colors.navChipBorder, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 140 },
  chipLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular" },
  chipValue: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", flexShrink: 1 },
  planGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  planWidget: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,6,40,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  planEmoji: { fontSize: 14 },
  planName: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#fff", maxWidth: 64 },
  planBarBg: { width: 60, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  planBarFill: { height: "100%", borderRadius: 2.5 },
  planCount: { fontSize: 9, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  upgradeBtn: { backgroundColor: "rgba(10,6,40,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  upgradeBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
