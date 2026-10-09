import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/context/auth";
import { mutationErrorMessage, normalizePhoneInput, validatePhone } from "@/services/onboarding";
import { ErrorLine, T, TextLink } from "./ui";

export default function PhoneField({ phone, onChange, error, disabled, onBusyChange }: {
  phone: string; onChange: (digits: string) => void; error: string; disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { user, sendPhoneOtp, verifyProfilePhone, accessToken } = useAuth();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"" | "send" | "verify">("");
  const [msg, setMsg] = useState("");
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onBusyChange?.(busy !== ""); }, [busy, onBusyChange]);
  useEffect(() => { setSentTo(null); setOtp(""); setMsg(""); }, [phone]);

  const format = validatePhone(phone);
  const valid = phone.length === 10 && !format;
  // Persisted truth only: never mark an edited number verified.
  const verified = valid && !!user?.phoneVerified && user?.phone === `+91${phone}`;
  const sent = sentTo === phone;

  const edit = (raw: string) => {
    const next = normalizePhoneInput(raw.replace(/[^\d+]/g, ""));
    onChange(next);
    setSentTo(null); setOtp(""); setMsg("");
  };

  const send = async () => {
    if (busy || !valid) return;
    const target = phone; const tk = accessToken;
    setBusy("send"); setMsg("");
    try {
      await sendPhoneOtp(`+91${target}`);
      if (!alive.current || phoneRef.current !== target || tokenRef.current !== tk) return;
      setSentTo(target); setOtp("");
    } catch (e) {
      if (alive.current && phoneRef.current === target) setMsg(mutationErrorMessage(e, "Could not send the OTP. Please try again."));
    } finally { if (alive.current) setBusy(""); }
  };

  const confirm = async () => {
    if (busy || !sent) return;
    if (otp.length !== 6) { setMsg("Enter the 6-digit OTP."); return; }
    const target = phone; const tk = accessToken;
    setBusy("verify"); setMsg("");
    try {
      await verifyProfilePhone(`+91${target}`, otp);
      if (!alive.current || phoneRef.current !== target || tokenRef.current !== tk) return;
      setSentTo(null); setOtp("");
    } catch (e) {
      if (alive.current && phoneRef.current === target) setMsg(mutationErrorMessage(e, "Invalid or expired OTP."));
    } finally { if (alive.current) setBusy(""); }
  };

  const shown = error || (phone.length > 0 ? format : "");
  return (
    <View>
      <View style={f.row}>
        <View style={f.prefix}><Text style={f.prefixText}>+91</Text></View>
        <TextInput
          style={[f.input, !!shown && { borderColor: T.red400 }]}
          value={phone}
          onChangeText={edit}
          editable={!disabled && busy !== "verify"}
          keyboardType="phone-pad"
          placeholder="10-digit mobile number"
          placeholderTextColor={T.g400}
          autoComplete="tel"
          accessibilityLabel="Mobile number, optional, without country code"
        />
      </View>
      <ErrorLine text={shown} />
      {verified ? (
        <View style={f.ok} accessibilityLabel="Phone number verified"><Feather name="check-circle" size={16} color={T.green600} /><Text style={f.okText}>Phone verified</Text></View>
      ) : valid ? (
        <View style={{ marginTop: 6 }}>
          {!sent ? <Text style={f.help}>Verify to enable phone OTP login and payment pre-fill.</Text> : (
            <>
              <Text style={f.help}>OTP sent to +91 {phone}. Enter it below:</Text>
              <View style={f.otpRow}>
                <TextInput style={f.otp} value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad" placeholder="Enter OTP" placeholderTextColor={T.g400} maxLength={6}
                  editable={busy === ""} accessibilityLabel="6-digit OTP"
                  autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"} />
                <Pressable accessibilityRole="button" accessibilityLabel={busy === "verify" ? "Confirming" : "Confirm OTP"}
                  accessibilityState={{ disabled: busy !== "", busy: busy === "verify" }} disabled={busy !== ""} onPress={confirm}
                  style={[f.confirm, busy !== "" && { opacity: 0.5 }]}>
                  <Text style={f.confirmText}>{busy === "verify" ? "Confirming..." : "Confirm"}</Text>
                </Pressable>
              </View>
            </>
          )}
          <TextLink label={busy === "send" ? "Sending OTP..." : sent ? "Resend OTP" : "Verify phone number"} onPress={send} disabled={busy !== "" || disabled} />
          {msg ? <ErrorLine text={msg} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const f = StyleSheet.create({
  row: { flexDirection: "row", minHeight: 48 },
  prefix: { width: 56, backgroundColor: T.g100, borderWidth: 1, borderColor: T.g300, borderRightWidth: 0, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, alignItems: "center", justifyContent: "center" },
  prefixText: { color: T.g600, fontSize: 14, fontWeight: "500" },
  input: { flex: 1, minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: T.g300, backgroundColor: T.g50, borderTopRightRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 14, fontSize: 15, color: T.g900 },
  help: { color: T.g500, fontSize: 12, lineHeight: 18 },
  otpRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  otp: { flex: 1, minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: T.g300, backgroundColor: T.g50, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, color: T.g900, letterSpacing: 3 },
  confirm: { minHeight: 48, minWidth: 92, paddingHorizontal: 16, borderRadius: 8, backgroundColor: T.primary, alignItems: "center", justifyContent: "center" },
  confirmText: { color: T.white, fontWeight: "600", fontSize: 14 },
  ok: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, minHeight: 32 },
  okText: { color: T.green700, fontSize: 13, fontWeight: "600" },
});
