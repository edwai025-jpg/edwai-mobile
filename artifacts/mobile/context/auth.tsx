import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import api, { ApiError, ApiUser } from "@/services/api";
import { credentialStorage } from "@/services/credentialStorage";
import { supportPush } from "@/services/supportPush";
import { supportStorageKey } from "@/services/supportSession";
import { useQueryClient } from "@tanstack/react-query";


export type UserProfile = {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  state?: string;
  stateId?: number;
  board?: string;
  boardId?: number;
  className?: string;
  classId?: number;
  medium?: string;
  mediumId?: number;
  plan?: string;
  questionsUsed?: number;
  questionsLimit?: number;
  profilePhotoUrl?: string | null;
  role?: string;
  orgRole?: string | null;
  orgId?: number | null;
  orgName?: string | null;
  authProvider?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  profileComplete?: boolean;
  isPreRegistered?: boolean;
  termsAcceptedAt?: string | null;
};

export function apiUserToProfile(u: ApiUser): UserProfile {
  return {
    id: u.id,
    name: u.full_name ?? "",
    phone: u.phone,
    email: u.email,
    state: u.state,
    stateId: u.state_id,
    board: u.board,
    boardId: u.board_id,
    className: u.class_name,
    classId: u.class_id,
    medium: u.medium_name,
    mediumId: u.medium_id,
    profilePhotoUrl: u.profile_photo_url,
    role: u.role,
    orgRole: u.org_role,
    orgId: u.org_id,
    orgName: u.org_name,
    authProvider: u.auth_provider,
    phoneVerified: u.phone_verified,
    emailVerified: u.email_verified,
    profileComplete: u.profile_complete,
    ...(u.is_pre_registered !== undefined ? { isPreRegistered: u.is_pre_registered } : {}),
    ...(u.terms_accepted_at !== undefined ? { termsAcceptedAt: u.terms_accepted_at } : {}),
  };
}

