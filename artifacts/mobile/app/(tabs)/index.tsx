import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DimensionValue,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnswerCard from "@/components/study/AnswerCard";
import FlashcardsSection from "@/components/study/FlashcardsSection";
import IndianLanguageKeyboard from "@/components/study/IndianLanguageKeyboard";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import api, {
  ApiError,
  BoardStatus,
  Flashcard,
  Phase1Document,
  QueryHistoryItem,
  QueryResponse,
  UsageInfo,
} from "@/services/api";

const PRIMARY = "#667eea";
const CARD_BG = "#1e1e3a";
const BORDER = "rgba(255,255,255,0.10)";
const TEXT_COLOR = "#f9fafb";
const MUTED = "#9ca3af";

const TRANS_LANGS = [
  { code: "hindi", label: "Hindi", native: "हि" },
  { code: "telugu", label: "Telugu", native: "తె" },
  { code: "tamil", label: "Tamil", native: "த" },
  { code: "kannada", label: "Kannada", native: "ಕ" },
  { code: "malayalam", label: "Malayalam", native: "മ" },
  { code: "marathi", label: "Marathi", native: "म" },
  { code: "bengali", label: "Bengali", native: "ব" },
  { code: "gujarati", label: "Gujarati", native: "ગ" },
  { code: "punjabi", label: "Punjabi", native: "ਪ" },
  { code: "odia", label: "Odia", native: "ଓ" },
];

type InputMode = "normal" | "transliterate" | "keyboard";

/* ─── Upgrade Modal ──────────────────────────────────────────────────────── */
function UpgradeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
function planEmoji(slug?: string | null) {
  if (!slug) return "🆓";
  if (slug === "free") return "🆓";
  if (slug.includes("tier1") || slug.includes("starter") || slug.includes("bronze")) return "🥉";
  if (slug.includes("tier2") || slug.includes("pro") || slug.includes("silver")) return "🥈";
  if (slug.includes("tier3") || slug.includes("premium") || slug.includes("gold")) return "🥇";
  return "💎";
}

