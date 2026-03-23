import { Feather, MaterialIcons } from "@expo/vector-icons";
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
  "Andhra Pradesh": ["AndhraPradesh School Education", "Andhra University", "JNTU Anantapur"],
  Telangana: ["Telangana School Education", "Osmania University", "JNTU Hyderabad"],
  Maharashtra: ["Maharashtra SSC Board", "Maharashtra HSC Board", "Mumbai University"],
  Karnataka: ["Karnataka SSLC Board", "Karnataka PUC Board", "Bangalore University"],
  "Tamil Nadu": ["Tamil Nadu SSLC Board", "Tamil Nadu HSC Board", "Anna University"],
  Delhi: ["CBSE", "Delhi Board of Secondary Education"],
  default: ["CBSE", "ICSE", "State Board"],
};

const CLASSES_BY_BOARD: Record<string, string[]> = {
  "AndhraPradesh School Education": ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"],
  "Telangana School Education": ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"],
  "Andhra University": ["BSC 1st Year", "BSC 2nd Year", "BSC 3rd Year"],
  "Osmania University": ["BSC 1st Year", "BSC 2nd Year", "BSC 3rd Year", "BA 1st Year"],
  CBSE: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"],
  ICSE: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"],
  default: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"],
};

type Step = 1 | 2;

function PickerModal({
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
    <View style={pickerStyles.wrapper}>
      <Text style={pickerStyles.label}>{label}</Text>
      <Pressable
        style={[pickerStyles.selector, disabled && pickerStyles.disabled]}
        onPress={() => !disabled && setOpen(!open)}
      >
        <Text
          style={[
            pickerStyles.selectorText,
            !selected && pickerStyles.placeholder,
          ]}
        >
          {selected || placeholder}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={disabled ? Colors.gray300 : Colors.gray500}
        />
      </Pressable>
      {open && (
        <View style={pickerStyles.dropdown}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 200 }}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={[
                  pickerStyles.option,
                  opt === selected && pickerStyles.optionSelected,
                ]}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    pickerStyles.optionText,
                    opt === selected && pickerStyles.optionTextSelected,
                  ]}
                >
                  {opt}
                </Text>
                {opt === selected && (
                  <Feather name="check" size={14} color={Colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.gray700,
    marginBottom: 6,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  disabled: {
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray200,
  },
  selectorText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
  },
  placeholder: { color: Colors.placeholder },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  optionSelected: { backgroundColor: Colors.indigoBg },
  optionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.gray800,
  },
  optionTextSelected: { fontFamily: "Inter_600SemiBold", color: Colors.primary },
});

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { completeProfile, user } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(user?.name || "");
  const [selectedState, setSelectedState] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const boards =
    BOARDS_BY_STATE[selectedState] || BOARDS_BY_STATE.default;
  const classes =
    CLASSES_BY_BOARD[selectedBoard] || CLASSES_BY_BOARD.default;

  const handleStep1 = () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your full name");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedState || !selectedBoard || !selectedClass) {
      Alert.alert("Required", "Please complete all fields");
      return;
    }
    if (!privacyAccepted) {
      Alert.alert("Privacy Policy", "Please accept the Privacy Policy to continue");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    await completeProfile({
      name,
      state: selectedState,
      board: selectedBoard,
      className: selectedClass,
    });
    setLoading(false);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientMid, Colors.backgroundGradientEnd]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, { top: topInset }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topInset + 24, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.setupBadge}>
            <Text style={styles.setupBadgeText}>SETUP YOUR PROFILE</Text>
          </View>

          <Text style={styles.title}>
            Welcome to{" "}
            <Text style={{ color: Colors.primary }}>Edw</Text>
            <Text style={styles.title}>AI</Text>
          </Text>
          <Text style={styles.subtitle}>
            Tell us about yourself to personalise your experience
          </Text>

          <View style={styles.stepsRow}>
            <View style={[styles.step, step >= 1 && styles.stepActive]}>
              <Text style={[styles.stepNum, step >= 1 && styles.stepNumActive]}>1</Text>
            </View>
            <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
            <View style={[styles.step, step >= 2 && styles.stepActive]}>
              <Text style={[styles.stepNum, step >= 2 && styles.stepNumActive]}>2</Text>
            </View>
          </View>

          <View style={styles.card}>
            {step === 1 ? (
              <>
                <Text style={styles.sectionTitle}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={Colors.placeholder}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.nextBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleStep1}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextBtnGradient}
                  >
                    <Text style={styles.nextBtnText}>Continue</Text>
                    <Feather name="arrow-right" size={18} color={Colors.white} />
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Find Your Board</Text>

                <PickerModal
                  label="State"
                  options={STATES}
                  selected={selectedState}
                  onSelect={(v) => {
                    setSelectedState(v);
                    setSelectedBoard("");
                    setSelectedClass("");
                  }}
                  placeholder="Select State"
                />
                <PickerModal
                  label="Board / University"
                  options={boards}
                  selected={selectedBoard}
                  onSelect={(v) => {
                    setSelectedBoard(v);
                    setSelectedClass("");
                  }}
                  placeholder="Select Board"
                  disabled={!selectedState}
                />
                <PickerModal
                  label="Class / Year"
                  options={classes}
                  selected={selectedClass}
                  onSelect={setSelectedClass}
                  placeholder="Select Class"
                  disabled={!selectedBoard}
                />

                <Pressable
                  style={styles.checkRow}
                  onPress={() => setPrivacyAccepted(!privacyAccepted)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      privacyAccepted && styles.checkboxChecked,
                    ]}
                  >
                    {privacyAccepted && (
                      <Feather name="check" size={12} color={Colors.white} />
                    )}
                  </View>
                  <Text style={styles.checkText}>
                    I agree to the{" "}
                    <Text style={styles.checkLink}>Privacy Policy</Text>
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.nextBtn,
                    pressed && { opacity: 0.85 },
                    loading && { opacity: 0.7 },
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextBtnGradient}
                  >
                    <Text style={styles.nextBtnText}>
                      {loading ? "Setting up..." : "Get Started"}
                    </Text>
                    {!loading && (
                      <Feather name="check-circle" size={18} color={Colors.white} />
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={() => setStep(1)} style={{ marginTop: 12, alignItems: "center" }}>
                  <Text style={styles.backText}>Back to Step 1</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.trustRow}>
            <MaterialIcons name="verified" size={16} color={Colors.success} />
            <Text style={styles.trustText}>
              Trusted by 10,000+ students across India
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb: {
    position: "absolute",
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.secondary,
    opacity: 0.08,
  },
  scroll: { paddingHorizontal: 24 },
  setupBadge: {
    alignSelf: "center",
    backgroundColor: Colors.indigoBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  setupBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
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
    marginBottom: 24,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 0,
  },
  step: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  stepActive: { backgroundColor: Colors.primary },
  stepNum: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.gray500,
  },
  stepNumActive: { color: Colors.white },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: Colors.gray200,
  },
  stepLineActive: { backgroundColor: Colors.primary },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
    marginBottom: 20,
  },
  nextBtn: { borderRadius: 12, overflow: "hidden" },
  nextBtnGradient: {
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  nextBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray600,
  },
  checkLink: {
    color: Colors.primary,
    fontFamily: "Inter_500Medium",
  },
  backText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  trustText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
  },
});
