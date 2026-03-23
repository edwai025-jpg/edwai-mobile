import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
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
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type Source = "textbooks" | "own";

const CLASSES = [
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12",
  "BSC 1st Year", "BSC 2nd Year", "BSC 3rd Year",
];

const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  "Class 10": ["Mathematics", "Science", "Social Studies", "English", "Telugu", "Hindi"],
  "Class 9": ["Mathematics", "Science", "Social Studies", "English", "Telugu"],
  "Class 11": ["Physics", "Chemistry", "Mathematics", "Biology", "Economics"],
  "Class 12": ["Physics", "Chemistry", "Mathematics", "Biology", "Economics"],
  "BSC 1st Year": ["Physics", "Chemistry", "Mathematics", "Computer Science"],
  "BSC 2nd Year": ["Physics", "Chemistry", "Mathematics", "Computer Science"],
  default: ["Mathematics", "Science", "English", "Social Studies"],
};

const TEXTBOOKS: Record<string, string[]> = {
  Mathematics: ["NCERT Mathematics", "RS Aggarwal", "RD Sharma"],
  Science: ["NCERT Science", "Lakhmir Singh Science"],
  Physics: ["NCERT Physics Part 1", "NCERT Physics Part 2", "HC Verma"],
  Chemistry: ["NCERT Chemistry Part 1", "NCERT Chemistry Part 2"],
  default: ["Standard Textbook", "Reference Book"],
};

type AnswerMode = "book" | "concept";

