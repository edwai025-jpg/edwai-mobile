import { platformShadow } from "@/constants/shadow";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
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

import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleAuthWebView } from "@/components/GoogleAuthWebView";
import RightsFooter from "@/components/RightsFooter";
import { APPLE_SIGNIN_ENABLED, SHOW_GOOGLE_LOGIN } from "@/constants/storePolicy";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import api, { ApiError } from "@/services/api";

type LoginTab = "phone" | "email";

/* Trust labels under the headline. Keep these to facts you can back up. */
const TRUST_LABELS = [
  { icon: "📈", text: "100K+ visits / month" },
  { icon: "📚", text: "Answers from your textbooks" },
  { icon: "🌐", text: "10 Indian languages" },
] as const;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginWithGoogleToken, loginWithApple } = useAuth();
  const [appleLoading, setAppleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<LoginTab>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const canSend = activeTab === "phone" ? phone.length === 10 : email.trim().length > 0;

  const handleHome = async () => {
    try {
      await Linking.openURL("https://eduwai.in/");
    } catch {
      Alert.alert("Unable to open website", "Please try opening https://eduwai.in/ in your browser.");
    }
  };

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
      let msg = "Something went wrong. Please try again.";
      if (e instanceof ApiError) {
        msg = e.message;
      } else if (e instanceof TypeError && String(e.message).toLowerCase().includes("fetch")) {
        msg = "Network error — check your connection and try again.";
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setErrorMsg("");
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error("Apple did not return an identity token.");
      setAppleLoading(true);
      const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(" ") || null;
      const { profileComplete } = await loginWithApple({
        identity_token: cred.identityToken,
        authorization_code: cred.authorizationCode ?? null,
        full_name: fullName,
        email: cred.email ?? null,
      });
      router.replace(profileComplete ? "/(tabs)" : "/complete-profile");
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") return;
      setErrorMsg(e instanceof ApiError ? e.message : "Apple sign-in failed. Please try again.");
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogle = () => {
    if (Platform.OS === "web") {
      Linking.openURL(api.googleAuthUrl);
      return;
    }
    setErrorMsg("");
    setShowGoogleAuth(true);
  };

  const handleGoogleResult = async (result: { type: string; token?: string; profileComplete?: boolean; message?: string }) => {
    setShowGoogleAuth(false);
    if (result.type === "cancel") return;
    if (result.type === "error") {
      setErrorMsg(result.message ?? "Google sign-in failed. Please try again.");
      return;
    }
    if (result.type === "success" && result.token) {
      setGoogleLoading(true);
      try {
        await loginWithGoogleToken(result.token, "", result.profileComplete ?? false);
        if (!result.profileComplete) {
          router.replace("/complete-profile");
        } else {
          router.replace("/(tabs)");
        }
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Google sign-in failed. Please try again.";
        setErrorMsg(msg);
      } finally {
        setGoogleLoading(false);
      }
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: topInset + 12 }]}>
        <Pressable
          testID="login-home"
          accessibilityRole="link"
          accessibilityLabel="Home — open EDUwAI website in browser"
          onPress={handleHome}
          style={({ pressed }) => [styles.homeButton, pressed && { opacity: 0.7 }]}
        >
          <Feather name="home" size={17} color={Colors.gray600} />
          <Text style={styles.homeText}>Home</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 28, paddingBottom: bottomInset + 72 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <Image
              source={require("@/assets/images/eduwai-logo.png")}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="EDUwAI"
              testID="login-logo"
            />
            <Text style={styles.subtitle}>
              <Text style={styles.subtitleDark}>AI Assistant </Text>
              <Text style={styles.subtitleMuted}>for </Text>
              <Text style={styles.subtitleAccent}>Indian Exam Preparation</Text>
            </Text>

            {/* Trust labels — real facts only (edit TRUST_LABELS to change) */}
            <View style={styles.trustLabels} accessibilityRole="text" accessibilityLabel={TRUST_LABELS.map(l => l.text).join(", ")}>
              {TRUST_LABELS.map(label => (
                <View key={label.text} style={styles.trustLabel}>
                  <Text style={styles.trustLabelIcon}>{label.icon}</Text>
                  <Text style={styles.trustLabelText}>{label.text}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.heading}>Login / Sign Up with</Text>
            <View style={styles.tabRow} accessibilityRole="tablist">
              {(["phone", "email"] as LoginTab[]).map((tab) => {
                const selected = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    testID={`login-tab-${tab}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={tab === "phone" ? "Phone" : "Email"}
                    style={[styles.tab, selected && styles.tabActive]}
                    onPress={() => { setActiveTab(tab); setErrorMsg(""); }}
                  >
                    <Feather name={tab === "phone" ? "phone" : "mail"} size={16} color={selected ? Colors.white : Colors.gray700} />
                    <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                      {tab === "phone" ? "Phone" : "Email"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!!errorMsg && (
              <View style={styles.errorBanner} accessibilityRole="alert" testID="login-error">
                <Feather name="alert-circle" size={14} color="#B91C1C" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {activeTab === "phone" ? (
              <View style={styles.phoneRow}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  testID="login-phone-input"
                  accessibilityLabel="Phone number"
                  style={styles.phoneInput}
                  placeholder="10-digit phone number"
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  value={phone}
                  onChangeText={(t) => { setPhone(t.replace(/\D/g, "").slice(0, 10)); setErrorMsg(""); }}
                  maxLength={10}
                />
              </View>
            ) : (
              <TextInput
                testID="login-email-input"
                accessibilityLabel="Email address"
                style={styles.emailInput}
                placeholder="Enter your email address"
                placeholderTextColor={Colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => { if (canSend && !loading) handleSendOTP(); }}
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(""); }}
              />
            )}

            <Pressable
              testID="login-send-otp"
              accessibilityRole="button"
              accessibilityLabel="Send OTP"
              accessibilityState={{ disabled: !canSend || loading, busy: loading }}
              style={({ pressed }) => [styles.sendBtn, !canSend && styles.sendBtnDisabled, pressed && canSend && { opacity: 0.85 }]}
              onPress={handleSendOTP}
              disabled={!canSend || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <View style={styles.sendInner}>
                  <Text style={styles.sendBtnText}>Send OTP</Text>
                  <Feather name="arrow-right" size={16} color={Colors.white} />
                </View>
              )}
            </Pressable>

            {(APPLE_SIGNIN_ENABLED || SHOW_GOOGLE_LOGIN) && <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR CONTINUE WITH</Text>
              <View style={styles.orLine} />
            </View>}

            {APPLE_SIGNIN_ENABLED && (
              <AppleAuthentication.AppleAuthenticationButton
                testID="login-apple"
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={[styles.appleBtn, appleLoading && { opacity: 0.6 }]}
                onPress={appleLoading ? () => {} : handleApple}
              />
            )}

            {SHOW_GOOGLE_LOGIN && <Pressable
              testID="login-google"
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
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
            </Pressable>}

            <View style={styles.trustRow}>
              <Feather name="shield" size={14} color={Colors.success} />
              <Text style={styles.trustText}>Evaluated by trusted teachers  {"\u00B7"}  🇮🇳 Made in India</Text>
            </View>
            <RightsFooter />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Google OAuth WebView — intercepts https://edwai-prod-70474.web.app redirect */}
      <GoogleAuthWebView
        visible={showGoogleAuth}
        authUrl={api.googleAuthUrl}
        onResult={handleGoogleResult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appleBtn: { height: 50, width: "100%", marginBottom: 12 },
  root: { flex: 1, backgroundColor: Colors.authBg },
  topBar: { paddingHorizontal: 20, paddingBottom: 8 },
  homeButton: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8,
    minHeight: 44, paddingHorizontal: 14, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.gray200, backgroundColor: Colors.gray50,
  },
  homeText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.gray600 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center" },
  column: { width: "100%", maxWidth: 440, alignSelf: "center" },
  logo: { width: 170, height: 124, alignSelf: "center", marginBottom: 10 },
  // subtitle: { textAlign: "center", fontSize: 14, marginBottom: 32 }, — space now taken by the trust labels
  subtitle: { textAlign: "center", fontSize: 14, marginBottom: 14 },
  trustLabels: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 26 },
  trustLabel: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(102,126,234,0.08)", borderWidth: 1, borderColor: "rgba(102,126,234,0.22)" },
  trustLabelIcon: { fontSize: 12 },
  trustLabelText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.authInk },
  subtitleDark: { color: Colors.authInk, fontFamily: "Inter_500Medium" },
  subtitleMuted: { color: Colors.gray400, fontFamily: "Inter_500Medium" },
  subtitleAccent: { color: Colors.authAccent, fontFamily: "Inter_500Medium" },
  heading: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.gray900, marginBottom: 12 },
  tabRow: { flexDirection: "row", gap: 12, marginBottom: 18 },
  tab: {
    flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.gray50,
  },
  tabActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
    ...platformShadow(Colors.primary, 0, 3, 0.25, 6), elevation: 3,
  },
  tabText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.gray700 },
  tabTextActive: { color: Colors.white },
  errorBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#B91C1C", lineHeight: 18 },
  phoneRow: {
    flexDirection: "row", borderWidth: 1, borderColor: Colors.gray200,
    borderRadius: 14, backgroundColor: Colors.white, marginBottom: 16, overflow: "hidden",
  },
  phonePrefix: {
    paddingHorizontal: 16, justifyContent: "center", borderRightWidth: 1,
    borderRightColor: Colors.gray200, backgroundColor: Colors.gray50,
  },
  phonePrefixText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.gray700 },
  phoneInput: { flex: 1, minHeight: 52, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.gray900 },
  emailInput: {
    minHeight: 52, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 14,
    backgroundColor: Colors.white, paddingHorizontal: 14, fontSize: 15,
    fontFamily: "Inter_400Regular", color: Colors.gray900, marginBottom: 16,
  },
  sendBtn: {
    minHeight: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center",
    justifyContent: "center", marginBottom: 22,
  },
  sendBtnDisabled: { backgroundColor: Colors.authDisabled },
  sendInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  sendBtnText: { color: Colors.white, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  orRow: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.gray200 },
  orText: { marginHorizontal: 12, fontSize: 11, letterSpacing: 1, color: Colors.gray400, fontFamily: "Inter_600SemiBold" },
  googleBtn: {
    minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: 14, backgroundColor: Colors.white, marginBottom: 28,
  },
  googleBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.gray800 },
  trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" },
  trustText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.gray400 },
});
