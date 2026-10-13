import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { apiUserToProfile, useAuth } from "@/context/auth";
import api, { ApiError, ApiUser } from "@/services/api";
import ManagedEducationDetails from "@/components/ManagedEducationDetails";
import { isEducationManaged } from "@/services/profileContracts";

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

      {/* Sheet panel — KAV wraps only the sheet so the flex dim-area doesn't absorb the padding */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
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
      </KeyboardAvoidingView>
    </View>
  );
}

const sh = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 10, justifyContent: "flex-end" },
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
  const { user, updateUser, accessToken, runAuthenticatedRequest } = useAuth();
  const educationManaged = isEducationManaged(user);
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
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLock = useRef(false);
  const currentScope = useRef("");
  currentScope.current = JSON.stringify([visible, user?.id, educationManaged, stateId, boardId, classId]);

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

    if (educationManaged) return;
    let cancelled = false;
    setStatesLoading(true);
    api.data.getStates()
      .then((d) => { if (!cancelled) setStates(d.sort((a, b) => a.name.localeCompare(b.name))); })
      .catch(() => { if (!cancelled) showToast("err", "Could not load states. Please close and reopen Academic Details to retry."); })
      .finally(() => { if (!cancelled) setStatesLoading(false); });
    return () => { cancelled = true; };
  }, [visible, educationManaged, user?.id]);

  useEffect(() => {
    if (!visible || educationManaged || !stateId) { setBoards([]); setBoardsLoading(false); return; }
    let cancelled = false;
    setBoards([]);
    setBoardsLoading(true);
    api.data.getBoards(stateId)
      .then((d) => { if (!cancelled) setBoards(d.sort((a, b) => a.name.localeCompare(b.name))); })
      .catch(() => { if (!cancelled) showToast("err", "Could not load boards. Please close and reopen Academic Details to retry."); })
      .finally(() => { if (!cancelled) setBoardsLoading(false); });
    return () => { cancelled = true; };
  }, [visible, educationManaged, user?.id, stateId]);

  useEffect(() => {
    if (!visible || educationManaged || !boardId) { setClasses([]); setClassesLoading(false); return; }
    let cancelled = false;
    setClasses([]);
    setClassesLoading(true);
    api.data.getClassesForBoard(boardId)
      .then((d) => { if (!cancelled) setClasses(d.sort((a, b) => a.name.localeCompare(b.name))); })
      .catch(() => { if (!cancelled) showToast("err", "Could not load classes. Please close and reopen Academic Details to retry."); })
      .finally(() => { if (!cancelled) setClassesLoading(false); });
    return () => { cancelled = true; };
  }, [visible, educationManaged, user?.id, boardId]);

  useEffect(() => {
    if (!visible || educationManaged || !boardId || !classId) { setMediums([]); setMediumsLoading(false); return; }
    let cancelled = false;
    setMediums([]);
    setMediumsLoading(true);
    api.data.getMediumsForClass(classId)
      .then((list) => {
        // IDs are authoritative; similarly named options may be distinct.
        if (!cancelled) setMediums(list.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => { if (!cancelled) showToast("err", "Could not load mediums. Please close and reopen Academic Details to retry."); })
      .finally(() => { if (!cancelled) setMediumsLoading(false); });
    return () => { cancelled = true; };
  }, [visible, educationManaged, user?.id, boardId, classId]);

  const handleStateSelect = (item: PickerItem) => {
    setBoards([]); setClasses([]); setMediums([]);
    setStateId(item.id); setStateName(item.name);
    setBoardId(null); setBoardName("");
    setClassId(null); setClassName("");
    setMediumId(null); setMediumName("");
  };
  const handleBoardSelect = (item: PickerItem) => {
    setClasses([]); setMediums([]);
    setBoardId(item.id); setBoardName(item.name);
    setClassId(null); setClassName("");
    setMediumId(null); setMediumName("");
  };
  const handleClassSelect = (item: PickerItem) => {
    setMediums([]);
    setClassId(item.id); setClassName(item.name);
    setMediumId(null); setMediumName("");
  };

  const handleSave = async () => {
    if (educationManaged || saveLock.current || !accessToken) return;
    const accountId = user?.id;
    const scope = currentScope.current;
    const applyServer = async (server: ApiUser, resetDraft = true) => {
      if (server.id !== accountId) throw new Error("Your account changed. Please reopen Academic Details.");
      await updateUser(apiUserToProfile(server));
      if (currentScope.current !== scope) return false;
      if (resetDraft) {
        setStateId(server.state_id ?? null); setStateName(server.state ?? "");
        setBoardId(server.board_id ?? null); setBoardName(server.board ?? "");
        setClassId(server.class_id ?? null); setClassName(server.class_name ?? "");
        setMediumId(server.medium_id ?? null); setMediumName(server.medium_name ?? "");
      }
      return true;
    };
    if (needsRefresh) {
      saveLock.current = true; setSaving(true);
      try {
        await applyServer(await runAuthenticatedRequest(token => api.auth.getMe(token)));
        setNeedsRefresh(false);
        showToast("ok", "Saved academic details refreshed. Review your selections before saving again.");
      } catch { showToast("err", "Could not check saved academic details. No further save was attempted. Please try again or contact the EDUwAI team."); }
      finally { saveLock.current = false; setSaving(false); }
      return;
    }
    if (!boardId) { showToast("err", "Please select a board."); return; }
    if (statesLoading || boardsLoading || classesLoading || mediumsLoading) {
      showToast("err", "Please wait for the academic options to load."); return;
    }
    saveLock.current = true;
    setSaving(true);
    let committed = false;
    try {
      /* Use the correct education endpoint — this saves medium_id to the server
         so that GET /api/documents can apply it automatically server-side */
      await runAuthenticatedRequest(token => api.profile.saveEducation(token, {
        board_id: boardId,
        class_id: classId ?? null,
        medium_id: mediumId ?? null,
      }));
      committed = true;
      // PUT returns only a partial user. Resolve State IDs and server completion
      // truth from auth/me without replaying PUT if this read needs a refresh.
      const server = await runAuthenticatedRequest(token => api.auth.getMe(token));
      if (server.board_id !== boardId || (server.class_id ?? null) !== classId || (server.medium_id ?? null) !== mediumId) {
        throw new Error("The saved profile did not confirm these academic selections. Please review before retrying.");
      }
      if (await applyServer(server)) showToast("ok", "Academic details saved.");
    } catch (e) {
      if (currentScope.current === scope) {
        // No automatic retry of a write after a lost response. Check the
        // authoritative selections first; block writes if that check fails.
        if (committed || !(e instanceof ApiError) || e.statusCode >= 500 || e.statusCode < 400) {
          try {
            const server = await runAuthenticatedRequest(token => api.auth.getMe(token));
            const matches = server.board_id === boardId && (server.class_id ?? null) === classId && (server.medium_id ?? null) === mediumId;
            await applyServer(server, matches);
            if (matches) {
              showToast("ok", "Your saved academic details match these selections.");
              return;
            }
          } catch { setNeedsRefresh(true); }
        }
        showToast("err", `${e instanceof Error ? e.message : "Could not confirm the save. Check saved details before retrying."}\nPlease contact the EDUwAI team through in-app chat or the “Contact Us” section on the home page for help.`);
      }
    } finally {
      saveLock.current = false;
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
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.card}>
          {/* Title bar */}
          <View style={s.titleRow}>
            <View>
              <Text style={s.title}>Academic Details</Text>
              <Text style={s.subtitle}>{educationManaged ? "Managed by your institution" : "Tap a field to search and select"}</Text>
            </View>
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={Colors.darkTextMuted} />
            </Pressable>
          </View>

          {/* Fields */}
          <ScrollView
            contentContainerStyle={s.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {educationManaged ? <ManagedEducationDetails user={user} /> : <>
            <SelectorRow
              label="State"
              disabled={saving}
              value={stateName || undefined}
              placeholder="Select state"
              loading={statesLoading}
              onPress={() => setActiveSheet("state")}
            />
            <SelectorRow
              label="Board"
              value={boardName || undefined}
              placeholder={stateId ? "Select board" : "Select a state first"}
              disabled={saving || !stateId || statesLoading}
              loading={boardsLoading}
              onPress={() => setActiveSheet("board")}
            />
            <SelectorRow
              label="Class"
              value={className || undefined}
              placeholder={boardId ? "Select class" : "Select a board first"}
              disabled={saving || !boardId || boardsLoading}
              loading={classesLoading}
              onPress={() => setActiveSheet("class")}
            />
            <SelectorRow
              label="Medium of Instruction"
              value={mediumName || undefined}
              placeholder={classId ? "Select medium" : "Select a class first"}
              disabled={saving || !classId || classesLoading}
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
                : <Text style={s.saveBtnText}>{needsRefresh ? "Check Saved Academic Details" : "Save Academic Details"}</Text>
              }
            </TouchableOpacity>
            </>}
          </ScrollView>

          {/* Toast */}
          {toast && !activeSheet && (
            <View style={[s.toast, toast.type === "ok" ? s.toastOk : s.toastErr]}>
              <Text style={s.toastText}>{toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}</Text>
            </View>
          )}

          {/* Inline search sheet — rendered INSIDE the card's Modal so it stacks correctly */}
          {activeSheet && !educationManaged && (
            <SearchSheet
              title={sheetTitle}
              items={sheetItems}
              selectedId={sheetSelectedId}
              onSelect={sheetOnSelect}
              onClose={() => setActiveSheet(null)}
            />
          )}
        </View>
      </KeyboardAvoidingView>
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
