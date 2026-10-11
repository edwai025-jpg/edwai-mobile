import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useAuth } from "@/context/auth";
import api from "@/services/api";
import { RecentQuestionsController } from "@/services/recentQuestions";

export function useRecentQuestions(phase: "shared" | "personal", documentId?: number) {
  const { user, accessToken, runAuthenticatedRequest } = useAuth();
  const auth = useRef(runAuthenticatedRequest); auth.current = runAuthenticatedRequest;
  const signedIn = !!accessToken;
  const controller = useMemo(() => {
    const client = phase === "shared" ? api.study : api.phase2;
    return new RecentQuestionsController({
      load: signal => signedIn && documentId !== undefined
        ? auth.current(token => client.getQueryHistory(token, documentId, signal)) : Promise.resolve([]),
      toggle: id => auth.current(token => client.toggleBookmark(token, id)),
    });
  }, [user?.id, signedIn, phase, documentId]);
  useEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  const firstFocus = useRef<RecentQuestionsController | null>(null);
  useFocusEffect(useCallback(() => {
    // Initial mount already loads; later tab visits fetch changes made on web/other devices.
    if (firstFocus.current === controller) void controller.refresh();
    firstFocus.current = controller;
  }, [controller]));
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  return {
    ...state, onToggle: controller.toggle, onRefresh: controller.refresh,
    refreshAfterAnswer: controller.refreshAfterAnswer,
    scopeKey: `${user?.id ?? "none"}:${signedIn}:${phase}:${documentId ?? "none"}`,
  };
}
