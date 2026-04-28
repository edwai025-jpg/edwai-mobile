import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  DimensionValue,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ProfileModal from "@/components/ProfileModal";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];
type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <LinearGradient
      colors={["#7c3aed", "#4f46e5"]}
      style={avatarStyles.wrap}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={avatarStyles.text}>{initials || "U"}</Text>
    </LinearGradient>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  text: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
});

type MenuItemProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  rightContent?: React.ReactNode;
};

function MenuItem({ icon, title, subtitle, onPress, danger, rightContent }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && { backgroundColor: Colors.darkSurface },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        {icon}
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
      </View>
      {rightContent ?? (
        <Feather
          name="chevron-right"
          size={16}
          color={danger ? Colors.danger : Colors.darkTextMuted}
        />
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const displayName = user?.name || "Student";
  const identifier = user?.email || user?.phone || "";
  const used = user?.questionsUsed ?? 5;
  const limit = user?.questionsLimit ?? 1500;
  const usagePct = Math.min((used / limit) * 100, 100);
  const barColor = usagePct >= 90 ? Colors.danger : usagePct >= 70 ? Colors.warning : Colors.primary;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
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
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => { await logout(); } },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.navHeader1, Colors.navHeader2, Colors.navHeader3]}
        style={[styles.profileHeader, { paddingTop: topInset + 16 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.avatarRow}>
          <Avatar name={displayName} />
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            {identifier ? (
              <Text style={styles.userIdentifier} numberOfLines={1}>{identifier}</Text>
            ) : null}
            {user?.state && user?.board && (
              <View style={styles.educationRow}>
                <MaterialIcons name="school" size={12} color={Colors.navLogoEdw} />
                <Text style={styles.educationText} numberOfLines={1}>
                  {user.board}{user.className ? ` · ${user.className}` : ""}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.planBadgeSmall}>
            <Text style={styles.planBadgeSmallText}>{user?.plan ?? "Reader"}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              style={styles.planIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={"flash" as IoniconsName} size={16} color={Colors.white} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.planLabel}>Current Plan</Text>
              <Text style={styles.planName}>{user?.plan ?? "Reader Model"}</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>

          <View style={styles.usageSection}>
            <View style={styles.usageTopRow}>
              <Text style={styles.usageLabel}>Questions Used</Text>
              <Text style={styles.usageCount}>
                {used}
                <Text style={styles.usageLimit}> / {limit}</Text>
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${usagePct}%` as DimensionValue, backgroundColor: barColor },
                ]}
              />
            </View>
            <Text style={styles.usageRemaining}>
              {limit - used} questions remaining this month
            </Text>
          </View>

          <View style={styles.planNotice}>
            <Ionicons name={"globe-outline" as IoniconsName} size={14} color={Colors.darkTextMuted} />
            <Text style={styles.planNoticeText}>
              To manage your plan, visit edwai.com
            </Text>
          </View>
        </View>

        {user?.state && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Academic Details</Text>
            {(
              [
                { label: "State", value: user.state, icon: "location-on" as MaterialIconName },
                { label: "Board", value: user.board, icon: "school" as MaterialIconName },
                { label: "Class", value: user.className, icon: "class" as MaterialIconName },
              ] as Array<{ label: string; value: string | undefined; icon: MaterialIconName }>
            )
              .filter((d) => d.value)
              .map((d, i) => (
                <View key={i} style={styles.detailRow}>
                  <MaterialIcons name={d.icon} size={15} color={Colors.primary} />
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{d.value}</Text>
                </View>
              ))}
          </View>
        )}

        <View style={styles.menuCard}>
          <Text style={styles.menuSectionLabel}>Account</Text>
          <MenuItem
            icon={<Feather name="user" size={17} color={Colors.primary} />}
            title="Edit Profile"
            subtitle="Update your name, education and details"
            onPress={() => setShowProfileModal(true)}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon={<Ionicons name={"notifications-outline" as IoniconsName} size={17} color={Colors.primary} />}
            title="Notifications"
            subtitle="Manage your notification preferences"
            onPress={() => Alert.alert("Coming Soon", "Notification settings will be available soon")}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon={<Feather name="shield" size={17} color={Colors.primary} />}
            title="Privacy Policy"
            onPress={() => Alert.alert("Privacy Policy", "Visit edwai.com/privacy for our full privacy policy")}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon={<Feather name="file-text" size={17} color={Colors.primary} />}
            title="Terms of Service"
            onPress={() => Alert.alert("Terms of Service", "Visit edwai.com/terms for our terms of service")}
          />
        </View>

        <View style={styles.menuCard}>
          <Text style={styles.menuSectionLabel}>Danger Zone</Text>
          <MenuItem
            icon={<Feather name="log-out" size={17} color={Colors.danger} />}
            title={loggingOut ? "Signing out..." : "Sign Out"}
            danger
            onPress={handleLogout}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon={<Feather name="trash-2" size={17} color={Colors.danger} />}
            title="Delete Account"
            subtitle="Permanently delete your data"
            danger
            onPress={handleDelete}
          />
        </View>

        <View style={styles.footer}>
          <View style={styles.madeInIndia}>
            <Text style={styles.madeInIndiaText}>Made in India 🇮🇳</Text>
          </View>
          <Text style={styles.version}>EdwAI v1.0.0</Text>
        </View>
      </ScrollView>

      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg1 },
  profileHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    marginBottom: 2,
  },
  userIdentifier: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginBottom: 5,
  },
  educationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  educationText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.navLogoEdw,
    flex: 1,
  },
  planBadgeSmall: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  planBadgeSmallText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  planCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    gap: 16,
  },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  planLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
  },
  planName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.darkText,
  },
  activeBadge: {
    backgroundColor: "rgba(22,163,74,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.3)",
  },
  activeBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#22c55e",
  },
  usageSection: { gap: 8 },
  usageTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  usageLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextSub,
  },
  usageCount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.darkText,
  },
  usageLimit: {
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
    fontSize: 13,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.darkSurface,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  usageRemaining: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
  },
  planNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.darkSurface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.darkDivider,
  },
  planNoticeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextSub,
    flex: 1,
  },
  detailsCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    gap: 12,
  },
  detailsTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.darkTextSub,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
    width: 52,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.darkText,
    flex: 1,
  },
  menuCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
  },
  menuSectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.darkTextMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(102,126,234,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDanger: { backgroundColor: "rgba(220,38,38,0.15)" },
  menuText: { flex: 1 },
  menuTitle: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.darkText,
  },
  menuTitleDanger: { color: Colors.danger },
  menuSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.darkDivider,
    marginLeft: 64,
  },
  footer: { alignItems: "center", gap: 6, paddingTop: 8 },
  madeInIndia: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  madeInIndiaText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.darkTextSub,
    letterSpacing: 0.5,
  },
  version: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
  },
});
