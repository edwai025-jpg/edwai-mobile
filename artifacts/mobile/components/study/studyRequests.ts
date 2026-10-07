import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/context/auth";
import { withStudyAuth } from "@/services/studyResources";

export type StudyRun = <T>(
  fn: (token: string, signal: AbortSignal) => Promise<T>,
  controller?: AbortController,
) => Promise<T>;

/** Runs authenticated requests; all are aborted on unmount. */
export function useStudyRequests(accessToken: string) {
  const { refreshAccessToken } = useAuth();
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const refreshRef = useRef(refreshAccessToken);
  refreshRef.current = refreshAccessToken;
  const controllers = useRef(new Set<AbortController>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const set = controllers.current;
    return () => {
      mounted.current = false;
      set.forEach((c) => c.abort());
      set.clear();
    };
  }, []);

  const run: StudyRun = useCallback(async (fn, controller) => {
    const c = controller ?? new AbortController();
    controllers.current.add(c);
    try {
      return await withStudyAuth(tokenRef.current, () => refreshRef.current(), (t) => fn(t, c.signal));
    } finally {
      controllers.current.delete(c);
    }
  }, []);

  return { run, mounted };
}

export function errMsg(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  return m && m.length < 160 ? m : fallback;
}
