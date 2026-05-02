import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import api, { ApiError } from "@/services/api";

type PickerItem = { id: number; name: string };
type ActiveSheet = "state" | "board" | "class" | "medium" | null;

/* ─── Selector trigger row ───────────────────────────────────────────────── */
function SelectorRow({
  label,
  value,
  placeholder,
  disabled,
  loading,
  onPress,
}: {
  label: string;
  value?: string;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      <Text style={sr.label}>{label}</Text>
      <Pressable
        style={[sr.row, disabled && sr.rowDim]}
        onPress={() => { if (!disabled && !loading) onPress(); }}
        android_ripple={{ color: "rgba(255,255,255,0.06)" }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
        ) : (
          <Text style={[sr.value, !value && sr.placeholder]} numberOfLines={1}>
            {value ?? placeholder}
          </Text>
        )}
        <Feather
          name="chevron-right"
          size={16}
          color={disabled || loading ? Colors.darkDivider : Colors.gray400}
        />
      </Pressable>
    </View>
  );
}

const sr = StyleSheet.create({
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.darkTextMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.darkInputBg, borderWidth: 1, borderColor: Colors.darkInputBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowDim: { opacity: 0.4 },
  value: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.darkText },
  placeholder: { color: Colors.darkTextMuted, fontFamily: "Inter_400Regular" },
});

