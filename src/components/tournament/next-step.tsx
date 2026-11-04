"use client";

import { ArrowRightIcon, Loader2Icon, PlayIcon, ShuffleIcon, SparklesIcon, TrophyIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { SideMark } from "@/components/tournament/match-card";
import { LiveDot } from "@/components/tournament/status-pill";
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
import { generateMatches, startKnockout } from "@/lib/data/fixtures";
import { describeError } from "@/lib/data/refs";
import { groupCountFor } from "@/lib/domain/fixtures";
import { roundContext, roundLabel } from "@/lib/domain/labels";
import { knockoutSeedsFor } from "@/lib/domain/progress";
import { FORMAT_LABELS, MAX_PARTICIPANTS, type Format, type Match } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function estimateMatches(format: Format, n: number): number {
  if (n < 2) return 0;
  if (format === "round_robin") return (n * (n - 1)) / 2;
  if (format === "knockout") return n - 1;
  if (format === "double_elim") return 2 * n - 2;
  const g = groupCountFor(n);
  const base = Math.floor(n / g);
  const extra = n % g;
  let total = 0;
  for (let i = 0; i < g; i++) {
    const size = base + (i < extra ? 1 : 0);
    total += (size * (size - 1)) / 2;
  }
  const qualifiers = (base >= 3 ? 2 : 1) * g;
  return total + qualifiers - 1;
}

function StepCard({
  icon,
  eyebrow,
  title,
  children,
  tone = "default",
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  tone?: "default" | "brand";
}) {
  return (
    <section
      className={cn(
        "animate-rise rounded-3xl p-5",
        tone === "brand" ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border",
      )}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl",
            tone === "brand" ? "bg-primary-foreground/10" : "bg-brand-soft text-brand",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={cn("text-[12px] font-semibold tracking-wide uppercase", tone === "brand" ? "opacity-70" : "text-muted-foreground")}>
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-[17px] leading-snug font-semibold tracking-tight">{title}</h2>
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export function GenerateMatchesButton({ className }: { className?: string }) {
  const { code, view, tournament } = useTournament();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = view.participants.length;
  const estimate = estimateMatches(tournament.format, count);
  const tooMany = count > MAX_PARTICIPANTS[tournament.format];

  const run = async () => {
    setBusy(true);
    try {
      await generateMatches(code, view.category, tournament.format, view.participants.map((p) => p.id));
      toast.success("Matches are ready. Let's play!");
      setOpen(false);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="xl" className={cn("w-full", className)} onClick={() => setOpen(true)} disabled={tooMany}>
        <SparklesIcon />
        Generate matches
      </Button>
      {tooMany && (
        <p className="mt-2 text-sm text-destructive">
          {FORMAT_LABELS[tournament.format]} supports up to {MAX_PARTICIPANTS[tournament.format]} entries.
        </p>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate {estimate > 0 ? `about ${estimate}` : ""} matches?</AlertDialogTitle>
            <AlertDialogDescription>
              {count} {view.category === "doubles" ? "teams" : "players"} · {FORMAT_LABELS[tournament.format]}. The draw is
              random. The entry list locks once matches exist — you can reset later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={run} disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function StartKnockoutButton() {
  const { code, view } = useTournament();
  const [busy, setBusy] = useState(false);
  const seeds = knockoutSeedsFor(view);
  const run = async () => {
    setBusy(true);
    try {
      await startKnockout(code, view.category, seeds);
      toast.success("Knockout bracket is set");
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="xl" className="w-full" onClick={run} disabled={busy}>
      {busy ? <Loader2Icon className="animate-spin" /> : <TrophyIcon />}
      Start knockout with {seeds.length} qualifiers
    </Button>
  );
}

export function ChampionCard() {
  const { view } = useTournament();
  if (view.nextStep.kind !== "complete") return null;
  return (
    <StepCard tone="brand" icon={<TrophyIcon className="size-5" />} eyebrow="Champion" title={view.nameOf(view.championId)}>
      <p className="text-sm opacity-75">
        {view.format === "round_robin" ? "Top of the standings after every match." : "Winner of the final."} Congratulations!
      </p>
    </StepCard>
  );
}

function MatchLine({ match }: { match: Match }) {
  const { view, href } = useTournament();
  const ctx = roundContext(view.matches);
  const nameA = view.nameOf(match.a);
  const nameB = view.nameOf(match.b);
  return (
    <Link
      href={href(`/m/${match.id}`)}
      className="group flex items-center gap-3 rounded-2xl bg-muted/80 px-3 py-3 ring-1 ring-border transition-colors hover:bg-muted active:scale-[0.99]"
    >
      <div className="flex shrink-0 -space-x-2">
        <SideMark id={match.a} name={nameA} className="size-9 rounded-xl text-[12px] ring-2 ring-card" />
        <SideMark id={match.b} name={nameB} className="size-9 rounded-xl text-[12px] ring-2 ring-card" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-tight">
          {nameA}
          <span className="mx-1.5 text-[12px] font-medium tracking-wide text-muted-foreground">vs</span>
          {nameB}
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {roundLabel(match, ctx)}
          {match.court ? ` · Court ${match.court}` : ""}
        </p>
      </div>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 group-hover:translate-x-0.5">
        <ArrowRightIcon className="size-3.5" />
      </span>
    </Link>
  );
}

/** The single most useful thing to do right now in this category. */
export function NextStepCard() {
  const { view, href, tournament } = useTournament();
  const step = view.nextStep;
  const isDoubles = view.category === "doubles";

  switch (step.kind) {
    case "add-players":
      return (
        <StepCard
          icon={<UserPlusIcon className="size-5" />}
          eyebrow="Step 1 · Entries"
          title={
            view.players.length === 0
              ? "Add everyone who's playing"
              : `Add ${step.needed} more player${step.needed === 1 ? "" : "s"} to start`
          }
        >
          <Button size="xl" className="w-full" render={<Link href={href("/players")} />} nativeButton={false}>
            <UserPlusIcon />
            Add players
          </Button>
        </StepCard>
      );
    case "make-teams":
    case "confirm-teams":
      return (
        <StepCard
          icon={<ShuffleIcon className="size-5" />}
          eyebrow="Step 2 · Teams"
          title={step.kind === "make-teams" ? "Draw random doubles teams" : "Review and confirm the teams"}
        >
          <Button size="xl" className="w-full" render={<Link href={href("/players")} />} nativeButton={false}>
            {step.kind === "make-teams" ? "Draw teams" : "Review teams"}
            <ArrowRightIcon />
          </Button>
        </StepCard>
      );
    case "generate":
      return (
        <StepCard
          icon={<SparklesIcon className="size-5" />}
          eyebrow={`${isDoubles ? "Step 3" : "Step 2"} · Fixtures`}
          title={`${view.participants.length} ${isDoubles ? "teams" : "players"} are in. Ready for the draw?`}
        >
          <GenerateMatchesButton />
        </StepCard>
      );
    case "start-knockout":
      return (
        <StepCard icon={<TrophyIcon className="size-5" />} eyebrow="Groups complete" title="Top players advance to the knockout">
          <StartKnockoutButton />
        </StepCard>
      );
    case "complete":
      return <ChampionCard />;
    case "play": {
      if (step.live.length) {
        return (
          <StepCard
            icon={<LiveDot className="size-2.5" />}
            eyebrow="Live now"
            title={`${step.live.length} match${step.live.length === 1 ? "" : "es"} in play`}
          >
            <div className="grid gap-2">
              {step.live.slice(0, 2).map((m) => (
                <MatchLine key={m.id} match={m} />
              ))}
            </div>
          </StepCard>
        );
      }
      if (step.upNext) {
        return (
          <StepCard icon={<PlayIcon className="size-5" />} eyebrow="Up next" title="Tap a match to start scoring">
            <MatchLine match={step.upNext} />
          </StepCard>
        );
      }
      return (
        <StepCard
          icon={<Loader2Icon className="size-5" />}
          eyebrow={FORMAT_LABELS[tournament.format]}
          title="Waiting for earlier results"
        />
      );
    }
  }
}
