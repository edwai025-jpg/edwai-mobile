import { Feather } from "@expo/vector-icons";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";

/** Contact address shown under the rights line; tapping opens the phone's email app. */
export const CONTACT_EMAIL = "info@innivai.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("EDUwAI enquiry")}`;

// `style` lets a screen tighten the spacing (e.g. directly under another footer line).
export default function RightsFooter({ isDark = false, style }: { isDark?: boolean; style?: StyleProp<ViewStyle> }) {
  const linkColor = isDark ? "#a78bfa" : "#6d28d9";
  return (
    <View style={[styles.footer, style]}>
      <View style={[styles.divider, { backgroundColor: isDark ? Colors.darkTextMuted : Colors.gray300 }]} />
      {/* One line on every phone: shrinks slightly instead of wrapping */}
      <Text style={[styles.text, { color: isDark ? Colors.gray300 : Colors.gray600 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        All rights reserved @ INNIVAI AI SOLUTIONS PVT LTD.
      </Text>
      {/* Contact line — opens the email app */}
      <Pressable
        onPress={() => { Linking.openURL(CONTACT_MAILTO).catch(() => {}); }}
        accessibilityRole="link"
        accessibilityLabel={`Email ${CONTACT_EMAIL}`}
        hitSlop={8}
        style={styles.contact}
      >
        <Feather name="mail" size={11} color={linkColor} />
        <Text style={[styles.text, { color: isDark ? Colors.gray300 : Colors.gray600 }]} numberOfLines={1}>
          For info: <Text style={[styles.link, { color: linkColor }]}>{CONTACT_EMAIL}</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 36,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  divider: {
    width: 48,
    height: 1,
    marginBottom: 12,
  },
  text: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
  contact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    paddingVertical: 2,
  },
  link: {
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
  },
});
