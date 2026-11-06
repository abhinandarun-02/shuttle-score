"use client";

import {
  ArrowLeftRightIcon,
  CheckIcon,
  Loader2Icon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  ShuffleIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/bottom-sheet";
import { GenerateMatchesButton } from "@/components/tournament/next-step";
import { useTournament } from "@/components/tournament/tournament-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { resetMatches } from "@/lib/data/fixtures";
import { addPlayers, MAX_PLAYER_NAME, parseNames, removePlayer, renamePlayer } from "@/lib/data/players";
import { describeError } from "@/lib/data/refs";
import { saveTeams, setTeamsConfirmed } from "@/lib/data/teams";
import { pairPlayers } from "@/lib/domain/teams";
import { CATEGORY_LABELS, MIN_PARTICIPANTS, type Player } from "@/lib/domain/types";
import { personKey, rememberNames, useDirectory } from "@/lib/people";
import { cn } from "@/lib/utils";

export function PlayersScreen() {
  const { view } = useTournament();
  const open = view.state.phase === "registration";
  const isDoubles = view.category === "doubles";

  return (
    <div className="space-y-8 pt-2">
      {!open && <LockedNotice />}
      {isDoubles && <TeamsSection />}
      <PlayersSection />
      {open && view.nextStep.kind === "generate" && (
        <div className="pb-safe sticky bottom-20 z-20 md:bottom-4">
          <div className="rounded-3xl bg-card/95 p-3 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)] ring-1 ring-border backdrop-blur">
            <GenerateMatchesButton />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
      <div className="ml-auto">{action}</div>
    </div>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-semibold text-foreground/80",
        className,
      )}
      aria-hidden
    >
      {initials || <UserIcon className="size-4" />}
    </span>
  );
}

function PlayersSection() {
  const { view, code } = useTournament();
  const open = view.state.phase === "registration";
  const [editing, setEditing] = useState<Player | null>(null);
  const min = MIN_PARTICIPANTS[view.format] * (view.category === "doubles" ? 2 : 1);

  const remove = async (player: Player) => {
    try {
      await removePlayer(code, player, view.teams);
      toast(`Removed ${player.name}`);
    } catch (err) {
      toast.error(describeError(err));
    }
  };

  return (
    <section>
      <SectionHeader title="Players" count={view.players.length} />
      {open && (
        <div className="space-y-4">
          <SavedPeoplePicker />
          <AddPlayersForm />
        </div>
      )}
      {view.players.length === 0 ? (
        <div className="mt-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center">
          <p className="font-medium">No players yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add at least {min} to play {CATEGORY_LABELS[view.category].toLowerCase()}. Paste a whole list to add everyone at once.
          </p>
        </div>
      ) : (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {view.players.map((p) => (
            <li
              key={p.id}
              className="group flex h-14 animate-rise items-center gap-3 rounded-2xl bg-card pr-1.5 pl-3 ring-1 ring-border"
            >
              <Avatar name={p.name} />
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <Button variant="ghost" size="icon-lg" className="rounded-full text-muted-foreground" onClick={() => setEditing(p)} aria-label={`Rename ${p.name}`}>
                <PencilIcon className="size-4" />
              </Button>
              {open && (
                <Button variant="ghost" size="icon-lg" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}>
                  <XIcon className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <RenameSheet player={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function AddPlayersForm() {
  const { view, code } = useTournament();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (text: string) => {
    const names = parseNames(text, view.players.map((p) => p.name));
    if (!names.length) {
      if (text.trim()) toast.warning("That name is already on the list.");
      return;
    }
    setBusy(true);
    try {
      await addPlayers(code, view.category, names, view.players.length);
      const remembered = rememberNames(names);
      setValue("");
      if (names.length > 1) toast.success(`Added ${names.length} players`);
      if (remembered.skippedFull > 0) {
        toast.warning("The saved list is full, so some new names weren't remembered.");
      }
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void add(value);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (/[\n,;]/.test(text)) {
      e.preventDefault();
      void add(text);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="flex h-14 items-center gap-2 rounded-2xl bg-card pr-1.5 pl-4 ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-ring">
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={onPaste}
          maxLength={MAX_PLAYER_NAME * 4}
          placeholder="Player name"
          aria-label="Player name"
          enterKeyHint="done"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon-xl" disabled={busy || !value.trim()} aria-label="Add player">
          {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        </Button>
      </div>
      <p className="mt-2 pl-1 text-[13px] text-muted-foreground">Tip: paste names separated by commas or new lines.</p>
    </form>
  );
}

function SavedPeoplePicker() {
  const directory = useDirectory();
  const { view, code } = useTournament();
  const [groupId, setGroupId] = useState("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  if (directory.people.length === 0) return null;

  const activeGroup = directory.groups.find((group) => group.id === groupId) ?? null;
  const taken = new Set(view.players.map((player) => personKey(player.name)));
  const visible = directory.people
    .filter((person) => !taken.has(personKey(person.name)))
    .filter((person) => !activeGroup || activeGroup.memberIds.includes(person.id))
    .toSorted((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const chosen = directory.people.filter((person) => selected.has(person.id) && !taken.has(personKey(person.name)));

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    const names = parseNames(
      chosen.map((person) => person.name).join("\n"),
      view.players.map((player) => player.name),
    );
    if (!names.length) return;
    setBusy(true);
    try {
      await addPlayers(code, view.category, names, view.players.length);
      setSelected(new Set());
      if (names.length > 1) toast.success(`Added ${names.length} players`);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-[13px] font-medium tracking-wide text-muted-foreground uppercase">Saved</p>
      {directory.groups.length > 0 && (
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterPill active={!activeGroup} onClick={() => setGroupId("all")}>
            All
          </FilterPill>
          {directory.groups.map((group) => (
            <FilterPill key={group.id} active={activeGroup?.id === group.id} onClick={() => setGroupId(group.id)}>
              {group.name}
            </FilterPill>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {activeGroup ? "No one left in this group to add." : "Everyone saved is already in this category."}
        </p>
      ) : (
        <ul className="grid max-h-64 gap-1.5 overflow-y-auto">
          {visible.map((person) => {
            const checked = selected.has(person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggle(person.id)}
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
      {chosen.length > 0 && (
        <Button type="button" size="xl" className="mt-3 w-full" disabled={busy} onClick={() => void addSelected()}>
          {busy ? <Loader2Icon className="animate-spin" /> : `Add ${chosen.length}`}
        </Button>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-sm font-medium ring-1 transition-colors",
        active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-foreground ring-border hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function RenameSheet({ player, onClose }: { player: Player | null; onClose: () => void }) {
  const { code } = useTournament();
  const [value, setValue] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  if (player && player.id !== current) {
    setCurrent(player.id);
    setValue(player.name);
  }
  if (!player && current) setCurrent(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!player) return;
    try {
      await renamePlayer(code, player.id, value);
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  };

  return (
    <BottomSheet open={Boolean(player)} onOpenChange={(o) => !o && onClose()} title="Edit name">
      <form onSubmit={save} className="grid gap-4">
        <input
          autoFocus
          value={value}
          maxLength={MAX_PLAYER_NAME}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Player name"
          className="h-14 rounded-2xl bg-muted px-4 text-lg font-medium outline-none focus:ring-3 focus:ring-ring/40"
        />
        <Button size="xl" type="submit" disabled={!value.trim()}>
          Save
        </Button>
      </form>
    </BottomSheet>
  );
}

type Slot = { team: number; position: 0 | 1 } | { bench: number };

function TeamsSection() {
  const { view, code } = useTournament();
  const open = view.state.phase === "registration";
  const confirmed = view.state.teamsConfirmed;
  const [selected, setSelected] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const pairs = view.teams.map((t) => [...t.playerIds] as [string, string]);
  const inTeams = new Set(pairs.flat());
  const bench = view.players.filter((p) => !inTeams.has(p.id)).map((p) => p.id);
  const editable = open && !confirmed;

  const run = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const draw = () =>
    run(async () => {
      const { pairs: next } = pairPlayers(view.players.map((p) => p.id));
      setSelected(null);
      await saveTeams(code, next, view.teams);
    });

  const idAt = (slot: Slot) => ("bench" in slot ? bench[slot.bench] : pairs[slot.team][slot.position]);
  const same = (x: Slot, y: Slot) =>
    "bench" in x ? "bench" in y && x.bench === y.bench : !("bench" in y) && x.team === y.team && x.position === y.position;

  const tap = (slot: Slot) => {
    if (!editable) return;
    if (!selected) return setSelected(slot);
    if (same(selected, slot)) return setSelected(null);
    const a = idAt(selected);
    const b = idAt(slot);
    const next = pairs.map((p) => [...p] as [string, string]);
    const put = (s: Slot, id: string) => {
      if (!("bench" in s)) next[s.team][s.position] = id;
    };
    put(selected, b);
    put(slot, a);
    setSelected(null);
    if ("bench" in selected && "bench" in slot) return;
    void run(() => saveTeams(code, next, view.teams));
  };

  if (view.players.length < 2 && !view.teams.length) return null;

  const chip = (slot: Slot) => {
    const id = idAt(slot);
    const isSelected = selected !== null && same(selected, slot);
    const swapTarget = selected !== null && !isSelected;
    return (
      <button
        type="button"
        disabled={!editable || busy}
        onClick={() => tap(slot)}
        aria-pressed={isSelected}
        className={cn(
          "flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-muted/70 px-3 text-left font-medium transition-all disabled:cursor-default",
          editable && "hover:bg-muted active:scale-[0.98]",
          isSelected && "bg-primary text-primary-foreground ring-2 ring-primary hover:bg-primary",
          swapTarget && "ring-1 ring-dashed ring-foreground/25",
        )}
      >
        <Avatar name={names.get(id) ?? "?"} className={cn("size-7 text-[11px]", isSelected && "bg-primary-foreground/15 text-primary-foreground")} />
        <span className="truncate">{names.get(id) ?? "Removed player"}</span>
      </button>
    );
  };

  return (
    <section>
      <SectionHeader
        title="Teams"
        count={view.teams.length || undefined}
        action={
          confirmed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
              <CheckIcon className="size-3.5" strokeWidth={3} />
              Confirmed
            </span>
          ) : null
        }
      />

      {!view.teams.length ? (
        <div className="rounded-3xl bg-card p-5 ring-1 ring-border">
          <p className="font-medium">Pair players at random</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every player goes into exactly one team. If the count is odd, one player sits out — you can swap them in.
          </p>
          <Button size="xl" className="mt-4 w-full" onClick={draw} disabled={busy || view.players.length < 2}>
            {busy ? <Loader2Icon className="animate-spin" /> : <ShuffleIcon />}
            Draw teams
          </Button>
        </div>
      ) : (
        <>
          {editable && (
            <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeftRightIcon className="size-4" />
              {selected ? "Now tap another player to swap." : "Tap two players to swap them."}
            </p>
          )}
          <ol className="grid gap-2 sm:grid-cols-2">
            {pairs.map((_, i) => (
              <li key={view.teams[i].id} className="animate-rise rounded-3xl bg-card p-2 ring-1 ring-border">
                <p className="px-2 pt-1 pb-2 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Team {i + 1}</p>
                <div className="flex gap-2">
                  {chip({ team: i, position: 0 })}
                  {chip({ team: i, position: 1 })}
                </div>
              </li>
            ))}
          </ol>
          {bench.length > 0 && (
            <div className="mt-2 rounded-3xl border-2 border-dashed p-2">
              <p className="px-2 pt-1 pb-2 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                {bench.length === 1 ? "Sitting out" : `${bench.length} players without a team`}
              </p>
              <div className="flex flex-wrap gap-2">
                {bench.map((id, i) => (
                  <div key={id} className="flex min-w-[45%] flex-1">
                    {chip({ bench: i })}
                  </div>
                ))}
              </div>
              {bench.length > 1 && editable && (
                <p className="px-2 pt-2 text-[13px] text-muted-foreground">Redraw to include new players.</p>
              )}
            </div>
          )}
          {open && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {confirmed ? (
                <Button size="xl" variant="secondary" className="col-span-2" onClick={() => run(() => setTeamsConfirmed(code, false))} disabled={busy}>
                  <PencilIcon />
                  Edit teams
                </Button>
              ) : (
                <>
                  <Button size="xl" variant="secondary" onClick={draw} disabled={busy}>
                    <ShuffleIcon />
                    Redraw
                  </Button>
                  <Button
                    size="xl"
                    onClick={() => run(() => setTeamsConfirmed(code, true), "Teams confirmed")}
                    disabled={busy || view.teams.length < 2 || bench.length > 1}
                  >
                    <CheckIcon />
                    Confirm teams
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LockedNotice() {
  const { view, code } = useTournament();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const scored = view.matches.some((m) => !m.bye && (m.status === "live" || m.status === "completed"));

  const reset = async () => {
    setBusy(true);
    try {
      await resetMatches(code, view.category, view.matches.map((m) => m.id));
      toast.success("Matches cleared. Edit entries and generate again.");
      setOpen(false);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-3xl bg-muted/60 p-4">
      <LockIcon className="size-5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        Entries are locked while matches are on. Names can still be edited.
      </p>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <RotateCcwIcon />
        Reset
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {CATEGORY_LABELS[view.category].toLowerCase()} matches?</AlertDialogTitle>
            <AlertDialogDescription>
              {scored
                ? "All matches and scores in this event will be deleted. This can't be undone."
                : "All matches in this event will be deleted so you can change entries."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep matches</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={reset} disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              Reset matches
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
