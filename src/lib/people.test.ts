import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPerson, createGroup, deleteGroup, deletePerson, DirectoryError, MAX_GROUPS, MAX_PEOPLE, rememberNames, renameGroup, renamePerson, setGroupMember } from "./people";

const memory = new Map<string, string>();

function installStorage() {
  const localStorage = {
    getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
    key: () => null,
    length: 0,
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", {
    localStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

installStorage();

function stored() {
  const raw = memory.get("shuttle-people");
  return raw ? (JSON.parse(raw) as { people: { id: string; name: string }[]; groups: { id: string; name: string; memberIds: string[] }[] }) : null;
}

describe("people directory", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("saves a person and rejects an empty or duplicate name", () => {
    addPerson("  Ana   Lee ");
    expect(stored()?.people.map((person) => person.name)).toEqual(["Ana Lee"]);
    expect(() => addPerson("ana lee")).toThrow(DirectoryError);
    expect(() => addPerson("   ")).toThrow(/empty/);
    expect(stored()?.people).toHaveLength(1);
  });

  it("renames a person and drops them from every group when deleted", () => {
    addPerson("Ana");
    addPerson("Ben");
    createGroup("Friday");
    const directory = stored()!;
    const ana = directory.people[0]!.id;
    const ben = directory.people[1]!.id;
    const friday = directory.groups[0]!.id;
    setGroupMember(friday, ana, true);
    setGroupMember(friday, ben, true);
    renamePerson(ana, "Ananya");
    expect(stored()?.people[0]?.name).toBe("Ananya");
    deletePerson(ana);
    const after = stored()!;
    expect(after.people.map((person) => person.name)).toEqual(["Ben"]);
    expect(after.groups[0]?.memberIds).toEqual([ben]);
  });

  it("keeps people when a group is deleted and ignores a repeated membership toggle", () => {
    addPerson("Ana");
    createGroup("Friday");
    createGroup("Office");
    const directory = stored()!;
    const ana = directory.people[0]!.id;
    const friday = directory.groups[0]!.id;
    setGroupMember(friday, ana, true);
    setGroupMember(friday, ana, true);
    expect(stored()?.groups[0]?.memberIds).toEqual([ana]);
    deleteGroup(friday);
    const after = stored()!;
    expect(after.people).toHaveLength(1);
    expect(after.groups.map((group) => group.name)).toEqual(["Office"]);
  });

  it("rejects a duplicate group name and stops at the caps", () => {
    createGroup("Friday");
    expect(() => createGroup("friday")).toThrow(/already exists/);
    for (let i = 1; i < MAX_GROUPS; i += 1) createGroup(`Group ${i}`);
    expect(() => createGroup("One more")).toThrow(/30 groups/);
    for (let i = 0; i < MAX_PEOPLE; i += 1) addPerson(`Player ${i}`);
    expect(() => addPerson("Extra")).toThrow(/200 people/);
  });

  it("remembers new names without throwing once the list is full", () => {
    addPerson("Ana");
    expect(rememberNames(["Ana", "Ben", "ben"])).toEqual({ added: 1, skippedFull: 0 });
    expect(stored()?.people.map((person) => person.name)).toEqual(["Ana", "Ben"]);
    for (let i = 0; i < MAX_PEOPLE - 2; i += 1) addPerson(`Player ${i}`);
    expect(rememberNames(["New One", "New Two"])).toEqual({ added: 0, skippedFull: 2 });
    expect(stored()?.people).toHaveLength(MAX_PEOPLE);
  });

  it("renames a group without touching its members", () => {
    addPerson("Ana");
    createGroup("Friday");
    const directory = stored()!;
    setGroupMember(directory.groups[0]!.id, directory.people[0]!.id, true);
    renameGroup(directory.groups[0]!.id, "Friday club");
    expect(stored()?.groups[0]).toMatchObject({ name: "Friday club", memberIds: [directory.people[0]!.id] });
  });
});
