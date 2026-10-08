import { platformShadow } from "@/constants/shadow";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type LangKey =
  | "hindi"
  | "marathi"
  | "bengali"
  | "gujarati"
  | "punjabi"
  | "odia"
  | "telugu"
  | "tamil"
  | "kannada"
  | "malayalam";

type LangDef = { label: string; rows: string[][] };

const LANGS: Record<LangKey, LangDef> = {
  hindi: {
    label: "हिन्दी",
    rows: [
      ["अ", "आ", "इ", "ई", "उ", "ऊ", "ए", "ऐ", "ओ", "औ"],
      ["क", "ख", "ग", "घ", "च", "छ", "ज", "झ", "ट", "ठ"],
      ["ड", "ढ", "त", "थ", "द", "ध", "न", "प", "फ", "ब"],
      ["भ", "म", "य", "र", "ल", "व", "श", "ष", "स", "ह"],
      ["ा", "ि", "ी", "ु", "ू", "े", "ै", "ो", "ौ", "ं"],
      ["ः", "ँ", "्", "क्ष", "त्र", "ज्ञ", "ड़", "ढ़"],
    ],
  },
  marathi: {
    label: "मराठी",
    rows: [
      ["अ", "आ", "इ", "ई", "उ", "ऊ", "ए", "ऐ", "ओ", "औ"],
      ["क", "ख", "ग", "घ", "च", "छ", "ज", "झ", "ट", "ठ"],
      ["ड", "ढ", "त", "थ", "द", "ध", "न", "प", "फ", "ब"],
      ["भ", "म", "य", "र", "ल", "व", "श", "ष", "स", "ह"],
      ["ळ", "क्ष", "ज्ञ", "ा", "ि", "ी", "ु", "ू", "े", "ै"],
      ["ो", "ौ", "ं", "ः", "ँ", "्"],
    ],
  },
  bengali: {
    label: "বাংলা",
    rows: [
      ["অ", "আ", "ই", "ঈ", "উ", "ঊ", "এ", "ঐ", "ও", "ঔ"],
      ["ক", "খ", "গ", "ঘ", "ঙ", "চ", "ছ", "জ", "ঝ", "ঞ"],
      ["ট", "ঠ", "ড", "ঢ", "ণ", "ত", "থ", "দ", "ধ", "ন"],
      ["প", "ফ", "ব", "ভ", "ম", "য", "র", "ল", "শ", "ষ"],
      ["স", "হ", "ড়", "ঢ়", "য়", "ৎ", "া", "ি", "ী", "ু"],
      ["ূ", "ে", "ৈ", "ো", "ৌ", "ং", "ঃ", "্"],
    ],
  },
  gujarati: {
    label: "ગુજરાતી",
    rows: [
      ["અ", "આ", "ઇ", "ઈ", "ઉ", "ઊ", "એ", "ઐ", "ઓ", "ઔ"],
      ["ક", "ખ", "ગ", "ઘ", "ચ", "છ", "જ", "ઝ", "ટ", "ઠ"],
      ["ડ", "ઢ", "ણ", "ત", "થ", "દ", "ધ", "ન", "પ", "ફ"],
      ["બ", "ભ", "મ", "ય", "ર", "લ", "વ", "શ", "ષ", "સ"],
      ["હ", "ળ", "ા", "િ", "ી", "ુ", "ૂ", "ે", "ૈ", "ો"],
      ["ૌ", "ં", "ઃ", "્"],
    ],
  },
  punjabi: {
    label: "ਪੰਜਾਬੀ",
    rows: [
      ["ਅ", "ਆ", "ਇ", "ਈ", "ਉ", "ਊ", "ਏ", "ਐ", "ਓ", "ਔ"],
      ["ਕ", "ਖ", "ਗ", "ਘ", "ਚ", "ਛ", "ਜ", "ਝ", "ਟ", "ਠ"],
      ["ਡ", "ਢ", "ਣ", "ਤ", "ਥ", "ਦ", "ਧ", "ਨ", "ਪ", "ਫ"],
      ["ਬ", "ਭ", "ਮ", "ਯ", "ਰ", "ਲ", "ਵ", "ਸ਼", "ਸ", "ਹ"],
      ["ਾ", "ਿ", "ੀ", "ੁ", "ੂ", "ੇ", "ੈ", "ੋ", "ੌ", "ੰ"],
      ["ੱ", "ੲ", "ੳ", "ੴ"],
    ],
  },
  odia: {
    label: "ଓଡ଼ିଆ",
    rows: [
      ["ଅ", "ଆ", "ଇ", "ଈ", "ଉ", "ଊ", "ଏ", "ଐ", "ଓ", "ଔ"],
      ["କ", "ଖ", "ଗ", "ଘ", "ଚ", "ଛ", "ଜ", "ଝ", "ଟ", "ଠ"],
      ["ଡ", "ଢ", "ଣ", "ତ", "ଥ", "ଦ", "ଧ", "ନ", "ପ", "ଫ"],
      ["ବ", "ଭ", "ମ", "ଯ", "ର", "ଲ", "ଵ", "ଶ", "ଷ", "ସ"],
      ["ହ", "ଳ", "ା", "ି", "ୀ", "ୁ", "ୂ", "େ", "ୈ", "ୋ"],
      ["ୌ", "ଂ", "ଃ", "୍"],
    ],
  },
  telugu: {
    label: "తెలుగు",
    rows: [
      ["అ", "ఆ", "ఇ", "ఈ", "ఉ", "ఊ", "ఎ", "ఏ", "ఐ", "ఒ"],
      ["క", "ఖ", "గ", "ఘ", "చ", "ఛ", "జ", "ఝ", "ట", "ఠ"],
      ["డ", "ఢ", "ణ", "త", "థ", "ద", "ధ", "న", "ప", "ఫ"],
      ["బ", "భ", "మ", "య", "ర", "ల", "వ", "శ", "ష", "స"],
      ["హ", "ళ", "ఱ", "ఓ", "ఔ", "ా", "ి", "ీ", "ు", "ూ"],
      ["ె", "ే", "ై", "ొ", "ో", "ౌ", "ం", "ః", "్"],
    ],
  },
  tamil: {
    label: "தமிழ்",
    rows: [
      ["அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ"],
      ["ஓ", "ஔ", "ஃ", "க", "ங", "ச", "ஞ", "ட", "ண", "த"],
      ["ந", "ப", "ம", "ய", "ர", "ல", "வ", "ழ", "ள", "ற"],
      ["ன", "ஶ", "ஜ", "ஷ", "ஸ", "ஹ"],
      ["ா", "ி", "ீ", "ு", "ூ", "ெ", "ே", "ை", "ொ", "ோ"],
      ["ௌ", "்"],
    ],
  },
  kannada: {
    label: "ಕನ್ನಡ",
    rows: [
      ["ಅ", "ಆ", "ಇ", "ಈ", "ಉ", "ಊ", "ಎ", "ಏ", "ಐ", "ಒ"],
      ["ಕ", "ಖ", "ಗ", "ಘ", "ಚ", "ಛ", "ಜ", "ಝ", "ಟ", "ಠ"],
      ["ಡ", "ಢ", "ಣ", "ತ", "ಥ", "ದ", "ಧ", "ನ", "ಪ", "ಫ"],
      ["ಬ", "ಭ", "ಮ", "ಯ", "ರ", "ಲ", "ವ", "ಶ", "ಷ", "ಸ"],
      ["ಹ", "ಳ", "ಓ", "ಔ", "ಾ", "ಿ", "ೀ", "ು", "ೂ", "ೆ"],
      ["ೇ", "ೈ", "ೊ", "ೋ", "ೌ", "ಂ", "ಃ", "್"],
    ],
  },
  malayalam: {
    label: "മലയാളം",
    rows: [
      ["അ", "ആ", "ഇ", "ഈ", "ഉ", "ഊ", "എ", "ഏ", "ഐ", "ഒ"],
      ["ക", "ഖ", "ഗ", "ഘ", "ച", "ഛ", "ജ", "ഝ", "ട", "ഠ"],
      ["ഡ", "ഢ", "ണ", "ത", "ഥ", "ദ", "ധ", "ന", "പ", "ഫ"],
      ["ബ", "ഭ", "മ", "യ", "ര", "ല", "വ", "ശ", "ഷ", "സ"],
      ["ഹ", "ള", "ഴ", "ഓ", "ഔ", "ാ", "ി", "ീ", "ു", "ൂ"],
      ["െ", "േ", "ൈ", "ൊ", "ോ", "ൌ", "ം", "ഃ", "്"],
    ],
  },
};

