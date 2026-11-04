"use client";

import { ArrowLeftIcon, CloudOffIcon, FlagIcon, MinusIcon, PencilIcon, PlusIcon, RotateCcwIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/bottom-sheet";
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
  gameWinner,
  gamesWon,
  POINT_CAP,
  validateCorrection,
} from "@/lib/domain/scoring";
import type { GameScore, Match, Side } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function ScoringRoute({ params }: { params: Promise<{ code: string; matchId: string }> }) {
  const { matchId } = use(params);
  const { matches, code, href } = useTournament();
  const server = matches.find((m) => m.id === matchId) ?? null;
  const scorer = useMatchScorer(code, server);
  const match = scorer.match;
  const { point, undo } = scorer;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!match || e.metaKey || e.ctrlKey || e.altKey) return;
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
  }, [match, point, undo]);

  if (!server || !match) {
    return (
      <Message
        back={href()}
        title="Match not found"
        body="This match isn't part of the tournament."
      />
    );
  }

  return <ScoringView match={match} scorer={scorer} back={href()} />;
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

function ScoringView({
  match,
  scorer,
  back,
}: {
  match: Match;
  scorer: ReturnType<typeof useMatchScorer>;
  back: string;
}) {
  const { view, code } = useTournament();
  const online = useOnline();
  const [correctOpen, setCorrectOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [courtOpen, setCourtOpen] = useState(false);
  const ctx = roundContext(view.matches);
  const finished = match.status === "completed";
  const waiting = match.status === "waiting" || match.bye;
  const canScore = !finished && !waiting && online;
  const game = currentGame(match.games);
  const gameNo = currentGameNumber(match.games);
  const won = gamesWon(match.games);
  const previous = match.games.filter((g) => gameWinner(g));

  const point = (side: Side) => {
    if (scorer.point(side)) navigator.vibrate?.(12);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe sticky top-0 z-10 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center gap-1 px-2">
          <Button variant="ghost" size="icon-xl" render={<Link href={back} />} nativeButton={false} aria-label="Back to matches">
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">{roundLabel(match, ctx)}</p>
            <button
              type="button"
              onClick={() => setCourtOpen(true)}
              className="text-[13px] text-muted-foreground hover:text-foreground"
            >
              {match.court ? `Court ${match.court}` : "Add court"}
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
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-4 pb-44">
        <div className="flex items-center justify-center gap-2" aria-label={`Game ${gameNo}`}>
          {[0, 1].map((i) => (
            <span key={`a${i}`} className={cn("size-2 rounded-full", won.a > i ? "bg-primary" : "bg-muted")} />
          ))}
          <span className="px-2 text-sm font-medium text-muted-foreground">
            {finished ? "Match" : `Game ${gameNo}`}
          </span>
          {[0, 1].map((i) => (
            <span key={`b${i}`} className={cn("size-2 rounded-full", won.b > i ? "bg-foreground" : "bg-muted")} />
          ))}
        </div>

        {previous.length > 0 && !finished && (
          <p className="mt-3 text-center font-mono text-sm text-muted-foreground tabular-nums">
            {previous.map((g) => `${g.a}–${g.b}`).join("  ·  ")}
          </p>
        )}

        {waiting ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold">Waiting on an earlier match</p>
            <p className="mt-1 text-muted-foreground">This one opens as soon as both sides are decided.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <ScoreBlock name={view.nameOf(match.a)} score={finished ? won.a : game.a} side="A" winner={match.winner === "A"} dim={finished && match.winner !== "A"} games={finished ? match.games : previous} />
            <span className="pb-8 text-sm font-medium text-muted-foreground">vs</span>
            <ScoreBlock name={view.nameOf(match.b)} score={finished ? won.b : game.b} side="B" winner={match.winner === "B"} dim={finished && match.winner !== "B"} games={finished ? match.games : previous} />
          </div>
        )}

        {finished && (
          <div className="mt-8 animate-rise rounded-3xl bg-primary px-5 py-5 text-primary-foreground">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase opacity-70">
              <TrophyIcon className="size-4" />
              {match.endedEarly ? "Match awarded" : "Match won"}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{view.nameOf(match.winner === "A" ? match.a : match.b)}</p>
            <p className="mt-1 font-mono text-sm tabular-nums opacity-80">
              {match.games.filter((g) => gameWinner(g) || g.a + g.b > 0).map((g) => `${g.a}–${g.b}`).join("  ·  ") || "No games played"}
            </p>
          </div>
        )}

        {scorer.syncing && <p className="mt-4 text-center text-[13px] text-muted-foreground">Saving…</p>}
      </main>

      {!waiting && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background to-transparent pt-8">
          <div className="mx-auto w-full max-w-lg px-3 pb-3">
            {!finished && (
              <div className="grid grid-cols-2 gap-2">
                <PointButton side="A" name={view.nameOf(match.a)} disabled={!canScore} onClick={() => point("A")} />
                <PointButton side="B" name={view.nameOf(match.b)} disabled={!canScore} onClick={() => point("B")} />
              </div>
            )}
            <div className={cn("grid grid-cols-2 gap-2", !finished && "mt-2")}>
              <Button size="lg" variant="ghost" className="h-12 text-muted-foreground" onClick={() => setCorrectOpen(true)} disabled={waiting}>
                <PencilIcon />
                Correct score
              </Button>
              {finished ? (
                <Button size="lg" variant="secondary" className="h-12" render={<Link href={back} />} nativeButton={false}>
                  Back to matches
                </Button>
              ) : (
                <Button size="lg" variant="ghost" className="h-12 text-muted-foreground" onClick={() => setEndOpen(true)} disabled={!canScore}>
                  <FlagIcon />
                  End match
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <CorrectSheet open={correctOpen} onOpenChange={setCorrectOpen} match={match} onSave={(games) => scorer.correct(games)} />
      <EndSheet
        open={endOpen}
        onOpenChange={setEndOpen}
        names={{ A: view.nameOf(match.a), B: view.nameOf(match.b) }}
        onPick={(side) => {
          scorer.end(side);
          setEndOpen(false);
        }}
      />
      <CourtSheet open={courtOpen} onOpenChange={setCourtOpen} match={match} code={code} />
    </div>
  );
}

function ScoreBlock({
  name,
  score,
  side,
  winner,
  dim,
  games,
}: {
  name: string;
  score: number;
  side: Side;
  winner: boolean;
  dim: boolean;
  games: GameScore[];
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1 text-center", dim && "opacity-45")}>
      <span className="line-clamp-2 min-h-10 text-[15px] leading-tight font-semibold">{name}</span>
      <span
        key={`${side}-${score}`}
        className={cn(
          "animate-score-pop font-mono text-7xl leading-none font-semibold tracking-tighter tabular-nums [font-feature-settings:normal] sm:text-8xl",
          winner && "text-brand",
        )}
      >
        {score}
      </span>
      {games.length > 0 && (
        <span className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
          {games.map((g) => (side === "A" ? g.a : g.b)).join(" ")}
        </span>
      )}
    </div>
  );
}

function PointButton({ side, name, disabled, onClick }: { side: Side; name: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-24 flex-col items-center justify-center gap-0.5 rounded-3xl text-center transition-transform select-none active:scale-[0.97] disabled:opacity-40",
        side === "A" ? "bg-primary text-primary-foreground" : "bg-foreground text-background",
      )}
    >
      <span className="text-sm font-semibold tracking-wide uppercase opacity-70">+1 point</span>
      <span className="max-w-full truncate px-3 text-lg font-semibold">{name}</span>
    </button>
  );
}

function gamesForEditing(match: Match): GameScore[] {
  const games = (match.games.length ? match.games : [{ a: 0, b: 0 }]).map((g) => ({ ...g }));
  if (games.length > 1) {
    const last = games[games.length - 1];
    if (last.a === 0 && last.b === 0 && gameWinner(games[games.length - 2])) games.pop();
  }
  return games;
}

function CorrectSheet({
  open,
  onOpenChange,
  match,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  match: Match;
  onSave: (games: GameScore[]) => boolean;
}) {
  const [games, setGames] = useState<GameScore[]>([{ a: 0, b: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setGames(gamesForEditing(match));
      setError(null);
    }
  }

  const set = (i: number, side: keyof GameScore, value: number) => {
    setGames((gs) => gs.map((g, idx) => (idx === i ? { ...g, [side]: Math.max(0, Math.min(POINT_CAP, value)) } : g)));
    setError(null);
  };

  const save = () => {
    const problem = validateCorrection(games);
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
          {games.length < 3 ? (
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
