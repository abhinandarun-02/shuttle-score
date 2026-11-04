"use client";

import { useSyncExternalStore } from "react";

export interface RecentTournament {
  code: string;
  name: string;
  visitedAt: number;
}

const KEY = "shuttle-recent";
const LIMIT = 8;
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheValue: RecentTournament[] = [];
const EMPTY: RecentTournament[] = [];

function read(): RecentTournament[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cacheRaw) return cacheValue;
    cacheRaw = raw;
    const parsed = raw ? (JSON.parse(raw) as RecentTournament[]) : [];
    cacheValue = Array.isArray(parsed)
      ? parsed.filter((r) => r && typeof r.code === "string" && typeof r.name === "string")
      : [];
  } catch {
    cacheValue = [];
  }
  return cacheValue;
}

function write(list: RecentTournament[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {
    // Storage can be unavailable (private mode); recents are a convenience only.
  }
  listeners.forEach((l) => l());
}

export function rememberTournament(code: string, name: string) {
  const list = read().filter((r) => r.code !== code);
  const existing = read().find((r) => r.code === code);
  if (existing && existing.name === name && read()[0]?.code === code) return;
  write([{ code, name, visitedAt: Date.now() }, ...list]);
}

export function forgetTournament(code: string) {
  write(read().filter((r) => r.code !== code));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useRecentTournaments(): RecentTournament[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
