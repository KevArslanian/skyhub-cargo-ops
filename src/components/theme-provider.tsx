"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function runThemeTransition() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const root = document.documentElement;
  root.classList.remove("theme-transitioning");
  window.requestAnimationFrame(() => {
    root.classList.add("theme-transitioning");
    window.setTimeout(() => root.classList.remove("theme-transitioning"), 520);
  });
}

function resolveTheme(theme: ThemePreference) {
  if (typeof window === "undefined") return "light";
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;

  const resolvedTheme = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";

    const storedTheme = window.localStorage.getItem("theme");
    return storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
  });

  useEffect(() => {
    applyTheme(theme);

    const query = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      if (theme !== "system") return;
      runThemeTransition();
      applyTheme("system");
    }

    query.addEventListener("change", handleSystemThemeChange);
    return () => query.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme(nextTheme) {
        window.localStorage.setItem("theme", nextTheme);
        runThemeTransition();
        applyTheme(nextTheme);
        setThemeState(nextTheme);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    return {
      theme: "system" as const,
      setTheme: () => undefined,
    };
  }

  return context;
}

export { runThemeTransition, useTheme };
