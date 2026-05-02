import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeMode = "primary" | "secondary";

interface ThemeCtx {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: "primary",
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("primary");

  useEffect(() => {
    AsyncStorage.getItem("theme-storage")
      .then((v) => { if (v === "secondary") setMode("secondary"); })
      .catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "primary" ? "secondary" : "primary";
      AsyncStorage.setItem("theme-storage", next).catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, isDark: mode === "primary", toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
