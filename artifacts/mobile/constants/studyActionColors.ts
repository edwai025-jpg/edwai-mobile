type Tone = { bg: string; border: string; text: string };
type Palette = {
  read: Tone;
  tutor: Tone & { quotaBg: string; quotaDivider: string; quotaText: string };
  quiz: Tone;
  cards: Tone;
  report: Tone;
  amberText: string;
  barDivider: string;
};

export const STUDY_ACTION_COLORS: { light: Palette; dark: Palette } = {
  light: {
    read: { bg: "#e0f2fe", border: "#7dd3fc", text: "#0369a1" },
    tutor: { bg: "#f3e8ff", border: "#d8b4fe", text: "#7e22ce", quotaBg: "#f3e8ff", quotaDivider: "#d8b4fe", quotaText: "#9333ea" },
    quiz: { bg: "#e0e7ff", border: "#a5b4fc", text: "#4338ca" },
    cards: { bg: "#ede9fe", border: "#c4b5fd", text: "#6d28d9" },
    report: { bg: "#ffe4e6", border: "#fda4af", text: "#e11d48" },
    amberText: "#b45309",
    barDivider: "#e5e7eb99",
  },
  dark: {
    read: { bg: "#0c4a6e66", border: "#0ea5e980", text: "#7dd3fc" },
    tutor: { bg: "#581c8766", border: "#c084fc99", text: "#d8b4fe", quotaBg: "#581c874d", quotaDivider: "#c084fc66", quotaText: "#d8b4fe" },
    quiz: { bg: "#312e8166", border: "#818cf880", text: "#a5b4fc" },
    cards: { bg: "#4c1d9566", border: "#a78bfa80", text: "#c4b5fd" },
    report: { bg: "#8813374d", border: "#fb718580", text: "#fda4af" },
    amberText: "#fcd34d",
    barDivider: "#e5e7eb33",
  },
};

export const REPORT_ISSUES: { id: string; label: string }[] = [
  { id: "incorrect", label: "Incorrect answer" },
  { id: "too_short", label: "Answer too short" },
  { id: "too_long", label: "Answer too long" },
  { id: "irrelevant", label: "Irrelevant answer" },
  { id: "missing_concepts", label: "Missing key concepts" },
  { id: "wrong_source", label: "Wrong page / source cited" },
  { id: "other", label: "Other" },
];
