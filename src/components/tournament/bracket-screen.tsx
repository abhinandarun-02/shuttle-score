"use client";

import { Loader2Icon, TrophyIcon, Undo2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { NextStepCard } from "@/components/tournament/next-step";
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
import { cancelKnockout } from "@/lib/data/fixtures";
import { describeError } from "@/lib/data/refs";
import { knockoutRoundName, roundContext, roundLabel } from "@/lib/domain/labels";
import { gameWinner } from "@/lib/domain/scoring";
import { BYE, scoringRulesOf, type Match, type ScoringRules, type Side, type Stage } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const ROW = 76;

function byRound(matches: readonly Match[], stage: Stage): Match[][] {
  const map = new Map<number, Match[]>();
  for (const m of matches) {
    if (m.stage !== stage) continue;
    const list = map.get(m.round) ?? [];
    list.push(m);
    map.set(m.round, list);
  }
  return [...map.entries()].sort(([a], [b]) => a - b).map(([, list]) => list.sort((a, b) => a.slot - b.slot));
}

export function BracketScreen() {
  const { view, href } = useTournament();
  const ko = byRound(view.matches, "ko");
  const wb = byRound(view.matches, "wb");
  const lb = byRound(view.matches, "lb");
  const gf = view.matches.filter((m) => m.stage === "gf").sort((a, b) => a.round - b.round);
  const ctx = roundContext(view.matches);

  if (view.format === "groups" && ko.length === 0) {
    const ready = view.nextStep.kind === "start-knockout";
    return (
      <div className="space-y-5 pt-2">
        {ready ? (
          <NextStepCard />
        ) : (
          <div className="flex flex-col items-center rounded-3xl border-2 border-dashed px-6 py-14 text-center">
            <TrophyIcon className="size-7 text-muted-foreground" />
            <p className="mt-3 max-w-xs font-medium">The knockout opens when every group has finished</p>
            <Button className="mt-4" variant="secondary" render={<Link href={href("/standings")} />} nativeButton={false}>
              View group standings
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (view.format === "round_robin" || (ko.length === 0 && wb.length === 0)) {
    return (
      <div className="flex flex-col items-center rounded-3xl border-2 border-dashed px-6 py-14 text-center">
        <TrophyIcon className="size-7 text-muted-foreground" />
        <p className="mt-3 font-medium">The bracket appears once matches are drawn</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-2">
      {view.nextStep.kind === "complete" && <NextStepCard />}
      {ko.length > 0 && (
        <section>
          <BracketColumns
            rounds={ko}
            titleFor={(_round, i) => knockoutRoundName(i + 1, ko.length)}
          />
          <UndoKnockout />
        </section>
      )}
      {wb.length > 0 && (
        <section className="space-y-6">
          {gf.length > 0 && <GrandFinal matches={gf} />}
          <div>
            <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Winners bracket</h2>
            <BracketColumns rounds={wb} titleFor={(round) => roundLabel(round[0], ctx)} />
          </div>
          {lb.length > 0 && (
            <div>
              <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Losers bracket</h2>
              <BracketColumns rounds={lb} titleFor={(round) => roundLabel(round[0], ctx)} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function BracketColumns({ rounds, titleFor }: { rounds: Match[][]; titleFor: (round: Match[], index: number) => string }) {
  const height = Math.max(...rounds.map((r) => r.length), 1) * ROW;
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex w-max gap-0">
        {rounds.map((round, i) => (
          <div key={i} className="flex">
            <div className="w-52 shrink-0 sm:w-60">
              <p className="flex h-7 items-end truncate px-1 pb-1.5 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                {titleFor(round, i)}
              </p>
              <div className="flex flex-col" style={{ height }}>
                {round.map((m) => (
                  <div key={m.id} className="flex flex-1 items-center px-1">
                    <BracketCard match={m} />
                  </div>
                ))}
              </div>
            </div>
            {i < rounds.length - 1 && (
              <div className="flex shrink-0 flex-col">
                <div className="h-7" />
                <Connectors from={round.length} to={rounds[i + 1].length} height={height} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Connectors({ from, to, height }: { from: number; to: number; height: number }) {
  const y = (i: number, n: number) => ((i + 0.5) / n) * height;
  const paths: string[] = [];
  if (to === from / 2) {
    for (let j = 0; j < to; j++) {
      const y1 = y(j * 2, from);
      const y2 = y(j * 2 + 1, from);
      const mid = (y1 + y2) / 2;
      paths.push(`M0 ${y1} H10 V${y2} H0 M10 ${mid} H20`);
    }
  } else if (to === from) {
    for (let j = 0; j < from; j++) paths.push(`M0 ${y(j, from)} H20`);
  }
  if (!paths.length) return <div className="w-5 shrink-0" />;
  return (
    <svg width={20} height={height} className="shrink-0 text-border" aria-hidden>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function BracketCard({ match }: { match: Match }) {
  const { view, href, tournament } = useTournament();
  const rules = scoringRulesOf(tournament);
  const playable = match.status === "upcoming" || match.status === "live" || match.status === "completed";
  const live = match.status === "live";
  const inner = (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl bg-card ring-1 ring-border",
        live && "ring-2 ring-primary",
        match.bye && "opacity-60",
      )}
    >
      {(["A", "B"] as Side[]).map((side, i) => {
        const id = side === "A" ? match.a : match.b;
        const won = match.winner === side;
        const score = sideScore(match, side, rules);
        return (
          <div
            key={side}
            className={cn(
              "flex h-8 items-center gap-2 px-2.5",
              i === 0 && "border-b border-border",
              won && "bg-brand-soft",
            )}
          >
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", won && "font-semibold", id === null && "text-muted-foreground italic")}>
              {id === BYE ? "Bye" : view.nameOf(id)}
            </span>
            {score !== null && (
              <span className={cn("font-mono text-[13px] tabular-nums", won ? "font-semibold" : "text-muted-foreground")}>{score}</span>
            )}
          </div>
        );
      })}
    </div>
  );
  if (!playable || match.bye) return inner;
  return (
    <Link href={href(`/m/${match.id}`)} className="block w-full transition-transform active:scale-[0.98]">
      {inner}
    </Link>
  );
}

function sideScore(match: Match, side: Side, rules: ScoringRules): number | null {
  const played = match.games.filter((g, i) => gameWinner(g, rules) || (match.status === "live" && i === match.games.length - 1));
  if (!played.length || match.bye) return null;
  const current = played[played.length - 1];
  return side === "A" ? current.a : current.b;
}

function GrandFinal({ matches }: { matches: Match[] }) {
  return (
    <section className="rounded-3xl bg-card p-4 ring-1 ring-border">
      <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Grand final</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {matches.map((m) => (
          <div key={m.id}>
            <p className="mb-1.5 px-1 text-[12px] text-muted-foreground">{m.round === 2 ? "Bracket reset" : "Winners bracket vs losers bracket"}</p>
            <BracketCard match={m} />
          </div>
        ))}
      </div>
    </section>
  );
}

function UndoKnockout() {
  const { view, code } = useTournament();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (view.format !== "groups" || view.state.phase !== "knockout") return null;
  const ids = view.matches.filter((m) => m.stage === "ko").map((m) => m.id);
  const started = view.matches.some((m) => m.stage === "ko" && !m.bye && (m.status === "live" || m.status === "completed"));

  const run = async () => {
    setBusy(true);
    try {
      await cancelKnockout(code, view.category, ids);
      toast.success("Back to the group stage");
      setOpen(false);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Undo2Icon />
        Redo the group results
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the knockout bracket?</AlertDialogTitle>
            <AlertDialogDescription>
              {started
                ? "Knockout matches and their scores will be deleted so the groups can be corrected."
                : "The bracket is removed. Group results stay as they are."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep bracket</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={run} disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              Remove bracket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
