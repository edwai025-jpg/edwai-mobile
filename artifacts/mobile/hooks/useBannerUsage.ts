import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "@/context/auth";
import api, { type UsageInfo } from "@/services/api";

/** Refresh on return from Profile/upgrade and on completed answers, not a local counter. */
export function useBannerUsage() {
  const { accessToken, refreshUser, probeHasPhoto } = useAuth();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const request = useRef(0);
  const currentToken = useRef(accessToken);
  currentToken.current = accessToken;

  useEffect(() => {
    request.current++;
    setUsage(null);
    setUsageLoading(!!accessToken);
    return () => { request.current++; };
  }, [accessToken]);

  const refreshUsage = useCallback(async () => {
    if (!accessToken || currentToken.current !== accessToken) return;
    const version = ++request.current;
    const valid = () => version === request.current && currentToken.current === accessToken;
    setUsageLoading(true);
    try {
      const fresh = await api.study.getUsage(accessToken);
      if (valid()) setUsage(fresh);
    } catch {
      if (valid()) setUsage(null);
    } finally {
      if (valid()) setUsageLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(useCallback(() => {
    const refresh = () => {
      void refreshUsage();
      void refreshUser();
      void probeHasPhoto();
    };
    refresh();
    const resume = AppState.addEventListener("change", state => {
      if (state === "active") refresh();
    });
    if (Platform.OS === "web") window.addEventListener("focus", refresh);
    return () => {
      request.current++;
      resume.remove();
      if (Platform.OS === "web") window.removeEventListener("focus", refresh);
    };
  }, [refreshUsage, refreshUser, probeHasPhoto]));

  return { usage, usageLoading, refreshUsage };
}
