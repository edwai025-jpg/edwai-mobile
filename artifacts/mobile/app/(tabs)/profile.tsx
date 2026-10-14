import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  DimensionValue,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AccountEditModal from "@/components/AccountEditModal";
import EducationEditModal from "@/components/EducationEditModal";
import SessionsModal from "@/components/SessionsModal";
import ProfilePhotoCropModal from "@/components/ProfilePhotoCropModal";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import api, { getProfilePhotoSource, UsageInfo } from "@/services/api";
import { useProfileAlert } from "@/hooks/useProfileAlert";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];
type FeatherName = React.ComponentProps<typeof Feather>["name"];

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
function Avatar({
  name,
  token,
  hasPhoto,
  size = 72,
  onPress,
  busy = false,
}: {
  name: string;
  token?: string | null;
  hasPhoto?: boolean | null;
  size?: number;
  onPress?: () => void;
  busy?: boolean;
}) {
  const { user, photoRevision, probeHasPhoto } = useAuth();
  const [failed, setFailed] = useState(false);
  const retryRevision = useRef<number | null>(null);
  useEffect(() => { setFailed(false); }, [user?.id, photoRevision, token]);
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const r = size / 2;
  const inner = hasPhoto && token && !failed
    ? (
      <ExpoImage
        key={`${user?.id}:${photoRevision}`}
        source={getProfilePhotoSource(token, user?.id, photoRevision)}
        style={{ width: size, height: size, borderRadius: r, borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" }}
        contentFit="cover"
        cachePolicy="none"
        onError={() => {
          setFailed(true);
          if (retryRevision.current !== photoRevision) {
            retryRevision.current = photoRevision + 1;
            void probeHasPhoto();
          }
        }}
      />
    )
    : (
      <LinearGradient colors={["#7c3aed", "#4f46e5"]} style={{ width: size, height: size, borderRadius: r, alignItems: "center", justifyContent: "center" }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={{ fontSize: size * 0.34, fontFamily: "Inter_700Bold", color: "#fff" }}>{initials || "U"}</Text>
      </LinearGradient>
    );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel="Change profile photo" accessibilityState={{ busy, disabled: busy }} style={{ position: "relative" }}>
      {inner}
      <View style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: "#667eea", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" }}>
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={"camera" as IoniconsName} size={11} color="#fff" />}
      </View>
    </Pressable>
  );
}

/* ─── Menu Row ───────────────────────────────────────────────────────────── */
function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  danger,
  right,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  loading?: boolean;
}) {
  const { isDark } = useTheme();
  const pressedBg = isDark ? Colors.darkSurface : "#f3f4f6";
  const titleColor = isDark ? Colors.darkText : "#111827";
  const subColor = isDark ? Colors.darkTextMuted : "#6b7280";
  const chevronColor = isDark ? Colors.darkTextMuted : "#9ca3af";
  return (
    <Pressable
      style={({ pressed }) => [st.row, pressed && { backgroundColor: pressedBg }]}
      onPress={onPress}
    >
      <View style={[st.rowIcon, danger && st.rowIconDanger]}>{icon}</View>
      <View style={st.rowText}>
        <Text style={[st.rowTitle, { color: danger ? Colors.danger : titleColor }]}>{title}</Text>
        {subtitle ? <Text style={[st.rowSub, { color: subColor }]}>{subtitle}</Text> : null}
      </View>
      {loading
        ? <ActivityIndicator size="small" color={chevronColor} />
        : right ?? <Feather name="chevron-right" size={16} color={danger ? Colors.danger : chevronColor} />
      }
    </Pressable>
  );
}

