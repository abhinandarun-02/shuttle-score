"use client";

import { ArrowLeftIcon, CloudOffIcon, FlagIcon, MapPinIcon, MinusIcon, PencilIcon, PlusIcon, RotateCcwIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { memo, use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/bottom-sheet";
import { ShuttleGlyph } from "@/components/logo";
import { sideMonogram } from "@/components/tournament/match-card";
import { MatchStatusPill } from "@/components/tournament/status-pill";
import { useTournament } from "@/components/tournament/tournament-context";
import { Button } from "@/components/ui/button";
import { useMatchScorer, useOnline } from "@/lib/data/hooks";
import { describeError } from "@/lib/data/refs";
import { setCourt } from "@/lib/data/scoring";
import { roundContext, roundLabel } from "@/lib/domain/labels";
import {
  canUndo,
  currentGame,
  currentGameNumber,
  gamesNeeded,
  gameWinner,
  gamesWon,
  maxGames,
  pointCap,
  validateCorrection,
} from "@/lib/domain/scoring";
import { scoringRulesOf, type GameScore, type Match, type ScoringRules, type Side } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function ScoringRoute({ params }: { params: Promise<{ code: string; matchId: string }> }) {
  const { matchId } = use(params);
  const { matches, code, href, tournament, view } = useTournament();
  const rules = useMemo(() => scoringRulesOf(tournament), [tournament]);
  const server = matches.find((m) => m.id === matchId) ?? null;
  const scorer = useMatchScorer(code, server, rules);
  const match = scorer.match;
  const { point, undo } = scorer;
  const scoreKey = match
    ? `${match.id}:${match.status}:${match.winner}:${match.undo.length}:${match.court}:${match.games.map((g) => `${g.a}-${g.b}`).join(",")}`
    : "";

  useEffect(() => {
    if (!scoreKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "1" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        point("A");
      } else if (e.key === "2" || e.key === "l" || e.key === "L") {
        e.preventDefault();
        point("B");
      } else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scoreKey, point, undo]);

  if (!server || !match) {
    return (
      <Message
        back={href()}
        title="Match not found"
        body="This match isn't part of the tournament."
      />
    );
  }

  return (
    <ScoringView
      match={match}
      scorer={scorer}
      back={href()}
      rules={rules}
      code={code}
      nameA={view.nameOf(match.a)}
      nameB={view.nameOf(match.b)}
      round={roundLabel(match, roundContext(matches))}
    />
  );
}

function Message({ back, title, body }: { back: string; title: string; body: string }) {
  return (
    <div className="pt-safe flex min-h-dvh flex-col">
      <div className="mx-auto flex h-16 w-full max-w-lg items-center px-2">
        <Button variant="ghost" size="icon-xl" render={<Link href={back} />} nativeButton={false} aria-label="Back to matches">
          <ArrowLeftIcon />
        </Button>
      </div>
      <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </main>
    </div>
  );
}

function sameGames(a: readonly GameScore[], b: readonly GameScore[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].a !== b[i].a || a[i].b !== b[i].b) return false;
  return true;
}

/** Ignore version and timestamps so a confirmed save does not repaint an unchanged score. */
function sameMatchView(a: Match, b: Match): boolean {
  return (
    a.id === b.id &&
    a.stage === b.stage &&
    a.round === b.round &&
    a.group === b.group &&
    a.slot === b.slot &&
    a.status === b.status &&
    a.winner === b.winner &&
    a.bye === b.bye &&
    a.endedEarly === b.endedEarly &&
    a.court === b.court &&
    a.a === b.a &&
    a.b === b.b &&
    a.undo.length === b.undo.length &&
    sameGames(a.games, b.games)
  );
}

const ScoringView = memo(function ScoringView({
  match,
  scorer,
  back,
  rules,
  code,
  nameA,
  nameB,
  round,
}: {
  match: Match;
  scorer: ReturnType<typeof useMatchScorer>;
  back: string;
  rules: ScoringRules;
  code: string;
  nameA: string;
  nameB: string;
  round: string;
}) {
  const online = useOnline();
  const [correctOpen, setCorrectOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [courtOpen, setCourtOpen] = useState(false);
  const finished = match.status === "completed";
  const waiting = match.status === "waiting" || match.bye;
  const canScore = !finished && !waiting && online;
  const game = currentGame(match.games);
  const gameNo = currentGameNumber(match.games);
  const won = gamesWon(match.games, rules);
  const previous = useMemo(() => match.games.filter((g) => gameWinner(g, rules)), [match.games, rules]);
  const singleGame = rules.matchLength === "single";
  const gameSlots = gamesNeeded(rules.matchLength);
  const headlineA = finished && !singleGame ? won.a : game.a;
  const headlineB = finished && !singleGame ? won.b : game.b;
  const detailGames = finished ? (singleGame ? EMPTY_GAMES : match.games) : previous;

  const { point } = scorer;
  const addPoint = useCallback(
    (side: Side) => {
      if (point(side)) navigator.vibrate?.(12);
    },
    [point],
  );
  const pointA = useCallback(() => addPoint("A"), [addPoint]);
  const pointB = useCallback(() => addPoint("B"), [addPoint]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="pt-safe sticky top-0 z-10 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center gap-1 px-2">
          <Button variant="ghost" size="icon-xl" render={<Link href={back} />} nativeButton={false} aria-label="Back to matches">
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">
              {round}
              {singleGame && (
                <span className="ml-2 font-mono text-[12px] font-medium text-muted-foreground tabular-nums">
                  to {rules.pointsToWin}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setCourtOpen(true)}
              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              <MapPinIcon className="size-3 shrink-0" />
              <span className="truncate">{match.court ? `Court ${match.court}` : "Add court"}</span>
            </button>
          </div>
          <MatchStatusPill status={match.status} />
          <Button
            variant="ghost"
            size="icon-xl"
            aria-label="Undo last point"
            disabled={!canUndo(match)}
            onClick={() => scorer.undo()}
          >
            <RotateCcwIcon />
          </Button>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-[13px] font-medium text-background">
            <CloudOffIcon className="size-4" />
            Offline — scoring resumes when you reconnect.
          </div>
        )}
        <SavingIndicator syncing={scorer.syncing} />
      </header>

      <main className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col gap-3 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {(!singleGame || previous.length > 0) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {!singleGame && (
              <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 ring-1 ring-foreground/10" aria-label={finished ? "Match" : `Game ${gameNo}`}>
                {Array.from({ length: gameSlots }, (_, i) => (
                  <span key={`a${i}`} className={cn("size-2 rounded-full", won.a > i ? "bg-primary" : "bg-muted")} />
                ))}
                <span className="text-[13px] font-semibold tracking-tight">{finished ? "Match" : `Game ${gameNo}`}</span>
                {Array.from({ length: gameSlots }, (_, i) => (
                  <span key={`b${i}`} className={cn("size-2 rounded-full", won.b > i ? "bg-foreground" : "bg-muted")} />
                ))}
              </div>
            )}
            {!singleGame && (
              <span className="rounded-full bg-muted px-2.5 py-1.5 font-mono text-[12px] font-medium text-muted-foreground tabular-nums">
                to {rules.pointsToWin}
              </span>
            )}
            {previous.map((g, i) => (
              <span key={i} className="rounded-full bg-card px-2.5 py-1.5 font-mono text-[12px] font-medium text-muted-foreground tabular-nums ring-1 ring-foreground/10">
                {g.a}–{g.b}
              </span>
            ))}
          </div>
        )}

        {waiting ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] bg-card px-6 text-center ring-1 ring-foreground/10">
            <ShuttleGlyph className="mb-4 size-10 text-brand" />
            <p className="text-lg font-semibold tracking-tight">Waiting on an earlier match</p>
            <p className="mt-1 max-w-xs text-muted-foreground">This one opens as soon as both sides are decided.</p>
          </div>
        ) : (
          <div className="relative grid min-h-0 flex-1 grid-rows-2 gap-2.5">
            <SideCourt
              side="A"
              name={nameA}
              score={headlineA}
              games={detailGames}
              winner={match.winner === "A"}
              dim={finished && match.winner !== "A"}
              canScore={canScore}
              showGamesWon={finished && !singleGame}
              onPoint={pointA}
            />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center">
              <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-muted-foreground ring-1 ring-border">
                VS
              </span>
            </div>
            <SideCourt
              side="B"
              name={nameB}
              score={headlineB}
              games={detailGames}
              winner={match.winner === "B"}
              dim={finished && match.winner !== "B"}
              canScore={canScore}
              showGamesWon={finished && !singleGame}
              onPoint={pointB}
            />
          </div>
        )}

        {finished && (
          <div className="flex animate-rise items-center gap-3 rounded-2xl bg-card px-3.5 py-3 ring-1 ring-foreground/10">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <TrophyIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {match.endedEarly ? "Match awarded" : "Match won"}
              </p>
              <p className="truncate font-semibold tracking-tight">{match.winner === "A" ? nameA : nameB}</p>
            </div>
            <p className="font-mono text-sm text-muted-foreground tabular-nums">
              {match.games.filter((g) => gameWinner(g, rules) || g.a + g.b > 0).map((g) => `${g.a}–${g.b}`).join(" · ") || "—"}
            </p>
          </div>
        )}

        {!waiting && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="xl" variant="secondary" onClick={() => setCorrectOpen(true)}>
              <PencilIcon />
              Correct score
            </Button>
            {finished ? (
              <Button size="xl" render={<Link href={back} />} nativeButton={false}>
                Back to matches
              </Button>
            ) : (
              <Button size="xl" variant="outline" onClick={() => setEndOpen(true)} disabled={!canScore}>
                <FlagIcon />
                End match
              </Button>
            )}
          </div>
        )}
      </main>

      <CorrectSheet open={correctOpen} onOpenChange={setCorrectOpen} match={match} rules={rules} onSave={(games) => scorer.correct(games)} />
      <EndSheet
        open={endOpen}
        onOpenChange={setEndOpen}
        names={{ A: nameA, B: nameB }}
        onPick={(side) => {
          scorer.end(side);
          setEndOpen(false);
        }}
      />
      <CourtSheet open={courtOpen} onOpenChange={setCourtOpen} match={match} code={code} />
    </div>
  );
}, (prev, next) => {
  return (
    prev.back === next.back &&
    prev.code === next.code &&
    prev.nameA === next.nameA &&
    prev.nameB === next.nameB &&
    prev.round === next.round &&
    prev.rules === next.rules &&
    prev.scorer.syncing === next.scorer.syncing &&
    prev.scorer.point === next.scorer.point &&
    prev.scorer.undo === next.scorer.undo &&
    prev.scorer.correct === next.scorer.correct &&
    prev.scorer.end === next.scorer.end &&
    sameMatchView(prev.match, next.match)
  );
});