type AuthState = {
  isRestored: boolean;
  isLoggedIn: boolean;
  isProfileComplete: boolean;
  canUseOwnResources: boolean;
  user: UserProfile | null;
  accessToken: string | null;
  refreshAccessToken: () => Promise<string>;
  hasPhoto: boolean | null;
  photoRevision: number;

  sendPhoneOtp: (phone: string) => Promise<void>;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, otp: string) => Promise<{ profileComplete: boolean }>;
  verifyEmailOtp: (email: string, otp: string) => Promise<{ profileComplete: boolean }>;
  loginWithGoogleToken: (accessToken: string, refreshToken: string, profileComplete: boolean) => Promise<void>;
  completeProfile: (data: {
    name: string;
    stateId?: number;
    boardId?: number;
    classId?: number;
    phone?: string;
  }, options?: { allowOwnResources?: boolean }) => Promise<UserProfile>;
  verifyProfilePhone: (phone: string, otp: string) => Promise<UserProfile>;
  acceptOrgTerms: () => Promise<UserProfile>;
  requestCurriculum: (data: {
    state_id: number | null; board_id: number | null;
    board_name: string | null; class_name_requested: string | null;
  }) => Promise<{ success: boolean; id: number }>;
  logout: (options?: { localOnly?: boolean }) => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUser: (options?: { throwOnError?: boolean }) => Promise<void>;
  runAuthenticatedRequest: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  setHasPhoto: (v: boolean | null) => void;
  probeHasPhoto: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEYS = {
  user: "edwai_user_v2",
  accessToken: "edwai_access_token",
  refreshToken: "edwai_refresh_token",
  profileComplete: "edwai_profile_complete",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isRestored, setIsRestored] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  // Name-only Own Resources is allowed for this session, not permanent
  // completion. A later sign-in still honors the server's completion flag.
  const [canUseOwnResources, setCanUseOwnResources] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [hasPhoto, setHasPhotoState] = useState<boolean | null>(null);
  const [photoRevision, setPhotoRevision] = useState(0);
  const photoGeneration = useRef(0);
  const setHasPhoto = useCallback((value: boolean | null) => {
    photoGeneration.current++;
    setHasPhotoState(value);
    // Replacements reuse the server's storage key; even true -> true must reload.
    setPhotoRevision(revision => revision + 1);
  }, []);
  const sessionEpoch = useRef(0);
  const refreshInFlight = useRef<Promise<string> | null>(null);

  useEffect(() => {
    (async () => {
      const epoch = sessionEpoch.current;
      try {
        const [userData, tokenData, profileData] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.user),
          credentialStorage.getItem(STORAGE_KEYS.accessToken),
          AsyncStorage.getItem(STORAGE_KEYS.profileComplete),
        ]);

        if (userData && tokenData) {
          const parsedUser = JSON.parse(userData) as UserProfile;
          let restoredUser = parsedUser;
          let restoredToken = tokenData;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12_000);
          try {
            let currentUser: ApiUser;
            try {
              currentUser = await api.auth.getMe(restoredToken, controller.signal);
            } catch (error) {
              if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
              try {
                restoredToken = await refreshAccessToken();
              } catch {
                await logout({ localOnly: true });
                return;
              }
              currentUser = await api.auth.getMe(restoredToken, controller.signal);
            }
            restoredUser = { ...parsedUser, ...apiUserToProfile(currentUser) };
            if (epoch !== sessionEpoch.current) return;
            await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(restoredUser));
          } catch (error) {
            if (error instanceof ApiError && [401, 404].includes(error.statusCode)) {
              await logout({ localOnly: true });
              return;
            }
            // A transport outage doesn't discard a valid cached session.
          } finally {
            clearTimeout(timer);
          }
          if (epoch !== sessionEpoch.current) return;
          const isComplete = typeof restoredUser.profileComplete === "boolean"
            ? restoredUser.profileComplete : profileData === "true";
          setUser(restoredUser);
          setAccessToken(restoredToken);
          setIsLoggedIn(true);
          setIsProfileComplete(isComplete);
          await AsyncStorage.setItem(STORAGE_KEYS.profileComplete, String(isComplete));
          setHasPhoto(!!restoredUser.profilePhotoUrl);
          const generation = photoGeneration.current;
          api.profile.probePhoto(restoredToken).then(value => {
            if (epoch === sessionEpoch.current && generation === photoGeneration.current) setHasPhoto(value);
          }).catch(() => {
            // An unavailable download does not erase the saved photo reference.
          });
        }
      } catch {
        // ignore storage errors
      } finally {
        setIsRestored(true);
      }
    })();
  }, []);

  const storeSession = useCallback(
    async (
      userProfile: UserProfile,
      aToken: string,
      rToken: string,
      profileComplete: boolean
    ) => {
      // Invalidate old push work BEFORE any account credentials are replaced.
      supportPush.suspendIdentity();
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userProfile)),
        credentialStorage.setItem(STORAGE_KEYS.accessToken, aToken),
        credentialStorage.setItem(STORAGE_KEYS.refreshToken, rToken),
        AsyncStorage.setItem(
          STORAGE_KEYS.profileComplete,
          profileComplete ? "true" : "false"
        ),
      ]);
      sessionEpoch.current += 1;
      setUser(userProfile);
      setHasPhoto(null);
      setAccessToken(aToken);
      setIsLoggedIn(true);
      setIsProfileComplete(profileComplete);
      setCanUseOwnResources(false);
    },
    []
  );

  const sendPhoneOtp = useCallback(async (phone: string) => {
    await api.auth.sendPhoneOtp(phone);
  }, []);

  const sendEmailOtp = useCallback(async (email: string) => {
    await api.auth.sendEmailOtp(email);
  }, []);

  const verifyPhoneOtp = useCallback(
    async (phone: string, otp: string) => {
      const res = await api.auth.verifyPhoneOtp(phone, otp);
      const profile = apiUserToProfile(res.user);
      await storeSession(profile, res.access_token, res.refresh_token, res.profile_complete);
      return { profileComplete: res.profile_complete };
    },
    [storeSession]
  );

  const verifyEmailOtp = useCallback(
    async (email: string, otp: string) => {
      const res = await api.auth.verifyEmailOtp(email, otp);
      const profile = apiUserToProfile(res.user);
      await storeSession(profile, res.access_token, res.refresh_token, res.profile_complete);
      return { profileComplete: res.profile_complete };
    },
    [storeSession]
  );

  const loginWithGoogleToken = useCallback(
    async (token: string, refreshToken: string, profileComplete: boolean) => {
      const apiUser = await api.auth.getMe(token);
      const profile = apiUserToProfile(apiUser);
      await storeSession(profile, token, refreshToken, profileComplete);
    },
    [storeSession]
  );

  const updateUser = useCallback(
    async (updates: Partial<UserProfile>) => {
      const epoch = sessionEpoch.current;
      const accountId = user?.id;
      if (!accountId || (updates.id !== undefined && updates.id !== accountId)) throw new Error("Your account changed. Please sign in again.");
      const updated = { ...user, ...updates } as UserProfile;
      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated));
      if (epoch !== sessionEpoch.current) throw new Error("Your session changed.");
      // Preserve concurrent, unrelated cached fields (e.g. usage); never apply
      // a late photo/profile response to a different signed-in account.
      setUser(previous => previous?.id === accountId ? { ...previous, ...updates } : previous);
      if (typeof updates.profileComplete === "boolean") {
        await AsyncStorage.setItem(STORAGE_KEYS.profileComplete, String(updates.profileComplete));
        if (epoch !== sessionEpoch.current) throw new Error("Your session changed.");
        setIsProfileComplete(updates.profileComplete);
      }
    },
    [user]
  );

  const refreshUser = useCallback(async (options?: { throwOnError?: boolean }) => {
    const epoch = sessionEpoch.current;
    try {
      const token = accessToken ?? (await credentialStorage.getItem(STORAGE_KEYS.accessToken));
      if (!token) {
        if (options?.throwOnError) throw new Error("Please sign in again.");
        return;
      }
      const apiUser = await api.auth.getMe(token);
      if (epoch !== sessionEpoch.current) return;
      const fresh = apiUserToProfile(apiUser);
      setIsProfileComplete(fresh.profileComplete === true);
      await AsyncStorage.setItem(STORAGE_KEYS.profileComplete, String(fresh.profileComplete === true));
      /* Merge fresh server data on top of current state (preserves locally-cached
         fields like plan/questionsUsed that getMe does not return) */
      setUser((prev) => {
        const merged = { ...prev, ...fresh } as UserProfile;
        AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(merged)).catch(() => {});
        return merged;
      });
    } catch (e) {
      if (options?.throwOnError) throw e;
      /* silently ignore — stale data stays */
    }
  }, [accessToken]);

  const logout = useCallback(async (options?: { localOnly?: boolean }) => {
    supportPush.suspendIdentity();
    sessionEpoch.current += 1;
    const token = accessToken ?? (await credentialStorage.getItem(STORAGE_KEYS.accessToken));
    const rToken = await credentialStorage.getItem(STORAGE_KEYS.refreshToken);
    await queryClient.cancelQueries();
    queryClient.clear();
    await AsyncStorage.multiRemove([...Object.values(STORAGE_KEYS), "@edwai/p1_selection"]);
    await Promise.all([
      credentialStorage.removeItem(STORAGE_KEYS.accessToken),
      credentialStorage.removeItem(STORAGE_KEYS.refreshToken),
      ...(user?.id !== undefined ? [credentialStorage.removeItem(supportStorageKey(`user.${user.id}`))] : []),
    ]);
    setUser(null);
    setAccessToken(null);
    setIsLoggedIn(false);
    setIsProfileComplete(false);
    setCanUseOwnResources(false);
    setHasPhoto(null);
    // Capture credentials before clearing them, but don't delay local exit on
    // a remote outage. We make no claim that revocation succeeded on failure.
    if (!options?.localOnly && token && rToken) {
      void api.auth.logout(token, rToken).catch(() => {});
    }
  }, [accessToken, queryClient, user?.id]);

  const refreshAccessToken = useCallback((): Promise<string> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const epoch = sessionEpoch.current;
    const promise = (async () => {
      const refresh = await credentialStorage.getItem(STORAGE_KEYS.refreshToken);
      if (!refresh) throw new Error("Please sign in again.");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      let result: Awaited<ReturnType<typeof api.auth.refreshToken>>;
      try {
        result = await api.auth.refreshToken(refresh, controller.signal);
      } finally {
        clearTimeout(timer);
      }
      if (sessionEpoch.current !== epoch) throw new Error("Session changed.");
      await credentialStorage.setItem(STORAGE_KEYS.accessToken, result.access_token);
      if (sessionEpoch.current !== epoch) {
        await credentialStorage.removeItem(STORAGE_KEYS.accessToken);
        throw new Error("Session changed.");
      }
      setAccessToken(result.access_token);
      return result.access_token;
    })();
    refreshInFlight.current = promise;
    promise.finally(() => {
      if (refreshInFlight.current === promise) refreshInFlight.current = null;
    }).catch(() => {});
    return promise;
  }, []);

  const runProfileRequest = useCallback(async <T,>(operation: (token: string) => Promise<T>) => {
    const epoch = sessionEpoch.current;
    const token = accessToken ?? (await credentialStorage.getItem(STORAGE_KEYS.accessToken));
    if (!token) throw new Error("Please sign in again.");
    let result: T;
    try {
      result = await operation(token);
    } catch (error) {
      // A rejected 401 has not committed the write. Share one refresh and replay
      // once; never automatically replay an ambiguous timeout/network failure.
      if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
      let refreshedToken: string;
      try {
        refreshedToken = await refreshAccessToken();
      } catch (refreshError) {
        await logout({ localOnly: true });
        throw refreshError;
      }
      try {
        result = await operation(refreshedToken);
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.statusCode === 401) {
          await logout({ localOnly: true });
        }
        throw retryError;
      }
    }
    if (epoch !== sessionEpoch.current) throw new Error("Session changed. Please sign in again.");
    return result;
  }, [accessToken, refreshAccessToken, logout]);

  const probeHasPhoto = useCallback(async () => {
    const epoch = sessionEpoch.current, generation = photoGeneration.current;
    try {
      const result = await runProfileRequest(token => api.profile.probePhoto(token));
      if (epoch === sessionEpoch.current && generation === photoGeneration.current) setHasPhoto(result);
    } catch {
      // A network/auth failure does not mean the server removed the reference.
    }
  }, [runProfileRequest, setHasPhoto]);

  const applyServerUser = useCallback(async (apiUser: ApiUser, epoch: number) => {
    if (epoch !== sessionEpoch.current) throw new Error("Session changed. Please sign in again.");
    const updated = apiUserToProfile(apiUser);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated)),
      AsyncStorage.setItem(STORAGE_KEYS.profileComplete, String(updated.profileComplete === true)),
    ]);
    if (epoch !== sessionEpoch.current) throw new Error("Session changed. Please sign in again.");
    setUser(updated);
    setIsProfileComplete(updated.profileComplete === true);
    return updated;
  }, []);

  const completeProfile = useCallback(async (
    data: { name: string; stateId?: number; boardId?: number; classId?: number; phone?: string },
    options?: { allowOwnResources?: boolean },
  ) => {
    const epoch = sessionEpoch.current;
    const res = await runProfileRequest(token => api.auth.saveProfile(token, {
      full_name: data.name.trim(),
      ...(data.stateId !== undefined ? { state_id: data.stateId } : {}),
      ...(data.boardId !== undefined ? { board_id: data.boardId } : {}),
      ...(data.classId !== undefined ? { class_id: data.classId } : {}),
      ...(data.phone ? { phone: data.phone } : {}),
    }));
    if (!res.success) throw new Error("Failed to save profile.");
    const updated = await applyServerUser({ ...res.user, profile_complete: res.profile_complete }, epoch);
    if (options?.allowOwnResources && !(
      updated.isPreRegistered && !updated.termsAcceptedAt
    )) setCanUseOwnResources(true);
    void queryClient.invalidateQueries();
    return updated;
  }, [runProfileRequest, applyServerUser, queryClient]);

  const verifyProfilePhone = useCallback(async (phone: string, otp: string) => {
    const epoch = sessionEpoch.current;
    const res = await runProfileRequest(token => api.auth.verifyPhoneForProfile(token, phone, otp));
    if (!res.success || !res.user?.phone_verified || res.user.phone !== phone) {
      throw new Error("Phone verification could not be confirmed. Please try again.");
    }
    return applyServerUser(res.user, epoch);
  }, [runProfileRequest, applyServerUser]);

  const acceptOrgTerms = useCallback(async () => {
    const epoch = sessionEpoch.current;
    const res = await runProfileRequest(token => api.auth.saveProfile(token, { terms_accepted: true }));
    if (!res.success || !res.user?.terms_accepted_at || !res.profile_complete) {
      throw new Error("Terms acceptance could not be confirmed. Please try again.");
    }
    const updated = await applyServerUser({ ...res.user, profile_complete: res.profile_complete }, epoch);
    void queryClient.invalidateQueries();
    return updated;
  }, [runProfileRequest, applyServerUser, queryClient]);

  const requestCurriculum = useCallback(async (data: {
    state_id: number | null; board_id: number | null;
    board_name: string | null; class_name_requested: string | null;
  }) => {
    const response = await runProfileRequest(token => api.onboarding.requestCurriculum(token, data));
    if (!response.success || !Number.isInteger(response.id) || response.id <= 0) {
      throw new Error("The request result could not be confirmed. Use Own Resources instead of submitting it again.");
    }
    return response;
  }, [runProfileRequest]);

  return (
    <AuthContext.Provider
      value={{
        isRestored,
        isLoggedIn,
        isProfileComplete,
        canUseOwnResources,
        user,
        accessToken,
        refreshAccessToken,
        hasPhoto,
        photoRevision,
        sendPhoneOtp,
        sendEmailOtp,
        verifyPhoneOtp,
        verifyEmailOtp,
        loginWithGoogleToken,
        completeProfile,
        verifyProfilePhone,
        acceptOrgTerms,
        requestCurriculum,
        logout,
        updateUser,
        refreshUser,
        runAuthenticatedRequest: runProfileRequest,
        setHasPhoto,
        probeHasPhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
