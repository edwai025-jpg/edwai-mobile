import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";

const QUICK_LINKS = [
  { label: "Home", href: "https://edwai.com" },
  { label: "Features", href: "https://edwai.com/features" },
  { label: "How It Works", href: "https://edwai.com/how-it-works" },
  { label: "Pricing", href: "https://edwai.com/pricing" },
  { label: "For Schools & Institutes", href: "https://edwai.com/schools" },
  { label: "Project Vaigyaan", href: "https://edwai.com/vaigyaan", isNew: true },
  { label: "Login / Sign Up", href: "https://edwai.com/login" },
];

const SOCIAL = [
  {
    name: "YouTube",
    icon: "youtube" as const,
    href: "https://youtube.com/@edwai",
    color: "#FF0000",
  },
  {
    name: "Telegram",
    icon: "send" as const,
    href: "https://t.me/edwai",
    color: "#229ED9",
  },
  {
    name: "Instagram",
    icon: "instagram" as const,
    href: "https://instagram.com/edwai",
    color: "#E1306C",
  },
];

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

function openLink(href: string) {
  Linking.openURL(href).catch(() =>
    Alert.alert("Cannot open link", "Please visit edwai.com in your browser")
  );
}

export function HomeFooter() {
  return (
    <View style={styles.root}>
      <View style={styles.topDivider} />

      <View style={styles.columns}>
        <View style={styles.col}>
          <Text style={styles.colHeader}>QUICK LINKS</Text>
          {QUICK_LINKS.map((link) => (
            <Pressable
              key={link.label}
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
              onPress={() => openLink(link.href)}
            >
              <Text style={styles.bullet}>›</Text>
              <Text style={styles.linkText}>{link.label}</Text>
              {link.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <View style={styles.dividerV} />

        <View style={styles.col}>
          <Text style={styles.colHeader}>CONTACT US</Text>

          <View style={styles.contactSection}>
            <Text style={styles.contactLabel}>EMAIL</Text>
            <Pressable
              style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
              onPress={() => openLink("mailto:support@edwai.com")}
            >
              <Feather name={"mail" as FeatherIconName} size={13} color={Colors.primaryLight} />
              <Text style={styles.contactValue}>support@edwai.com</Text>
            </Pressable>
          </View>

          <View style={styles.contactSection}>
            <Text style={styles.contactLabel}>LOCATION</Text>
            <View style={styles.contactRow}>
              <Feather name={"map-pin" as FeatherIconName} size={13} color={Colors.primaryLight} />
              <Text style={styles.contactValue}>India 🇮🇳</Text>
            </View>
          </View>

          <View style={styles.contactSection}>
            <Text style={styles.contactLabel}>FOLLOW US</Text>
            <View style={styles.socialRow}>
              {SOCIAL.map((s) => (
                <Pressable
                  key={s.name}
                  style={({ pressed }) => [
                    styles.socialBtn,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => openLink(s.href)}
                  accessibilityLabel={s.name}
                >
                  <Feather name={s.icon} size={16} color={styles.socialIcon.color} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.bottomDivider} />

      <View style={styles.bottomBar}>
        <Text style={styles.copyright}>© 2025 EdwAI. All rights reserved.</Text>
        <View style={styles.legalLinks}>
          <Pressable onPress={() => openLink("https://edwai.com/privacy")}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => openLink("https://edwai.com/terms")}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => openLink("https://edwai.com/refund")}>
            <Text style={styles.legalLink}>Refund Policy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const BG = "#1e2235";
const BG_CARD = "#272b3f";
const TEXT_MUTED = "#8b92b5";
const TEXT_DIM = "#6b7280";
const DIVIDER = "#2e3450";

const styles = StyleSheet.create({
  root: {
    backgroundColor: BG,
    marginHorizontal: -16,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
  },
  topDivider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginBottom: 24,
  },
  columns: {
    flexDirection: "row",
    gap: 0,
  },
  col: {
    flex: 1,
    gap: 6,
  },
  dividerV: {
    width: 1,
    backgroundColor: DIVIDER,
    marginHorizontal: 16,
  },
  colHeader: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: TEXT_MUTED,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  bullet: {
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 18,
  },
  linkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    flex: 1,
  },
  newBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  newBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  contactSection: {
    marginBottom: 14,
  },
  contactLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: TEXT_DIM,
    letterSpacing: 1,
    marginBottom: 5,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    flex: 1,
  },
  socialRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  socialBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: BG_CARD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  socialIcon: {
    color: TEXT_MUTED,
  },
  bottomDivider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginTop: 24,
    marginBottom: 14,
  },
  bottomBar: {
    gap: 6,
  },
  copyright: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: TEXT_DIM,
  },
  legalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    alignItems: "center",
  },
  legalLink: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
  },
  legalDot: {
    fontSize: 11,
    color: TEXT_DIM,
  },
});