function SavingIndicator({ syncing }: { syncing: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex translate-y-1/2 justify-center">
      <span
        className={cn(
          "rounded-full bg-card px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground ring-1 ring-foreground/10 transition-opacity duration-150",
          syncing ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        Saving…
      </span>
      <span className="sr-only" aria-live="polite">
        {syncing ? "Saving score" : ""}
      </span>
    </div>
  );
}

const SideCourt = memo(function SideCourt({
  side,
  name,
  score,
  games,
  winner,
  dim,
  canScore,
  showGamesWon,
  onPoint,
}: {
  side: Side;
  name: string;
  score: number;
  games: GameScore[];
  winner: boolean;
  dim: boolean;
  canScore: boolean;
  showGamesWon: boolean;
  onPoint: () => void;
}) {
  const marks = games.map((g) => (side === "A" ? g.a : g.b));
  return (
    <button
      type="button"
      disabled={!canScore}
      onClick={onPoint}
      aria-label={canScore ? `Point for ${name}` : `${name}, ${score}`}
      className={cn(
        "relative flex h-full min-h-36 flex-col overflow-hidden rounded-[28px] px-4 py-4 text-left ring-1 transition-transform select-none disabled:opacity-100",
        side === "A"
          ? "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] ring-black/10"
          : "bg-foreground text-background shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] ring-white/10",
        canScore && "cursor-pointer active:scale-[0.985]",
        dim && "opacity-50",
      )}
    >
      <ShuttleGlyph className="pointer-events-none absolute -right-6 -bottom-8 size-40 rotate-12 opacity-[0.14]" />
      <div className="pointer-events-none absolute -top-16 -left-10 size-40 rounded-full bg-white/25 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-semibold tracking-tight",
            side === "A" ? "bg-primary-foreground/10" : "bg-background/15",
          )}
          aria-hidden
        >
          {sideMonogram(name)}
        </span>
        <span className="line-clamp-2 min-w-0 flex-1 text-[17px] leading-tight font-semibold tracking-tight">{name}</span>
        {winner && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/15 px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
            <TrophyIcon className="size-3.5" />
            Won
          </span>
        )}
      </div>
      <div className="relative flex flex-1 items-center justify-center">
        <span
          key={`${side}-${score}`}
          className="animate-score-pop text-[clamp(5rem,22vw,7.75rem)] leading-none font-semibold tracking-tighter tabular-nums"
        >
          {score}
        </span>
      </div>
      <div className="relative flex items-end justify-between gap-3">
        <span className="font-mono text-sm tabular-nums opacity-70">
          {showGamesWon ? "games" : marks.length > 0 ? marks.join("  ") : "\u00a0"}
        </span>
        {canScore ? (
          <span className="text-[13px] font-semibold tracking-wide uppercase opacity-70">+1 point</span>
        ) : (
          showGamesWon && marks.length > 0 && (
            <span className="font-mono text-sm tabular-nums opacity-70">{marks.join("  ")}</span>
          )
        )}
      </div>
    </button>
  );
}, (prev, next) => {
  return (
    prev.side === next.side &&
    prev.name === next.name &&
    prev.score === next.score &&
    prev.winner === next.winner &&
    prev.dim === next.dim &&
    prev.canScore === next.canScore &&
    prev.showGamesWon === next.showGamesWon &&
    prev.onPoint === next.onPoint &&
    sameGames(prev.games, next.games)
  );
});

