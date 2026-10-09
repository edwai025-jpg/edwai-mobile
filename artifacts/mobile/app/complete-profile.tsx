import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert, BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OrgTerms from "@/components/onboarding/OrgTerms";
import Picker, { LoadingRow, RetryRow } from "@/components/onboarding/Picker";
import PhoneField from "@/components/onboarding/PhoneField";
import SetupGuide from "@/components/onboarding/SetupGuide";
import { useCatalogue } from "@/components/onboarding/useCatalogue";
import { ActionButton, Checkbox, ErrorLine, openExternal, T, TextLink, Wordmark, shadow } from "@/components/onboarding/ui";
import WhatsNewPanel from "@/components/WhatsNewPanel";
import { useAuth } from "@/context/auth";
import { ApiError } from "@/services/api";
import { legalUrls, mutationErrorMessage, validateName, validatePhone } from "@/services/onboarding";

const logo = require("@/assets/images/eduwai-logo.png");

type Kind = "class" | "classRequest" | "boardRequest" | "own";

export default function CompleteProfileScreen() {
  const { user, isRestored, isLoggedIn } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (isRestored && !isLoggedIn) router.replace("/login");
  }, [isRestored, isLoggedIn, router]);
  if (user?.isPreRegistered && !user.termsAcceptedAt) {
    return <OrgTerms onDone={() => router.replace("/(tabs)")} />;
  }
  return <ProfileScreen />;
}

