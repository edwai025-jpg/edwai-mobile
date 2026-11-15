import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

export default function RightsFooter({ isDark = false }: { isDark?: boolean }) {
  return (
    <View style={styles.footer}>
      <View style={[styles.divider, { backgroundColor: isDark ? Colors.darkTextMuted : Colors.gray300 }]} />
      <Text style={[styles.text, { color: isDark ? Colors.gray300 : Colors.gray600 }]}>
        All rights reserved @ INNIVAI AI SOLUTIONS PVT LTD.
      </Text>
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
});
