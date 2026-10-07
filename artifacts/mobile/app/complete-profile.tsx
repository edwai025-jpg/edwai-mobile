import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import WhatsNewPanel from "@/components/WhatsNewPanel";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import api, { ApiError, BoardItem, ClassItem, StateItem } from "@/services/api";

type PickerItem = { id: number; name: string };

function SectionBadge({ number }: { number: number }) {
  return (
    <View style={s.sectionBadgeRow}>
      <View style={s.sectionCircle}>
        <Text style={s.sectionCircleNum}>{number}</Text>
      </View>
      <View style={s.sectionDivider} />
    </View>
  );
}

function PickerField({
  label,
  items,
  selectedId,
  onSelect,
  placeholder,
  disabled,
  loading: listLoading,
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
  const selectedName = items.find((i) => i.id === selectedId)?.name ?? "";

  return (
    <View style={s.pickerWrapper}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable
        style={[s.pickerSelector, disabled && s.pickerDisabled]}
        onPress={() => !disabled && !listLoading && setOpen(!open)}
      >
        {listLoading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 4 }} />
        ) : (
          <Text style={[s.pickerText, !selectedId && s.pickerPlaceholder]}>
            {selectedName || placeholder}
          </Text>
        )}
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={disabled ? Colors.gray300 : Colors.gray400}
        />
      </Pressable>
      {open && !listLoading && (
        <View style={s.dropdown}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 180 }}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={[s.dropdownOption, item.id === selectedId && s.dropdownOptionSelected]}
                onPress={() => { onSelect(item); setOpen(false); }}
              >
                <Text style={[s.dropdownOptionText, item.id === selectedId && s.dropdownOptionTextSel]}>
                  {item.name}
                </Text>
                {item.id === selectedId && <Feather name="check" size={13} color={Colors.indigo} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeProfile, user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone?.replace("+91", "") ?? "");

  const [states, setStates] = useState<StateItem[]>([]);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [statesLoading, setStatesLoading] = useState(true);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);

  const [selectedState, setSelectedState] = useState<StateItem | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<BoardItem | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    api.data.getStates()
      .then((data) => setStates(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => { /* silent */ })
      .finally(() => setStatesLoading(false));
  }, []);

  const handleStateSelect = async (item: StateItem) => {
    setSelectedState(item);
    setSelectedBoard(null);
    setSelectedClass(null);
    setBoards([]);
    setClasses([]);
    setBoardsLoading(true);
    try {
      const data = await api.data.getBoards(item.id);
      setBoards(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      // silent
    } finally {
      setBoardsLoading(false);
    }
  };

  const handleBoardSelect = async (item: PickerItem) => {
    const board = boards.find(b => b.id === item.id);
    if (!board) return;
    setSelectedBoard(board);
    setSelectedClass(null);
    setClasses([]);
    setClassesLoading(true);
    try {
      const data = await api.data.getClasses(item.id);
      setClasses(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      // silent
    } finally {
      setClassesLoading(false);
    }
  };

  const canProceedOwnBooks = name.trim().length > 0 && privacyAccepted;
  const canGetStarted = name.trim().length > 0 && !!selectedBoard && privacyAccepted;

  const doSubmit = async (boardId: number, classId?: number): Promise<boolean> => {
    setErrorMsg("");
    setLoading(true);
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const phonePayload =
        phoneDigits.length === 10 && /^[6-9]/.test(phoneDigits)
          ? `+91${phoneDigits}`
          : undefined;

      await completeProfile({
        name: name.trim(),
        stateId: selectedState?.id,
        boardId,
        classId,
        phone: phonePayload,
      });
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to save profile. Please try again.";
      setErrorMsg(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setErrorMsg("Please enter your full name"); return; }
    if (!selectedBoard) { setErrorMsg("Please select your board"); return; }
    if (!privacyAccepted) { setErrorMsg("Please accept the Terms of Service and Privacy Policy"); return; }
    const ok = await doSubmit(selectedBoard.id, selectedClass?.id);
    if (ok) router.replace("/(tabs)");
  };

  const handleProceedOwnBooks = async () => {
    if (!canProceedOwnBooks) return;
    const boardId = selectedBoard?.id ?? 5;
    const ok = await doSubmit(boardId, selectedClass?.id);
    if (ok) router.replace("/(tabs)/my-docs");
  };

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#EEF2FF", "#FFFFFF", "#F5F3FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: topInset + 20, paddingBottom: insets.bottom + 48 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── BADGE ── */}
          <View style={s.setupBadge}>
            <View style={s.setupBadgeDot} />
            <Text style={s.setupBadgeText}>SETUP YOUR PROFILE</Text>
          </View>

          {/* ── TITLE ── */}
          <Text style={s.titleLine}>
            <Text style={s.titleEdw}>Welcome to Edw</Text>
            <Text style={s.titleAI}>AI</Text>
          </Text>
          <Text style={s.subtitle}>Tell us about yourself to personalise your experience</Text>

          {/* ── ERROR BANNER ── */}
          {!!errorMsg && (
            <View style={s.errorBanner}>
              <Feather name="alert-circle" size={14} color="#B91C1C" />
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* ══ MAIN CARD ══ */}
          <View style={s.card}>

            {/* ─ SECTION 1 ─ */}
            <SectionBadge number={1} />

            <Text style={s.fieldLabel}>Your Name</Text>
            <TextInput
              style={s.input}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.placeholder}
              value={name}
              onChangeText={(t) => { setName(t); setErrorMsg(""); }}
              autoCapitalize="words"
            />

            <View style={s.hr} />

            <View style={s.mobileHeaderRow}>
              <Text style={s.fieldLabel}>Mobile Number</Text>
              <View style={s.optionalPill}>
                <Text style={s.optionalPillText}>optional</Text>
              </View>
            </View>
            <Text style={s.mobileDesc}>
              Add your Indian mobile number to enable phone OTP login and get it pre-filled during payment.
            </Text>
            <View style={s.phoneRow}>
              <View style={s.phonePrefix}>
                <Text style={s.phonePrefixText}>+91</Text>
              </View>
              <TextInput
                style={s.phoneInput}
                placeholder="10-digit mobile number"
                placeholderTextColor={Colors.placeholder}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
              />
            </View>
            <View style={s.skipRow}>
              <Text style={s.skipHint}>This is optional — you can always add it later.</Text>
              <Pressable onPress={() => setPhone("")}>
                <Text style={s.skipLink}>Skip for now</Text>
              </Pressable>
            </View>

            {/* ─ SECTION 2 ─ */}
            <View style={{ marginTop: 24 }}>
              <SectionBadge number={2} />
            </View>

            <Text style={s.findBoardTitle}>Find Your Board</Text>

            <PickerField
              label="State"
              items={states}
              selectedId={selectedState?.id ?? null}
              onSelect={handleStateSelect}
              placeholder="Select State"
              loading={statesLoading}
            />
            <PickerField
              label="Board / University"
              items={boards}
              selectedId={selectedBoard?.id ?? null}
              onSelect={handleBoardSelect}
              placeholder="Select Board"
              disabled={!selectedState}
              loading={boardsLoading}
            />
            <PickerField
              label="Class / Year"
              items={classes}
              selectedId={selectedClass?.id ?? null}
              onSelect={setSelectedClass}
              placeholder={classes.length === 0 && selectedBoard ? "No classes available" : "Select Class"}
              disabled={!selectedBoard}
              loading={classesLoading}
            />

            {/* ─ GET STARTED ─ */}
            <Pressable
              style={[s.getStartedBtn, (!canGetStarted || loading) && s.getStartedBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient
                colors={canGetStarted ? [Colors.indigo, "#7C3AED"] : ["#A5B4FC", "#C4B5FD"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.getStartedBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Text style={s.getStartedBtnText}>Get Started</Text>
                    <Feather name="check-circle" size={17} color={Colors.white} />
                  </>
                )}
              </LinearGradient>
            </Pressable>

          </View>

          {/* ══ OWN RESOURCES CARD ══ */}
          <View style={s.ownCard}>
            <View style={s.ownCardTopRow}>
              <View style={s.ownIconBox}>
                <Feather name="upload" size={22} color={Colors.greenSuccess} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.ownCardTitle}>Use Your Own Resources</Text>
                <Text style={s.ownCardDesc}>
                  Upload your own textbooks or YouTube videos and start studying right away.
                </Text>
                {!canProceedOwnBooks && (
                  <Text style={s.ownCardHint}>
                    {!name.trim()
                      ? "Enter your name above to continue."
                      : "Accept the terms below to continue."}
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              style={[s.ownBtn, !canProceedOwnBooks && s.ownBtnDisabled]}
              onPress={handleProceedOwnBooks}
              disabled={!canProceedOwnBooks || loading}
            >
              <Text style={s.ownBtnText}>Proceed to Own Books</Text>
            </Pressable>
          </View>

          {/* ══ TERMS ══ */}
          <Pressable style={s.termsBox} onPress={() => { setPrivacyAccepted(!privacyAccepted); setErrorMsg(""); }}>
            <View style={[s.checkbox, privacyAccepted && s.checkboxChecked]}>
              {privacyAccepted && <Feather name="check" size={11} color={Colors.white} />}
            </View>
            <Text style={s.termsText}>
              I agree to EdwAI's{" "}
              <Text style={s.termsLink}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={s.termsLink}>Privacy Policy</Text>
              , including the use of AI to generate answers from textbook content.
            </Text>
          </Pressable>

          {/* ══ WHAT'S NEW PANEL ══ */}
          <WhatsNewPanel />

          {/* ── FOOTER ── */}
          <View style={s.footerRow}>
            <Feather name="shield" size={15} color={Colors.greenSuccess} />
            <Text style={s.footerText}>Trusted by 10,000+ students across India</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16 },

  setupBadge: {
    alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EEF2FF", borderRadius: 20, borderWidth: 1, borderColor: Colors.indigoBorder,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 18,
  },
  setupBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.indigo },
  setupBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.indigo, letterSpacing: 1.2 },

  titleLine: { textAlign: "center", marginBottom: 8 },
  titleEdw: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.indigo },
  titleAI: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.gray900 },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.gray500,
    textAlign: "center", marginBottom: 16, lineHeight: 20,
  },

  errorBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#B91C1C", lineHeight: 18 },

  card: {
    backgroundColor: Colors.white, borderRadius: 16, paddingTop: 28,
    paddingHorizontal: 18, paddingBottom: 24,
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 5, marginBottom: 16,
  },

  sectionBadgeRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12,
  },
  sectionCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.indigo,
    alignItems: "center", justifyContent: "center",
  },
  sectionCircleNum: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.white },
  sectionDivider: { flex: 1, height: 1, backgroundColor: Colors.gray200 },

  fieldLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.gray700, marginBottom: 7 },

  input: {
    borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8, backgroundColor: Colors.white,
    paddingHorizontal: 14, paddingVertical: 0, height: 48,
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.gray900, marginBottom: 16,
  },

  hr: { height: 1, backgroundColor: Colors.gray100, marginBottom: 16 },

  mobileHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  optionalPill: { backgroundColor: Colors.gray100, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  optionalPillText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.gray500 },
  mobileDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.gray400, lineHeight: 18, marginBottom: 10 },

  phoneRow: {
    flexDirection: "row", borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8,
    height: 48, overflow: "hidden", marginBottom: 8,
  },
  phonePrefix: {
    width: 52, backgroundColor: Colors.gray100, alignItems: "center", justifyContent: "center",
    borderRightWidth: 1, borderRightColor: Colors.gray200,
  },
  phonePrefixText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.gray600 },
  phoneInput: {
    flex: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular",
    color: Colors.gray900, backgroundColor: Colors.white,
  },

  skipRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  skipHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.gray400, flex: 1 },
  skipLink: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.indigo },

  findBoardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.gray900, marginBottom: 14 },

  pickerWrapper: { marginBottom: 14 },
  pickerSelector: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8, backgroundColor: Colors.white,
    paddingHorizontal: 14, height: 48,
  },
  pickerDisabled: { backgroundColor: Colors.gray50, borderColor: Colors.gray200 },
  pickerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.gray900 },
  pickerPlaceholder: { color: Colors.placeholder },
  dropdown: {
    marginTop: 4, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8,
    backgroundColor: Colors.white, shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12,
    elevation: 4, overflow: "hidden",
  },
  dropdownOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  dropdownOptionSelected: { backgroundColor: "#EEF2FF" },
  dropdownOptionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.gray800 },
  dropdownOptionTextSel: { fontFamily: "Inter_600SemiBold", color: Colors.indigo },

  termsBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: Colors.blueTint, borderRadius: 10, borderWidth: 1, borderColor: Colors.blueTintBorder,
    padding: 14, marginBottom: 16,
  },
  checkbox: {
    width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.gray300,
    alignItems: "center", justifyContent: "center", marginTop: 1, backgroundColor: Colors.white,
  },
  checkboxChecked: { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  termsText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.gray600, lineHeight: 18 },
  termsLink: { color: Colors.indigo, fontFamily: "Inter_500Medium" },

  getStartedBtn: { borderRadius: 10, overflow: "hidden" },
  getStartedBtnDisabled: { opacity: 0.7 },
  getStartedBtnGradient: {
    height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  getStartedBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.white },

  ownCard: {
    backgroundColor: Colors.greenSuccessLight, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.greenSuccessBorder, padding: 16, marginBottom: 16,
  },
  ownCardTopRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  ownIconBox: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(16,185,129,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  ownCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.gray900, marginBottom: 4 },
  ownCardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.gray600, lineHeight: 17 },
  ownCardHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.gray400, marginTop: 4, fontStyle: "italic" },
  ownBtn: { backgroundColor: Colors.greenSuccess, borderRadius: 24, paddingVertical: 13, alignItems: "center" },
  ownBtnDisabled: { backgroundColor: Colors.greenSuccessDisabled },
  ownBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },

  footerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingBottom: 16,
  },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.gray700 },
});
