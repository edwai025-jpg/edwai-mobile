import { useEffect, useRef, useState } from "react";
import { apiUserToProfile, useAuth } from "@/context/auth";
import api, { ApiError, ApiUser } from "@/services/api";
import { normalizePhoneInput } from "@/services/onboarding";
import { validateAccountEmail, validateAccountPassword, validateName, validatePhone } from "@/services/accountDetails";
import type { AlertButton } from "react-native";

type Channel = "email" | "phone";
type CodeState = { sentTo: string | null; code: string; error: string; success: string };
const emptyCode = (): CodeState => ({ sentTo: null, code: "", error: "", success: "" });

export function useAccountDetails(
  visible: boolean,
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void,
  showToast: (type: "ok" | "err", message: string) => void,
) {
  const { user, updateUser, runAuthenticatedRequest } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [codes, setCodes] = useState<Record<Channel, CodeState>>({ email: emptyCode(), phone: emptyCode() });
  const [busy, setBusy] = useState(false);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const locked = useRef(false);
  const latest = useRef({ user, visible, name, email, phone, codes, password, confirmation });
  latest.current = { user, visible, name, email, phone, codes, password, confirmation };
  const epoch = useRef(0);

  useEffect(() => {
    epoch.current++;
    if (!visible) { setPassword(""); setConfirmation(""); return; }
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPhone(normalizePhoneInput(user?.phone ?? ""));
    setPassword(""); setConfirmation("");
    setCodes({ email: emptyCode(), phone: emptyCode() });
    setNeedsReconcile(false);
  }, [visible, user?.id]);

  const patchCode = (channel: Channel, patch: Partial<CodeState>) =>
    setCodes(previous => ({ ...previous, [channel]: { ...previous[channel], ...patch } }));
  const target = (channel: Channel) => channel === "email" ? latest.current.email.trim()
    : latest.current.phone ? `+91${latest.current.phone}` : "";
  const saved = (channel: Channel) => latest.current.user?.[channel] ?? "";
  const fieldError = (channel: Channel) => channel === "email"
    ? validateAccountEmail(latest.current.email) : validatePhone(latest.current.phone);
  const verified = (channel: Channel) => target(channel) === saved(channel)
    && !!(channel === "email" ? user?.emailVerified : user?.phoneVerified);
  const pendingContacts = !!email.trim() && email.trim() !== (user?.email ?? "")
    || !!phone && `+91${phone}` !== (user?.phone ?? "");
  const errorMessage = (error: unknown, fallback: string) =>
    `${error instanceof Error ? error.message : fallback}\nPlease contact the EDUwAI team through in-app chat or the “Contact Us” section on the home page for help.`;
  const ambiguous = (error: unknown) => !(error instanceof ApiError)
    || error.statusCode >= 500 || error.statusCode < 400;

  async function adopt(server: ApiUser, accountId: number | undefined) {
    if (!server || server.id !== accountId || latest.current.user?.id !== accountId) {
      throw new Error("The account changed. Please reopen Account details.");
    }
    await updateUser(apiUserToProfile(server));
    return server;
  }
  async function reconcile(accountId: number | undefined) {
    return adopt(await runAuthenticatedRequest(token => api.auth.getMe(token)), accountId);
  }
  async function run(operation: () => Promise<void>) {
    if (locked.current || !latest.current.user || !latest.current.visible) return;
    locked.current = true; setBusy(true);
    try { await operation(); } finally { locked.current = false; setBusy(false); }
  }
  async function send(channel: Channel) {
    const currentTarget = target(channel);
    const validation = fieldError(channel);
    if (!currentTarget || validation) {
      patchCode(channel, { error: validation || "Enter a contact first." }); return;
    }
    const requestEpoch = epoch.current;
    // A failed resend can invalidate the previous code on the server.
    patchCode(channel, { sentTo: null, code: "", error: "", success: "" });
    try {
      const response = await runAuthenticatedRequest(token => channel === "email"
        ? api.profile.sendEmailOtp(token, currentTarget)
        : api.profile.sendPhoneOtp(token, currentTarget));
      if (response.sent !== true) throw new Error("OTP delivery was not confirmed.");
      if (requestEpoch === epoch.current && target(channel) === currentTarget) {
        patchCode(channel, { sentTo: currentTarget });
      }
    } catch (error) {
      if (requestEpoch === epoch.current) patchCode(channel, { error: errorMessage(error, "Could not send OTP.") });
    }
  }
  async function verifyNow(channel: Channel, currentTarget: string, code: string, requestEpoch: number) {
    if (requestEpoch !== epoch.current || target(channel) !== currentTarget) return;
    await run(async () => {
      const accountId = latest.current.user?.id;
      patchCode(channel, { error: "", success: "" });
      try {
        const result = await runAuthenticatedRequest(token => channel === "email"
          ? api.profile.verifyEmailOtp(token, currentTarget, code)
          : api.profile.verifyPhoneOtp(token, currentTarget, code));
        const resultUser = result?.user;
        if (result?.success !== true || resultUser?.[channel] !== currentTarget
          || !(channel === "email" ? resultUser.email_verified : resultUser.phone_verified)) {
          throw new Error("Contact verification was not confirmed.");
        }
        await adopt(resultUser, accountId);
        if (requestEpoch === epoch.current) patchCode(channel, {
          sentTo: null, code: "", success: `${channel === "email" ? "Email address" : "Phone number"} verified and saved to your existing account.`,
        });
      } catch (error) {
        if (ambiguous(error)) {
          try {
            const server = await reconcile(accountId);
            if (server[channel] === currentTarget && (channel === "email" ? server.email_verified : server.phone_verified)) {
              if (requestEpoch === epoch.current) patchCode(channel, {
                sentTo: null, code: "", error: "", success: "Verification confirmed from your saved profile.",
              });
              return;
            }
          } catch {
            if (requestEpoch === epoch.current) setNeedsReconcile(true);
          }
        }
        if (requestEpoch === epoch.current) patchCode(channel, { error: errorMessage(error, "Invalid or expired OTP.") });
      }
    });
  }
  function verify(channel: Channel) {
    if (locked.current || needsReconcile) return;
    const currentTarget = target(channel), state = latest.current.codes[channel];
    if (fieldError(channel) || state.sentTo !== currentTarget || !/^\d{6}$/.test(state.code)) {
      patchCode(channel, { error: "Send an OTP to this contact and enter its 6-digit code." }); return;
    }
    const requestEpoch = epoch.current;
    const action = () => { void verifyNow(channel, currentTarget, state.code, requestEpoch); };
    if (currentTarget === saved(channel)) { action(); return; }
    showAlert("Confirm login detail change",
      `This changes the contact linked to your existing account.\n\nPrevious: ${saved(channel) || "Not set"}\nNew: ${currentTarget}\n\nThe old contact will no longer work for ${channel} OTP login. Other linked sign-in methods remain available. Your questions, history, and usage stay with your account.\n\nReplacement happens only after the new OTP verifies.`,
      [{ text: "Cancel", style: "cancel" }, { text: `Verify and change ${channel}`, onPress: action }]);
  }
  async function saveNow(removePhone: boolean, requestEpoch: number) {
    if (requestEpoch !== epoch.current) return;
    await run(async () => {
      const draft = latest.current, accountId = draft.user?.id;
      const data = {
        full_name: draft.name.trim().replace(/\s+/g, " "),
        ...(removePhone ? { phone: "" } : {}),
        ...(draft.password ? { password: draft.password } : {}),
      };
      let committed = false;
      try {
        const result = await runAuthenticatedRequest(token => api.profile.saveAccount(token, data));
        if (result?.success !== true) throw new Error("Account update was not confirmed.");
        committed = true;
        const server = await reconcile(accountId);
        if (requestEpoch === epoch.current) {
          setName(server.full_name ?? "");
          if (removePhone) { setPhone(""); patchCode("phone", emptyCode()); }
          setPassword(""); setConfirmation(""); setNeedsReconcile(false);
          showToast("ok", draft.password ? "Account details and password updated. Login remains OTP-based." : "Account details saved.");
        }
      } catch (error) {
        if (requestEpoch !== epoch.current) return;
        if (committed) {
          // Never replay a successful password/removal write because GET failed.
          setPassword(""); setConfirmation(""); setNeedsReconcile(true);
          showToast("err", "Account update succeeded, but the saved profile could not be refreshed. Check saved details before continuing.");
        } else if (ambiguous(error)) {
          try {
            await reconcile(accountId);
            showToast("err", "The update response was lost. Saved profile refreshed; password changes cannot be checked here. Review before deliberately saving again.");
          } catch {
            setNeedsReconcile(true);
            showToast("err", "Update outcome is unknown. Check saved details before retrying; it may already have saved.");
          }
          setPassword(""); setConfirmation("");
        } else showToast("err", errorMessage(error, "Could not save account details."));
      }
    });
  }
  function save() {
    if (locked.current || needsReconcile) return;
    const validation = validateName(name) || validateAccountPassword(password, confirmation)
      || (email.trim() ? validateAccountEmail(email) : user?.email ? "An existing email cannot be removed here." : "")
      || validatePhone(phone);
    if (validation) { showToast("err", validation); return; }
    if (pendingContacts) {
      const requestEpoch = epoch.current;
      void run(async () => {
        for (const channel of ["email", "phone"] as Channel[]) {
          if (requestEpoch !== epoch.current) return;
          if (target(channel) && target(channel) !== saved(channel)
            && latest.current.codes[channel].sentTo !== target(channel)) await send(channel);
        }
      });
      return;
    }
    const requestEpoch = epoch.current;
    if (!phone && user?.phone) {
      showAlert("Confirm login detail change",
        `Previous phone: ${user.phone}\nNew: Removed\n\nYou must retain a verified email or linked Google sign-in. Your questions, history, and usage stay with the account.`,
        [{ text: "Cancel", style: "cancel" }, { text: "Confirm change", onPress: () => { void saveNow(true, requestEpoch); } }]);
    } else void saveNow(false, requestEpoch);
  }

  return {
    name, setName, email, phone, password, setPassword, confirmation, setConfirmation,
    codes, busy, needsReconcile, pendingContacts, save, verify,
    emailVerified: verified("email"), phoneVerified: verified("phone"),
    emailError: email.trim() ? validateAccountEmail(email) : user?.email ? "An existing email cannot be removed here." : "",
    phoneError: validatePhone(phone),
    changeEmail: (value: string) => { setEmail(value); patchCode("email", emptyCode()); },
    changePhone: (value: string) => { setPhone(normalizePhoneInput(value)); patchCode("phone", emptyCode()); },
    changeCode: (channel: Channel, value: string) => patchCode(channel, { code: value.replace(/\D/g, "").slice(0, 6), error: "" }),
    send: (channel: Channel) => { if (!needsReconcile) void run(() => send(channel)); },
    cancelEmail: () => { setEmail(user?.email ?? ""); patchCode("email", emptyCode()); },
    checkSavedDetails: () => { void run(async () => {
      try { await reconcile(latest.current.user?.id); setNeedsReconcile(false); showToast("ok", "Saved profile refreshed. Review your drafts before saving."); }
      catch (error) { showToast("err", errorMessage(error, "Could not refresh saved details.")); }
    }); },
  };
}