/* ─── Inline search sheet (no nested Modal) ──────────────────────────────── */
function SearchSheet({
  title,
  items,
  selectedId,
  onSelect,
  onClose,
}: {
  title: string;
  items: PickerItem[];
  selectedId: number | null;
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setQuery("");
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    /* Full-cover overlay inside the outer Modal */
    <View style={sh.overlay}>
      {/* Dim top area — tap to close */}
      <Pressable style={sh.dimArea} onPress={() => { Keyboard.dismiss(); onClose(); }} />

      {/* Sheet panel */}
      <View style={sh.sheet}>
        {/* Handle */}
        <View style={sh.handle} />

        {/* Header */}
        <View style={sh.header}>
          <Text style={sh.title}>{title}</Text>
          <Pressable onPress={() => { Keyboard.dismiss(); onClose(); }} hitSlop={12}>
            <Feather name="x" size={18} color={Colors.darkTextMuted} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={sh.searchWrap}>
          <Feather name="search" size={15} color={Colors.darkTextMuted} />
          <TextInput
            ref={inputRef}
            style={sh.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${title.replace("Select ", "").toLowerCase()}…`}
            placeholderTextColor={Colors.darkTextMuted}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x-circle" size={15} color={Colors.darkTextMuted} />
            </Pressable>
          )}
        </View>

        {/* List */}
        {filtered.length === 0 ? (
          <View style={sh.empty}>
            <Text style={sh.emptyText}>No results for "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <Pressable
                  style={[sh.option, selected && sh.optionSelected]}
                  onPress={() => { Keyboard.dismiss(); onSelect(item); onClose(); }}
                  android_ripple={{ color: "rgba(102,126,234,0.12)" }}
                >
                  <Text style={[sh.optionText, selected && sh.optionTextSelected]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {selected && <Feather name="check" size={15} color={Colors.primary} />}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const sh = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: "flex-end" },
  dimArea: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: Colors.darkCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.darkCardBorder, borderBottomWidth: 0, maxHeight: "72%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.darkDivider, alignSelf: "center", marginTop: 10, marginBottom: 2 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginVertical: 10, backgroundColor: Colors.darkInputBg, borderWidth: 1, borderColor: Colors.darkInputBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkText, paddingVertical: 0 },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, height: 52, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  optionSelected: { backgroundColor: "rgba(102,126,234,0.12)" },
  optionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkTextSub, flex: 1, marginRight: 8 },
  optionTextSelected: { fontFamily: "Inter_600SemiBold", color: Colors.primary },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
});

/* ─── Main modal ─────────────────────────────────────────────────────────── */
type Props = { visible: boolean; onClose: () => void };

export default function EducationEditModal({ visible, onClose }: Props) {
  const { user, updateUser, refreshUser, accessToken } = useAuth();
  const token = accessToken ?? "";

  const [states, setStates] = useState<PickerItem[]>([]);
  const [boards, setBoards] = useState<PickerItem[]>([]);
  const [classes, setClasses] = useState<PickerItem[]>([]);
  const [mediums, setMediums] = useState<PickerItem[]>([]);

  const [stateId, setStateId] = useState<number | null>(null);
  const [stateName, setStateName] = useState("");
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardName, setBoardName] = useState("");
  const [classId, setClassId] = useState<number | null>(null);
  const [className, setClassName] = useState("");
  const [mediumId, setMediumId] = useState<number | null>(null);
  const [mediumName, setMediumName] = useState("");

  const [statesLoading, setStatesLoading] = useState(false);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [mediumsLoading, setMediumsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!visible) return;
    setStateId(user?.stateId ?? null);
    setStateName(user?.state ?? "");
    setBoardId(user?.boardId ?? null);
    setBoardName(user?.board ?? "");
    setClassId(user?.classId ?? null);
    setClassName(user?.className ?? "");
    /* Pre-populate medium from saved profile so it's never lost on re-save */
    setMediumId(user?.mediumId ?? null);
    setMediumName(user?.medium ?? "");
    setActiveSheet(null);
    setToast(null);

    setStatesLoading(true);
    api.data.getStates()
      .then((d) => setStates(d.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setStatesLoading(false));
  }, [visible]);

  useEffect(() => {
    if (!visible || !stateId) { setBoards([]); return; }
    setBoardsLoading(true);
    api.data.getBoards(stateId)
      .then((d) => setBoards(d.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setBoardsLoading(false));
  }, [visible, stateId]);

  useEffect(() => {
    if (!visible || !boardId) { setClasses([]); return; }
    setClassesLoading(true);
    api.data.getClasses(boardId)
      .then((d) => setClasses(d.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setClassesLoading(false));
  }, [visible, boardId]);

  useEffect(() => {
    if (!visible || !boardId || !classId) { setMediums([]); return; }
    setMediumsLoading(true);
    api.data.getMediums(boardId, classId)
      .then((list) => {
        /* Deduplicate by name so "English x5" doesn't confuse users */
        const seen = new Set<string>();
        const deduped = list.filter((m) => {
          if (seen.has(m.name)) return false;
          seen.add(m.name);
          return true;
        });
        setMediums(deduped);
      })
      .catch(() => showToast("err", "Could not load mediums. Check your connection."))
      .finally(() => setMediumsLoading(false));
  }, [visible, boardId, classId]);

  const handleStateSelect = (item: PickerItem) => {
    setStateId(item.id); setStateName(item.name);
    setBoardId(null); setBoardName("");
    setClassId(null); setClassName("");
    setMediumId(null); setMediumName("");
  };
  const handleBoardSelect = (item: PickerItem) => {
    setBoardId(item.id); setBoardName(item.name);
    setClassId(null); setClassName("");
    setMediumId(null); setMediumName("");
  };
  const handleClassSelect = (item: PickerItem) => {
    setClassId(item.id); setClassName(item.name);
    setMediumId(null); setMediumName("");
  };

  const handleSave = async () => {
    if (!boardId) { showToast("err", "Please select a board."); return; }
    if (classId && !mediumId) { showToast("err", "Please select a medium of instruction."); return; }
    setSaving(true);
    try {
      /* Use the correct education endpoint — this saves medium_id to the server
         so that GET /api/documents can apply it automatically server-side */
      const res = await api.profile.saveEducation(token, {
        board_id: boardId,
        class_id: classId ?? null,
        medium_id: mediumId ?? null,
      });
      await updateUser({
        state: res.user.state,
        stateId: res.user.state_id,
        board: res.user.board,
        boardId: res.user.board_id,
        className: res.user.class_name,
        classId: res.user.class_id,
        medium: res.user.medium_name,
        mediumId: res.user.medium_id,
      });
      await refreshUser();
      showToast("ok", "Academic details saved.");
    } catch (e) {
      showToast("err", e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  /* Picker items for active sheet */
  const sheetItems: PickerItem[] = activeSheet === "state" ? states : activeSheet === "board" ? boards : activeSheet === "class" ? classes : mediums;
  const sheetSelectedId = activeSheet === "state" ? stateId : activeSheet === "board" ? boardId : activeSheet === "class" ? classId : mediumId;
  const sheetTitle = activeSheet === "state" ? "Select State" : activeSheet === "board" ? "Select Board" : activeSheet === "class" ? "Select Class" : "Select Medium";
  const sheetOnSelect = activeSheet === "state" ? handleStateSelect : activeSheet === "board" ? handleBoardSelect : activeSheet === "class" ? handleClassSelect : (item: PickerItem) => { setMediumId(item.id); setMediumName(item.name); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (activeSheet) setActiveSheet(null); else onClose(); }}>
      <View style={s.backdrop}>
        <View style={s.card}>
          {/* Title bar */}
          <View style={s.titleRow}>
            <View>
              <Text style={s.title}>Academic Details</Text>
              <Text style={s.subtitle}>Tap a field to search and select</Text>
            </View>
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={Colors.darkTextMuted} />
            </Pressable>
          </View>

          {/* Fields */}
          <View style={s.body}>
            <SelectorRow
              label="State"
              value={stateName || undefined}
              placeholder="Select state"
              loading={statesLoading}
              onPress={() => setActiveSheet("state")}
            />
            <SelectorRow
              label="Board"
              value={boardName || undefined}
              placeholder={stateId ? "Select board" : "Select a state first"}
              disabled={!stateId || statesLoading}
              loading={boardsLoading}
              onPress={() => setActiveSheet("board")}
            />
            <SelectorRow
              label="Class"
              value={className || undefined}
              placeholder={boardId ? "Select class" : "Select a board first"}
              disabled={!boardId || boardsLoading}
              loading={classesLoading}
              onPress={() => setActiveSheet("class")}
            />
            <SelectorRow
              label="Medium of Instruction *"
              value={mediumName || undefined}
              placeholder={classId ? "Select medium" : "Select a class first"}
              disabled={!classId || classesLoading}
              loading={mediumsLoading}
              onPress={() => setActiveSheet("medium")}
            />

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.saveBtnText}>Save Academic Details</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Toast */}
          {toast && !activeSheet && (
            <View style={[s.toast, toast.type === "ok" ? s.toastOk : s.toastErr]}>
              <Text style={s.toastText}>{toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}</Text>
            </View>
          )}

          {/* Inline search sheet — rendered INSIDE the card's Modal so it stacks correctly */}
          {activeSheet && (
            <SearchSheet
              title={sheetTitle}
              items={sheetItems}
              selectedId={sheetSelectedId}
              onSelect={sheetOnSelect}
              onClose={() => setActiveSheet(null)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: Colors.darkCard, borderRadius: 20, width: "100%", borderWidth: 1, borderColor: Colors.darkCardBorder, overflow: "hidden", position: "relative" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  toast: { margin: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  toastOk: { backgroundColor: "rgba(22,163,74,0.18)", borderWidth: 1, borderColor: "rgba(22,163,74,0.35)" },
  toastErr: { backgroundColor: "rgba(220,38,38,0.18)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)" },
  toastText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.darkText },
});
