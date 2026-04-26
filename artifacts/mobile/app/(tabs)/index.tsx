import { Feather, Ionicons } from "@expo/vector-icons";
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

import { NavHeader } from "@/components/NavHeader";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const CLASSES = [
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
  "Class 11", "Class 12", "BSC 1st Year", "BSC 2nd Year", "BSC 3rd Year",
];

const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  "Class 10": ["Mathematics", "Science", "Social Studies", "English", "Telugu", "Hindi"],
  "Class 9": ["Mathematics", "Science", "Social Studies", "English"],
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

const DEMO_ANSWER = `Based on your textbook, here is the answer:

Photosynthesis is the process by which green plants use sunlight, water and carbon dioxide to produce food (glucose) and oxygen.

**Chemical Equation:**
6CO₂ + 6H₂O + Light energy → C₆H₁₂O₆ + 6O₂

**Key Points:**
• Takes place in the chloroplasts
• Chlorophyll absorbs light energy
• Occurs in two stages: Light reactions & Calvin cycle

*Source: Chapter 6, Page 89 — Life Processes*`;

const DEMO_PAGES = ["Page 89", "Page 90", "Page 91"];

function DarkPicker({
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
    <View style={dp.wrap}>
      <Text style={dp.label}>{label}</Text>
      <Pressable
        style={[dp.sel, disabled && dp.disabled]}
        onPress={() => !disabled && setOpen(!open)}
      >
        <Text style={[dp.selText, !selected && dp.placeholder]} numberOfLines={1}>
          {selected || placeholder}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          color={disabled ? Colors.darkTextDim : Colors.darkTextMuted}
        />
      </Pressable>
      {open && (
        <View style={dp.dropdown}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 160 }}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={[dp.option, opt === selected && dp.optSel]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[dp.optText, opt === selected && dp.optTextSel]}>{opt}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const dp = StyleSheet.create({
  wrap: { flex: 1 },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.darkTextMuted,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.darkInputBorder,
    borderRadius: 10,
    backgroundColor: Colors.darkInputBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  disabled: { opacity: 0.45 },
  selText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.darkText,
    flex: 1,
  },
  placeholder: { color: Colors.darkTextDim },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: "#252545",
    borderWidth: 1,
    borderColor: Colors.darkInputBorder,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    marginTop: 2,
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkDivider,
  },
  optSel: { backgroundColor: "rgba(102,126,234,0.2)" },
  optText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.darkTextSub },
  optTextSel: { fontFamily: "Inter_600SemiBold", color: Colors.primary },
});

