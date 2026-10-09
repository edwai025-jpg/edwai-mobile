import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { legalUrls, mutationErrorMessage } from "@/services/onboarding";
import { ActionButton, Checkbox, ErrorLine, openExternal, T, shadow } from "./ui";

export default function OrgTerms({ onDone }: { onDone: () => void }) {
  const { user, acceptOrgTerms, logout } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Leave setup?", "Going back signs you out. You can sign in again to finish setup.", [
        { text: "Stay", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => {
          void logout().finally(() => router.replace("/login"));
        } },
      ]);
      return true;
    });
    return () => subscription.remove();
  }, [logout, router]);
  const insets = useSafeAreaInsets();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");

  const open = async (url: string) => {
    if (!(await openExternal(url))) setError("Could not open the link. Please try again.");
  };
  const link = (label: string, url: string) => (
    <Text accessibilityRole="link" onPress={(event) => { event.stopPropagation(); void open(url); }} style={t.link}>{label}</Text>
  );

  const accept = async () => {
    if (lock.current) return;
    if (!accepted) { setError("Please read and accept the terms to continue."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      await acceptOrgTerms();
      onDone();
    } catch (e) {
      setError(mutationErrorMessage(e, "Could not save your acceptance. Please try again."));
    } finally { lock.current = false; setBusy(false); }
  };

  const b = (x: string) => <Text style={{ fontWeight: "500", color: T.g700 }}>{x}</Text>;
  return (
    <LinearGradient colors={["#eff6ff", "#ffffff", "#eef2ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[t.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={t.card}>
          <LinearGradient colors={["#2563eb", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={t.header}>
            <View style={t.tile}><Feather name="book-open" size={32} color={T.white} /></View>
            <Text style={t.h1} accessibilityRole="header">Welcome to EDUwAI</Text>
            {user?.orgName ? <Text style={t.org}>via {user.orgName}</Text> : null}
          </LinearGradient>
          <View style={t.body}>
            <Text style={t.intro}>Before you start, please review and accept the terms below.</Text>
            <View style={t.preview}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                <Text style={t.p}>By using EDUwAI, you agree that the platform is provided for educational purposes only. AI-generated answers are meant to assist your learning — always verify important information with your teachers or textbooks.</Text>
                <Text style={t.p}>{b("Acceptable use:")} Use EDUwAI honestly for your own learning. Do not share your account or use the platform to generate content for academic misconduct.</Text>
                <Text style={t.p}>{b("Your data:")} Your questions and usage data may be used to improve the service. Personal information is handled as described in our Privacy Policy.</Text>
                <Text style={t.p}>{b("Institute access:")} Your access to EDUwAI is provided through your institution. The institution may have visibility into aggregate usage statistics for the purpose of managing their subscription.</Text>
                <Text style={t.p}>{b("Content:")} Textbook content is provided for personal study. Do not reproduce or distribute copyrighted material.</Text>
                <Text style={t.p}>EDUwAI reserves the right to update these terms. Continued use after changes constitutes acceptance. Full terms available at {link("eduwai.in/terms", legalUrls.terms)}.</Text>
              </ScrollView>
            </View>
            <Checkbox checked={accepted} onToggle={() => { setAccepted((a) => !a); setError(""); }} color={T.blue600} disabled={busy}>
              <Pressable onPress={() => { if (!busy) { setAccepted((a) => !a); setError(""); } }} style={{ minHeight: 44, justifyContent: "center" }} accessible={false}>
                <Text style={t.agree}>I have read and agree to the {link("Terms of Service", legalUrls.terms)} and {link("Privacy Policy", legalUrls.privacy)}.</Text>
              </Pressable>
            </Checkbox>
            <View style={{ height: 16 }} />
            <ErrorLine text={error} />
            <View style={{ height: error ? 12 : 0 }} />
            <ActionButton label="Accept & Continue" busyLabel="Setting up your account…" busy={busy} onPress={accept} colors={["#2563eb", "#4f46e5"]} icon="arrow-right" />
          </View>
        </View>
        <Text style={t.foot}>Powered by EDUwAI — AI-powered exam preparation</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const t = StyleSheet.create({
  scroll: { paddingHorizontal: 16, flexGrow: 1, justifyContent: "center" },
  card: { width: "100%", maxWidth: 512, alignSelf: "center", backgroundColor: T.white, borderRadius: 16, borderWidth: 1, borderColor: T.g100, overflow: "hidden", ...shadow },
  header: { padding: 32, alignItems: "center" },
  tile: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  h1: { color: T.white, fontSize: 24, fontWeight: "700" },
  org: { color: "#dbeafe", fontSize: 14, marginTop: 4 },
  body: { paddingHorizontal: 24, paddingVertical: 24 },
  intro: { color: T.g600, fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  preview: { height: 208, backgroundColor: T.g50, borderWidth: 1, borderColor: T.g200, borderRadius: 12, padding: 16, marginBottom: 20 },
  p: { fontSize: 14, color: T.g600, lineHeight: 21, marginBottom: 12 },
  agree: { fontSize: 14, color: T.g700, lineHeight: 20 },
  link: { color: T.blue600, textDecorationLine: "underline" },
  foot: { textAlign: "center", color: T.g500, fontSize: 12, marginTop: 16 },
});
