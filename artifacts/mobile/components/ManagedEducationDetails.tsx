import React from "react";
import { Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import type { UserProfile } from "@/context/auth";

export default function ManagedEducationDetails({ user }: { user: UserProfile | null }) {
  const details = [
    ["Institute", user?.orgName],
    ["Class", user?.className],
    ["Medium", user?.medium],
  ];
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ color: Colors.darkTextMuted, fontFamily: "Inter_400Regular", lineHeight: 20 }}>
        Your education details are managed by your institution and cannot be changed here.
      </Text>
      {details.map(([label, value]) => value ? (
        <View key={label} style={{ gap: 4 }}>
          <Text style={{ color: Colors.darkTextMuted, fontFamily: "Inter_400Regular" }}>{label}</Text>
          <Text style={{ color: Colors.darkText, fontFamily: "Inter_600SemiBold" }}>{value}</Text>
        </View>
      ) : null)}
    </View>
  );
}
