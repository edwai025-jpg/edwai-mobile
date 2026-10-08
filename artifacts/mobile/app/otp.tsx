import { platformShadow } from "@/constants/shadow";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import api, { ApiError } from "@/services/api";

const OTP_TIMER = 60;

export default function OTPScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifyPhoneOtp, verifyEmailOtp } = useAuth();
  const { type, value } = useLocalSearchParams<{ type: string; value: string }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(OTP_TIMER);
  const [errorMsg, setErrorMsg] = useState("");
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const t = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
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
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit OTP");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      let result: { profileComplete: boolean };
      if (type === "phone") {
        result = await verifyPhoneOtp(value ?? "", otpCode);
      } else {
        result = await verifyEmailOtp(value ?? "", otpCode);
      }
      if (!result.profileComplete) {
        router.replace("/complete-profile");
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Invalid or expired OTP. Please try again.";
      setErrorMsg(msg);
      setOtp(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setResending(true);
    setErrorMsg("");
    try {
      if (type === "phone") {
        await api.auth.sendPhoneOtp(value ?? "");
      } else {
        await api.auth.sendEmailOtp(value ?? "");
      }
      setTimer(OTP_TIMER);
      setOtp(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to resend OTP. Try again.";
      setErrorMsg(msg);
    } finally {
      setResending(false);
    }
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientMid, Colors.backgroundGradientEnd]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.orb1, { top: topInset }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[styles.container, { paddingTop: topInset + 20, paddingBottom: insets.bottom + 20 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={Colors.gray700} />
          </Pressable>

          <View style={styles.card}>
            <View style={styles.logoRow}>
              <EdwAILogo size="md" />
            </View>

            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              OTP sent to{" "}
              <Text style={styles.valueText}>{value}</Text>
              {"\n"}
              <Pressable onPress={() => router.back()}>
                <Text style={styles.changeLink}>
                  {type === "phone" ? "Change number" : "Change email"}
                </Text>
              </Pressable>
            </Text>

            {/* Error banner */}
            {!!errorMsg && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={14} color="#B91C1C" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* OTP boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : {}]}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(i, v)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                />
              ))}
            </View>

            {/* Resend */}
            <View style={styles.resendRow}>
              {timer > 0 ? (
                <Text style={styles.resendTimer}>
                  Resend OTP in{" "}
                  <Text style={{ color: Colors.primary, fontFamily: "Inter_600SemiBold" }}>{timer}s</Text>
                </Text>
              ) : (
                <Pressable onPress={handleResend} disabled={resending}>
                  {resending ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  )}
                </Pressable>
              )}
            </View>

            {/* Verify button */}
            <Pressable
              style={({ pressed }) => [styles.verifyBtn, (pressed || loading) && { opacity: 0.8 }]}
              onPress={handleVerify}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.verifyBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.verifyBtnText}>Verify & Continue</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.backgroundGradientStart },
  orb1: {
    position: "absolute", right: -60, width: 200, height: 200,
    borderRadius: 100, backgroundColor: Colors.primary, opacity: 0.1,
  },
  container: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: "center", justifyContent: "center",
    ...platformShadow("#000", 0, 2, 0.08, 4), elevation: 2, marginBottom: 24,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 28,
    ...platformShadow(Colors.navy, 0, 8, 0.12, 24), elevation: 8,
    borderWidth: 1, borderColor: Colors.gray200,
  },
  logoRow: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginBottom: 20,
  },
  title: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.gray900,
    textAlign: "center", marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.gray600,
    textAlign: "center", marginBottom: 8, lineHeight: 22,
  },
  valueText: { fontFamily: "Inter_600SemiBold", color: Colors.primary },
  changeLink: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary,
    textDecorationLine: "underline",
  },
  errorBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#B91C1C", lineHeight: 18 },
  otpRow: {
    flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 20,
  },
  otpBox: {
    width: 46, height: 54, borderWidth: 2, borderColor: Colors.inputBorder,
    borderRadius: 12, backgroundColor: Colors.inputBg,
    fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.gray900,
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.indigoBg },
  resendRow: { alignItems: "center", marginBottom: 24, height: 24, justifyContent: "center" },
  resendTimer: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.gray500 },
  resendLink: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  verifyBtn: { borderRadius: 12, overflow: "hidden" },
  verifyBtnGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  verifyBtnText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
