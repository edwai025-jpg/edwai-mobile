import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { MadeInIndia } from "@/components/MadeInIndia";
import { Colors } from "@/constants/colors";

type LoginTab = "phone" | "email";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<LoginTab>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    const value = activeTab === "phone" ? phone : email;
    if (!value.trim()) {
      Alert.alert(
        "Required",
        activeTab === "phone"
          ? "Please enter your phone number"
          : "Please enter your email address"
      );
      return;
    }
    if (activeTab === "phone" && phone.replace(/\D/g, "").length !== 10) {
      Alert.alert("Invalid", "Please enter a valid 10-digit phone number");
      return;
    }
    if (
      activeTab === "email" &&
      !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    ) {
      Alert.alert("Invalid", "Please enter a valid email address");
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);

    router.push({
      pathname: "/otp",
      params: {
        type: activeTab,
        value: activeTab === "phone" ? `+91${phone}` : email,
      },
    });
  };

  const handleGoogle = () => {
    router.push({
      pathname: "/otp",
      params: { type: "google", value: "google" },
    });
  };

  const topInset =
    Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientMid, Colors.backgroundGradientEnd]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View
        style={[
          styles.orb1,
          { top: topInset + 20 },
        ]}
      />
      <View style={styles.orb2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: topInset + 40, paddingBottom: insets.bottom + 40 },
          ]}
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
              Get precise answers from your textbooks with accurate page
              citations. Class 6 to PhD level.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.logoRow}>
              <EdwAILogo size="lg" />
            </View>
            <Text style={styles.cardSub}>AI Assistant for Exam Preparation</Text>

            <View style={styles.tabRow}>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === "phone" && styles.tabActive,
                ]}
                onPress={() => setActiveTab("phone")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "phone" && styles.tabTextActive,
                  ]}
                >
                  Login with Phone
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === "email" && styles.tabActive,
                ]}
                onPress={() => setActiveTab("email")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "email" && styles.tabTextActive,
                  ]}
                >
                  Login with Email
                </Text>
              </Pressable>
            </View>

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
                  onChangeText={(t) =>
                    setPhone(t.replace(/\D/g, "").slice(0, 10))
                  }
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
                onChangeText={setEmail}
              />
            )}

            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.7 },
              ]}
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
                  <Text style={styles.sendBtnText}>Sending...</Text>
                ) : (
                  <Text style={styles.sendBtnText}>Send OTP</Text>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.googleBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleGoogle}
            >
              <FontAwesome name="google" size={18} color="#EA4335" />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </Pressable>

            <View style={styles.trustRow}>
              <Feather
                name="shield"
                size={14}
                color={Colors.success}
              />
              <Text style={styles.trustText}>Trusted by 10,000+ students</Text>
            </View>
          </View>

          <MadeInIndia />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.backgroundGradientStart,
  },
  orb1: {
    position: "absolute",
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primary,
    opacity: 0.12,
  },
  orb2: {
    position: "absolute",
    right: -80,
    bottom: 120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.secondary,
    opacity: 0.1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 28,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.indigoBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  heroRow: {
    marginBottom: 10,
  },
  heroLine1: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    lineHeight: 38,
  },
  heroLine2: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    lineHeight: 38,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.gray600,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoEdw: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  logoAI: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
  },
  cardSub: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
    marginBottom: 20,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.gray600,
  },
  tabTextActive: {
    color: Colors.white,
  },
  phoneRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    marginBottom: 16,
    overflow: "hidden",
  },
  phonePrefix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: Colors.inputBorder,
    justifyContent: "center",
  },
  phonePrefixText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.gray700,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
    marginBottom: 16,
  },
  sendBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  sendBtnGradient: {
    paddingVertical: 15,
    alignItems: "center",
  },
  sendBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.gray200,
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: Colors.gray400,
    fontFamily: "Inter_400Regular",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    marginBottom: 20,
  },
  googleBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.gray700,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  trustText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
  },
  madeInIndia: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 4,
  },
  madeInIndiaText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.gray500,
  },
  indiaFlag: {
    fontSize: 16,
  },
});
