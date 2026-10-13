import { Feather, Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { getProfilePhotoSource } from "@/services/api";
import { useProfileAlert } from "@/hooks/useProfileAlert";
import { useAccountDetails } from "@/hooks/useAccountDetails";
import type { ProfilePhotoActions } from "@/hooks/useProfilePhoto";

type Props = {
  visible: boolean;
  onClose: () => void;
  photo: ProfilePhotoActions;
};

export default function AccountEditModal({ visible, onClose, photo }: Props) {
  const { user, accessToken, photoRevision, hasPhoto, probeHasPhoto } = useAuth();
  const { showAlert, alertDialog } = useProfileAlert();
  const token = accessToken ?? "";

  const photoLoading = photo.busy;
  const [photoFailed, setPhotoFailed] = useState(false);
  const retryRevision = useRef<number | null>(null);
  useEffect(() => { setPhotoFailed(false); }, [user?.id, photoRevision, token]);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = user?.name || "Student";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  useEffect(() => {
    if (visible) {
      setToast(null);
      if (token) {
        void probeHasPhoto();
      }
    }
  }, [visible]);

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const account = useAccountDetails(visible, showAlert, showToast);
  const { name, setName, email, phone, phoneVerified, emailVerified, busy: saving } = account;
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const verificationPanel = (channel: "email" | "phone") => {
    const state = account.codes[channel];
    const target = channel === "email" ? email.trim() : `+91${phone}`;
    return (
      <View style={s.otpBox} accessibilityLabel={`${channel} verification`}>
        <Text style={s.noticeText}>
          {state.sentTo === target ? `OTP sent to ${target}. Enter the 6-digit code below.`
            : `Verify ${target} before changing it. Your saved contact stays unchanged until verification succeeds.`}
        </Text>
        <TouchableOpacity disabled={saving || account.needsReconcile} onPress={() => account.send(channel)}>
          <Text style={s.verifyLink}>{saving ? "Please wait…" : state.sentTo === target ? "Resend OTP" : `Send OTP to new ${channel}`}</Text>
        </TouchableOpacity>
        <TextInput
          style={s.input}
          value={state.code}
          onChangeText={value => account.changeCode(channel, value)}
          placeholder="Enter 6-digit OTP"
          placeholderTextColor={Colors.darkTextMuted}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          accessibilityLabel={`${channel} verification OTP`}
          maxLength={6}
          editable={!saving && !account.needsReconcile}
        />
        <TouchableOpacity
          style={[s.otpConfirm, (saving || account.needsReconcile || state.sentTo !== target || state.code.length !== 6) && { opacity: 0.5 }]}
          onPress={() => account.verify(channel)}
          disabled={saving || account.needsReconcile || state.sentTo !== target || state.code.length !== 6}
        >
          <Text style={s.saveBtnText}>{`Verify OTP and change ${channel}`}</Text>
        </TouchableOpacity>
        {!!state.error && <Text style={{ color: Colors.danger }} accessibilityRole="alert">{state.error}</Text>}
        {channel === "email" && <TouchableOpacity disabled={saving} onPress={account.cancelEmail}>
          <Text style={s.verifyLink}>Cancel email change</Text>
        </TouchableOpacity>}
      </View>
    );
  };


  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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
              <Pressable onPress={photo.openPicker} disabled={photoLoading} accessibilityLabel="Change profile photo" style={s.avatarWrap}>
                {hasPhoto && token && !photoFailed ? (
                  <ExpoImage
                    key={`${user?.id}:${photoRevision}`}
                    source={getProfilePhotoSource(token, user?.id, photoRevision)}
                    style={s.avatarImg}
                    contentFit="cover"
                    cachePolicy="none"
                    onError={() => {
                      setPhotoFailed(true);
                      if (retryRevision.current !== photoRevision) {
                        retryRevision.current = photoRevision + 1;
                        void probeHasPhoto();
                      }
                    }}
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
                <TouchableOpacity onPress={photo.openPicker} disabled={photoLoading}>
                  <Text style={s.photoLink}>{photo.needsReconcile ? "Check Saved Photo" : photoLoading ? "Uploading…" : photo.canRemove ? "Change Photo" : "Add Photo"}</Text>
                </TouchableOpacity>
                {photo.canRemove && (
                  <TouchableOpacity disabled={photoLoading} onPress={() => { void photo.remove(); }}>
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
                editable={!saving}
                maxLength={101}
                accessibilityLabel="Full Name"
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
                  style={[s.input, { flex: 1, minWidth: 0 }]}
                  value={email}
                  onChangeText={account.changeEmail}
                  editable={!saving}
                  accessibilityLabel="Email Address"
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.darkTextMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {emailVerified && (
                  <View style={s.verifiedBadge}>
                    <Text style={s.verifiedText}>✓</Text>
                  </View>
                )}
              </View>
              {!!account.emailError && <Text style={{ color: Colors.danger }} accessibilityRole="alert">{account.emailError}</Text>}
              {!!email.trim() && !account.emailError && !emailVerified && verificationPanel("email")}
              {!!account.codes.email.success && <Text style={s.verifyLink}>{account.codes.email.success}</Text>}
            </View>

            {/* Phone */}
            <View style={s.field}>
              <Text style={s.label}>Phone Number</Text>
              <View style={s.inputRow}>
                <View style={s.phonePre}><Text style={s.phonePreText}>+91</Text></View>
                <TextInput
                  style={[s.input, { flex: 1, minWidth: 0 }]}
                  value={phone}
                  onChangeText={account.changePhone}
                  editable={!saving}
                  accessibilityLabel="Phone Number"
                  placeholder="10-digit number"
                  placeholderTextColor={Colors.darkTextMuted}
                  keyboardType="phone-pad"
                  maxLength={16}
                />
                <View style={[s.verifyBadge, phoneVerified ? s.verifiedBg : s.unverifiedBg]}>
                  <Text style={[s.verifyBadgeText, { color: phoneVerified ? "#22c55e" : "#f59e0b" }]}>
                    {phoneVerified ? "✓ Verified" : "Unverified"}
                  </Text>
                </View>
              </View>
              {!!account.phoneError && <Text style={{ color: Colors.danger }} accessibilityRole="alert">{account.phoneError}</Text>}
              {!!phone && !account.phoneError && !phoneVerified && verificationPanel("phone")}
              {!!account.codes.phone.success && <Text style={s.verifyLink}>{account.codes.phone.success}</Text>}
            </View>

            {/* Notice */}
            <View style={s.notice}>
              <Feather name="lock" size={14} color={Colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={s.noticeTitle}>Password login is disabled</Text>
                <Text style={s.noticeText}>Your account uses OTP-based login via phone or email. Password sign-in is not available. If you're unable to receive an OTP, please contact support for assisted access.</Text>
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.7 }]}
              onPress={account.save}
              disabled={saving || account.needsReconcile}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.saveBtnText}>{account.pendingContacts ? "Send OTP to verify changes" : "Save Account Details"}</Text>
              }
            </TouchableOpacity>
            {account.needsReconcile && <TouchableOpacity style={s.otpResend} disabled={saving} onPress={account.checkSavedDetails}>
              <Text style={s.otpResendText}>Check saved details before retrying</Text>
            </TouchableOpacity>}
          </ScrollView>

          {/* Toast */}
          {toast && (
            <View style={[s.toast, toast.type === "ok" ? s.toastOk : s.toastErr]}>
              <Text style={s.toastText}>{toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      {alertDialog}
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
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.darkSurface, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: Colors.darkDivider },
  noticeTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.darkText },
  noticeText: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  toast: { margin: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  toastOk: { backgroundColor: "rgba(22,163,74,0.18)", borderWidth: 1, borderColor: "rgba(22,163,74,0.35)" },
  toastErr: { backgroundColor: "rgba(220,38,38,0.18)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)" },
  toastText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.darkText },
});
