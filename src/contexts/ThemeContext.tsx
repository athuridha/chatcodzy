"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ThemePreference } from "@/types/user";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
}

const STORAGE_KEY = "chat-codzy-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => undefined,
});

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(theme: ThemePreference): void {
  const dark =
    theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  const resolve = useCallback((pref: ThemePreference): "light" | "dark" => {
    return pref === "dark" || (pref === "system" && systemPrefersDark())
      ? "dark"
      : "light";
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = (stored as ThemePreference | null) ?? "system";
    setThemeState(initial);
    applyTheme(initial);
    setResolvedTheme(resolve(initial));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => {
      if ((stored ?? "system") === "system") {
        applyTheme("system");
        setResolvedTheme(resolve("system"));
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [resolve]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      setResolvedTheme(resolve(next));
    },
    [resolve]
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
