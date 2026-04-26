import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EdwAILogo } from "@/components/EdwAILogo";
import { FeatureCards } from "@/components/FeatureCards";
import { HomeFooter } from "@/components/HomeFooter";
import { MadeInIndia } from "@/components/MadeInIndia";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import api, { ApiError } from "@/services/api";

type LoginTab = "phone" | "email";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginWithGoogleToken } = useAuth();
  const [activeTab, setActiveTab] = useState<LoginTab>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const validatePhone = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) return "Please enter a valid 10-digit phone number";
    if (!/^[6-9]/.test(digits)) return "Phone number must start with 6, 7, 8, or 9";
    return null;
  };

  const validateEmail = () => {
    if (!email.trim()) return "Please enter your email address";
    if (email.length < 5 || email.length > 254) return "Invalid email address";
    if ((email.match(/@/g) ?? []).length !== 1) return "Invalid email address";
    const [local, domain] = email.split("@");
    if (!local || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return "Invalid email format";
    if (!domain || !domain.includes(".")) return "Invalid email domain";
    const tld = domain.split(".").pop() ?? "";
    if (tld.length < 2) return "Invalid email TLD";
    return null;
  };

  const handleSendOTP = async () => {
    setErrorMsg("");
    if (activeTab === "phone") {
      const err = validatePhone();
      if (err) { setErrorMsg(err); return; }
    } else {
      const err = validateEmail();
      if (err) { setErrorMsg(err); return; }
    }

    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, "");
      if (activeTab === "phone") {
        await api.auth.sendPhoneOtp(`+91${digits}`);
        router.push({ pathname: "/otp", params: { type: "phone", value: `+91${digits}` } });
      } else {
        await api.auth.sendEmailOtp(email.trim());
        router.push({ pathname: "/otp", params: { type: "email", value: email.trim() } });
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (Platform.OS === "web") {
      Linking.openURL(api.googleAuthUrl);
      return;
    }
    setGoogleLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        api.googleAuthUrl,
        api.googleRedirectBase
      );
      if (result.type === "success") {
        const url = result.url;
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        if (!tokenMatch?.[1]) throw new Error("No token received from Google");
        const token = tokenMatch[1];
        const path = url.includes("/complete-profile") ? "complete-profile" : "student";
        const { profileComplete } = await loginWithGoogleToken(token, path);
        if (!profileComplete) {
          router.replace("/complete-profile");
        }
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Google sign-in failed. Please try again.";
      setErrorMsg(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientMid, Colors.backgroundGradientEnd]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.orb1, { top: topInset + 20 }]} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 40, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>AI-Powered Learning Platform</Text>
            </View>
            <View style={styles.heroRow}>
              <Text style={styles.heroLine1}>Learn From Your</Text>
              <Text style={styles.heroLine2}>Textbooks with AI</Text>
            </View>
            <Text style={styles.heroSub}>
              Get precise answers from your textbooks with accurate page citations. Class 6 to PhD level.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.logoRow}>
              <EdwAILogo size="lg" />
            </View>
            <Text style={styles.cardSub}>AI Assistant for Exam Preparation</Text>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
              {(["phone", "email"] as LoginTab[]).map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => { setActiveTab(tab); setErrorMsg(""); }}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === "phone" ? "Login with Phone" : "Login with Email"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Error banner */}
            {!!errorMsg && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={14} color="#B91C1C" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Input */}
            {activeTab === "phone" ? (
              <View style={styles.phoneRow}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit phone number"
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(t) => { setPhone(t.replace(/\D/g, "").slice(0, 10)); setErrorMsg(""); }}
                  maxLength={10}
                />
              </View>
            ) : (
              <TextInput
                style={styles.emailInput}
                placeholder="Enter your email address"
                placeholderTextColor={Colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(""); }}
              />
            )}

            {/* Send OTP button */}
            <Pressable
              style={({ pressed }) => [styles.sendBtn, (pressed || loading) && { opacity: 0.8 }]}
              onPress={handleSendOTP}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.sendBtnText}>Send OTP</Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Divider */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            {/* Google button */}
            <Pressable
              style={({ pressed }) => [styles.googleBtn, (pressed || googleLoading) && { opacity: 0.8 }]}
              onPress={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={Colors.gray700} />
              ) : (
                <FontAwesome name="google" size={18} color="#EA4335" />
              )}
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </Pressable>

            {/* Trust line */}
            <View style={styles.trustRow}>
              <Feather name="shield" size={14} color={Colors.success} />
              <Text style={styles.trustText}>Trusted by 10,000+ students</Text>
            </View>
          </View>

          <MadeInIndia />
          <FeatureCards />
          <HomeFooter parentPadding={24} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.backgroundGradientStart },
  orb1: {
    position: "absolute", left: -60, width: 200, height: 200,
    borderRadius: 100, backgroundColor: Colors.primary, opacity: 0.12,
  },
  orb2: {
    position: "absolute", right: -80, bottom: 120, width: 280, height: 280,
    borderRadius: 140, backgroundColor: Colors.secondary, opacity: 0.1,
  },
  scrollContent: { paddingHorizontal: 24 },
  header: { marginBottom: 28 },
  badge: {
    alignSelf: "flex-start", backgroundColor: Colors.indigoBg, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.indigoBorder, paddingHorizontal: 12,
    paddingVertical: 5, marginBottom: 16,
  },
  badgeText: { color: Colors.primary, fontSize: 12, fontFamily: "Inter_500Medium" },
  heroRow: { marginBottom: 10 },
  heroLine1: { fontSize: 30, fontFamily: "Inter_700Bold", color: Colors.gray900, lineHeight: 38 },
  heroLine2: { fontSize: 30, fontFamily: "Inter_700Bold", color: Colors.primary, lineHeight: 38 },
  heroSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.gray600, lineHeight: 22 },
  card: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 24,
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
    borderWidth: 1, borderColor: Colors.gray200,
  },
  logoRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginBottom: 4 },
  cardSub: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.gray500, marginBottom: 20 },
  tabRow: {
    flexDirection: "row", backgroundColor: Colors.gray100, borderRadius: 12,
    padding: 4, marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabActive: {
    backgroundColor: Colors.primary, shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.gray600 },
  tabTextActive: { color: Colors.white },
  errorBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  errorText: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular",
    color: "#B91C1C", lineHeight: 18,
  },
  phoneRow: {
    flexDirection: "row", borderWidth: 1, borderColor: Colors.inputBorder,
    borderRadius: 12, backgroundColor: Colors.inputBg, marginBottom: 16, overflow: "hidden",
  },
  phonePrefix: {
    paddingHorizontal: 14, paddingVertical: 14, borderRightWidth: 1,
    borderRightColor: Colors.inputBorder, justifyContent: "center",
  },
  phonePrefixText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.gray700 },
  phoneInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.gray900,
  },
  emailInput: {
    borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 12,
    backgroundColor: Colors.inputBg, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.gray900, marginBottom: 16,
  },
  sendBtn: { borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  sendBtnGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  sendBtnText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  orRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.gray200 },
  orText: { marginHorizontal: 12, fontSize: 13, color: Colors.gray400, fontFamily: "Inter_400Regular" },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderWidth: 1, borderColor: Colors.gray300, borderRadius: 12, paddingVertical: 14,
    backgroundColor: Colors.white, marginBottom: 20,
  },
  googleBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.gray700 },
  trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  trustText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.gray500 },
});
