"use client";

import { useCallback, useEffect, useRef } from "react";
import { Monitor, MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "./theme-provider";

type ThemePreference = "light" | "dark" | "system";

const THEME_CYCLE: ThemePreference[] = ["light", "dark", "system"];

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Terang",
  dark: "Gelap",
  system: "Sistem",
};

const THEME_ICONS = {
  light: SunMedium,
  dark: MoonStar,
  system: Monitor,
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const persistTheme = useCallback((nextTheme: ThemePreference) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    abortRef.current?.abort();

    persistTimerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      void fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme }),
        signal: controller.signal,
      }).catch(() => undefined);
    }, 300);
  }, []);

  function cycleTheme() {
    const currentIndex = THEME_CYCLE.indexOf(theme);
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];

    setTheme(nextTheme);
    window.dispatchEvent(new CustomEvent("skyhub:settings-preview", { detail: { theme: nextTheme } }));
    persistTheme(nextTheme);
  }

  const Icon = THEME_ICONS[theme];

  return (
    <button
      type="button"
      className="topbar-button shrink-0"
      onClick={cycleTheme}
      aria-label={`Mode tampilan: ${THEME_LABELS[theme]}. Klik untuk ganti.`}
      title={`Mode tampilan: ${THEME_LABELS[theme]}`}
    >
      <Icon size={18} />
      <span className="hidden sm:inline">{THEME_LABELS[theme]}</span>
    </button>
  );
}