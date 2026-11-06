"use client";

import { useSyncExternalStore } from "react";

/** Matches the tournament player name limit, without pulling in the Firestore module. */
export const MAX_PERSON_NAME = 40;
export const MAX_GROUP_NAME = 40;
export const MAX_PEOPLE = 200;
export const MAX_GROUPS = 30;

export interface Person {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Directory {
  people: Person[];
  groups: Group[];
}

export class DirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectoryError";
  }
}

const KEY = "shuttle-people";
const SERVER_DIRECTORY: Directory = { people: [], groups: [] };
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheValue: Directory = SERVER_DIRECTORY;

export function personKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

function cleanName(name: string, max: number): string {
  return name.replace(/\s+/g, " ").trim().slice(0, max);
}

function createId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDirectory(raw: string | null): Directory {
  if (!raw) return SERVER_DIRECTORY;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!isRecord(data)) return SERVER_DIRECTORY;
    const people = sanitizePeople(data.people);
    const ids = new Set(people.map((person) => person.id));
    return { people, groups: sanitizeGroups(data.groups, ids) };
  } catch {
    return SERVER_DIRECTORY;
  }
}

function sanitizePeople(value: unknown): Person[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const people: Person[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") continue;
    const id = item.id.trim();
    const name = cleanName(item.name, MAX_PERSON_NAME);
    const key = personKey(name);
    if (!id || id.length > 80 || !name || seenIds.has(id) || seenNames.has(key)) continue;
    seenIds.add(id);
    seenNames.add(key);
    people.push({ id, name });
    if (people.length >= MAX_PEOPLE) break;
  }
  return people;
}

function sanitizeGroups(value: unknown, peopleIds: Set<string>): Group[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const groups: Group[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") continue;
    const id = item.id.trim();
    const name = cleanName(item.name, MAX_GROUP_NAME);
    const key = personKey(name);
    if (!id || id.length > 80 || !name || seenIds.has(id) || seenNames.has(key)) continue;
    seenIds.add(id);
    seenNames.add(key);
    const memberIds: string[] = [];
    const seenMembers = new Set<string>();
    if (Array.isArray(item.memberIds)) {
      for (const memberId of item.memberIds) {
        if (typeof memberId !== "string" || !peopleIds.has(memberId) || seenMembers.has(memberId)) continue;
        seenMembers.add(memberId);
        memberIds.push(memberId);
      }
    }
    groups.push({ id, name, memberIds });
    if (groups.length >= MAX_GROUPS) break;
  }
  return groups;
}

function read(): Directory {
  if (typeof window === "undefined") return SERVER_DIRECTORY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cacheValue;
  }
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  cacheValue = parseDirectory(raw);
  return cacheValue;
}

function write(directory: Directory) {
  const raw = JSON.stringify(directory);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    return;
  }
  cacheRaw = raw;
  cacheValue = directory;
  listeners.forEach((listener) => listener());
}

function change(recipe: (directory: Directory) => Directory) {
  const current = read();
  const next = recipe(current);
  if (next !== current) write(next);
}

function requirePersonName(name: string): string {
  const clean = cleanName(name, MAX_PERSON_NAME);
  if (!clean) throw new DirectoryError("Names can't be empty.");
  return clean;
}

function requireGroupName(name: string): string {
  const clean = cleanName(name, MAX_GROUP_NAME);
  if (!clean) throw new DirectoryError("Group names can't be empty.");
  return clean;
}

export function rememberNames(names: readonly string[]): { added: number; skippedFull: number } {
  const current = read();
  const taken = new Set(current.people.map((person) => personKey(person.name)));
  const added: Person[] = [];
  let skippedFull = 0;
  for (const raw of names) {
    const name = cleanName(raw, MAX_PERSON_NAME);
    const key = personKey(name);
    if (!name || taken.has(key)) continue;
    if (current.people.length + added.length >= MAX_PEOPLE) {
      skippedFull += 1;
      continue;
    }
    taken.add(key);
    added.push({ id: createId(), name });
  }
  if (added.length) write({ ...current, people: [...current.people, ...added] });
  return { added: added.length, skippedFull };
}

export function addPerson(name: string) {
  const clean = requirePersonName(name);
  change((directory) => {
    if (directory.people.some((person) => personKey(person.name) === personKey(clean))) {
      throw new DirectoryError("That name is already saved.");
    }
    if (directory.people.length >= MAX_PEOPLE) {
      throw new DirectoryError(`You can save up to ${MAX_PEOPLE} people.`);
    }
    return { ...directory, people: [...directory.people, { id: createId(), name: clean }] };
  });
}

export function renamePerson(id: string, name: string) {
  const clean = requirePersonName(name);
  change((directory) => {
    const person = directory.people.find((item) => item.id === id);
    if (!person) return directory;
    if (person.name === clean) return directory;
    if (directory.people.some((item) => item.id !== id && personKey(item.name) === personKey(clean))) {
      throw new DirectoryError("That name is already saved.");
    }
    return {
      ...directory,
      people: directory.people.map((item) => (item.id === id ? { ...item, name: clean } : item)),
    };
  });
}

export function deletePerson(id: string) {
  change((directory) => {
    if (!directory.people.some((person) => person.id === id)) return directory;
    return {
      people: directory.people.filter((person) => person.id !== id),
      groups: directory.groups.map((group) =>
        group.memberIds.includes(id) ? { ...group, memberIds: group.memberIds.filter((memberId) => memberId !== id) } : group,
      ),
    };
  });
}

export function createGroup(name: string) {
  const clean = requireGroupName(name);
  change((directory) => {
    if (directory.groups.some((group) => personKey(group.name) === personKey(clean))) {
      throw new DirectoryError("That group already exists.");
    }
    if (directory.groups.length >= MAX_GROUPS) {
      throw new DirectoryError(`You can save up to ${MAX_GROUPS} groups.`);
    }
    return { ...directory, groups: [...directory.groups, { id: createId(), name: clean, memberIds: [] }] };
  });
}

export function renameGroup(id: string, name: string) {
  const clean = requireGroupName(name);
  change((directory) => {
    const group = directory.groups.find((item) => item.id === id);
    if (!group) return directory;
    if (group.name === clean) return directory;
    if (directory.groups.some((item) => item.id !== id && personKey(item.name) === personKey(clean))) {
      throw new DirectoryError("That group already exists.");
    }
    return {
      ...directory,
      groups: directory.groups.map((item) => (item.id === id ? { ...item, name: clean } : item)),
    };
  });
}

export function deleteGroup(id: string) {
  change((directory) => {
    if (!directory.groups.some((group) => group.id === id)) return directory;
    return { ...directory, groups: directory.groups.filter((group) => group.id !== id) };
  });
}

export function setGroupMember(groupId: string, personId: string, member: boolean) {
  change((directory) => {
    const group = directory.groups.find((item) => item.id === groupId);
    if (!group || !directory.people.some((person) => person.id === personId)) return directory;
    const has = group.memberIds.includes(personId);
    if (member === has) return directory;
    const memberIds = member ? [...group.memberIds, personId] : group.memberIds.filter((id) => id !== personId);
    return {
      ...directory,
      groups: directory.groups.map((item) => (item.id === groupId ? { ...item, memberIds } : item)),
    };
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDirectory(): Directory {
  return useSyncExternalStore(subscribe, read, () => SERVER_DIRECTORY);
}
