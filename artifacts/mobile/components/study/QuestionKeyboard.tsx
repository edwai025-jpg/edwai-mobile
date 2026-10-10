import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { INDIAN_KEYBOARD_LAYOUTS, type KeyboardLanguage } from "@/constants/indianKeyboardLayouts";

const LABELS: Record<string, string> = { "{bksp}": "⌫", "{tab}": "Tab", "{enter}": "Enter", "{shift}": "Shift", "{lock}": "Lock", "{space}": "Space" };
export default function QuestionKeyboard({ onInput, onBackspace, onClose, isDark, disabled }: {
  onInput: (text: string) => void; onBackspace: () => void; onClose: () => void; isDark: boolean; disabled?: boolean;
}) {
  const [language, setLanguage] = useState<KeyboardLanguage>("hi");
  const [shift, setShift] = useState(false);
  const text = isDark ? Colors.darkText : Colors.heading;
  const bg = isDark ? Colors.darkInputBg : Colors.gray100;
  const rows = INDIAN_KEYBOARD_LAYOUTS[language][shift ? "shift" : "default"];
  const key = (value: string) => {
    if (value === "{shift}" || value === "{lock}") setShift(current => !current);
    else if (value === "{bksp}") onBackspace();
    else onInput(value === "{enter}" ? "\n" : value === "{tab}" ? "\t" : value === "{space}" ? " " : value);
  };
  return (
    <View testID="question-keyboard" style={[s.panel, { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderColor: isDark ? Colors.darkCardBorder : Colors.inputBorder }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: text }]}>Indian Language Keyboard</Text>
        <Pressable testID="close-question-keyboard" accessibilityRole="button" accessibilityLabel="Close keyboard" onPress={onClose} style={s.close}><Feather name="x" size={20} color={text} /></Pressable>
      </View>
      <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator contentContainerStyle={s.languages}>
        {(Object.keys(INDIAN_KEYBOARD_LAYOUTS) as KeyboardLanguage[]).map(code => (
          <Pressable key={code} testID={`keyboard-language-${code}`} accessibilityRole="button" accessibilityState={{ selected: language === code }} style={[s.language, { backgroundColor: code === language ? Colors.primary : bg }]} onPress={() => setLanguage(code)}>
            <Text style={{ color: code === language ? Colors.white : text }}>{INDIAN_KEYBOARD_LAYOUTS[code].name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={[s.hint, { color: isDark ? Colors.gray400 : Colors.muted }]}>Swipe sideways to reach all keys · {shift ? "Shift" : "Default"} layout</Text>
      <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator>
        <View style={s.rows}>
          {rows.map((row, index) => <View key={index} style={s.row}>
            {row.split(" ").map((value, column) => (
              <Pressable key={`${value}-${column}`} testID={`keyboard-key-${index}-${column}`} accessibilityRole="button" accessibilityLabel={LABELS[value] ?? value} disabled={disabled}
                style={[s.key, value === "{space}" && s.space, value.startsWith("{") && s.control, { backgroundColor: (value === "{shift}" || value === "{lock}") && shift ? Colors.primary : bg }]}
                onPress={() => key(value)}>
                <Text style={[s.keyText, { color: (value === "{shift}" || value === "{lock}") && shift ? Colors.white : text }]}>{LABELS[value] ?? value}</Text>
              </Pressable>
            ))}
          </View>)}
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", flexShrink: 1 }, close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  languages: { gap: 6, paddingBottom: 8 }, language: { minHeight: 48, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 8 }, rows: { gap: 5, paddingBottom: 8 }, row: { flexDirection: "row", gap: 5 },
  key: { minWidth: 48, height: 48, paddingHorizontal: 5, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  control: { minWidth: 60 }, space: { width: 180 }, keyText: { fontSize: 17 },
});
