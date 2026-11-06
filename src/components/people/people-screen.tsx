"use client";

import { ArrowLeftIcon, CheckIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  addPerson,
  createGroup,
  deleteGroup,
  deletePerson,
  DirectoryError,
  MAX_GROUP_NAME,
  MAX_PERSON_NAME,
  renameGroup,
  renamePerson,
  setGroupMember,
  useDirectory,
  type Group,
  type Person,
} from "@/lib/people";
import { cn } from "@/lib/utils";

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function message(err: unknown, fallback: string) {
  return err instanceof DirectoryError ? err.message : fallback;
}

export function PeopleScreen() {
  const directory = useDirectory();
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [personName, setPersonName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [rename, setRename] = useState<{ kind: "person" | "group"; id: string; name: string } | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const people = directory.people.toSorted(byName);
  const openGroup = directory.groups.find((group) => group.id === openGroupId) ?? null;

  const onAddPerson = (e: FormEvent) => {
    e.preventDefault();
    try {
      addPerson(personName);
      setPersonName("");
    } catch (err) {
      toast.error(message(err, "Could not save that name."));
    }
  };

  const onAddGroup = (e: FormEvent) => {
    e.preventDefault();
    try {
      createGroup(groupName);
      setGroupName("");
    } catch (err) {
      toast.error(message(err, "Could not create that group."));
    }
  };

  return (
    <div className="relative min-h-dvh">
      <header className="pt-safe sticky top-0 z-20 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-1.5 px-2 sm:px-4">
          <Button variant="ghost" size="icon-xl" render={<Link href="/" />} nativeButton={false} aria-label="Home">
            <ArrowLeftIcon />
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">People</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-10 px-5 pt-2 pb-16">
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Saved on this phone. Pick a group, or individual names, the next time you fill a tournament.
        </p>

            <section>
              <SectionHeader title="People" count={ready ? people.length : undefined} />
              <NameForm
                value={personName}
                onChange={setPersonName}
                onSubmit={onAddPerson}
                placeholder="Add a person"
                label="Add person"
                maxLength={MAX_PERSON_NAME}
              />
              {ready && people.length === 0 && (
                <EmptyNote title="No saved people yet" body="Add a name here, or add players in a tournament and they'll be remembered." />
              )}
              {people.length > 0 && (
                <ul className="mt-3 grid gap-1.5">
                  {people.map((person) => {
                    const groups = directory.groups.filter((group) => group.memberIds.includes(person.id)).map((group) => group.name);
                    return (
                      <DirectoryRow
                        key={person.id}
                        name={person.name}
                        detail={groups.length ? groups.join(", ") : undefined}
                        onRename={() => setRename({ kind: "person", id: person.id, name: person.name })}
                        onDelete={() => deletePerson(person.id)}
                      />
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <SectionHeader title="Groups" count={ready ? directory.groups.length : undefined} />
              <NameForm
                value={groupName}
                onChange={setGroupName}
                onSubmit={onAddGroup}
                placeholder="New group"
                label="Create group"
                maxLength={MAX_GROUP_NAME}
              />
              <p className="mt-2 pl-1 text-[13px] text-muted-foreground">Deleting a group keeps the people.</p>
              {ready && directory.groups.length === 0 && (
                <EmptyNote title="No groups yet" body="A group is a circle of people you can add to a tournament together." />
              )}
              {directory.groups.length > 0 && (
                <ul className="mt-3 grid gap-1.5">
                  {directory.groups.map((group) => (
                    <DirectoryRow
                      key={group.id}
                      name={group.name}
                      detail={memberLabel(group.memberIds.length)}
                      onOpen={() => setOpenGroupId(group.id)}
                      onRename={() => setRename({ kind: "group", id: group.id, name: group.name })}
                      onDelete={() => deleteGroup(group.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
      </main>

      <RenameSheet target={rename} onClose={() => setRename(null)} />
      <GroupMembersSheet group={openGroup} people={people} onClose={() => setOpenGroupId(null)} />
    </div>
  );
}

function memberLabel(count: number) {
  if (count === 0) return "No one yet";
  if (count === 1) return "1 person";
  return `${count} people`;
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">{count}</span>
      )}
    </div>
  );
}

function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function NameForm({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  placeholder: string;
  label: string;
  maxLength: number;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="flex h-14 items-center gap-2 rounded-2xl bg-card pr-1.5 pl-4 ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-ring">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          maxLength={maxLength}
          enterKeyHint="done"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon-xl" disabled={!value.trim()} aria-label={label}>
          <PlusIcon />
        </Button>
      </div>
    </form>
  );
}

function DirectoryRow({
  name,
  detail,
  onOpen,
  onRename,
  onDelete,
}: {
  name: string;
  detail?: string;
  onOpen?: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const text = (
    <>
      <span className="block truncate font-medium">{name}</span>
      {detail && <span className="block truncate text-[13px] text-muted-foreground">{detail}</span>}
    </>
  );
  return (
    <li className="flex min-h-14 items-center gap-2 rounded-2xl bg-card py-2 pr-1.5 pl-4 ring-1 ring-border">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          {text}
        </button>
      ) : (
        <span className="min-w-0 flex-1">{text}</span>
      )}
      <Button variant="ghost" size="icon-lg" className="rounded-full text-muted-foreground" onClick={onRename} aria-label={`Rename ${name}`}>
        <PencilIcon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-lg"
        className="rounded-full text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
      >
        <XIcon className="size-4" />
      </Button>
    </li>
  );
}

function RenameSheet({
  target,
  onClose,
}: {
  target: { kind: "person" | "group"; id: string; name: string } | null;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(target);
  const [value, setValue] = useState(target?.name ?? "");
  if (target && (target.kind !== shown?.kind || target.id !== shown.id)) {
    setShown(target);
    setValue(target.name);
  }
  const current = target ?? shown;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    try {
      if (target.kind === "person") renamePerson(target.id, value);
      else renameGroup(target.id, value);
      onClose();
    } catch (err) {
      toast.error(message(err, "Could not rename."));
    }
  };

  return (
    <BottomSheet
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={current?.kind === "group" ? "Rename group" : "Rename person"}
    >
      <form onSubmit={save}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={current?.kind === "group" ? MAX_GROUP_NAME : MAX_PERSON_NAME}
          aria-label="Name"
          autoFocus
          autoComplete="off"
          className="h-14 w-full rounded-2xl bg-card px-4 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="xl" className="mt-4 w-full" disabled={!value.trim()}>
          Save
        </Button>
      </form>
    </BottomSheet>
  );
}

function GroupMembersSheet({ group, people, onClose }: { group: Group | null; people: Person[]; onClose: () => void }) {
  const [shown, setShown] = useState(group);
  if (group && group !== shown) setShown(group);
  const current = group ?? shown;

  return (
    <BottomSheet
      open={group !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={current?.name ?? "Group"}
      description="Tick who belongs in this group."
    >
      {people.length === 0 ? (
        <p className="pb-2 text-sm text-muted-foreground">Add people on this page, then tick who belongs here.</p>
      ) : (
        <ul className="grid gap-1.5 pb-2">
          {people.map((person) => {
            const checked = current?.memberIds.includes(person.id) ?? false;
            return (
              <li key={person.id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() => group && setGroupMember(group.id, person.id, !checked)}
                  className="flex h-12 w-full items-center gap-3 rounded-2xl bg-card px-3 text-left ring-1 ring-border"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md ring-1",
                      checked ? "bg-primary text-primary-foreground ring-primary" : "bg-background ring-border",
                    )}
                  >
                    {checked && <CheckIcon className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
