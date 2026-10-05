import { useEffect, useRef } from "react";
import { useSegments } from "expo-router";
import { useAuth } from "@/context/auth";
import { clearSupportSession } from "@/hooks/useSupportChat";
import { SupportChatWidget } from "./SupportChatWidget";

export function SupportChatHost() {
  const { isLoggedIn, user } = useAuth();
  const segments = useSegments();
  const identity = isLoggedIn ? `user.${user?.id ?? "missing"}` : "guest";
  const previous = useRef(identity);
  useEffect(() => {
    if (previous.current !== identity) {
      if (previous.current !== "guest") void clearSupportSession(previous.current).catch(() => {});
      previous.current = identity;
    }
  }, [identity]);
  return <SupportChatWidget key={identity} aboveTabs={segments[0] === "(tabs)"} />;
}