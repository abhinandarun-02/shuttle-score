export type ThemePref = "light" | "dark" | "system";

const KEY = "shuttle-theme";
const listeners = new Set<() => void>();

export const THEME_COLORS = { light: "#f8f9f5", dark: "#0b0f0c" } as const;

/** Runs before first paint (inlined into <head>) so the correct theme is applied without a flash. */
export const themeBootScript = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${THEME_COLORS.dark}":"${THEME_COLORS.light}")}catch(e){}})()`;

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(pref: ThemePref = getThemePref()) {
  const resolved = resolveTheme(pref);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolved]);
}

export function setThemePref(pref: ThemePref) {
  if (pref === "system") window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, pref);
  applyTheme(pref);
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (getThemePref() === "system") applyTheme("system");
    listener();
  };
  media.addEventListener("change", onMedia);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMedia);
  };
}
