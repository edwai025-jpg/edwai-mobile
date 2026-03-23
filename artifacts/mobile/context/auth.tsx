import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type UserProfile = {
  name: string;
  phone?: string;
  email?: string;
  state?: string;
  board?: string;
  className?: string;
  medium?: string;
  plan?: string;
  questionsUsed?: number;
  questionsLimit?: number;
};

type AuthState = {
  isLoggedIn: boolean;
  isProfileComplete: boolean;
  user: UserProfile | null;
  login: (user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  completeProfile: (profile: Partial<UserProfile>) => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const AUTH_KEY = "edwai_auth";
const PROFILE_KEY = "edwai_profile";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const authData = await AsyncStorage.getItem(AUTH_KEY);
        const profileData = await AsyncStorage.getItem(PROFILE_KEY);
        if (authData) {
          const parsed = JSON.parse(authData) as UserProfile;
          setUser(parsed);
          setIsLoggedIn(true);
        }
        if (profileData) {
          const parsed = JSON.parse(profileData) as { complete: boolean };
          setIsProfileComplete(parsed.complete);
        }
      } catch {
      }
    })();
  }, []);

  const login = useCallback(async (userData: UserProfile) => {
    const full: UserProfile = {
      plan: "Reader Model",
      questionsUsed: 5,
      questionsLimit: 1500,
      ...userData,
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(full));
    setUser(full);
    setIsLoggedIn(true);
  }, []);

  const completeProfile = useCallback(
    async (profile: Partial<UserProfile>) => {
      const updated = { ...user, ...profile } as UserProfile;
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updated));
      await AsyncStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ complete: true })
      );
      setUser(updated);
      setIsProfileComplete(true);
    },
    [user]
  );

  const updateUser = useCallback(
    async (updates: Partial<UserProfile>) => {
      const updated = { ...user, ...updates } as UserProfile;
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updated));
      setUser(updated);
    },
    [user]
  );

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    await AsyncStorage.removeItem(PROFILE_KEY);
    setUser(null);
    setIsLoggedIn(false);
    setIsProfileComplete(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isProfileComplete,
        user,
        login,
        logout,
        completeProfile,
        updateUser,
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