export default function TextbooksScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [selectedClass, setSelectedClass] = useState(user?.className || "");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTextbook, setSelectedTextbook] = useState("");
  const [question, setQuestion] = useState("");
  const [answerMode, setAnswerMode] = useState<"book" | "concept">("book");
  const [answer, setAnswer] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const subjects = SUBJECTS_BY_CLASS[selectedClass] || SUBJECTS_BY_CLASS.default;
  const textbooks = TEXTBOOKS[selectedSubject] || TEXTBOOKS.default;

  const handleClassChange = (v: string) => {
    setSelectedClass(v);
    setSelectedSubject("");
    setSelectedTextbook("");
  };
  const handleSubjectChange = (v: string) => {
    setSelectedSubject(v);
    setSelectedTextbook("");
  };

  const handleAsk = async () => {
    if (!question.trim()) {
      Alert.alert("Question required", "Please type your question first");
      return;
    }
    if (!selectedClass || !selectedSubject || !selectedTextbook) {
      Alert.alert("Selection required", "Please select Class, Subject and Textbook");
      return;
    }
    setLoading(true);
    setAnswer("");
    setPages([]);
    await new Promise((r) => setTimeout(r, 400));
    const chunks = DEMO_ANSWER.split("");
    let built = "";
    for (const ch of chunks) {
      built += ch;
      setAnswer(built);
      await new Promise((r) => setTimeout(r, 5));
    }
    setPages(DEMO_PAGES);
    setLoading(false);
  };

  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.root}>
      <NavHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.bookCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name={"book-outline" as IoniconsName} size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Select Your Textbook</Text>
              <Text style={styles.cardSub}>Choose class, subject, and book to get started</Text>
            </View>
          </View>

          <View style={styles.pickerRow}>
            <DarkPicker
              label="Class"
              options={CLASSES}
              selected={selectedClass}
              onSelect={handleClassChange}
              placeholder="Select class"
            />
          </View>

          <View style={styles.pickerRow2}>
            <DarkPicker
              label="Subject"
              options={subjects}
              selected={selectedSubject}
              onSelect={handleSubjectChange}
              disabled={!selectedClass}
              placeholder={selectedClass ? "Select subject" : "Select class first"}
            />
            <DarkPicker
              label="Textbook"
              options={textbooks}
              selected={selectedTextbook}
              onSelect={setSelectedTextbook}
              disabled={!selectedSubject}
              placeholder={selectedSubject ? "Select book" : "Select subject first"}
            />
          </View>

          {!selectedClass && (
            <View style={styles.infoBox}>
              <Ionicons name={"information-circle-outline" as IoniconsName} size={14} color={Colors.primary} />
              <Text style={styles.infoText}>Select a class to see available subjects</Text>
            </View>
          )}
        </View>

        {selectedTextbook !== "" && (
          <View style={styles.questionCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: "rgba(34,197,94,0.15)" }]}>
                <Ionicons name={"chatbubble-ellipses-outline" as IoniconsName} size={20} color="#22c55e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Ask Your Question</Text>
                <Text style={[styles.cardSub, { color: Colors.primary }]} numberOfLines={1}>
                  {selectedTextbook}
                </Text>
              </View>
            </View>

            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeBtn, answerMode === "book" && styles.modeBtnActive]}
                onPress={() => setAnswerMode("book")}
              >
                <Text style={[styles.modeBtnText, answerMode === "book" && styles.modeBtnTextActive]}>
                  📖 Answer from Book
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeBtn, answerMode === "concept" && styles.modeBtnActive]}
                onPress={() => setAnswerMode("concept")}
              >
                <Text style={[styles.modeBtnText, answerMode === "concept" && styles.modeBtnTextActive]}>
                  💡 Learn Concept
                </Text>
              </Pressable>
            </View>

            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Type your question here..."
                placeholderTextColor={Colors.darkTextDim}
                multiline
                numberOfLines={4}
                value={question}
                onChangeText={setQuestion}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.askBtn, loading && { opacity: 0.7 }]}
                onPress={handleAsk}
                disabled={loading}
              >
                <Ionicons
                  name={"search" as IoniconsName}
                  size={16}
                  color={Colors.white}
                />
                <Text style={styles.askBtnText}>
                  {loading ? "Searching..." : answerMode === "book" ? "Answer from Book" : "Learn Concept"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {(answer || loading) && (
          <View style={styles.answerCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: "rgba(102,126,234,0.2)" }]}>
                <Text style={{ fontSize: 18 }}>✨</Text>
              </View>
              <Text style={[styles.cardTitle, { flex: 1 }]}>Answer</Text>
              {loading && (
                <View style={styles.streamingDot}>
                  <Text style={styles.streamingLabel}>Streaming…</Text>
                </View>
              )}
            </View>
            <Text style={styles.answerText}>{answer}</Text>
          </View>
        )}

        {pages.length > 0 && (
          <View style={styles.sourcesCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
                <Feather name="file-text" size={18} color="#818cf8" />
              </View>
              <Text style={styles.cardTitle}>Sources</Text>
            </View>
            <View style={styles.pageChips}>
              {pages.map((p) => (
                <View key={p} style={styles.pageChip}>
                  <Text style={styles.pageChipText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.darkBg1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  bookCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    padding: 18,
    gap: 14,
  },
  questionCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    padding: 18,
    gap: 14,
  },
  answerCard: {
    backgroundColor: Colors.answerBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.answerBorder,
    padding: 18,
    gap: 14,
  },
  sourcesCard: {
    backgroundColor: Colors.darkCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    padding: 18,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(102,126,234,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.darkText,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextMuted,
    marginTop: 1,
  },
  pickerRow: {
    zIndex: 30,
  },
  pickerRow2: {
    flexDirection: "row",
    gap: 12,
    zIndex: 20,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(102,126,234,0.1)",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.darkTextSub,
    flex: 1,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: Colors.darkSurface,
    borderWidth: 1,
    borderColor: Colors.darkDivider,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextMuted,
    textAlign: "center",
  },
  modeBtnTextActive: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: Colors.darkInputBorder,
    borderRadius: 12,
    backgroundColor: Colors.darkInputBg,
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.darkText,
    minHeight: 100,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  askBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  askBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  streamingDot: {
    backgroundColor: "rgba(102,126,234,0.3)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  streamingLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  answerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.darkText,
    lineHeight: 22,
  },
  pageChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pageChip: {
    backgroundColor: "rgba(102,126,234,0.22)",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.4)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pageChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextSub,
  },
});
