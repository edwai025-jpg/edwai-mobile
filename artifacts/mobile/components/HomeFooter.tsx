import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Path, Svg } from "react-native-svg";

import { Colors } from "@/constants/colors";
import { SHOW_WEB_PAYMENTS } from "@/constants/storePolicy";

const QUICK_LINKS = [
  { label: "Home", href: "https://eduwai.in/login" },
  { label: "Features", href: "https://eduwai.in/login" },
  { label: "How It Works", href: "https://eduwai.in/login" },
  ...(SHOW_WEB_PAYMENTS ? [{ label: "Pricing", href: "https://eduwai.in/login" }] : []),
  { label: "For Schools & Institutes", href: "https://eduwai.in/login" },
  { label: "Project Vaigyaan", href: "https://eduwai.in/login", isNew: true },
  { label: "Login / Sign Up", href: "https://eduwai.in/login" },
];

const SOCIAL = [
  { name: "YouTube", icon: "youtube" as const, href: "https://youtube.com/@edwai" },
  { name: "Telegram", icon: "send" as const, href: "https://t.me/edwai" },
  { name: "Instagram", icon: "instagram" as const, href: "https://instagram.com/edwai" },
];

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const BG = "#1e2235";
const BG_CARD = "#272b3f";
const TEXT_MUTED = "#8b92b5";
const TEXT_DIM = "#6b7280";
const DIVIDER = "#2e3450";
const WAVE_H = 48;

function openLink(href: string) {
  Linking.openURL(href).catch(() =>
    Alert.alert("Cannot open link", "Please visit https://eduwai.in/login in your browser")
  );
}

interface HomeFooterProps {
  parentPadding?: number;
}

export function HomeFooter({ parentPadding = 24 }: HomeFooterProps) {
  const screenW = Dimensions.get("window").width;
  const px = parentPadding + 4;

  const wavePath = `M 0 ${WAVE_H} Q ${screenW / 2} 0 ${screenW} ${WAVE_H} L ${screenW} ${WAVE_H} L 0 ${WAVE_H} Z`;

  return (
    <View style={[styles.wrapper, { marginHorizontal: -parentPadding }]}>
      <Svg
        width={screenW}
        height={WAVE_H}
        style={styles.wave}
        viewBox={`0 0 ${screenW} ${WAVE_H}`}
      >
        <Path d={wavePath} fill={BG} />
      </Svg>

      <View style={[styles.body, { paddingHorizontal: px }]}>
        <View style={styles.columns}>
          <View style={styles.col}>
            <Text style={styles.colHeader}>QUICK LINKS</Text>
            {QUICK_LINKS.map((link) => (
              <Pressable
                key={link.label}
                style={({ pressed }) => [
                  styles.linkRow,
                  pressed && { opacity: 0.65 },
                ]}
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
                style={({ pressed }) => [
                  styles.contactRow,
                  pressed && { opacity: 0.65 },
                ]}
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
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => openLink(s.href)}
                    accessibilityLabel={s.name}
                  >
                    <Feather name={s.icon} size={16} color={TEXT_MUTED} />
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
            <Pressable onPress={() => openLink("https://eduwai.in/login")}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => openLink("https://eduwai.in/login")}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => openLink("https://eduwai.in/login")}>
              <Text style={styles.legalLink}>Refund Policy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 32,
    overflow: "visible",
  },
  wave: {
    display: "flex",
  },
  body: {
    backgroundColor: BG,
    paddingBottom: 28,
    paddingTop: 4,
  },
  columns: {
    flexDirection: "row",
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
