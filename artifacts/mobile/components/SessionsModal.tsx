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
import api, { ApiError, SessionInfo } from "@/services/api";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SessionsModal({ visible, onClose }: Props) {
  const { accessToken } = useAuth();
  const token = accessToken ?? "";

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSessions([]);
    api.profile.getSessions(token)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, token]);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api.profile.deleteSession(token, id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast("ok", "Session signed out.");
    } catch (e) {
      showToast("err", e instanceof ApiError ? e.message : "Failed to revoke session.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.titleRow}>
            <View>
              <Text style={s.title}>Active Sessions</Text>
              <Text style={s.subtitle}>Devices where you are signed in</Text>
            </View>
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={Colors.darkTextMuted} />
            </Pressable>
          </View>

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
              {sessions.length === 0 ? (
                <View style={s.center}>
                  <Text style={s.emptyText}>No active sessions found.</Text>
                </View>
              ) : (
                sessions.map((session) => (
                  <View key={session.id} style={s.sessionRow}>
                    <View style={s.sessionIcon}>
                      <Feather name="smartphone" size={18} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.deviceName} numberOfLines={1}>
                        {session.device_info ?? session.user_agent ?? "Unknown Device"}
                      </Text>
                      {!!session.ip_address && (
                        <Text style={s.sessionMeta}>IP: {session.ip_address}</Text>
                      )}
                      {!!session.last_used_at && (
                        <Text style={s.sessionMeta}>
                          Last used: {new Date(session.last_used_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      )}
                      {session.is_current && (
                        <Text style={s.currentTag}>● Current session</Text>
                      )}
                    </View>
                    {!session.is_current && (
                      <TouchableOpacity
                        style={s.revokeBtn}
                        onPress={() => handleRevoke(session.id)}
                        disabled={revokingId === session.id}
                      >
                        {revokingId === session.id
                          ? <ActivityIndicator size="small" color={Colors.danger} />
                          : <Text style={s.revokeBtnText}>Sign out</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}

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
  card: { backgroundColor: Colors.darkCard, borderRadius: 20, width: "100%", maxHeight: "80%", borderWidth: 1, borderColor: Colors.darkCardBorder, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  center: { paddingVertical: 36, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
  body: { paddingVertical: 8, paddingHorizontal: 16, gap: 2 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  sessionIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(102,126,234,0.15)", alignItems: "center", justifyContent: "center" },
  deviceName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.darkText },
  sessionMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted },
  currentTag: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#22c55e", marginTop: 2 },
  revokeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "rgba(220,38,38,0.4)", backgroundColor: "rgba(220,38,38,0.1)" },
  revokeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.danger },
  toast: { margin: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  toastOk: { backgroundColor: "rgba(22,163,74,0.18)", borderWidth: 1, borderColor: "rgba(22,163,74,0.35)" },
  toastErr: { backgroundColor: "rgba(220,38,38,0.18)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)" },
  toastText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.darkText },
});
