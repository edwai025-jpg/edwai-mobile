import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

type EdwAILogoProps = {
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: 18,
  md: 22,
  lg: 26,
};

export function EdwAILogo({ size = "md" }: EdwAILogoProps) {
  const fontSize = SIZES[size];
  return (
    <View style={styles.row}>
      <Text style={[styles.edw, { fontSize }]}>Edw</Text>
      <Text style={[styles.ai, { fontSize }]}>AI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  edw: {
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  ai: {
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
  },
});
