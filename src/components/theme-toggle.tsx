"use client";

import { useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getThemePref,
  resolveTheme,
  setThemePref,
  subscribeTheme,
  type ThemePref,
} from "@/lib/theme";

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribeTheme, getThemePref, () => "system");
}

export function useResolvedTheme(): "light" | "dark" {
  const pref = useThemePref();
  return useSyncExternalStore(
    subscribeTheme,
    () => resolveTheme(pref),
    () => "light",
  );
}

const ORDER: ThemePref[] = ["system", "light", "dark"];
const LABELS: Record<ThemePref, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const pref = useThemePref();
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const Icon = pref === "light" ? SunIcon : pref === "dark" ? MoonIcon : MonitorIcon;
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="rounded-full"
      aria-label={`${LABELS[pref]}. Switch to ${LABELS[next].toLowerCase()}`}
      title={LABELS[pref]}
      onClick={() => setThemePref(next)}
    >
      <Icon className="size-[18px]" />
    </Button>
  );
}