/* ─── Banner Area ────────────────────────────────────────────────────────── */
function HomeBanner({
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

/* ─── Picker ─────────────────────────────────────────────────────────────── */
function DarkPicker({
  label, options, selected, onSelect, disabled, placeholder, loading,
}: {
  label: string;
  options: { id: string | number; name: string }[];
  selected: string | number | null;
  onSelect: (v: { id: string | number; name: string }) => void;
  disabled?: boolean;
  placeholder: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();
  const inputBg = isDark ? "#2a2a3e" : "#ffffff";
  const textCol = isDark ? TEXT_COLOR : "#111827";
  const borderCol = isDark ? BORDER : "#e5e7eb";
  const selectedName = options.find((o) => String(o.id) === String(selected))?.name ?? "";
  return (
    <View style={dp.wrap}>
      <Text style={[dp.label, !isDark && { color: "#374151" }]}>{label}</Text>
      <Pressable style={[dp.sel, disabled && dp.disabled, { backgroundColor: inputBg }]} onPress={() => !disabled && !loading && setOpen((v) => !v)}>
        {loading
          ? <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
          : <Text style={[dp.selText, !selectedName && dp.placeholder, { color: selectedName ? textCol : MUTED }]} numberOfLines={1}>{selectedName || placeholder}</Text>
        }
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={isDark ? MUTED : Colors.gray500} />
      </Pressable>
      {open && (
        <View style={[dp.dropdown, { backgroundColor: inputBg, borderColor: borderCol }]}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 164 }}>
            {options.map((opt) => (
              <Pressable key={String(opt.id)} style={[dp.option, { borderBottomColor: borderCol }, String(opt.id) === String(selected) && dp.optSel]} onPress={() => { onSelect(opt); setOpen(false); }}>
                <Text style={[dp.optText, { color: textCol }, String(opt.id) === String(selected) && dp.optTextSel]}>{opt.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
const dp = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 },
  sel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(102,126,234,0.35)", borderRadius: 10, backgroundColor: "#2a2a3e", paddingHorizontal: 14, height: 46 },
  disabled: { opacity: 0.4 },
  selText: { fontSize: 14, color: TEXT_COLOR, fontFamily: "Inter_400Regular", flex: 1 },
  placeholder: { color: MUTED },
  dropdown: { marginTop: 4, borderWidth: 1, borderColor: BORDER, borderRadius: 8, backgroundColor: "#2a2a3e", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8, overflow: "hidden", zIndex: 99 },
  option: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  optSel: { backgroundColor: "rgba(102,126,234,0.22)" },
  optText: { fontSize: 14, color: TEXT_COLOR },
  optTextSel: { color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
});

/* ─── Board Processing Card ──────────────────────────────────────────────── */
function BoardProcessingCard({ status, delayMinutes, onStart, starting }: {
  status: BoardStatus["processing_status"];
  delayMinutes: number;
  onStart: () => void;
  starting: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== "in_progress") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const total = delayMinutes * 60;
  const pct = Math.max(5, Math.min(95, Math.round((elapsed / Math.max(total, 1)) * 100)));
  const remaining = Math.max(0, total - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (status === "in_progress") {
    return (
      <View style={bp.card}>
        <View style={bp.timerRing}>
          <View style={bp.timerInner}>
            <Text style={bp.timerText}>{mm}:{ss}</Text>
            <Text style={bp.timerLabel}>remaining</Text>
          </View>
        </View>
        <Text style={bp.title}>Processing Your Board's Textbooks</Text>
        <Text style={bp.desc}>Indexing your textbooks. This may take up to {delayMinutes} minutes.</Text>
        <View style={bp.progressBg}>
          <View style={[bp.progressFill, { width: `${pct}%` as `${number}%` }]} />
        </View>
        <Text style={bp.note}>{pct}% complete — check back soon</Text>
      </View>
    );
  }
  if (status === "failed") {
    return (
      <View style={bp.card}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
        <Text style={bp.title}>Processing Failed</Text>
        <Text style={bp.desc}>There was an issue. Please try again.</Text>
        <Pressable style={bp.btn} onPress={onStart} disabled={starting}>
          {starting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={bp.btnText}>🔄 Retry Processing</Text>}
        </Pressable>
      </View>
    );
  }
  return (
    <View style={bp.card}>
      <View style={bp.iconCircle}><Text style={{ fontSize: 40 }}>📚</Text></View>
      <Text style={bp.title}>Unlock Your Board's Textbooks</Text>
      <Text style={bp.desc}>
        Your board's textbooks need to be indexed before you can search them. This takes around {delayMinutes} minute{delayMinutes !== 1 ? "s" : ""}.
      </Text>
      <Pressable style={[bp.btn, starting && { opacity: 0.6 }]} onPress={onStart} disabled={starting}>
        {starting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={bp.btnText}>📄 Process Official Documents</Text>}
      </Pressable>
      <Text style={bp.note}>One-time setup · Takes ~{delayMinutes} min</Text>
    </View>
  );
}
const bp = StyleSheet.create({
  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 24, marginBottom: 12, alignItems: "center" },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(102,126,234,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  timerRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: PRIMARY, alignItems: "center", justifyContent: "center", marginBottom: 16, backgroundColor: "rgba(102,126,234,0.08)" },
  timerInner: { alignItems: "center" },
  timerText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#a78bfa" },
  timerLabel: { fontSize: 9, color: MUTED, marginTop: 1 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT_COLOR, textAlign: "center", marginBottom: 8 },
  desc: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  btn: { backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 13, marginBottom: 10 },
  btnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  note: { fontSize: 11, color: MUTED },
  progressBg: { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, width: "100%", marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 3 },
});

/* ─── Recent Questions ───────────────────────────────────────────────────── */
function RecentQuestionsPanel({ history, onSelect }: { history: QueryHistoryItem[]; onSelect: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  if (history.length === 0) return null;
  const filtered = search ? history.filter((h) => h.question.toLowerCase().includes(search.toLowerCase())) : history;
  return (
    <View style={rq.card}>
      <Pressable style={rq.header} onPress={() => setOpen((v) => !v)}>
        <Text style={rq.headerText}>🕐 Recent Questions ({history.length})</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={15} color={MUTED} />
      </Pressable>
      {open && (
        <View>
          {history.length > 5 && (
            <TextInput style={rq.search} placeholder="Search questions…" placeholderTextColor={MUTED} value={search} onChangeText={setSearch} />
          )}
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            {filtered.map((h) => (
              <Pressable key={h.id} style={rq.row} onPress={() => { onSelect(h.question); setOpen(false); }}>
                <Text style={rq.modeIcon}>{h.mode === "retrieve" ? "📖" : "💡"}</Text>
                <Text style={rq.rowText} numberOfLines={1}>{h.question}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
const rq = StyleSheet.create({
  card: { backgroundColor: "rgba(99,71,234,0.08)", borderRadius: 10, borderWidth: 2, borderColor: "rgba(99,102,241,0.3)", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
  headerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#a5b4fc" },
  search: { marginHorizontal: 12, marginBottom: 6, backgroundColor: "#2a2a3e", borderRadius: 8, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 8, color: TEXT_COLOR, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  modeIcon: { fontSize: 13 },
  rowText: { flex: 1, fontSize: 13, color: "#d1d5db" },
});

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function TextbooksScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, user, logout } = useAuth();

  /* usage */
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  /* board status */
  const [boardStatus, setBoardStatus] = useState<BoardStatus | null>(null);
  const [boardStatusLoading, setBoardStatusLoading] = useState(true);
  const [boardStatusError, setBoardStatusError] = useState(false);
  const [startingProcess, setStartingProcess] = useState(false);

  /* book selection */
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Phase1Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<{ id: number; name: string } | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Phase1Document | null>(null);

  /* query */
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"retrieve" | "explain">("retrieve");
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);

  /* flashcards */
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);

  /* ocr */
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  /* input mode */
  const [inputMode, setInputMode] = useState<InputMode>("normal");
  const [transLang, setTransLang] = useState("hindi");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [transWord, setTransWord] = useState("");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const abortCtrl = useRef<AbortController | null>(null);
  const prevQuestion = useRef("");
  const boardId = user?.boardId;
  const bottomInset = Platform.OS === "web" ? 84 : insets.bottom + 84;

  /* ── Fetch usage on mount ── */
  useEffect(() => {
    if (!accessToken) { setUsageLoading(false); return; }
    api.study.getUsage(accessToken)
      .then(setUsage)
      .catch(() => {})
      .finally(() => setUsageLoading(false));
  }, [accessToken]);

  const handleLogout = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  }, [logout]);

  const handleKeyboardInput = useCallback((char: string) => {
    setQuestion((q) => q + char);
  }, []);

  const handleKeyboardBackspace = useCallback(() => {
    setQuestion((q) => {
      if (!q) return q;
      return [...q].slice(0, -1).join("");
    });
  }, []);

  /* ── board status ── */
  const loadBoardStatus = useCallback(async () => {
    if (!accessToken) return;
    setBoardStatusLoading(true);
    setBoardStatusError(false);
    try {
      const s = await api.study.getBoardStatus(accessToken);
      setBoardStatus(s);
    } catch {
      setBoardStatus(null);
      setBoardStatusError(true);
    } finally {
      setBoardStatusLoading(false);
    }
  }, [accessToken]);

  /* Re-fetch board status whenever boardId changes (e.g. after profile edit) */
  useEffect(() => {
    if (!accessToken) { setBoardStatusLoading(false); return; }
    loadBoardStatus();
  }, [accessToken, boardId]);

  /* Reset all book selections when the user changes board */
  useEffect(() => {
    setSelectedClass(null);
    setSelectedSubject(null);
    setSelectedDoc(null);
    setSubjects([]);
    setDocuments([]);
    setClasses([]);
    setResponse(null);
    setStreamText("");
    setFlashcards([]);
  }, [boardId]);

  useEffect(() => {
    if (boardStatus?.processing_status !== "in_progress") return;
    const t = setInterval(async () => {
      if (!accessToken) return;
      try {
        const s = await api.study.getBoardStatus(accessToken);
        setBoardStatus(s);
        if (s.processing_status !== "in_progress") clearInterval(t);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [boardStatus?.processing_status, accessToken]);

  /* Load available classes — server applies board_id from saved profile automatically */
  useEffect(() => {
    if (!accessToken || !boardId) return;
    if (boardStatus?.processing_status === "in_progress") return;
    setClassesLoading(true);
    api.study.getAvailableClasses(accessToken).then(setClasses).catch(() => {}).finally(() => setClassesLoading(false));
  }, [accessToken, boardId, boardStatus?.processing_status]);

  /* ── class select: load subjects via dedicated endpoint ── */
  const onClassSelect = useCallback(async (cls: { id: number; name: string }) => {
    setSelectedClass(cls); setSelectedSubject(null); setSelectedDoc(null); setSubjects([]); setDocuments([]);
    if (!accessToken) return;
    setDocsLoading(true);
    try {
      const subjs = await api.study.getAvailableSubjects(accessToken, cls.id);
      setSubjects(subjs);
    } catch {} finally { setDocsLoading(false); }
  }, [accessToken]);

  /* ── subject select: load documents — server applies board+medium from profile ── */
  const onSubjectSelect = useCallback(async (subj: string) => {
    setSelectedSubject(subj); setSelectedDoc(null); setDocuments([]);
    if (!accessToken || !selectedClass) return;
    setDocsLoading(true);
    try { setDocuments(await api.study.getDocuments(accessToken, selectedClass.id, subj)); }
    catch {} finally { setDocsLoading(false); }
  }, [accessToken, selectedClass]);

  const onDocSelect = useCallback(async (doc: Phase1Document) => {
    setSelectedDoc(doc); setQuestion(""); setResponse(null); setStreamText(""); setFlashcards([]);
    if (!accessToken) return;
    try { setHistory(await api.study.getQueryHistory(accessToken, doc.id)); } catch {}
  }, [accessToken]);

  /* ── transliterate ── */
  const handleQuestionChange = useCallback((text: string) => {
    setQuestion(text);
    if (inputMode === "transliterate" && text.endsWith(" ") && !prevQuestion.current.endsWith(" ") && accessToken) {
      const words = text.trimEnd().split(/\s+/);
      const lastWord = words[words.length - 1];
      if (lastWord && lastWord.length > 0 && /^[a-zA-Z]+$/.test(lastWord)) {
        setTransWord(lastWord);
        api.study.transliterate(accessToken, transLang, lastWord)
          .then(setSuggestions).catch(() => setSuggestions([]));
      }
    } else if (!text.endsWith(" ")) {
      setSuggestions([]);
    }
    prevQuestion.current = text;
  }, [inputMode, transLang, accessToken]);

  const handlePickSuggestion = useCallback((suggestion: string) => {
    const words = question.trimEnd().split(/\s+/);
    words[words.length - 1] = suggestion;
    const newQ = words.join(" ") + " ";
    setQuestion(newQ);
    prevQuestion.current = newQ;
    setSuggestions([]);
    setTransWord("");
  }, [question]);

  /* ── query ── */
  const handleQuery = useCallback(async (qMode: "retrieve" | "explain") => {
    if (!question.trim() || !selectedDoc || !accessToken) return;
    abortCtrl.current?.abort();
    const ctrl = new AbortController();
    abortCtrl.current = ctrl;
    setMode(qMode); setQueryLoading(true); setStreaming(true);
    setStreamText(""); setResponse(null); setFlashcards([]); setFlashcardsLoading(false);
    let accumulated = "";
    try {
      const res = await api.study.streamQuery(
        accessToken,
        { document_id: selectedDoc.id, question: question.trim(), mode: qMode },
        (chunk) => { accumulated += chunk; setStreamText((t) => t + chunk); },
        ctrl.signal
      );
      const finalRes = res.answer ? res : { ...res, answer: accumulated };
      setResponse(finalRes); setStreaming(false); setQueryLoading(false);
      if (finalRes.answer) {
        setFlashcardsLoading(true);
        api.study.generateFlashcards(accessToken, question.trim(), finalRes.answer)
          .then((r) => setFlashcards(r.flashcards ?? [])).catch(() => {}).finally(() => setFlashcardsLoading(false));
      }
      setHistory((prev) => [{ id: Date.now(), question: question.trim(), mode: qMode, created_at: new Date().toISOString() }, ...prev.slice(0, 49)]);
      /* Refresh usage after each query */
      api.study.getUsage(accessToken).then(setUsage).catch(() => {});
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        const msg = e instanceof ApiError
          ? e.message
          : ((e as Error)?.message || String(e) || "Query failed. Please try again.");
        Alert.alert("Error", msg);
      }
      setStreaming(false); setQueryLoading(false);
    }
  }, [question, selectedDoc, accessToken]);

  /* ── image / OCR ── */
  const handleImageCapture = useCallback(async (fromCamera: boolean) => {
    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      setCaptureUri(uri);
      if (!accessToken) return;
      setOcrLoading(true);
      try { const { text } = await api.study.extractQuestionFromImage(accessToken, uri); if (text) setQuestion(text); }
      catch {} finally { setOcrLoading(false); }
    } catch {}
  }, [accessToken]);

  const handleStartProcessing = useCallback(async () => {
    if (!accessToken) return;
    setStartingProcess(true);
    try {
      await api.study.startBoardProcessing(accessToken);
      setBoardStatus((s) => s ? { ...s, processing_status: "in_progress" } : s);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to start processing");
    } finally { setStartingProcess(false); }
  }, [accessToken]);

  const { isDark, toggleTheme } = useTheme();
  const isQuerying = queryLoading || streaming;
  const isRestricted = !!boardStatus?.is_restricted && boardStatus.processing_status !== "completed";
  const boardReady = !boardStatusLoading && !isRestricted;
  const hasNoBoard = !boardId;
  const activeLang = TRANS_LANGS.find((l) => l.code === transLang);
  const cardBg = isDark ? CARD_BG : "#ffffff";
  const cardBorder = isDark ? BORDER : "#e5e7eb";
  const textCol = isDark ? TEXT_COLOR : "#111827";
  const mutedCol = isDark ? MUTED : "#6b7280";

  return (
    <LinearGradient
      colors={isDark ? ["#1a1a2e", "#16213e"] : ["#eff6ff", "#ffffff", "#faf5ff"]}
      style={sc.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* ── Sticky Banner ── */}
      <HomeBanner
        usage={usage}
        usageLoading={usageLoading}
        onUpgrade={() => setShowUpgrade(true)}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <ScrollView
        contentContainerStyle={[sc.scroll, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── BOARD STATUS ─── */}
        {boardStatusLoading && (
          <View style={[sc.card, { alignItems: "center", paddingVertical: 28, backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={{ color: mutedCol, marginTop: 10, fontSize: 13 }}>Checking board status…</Text>
          </View>
        )}

        {!boardStatusLoading && boardStatusError && (
          <View style={sc.errorBanner}>
            <Feather name="wifi-off" size={14} color="#fcd34d" />
            <Text style={sc.errorBannerText}>Couldn't reach server</Text>
            <Pressable onPress={loadBoardStatus} style={sc.retryBtn}>
              <Text style={sc.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!boardStatusLoading && isRestricted && boardStatus && (
          <BoardProcessingCard status={boardStatus.processing_status} delayMinutes={boardStatus.processing_delay_minutes} onStart={handleStartProcessing} starting={startingProcess} />
        )}

        {!boardStatusLoading && !isRestricted && hasNoBoard && (
          <View style={sc.setupCard}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🎓</Text>
            <Text style={sc.setupTitle}>Complete Your Profile First</Text>
            <Text style={sc.setupDesc}>Select your state, board, and class so EdwAI can find the right textbooks for you.</Text>
          </View>
        )}

        {/* ─── BOOK SELECTION ─── */}
        {boardReady && !hasNoBoard && (
          <View style={[sc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[sc.cardTitle, { color: textCol }]}>📖 Select Your Textbook</Text>
            <DarkPicker label="Class / Year" options={classes} selected={selectedClass?.id ?? null} onSelect={(v) => onClassSelect({ id: v.id as number, name: v.name })} placeholder="Select Class" loading={classesLoading} disabled={classes.length === 0 && !classesLoading} />
            <DarkPicker label="Subject" options={subjects.map((s) => ({ id: s, name: s }))} selected={selectedSubject} onSelect={(v) => onSubjectSelect(v.name)} placeholder="Select Subject" disabled={!selectedClass || subjects.length === 0} loading={docsLoading && !!selectedClass && !selectedSubject} />
            <DarkPicker label="Textbook" options={documents.map((d) => ({ id: d.id, name: d.title }))} selected={selectedDoc?.id ?? null} onSelect={(v) => { const d = documents.find((x) => x.id === v.id); if (d) onDocSelect(d); }} placeholder="Select Textbook" disabled={!selectedSubject || documents.length === 0} loading={docsLoading && !!selectedSubject && !selectedDoc} />
            {!selectedClass && classes.length > 0 && (
              <View style={sc.hint}><Text style={sc.hintText}>👆 Select a class to see available subjects</Text></View>
            )}
            {!selectedClass && !classesLoading && classes.length === 0 && !boardStatusError && (
              <View style={[sc.hint, sc.hintAmber]}><Text style={sc.hintAmberText}>📚 No classes available yet for your board</Text></View>
            )}
            {selectedClass && subjects.length === 0 && !docsLoading && (
              <View style={[sc.hint, sc.hintAmber]}><Text style={sc.hintAmberText}>📚 No subjects available for this class yet</Text></View>
            )}
          </View>
        )}

        {/* ─── HELP ─── */}
        {boardReady && !hasNoBoard && !selectedDoc && (
          <View style={[sc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[sc.cardTitle, { color: textCol }]}>💬 How to use EdwAI</Text>
            {[["📚","Select your class, subject, and textbook above"],["✍️","Type your question in the box below"],["🔍","Choose Answer from Book to get the exact answer"],["💡","Choose Learn Concept for a detailed explanation"]].map(([icon, text], i) => (
              <View key={i} style={sc.helpRow}><Text style={sc.helpIcon}>{icon}</Text><Text style={[sc.helpText, { color: mutedCol }]}>{text}</Text></View>
            ))}
          </View>
        )}

        {/* ─── QUESTION INTERFACE ─── */}
        {selectedDoc && (
          <View style={[sc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={sc.qHeader}>
              <View style={[sc.qIconBox, !isDark && { backgroundColor: "rgba(102,126,234,0.10)" }]}><Text style={{ fontSize: 18 }}>💬</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[sc.cardTitle, { color: textCol }]}>Ask a Question</Text>
                <Text style={[sc.qDocName, { color: mutedCol }]} numberOfLines={1}>From: <Text style={{ color: PRIMARY }}>{selectedDoc.title}</Text></Text>
              </View>
            </View>

            <RecentQuestionsPanel history={history} onSelect={setQuestion} />

            {/* Input Mode Bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
              {(["normal", "transliterate", "keyboard"] as InputMode[]).map((m) => {
                const label = m === "normal" ? "✍️ Normal" : m === "transliterate" ? "🔤 Transliterate" : "⌨️ Keyboard";
                const active = inputMode === m;
                return (
                  <Pressable key={m} style={[im.btn, active && im.btnActive]} onPress={() => { setInputMode(m); setSuggestions([]); }}>
                    <Text style={active ? im.btnTextActive : im.btnText}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Language picker (transliterate) */}
            {inputMode === "transliterate" && (
              <View style={{ marginBottom: 10 }}>
                <Pressable style={im.langBtn} onPress={() => setShowLangPicker((v) => !v)}>
                  <Text style={im.langBtnText}>{activeLang?.native} {activeLang?.label}</Text>
                  <Feather name={showLangPicker ? "chevron-up" : "chevron-down"} size={13} color={PRIMARY} />
                </Pressable>
                {showLangPicker && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={im.langList} contentContainerStyle={{ gap: 6, padding: 8 }}>
                    {TRANS_LANGS.map((l) => (
                      <Pressable key={l.code} style={[im.langChip, transLang === l.code && im.langChipActive]} onPress={() => { setTransLang(l.code); setShowLangPicker(false); }}>
                        <Text style={[im.langChipText, transLang === l.code && im.langChipTextActive]}>{l.native} {l.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <Text style={im.transHint}>Type in English → Press Space to convert (e.g., "namaste " → "नमस्ते ")</Text>
              </View>
            )}

            {inputMode === "keyboard" && (
              <Pressable style={im.keyboardTrigger} onPress={() => setShowKeyboard(true)}>
                <Text style={im.keyboardTriggerIcon}>⌨️</Text>
                <Text style={im.keyboardTriggerText}>Tap to open Indian Language Keyboard</Text>
                <Feather name="chevron-right" size={14} color={PRIMARY} />
              </Pressable>
            )}

            {/* Mode tabs */}
            <View style={sc.modeTabs}>
              <Pressable style={[sc.modeTab, mode === "retrieve" && sc.modeTabActive]} onPress={() => setMode("retrieve")}>
                <Text style={mode === "retrieve" ? sc.modeTabTextActive : sc.modeTabText}>📖 Answer from Book</Text>
              </Pressable>
              <Pressable style={[sc.modeTab, mode === "explain" && sc.modeTabActive]} onPress={() => setMode("explain")}>
                <Text style={mode === "explain" ? sc.modeTabTextActive : sc.modeTabText}>💡 Learn Concept</Text>
              </Pressable>
            </View>

            {/* Textarea */}
            <View style={[sc.textareaWrap, !isDark && { backgroundColor: "#f9fafb", borderColor: "#e5e7eb" }]}>
              <TextInput
                style={[sc.textarea, { backgroundColor: isDark ? "#2a2a3e" : "#f9fafb", color: textCol }]}
                multiline
                numberOfLines={4}
                placeholder={inputMode === "transliterate" ? 'Type in English, press Space to convert (e.g., "namaste ")' : "e.g., What are the main relief features of India?"}
                placeholderTextColor={mutedCol}
                value={question}
                onChangeText={handleQuestionChange}
                editable={!isQuerying && !ocrLoading}
                textAlignVertical="top"
              />
              <View style={sc.toolbar}>
                <Pressable style={sc.toolBtn} onPress={() => handleImageCapture(true)} disabled={isQuerying}>
                  <Feather name="camera" size={15} color={isQuerying ? MUTED : "#a78bfa"} />
                </Pressable>
                <Pressable style={sc.toolBtn} onPress={() => handleImageCapture(false)} disabled={isQuerying}>
                  <Feather name="image" size={15} color={isQuerying ? MUTED : "#a78bfa"} />
                </Pressable>
              </View>
            </View>

            {/* Transliterate suggestions */}
            {suggestions.length > 0 && (
              <View style={im.suggestionsWrap}>
                <Text style={im.suggestionsLabel}>Suggestions for "{transWord}":</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                  {suggestions.slice(0, 5).map((s, i) => (
                    <Pressable key={i} style={im.suggestionChip} onPress={() => handlePickSuggestion(s)}>
                      <Text style={im.suggestionChipNum}>{i + 1}</Text>
                      <Text style={im.suggestionChipText}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* OCR feedback */}
            {captureUri && (
              <View style={sc.captureRow}>
                <Image source={{ uri: captureUri }} style={sc.captureThumb} />
                {ocrLoading
                  ? <View style={{ flex: 1 }}><ActivityIndicator size="small" color={PRIMARY} /><Text style={sc.captureLabel}>Extracting question…</Text></View>
                  : <View style={{ flex: 1 }}><Text style={[sc.captureLabel, { color: "#10b981" }]}>✓ Question extracted</Text><Pressable onPress={() => setCaptureUri(null)}><Text style={sc.clearBtn}>Clear</Text></Pressable></View>
                }
              </View>
            )}

            {/* Action buttons */}
            <View style={sc.actionRow}>
              <Pressable style={[sc.actionBtn, { backgroundColor: PRIMARY }, (!question.trim() || isQuerying) && sc.actionBtnDim]} onPress={() => handleQuery("retrieve")} disabled={!question.trim() || isQuerying}>
                {isQuerying && mode === "retrieve" ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.actionBtnText}>📖 Answer from Book</Text>}
              </Pressable>
              <Pressable style={[sc.actionBtn, { backgroundColor: "#059669" }, (!question.trim() || isQuerying) && sc.actionBtnDim]} onPress={() => handleQuery("explain")} disabled={!question.trim() || isQuerying}>
                {isQuerying && mode === "explain" ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sc.actionBtnText}>💡 Learn Concept</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* ─── ANSWER ─── */}
        {(queryLoading || streaming || response) && (
          <AnswerCard loading={queryLoading && !streaming} streaming={streaming} streamText={streamText} response={response} mode={mode} />
        )}

        {/* ─── FLASHCARDS ─── */}
        {(flashcardsLoading || flashcards.length > 0) && (
          <FlashcardsSection loading={flashcardsLoading} cards={flashcards} />
        )}

        <View style={sc.footer}>
          <Feather name="alert-triangle" size={11} color={MUTED} />
          <Text style={sc.footerText}>AI responses should be verified with citations.</Text>
        </View>
      </ScrollView>

      {showKeyboard && (
        <IndianLanguageKeyboard
          onInput={handleKeyboardInput}
          onBackspace={handleKeyboardBackspace}
          onClose={() => setShowKeyboard(false)}
          isDarkMode
        />
      )}

      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </LinearGradient>
  );
}

const im = StyleSheet.create({
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: "#2a2a3e" },
  btnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  btnText: { fontSize: 13, color: MUTED, fontFamily: "Inter_500Medium" },
  btnTextActive: { fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" },
  langBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(102,126,234,0.12)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(102,126,234,0.3)", paddingHorizontal: 12, paddingVertical: 7 },
  langBtnText: { fontSize: 13, color: PRIMARY, fontFamily: "Inter_600SemiBold" },
  langList: { backgroundColor: "#2a2a3e", borderRadius: 10, borderWidth: 1, borderColor: BORDER, marginTop: 4, maxHeight: 56 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: "#1e1e3a" },
  langChipActive: { backgroundColor: "rgba(102,126,234,0.25)", borderColor: PRIMARY },
  langChipText: { fontSize: 12, color: MUTED },
  langChipTextActive: { color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
  transHint: { fontSize: 11, color: MUTED, marginTop: 6, fontStyle: "italic" },
  keyboardTrigger: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(102,126,234,0.1)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(102,126,234,0.3)", paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  keyboardTriggerIcon: { fontSize: 18 },
  keyboardTriggerText: { flex: 1, fontSize: 13, color: "#a5b4fc", fontFamily: "Inter_500Medium" },
  suggestionsWrap: { backgroundColor: "rgba(102,126,234,0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(102,126,234,0.25)", padding: 10, marginBottom: 8 },
  suggestionsLabel: { fontSize: 11, color: MUTED, marginBottom: 4 },
  suggestionChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(102,126,234,0.25)", borderRadius: 20, borderWidth: 1, borderColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 6 },
  suggestionChipNum: { fontSize: 10, color: "#a78bfa", fontFamily: "Inter_700Bold", backgroundColor: "rgba(102,126,234,0.4)", width: 16, height: 16, borderRadius: 8, textAlign: "center", lineHeight: 16 },
  suggestionChipText: { fontSize: 14, color: "#fff", fontFamily: "Inter_500Medium" },
});

const sc = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT_COLOR, marginBottom: 12 },
  hint: { backgroundColor: "rgba(99,102,241,0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", padding: 10, marginTop: 4 },
  hintText: { fontSize: 12, color: "#a5b4fc" },
  hintAmber: { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)" },
  hintAmberText: { fontSize: 12, color: "#fcd34d" },
  helpRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  helpIcon: { fontSize: 18, width: 26 },
  helpText: { flex: 1, fontSize: 13, color: MUTED, lineHeight: 20 },
  qHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  qIconBox: { width: 42, height: 42, borderRadius: 10, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center" },
  qDocName: { fontSize: 11, color: MUTED, marginTop: 2 },
  modeTabs: { flexDirection: "row", gap: 8, marginBottom: 10 },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: "#2a2a3e" },
  modeTabActive: { backgroundColor: "#2d2a4a", borderColor: "rgba(102,126,234,0.6)" },
  modeTabText: { fontSize: 12, color: MUTED, fontFamily: "Inter_500Medium" },
  modeTabTextActive: { fontSize: 12, color: "#a78bfa", fontFamily: "Inter_600SemiBold" },
  textareaWrap: { position: "relative", marginBottom: 8 },
  textarea: { backgroundColor: "#2a2a3e", borderWidth: 1, borderColor: "rgba(102,126,234,0.35)", borderRadius: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 48, fontSize: 14, color: TEXT_COLOR, minHeight: 100, fontFamily: "Inter_400Regular" },
  toolbar: { position: "absolute", bottom: 10, right: 10, flexDirection: "row", gap: 8 },
  toolBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(102,126,234,0.15)", alignItems: "center", justifyContent: "center" },
  captureRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  captureThumb: { width: 60, height: 60, borderRadius: 8, borderWidth: 2, borderColor: PRIMARY },
  captureLabel: { fontSize: 12, color: MUTED, marginTop: 4 },
  clearBtn: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  actionBtnDim: { opacity: 0.4 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  footer: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingTop: 8, paddingBottom: 16 },
  footerText: { fontSize: 11, color: MUTED },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorBannerText: { flex: 1, fontSize: 13, color: "#fcd34d", fontFamily: "Inter_500Medium" },
  retryBtn: { backgroundColor: "rgba(245,158,11,0.25)", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  retryBtnText: { fontSize: 12, color: "#fde68a", fontFamily: "Inter_600SemiBold" },
  setupCard: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 28, marginBottom: 12, alignItems: "center" },
  setupTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: TEXT_COLOR, textAlign: "center", marginBottom: 8 },
  setupDesc: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20, marginBottom: 20 },
});
