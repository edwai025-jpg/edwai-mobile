import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Colors } from "@/constants/colors";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSupportChat } from "@/hooks/useSupportChat";

const BUBBLE_PATH =
  "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z";

function BubbleIcon({ size = 24, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={BUBBLE_PATH} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={Colors.gray600} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === today.toDateString()
    ? time
    : `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

export function SupportChatWidget({ aboveTabs = false }: { aboveTabs?: boolean }) {
  const [visible, setVisible] = useState(false);
  const chat = useSupportChat(visible);
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [initial, setInitial] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [nearBottom, setNearBottom] = useState(true);
  const [confirmation, setConfirmation] = useState<{
    title: string; message: string; action: string; confirm: () => void;
  } | null>(null);
  const listRef = useRef<FlatList>(null);
  const lastId = useRef<number | null>(null);

  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    const s = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKb(true));
    const h = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const { messages, conversation } = chat;
  const data = useMemo(() => [...messages].reverse(), [messages]);

  useEffect(() => {
    const newest = messages.length ? messages[messages.length - 1] : null;
    if (!newest) return;
    if (lastId.current !== null && newest.id !== lastId.current && newest.sender === "admin" && !nearBottom) {
      setShowNew(true);
    }
    lastId.current = newest.id;
  }, [messages, nearBottom]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const near = e.nativeEvent.contentOffset.y < 120;
    setNearBottom(near);
    if (near) setShowNew(false);
  }, []);

  const scrollDown = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowNew(false);
  };

  const askConfirmation = (title: string, message: string, action: string, confirm: () => void) => {
    if (Platform.OS === "web") {
      setConfirmation({ title, message, action, confirm });
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: action, onPress: confirm },
      ]);
    }
  };

  const confirmClose = () => {
    const hasDraft = chat.draft.trim().length > 0;
    if (!hasDraft && !chat.pending) return setVisible(false);
    const msg = chat.pending
      ? "Your conversation is saved. Replies will appear when you reopen chat."
      : "Your unsent draft will be kept for next time.";
    askConfirmation("Close support chat?", msg, "Close", () => setVisible(false));
  };

  const confirmNew = () => {
    askConfirmation(
      "Start a new conversation?",
      "Your current conversation stays with the EDUwAI team. You just won't see it here.",
      "Start new",
      () => void chat.newConversation(),
    );
  };

  const confirmRetry = () => {
    askConfirmation(
      "Send again?",
      "Your earlier message may already have reached us. Sending again could create a duplicate.",
      "Send again",
      () => void chat.allowRetry(),
    );
  };

  const resolved = conversation?.status === "resolved";
  const needsGuestForm = !chat.isAuthenticated && !conversation && !chat.restoring && !chat.blocked && !chat.pending;
  const canCompose = !!conversation || chat.isAuthenticated ? !resolved && !chat.blocked : false;
  const canSend = canCompose && !chat.busy && !chat.uncertain && chat.draft.trim().length > 0 && !chat.pending;

  const syncLabel =
    chat.syncState === "connected"
      ? "Replies update automatically while this chat is open"
      : chat.syncState === "reconnecting"
        ? "Reconnecting. Messages may be delayed"
        : chat.syncState === "loading"
          ? "Loading messages"
          : null;

  const renderHeaderRight = () =>
    conversation ? (
      <Pressable testID="support-new" disabled={chat.busy} onPress={confirmNew} hitSlop={8} style={styles.textBtn} accessibilityRole="button">
        <Text style={styles.textBtnLabel}>New</Text>
      </Pressable>
    ) : null;

  const pendingBlock = chat.pending ? (
    <View style={[styles.row, styles.rowMe]}>
      <View style={[styles.bubble, styles.bubbleMe, chat.pending.status === "uncertain" && styles.bubbleUncertain]}>
        <Text style={styles.meText}>{chat.pending.text}</Text>
        <Text style={styles.meTime}>
          {chat.pending.status === "sending"
            ? "Sending..."
            : chat.pending.status === "sent"
              ? "Sent. Checking delivery..."
              : "Delivery uncertain"}
        </Text>
      </View>
    </View>
  ) : null;

  const renderBody = () => {
    if (chat.restoring) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.indigo} />
          <Text style={styles.muted}>Opening your conversation</Text>
          {chat.error ? (
            <>
              <Text style={styles.errorText}>{chat.error}</Text>
              <Pressable testID="support-refresh" onPress={() => void chat.refresh()} style={styles.outlineBtn} accessibilityRole="button">
                <Text style={styles.outlineLabel}>Try again</Text>
              </Pressable>
              <Pressable onPress={confirmNew} style={styles.textBtn} accessibilityRole="button">
                <Text style={styles.textBtnLabel}>Start a different conversation</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      );
    }
    if (needsGuestForm) {
      return (
        <KeyboardAwareScrollViewCompat
          style={{ flex: 1 }}
          contentContainerStyle={styles.form}
          bottomOffset={24}
        >
          <Text style={styles.formTitle}>Tell us who you are</Text>
          <Text style={styles.muted}>
            A real person from the EDUwAI team will read your message. Add an email or phone so we can reach you.
          </Text>
          <Text style={styles.label}>Name</Text>
          <TextInput
            testID="support-name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={Colors.placeholder}
            style={styles.input}
            autoComplete="name"
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="support-email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.placeholder}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.or}>or</Text>
          <Text style={styles.label}>Phone</Text>
          <View style={styles.phoneRow}>
            <View style={styles.cc}>
              <Text style={styles.ccText}>+91</Text>
            </View>
            <TextInput
              testID="support-phone"
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              placeholderTextColor={Colors.placeholder}
              style={[styles.input, { flex: 1 }]}
              keyboardType="phone-pad"
            />
          </View>
          <Text style={styles.label}>How can we help? (optional)</Text>
          <TextInput
            testID="support-initial-message"
            value={initial}
            onChangeText={setInitial}
            placeholder="Describe your issue"
            placeholderTextColor={Colors.placeholder}
            style={[styles.input, styles.multi]}
            multiline
            textAlignVertical="top"
          />
          {chat.error ? <Text style={styles.errorText}>{chat.error}</Text> : null}
          <Pressable
            testID="support-start"
            disabled={chat.busy || chat.uncertain}
            onPress={() =>
              void chat.startGuest({
                name: name.trim(),
                email: email.trim(),
                phone,
                initialMessage: initial.trim(),
              })
            }
            style={[styles.primaryBtn, chat.busy && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            {chat.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Start chat</Text>}
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      );
    }

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {syncLabel ? (
          <View style={[styles.syncBar, chat.syncState === "reconnecting" && styles.syncWarn]}>
            <Text style={[styles.syncText, chat.syncState === "reconnecting" && { color: Colors.warning }]}>
              {syncLabel}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            inverted
            data={data}
            keyExtractor={(m) => String(m.id)}
            onScroll={onScroll}
            maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 120 }}
            scrollEventThrottle={64}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={styles.list}
            ListHeaderComponent={pendingBlock}
            ListEmptyComponent={
              chat.syncState === "loading" ? (
                <View style={[styles.center, { transform: [{ scaleY: -1 }] }]}>
                  <ActivityIndicator color={Colors.indigo} />
                </View>
              ) : !chat.pending ? (
                <View style={[styles.center, { transform: [{ scaleY: -1 }] }]}>
                  <View style={styles.emptyIcon}>
                    <BubbleIcon size={28} color={Colors.indigo} />
                  </View>
                  <Text style={styles.emptyTitle}>Say hello to the team</Text>
                  <Text style={styles.muted}>
                    Write your question below. Someone from EDUwAI will reply, usually within a few hours.
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const mine = item.sender === "student";
              return (
                <View style={[styles.row, mine ? styles.rowMe : styles.rowTeam]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleTeam]}>
                    {!mine ? <Text style={styles.teamName}>{item.sender_name || "EDUwAI Team"}</Text> : null}
                    <Text style={mine ? styles.meText : styles.teamText}>{item.text}</Text>
                    <Text style={mine ? styles.meTime : styles.teamTime}>{formatTime(item.created_at)}</Text>
                  </View>
                </View>
              );
            }}
          />
          {showNew ? (
            <Pressable onPress={scrollDown} style={styles.newPill} accessibilityRole="button">
              <Text style={styles.newPillText}>New reply</Text>
            </Pressable>
          ) : null}
        </View>

        {chat.uncertain ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Delivery uncertain</Text>
            <Text style={styles.warnText}>
              We could not confirm your last message arrived. Check first. Your text is saved below.
            </Text>
            <View style={styles.warnActions}>
              <Pressable testID="support-refresh" onPress={() => void chat.refresh()} style={styles.outlineBtn} accessibilityRole="button">
                <Text style={styles.outlineLabel}>Check delivery</Text>
              </Pressable>
              <Pressable onPress={confirmRetry} style={styles.outlineBtn} accessibilityRole="button">
                <Text style={styles.outlineLabel}>Send again</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {chat.error && !chat.blocked && !chat.uncertain ? (
          <View style={styles.errBox}>
            <Text style={[styles.errorText, { flex: 1, marginTop: 0 }]}>{chat.error}</Text>
            {!chat.uncertain ? (
              <Pressable testID="support-refresh" onPress={() => void chat.refresh()} style={styles.textBtn} accessibilityRole="button">
                <Text style={styles.textBtnLabel}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {chat.blocked ? (
          <View style={styles.footerBox}>
            <Text style={styles.warnTitle}>This conversation cannot be opened</Text>
            <Text style={styles.warnText}>
              {chat.error || "It may have been removed, or you may not have access to it."}
            </Text>
            <Pressable
              testID="support-recover"
              onPress={() => chat.needsSignIn ? void chat.signInAgain() : confirmNew()}
              style={styles.primaryBtn} accessibilityRole="button"
            >
              <Text style={styles.primaryLabel}>{chat.needsSignIn ? "Sign in again" : "Start a new conversation"}</Text>
            </Pressable>
          </View>
        ) : resolved ? (
          <View style={[styles.footerBox, { paddingBottom: bottom + 12 }]}>
            <Text style={styles.warnTitle}>Conversation resolved</Text>
            <Text style={styles.warnText}>The team marked this as resolved. You can start a new one anytime.</Text>
            <Pressable onPress={confirmNew} style={styles.primaryBtn} accessibilityRole="button">
              <Text style={styles.primaryLabel}>Start a new conversation</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: (kb ? 0 : bottom) + 8 }]}>
            <TextInput
              testID="support-composer"
              value={chat.draft}
              onChangeText={chat.setDraft}
              placeholder="Type your message"
              placeholderTextColor={Colors.placeholder}
              style={styles.composerInput}
              multiline
              maxLength={4000}
              editable={!chat.busy}
            />
            <Pressable
              testID="support-send"
              disabled={!canSend}
              onPress={() => void chat.send()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[styles.send, !canSend && { backgroundColor: Colors.indigoBorder }]}
            >
              {chat.busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  };

  return (
    <>
      {!visible && !kb ? (
        <Pressable
          testID="support-open"
          onPress={() => setVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open support chat"
          style={[styles.fab, { bottom: bottom + (aboveTabs ? 74 : 24) }]}
        >
          <BubbleIcon />
        </Pressable>
      ) : null}
      <Modal visible={visible} animationType="slide" onRequestClose={confirmClose}>
        <View style={[styles.screen, { paddingTop: top }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>EDUwAI Support</Text>
              <Text style={styles.subtitle}>We typically reply within a few hours</Text>
            </View>
            {renderHeaderRight()}
            <Pressable
              testID="support-close"
              onPress={confirmClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close support chat"
              style={styles.closeBtn}
            >
              <CloseIcon />
            </Pressable>
          </View>
          {renderBody()}
          {confirmation ? (
            <View style={styles.confirmBackdrop}>
              <View style={styles.confirmCard} accessibilityRole="alert" accessibilityLabel={confirmation.title}>
                <Text style={styles.formTitle}>{confirmation.title}</Text>
                <Text style={styles.muted}>{confirmation.message}</Text>
                <View style={styles.warnActions}>
                  <Pressable
                    testID="support-confirm-cancel"
                    accessibilityRole="button"
                    style={styles.outlineBtn}
                    onPress={() => setConfirmation(null)}
                  >
                    <Text style={styles.outlineLabel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    testID="support-confirm-accept"
                    accessibilityRole="button"
                    style={styles.primaryBtn}
                    onPress={() => {
                      const action = confirmation.confirm;
                      setConfirmation(null);
                      action();
                    }}
                  >
                    <Text style={styles.primaryLabel}>{confirmation.action}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

export default SupportChatWidget;

const styles = StyleSheet.create({
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 100,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  fab: {
    position: "absolute",
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.indigo,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: Colors.indigo,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 50,
  },
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.heading },
  subtitle: { fontSize: 12.5, color: Colors.muted, marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: Colors.gray100 },
  textBtn: { paddingHorizontal: 12, minHeight: 40, justifyContent: "center", borderRadius: 20, backgroundColor: Colors.indigoBg },
  textBtnLabel: { color: Colors.indigo, fontWeight: "600", fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  muted: { color: Colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  form: { padding: 20, paddingBottom: 48, gap: 6 },
  formTitle: { fontSize: 22, fontWeight: "700", color: Colors.heading, marginBottom: 2 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.gray700, marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.heading,
  },
  multi: { minHeight: 96 },
  or: { textAlign: "center", color: Colors.gray400, fontSize: 12, marginTop: 10 },
  phoneRow: { flexDirection: "row", gap: 8 },
  cc: { justifyContent: "center", paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.indigoBg, borderWidth: 1, borderColor: Colors.indigoBorder },
  ccText: { color: Colors.indigo, fontWeight: "600", fontSize: 16 },
  primaryBtn: { marginTop: 20, backgroundColor: Colors.indigo, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryLabel: { color: "#fff", fontWeight: "700", fontSize: 16 },
  errorText: { color: Colors.danger, fontSize: 13.5, marginTop: 12, lineHeight: 19 },
  syncBar: { paddingVertical: 6, paddingHorizontal: 16, backgroundColor: Colors.indigoBg },
  syncWarn: { backgroundColor: Colors.warningLight },
  syncText: { fontSize: 12, color: Colors.indigo, textAlign: "center" },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  row: { flexDirection: "row", marginBottom: 2 },
  rowMe: { justifyContent: "flex-end" },
  rowTeam: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMe: { backgroundColor: Colors.indigo, borderBottomRightRadius: 6 },
  bubbleUncertain: { backgroundColor: Colors.gray500 },
  bubbleTeam: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200, borderBottomLeftRadius: 6 },
  teamName: { fontSize: 12, fontWeight: "700", color: Colors.indigo, marginBottom: 2 },
  meText: { color: "#fff", fontSize: 15.5, lineHeight: 21 },
  teamText: { color: Colors.heading, fontSize: 15.5, lineHeight: 21 },
  meTime: { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 4, alignSelf: "flex-end" },
  teamTime: { color: Colors.gray400, fontSize: 11, marginTop: 4 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.indigoBg, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: Colors.heading },
  newPill: { position: "absolute", alignSelf: "center", bottom: 12, backgroundColor: Colors.indigo, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, elevation: 4 },
  newPillText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray200 },
  composerInput: { flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: Colors.inputBorder, backgroundColor: Colors.gray50, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: Colors.heading },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.indigo, alignItems: "center", justifyContent: "center" },
  warnBox: { backgroundColor: Colors.warningLight, padding: 14, gap: 4 },
  warnTitle: { fontSize: 15, fontWeight: "700", color: Colors.heading },
  warnText: { fontSize: 13.5, color: Colors.gray700, lineHeight: 19 },
  warnActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  outlineBtn: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: Colors.warning, alignItems: "center", justifyContent: "center", backgroundColor: Colors.white },
  outlineLabel: { color: Colors.warning, fontWeight: "700", fontSize: 14 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.dangerLight },
  footerBox: { padding: 16, gap: 4, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray200 },
});