const LANG_ORDER: LangKey[] = [
  "hindi",
  "marathi",
  "telugu",
  "tamil",
  "kannada",
  "malayalam",
  "bengali",
  "gujarati",
  "punjabi",
  "odia",
];

type Props = {
  onInput: (char: string) => void;
  onBackspace: () => void;
  onClose: () => void;
  isDarkMode?: boolean;
};

export default function IndianLanguageKeyboard({
  onInput,
  onBackspace,
  onClose,
  isDarkMode = true,
}: Props) {
  const [lang, setLang] = useState<LangKey>("hindi");
  const rows = LANGS[lang].rows;

  const bg = isDarkMode ? "#1a1a2e" : "#f8f8ff";
  const cardBg = isDarkMode ? "#1e1e3a" : "#ffffff";
  const charBg = isDarkMode ? "#2a2a4a" : "#f0f0f0";
  const charBgPressed = isDarkMode ? "#3a3a5a" : "#e0e0f0";
  const charText = isDarkMode ? "#e2e8f0" : "#1e1e3a";
  const langPillBg = isDarkMode ? "#2a2a4a" : "#eef0ff";
  const langPillActive = "#667eea";
  const borderColor = isDarkMode ? "rgba(102,126,234,0.22)" : "#e0e0e0";

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={[kb.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]} onPress={onClose} />
      <View style={[kb.sheet, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
        <View style={[kb.handle, { backgroundColor: isDarkMode ? "#4a4a6a" : "#d0d0d0" }]} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={kb.langRow}
        >
          {LANG_ORDER.map((k) => (
            <TouchableOpacity
              key={k}
              style={[
                kb.langPill,
                { backgroundColor: k === lang ? langPillActive : langPillBg },
              ]}
              onPress={() => setLang(k)}
            >
              <Text style={[kb.langPillText, { color: k === lang ? "#fff" : charText }]}>
                {LANGS[k].label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          style={{ maxHeight: 230 }}
          contentContainerStyle={[kb.charGrid, { backgroundColor: bg }]}
          showsVerticalScrollIndicator={false}
        >
          {rows.map((row, ri) => (
            <View key={ri} style={kb.charRow}>
              {row.map((ch) => (
                <TouchableOpacity
                  key={ch}
                  style={[kb.charBtn, { backgroundColor: charBg }]}
                  onPress={() => onInput(ch)}
                  activeOpacity={0.65}
                >
                  <Text style={[kb.charText, { color: charText }]}>{ch}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={[kb.actionRow, { borderTopColor: borderColor }]}>
          <TouchableOpacity
            style={[kb.actionBtn, { backgroundColor: isDarkMode ? "#dc2626" : "#fee2e2", flex: 0.5 }]}
            onPress={onBackspace}
          >
            <Feather name="delete" size={18} color={isDarkMode ? "#fca5a5" : "#dc2626"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[kb.actionBtn, { backgroundColor: charBg, flex: 2.5 }]}
            onPress={() => onInput(" ")}
          >
            <Text style={[kb.actionText, { color: charText }]}>SPACE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[kb.actionBtn, { backgroundColor: langPillActive, flex: 1 }]}
            onPress={onClose}
          >
            <Text style={[kb.actionText, { color: "#fff" }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const kb = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 28,
    ...platformShadow("#000", 0, -4, 0.3, 12),
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginVertical: 10,
  },
  langRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langPillText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  charGrid: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  charRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 5,
  },
  charBtn: {
    minWidth: 34,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  charText: {
    fontSize: 18,
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