/* ─── Divider ────────────────────────────────────────────────────────────── */
const RowDivider = () => {
  const { isDark } = useTheme();
  return <View style={[st.divider, !isDark && { backgroundColor: "#f3f4f6" }]} />;
};

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser, accessToken, hasPhoto, probeHasPhoto } = useAuth();
  const { showAlert, alertDialog } = useProfileAlert();
  const { isDark } = useTheme();

  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const photo = useProfilePhoto(showAlert);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  // The header stays dark in both themes; inactive tabs must not own the status bar.
  useFocusEffect(useCallback(() => {
    if (Platform.OS === "web") return;
    const entry = StatusBar.pushStackEntry({ barStyle: "light-content" });
    return () => StatusBar.popStackEntry(entry);
  }, []));

  /* Refresh everything on every focus */
  useFocusEffect(
    useCallback(() => {
      refreshUser();
      probeHasPhoto();
      if (accessToken) {
        setUsageLoading(true);
        api.study
          .getUsage(accessToken)
          .then(setUsage)
          .catch(() => setUsage(null))
          .finally(() => setUsageLoading(false));
      } else {
        setUsageLoading(false);
      }
    }, [refreshUser, probeHasPhoto, accessToken])
  );


  const displayName = user?.name || "Student";
  const identifier = user?.email || user?.phone || "";

  /* Usage values: ONLY from live API, never from stale cached user object */
  const planName = usage?.tier_name ?? usage?.plan_name ?? null;
  const used = usage?.questions_used ?? null;
  const limit = usage?.question_limit ?? usage?.questions_limit ?? null;
  const usagePct = usage?.percent_used ?? (used !== null && limit && limit > 0 ? Math.min((used / limit) * 100, 100) : 0);
  const barColor = usagePct >= 90 ? Colors.danger : usagePct >= 70 ? Colors.warning : Colors.primary;

  /* Status badge — derived inline to avoid React Compiler issues with module-level helpers */
  const badgeLabel = (() => {
    switch (usage?.status) {
      case "active":        return "Active";
      case "grace_period":  return "⚠️ Grace Period";
      case "past_due":      return "❌ Past Due";
      case "cancelled":     return "Cancelled";
      default:              return "Free";
    }
  })();
  const badgeBg = (() => {
    switch (usage?.status) {
      case "active":        return { backgroundColor: "rgba(34,197,94,0.20)",   borderColor: "rgba(34,197,94,0.30)" };
      case "grace_period":  return { backgroundColor: "rgba(245,158,11,0.20)", borderColor: "rgba(245,158,11,0.30)" };
      case "past_due":      return { backgroundColor: "rgba(239,68,68,0.20)",   borderColor: "rgba(239,68,68,0.30)" };
      default:              return { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" };
    }
  })();
  const badgeTextColor = (() => {
    switch (usage?.status) {
      case "active":        return "#4ade80";
      case "grace_period":  return "#fbbf24";
      case "past_due":      return "#f87171";
      default:              return "#9ca3af";
    }
  })();

  const handleLogout = () =>
    showAlert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          setLoggingOut(false);
        },
      },
    ]);

  const handleDeleteAccount = () =>
    showAlert(
      "Delete Account",
      "This will permanently delete your account and all your data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (accessToken) {
              try {
                await api.profile.deleteAccount(accessToken);
              } catch (e) {
                showAlert("Delete Failed", e instanceof Error ? e.message : "Your account could not be deleted. Please try again.");
                return;
              }
            } else {
              showAlert("Delete Failed", "Please sign in again.");
              return;
            }
            await logout({ localOnly: true });
          },
        },
      ]
    );

  const pageBgColors = isDark
    ? [Colors.darkBg1, Colors.darkBg2] as const
    : ["#eff6ff", "#ffffff", "#faf5ff"] as const;
  const cardBg = isDark ? Colors.darkCard : "#ffffff";
  const cardBorder = isDark ? Colors.darkCardBorder : "#e5e7eb";
  const textMain = isDark ? "#ffffff" : "#111827";
  const textMuted = isDark ? Colors.darkTextMuted : "#374151";
  const dividerColor = isDark ? Colors.darkDivider : "#f3f4f6";
  const rowPressedBg = isDark ? Colors.darkSurface : "#f9fafb";

  return (
    <LinearGradient
      colors={pageBgColors}
      style={st.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={[Colors.navHeader1, Colors.navHeader2, Colors.navHeader3]}
        style={[st.header, { paddingTop: topInset + 14 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={st.avatarRow}>
          <Avatar name={displayName} token={accessToken} hasPhoto={hasPhoto} size={70} onPress={photo.openPicker} busy={photo.busy} />
          <View style={st.nameBlock}>
            <Text style={st.userName} numberOfLines={1}>{displayName}</Text>
            {!!identifier && <Text style={st.userIdentifier} numberOfLines={1}>{identifier}</Text>}
            {(user?.board || user?.className) && (
              <View style={st.eduRow}>
                <MaterialIcons name={"school" as MaterialIconName} size={11} color={Colors.navLogoEdw} />
                <Text style={st.eduText} numberOfLines={1}>
                  {[user?.board, user?.className].filter(Boolean).join(" · ")}
                </Text>
              </View>
            )}
            {user?.state && (
              <View style={st.eduRow}>
                <MaterialIcons name={"location-on" as MaterialIconName} size={11} color="rgba(255,255,255,0.45)" />
                <Text style={st.stateText} numberOfLines={1}>{user.state}</Text>
              </View>
            )}
          </View>
          {planName && (
            <View style={st.planBadge}>
              <Text style={st.planBadgeText}>{planName}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.content, { paddingBottom: bottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Usage / Plan Card ── */}
        <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={st.planHeader}>
            <LinearGradient colors={[Colors.primary, Colors.secondary]} style={st.planIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name={"flash" as IoniconsName} size={15} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[st.planLabel, { color: textMuted }]}>Current Plan</Text>
              {usageLoading
                ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 2 }} />
                : <Text style={[st.planName, { color: textMain }]}>{planName ?? "—"}</Text>
              }
            </View>
            {!usageLoading && usage && (
              <View style={[st.activeBadge, badgeBg]}>
                <Text style={[st.activeBadgeText, { color: badgeTextColor }]}>{badgeLabel}</Text>
              </View>
            )}
          </View>

          {/* Usage bar */}
          {usageLoading ? (
            <View style={st.usageSkeleton}>
              <View style={st.skeletonLine} />
              <View style={st.skeletonBar} />
              <View style={[st.skeletonLine, { width: "55%" }]} />
            </View>
          ) : used !== null && limit !== null ? (
            <View style={st.usageSection}>
              <View style={st.usageTopRow}>
                <Text style={[st.usageLabel, { color: textMain }]}>Questions Used</Text>
                <Text style={[st.usageCount, { color: textMain }]}>
                  {used}<Text style={[st.usageLimit, { color: textMuted }]}> / {limit}</Text>
                </Text>
              </View>
              <View style={[st.progressBg, !isDark && { backgroundColor: "#e5e7eb" }]}>
                <View style={[st.progressFill, { width: `${usagePct}%` as DimensionValue, backgroundColor: barColor }]} />
              </View>
              <Text style={[st.usageRemaining, { color: textMuted }]}>{limit - used} questions remaining this month</Text>
              {!!(usage?.period_end ?? usage?.renewal_date) && (
                <Text style={[st.renewalDate, { color: textMuted }]}>
                  Resets on: {new Date((usage?.period_end ?? usage?.renewal_date)!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* ── Account Section ── */}
        <View style={st.section}>
          <Text style={[st.sectionLabel, { color: textMuted }]}>Account</Text>
          <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <MenuRow
              icon={<Feather name={"user" as FeatherName} size={17} color={Colors.primary} />}
              title="Edit Account"
              subtitle="Name, email, phone number and photo"
              onPress={() => setShowAccount(true)}
            />
            <RowDivider />
            <MenuRow
              icon={<MaterialIcons name={"school" as MaterialIconName} size={17} color={Colors.primary} />}
              title="Academic Details"
              subtitle={user?.board ? `${user.board}${user.className ? ` · Class ${user.className}` : ""}` : "State, board, class and medium"}
              onPress={() => setShowEducation(true)}
            />
            <RowDivider />
            <MenuRow
              icon={<Feather name={"shield" as FeatherName} size={17} color={Colors.primary} />}
              title="Active Sessions"
              subtitle="Devices where you are signed in"
              onPress={() => setShowSessions(true)}
            />
          </View>
        </View>

        {/* ── Payment ── */}
        <View style={st.section}>
          <Text style={[st.sectionLabel, { color: textMuted }]}>Payment</Text>
          <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={st.payNotice}>
              <View style={st.payNoticeIcon}>
                <Ionicons name={"card-outline" as IoniconsName} size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.payTitle}>Manage your subscription</Text>
                <Text style={st.paySub}>Payments, billing and plan upgrades are managed at edwai.com</Text>
                <Pressable onPress={() => Linking.openURL("https://edwai.com").catch(() => {})} style={st.payLink}>
                  <Text style={st.payLinkText}>Visit edwai.com →</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* ── Info & Legal ── */}
        <View style={st.section}>
          <Text style={[st.sectionLabel, { color: textMuted }]}>Information</Text>
          <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <MenuRow
              icon={<Feather name={"bell" as FeatherName} size={17} color={Colors.primary} />}
              title="Notifications"
              subtitle="Manage notification preferences"
              onPress={() => showAlert("Coming Soon", "Notification settings will be available soon.")}
            />
            <RowDivider />
            <MenuRow
              icon={<Feather name={"shield" as FeatherName} size={17} color={Colors.primary} />}
              title="Privacy Policy"
              onPress={() => Linking.openURL("https://edwai.com/privacy").catch(() => showAlert("Privacy Policy", "Visit edwai.com/privacy for our full privacy policy."))}
            />
            <RowDivider />
            <MenuRow
              icon={<Feather name={"file-text" as FeatherName} size={17} color={Colors.primary} />}
              title="Terms of Service"
              onPress={() => Linking.openURL("https://edwai.com/terms").catch(() => showAlert("Terms of Service", "Visit edwai.com/terms for our terms of service."))}
            />
          </View>
        </View>

        {/* ── Danger Zone ── */}
        <View style={st.section}>
          <Text style={[st.sectionLabel, { color: textMuted }]}>Account Actions</Text>
          <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <MenuRow
              icon={<Feather name={"log-out" as FeatherName} size={17} color={Colors.danger} />}
              title={loggingOut ? "Signing out…" : "Sign Out"}
              danger
              onPress={handleLogout}
              loading={loggingOut}
            />
            <RowDivider />
            <MenuRow
              icon={<Feather name={"trash-2" as FeatherName} size={17} color={Colors.danger} />}
              title="Delete Account"
              subtitle="Permanently delete your account and all data"
              danger
              onPress={handleDeleteAccount}
            />
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={st.footer}>
          <View style={st.madeInIndia}>
            <Text style={st.madeInIndiaText}>Made in India 🇮🇳</Text>
          </View>
          <Text style={st.version}>EdwAI v1.0.0</Text>
        </View>
      </ScrollView>

      <AccountEditModal
        visible={showAccount}
        onClose={() => setShowAccount(false)}
        photo={photo}
      />
      <EducationEditModal visible={showEducation} onClose={() => setShowEducation(false)} />
      <SessionsModal visible={showSessions} onClose={() => setShowSessions(false)} />
      {!showAccount && <ProfilePhotoCropModal asset={photo.asset} busy={photo.busy} onCancel={photo.cancel} onSave={photo.save} />}
      {alertDialog}
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },

  /* header */
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  nameBlock: { flex: 1, gap: 2 },
  userName: { fontSize: 19, fontFamily: "Inter_700Bold", color: "#fff" },
  userIdentifier: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },
  eduRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  eduText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.navLogoEdw, flex: 1 },
  stateText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", flex: 1 },
  planBadge: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", alignSelf: "flex-start" },
  planBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },

  /* scroll */
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, gap: 4 },

  /* section label */
  section: { gap: 6, marginTop: 10 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.darkTextMuted, textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 4 },

  /* card */
  card: { backgroundColor: Colors.darkCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.darkCardBorder, overflow: "hidden" },

  /* plan card internals */
  planHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  planIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  planLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
  planName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText, marginTop: 1 },
  activeBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  activeBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  usageSkeleton: { padding: 18, gap: 10 },
  skeletonLine: { height: 12, backgroundColor: Colors.darkSurface, borderRadius: 6, width: "80%" },
  skeletonBar: { height: 8, backgroundColor: Colors.darkSurface, borderRadius: 4, width: "100%" },

  usageSection: { padding: 18, gap: 8 },
  usageTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  usageLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.darkTextSub },
  usageCount: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.darkText },
  usageLimit: { fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, fontSize: 13 },
  progressBg: { height: 8, borderRadius: 4, backgroundColor: Colors.darkSurface, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  usageRemaining: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
  renewalDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, marginTop: -2 },

  /* payment */
  payNotice: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 18 },
  payNoticeIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(102,126,234,0.15)", alignItems: "center", justifyContent: "center" },
  payTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.darkText },
  paySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, lineHeight: 18 },
  payLink: { marginTop: 4 },
  payLinkText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },

  /* menu row */
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(102,126,234,0.14)", alignItems: "center", justifyContent: "center" },
  rowIconDanger: { backgroundColor: "rgba(220,38,38,0.14)" },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.darkText },
  rowTitleDanger: { color: Colors.danger },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.darkDivider, marginLeft: 62 },

  /* footer */
  footer: { alignItems: "center", gap: 6, paddingTop: 16 },
  madeInIndia: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  madeInIndiaText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.darkTextSub, letterSpacing: 0.5 },
  version: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
});