const EMPTY_GAMES: GameScore[] = [];

function gamesForEditing(match: Match, rules: ScoringRules): GameScore[] {
  const games = (match.games.length ? match.games : [{ a: 0, b: 0 }]).map((g) => ({ ...g }));
  if (games.length > 1) {
    const last = games[games.length - 1];
    if (last.a === 0 && last.b === 0 && gameWinner(games[games.length - 2], rules)) games.pop();
  }
  return games;
}

function CorrectSheet({
  open,
  onOpenChange,
  match,
  rules,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  match: Match;
  rules: ScoringRules;
  onSave: (games: GameScore[]) => boolean;
}) {
  const cap = pointCap(rules.pointsToWin);
  const gameLimit = maxGames(rules.matchLength);
  const [games, setGames] = useState<GameScore[]>([{ a: 0, b: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setGames(gamesForEditing(match, rules));
      setError(null);
    }
  }

  const set = (i: number, side: keyof GameScore, value: number) => {
    setGames((gs) => gs.map((g, idx) => (idx === i ? { ...g, [side]: Math.max(0, Math.min(cap, value)) } : g)));
    setError(null);
  };

  const save = () => {
    const problem = validateCorrection(games, rules);
    if (problem) {
      setError(problem);
      return;
    }
    if (onSave(games)) onOpenChange(false);
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Correct the score" description="Finished games must be real badminton scores.">
      <div className="grid gap-3">
        {games.map((g, i) => (
          <div key={i} className="rounded-2xl bg-muted p-3">
            <p className="mb-2 text-center text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Game {i + 1}</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Stepper value={g.a} onChange={(v) => set(i, "a", v)} label="Side A" />
              <span className="text-muted-foreground">–</span>
              <Stepper value={g.b} onChange={(v) => set(i, "b", v)} label="Side B" />
            </div>
          </div>
        ))}
        <div className="flex justify-center">
          {games.length < gameLimit ? (
            <Button variant="ghost" size="sm" onClick={() => setGames((gs) => [...gs, { a: 0, b: 0 }])}>
              <PlusIcon />
              Add a game
            </Button>
          ) : null}
          {games.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setGames((gs) => gs.slice(0, -1))}>
              Remove last game
            </Button>
          )}
        </div>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <Button size="xl" onClick={save}>
          Save score
        </Button>
      </div>
    </BottomSheet>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label={`Decrease ${label}`} onClick={() => onChange(value - 1)}>
        <MinusIcon />
      </Button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="h-12 w-14 rounded-xl bg-card text-center font-mono text-2xl font-semibold tabular-nums outline-none focus:ring-3 focus:ring-ring/40"
      />
      <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)}>
        <PlusIcon />
      </Button>
    </div>
  );
}

