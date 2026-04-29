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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import api, { ApiError, BoardItem, ClassItem, MediumItem, StateItem } from "@/services/api";

type PickerItem = { id: number; name: string };

/* ─── Searchable bottom-sheet picker ────────────────────────────────────── */
function SearchablePickerSheet({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId: number | null;
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ps.backdrop} onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <View style={[ps.sheet, { paddingBottom: insets.bottom + 8 }]}>
        {/* Handle bar */}
        <View style={ps.handleBar} />

        {/* Header */}
        <View style={ps.header}>
          <Text style={ps.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={ps.closeBtn}>
            <Feather name="x" size={18} color={Colors.darkTextMuted} />
          </Pressable>
        </View>

        {/* Search input */}
        <View style={ps.searchWrap}>
          <Feather name="search" size={15} color={Colors.darkTextMuted} style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            style={ps.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${title.toLowerCase()}…`}
            placeholderTextColor={Colors.darkTextMuted}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x-circle" size={15} color={Colors.darkTextMuted} />
            </Pressable>
          )}
        </View>

        {/* List */}
        {filtered.length === 0 ? (
          <View style={ps.empty}>
            <Text style={ps.emptyText}>No results for "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={ps.list}
            initialNumToRender={20}
            getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <Pressable
                  style={[ps.option, isSelected && ps.optionSelected]}
                  onPress={() => { onSelect(item); onClose(); }}
                >
                  <Text style={[ps.optionText, isSelected && ps.optionTextSelected]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {isSelected && <Feather name="check" size={15} color={Colors.primary} />}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: Colors.darkCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    borderBottomWidth: 0,
    maxHeight: "72%",
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.darkDivider,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkDivider,
  },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText },
  closeBtn: { padding: 4 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: Colors.darkInputBg,
    borderWidth: 1,
    borderColor: Colors.darkInputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.darkText,
    paddingVertical: 0,
  },
  list: { flex: 1 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkDivider,
  },
  optionSelected: { backgroundColor: "rgba(102,126,234,0.12)" },
  optionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkTextSub, flex: 1, marginRight: 8 },
  optionTextSelected: { fontFamily: "Inter_600SemiBold", color: Colors.primary },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
});

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
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.darkTextMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.darkInputBg,
    borderWidth: 1,
    borderColor: Colors.darkInputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowDim: { opacity: 0.4 },
  value: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.darkText },
  placeholder: { color: Colors.darkTextMuted, fontFamily: "Inter_400Regular" },
});

/* ─── Main modal ──────────────────────────────────────────────────────────── */
type ActiveSheet = "state" | "board" | "class" | "medium" | null;

type Props = { visible: boolean; onClose: () => void };

export default function EducationEditModal({ visible, onClose }: Props) {
  const { user, updateUser, refreshUser, accessToken } = useAuth();
  const token = accessToken ?? "";

  const [states, setStates] = useState<StateItem[]>([]);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [mediums, setMediums] = useState<MediumItem[]>([]);

  const [stateId, setStateId] = useState<number | null>(null);
  const [stateName, setStateName] = useState<string>("");
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardName, setBoardName] = useState<string>("");
  const [classId, setClassId] = useState<number | null>(null);
  const [className, setClassName] = useState<string>("");
  const [mediumId, setMediumId] = useState<number | null>(null);
  const [mediumName, setMediumName] = useState<string>("");

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

  /* ── Load initial state ── */
  useEffect(() => {
    if (!visible) return;
    const uid = user?.stateId ?? null;
    const bid = user?.boardId ?? null;
    const cid = user?.classId ?? null;
    setStateId(uid); setStateName(user?.state ?? "");
    setBoardId(bid); setBoardName(user?.board ?? "");
    setClassId(cid); setClassName(user?.className ?? "");
    setMediumId(null); setMediumName("");
    setToast(null);

    setStatesLoading(true);
    api.data.getStates()
      .then((d) => setStates(d.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setStatesLoading(false));
  }, [visible]);

  useEffect(() => {
    if (!visible || !stateId) return;
    setBoardsLoading(true);
    api.data.getBoards(stateId)
      .then((d) => setBoards(d.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setBoardsLoading(false));
  }, [visible, stateId]);

  useEffect(() => {
    if (!visible || !boardId) return;
    setClassesLoading(true);
    api.data.getClasses(boardId)
      .then((d) => setClasses(d.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setClassesLoading(false));
  }, [visible, boardId]);

  useEffect(() => {
    if (!visible || !boardId || !classId) return;
    setMediumsLoading(true);
    api.data.getMediums(boardId, classId)
      .then(setMediums)
      .catch(() => {})
      .finally(() => setMediumsLoading(false));
  }, [visible, boardId, classId]);

  /* ── Selection handlers ── */
  const handleStateSelect = (item: PickerItem) => {
    setStateId(item.id); setStateName(item.name);
    setBoardId(null); setBoardName("");
    setClassId(null); setClassName("");
    setMediumId(null); setMediumName("");
    setBoards([]); setClasses([]); setMediums([]);
  };

  const handleBoardSelect = (item: PickerItem) => {
    setBoardId(item.id); setBoardName(item.name);
    setClassId(null); setClassName("");
    setMediumId(null); setMediumName("");
    setClasses([]); setMediums([]);
  };

  const handleClassSelect = (item: PickerItem) => {
    setClassId(item.id); setClassName(item.name);
    setMediumId(null); setMediumName("");
    setMediums([]);
  };

  const handleMediumSelect = (item: PickerItem) => {
    setMediumId(item.id); setMediumName(item.name);
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!boardId) { showToast("err", "Please select a board."); return; }
    setSaving(true);
    try {
      const res = await api.profile.updateStudentProfile(token, {
        state_id: stateId ?? undefined,
        board_id: boardId,
        class_id: classId ?? undefined,
        medium_id: mediumId ?? undefined,
      });
      await updateUser({
        state: res.user.state,
        stateId: res.user.state_id,
        board: res.user.board,
        boardId: res.user.board_id,
        className: res.user.class_name,
        classId: res.user.class_id,
        medium: res.user.medium_name,
      });
      await refreshUser();
      showToast("ok", "Academic details saved.");
    } catch (e) {
      showToast("err", e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={s.backdrop}>
          <View style={s.card}>
            <View style={s.titleRow}>
              <View>
                <Text style={s.title}>Academic Details</Text>
                <Text style={s.subtitle}>Tap a field to search and select</Text>
              </View>
              <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
                <Feather name="x" size={18} color={Colors.darkTextMuted} />
              </Pressable>
            </View>

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
                label="Medium of Instruction"
                value={mediumName || undefined}
                placeholder={classId ? "Select medium (optional)" : "Select a class first"}
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

            {toast && (
              <View style={[s.toast, toast.type === "ok" ? s.toastOk : s.toastErr]}>
                <Text style={s.toastText}>{toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Searchable sheets ── */}
      <SearchablePickerSheet
        visible={activeSheet === "state"}
        title="Select State"
        items={states}
        selectedId={stateId}
        onSelect={handleStateSelect}
        onClose={() => setActiveSheet(null)}
      />
      <SearchablePickerSheet
        visible={activeSheet === "board"}
        title="Select Board"
        items={boards}
        selectedId={boardId}
        onSelect={handleBoardSelect}
        onClose={() => setActiveSheet(null)}
      />
      <SearchablePickerSheet
        visible={activeSheet === "class"}
        title="Select Class"
        items={classes}
        selectedId={classId}
        onSelect={handleClassSelect}
        onClose={() => setActiveSheet(null)}
      />
      <SearchablePickerSheet
        visible={activeSheet === "medium"}
        title="Select Medium"
        items={mediums}
        selectedId={mediumId}
        onSelect={handleMediumSelect}
        onClose={() => setActiveSheet(null)}
      />
    </>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: Colors.darkCard,
    borderRadius: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.darkCardBorder,
    overflow: "hidden",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkDivider,
  },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  toast: { margin: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  toastOk: { backgroundColor: "rgba(22,163,74,0.18)", borderWidth: 1, borderColor: "rgba(22,163,74,0.35)" },
  toastErr: { backgroundColor: "rgba(220,38,38,0.18)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)" },
  toastText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.darkText },
});