function InlinePicker({
  label,
  options,
  selected,
  onSelect,
  disabled,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={pickerSt.wrap}>
      <Text style={pickerSt.label}>{label}</Text>
      <Pressable
        style={[pickerSt.sel, disabled && pickerSt.disabled]}
        onPress={() => !disabled && setOpen(!open)}
      >
        <Text
          style={[pickerSt.selText, !selected && pickerSt.placeholder]}
          numberOfLines={1}
        >
          {selected || placeholder}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          color={disabled ? Colors.gray300 : Colors.gray500}
        />
      </Pressable>
      {open && (
        <View style={pickerSt.dropdown}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 160 }}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={[pickerSt.option, opt === selected && pickerSt.optSel]}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Text
                  style={[pickerSt.optText, opt === selected && pickerSt.optTextSel]}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const pickerSt = StyleSheet.create({
  wrap: { flex: 1 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.gray600,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  disabled: { backgroundColor: Colors.gray100, borderColor: Colors.gray200 },
  selText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
    flex: 1,
  },
  placeholder: { color: Colors.placeholder },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 2,
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  optSel: { backgroundColor: Colors.indigoBg },
  optText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray800,
  },
  optTextSel: { fontFamily: "Inter_600SemiBold", color: Colors.primary },
});

const DEMO_ANSWER = `Based on your textbook, here is the answer:

Photosynthesis is the process by which green plants and other organisms use sunlight, water and carbon dioxide to produce food (glucose) and oxygen.

**Chemical Equation:**
6CO₂ + 6H₂O + Light energy → C₆H₁₂O₆ + 6O₂

**Key Points:**
• Takes place in the chloroplasts
• Chlorophyll absorbs light energy
• Occurs in two stages: Light reactions & Calvin cycle

*Source: Chapter 6, Page 89 — Life Processes*`;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [source, setSource] = useState<Source>("textbooks");
  const [selectedClass, setSelectedClass] = useState(user?.className || "");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTextbook, setSelectedTextbook] = useState("");
  const [question, setQuestion] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("book");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const subjects =
    SUBJECTS_BY_CLASS[selectedClass] || SUBJECTS_BY_CLASS.default;
  const textbooks =
    TEXTBOOKS[selectedSubject] || TEXTBOOKS.default;

  const handleAsk = async () => {
    if (!question.trim()) {
      Alert.alert("Question required", "Please type your question first");
      return;
    }
    if (source === "textbooks" && (!selectedClass || !selectedSubject || !selectedTextbook)) {
      Alert.alert("Selection required", "Please select Class, Subject and Textbook");
      return;
    }
    setLoading(true);
    setAnswer("");
    await new Promise((r) => setTimeout(r, 600));
    const demoChunks = DEMO_ANSWER.split("");
    let built = "";
    for (const ch of demoChunks) {
      built += ch;
      setAnswer(built);
      await new Promise((r) => setTimeout(r, 6));
    }
    setLoading(false);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientMid]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
      />

      <View style={[styles.topBar, { paddingTop: topInset + 10 }]}>
        <View style={styles.topLeft}>
          <EdwAILogo size="md" />
          {user?.className && (
            <View style={styles.classBadge}>
              <MaterialIcons name="school" size={12} color={Colors.primary} />
              <Text style={styles.classBadgeText}>{user.className}</Text>
            </View>
          )}
        </View>
        <View style={styles.usageChip}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.usageChipGradient}
          >
            <Ionicons name="flash" size={12} color={Colors.white} />
            <Text style={styles.usageText}>
              {user?.questionsUsed ?? 5}/{user?.questionsLimit ?? 1500}
            </Text>
          </LinearGradient>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sourceCard}>
          <Text style={styles.sourceLabel}>Choose your source:</Text>
          <View style={styles.sourceToggle}>
            <Pressable
              style={[styles.sourceBtn, source === "textbooks" && styles.sourceBtnActive]}
              onPress={() => setSource("textbooks")}
            >
              <Ionicons
                name="book"
                size={14}
                color={source === "textbooks" ? Colors.white : Colors.gray600}
              />
              <Text
                style={[
                  styles.sourceBtnText,
                  source === "textbooks" && styles.sourceBtnTextActive,
                ]}
              >
                Use Textbooks
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sourceBtn, source === "own" && styles.sourceBtnActive]}
              onPress={() => setSource("own")}
            >
              <Feather
                name="upload"
                size={14}
                color={source === "own" ? Colors.white : Colors.gray600}
              />
              <Text
                style={[
                  styles.sourceBtnText,
                  source === "own" && styles.sourceBtnTextActive,
                ]}
              >
                Use Own Book
              </Text>
            </Pressable>
          </View>
        </View>

        {source === "textbooks" ? (
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerIcon}>
                <Ionicons name="book-outline" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.pickerTitle}>Select Your Textbook</Text>
                <Text style={styles.pickerSub}>
                  Choose class, subject, and textbook to get started
                </Text>
              </View>
            </View>

            <View style={styles.pickerRow}>
              <View style={{ flex: 1 }}>
                <InlinePicker
                  label="Class"
                  options={CLASSES}
                  selected={selectedClass}
                  onSelect={(v) => {
                    setSelectedClass(v);
                    setSelectedSubject("");
                    setSelectedTextbook("");
                  }}
                  placeholder="Select Class"
                />
              </View>
              <View style={{ flex: 1 }}>
                <InlinePicker
                  label="Subject"
                  options={subjects}
                  selected={selectedSubject}
                  onSelect={(v) => {
                    setSelectedSubject(v);
                    setSelectedTextbook("");
                  }}
                  placeholder="Select Subject"
                  disabled={!selectedClass}
                />
              </View>
            </View>
            <View style={{ zIndex: 1 }}>
              <InlinePicker
                label="Textbook"
                options={textbooks}
                selected={selectedTextbook}
                onSelect={setSelectedTextbook}
                placeholder="Select Textbook"
                disabled={!selectedSubject}
              />
            </View>

            {!selectedClass && (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  Select a class to see available subjects
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.pickerCard}>
            <View style={styles.ownBookBox}>
              <Feather name="upload-cloud" size={32} color={Colors.gray400} />
              <Text style={styles.ownBookTitle}>Use Your Own Resources</Text>
              <Text style={styles.ownBookSub}>
                PDF uploads and YouTube video analysis coming soon in My Docs
              </Text>
            </View>
          </View>
        )}

        <View style={styles.qaCard}>
          <Text style={styles.qaLabel}>Your Question</Text>
          <TextInput
            style={styles.qaInput}
            placeholder="Type your question here..."
            placeholderTextColor={Colors.placeholder}
            multiline
            numberOfLines={3}
            value={question}
            onChangeText={setQuestion}
          />

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeBtn, answerMode === "book" && styles.modeBtnActive]}
              onPress={() => setAnswerMode("book")}
            >
              <Ionicons
                name="search"
                size={14}
                color={answerMode === "book" ? Colors.white : Colors.gray600}
              />
              <Text
                style={[styles.modeBtnText, answerMode === "book" && styles.modeBtnTextActive]}
              >
                Answer from Book
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, answerMode === "concept" && styles.modeBtnActive]}
              onPress={() => setAnswerMode("concept")}
            >
              <Ionicons
                name="bulb-outline"
                size={14}
                color={answerMode === "concept" ? Colors.white : Colors.gray600}
              />
              <Text
                style={[styles.modeBtnText, answerMode === "concept" && styles.modeBtnTextActive]}
              >
                Learn Concept
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.askBtn,
              pressed && { opacity: 0.85 },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleAsk}
            disabled={loading}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.askBtnGradient}
            >
              {loading ? (
                <Text style={styles.askBtnText}>Searching...</Text>
              ) : (
                <>
                  <Feather name="send" size={16} color={Colors.white} />
                  <Text style={styles.askBtnText}>Get Answer</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {(answer || loading) && (
          <View style={styles.answerCard}>
            <View style={styles.answerHeader}>
              <View style={styles.answerIconWrap}>
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  style={styles.answerIcon}
                >
                  <Ionicons name="sparkles" size={14} color={Colors.white} />
                </LinearGradient>
              </View>
              <Text style={styles.answerTitle}>AI Answer</Text>
              {loading && (
                <View style={styles.streamingDot} />
              )}
            </View>
            {loading && !answer ? (
              <View style={styles.loadingLines}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={[styles.loadingLine, { width: i === 3 ? "60%" : "100%" }]} />
                ))}
              </View>
            ) : (
              <Text style={styles.answerText}>{answer}</Text>
            )}
          </View>
        )}

        {!answer && !loading && (
          <View style={styles.howToCard}>
            <Text style={styles.howToTitle}>How to use EdwAI</Text>
            {(
              [
                { icon: "book-outline" as IoniconsName, text: "Select your class, subject, and textbook from the dropdowns" },
                { icon: "help-circle-outline" as IoniconsName, text: "Type your question in the text area above" },
                { icon: "search-outline" as IoniconsName, text: "Choose Answer from Book to get exact text from your book" },
                { icon: "bulb-outline" as IoniconsName, text: "Choose Learn Concept to get AI-powered explanations" },
              ] as Array<{ icon: IoniconsName; text: string }>
            ).map((item, i) => (
              <View key={i} style={styles.howToRow}>
                <View style={styles.howToNum}>
                  <Text style={styles.howToNumText}>{i + 1}</Text>
                </View>
                <Ionicons name={item.icon} size={16} color={Colors.primary} />
                <Text style={styles.howToText}>{item.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoRow: { flexDirection: "row", alignItems: "baseline" },
  logoEdw: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.primary },
  logoAI: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.gray900 },
  classBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.indigoBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
  },
  classBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  usageChip: { borderRadius: 20, overflow: "hidden" },
  usageChipGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  usageText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 12 },
  sourceCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sourceLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.gray700,
    marginBottom: 10,
  },
  sourceToggle: {
    flexDirection: "row",
    gap: 8,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
  },
  sourceBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  sourceBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.gray600,
  },
  sourceBtnTextActive: { color: Colors.white },
  pickerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    zIndex: 10,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  pickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.indigoBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
  },
  pickerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
  },
  pickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    zIndex: 20,
  },
  hintBox: {
    marginTop: 10,
    backgroundColor: Colors.indigoBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
  },
  hintText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.primary,
  },
  ownBookBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  ownBookTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.gray700,
  },
  ownBookSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray500,
    textAlign: "center",
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  qaCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  qaLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.gray700,
    marginBottom: 8,
  },
  qaInput: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.gray900,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.gray600,
  },
  modeBtnTextActive: { color: Colors.white },
  askBtn: { borderRadius: 12, overflow: "hidden" },
  askBtnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  askBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  answerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.indigoBorder,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  answerIconWrap: {},
  answerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  answerTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.gray800,
    flex: 1,
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    opacity: 0.8,
  },
  loadingLines: { gap: 8 },
  loadingLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.gray100,
  },
  answerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.gray800,
    lineHeight: 22,
  },
  howToCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  howToTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.gray900,
    marginBottom: 4,
  },
  howToRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  howToNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.indigoBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  howToNumText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  howToText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.gray700,
    lineHeight: 20,
  },
});
