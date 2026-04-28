import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DimensionValue,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { useAuth, UserProfile } from "@/context/auth";
import api, {
  ApiError,
  ApiUser,
  BoardItem,
  ClassItem,
  MediumItem,
  SessionInfo,
  StateItem,
  UsageInfo,
} from "@/services/api";

type TabKey = "education" | "account" | "payment" | "settings" | "security";

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: "education", icon: "🎓", label: "Education" },
  { key: "account", icon: "👤", label: "Account" },
  { key: "payment", icon: "💳", label: "Payment" },
  { key: "settings", icon: "⚙️", label: "Settings" },
  { key: "security", icon: "🔒", label: "Security" },
];

type ToastState = {
  type: "success" | "error";
  message: string;
  hint?: string;
} | null;

function apiUserToPartial(u: ApiUser): Partial<UserProfile> {
  return {
    name: u.full_name ?? "",
    phone: u.phone,
    email: u.email,
    state: u.state,
    stateId: u.state_id,
    board: u.board,
    boardId: u.board_id,
    className: u.class_name,
    classId: u.class_id,
    profilePhotoUrl: u.profile_photo_url,
    phoneVerified: u.phone_verified,
    emailVerified: u.email_verified,
    profileComplete: u.profile_complete,
  };
}

function ProfileToast({
  toast,
  onDone,
}: {
  toast: ToastState;
  onDone: () => void;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!toast) return;
    progress.setValue(1);
    if (toast.type === "success") {
      const anim = Animated.timing(progress, {
        toValue: 0,
        duration: 3000,
        useNativeDriver: false,
      });
      anim.start(({ finished }) => { if (finished) onDone(); });
      return () => anim.stop();
    }
  }, [toast]);

  if (!toast) return null;
  const isSuccess = toast.type === "success";

  return (
    <View style={pt.overlay} pointerEvents="box-none">
      <View style={[pt.card, isSuccess ? pt.cardSuccess : pt.cardError]}>
        <View
          style={[
            pt.iconCircle,
            { backgroundColor: isSuccess ? "#dcfce7" : "#fee2e2" },
          ]}
        >
          <Text style={{ fontSize: 18 }}>{isSuccess ? "✓" : "✕"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pt.title}>
            {isSuccess ? "Update Successful" : "Update Failed"}
          </Text>
          <Text style={pt.msg}>{toast.message}</Text>
          {!!toast.hint && <Text style={pt.hint}>{toast.hint}</Text>}
        </View>
        <TouchableOpacity onPress={onDone}>
          <Feather name="x" size={16} color="#666" />
        </TouchableOpacity>
      </View>
      {isSuccess && (
        <View style={pt.progressBg}>
          <Animated.View
            style={[
              pt.progressFill,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }) as unknown as DimensionValue,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

type PickerItem = { id: number; name: string };

function DropdownPicker({
  label,
  items,
  selectedId,
  onSelect,
  placeholder,
  disabled,
  loading,
}: {
  label: string;
  items: PickerItem[];
  selectedId: number | null;
  onSelect: (item: PickerItem) => void;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === selectedId);

  return (
    <View style={{ zIndex: open ? 10 : 1, marginBottom: 2 }}>
      <Text style={dp.label}>{label}</Text>
      <Pressable
        style={[dp.selector, disabled && dp.selectorDisabled]}
        onPress={() => { if (!disabled && !loading) setOpen((v) => !v); }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text style={[dp.selectorText, !selected && dp.placeholder]}>
            {selected?.name ?? placeholder}
          </Text>
        )}
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={15}
          color={disabled ? Colors.gray300 : Colors.gray400}
        />
      </Pressable>
      {open && !loading && (
        <View style={dp.dropdown}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={{ maxHeight: 160 }}
          >
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={[dp.option, item.id === selectedId && dp.optionSelected]}
                onPress={() => { onSelect(item); setOpen(false); }}
              >
                <Text
                  style={[
                    dp.optionText,
                    item.id === selectedId && dp.optionTextSel,
                  ]}
                >
                  {item.name}
                </Text>
                {item.id === selectedId && (
                  <Feather name="check" size={12} color={Colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function EducationTab({
  token,
  showToast,
}: {
  token: string;
  showToast: (t: ToastState) => void;
}) {
  const { user, updateUser } = useAuth();

  const [states, setStates] = useState<StateItem[]>([]);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [mediums, setMediums] = useState<MediumItem[]>([]);

  const [stateId, setStateId] = useState<number | null>(user?.stateId ?? null);
  const [boardId, setBoardId] = useState<number | null>(user?.boardId ?? null);
  const [classId, setClassId] = useState<number | null>(user?.classId ?? null);
  const [mediumId, setMediumId] = useState<number | null>(null);

  const [statesLoading, setStatesLoading] = useState(true);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [mediumsLoading, setMediumsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.data
      .getStates()
      .then((d) => setStates(d.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setStatesLoading(false));
  }, []);

  useEffect(() => {
    if (stateId && boards.length === 0) {
      setBoardsLoading(true);
      api.data
        .getBoards(stateId)
        .then((d) =>
          setBoards(d.sort((a, b) => a.name.localeCompare(b.name)))
        )
        .catch(() => {})
        .finally(() => setBoardsLoading(false));
    }
  }, [stateId]);

  const handleStateSelect = async (item: StateItem) => {
    setStateId(item.id);
    setBoardId(null);
    setClassId(null);
    setMediumId(null);
    setBoards([]);
    setClasses([]);
    setMediums([]);
    setBoardsLoading(true);
    try {
      const d = await api.data.getBoards(item.id);
      setBoards(d.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
    } finally {
      setBoardsLoading(false);
    }
  };

  const handleBoardSelect = async (item: BoardItem) => {
    setBoardId(item.id);
    setClassId(null);
    setMediumId(null);
    setClasses([]);
    setMediums([]);
    setClassesLoading(true);
    try {
      const d = await api.data.getClasses(item.id);
      setClasses(d.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
    } finally {
      setClassesLoading(false);
    }
  };

  const handleClassSelect = async (item: ClassItem) => {
    setClassId(item.id);
    setMediumId(null);
    setMediums([]);
    if (boardId) {
      setMediumsLoading(true);
      try {
        const d = await api.data.getMediums(boardId, item.id);
        setMediums(d);
      } catch {
      } finally {
        setMediumsLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!boardId) {
      showToast({ type: "error", message: "Please select a board." });
      return;
    }
    setSaving(true);
    try {
      const res = await api.profile.updateStudentProfile(token, {
        state_id: stateId ?? undefined,
        board_id: boardId,
        class_id: classId ?? undefined,
        medium_id: mediumId ?? undefined,
      });
      await updateUser(apiUserToPartial(res.user));
      showToast({
        type: "success",
        message: "Education details saved successfully.",
      });
    } catch (e) {
      showToast({
        type: "error",
        message:
          e instanceof ApiError
            ? e.message
            : "Failed to save education details.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={tab.scrollContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <Text style={tab.sectionTitle}>Academic Details</Text>
      <View style={{ gap: 14 }}>
        <DropdownPicker
          label="State"
          items={states}
          selectedId={stateId}
          onSelect={(i) => handleStateSelect(i as StateItem)}
          placeholder="Select state"
          loading={statesLoading}
        />
        <DropdownPicker
          label="Board"
          items={boards}
          selectedId={boardId}
          onSelect={(i) => handleBoardSelect(i as BoardItem)}
          placeholder="Select board"
          disabled={!stateId}
          loading={boardsLoading}
        />
        <DropdownPicker
          label="Class"
          items={classes}
          selectedId={classId}
          onSelect={(i) => handleClassSelect(i as ClassItem)}
          placeholder="Select class"
          disabled={!boardId}
          loading={classesLoading}
        />
        <DropdownPicker
          label="Medium"
          items={mediums}
          selectedId={mediumId}
          onSelect={(i) => setMediumId(i.id)}
          placeholder="Select medium"
          disabled={!classId}
          loading={mediumsLoading}
        />
      </View>
      <TouchableOpacity
        style={[tab.saveBtn, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={tab.saveBtnText}>Save Education Details</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function AccountTab({
  token,
  showToast,
  onAccountDeleted,
}: {
  token: string;
  showToast: (t: ToastState) => void;
  onAccountDeleted: () => void;
}) {
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(
    (user?.phone ?? "").replace("+91", "")
  );
  const [saving, setSaving] = useState(false);

  const [otpStep, setOtpStep] = useState<"idle" | "verifying">("idle");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const [deleteExpanded, setDeleteExpanded] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isPhoneComplete =
    phone.replace(/\D/g, "").length === 10;
  const phoneVerified = user?.phoneVerified ?? false;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.profile.updateStudentProfile(token, {
        full_name: name.trim() || undefined,
        email: email.trim() || undefined,
      });
      await updateUser(apiUserToPartial(res.user));
      showToast({ type: "success", message: "Account details saved." });
    } catch (e) {
      showToast({
        type: "error",
        message:
          e instanceof ApiError ? e.message : "Failed to save account details.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpLoading(true);
    try {
      await api.profile.sendPhoneOtp(
        token,
        `+91${phone.replace(/\D/g, "")}`
      );
      setOtpStep("verifying");
    } catch (e) {
      showToast({
        type: "error",
        message:
          e instanceof ApiError ? e.message : "Failed to send OTP.",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpLoading(true);
    try {
      await api.profile.verifyPhoneOtp(
        token,
        `+91${phone.replace(/\D/g, "")}`,
        otp
      );
      setOtpStep("idle");
      setOtp("");
      await updateUser({
        phone: `+91${phone.replace(/\D/g, "")}`,
        phoneVerified: true,
      });
      showToast({ type: "success", message: "Phone number verified!" });
    } catch (e) {
      showToast({
        type: "error",
        message: e instanceof ApiError ? e.message : "Invalid OTP.",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE") return;
    setDeleteLoading(true);
    try {
      await api.profile.deleteAccount(token);
      onAccountDeleted();
      await logout();
    } catch (e) {
      showToast({
        type: "error",
        message:
          e instanceof ApiError ? e.message : "Failed to delete account.",
      });
      setDeleteLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={tab.scrollContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <Text style={tab.sectionTitle}>Personal Information</Text>
      <View style={{ gap: 12 }}>
        <View>
          <Text style={tab.fieldLabel}>Full Name</Text>
          <TextInput
            style={tab.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={Colors.darkTextMuted}
          />
        </View>
        <View>
          <Text style={tab.fieldLabel}>Email Address</Text>
          <TextInput
            style={tab.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.darkTextMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View>
          <Text style={tab.fieldLabel}>Phone Number</Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
            }}
          >
            <View style={tab.phonePre}>
              <Text style={{ color: Colors.darkText, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                +91
              </Text>
            </View>
            <TextInput
              style={[tab.input, { flex: 1 }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit number"
              placeholderTextColor={Colors.darkTextMuted}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <View
              style={[
                tab.badge,
                phoneVerified ? tab.badgeVerified : tab.badgeUnverified,
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_600SemiBold",
                  color: phoneVerified ? "#16a34a" : "#b45309",
                }}
              >
                {phoneVerified ? "✓ Verified" : "Not Verified"}
              </Text>
            </View>
          </View>
          {isPhoneComplete && !phoneVerified && otpStep === "idle" && (
            <TouchableOpacity
              onPress={handleSendOtp}
              style={{ marginTop: 8 }}
              disabled={otpLoading}
            >
              <Text
                style={{
                  color: Colors.primary,
                  fontSize: 13,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {otpLoading ? "Sending..." : "Verify phone number →"}
              </Text>
            </TouchableOpacity>
          )}
          {otpStep === "verifying" && (
            <View style={{ marginTop: 10, gap: 8 }}>
              <TextInput
                style={tab.input}
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor={Colors.darkTextMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[
                    tab.saveBtn,
                    { flex: 1, paddingVertical: 10 },
                    (otpLoading || otp.length < 6) && { opacity: 0.5 },
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={otpLoading || otp.length < 6}
                >
                  {otpLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={tab.saveBtnText}>Confirm</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[tab.outlineBtn, { flex: 1 }]}
                  onPress={handleSendOtp}
                  disabled={otpLoading}
                >
                  <Text style={tab.outlineBtnText}>Resend OTP</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={tab.notice}>
        <Feather name="info" size={13} color={Colors.darkTextMuted} />
        <Text style={tab.noticeText}>
          Password login is disabled — account uses OTP-based login
        </Text>
      </View>

      <TouchableOpacity
        style={[tab.saveBtn, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={tab.saveBtnText}>Save Account Details</Text>
        )}
      </TouchableOpacity>

      <View style={tab.dangerCard}>
        <Text style={tab.dangerTitle}>Danger Zone</Text>
        <TouchableOpacity
          onPress={() => setDeleteExpanded((v) => !v)}
          style={tab.dangerBtnRow}
        >
          <Feather name="trash-2" size={15} color="#dc2626" />
          <Text style={tab.dangerBtnText}>Delete my account permanently</Text>
          <Feather
            name={deleteExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color="#dc2626"
          />
        </TouchableOpacity>
        {deleteExpanded && (
          <View style={{ gap: 10, marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: Colors.darkTextMuted, fontFamily: "Inter_400Regular" }}>
              This permanently deletes your account and all data. Type{" "}
              <Text style={{ fontFamily: "Inter_700Bold", color: "#dc2626" }}>DELETE</Text>{" "}
              to confirm.
            </Text>
            <TextInput
              style={[tab.input, { borderColor: "#dc2626" }]}
              value={deleteText}
              onChangeText={setDeleteText}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={Colors.darkTextMuted}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[
                tab.deleteConfirmBtn,
                (deleteText !== "DELETE" || deleteLoading) && { opacity: 0.45 },
              ]}
              onPress={handleDeleteAccount}
              disabled={deleteText !== "DELETE" || deleteLoading}
            >
              {deleteLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={tab.deleteConfirmBtnText}>
                  Delete Account Permanently
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function PaymentTab({
  token,
  showToast,
}: {
  token: string;
  showToast: (t: ToastState) => void;
}) {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [autopayOn, setAutopayOn] = useState(false);

  useEffect(() => {
    api.study
      .getUsage(token)
      .then((d) => setUsage(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const isFree = !usage || usage.status === "free";
  const used = usage?.questions_used ?? 0;
  const limit = usage?.questions_limit ?? 1;
  const pct = Math.min((used / limit) * 100, 100);
  const barColor =
    pct >= 90 ? Colors.danger : pct >= 70 ? Colors.warning : Colors.primary;

  const handleToggle = async (val: boolean) => {
    if (isFree) return;
    setToggling(true);
    try {
      const res = await api.profile.toggleAutopay(token, val);
      setAutopayOn(res.autopay_enabled);
      showToast({
        type: "success",
        message: `Auto-renew ${res.autopay_enabled ? "enabled" : "disabled"}.`,
      });
    } catch (e) {
      showToast({
        type: "error",
        message:
          e instanceof ApiError
            ? e.message
            : "Failed to toggle auto-renew.",
      });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 40,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={tab.scrollContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <View style={tab.payCard}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={tab.sectionTitle}>My Subscription</Text>
            <Text style={tab.planName}>{usage?.plan_name ?? "Free Plan"}</Text>
          </View>
          <View
            style={[
              tab.statusBadge,
              {
                backgroundColor: isFree
                  ? "rgba(107,114,128,0.15)"
                  : "rgba(22,163,74,0.15)",
                borderColor: isFree
                  ? "rgba(107,114,128,0.3)"
                  : "rgba(22,163,74,0.3)",
              },
            ]}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_600SemiBold",
                color: isFree ? Colors.darkTextMuted : "#22c55e",
              }}
            >
              {usage?.status === "active"
                ? "Active"
                : usage?.status === "free"
                ? "Free"
                : (usage?.status ?? "Unknown")}
            </Text>
          </View>
        </View>

        <View style={{ gap: 6, marginTop: 14 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={tab.usageLabel}>Questions Used</Text>
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                color: Colors.darkText,
                fontSize: 14,
              }}
            >
              {used}
              <Text
                style={{
                  color: Colors.darkTextMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {" "}
                / {limit}
              </Text>
            </Text>
          </View>
          <View style={tab.progressBg}>
            <View
              style={[
                tab.progressFill,
                {
                  width: `${pct}%` as DimensionValue,
                  backgroundColor: barColor,
                },
              ]}
            />
          </View>
          <Text
            style={{
              fontSize: 12,
              color: Colors.darkTextMuted,
              fontFamily: "Inter_400Regular",
            }}
          >
            {limit - used} questions remaining this period
          </Text>
        </View>

        {!!usage?.renewal_date && (
          <Text
            style={{
              fontSize: 12,
              color: Colors.darkTextMuted,
              fontFamily: "Inter_400Regular",
              marginTop: 8,
            }}
          >
            Resets:{" "}
            {new Date(usage.renewal_date).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </Text>
        )}

        <TouchableOpacity style={tab.upgradeBtn}>
          <Text style={tab.upgradeBtnText}>
            {isFree ? "Upgrade to Premium →" : "Change Plan →"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={tab.payCard}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Inter_600SemiBold",
                color: Colors.darkText,
              }}
            >
              Auto-Renew
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: Colors.darkTextMuted,
                fontFamily: "Inter_400Regular",
                marginTop: 2,
              }}
            >
              {isFree
                ? "Available on paid plans"
                : "Automatically renew your subscription"}
            </Text>
          </View>
          <Switch
            value={autopayOn}
            onValueChange={handleToggle}
            disabled={isFree || toggling}
            trackColor={{ false: Colors.darkSurface, true: "#22c55e" }}
            thumbColor={autopayOn ? "#fff" : Colors.gray300}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function SettingsTab() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 40,
      }}
    >
      <Text style={{ fontSize: 40, marginBottom: 12 }}>⚙️</Text>
      <Text
        style={{
          fontSize: 16,
          fontFamily: "Inter_600SemiBold",
          color: Colors.darkText,
          marginBottom: 8,
        }}
      >
        Settings
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: Colors.darkTextMuted,
          fontFamily: "Inter_400Regular",
          textAlign: "center",
          paddingHorizontal: 32,
        }}
      >
        Additional settings will be available soon.
      </Text>
    </View>
  );
}

function SecurityTab({
  token,
  showToast,
}: {
  token: string;
  showToast: (t: ToastState) => void;
}) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    api.profile
      .getSessions(token)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api.profile.deleteSession(token, id);
      setSessions((s) => s.filter((x) => x.id !== id));
      showToast({ type: "success", message: "Session signed out." });
    } catch (e) {
      showToast({
        type: "error",
        message:
          e instanceof ApiError ? e.message : "Failed to revoke session.",
      });
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 40,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={tab.scrollContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <Text style={tab.sectionTitle}>Active Sessions</Text>
      {sessions.length === 0 ? (
        <Text
          style={{
            fontSize: 13,
            color: Colors.darkTextMuted,
            fontFamily: "Inter_400Regular",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          No active sessions found.
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {sessions.map((s) => (
            <View key={s.id} style={tab.sessionCard}>
              <View style={tab.sessionIconBox}>
                <Feather name="smartphone" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Inter_600SemiBold",
                    color: Colors.darkText,
                  }}
                  numberOfLines={1}
                >
                  {s.device_info ?? s.user_agent ?? "Unknown Device"}
                </Text>
                {!!s.ip_address && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.darkTextMuted,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    IP: {s.ip_address}
                  </Text>
                )}
                {!!s.last_used_at && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.darkTextMuted,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    Last used:{" "}
                    {new Date(s.last_used_at).toLocaleString("en-IN")}
                  </Text>
                )}
                {s.is_current && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_600SemiBold",
                      color: "#22c55e",
                      marginTop: 2,
                    }}
                  >
                    ● Current session
                  </Text>
                )}
              </View>
              {!s.is_current && (
                <TouchableOpacity
                  style={tab.revokeBtn}
                  onPress={() => handleRevoke(s.id)}
                  disabled={revokingId === s.id}
                >
                  {revokingId === s.id ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Text style={tab.revokeBtnText}>Sign out</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ProfileModal({ visible, onClose }: Props) {
  const { user, accessToken, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("education");
  const [toast, setToast] = useState<ToastState>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const token = accessToken ?? "";

  const showToast = useCallback((t: ToastState) => setToast(t), []);

  const displayName = user?.name ?? "Student";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  const photoUrl = user?.profilePhotoUrl;

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to upload a profile photo."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoLoading(true);
    try {
      const res = await api.profile.uploadPhoto(token, result.assets[0].uri);
      await updateUser({ profilePhotoUrl: res.profile_photo_url });
      showToast({ type: "success", message: "Profile photo updated." });
    } catch (e) {
      showToast({
        type: "error",
        message:
          e instanceof ApiError ? e.message : "Failed to upload photo.",
      });
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoLoading(true);
    try {
      await api.profile.deletePhoto(token);
      await updateUser({ profilePhotoUrl: undefined });
      showToast({ type: "success", message: "Profile photo removed." });
    } catch (e) {
      showToast({
        type: "error",
        message:
          e instanceof ApiError ? e.message : "Failed to remove photo.",
      });
    } finally {
      setPhotoLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={pm.backdrop}>
        <View style={pm.card}>
          <View style={pm.header}>
            <TouchableOpacity
              style={pm.avatarWrap}
              onPress={handlePickPhoto}
              activeOpacity={0.85}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={pm.avatarImg} />
              ) : (
                <LinearGradient
                  colors={["#7c3aed", "#4f46e5"]}
                  style={pm.avatarGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={pm.avatarInitials}>{initials || "U"}</Text>
                </LinearGradient>
              )}
              <View style={pm.avatarOverlay}>
                {photoLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={18} color="#fff" />
                )}
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={pm.name} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={pm.subText} numberOfLines={1}>
                {user?.email ?? user?.phone ?? ""}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 5 }}>
                <TouchableOpacity onPress={handlePickPhoto}>
                  <Text style={pm.photoLink}>Change Photo</Text>
                </TouchableOpacity>
                {!!photoUrl && (
                  <TouchableOpacity onPress={handleRemovePhoto}>
                    <Text style={pm.removeLink}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity style={pm.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={pm.tabBar}
            style={pm.tabBarWrap}
          >
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={pm.tabItem}
                onPress={() => setActiveTab(t.key)}
              >
                <Text
                  style={[
                    pm.tabLabel,
                    activeTab === t.key && pm.tabLabelActive,
                  ]}
                >
                  {t.icon} {t.label}
                </Text>
                <View
                  style={[
                    pm.tabUnderline,
                    activeTab === t.key && pm.tabUnderlineActive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={pm.tabContent}>
            {activeTab === "education" && (
              <EducationTab token={token} showToast={showToast} />
            )}
            {activeTab === "account" && (
              <AccountTab
                token={token}
                showToast={showToast}
                onAccountDeleted={onClose}
              />
            )}
            {activeTab === "payment" && (
              <PaymentTab token={token} showToast={showToast} />
            )}
            {activeTab === "settings" && <SettingsTab />}
            {activeTab === "security" && (
              <SecurityTab token={token} showToast={showToast} />
            )}
          </View>

          <ProfileToast toast={toast} onDone={() => setToast(null)} />
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    backgroundColor: Colors.darkCard,
    borderRadius: 20,
    width: "100%",
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkDivider,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(167,139,250,0.35)",
  },
  avatarImg: { width: 64, height: 64 },
  avatarGrad: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.darkText,
  },
  subText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
    marginTop: 2,
  },
  photoLink: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  removeLink: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.danger,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tabBarWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkDivider,
  },
  tabBar: { flexDirection: "row", paddingHorizontal: 8 },
  tabItem: { paddingHorizontal: 12, alignItems: "center" },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextMuted,
    paddingVertical: 12,
  },
  tabLabelActive: { color: Colors.secondary },
  tabUnderline: {
    height: 2,
    width: "100%",
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  tabUnderlineActive: { backgroundColor: Colors.secondary },
  tabContent: { flex: 1, minHeight: 280 },
});

const tab = StyleSheet.create({
  scrollContent: { padding: 20, gap: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.darkTextMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextSub,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.darkBg1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.darkDivider,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.darkText,
  },
  phonePre: {
    backgroundColor: Colors.darkBg1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.darkDivider,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  badgeVerified: {
    backgroundColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.3)",
  },
  badgeUnverified: {
    backgroundColor: "rgba(217,119,6,0.12)",
    borderColor: "rgba(217,119,6,0.3)",
  },
  notice: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: Colors.darkSurface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.darkDivider,
    padding: 12,
  },
  noticeText: {
    fontSize: 12,
    color: Colors.darkTextMuted,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.darkDivider,
  },
  outlineBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextSub,
  },
  dangerCard: {
    backgroundColor: "rgba(220,38,38,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.2)",
    padding: 16,
  },
  dangerTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#dc2626",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  dangerBtnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#dc2626",
    flex: 1,
  },
  deleteConfirmBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteConfirmBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  payCard: {
    backgroundColor: Colors.darkBg1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
  },
  planName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.darkText,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    flexShrink: 0,
  },
  usageLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextSub,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.darkSurface,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  upgradeBtn: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  upgradeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.darkBg1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
  },
  sessionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(102,126,234,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  revokeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(220,38,38,0.1)",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.25)",
  },
  revokeBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#dc2626",
  },
});

const dp = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextSub,
    marginBottom: 6,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.darkBg1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.darkDivider,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectorDisabled: { opacity: 0.45 },
  selectorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.darkText,
    flex: 1,
  },
  placeholder: { color: Colors.darkTextMuted },
  dropdown: {
    backgroundColor: Colors.darkCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionSelected: { backgroundColor: "rgba(102,126,234,0.1)" },
  optionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.darkText,
    flex: 1,
  },
  optionTextSel: {
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
});

const pt = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  cardSuccess: { borderColor: "#22c55e" },
  cardError: { borderColor: "#dc2626" },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111",
    marginBottom: 2,
  },
  msg: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#444" },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#666",
    marginTop: 2,
  },
  progressBg: {
    height: 3,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: { height: 3, backgroundColor: "#22c55e", borderRadius: 2 },
});