function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, requestCurriculum, completeProfile, logout } = useAuth();
  const cat = useCatalogue();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [nameErr, setNameErr] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [termsErr, setTermsErr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | Kind>("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [boardReq, setBoardReq] = useState("");
  const [classReq, setClassReq] = useState("");
  const [classPanel, setClassPanel] = useState(false);
  const lock = useRef(false);
  const memo = useRef(new Map<string, { id?: number; ambiguous?: boolean }>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const { states, boards, classes, stateId, boardId, classId } = cat;
  const boardName = boards.items.find((b) => b.id === boardId)?.name ?? "";
  const noBoards = stateId !== null && boards.status === "ready" && boards.parentId === stateId && boards.items.length === 0;
  const noClasses = boardId !== null && classes.status === "ready" && classes.parentId === boardId && classes.items.length === 0;
  const hasClasses = boardId !== null && classes.status === "ready" && classes.parentId === boardId && classes.items.length > 0;

  const doLogout = async () => {
    try { await logout(); } finally { router.replace("/login"); }
  };
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Leave setup?", "Going back signs you out. You can sign in again to finish your profile.", [
        { text: "Stay", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => { void doLogout(); } },
      ]);
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onState = (id: number) => { setBoardReq(""); setClassReq(""); setClassPanel(false); setError(""); cat.selectState(id); };
  const onBoard = (id: number) => { setClassReq(""); setClassPanel(false); setError(""); cat.selectBoard(id); };

  const validate = (): boolean => {
    const n = validateName(name);
    const p = phone ? validatePhone(phone) : "";
    const t = accepted ? "" : "Please accept the Terms of Service and Privacy Policy to continue.";
    setNameErr(n); setPhoneErr(p); setTermsErr(t); setError("");
    return !n && !p && !t;
  };

  const run = async (kind: Kind) => {
    if (lock.current || otpBusy) return;
    if (!validate()) return;
    if (kind === "class" && (boardId === null || cat.classId === null)) { setError("Please select your class."); return; }
    if ((kind === "classRequest") && boardId === null) { setError("Please select your board first."); return; }
    lock.current = true; setBusy(kind);
    try {
      const cleanName = name.trim().replace(/\s+/g, " ");
      const phonePayload = phone ? `+91${phone}` : undefined;
      let own = false;
      let data: { name: string; stateId?: number; boardId?: number; classId?: number; phone?: string } = { name: cleanName, phone: phonePayload };
      if (kind === "class") {
        data = { ...data, stateId: stateId ?? undefined, boardId: boardId ?? undefined, classId: cat.classId ?? undefined };
      } else if (kind === "classRequest" || kind === "boardRequest") {
        const payload = kind === "classRequest"
          ? { state_id: stateId, board_id: boardId, board_name: boardName, class_name_requested: classReq.trim() || null }
          : { state_id: stateId, board_id: null, board_name: boardReq.trim() || null, class_name_requested: null };
        const key = JSON.stringify(payload);
        const previous = memo.current.get(key);
        if (previous?.ambiguous) {
          setError("We couldn’t confirm whether your request was sent. To avoid sending it twice, please edit it or continue with your own resources.");
          return;
        }
        if (previous?.id === undefined) {
          try {
            const r = await requestCurriculum(payload);
            memo.current.set(key, { id: r.id });
          } catch (e) {
            if (e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500 && e.statusCode !== 408 && !/could not be confirmed/i.test(e.message)) { setError(mutationErrorMessage(e, "Could not send your request. Please try again.")); }
            else {
              memo.current.set(key, { ambiguous: true });
              setError("We couldn’t confirm whether your request was sent. To avoid sending it twice, please edit it or continue with your own resources.");
            }
            return;
          }
        }
        if (kind === "classRequest") data = { ...data, stateId: stateId ?? undefined, boardId: boardId ?? undefined };
        else { data = { ...data, stateId: stateId ?? undefined }; own = true; }
      } else {
        own = true;
        data = { ...data, stateId: stateId ?? undefined, boardId: boardId ?? undefined };
      }
      const saved = await completeProfile(data, own ? { allowOwnResources: true } : undefined);
      if (!own && !saved.profileComplete) {
        setError("Your profile was saved, but setup could not be confirmed. Please check your curriculum and try again.");
        return;
      }
      router.replace(own ? "/(tabs)/my-docs" : "/(tabs)");
    } catch (e) {
      const msg = mutationErrorMessage(e, "Failed to save profile. Please try again.");
      if (alive.current) {
        setError(msg);
        if (phone && /phone|mobile|number/i.test(msg)) setPhoneErr(msg);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy("");
    }
  };

  const openLegal = async (url: string) => {
    if (!(await openExternal(url))) setError("Could not open the link. Please try again.");
  };
  const legal = (label: string, url: string) => (
    <Text accessibilityRole="link" onPress={(event) => { event.stopPropagation(); void openLegal(url); }} style={st.legalLink}>{label}</Text>
  );
  const toggleTerms = () => { setAccepted((a) => !a); setTermsErr(""); setError(""); };
  const off = busy !== "" || otpBusy;
  const openClassPanel = () => {
    if (!name.trim()) { setNameErr("Please enter your name first."); return; }
    setClassPanel(true);
  };
  const ownReady = name.trim().length > 0 && accepted;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={["#eff6ff", "#ffffff", "#faf5ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={st.pageHeader}>
        <View style={[st.headerInner, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 8 }]}>
          <View style={st.navRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Home" onPress={() => openLegal(legalUrls.home)} style={[st.navBtn, st.navHome]}>
              <Feather name="home" size={16} color={T.g600} /><Text style={[st.navText, { color: T.g600 }]}>Home</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to Login" disabled={off} onPress={doLogout} style={[st.navBtn, st.navBack, off && { opacity: 0.5 }]}>
              <Feather name="arrow-left" size={16} color={T.primary} /><Text style={[st.navText, { color: T.primary }]}>Back to Login</Text>
            </Pressable>
          </View>
          <View style={st.brandRow}>
            <Image source={logo} style={st.brandLogo} resizeMode="contain" accessibilityLabel="EDUwAI logo" />
            <Text style={st.brandName} accessibilityLabel="EDUwAI">EDUw<Text style={{ color: T.orange }}>AI</Text></Text>
          </View>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 40, gap: 20, maxWidth: 560, width: "100%", alignSelf: "center" }}>
          {/* 1. GUIDE */}
          <SetupGuide />

          {/* 2. FORM */}
          <View style={st.form}>
            <LinearGradient colors={[T.ink, T.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.setupHeader}>
              <Feather name="user" size={22} color={T.white} />
              <Text style={st.setupTitle} accessibilityRole="header">Setup Profile</Text>
            </LinearGradient>

            {error ? (
              <View style={st.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Feather name="alert-circle" size={16} color={T.red700} style={{ marginTop: 2 }} />
                <Text style={st.bannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Section 1 */}
            <Divider n={1} />
            <Text style={st.h2}>Your Name</Text>
            <TextInput
              style={[st.input, !!nameErr && { borderColor: T.red400 }]}
              value={name}
              onChangeText={(t) => { setName(t.slice(0, 101)); setNameErr(""); setError(""); }}
              editable={!off}
              placeholder="Enter your full name"
              placeholderTextColor={T.g400}
              autoCapitalize="words"
              autoComplete="name"
              accessibilityLabel="Full name"
            />
            <ErrorLine text={nameErr} />

            <View style={st.rule} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text style={st.h2NoMb}>Mobile Number</Text>
              <View style={st.opt}><Text style={st.optText}>optional</Text></View>
            </View>
            <Text style={st.helper}>Add your Indian mobile number to enable phone OTP login and get it pre-filled during payment.</Text>
            <PhoneField phone={phone} onChange={(d) => { setPhone(d); setPhoneErr(""); setError(""); }} error={phoneErr} disabled={busy !== ""} onBusyChange={setOtpBusy} />
            <View style={st.skipRow}>
              <Text style={[st.skipHint, { flex: 1 }]}>This is optional — you can always add it later.</Text>
              <TextLink label="Skip for now" color={T.g600} disabled={off} onPress={() => { setPhone(""); setPhoneErr(""); }} />
            </View>

            {/* Section 2 */}
            <View style={{ height: 20 }} />
            <Divider n={2} />
            <Text style={st.h2}>Find Your Board</Text>
            {states.status === "loading" ? <LoadingRow text="Loading states..." /> : null}
            {states.status === "error" ? <RetryRow text="Couldn’t load states. Check your connection." onRetry={cat.loadStates} /> : null}
            {states.status === "ready" ? (
              <Picker label="State" items={states.items} selectedId={stateId} onSelect={(i) => onState(i.id)} placeholder="Select State" disabled={off} />
            ) : null}
            {stateId !== null && boards.status === "loading" ? <LoadingRow text="Loading boards..." /> : null}
            {stateId !== null && boards.status === "error" ? <RetryRow text="Couldn’t load boards. Please retry." onRetry={cat.retryBoards} /> : null}
            {stateId !== null && boards.status === "ready" && !noBoards ? (
              <Picker label="Board / University" items={boards.items} selectedId={boardId} onSelect={(i) => onBoard(i.id)} placeholder="Select Board" disabled={off} />
            ) : null}

            {noBoards ? (
              <View style={st.blue}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Feather name="tool" size={18} color={T.blue900} />
                  <Text style={st.blueTitle}>We’re working on this state!</Text>
                </View>
                <Text style={st.blueBody}>We are actively working with board materials in your state and will try to onboard them in the near future. Meanwhile, you can use your own study material.</Text>
                <Text style={st.bluePrompt}>Want us to prioritise your board? Enter the board name below:</Text>
                <TextInput style={st.blueInput} value={boardReq} onChangeText={(t) => setBoardReq(t)} editable={!off}
                  placeholder="e.g. Maharashtra State Board, Osmania University" placeholderTextColor={T.g400} accessibilityLabel="Board name to request" />
                <ActionButton label={boardReq.trim() ? "Submit & Continue with Own Books" : "Continue with Own Books"} busyLabel="Submitting..."
                  busy={busy === "boardRequest"} disabled={off} onPress={() => run("boardRequest")} colors={[T.blue600, T.blue700]} icon="arrow-right" />
              </View>
            ) : null}

            {boardId !== null && classes.status === "loading" ? <LoadingRow text="Loading classes..." /> : null}
            {boardId !== null && classes.status === "error" ? <RetryRow text="Couldn’t load classes. Please retry." onRetry={cat.retryClasses} /> : null}
            {hasClasses || noClasses ? (
              <View style={st.note}>
                <Text style={st.noteText}>{hasClasses
                  ? "Select from available classes. Can't find yours? Use the link below — we'll onboard it soon."
                  : "No classes onboarded for this board yet. Let us know what you need, or proceed with your own books."}</Text>
              </View>
            ) : null}

            {hasClasses ? (
              <View style={{ marginTop: 16 }}>
                <Divider n={3} />
                <Text style={st.h2}>Select Your Class</Text>
                <Picker label="Class" items={classes.items} selectedId={classId} onSelect={(i) => { cat.setClassId(i.id); setClassPanel(false); }} placeholder="Select Class" disabled={off} />
                {classId !== null && !classPanel ? (
                  <View style={{ marginBottom: 12 }}>
                    <ActionButton label="Continue to EDUwAI" busyLabel="Saving..." busy={busy === "class"} disabled={off} onPress={() => run("class")} colors={[T.primary, T.primaryDark]} icon="arrow-right" />
                  </View>
                ) : null}
                {!classPanel ? <TextLink label="Can't find my class" disabled={off} onPress={openClassPanel} /> : null}
              </View>
            ) : null}
            {noClasses && !classPanel ? (
              <View style={{ marginTop: 12 }}>
                <ActionButton label="Can't find my class" disabled={off} onPress={openClassPanel} colors={[T.amber500, T.amber600]} />
              </View>
            ) : null}
            {classPanel && (hasClasses || noClasses) ? (
              <View style={st.amber}>
                <Text style={st.amberText}>We'll prioritise {boardName}. Tell us your class (optional):</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "500", color: T.amber700 }}>Your class</Text>
                  <Text style={{ fontSize: 12, fontStyle: "italic", color: T.amber500 }}>optional</Text>
                </View>
                <TextInput style={st.amberInput} value={classReq} onChangeText={setClassReq} editable={!off}
                  placeholder="e.g. Class 10, BSc 1st Semester" placeholderTextColor={T.g400} accessibilityLabel="Class to request" />
                <ActionButton label="Continue to EDUwAI" busyLabel="Continuing..." busy={busy === "classRequest"} disabled={off} onPress={() => run("classRequest")} colors={[T.amber600, T.amber700]} />
              </View>
            ) : null}

            {/* OR + own resources */}
            <View style={st.orRow}><View style={st.dash} /><View style={st.orCap}><Text style={st.orText}>OR</Text></View><View style={st.dash} /></View>
            <View style={[st.own, !ownReady && { opacity: 0.6 }]}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Feather name="upload" size={24} color={T.green600} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={st.ownT}>Use Your Own Resources</Text>
                  <Text style={st.ownB}>Upload your own textbooks or YouTube videos and start studying right away.</Text>
                  {!name.trim() ? <Text style={st.ownHelp}>Enter your name above to continue.</Text>
                    : !accepted ? <Text style={st.ownHelp}>Agree to the terms below to continue.</Text> : null}
                  <ActionButton label="Proceed to Own Books" busyLabel="Saving..." busy={busy === "own"} disabled={off || !ownReady} onPress={() => run("own")} colors={[T.green600, T.green700]} />
                </View>
              </View>
            </View>

            {/* Terms */}
            <View style={st.terms}>
              <Checkbox checked={accepted} onToggle={toggleTerms} disabled={off}>
                <Pressable onPress={() => { if (!off) toggleTerms(); }} accessible={false} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text style={st.termsText}>I agree to EDUwAI's {legal("Terms of Service", legalUrls.terms)} and {legal("Privacy Policy", legalUrls.privacy)}, including the use of AI to generate answers from textbook content.</Text>
                </Pressable>
              </Checkbox>
            </View>
            <ErrorLine text={termsErr} />

            <View style={st.footer}>
              <Feather name="shield" size={16} color={T.green500} />
              <Text style={st.footerText}>Trusted by 10,000+ students across India</Text>
            </View>
          </View>

          {/* 3. WHATS NEW + TRUST TILES */}
          <WhatsNewPanel />
          <View style={{ alignItems: "center" }}><Wordmark size={18} /></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Divider({ n }: { n: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <View style={st.circle}><Text style={st.circleText}>{n}</Text></View>
      <View style={{ flex: 1, height: 1, backgroundColor: T.g200 }} />
    </View>
  );
}

const st = StyleSheet.create({
  pageHeader: { backgroundColor: T.white, borderBottomWidth: 1, borderBottomColor: T.indigo100 },
  headerInner: { maxWidth: 560, width: "100%", alignSelf: "center", paddingHorizontal: 16, paddingBottom: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  brandLogo: { height: 48, width: 56 },
  brandName: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.ink, flexShrink: 1 },
  form: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16, borderWidth: 1, borderColor: T.g200, padding: 20, ...shadow },
  navRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" },
  navBtn: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 8 },
  navHome: { backgroundColor: T.white, borderWidth: 1, borderColor: T.g200 },
  navBack: { backgroundColor: "rgba(102,126,234,0.1)" },
  navText: { fontSize: 13, fontWeight: "600" },
  setupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 12, marginBottom: 24 },
  setupTitle: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: T.white, flexShrink: 1 },
  banner: { flexDirection: "row", gap: 8, backgroundColor: T.red50, borderColor: T.red200, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  bannerText: { flex: 1, color: T.red700, fontSize: 14, lineHeight: 20 },
  circle: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.primary, alignItems: "center", justifyContent: "center" },
  circleText: { color: T.white, fontSize: 14, fontWeight: "700" },
  h2: { fontSize: 16, fontWeight: "600", color: T.g900, marginBottom: 12 },
  h2NoMb: { fontSize: 16, fontWeight: "600", color: T.g900 },
  input: { minHeight: 48, borderWidth: 1, borderColor: T.g300, backgroundColor: T.g50, borderRadius: 8, paddingHorizontal: 14, fontSize: 15, color: T.g900 },
  rule: { height: 1, backgroundColor: T.g200, marginVertical: 16 },
  opt: { marginLeft: 8, backgroundColor: T.g100, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  optText: { fontSize: 12, color: T.g500 },
  helper: { fontSize: 12, lineHeight: 18, color: T.g500, marginBottom: 12 },
  skipRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 12 },
  skipHint: { fontSize: 12, color: T.g500, lineHeight: 17 },
  blue: { backgroundColor: T.blue50, borderColor: T.blue200, borderWidth: 1, borderRadius: 12, padding: 16 },
  blueTitle: { fontSize: 14, fontWeight: "600", color: T.blue900, flex: 1 },
  blueBody: { fontSize: 13, lineHeight: 20, color: T.blue700, marginBottom: 12 },
  bluePrompt: { fontSize: 13, fontWeight: "500", color: T.blue600, marginBottom: 8, lineHeight: 19 },
  blueInput: { minHeight: 48, backgroundColor: T.white, borderColor: T.blue300, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: T.g900, marginBottom: 12 },
  note: { backgroundColor: T.blue50, borderColor: T.blue200, borderWidth: 1, borderRadius: 8, padding: 12 },
  noteText: { fontSize: 14, lineHeight: 20, color: T.blue800 },
  amber: { backgroundColor: T.amber50, borderColor: T.amber200, borderWidth: 1, borderRadius: 8, padding: 16, marginTop: 12 },
  amberText: { fontSize: 14, lineHeight: 20, color: T.amber800, marginBottom: 12 },
  amberInput: { minHeight: 48, backgroundColor: T.white, borderColor: T.amber300, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: T.g900, marginBottom: 12 },
  orRow: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  dash: { flex: 1, height: 0, borderTopWidth: 2, borderStyle: "dashed", borderColor: T.g200 },
  orCap: { marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: T.g100, borderWidth: 1, borderColor: T.g200, borderRadius: 16 },
  orText: { fontSize: 12, fontWeight: "700", color: T.g500, letterSpacing: 1.2 },
  own: { backgroundColor: "#ecfdf5", borderColor: T.green200, borderWidth: 1, borderRadius: 12, padding: 20 },
  ownT: { fontSize: 15, fontWeight: "600", color: T.g900, marginBottom: 4 },
  ownB: { fontSize: 14, lineHeight: 20, color: T.g600, marginBottom: 16 },
  ownHelp: { fontSize: 12, color: T.g500, marginBottom: 8 },
  terms: { marginTop: 16, backgroundColor: T.indigo50, borderColor: T.indigo200, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingRight: 14, paddingLeft: 4 },
  termsText: { fontSize: 13, lineHeight: 20, color: T.g600 },
  legalLink: { color: T.primary, textDecorationLine: "underline", fontWeight: "500" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: T.g100 },
  footerText: { fontSize: 14, color: T.g500 },
});
