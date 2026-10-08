import { platformShadow } from "@/constants/shadow";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type FeatherName = React.ComponentProps<typeof Feather>["name"];

function AvatarCircle({ name }: { name: string }) {
  const initial = name?.trim()[0]?.toUpperCase() || "U";
  return (
    <View style={styles.avatarRing}>
      <LinearGradient
        colors={["#7c3aed", "#4f46e5"]}
        style={styles.avatarGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.avatarInitial}>{initial}</Text>
      </LinearGradient>
    </View>
  );
}

function Chip({ icon, label, value }: { icon: FeatherName; label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Feather name={icon} size={9} color="rgba(255,255,255,0.5)" />
      <Text style={styles.chipLabel}>{label} </Text>
      <Text style={styles.chipValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export function NavHeader() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const used = user?.questionsUsed ?? 5;
  const limit = user?.questionsLimit ?? 1500;
  const pct = Math.min(used / limit, 1);
  const barColor = pct >= 0.9 ? "#ef4444" : pct >= 0.7 ? "#f59e0b" : "#10b981";

  return (
    <LinearGradient
      colors={[Colors.navHeader1, Colors.navHeader2, Colors.navHeader3, Colors.navHeader4]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.root, { paddingTop: topPad + 8 }]}
    >
      <View style={styles.decorDots} />

      <View style={styles.row1}>
        <View style={styles.logoBlock}>
          <Text style={styles.logoEdw}>Edw</Text>
          <Text style={styles.logoAI}>AI</Text>
        </View>

        <View style={styles.vDivider} />

        <View style={styles.userBlock}>
          <AvatarCircle name={user?.name || "User"} />
          <View style={styles.userText}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || "Student"}
            </Text>
            <Text style={styles.userSub} numberOfLines={1}>
              {user?.phone || user?.email || ""}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.usagePill}>
          <Ionicons
            name={"flash" as IoniconsName}
            size={11}
            color={barColor}
          />
          <Text style={styles.usageText}>
            {used}
            <Text style={styles.usageLimit}>/{limit}</Text>
          </Text>
          <View style={styles.usageBarWrap}>
            <View style={[styles.usageBarFill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
          </View>
        </View>
      </View>

      {(user?.state || user?.board || user?.className) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chips}
          contentContainerStyle={styles.chipsContent}
        >
          {user?.state && (
            <Chip icon="map-pin" label="State" value={user.state} />
          )}
          {user?.board && (
            <Chip icon="award" label="Board" value={user.board} />
          )}
          {user?.className && (
            <Chip icon="book-open" label="Class" value={user.className} />
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    ...platformShadow("rgba(99,71,234,0.35)", 0, 4, 1, 16),
    elevation: 10,
    zIndex: 10,
  },
  decorDots: {
    ...StyleSheet.absoluteFill,
    opacity: 0.07,
  },
  row1: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  logoBlock: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  logoEdw: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.navLogoEdw,
    letterSpacing: -0.5,
  },
  logoAI: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  vDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  userBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    padding: 2,
    backgroundColor: "rgba(167,139,250,0.35)",
  },
  avatarGrad: {
    flex: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  userText: {
    maxWidth: 90,
  },
  userName: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    lineHeight: 15,
  },
  userSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 13,
  },
  usagePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  usageText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  usageLimit: {
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
  },
  usageBarWrap: {
    width: 36,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  usageBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  chips: {
    marginHorizontal: -4,
  },
  chipsContent: {
    gap: 6,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.navChipBg,
    borderWidth: 1,
    borderColor: Colors.navChipBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  chipValue: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    maxWidth: 80,
  },
});
