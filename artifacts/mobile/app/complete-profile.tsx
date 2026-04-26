import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";

const STATES = [
  "Andhra Pradesh",
  "Bihar",
  "Delhi",
  "Gujarat",
  "Haryana",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
];

const BOARDS_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": ["Andhra Pradesh School Education", "Andhra University", "JNTU Anantapur"],
  Telangana: ["Telangana School Education", "Osmania University", "JNTU Hyderabad"],
  Maharashtra: ["Maharashtra SSC Board", "Maharashtra HSC Board", "Mumbai University"],
  Karnataka: ["Karnataka SSLC Board", "Karnataka PUC Board", "Bangalore University"],
  "Tamil Nadu": ["Tamil Nadu SSLC Board", "Tamil Nadu HSC Board", "Anna University"],
  Delhi: ["CBSE", "Delhi Board of Secondary Education"],
  default: ["CBSE", "ICSE", "State Board"],
};

const CLASSES_BY_BOARD: Record<string, string[]> = {
  "Andhra Pradesh School Education": ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"],
  "Telangana School Education": ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"],
  "Andhra University": ["BSC 1st Year", "BSC 2nd Year", "BSC 3rd Year"],
  "Osmania University": ["BSC 1st Year", "BSC 2nd Year", "BSC 3rd Year", "BA 1st Year"],
  CBSE: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"],
  ICSE: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"],
  default: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"],
};

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
  options,
  selected,
  onSelect,
  placeholder,
  disabled,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={s.pickerWrapper}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable
        style={[s.pickerSelector, disabled && s.pickerDisabled]}
        onPress={() => !disabled && setOpen(!open)}
      >
        <Text style={[s.pickerText, !selected && s.pickerPlaceholder]}>
          {selected || placeholder}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={disabled ? Colors.gray300 : Colors.gray400}
        />
      </Pressable>
      {open && (
        <View style={s.dropdown}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 180 }}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={[s.dropdownOption, opt === selected && s.dropdownOptionSelected]}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Text style={[s.dropdownOptionText, opt === selected && s.dropdownOptionTextSel]}>
                  {opt}
                </Text>
                {opt === selected && <Feather name="check" size={13} color={Colors.indigo} />}
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
  const { completeProfile } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const boards = BOARDS_BY_STATE[selectedState] ?? BOARDS_BY_STATE.default;
  const classes = CLASSES_BY_BOARD[selectedBoard] ?? CLASSES_BY_BOARD.default;

  const canProceedOwnBooks = name.trim().length > 0 && selectedState.length > 0;
  const canGetStarted =
    name.trim().length > 0 &&
    selectedState.length > 0 &&
    selectedBoard.length > 0 &&
    selectedClass.length > 0 &&
    privacyAccepted;

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your full name");
      return;
    }
    if (!selectedState || !selectedBoard || !selectedClass) {
      Alert.alert("Required", "Please select your state, board and class");
      return;
    }
    if (!privacyAccepted) {
      Alert.alert("Required", "Please accept the Terms of Service and Privacy Policy");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    await completeProfile({ name, state: selectedState, board: selectedBoard, className: selectedClass });
    setLoading(false);
  };

  const handleProceedOwnBooks = async () => {
    if (!canProceedOwnBooks) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    await completeProfile({
      name,
      state: selectedState,
      board: selectedBoard || "CBSE",
      className: selectedClass || "Class 10",
    });
    setLoading(false);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;

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
          {/* ── SETUP BADGE ── */}
          <View style={s.setupBadge}>
            <View style={s.setupBadgeDot} />
            <Text style={s.setupBadgeText}>SETUP YOUR PROFILE</Text>
          </View>

          {/* ── TITLE ── */}
          <Text style={s.titleLine}>
            <Text style={s.titleEdw}>Welcome to Edw</Text>
            <Text style={s.titleAI}>AI</Text>
          </Text>

          {/* ── SUBTITLE ── */}
          <Text style={s.subtitle}>Tell us about yourself to personalise your experience</Text>

          {/* ══════ MAIN CARD ══════ */}
          <View style={s.card}>

            {/* ─── SECTION 1 ─── */}
            <SectionBadge number={1} />

            {/* Name */}
            <Text style={s.fieldLabel}>Your Name</Text>
            <TextInput
              style={s.input}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.placeholder}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            {/* Divider */}
            <View style={s.hr} />

            {/* Mobile Number (optional) */}
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

            {/* ─── SECTION 2 ─── */}
            <View style={{ marginTop: 24 }}>
              <SectionBadge number={2} />
            </View>

            <Text style={s.findBoardTitle}>Find Your Board</Text>

            <PickerField
              label="State"
              options={STATES}
              selected={selectedState}
              onSelect={(v) => { setSelectedState(v); setSelectedBoard(""); setSelectedClass(""); }}
              placeholder="Select State"
            />
            <PickerField
              label="Board / University"
              options={boards}
              selected={selectedBoard}
              onSelect={(v) => { setSelectedBoard(v); setSelectedClass(""); }}
              placeholder="Select Board"
              disabled={!selectedState}
            />
            <PickerField
              label="Class / Year"
              options={classes}
              selected={selectedClass}
              onSelect={setSelectedClass}
              placeholder="Select Class"
              disabled={!selectedBoard}
            />

            {/* ─── TERMS CHECKBOX ─── */}
            <Pressable style={s.termsBox} onPress={() => setPrivacyAccepted(!privacyAccepted)}>
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

            {/* ─── GET STARTED BUTTON ─── */}
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
                <Text style={s.getStartedBtnText}>
                  {loading ? "Setting up..." : "Get Started"}
                </Text>
                {!loading && <Feather name="check-circle" size={17} color={Colors.white} />}
              </LinearGradient>
            </Pressable>

          </View>
          {/* ══════ END MAIN CARD ══════ */}

          {/* ── USE YOUR OWN RESOURCES CARD ── */}
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
                  <Text style={s.ownCardHint}>Fill in your name and select a board above first.</Text>
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

  scroll: {
    paddingHorizontal: 16,
  },

  setupBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 18,
  },
  setupBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.indigo,
  },
  setupBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.indigo,
    letterSpacing: 1.2,
  },

  titleLine: {
    textAlign: "center",
    marginBottom: 8,
  },
  titleEdw: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.indigo,
  },
  titleAI: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
  },

  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 24,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 16,
  },

  sectionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  sectionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.indigo,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCircleNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  sectionDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.gray200,
  },

  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.gray700,
    marginBottom: 7,
  },

  input: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 0,
    height: 48,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
    marginBottom: 16,
  },

  hr: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginBottom: 16,
  },

  mobileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  optionalPill: {
    backgroundColor: Colors.gray100,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  optionalPillText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
  },
  mobileDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.gray400,
    lineHeight: 18,
    marginBottom: 10,
  },

  phoneRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    height: 48,
    overflow: "hidden",
    marginBottom: 8,
  },
  phonePrefix: {
    width: 52,
    backgroundColor: Colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: Colors.gray200,
  },
  phonePrefixText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.gray600,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
    backgroundColor: Colors.white,
  },

  skipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  skipHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.gray400,
    flex: 1,
  },
  skipLink: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.indigo,
  },

  findBoardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    marginBottom: 14,
  },

  pickerWrapper: {
    marginBottom: 14,
  },
  pickerSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    height: 48,
  },
  pickerDisabled: {
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray200,
  },
  pickerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
  },
  pickerPlaceholder: {
    color: Colors.placeholder,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: "hidden",
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  dropdownOptionSelected: {
    backgroundColor: "#EEF2FF",
  },
  dropdownOptionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.gray800,
  },
  dropdownOptionTextSel: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.indigo,
  },

  termsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.blueTint,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.blueTintBorder,
    padding: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    backgroundColor: Colors.white,
  },
  checkboxChecked: {
    backgroundColor: Colors.indigo,
    borderColor: Colors.indigo,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.gray600,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.indigo,
    fontFamily: "Inter_500Medium",
  },

  getStartedBtn: {
    borderRadius: 10,
    overflow: "hidden",
  },
  getStartedBtnDisabled: {
    opacity: 0.7,
  },
  getStartedBtnGradient: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  getStartedBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },

  ownCard: {
    backgroundColor: Colors.greenSuccessLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.greenSuccessBorder,
    padding: 16,
    marginBottom: 20,
  },
  ownCardTopRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  ownIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(16,185,129,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  ownCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    marginBottom: 4,
  },
  ownCardDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.gray600,
    lineHeight: 17,
  },
  ownCardHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.gray400,
    marginTop: 4,
    fontStyle: "italic",
  },
  ownBtn: {
    backgroundColor: Colors.greenSuccess,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: "center",
  },
  ownBtnDisabled: {
    backgroundColor: Colors.greenSuccessDisabled,
  },
  ownBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.gray700,
  },
});
