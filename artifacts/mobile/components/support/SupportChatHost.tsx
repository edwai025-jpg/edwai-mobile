import { useEffect, useRef } from "react";
import { useSegments } from "expo-router";
import { useAuth } from "@/context/auth";
import { clearSupportSession } from "@/hooks/useSupportChat";
import { SupportChatWidget } from "./SupportChatWidget";
import { supportPush } from "@/services/supportPush";
import type { SupportOwner } from "@/services/supportApi";

export function SupportChatHost() {
  const auth = useAuth();
  const { isLoggedIn, user, isRestored } = auth;
  const authRef = useRef(auth);
  authRef.current = auth;
  const segments = useSegments();
  const identity = isLoggedIn ? `user.${user?.id ?? "missing"}` : "guest";
  const previous = useRef(identity);
  useEffect(() => {
    if (!isRestored) return;
    const accountId = user?.id;
    const stillCurrent = () => authRef.current.isLoggedIn && authRef.current.user?.id === accountId;
    const owner: SupportOwner = isLoggedIn ? {
      kind: "authenticated",
      getToken: () => stillCurrent() ? authRef.current.accessToken : null,
      refreshToken: async () => {
        if (!stillCurrent()) throw new Error("Session changed.");
        const token = await authRef.current.refreshAccessToken();
        if (!stillCurrent()) throw new Error("Session changed.");
        return token;
      },
    } : { kind: "guest" };
    void supportPush.setIdentity(identity, owner);
  }, [identity, isLoggedIn, isRestored, user?.id, auth.accessToken]);
  useEffect(() => {
    if (previous.current !== identity) {
      // Guest-to-account transitions also discard the prior selected thread.
      void clearSupportSession(previous.current).catch(() => {});
      previous.current = identity;
    }
  }, [identity]);
  return <SupportChatWidget key={identity} aboveTabs={segments[0] === "(tabs)"} />;
}