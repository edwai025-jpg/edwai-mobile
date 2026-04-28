import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api, { ApiUser } from "@/services/api";

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
  plan?: string;
  questionsUsed?: number;
  questionsLimit?: number;
  profilePhotoUrl?: string;
  role?: string;
  authProvider?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  profileComplete?: boolean;
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
    profilePhotoUrl: u.profile_photo_url,
    role: u.role,
    authProvider: u.auth_provider,
    phoneVerified: u.phone_verified,
    emailVerified: u.email_verified,
    profileComplete: u.profile_complete,
  };
}

type AuthState = {
  isLoggedIn: boolean;
  isProfileComplete: boolean;
  user: UserProfile | null;
  accessToken: string | null;

  sendPhoneOtp: (phone: string) => Promise<void>;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, otp: string) => Promise<{ profileComplete: boolean }>;
  verifyEmailOtp: (email: string, otp: string) => Promise<{ profileComplete: boolean }>;
  loginWithGoogleToken: (accessToken: string, refreshToken: string, profileComplete: boolean) => Promise<void>;
  completeProfile: (data: {
    name: string;
    stateId?: number;
    boardId: number;
    classId?: number;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEYS = {
  user: "edwai_user_v2",
  accessToken: "edwai_access_token",
  refreshToken: "edwai_refresh_token",
  profileComplete: "edwai_profile_complete",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [userData, tokenData, profileData] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.user),
          AsyncStorage.getItem(STORAGE_KEYS.accessToken),
          AsyncStorage.getItem(STORAGE_KEYS.profileComplete),
        ]);

        if (userData && tokenData) {
          const parsedUser = JSON.parse(userData) as UserProfile;
          const isComplete = profileData === "true" || parsedUser.profileComplete === true;
          setUser(parsedUser);
          setAccessToken(tokenData);
          setIsLoggedIn(true);
          setIsProfileComplete(isComplete);
        }
      } catch {
        // ignore storage errors
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
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userProfile)),
        AsyncStorage.setItem(STORAGE_KEYS.accessToken, aToken),
        AsyncStorage.setItem(STORAGE_KEYS.refreshToken, rToken),
        AsyncStorage.setItem(
          STORAGE_KEYS.profileComplete,
          profileComplete ? "true" : "false"
        ),
      ]);
      setUser(userProfile);
      setAccessToken(aToken);
      setIsLoggedIn(true);
      setIsProfileComplete(profileComplete);
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

  const completeProfile = useCallback(
    async (data: {
      name: string;
      stateId?: number;
      boardId: number;
      classId?: number;
      phone?: string;
    }) => {
      const token = accessToken ?? (await AsyncStorage.getItem(STORAGE_KEYS.accessToken));
      if (!token) throw new Error("Not authenticated");

      const res = await api.auth.saveProfile(token, {
        full_name: data.name,
        state_id: data.stateId ?? null,
        board_id: data.boardId,
        class_id: data.classId ?? null,
        phone: data.phone,
      });

      const updated = apiUserToProfile(res.user);
      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated));
      await AsyncStorage.setItem(STORAGE_KEYS.profileComplete, "true");
      setUser(updated);
      setIsProfileComplete(true);
    },
    [accessToken]
  );

  const updateUser = useCallback(
    async (updates: Partial<UserProfile>) => {
      const updated = { ...user, ...updates } as UserProfile;
      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated));
      setUser(updated);
    },
    [user]
  );

  const refreshUser = useCallback(async () => {
    try {
      const token = accessToken ?? (await AsyncStorage.getItem(STORAGE_KEYS.accessToken));
      if (!token) return;
      const apiUser = await api.auth.getMe(token);
      const fresh = apiUserToProfile(apiUser);
      /* Merge fresh server data on top of current state (preserves locally-cached
         fields like plan/questionsUsed that getMe does not return) */
      setUser((prev) => {
        const merged = { ...prev, ...fresh } as UserProfile;
        AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(merged)).catch(() => {});
        return merged;
      });
    } catch {
      /* silently ignore — stale data stays */
    }
  }, [accessToken]);

  const logout = useCallback(async () => {
    try {
      const token = accessToken ?? (await AsyncStorage.getItem(STORAGE_KEYS.accessToken));
      const rToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
      if (token && rToken) {
        await api.auth.logout(token, rToken);
      }
    } catch {
      // ignore errors during logout API call
    }
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    setUser(null);
    setAccessToken(null);
    setIsLoggedIn(false);
    setIsProfileComplete(false);
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isProfileComplete,
        user,
        accessToken,
        sendPhoneOtp,
        sendEmailOtp,
        verifyPhoneOtp,
        verifyEmailOtp,
        loginWithGoogleToken,
        completeProfile,
        logout,
        updateUser,
        refreshUser,
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