function EndSheet({
  open,
  onOpenChange,
  names,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  names: Record<Side, string>;
  onPick: (side: Side) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="End this match"
      description="For a retirement or walkover. The winner goes through as if they had won on court."
    >
      <div className="grid gap-2">
        <Button size="2xl" onClick={() => onPick("A")}>
          <TrophyIcon />
          {names.A} wins
        </Button>
        <Button size="2xl" variant="secondary" onClick={() => onPick("B")}>
          <TrophyIcon />
          {names.B} wins
        </Button>
      </div>
    </BottomSheet>
  );
}

function CourtSheet({
  open,
  onOpenChange,
  match,
  code,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  match: Match;
  code: string;
}) {
  const [value, setValue] = useState(match.court ?? "");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(match.court ?? "");
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setCourt(code, match.id, value);
      onOpenChange(false);
    } catch (err) {
      toast.error(describeError(err));
    }
  };
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Court">
      <form onSubmit={save} className="grid gap-4">
        <input
          autoFocus
          value={value}
          maxLength={12}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 3"
          aria-label="Court number"
          className="h-14 rounded-2xl bg-muted px-4 text-lg font-medium outline-none focus:ring-3 focus:ring-ring/40"
        />
        <Button size="xl" type="submit">
          Save
        </Button>
      </form>
    </BottomSheet>
  );
}
