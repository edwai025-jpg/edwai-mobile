import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { T, shadow } from "./ui";

const STEPS = [
  { n: 1, title: "Your details", body: "Add your name. Mobile verification is optional.", bg: "#eff6ff", fg: "#1d4ed8", bd: "#dbeafe" },
  { n: 2, title: "Your curriculum", body: "Choose your state, board, and available class.", bg: "#f5f3ff", fg: "#6d28d9", bd: "#ede9fe" },
  { n: 3, title: "Start learning", body: "Use onboarded content or continue with your own resources.", bg: "#ecfdf5", fg: "#047857", bd: "#d1fae5" },
];

export default function SetupGuide() {
  return (
    <View style={g.card}>
      <View style={g.header}>
        <View style={g.labelRow}>
          <View style={g.pill}><Text style={g.pillText}>QUICK SETUP GUIDE</Text></View>
          <Text style={g.time}>About 2 minutes</Text>
        </View>
        <Text style={g.h} accessibilityRole="header">Complete your profile in 3 simple steps</Text>
      </View>
      <View style={g.grid}>
        {STEPS.map((st) => (
          <View key={st.n} style={[g.mini, { backgroundColor: st.bg, borderColor: st.bd }]} accessible accessibilityLabel={`Step ${st.n}. ${st.title}. ${st.body}`}>
            <View style={g.titleRow}>
              <View style={g.num}><Text style={g.numText}>{st.n}</Text></View>
              <Text style={[g.mt, { color: st.fg }]}>{st.title}</Text>
            </View>
            <Text style={g.mb}>{st.body}</Text>
          </View>
        ))}
      </View>
      <View style={g.tip}>
        <Text style={g.tipText}>Can’t find your board or class? Send us the name during setup and continue immediately with your own books.</Text>
      </View>
    </View>
  );
}

const g = StyleSheet.create({
  card: { backgroundColor: T.white, borderRadius: 16, borderWidth: 1, borderColor: T.indigo100, overflow: "hidden", ...shadow },
  header: { backgroundColor: "#24104f", padding: 20 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  pill: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: T.indigo100, fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  time: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "500" },
  h: { color: T.white, fontSize: 20, fontWeight: "700", lineHeight: 26 },
  grid: { padding: 16, gap: 12 },
  mini: { borderRadius: 12, borderWidth: 1, padding: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: T.white, alignItems: "center", justifyContent: "center", ...shadow, elevation: 1, shadowOpacity: 0.05 },
  numText: { fontSize: 12, fontWeight: "900", color: T.g900 },
  mt: { fontSize: 13, fontWeight: "700", flex: 1 },
  mb: { fontSize: 12, lineHeight: 19, color: T.g600 },
  tip: { marginHorizontal: 16, marginBottom: 16, backgroundColor: T.amber50, borderColor: T.amber100, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  tipText: { fontSize: 12, lineHeight: 19, color: T.amber800 },
});
