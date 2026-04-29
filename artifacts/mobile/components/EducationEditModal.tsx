import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/auth";
import api, { ApiError, BoardItem, ClassItem, MediumItem, StateItem } from "@/services/api";

type PickerItem = { id: number; name: string };

function DropdownPicker({
  label,
  items,
  selectedId,
  onSelect,
  placeholder,
  disabled,
  loading,
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
  const selected = items.find((i) => i.id === selectedId);
  return (
    <View style={{ zIndex: open ? 20 : 1 }}>
      <Text style={dp.label}>{label}</Text>
      <Pressable
        style={[dp.selector, disabled && dp.selectorDim]}
        onPress={() => { if (!disabled && !loading) setOpen((v) => !v); }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text style={[dp.selText, !selected && dp.placeholder]}>{selected?.name ?? placeholder}</Text>
        )}
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={disabled ? Colors.darkTextMuted : Colors.gray400} />
      </Pressable>
      {open && !loading && (
        <View style={dp.dropdown}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 150 }}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={[dp.option, item.id === selectedId && dp.optionActive]}
                onPress={() => { onSelect(item); setOpen(false); }}
              >
                <Text style={[dp.optionText, item.id === selectedId && dp.optionTextActive]}>{item.name}</Text>
                {item.id === selectedId && <Feather name="check" size={12} color={Colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const dp = StyleSheet.create({
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.darkTextMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  selector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.darkInputBg, borderWidth: 1, borderColor: Colors.darkInputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  selectorDim: { opacity: 0.45 },
  selText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkText, flex: 1 },
  placeholder: { color: Colors.darkTextMuted },
  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, backgroundColor: "#252538", borderWidth: 1, borderColor: Colors.darkCardBorder, borderRadius: 10, zIndex: 100, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  optionActive: { backgroundColor: "rgba(102,126,234,0.15)" },
  optionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkTextSub, flex: 1 },
  optionTextActive: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },
});

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function EducationEditModal({ visible, onClose }: Props) {
  const { user, updateUser, refreshUser, accessToken } = useAuth();
  const token = accessToken ?? "";

  const [states, setStates] = useState<StateItem[]>([]);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [mediums, setMediums] = useState<MediumItem[]>([]);

  const [stateId, setStateId] = useState<number | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [mediumId, setMediumId] = useState<number | null>(null);

  const [statesLoading, setStatesLoading] = useState(false);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [mediumsLoading, setMediumsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setBoardId(user?.boardId ?? null);
    setClassId(user?.classId ?? null);
    setMediumId(null);
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

  const handleStateSelect = (item: PickerItem) => {
    setStateId(item.id); setBoardId(null); setClassId(null); setMediumId(null);
    setBoards([]); setClasses([]); setMediums([]);
  };
  const handleBoardSelect = (item: PickerItem) => {
    setBoardId(item.id); setClassId(null); setMediumId(null);
    setClasses([]); setMediums([]);
  };
  const handleClassSelect = (item: PickerItem) => {
    setClassId(item.id); setMediumId(null); setMediums([]);
  };

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.titleRow}>
            <Text style={s.title}>Academic Details</Text>
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={Colors.darkTextMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <DropdownPicker
              label="State"
              items={states}
              selectedId={stateId}
              onSelect={handleStateSelect}
              placeholder="Select state"
              loading={statesLoading}
            />
            <DropdownPicker
              label="Board"
              items={boards}
              selectedId={boardId}
              onSelect={handleBoardSelect}
              placeholder="Select board"
              disabled={!stateId}
              loading={boardsLoading}
            />
            <DropdownPicker
              label="Class"
              items={classes}
              selectedId={classId}
              onSelect={handleClassSelect}
              placeholder="Select class"
              disabled={!boardId}
              loading={classesLoading}
            />
            <DropdownPicker
              label="Medium of Instruction"
              items={mediums}
              selectedId={mediumId}
              onSelect={(i) => setMediumId(i.id)}
              placeholder="Select medium (optional)"
              disabled={!classId}
              loading={mediumsLoading}
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
          </ScrollView>

          {toast && (
            <View style={[s.toast, toast.type === "ok" ? s.toastOk : s.toastErr]}>
              <Text style={s.toastText}>{toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { backgroundColor: Colors.darkCard, borderRadius: 20, width: "100%", borderWidth: 1, borderColor: Colors.darkCardBorder, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 16 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  toast: { margin: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  toastOk: { backgroundColor: "rgba(22,163,74,0.18)", borderWidth: 1, borderColor: "rgba(22,163,74,0.35)" },
  toastErr: { backgroundColor: "rgba(220,38,38,0.18)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)" },
  toastText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.darkText },
});
