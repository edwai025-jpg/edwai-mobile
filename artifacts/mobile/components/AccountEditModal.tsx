import { Feather, Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import api, { ApiError, PHOTO_ENDPOINT } from "@/services/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPhotoChanged?: (hasPhoto: boolean) => void;
};

export default function AccountEditModal({ visible, onClose, onPhotoChanged }: Props) {
  const { user, updateUser, refreshUser, accessToken } = useAuth();
  const token = accessToken ?? "";

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState((user?.phone ?? "").replace(/^\+91/, ""));
  const [saving, setSaving] = useState(false);

  const [otpStep, setOtpStep] = useState<"idle" | "sending" | "verifying">("idle");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phoneVerified = user?.phoneVerified ?? false;
  const isPhoneComplete = phone.replace(/\D/g, "").length === 10;
  const displayName = user?.name || "Student";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  useEffect(() => {
    if (visible) {
      setName(user?.name ?? "");
      setEmail(user?.email ?? "");
      setPhone((user?.phone ?? "").replace(/^\+91/, ""));
      setOtpStep("idle");
      setOtp("");
      setToast(null);
      if (token) {
        api.profile.probePhoto(token).then(setHasPhoto).catch(() => setHasPhoto(false));
      }
    }
  }, [visible]);

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast("err", "Name cannot be empty."); return; }
    setSaving(true);
    try {
      const res = await api.profile.updateStudentProfile(token, {
        full_name: name.trim(),
        email: email.trim() || undefined,
      });
      await updateUser({
        name: res.user.full_name ?? name.trim(),
        email: res.user.email,
      });
      await refreshUser();
      showToast("ok", "Account details saved.");
    } catch (e) {
      showToast("err", e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpStep("sending");
    setOtpLoading(true);
    try {
      await api.profile.sendPhoneOtp(token, `+91${phone.replace(/\D/g, "")}`);
      setOtpStep("verifying");
    } catch (e) {
      showToast("err", e instanceof ApiError ? e.message : "Failed to send OTP.");
      setOtpStep("idle");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpLoading(true);
    try {
      await api.profile.verifyPhoneOtp(token, `+91${phone.replace(/\D/g, "")}`, otp);
      await updateUser({ phone: `+91${phone.replace(/\D/g, "")}`, phoneVerified: true });
      setOtpStep("idle");
      setOtp("");
      showToast("ok", "Phone number verified!");
    } catch (e) {
      showToast("err", e instanceof ApiError ? e.message : "Invalid OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const doUpload = async (uri: string) => {
    setPhotoLoading(true);
    try {
      await api.profile.uploadPhoto(token, uri);
      setHasPhoto(true);
      onPhotoChanged?.(true);
      showToast("ok", "Photo updated.");
    } catch {
      showToast("err", "Failed to upload photo.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access in Settings to set a profile picture."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    await doUpload(result.assets[0].uri);
  };

  const handlePickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access in Settings to take a profile picture."); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    await doUpload(result.assets[0].uri);
  };

  const handlePickPhoto = () => {
    Alert.alert(
      "Profile Photo",
      "Choose an option",
      [
        { text: "Take Photo", onPress: handlePickFromCamera },
        { text: "Choose from Library", onPress: handlePickFromLibrary },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const handleRemovePhoto = async () => {
    Alert.alert("Remove Photo", "Are you sure you want to remove your profile photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setPhotoLoading(true);
          try {
            await api.profile.deletePhoto(token);
            setHasPhoto(false);
            onPhotoChanged?.(false);
            showToast("ok", "Photo removed.");
          } catch {
            showToast("err", "Failed to remove photo.");
          } finally {
            setPhotoLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.titleRow}>
            <Text style={s.title}>Edit Account</Text>
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={Colors.darkTextMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Photo */}
            <View style={s.photoRow}>
              <Pressable onPress={handlePickPhoto} style={s.avatarWrap}>
                {hasPhoto && token ? (
                  <ExpoImage
                    source={{ uri: PHOTO_ENDPOINT, headers: { Authorization: `Bearer ${token}` } }}
                    style={s.avatarImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <LinearGradient colors={["#7c3aed", "#4f46e5"]} style={[s.avatarImg, { alignItems: "center", justifyContent: "center" }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={s.avatarInitials}>{initials || "U"}</Text>
                  </LinearGradient>
                )}
                <View style={s.avatarOverlay}>
                  {photoLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="camera" size={16} color="#fff" />
                  }
                </View>
              </Pressable>
              <View style={{ gap: 4 }}>
                <TouchableOpacity onPress={handlePickPhoto}>
                  <Text style={s.photoLink}>{hasPhoto ? "Change Photo" : "Add Photo"}</Text>
                </TouchableOpacity>
                {hasPhoto && (
                  <TouchableOpacity onPress={handleRemovePhoto}>
                    <Text style={s.removeLink}>Remove Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Name */}
            <View style={s.field}>
              <Text style={s.label}>Full Name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={Colors.darkTextMuted}
                autoCapitalize="words"
              />
            </View>

            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>Email Address</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.darkTextMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {!!user?.emailVerified && (
                  <View style={s.verifiedBadge}>
                    <Text style={s.verifiedText}>✓</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Phone */}
            <View style={s.field}>
              <Text style={s.label}>Phone Number</Text>
              <View style={s.inputRow}>
                <View style={s.phonePre}><Text style={s.phonePreText}>+91</Text></View>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={phone}
                  onChangeText={(t) => { setPhone(t); setOtpStep("idle"); setOtp(""); }}
                  placeholder="10-digit number"
                  placeholderTextColor={Colors.darkTextMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <View style={[s.verifyBadge, phoneVerified ? s.verifiedBg : s.unverifiedBg]}>
                  <Text style={[s.verifyBadgeText, { color: phoneVerified ? "#22c55e" : "#f59e0b" }]}>
                    {phoneVerified ? "✓ Verified" : "Unverified"}
                  </Text>
                </View>
              </View>
              {isPhoneComplete && !phoneVerified && otpStep === "idle" && (
                <TouchableOpacity onPress={handleSendOtp} disabled={otpLoading} style={{ marginTop: 6 }}>
                  <Text style={s.verifyLink}>{otpLoading ? "Sending…" : "Verify phone number →"}</Text>
                </TouchableOpacity>
              )}
              {otpStep === "verifying" && (
                <View style={s.otpBox}>
                  <TextInput
                    style={s.input}
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={Colors.darkTextMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={s.otpBtnRow}>
                    <TouchableOpacity
                      style={[s.otpConfirm, (otpLoading || otp.length < 6) && { opacity: 0.5 }]}
                      onPress={handleVerifyOtp}
                      disabled={otpLoading || otp.length < 6}
                    >
                      {otpLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Confirm OTP</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={s.otpResend} onPress={handleSendOtp} disabled={otpLoading}>
                      <Text style={s.otpResendText}>Resend</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Notice */}
            <View style={s.notice}>
              <Feather name="info" size={12} color={Colors.darkTextMuted} />
              <Text style={s.noticeText}>Account uses OTP-based login — no password required</Text>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.saveBtnText}>Save Account Details</Text>
              }
            </TouchableOpacity>
          </ScrollView>

          {/* Toast */}
          {toast && (
            <View style={[s.toast, toast.type === "ok" ? s.toastOk : s.toastErr]}>
              <Text style={s.toastText}>{toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { backgroundColor: Colors.darkCard, borderRadius: 20, width: "100%", maxHeight: "88%", borderWidth: 1, borderColor: Colors.darkCardBorder, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 4 },
  avatarWrap: { position: "relative", width: 60, height: 60, borderRadius: 30, overflow: "hidden" },
  avatarImg: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  avatarOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 24, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  photoLink: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },
  removeLink: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.danger },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.darkTextMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: Colors.darkInputBg, borderWidth: 1, borderColor: Colors.darkInputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkText },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  phonePre: { backgroundColor: Colors.darkInputBg, borderWidth: 1, borderColor: Colors.darkInputBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 11 },
  phonePreText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.darkText },
  verifiedBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(22,163,74,0.2)", alignItems: "center", justifyContent: "center" },
  verifiedText: { fontSize: 14, color: "#22c55e", fontFamily: "Inter_700Bold" },
  verifyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  verifiedBg: { backgroundColor: "rgba(22,163,74,0.12)", borderColor: "rgba(22,163,74,0.3)" },
  unverifiedBg: { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)" },
  verifyBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  verifyLink: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },
  otpBox: { gap: 8, marginTop: 6 },
  otpBtnRow: { flexDirection: "row", gap: 8 },
  otpConfirm: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  otpResend: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.darkDivider, alignItems: "center" },
  otpResendText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.darkTextSub },
  notice: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.darkSurface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.darkDivider },
  noticeText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, flex: 1 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  toast: { margin: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  toastOk: { backgroundColor: "rgba(22,163,74,0.18)", borderWidth: 1, borderColor: "rgba(22,163,74,0.35)" },
  toastErr: { backgroundColor: "rgba(220,38,38,0.18)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)" },
  toastText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.darkText },
});
