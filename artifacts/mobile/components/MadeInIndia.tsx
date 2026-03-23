import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

export function MadeInIndia() {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>Made in India</Text>
      <Text style={styles.flag}> 🇮🇳</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.gray500,
  },
  flag: {
    fontSize: 14,
  },
});
