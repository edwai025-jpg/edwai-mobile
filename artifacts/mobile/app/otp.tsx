import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EdwAILogo } from "@/components/EdwAILogo";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";

export default function OTPScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { type, value } = useLocalSearchParams<{
    type: string;
    value: string;
  }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (type === "google") {
      handleVerify();
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      const chars = val.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      chars.forEach((c, i) => {
        if (index + i < 6) newOtp[index + i] = c;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + chars.length, 5);
      refs.current[nextIndex]?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = val.replace(/\D/g, "");
    setOtp(newOtp);
    if (val && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (type !== "google") {
      const otpCode = otp.join("");
      if (otpCode.length !== 6) {
        Alert.alert("Invalid OTP", "Please enter the 6-digit OTP");
        return;
      }
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));

    const displayValue = value ?? "user";
    const isPhone = type === "phone";
    await login({
      name: "",
      phone: isPhone ? displayValue : undefined,
      email: !isPhone && type !== "google" ? displayValue : undefined,
    });

    setLoading(false);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const isGoogle = type === "google";

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientMid, Colors.backgroundGradientEnd]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.orb1, { top: topInset }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.container,
            { paddingTop: topInset + 20, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={Colors.gray700} />
          </Pressable>

          <View style={styles.card}>
            <View style={styles.logoRow}>
              <EdwAILogo size="md" />
            </View>

            {isGoogle ? (
              <>
                <Text style={styles.title}>Connecting with Google...</Text>
                <Text style={styles.subtitle}>Please wait a moment</Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Enter Verification Code</Text>
                <Text style={styles.subtitle}>
                  We sent a 6-digit code to{" "}
                  <Text style={styles.valueText}>{value}</Text>
                </Text>
              </>
            )}

            {!isGoogle && (
              <>
                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(el) => {
                        refs.current[i] = el;
                      }}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : {},
                      ]}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(i, v)}
                      onKeyPress={({ nativeEvent }) =>
                        handleKeyPress(i, nativeEvent.key)
                      }
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <View style={styles.resendRow}>
                  {resendTimer > 0 ? (
                    <Text style={styles.resendTimer}>
                      Resend OTP in{" "}
                      <Text style={{ color: Colors.primary }}>
                        {resendTimer}s
                      </Text>
                    </Text>
                  ) : (
                    <Pressable
                      onPress={() => setResendTimer(30)}
                    >
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.verifyBtn,
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleVerify}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.verifyBtnGradient}
              >
                <Text style={styles.verifyBtnText}>
                  {loading
                    ? "Verifying..."
                    : isGoogle
                    ? "Continue"
                    : "Verify & Continue"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
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
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primary,
    opacity: 0.1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
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
    marginBottom: 20,
  },
  logoEdw: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  logoAI: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.gray600,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },
  valueText: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  otpRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.indigoBg,
  },
  resendRow: {
    alignItems: "center",
    marginBottom: 24,
  },
  resendTimer: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
  },
  resendLink: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  verifyBtn: {
    borderRadius: 12,
    overflow: "hidden",
  },
  verifyBtnGradient: {
    paddingVertical: 15,
    alignItems: "center",
  },
  verifyBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
