import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

export default function RightsFooter({ isDark = false }: { isDark?: boolean }) {
  return (
    <View style={[styles.footer, { borderTopColor: isDark ? Colors.darkDivider : Colors.gray200 }]}>
      <Text style={[styles.text, { color: isDark ? Colors.gray300 : Colors.gray600 }]}>
        All rights reserved @ INNIVAI AI SOLUTIONS PVT LTD.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 20,
    paddingTop: 16,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },
});
