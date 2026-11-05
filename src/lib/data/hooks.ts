"use client";

import { onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { GameScore, Match, Player, ScoringRules, Side, Team, Tournament } from "@/lib/domain/types";
import { ensureAuth } from "@/lib/firebase/client";
import { parseMatch, parsePlayer, parseTeam, parseTournament } from "./converters";
import { describeError, matchesCol, playersCol, teamsCol, tournamentRef } from "./refs";
import { applyOp, applyScoreOp, ScoreConflictError, type ScoreOp } from "./scoring";

export type LoadStatus = "loading" | "ready" | "not-found" | "error";

export interface TournamentData {
  status: LoadStatus;
  error: string | null;
  tournament: Tournament | null;
  players: Player[];
  teams: Team[];
  matches: Match[];
  /** True while the latest data came from the local cache rather than the server. */
  fromCache: boolean;
  /** True once players, teams and matches have each delivered a snapshot. */
  collectionsReady: boolean;
}

const initial: TournamentData = {
  status: "loading",
  error: null,
  tournament: null,
  players: [],
  teams: [],
  matches: [],
  fromCache: false,
  collectionsReady: false,
};

/** Live subscription to a tournament and all of its players, teams and matches. */
export function useTournamentData(code: string): TournamentData {
  const [data, setData] = useState<TournamentData>(initial);
  const [prevCode, setPrevCode] = useState(code);
  if (prevCode !== code) {
    setPrevCode(code);
    setData(initial);
  }

  useEffect(() => {
    let cancelled = false;
    const unsubs: (() => void)[] = [];
    const fail = (err: unknown) => {
      if (cancelled) return;
      setData((d) => (d.status === "not-found" ? d : { ...d, status: "error", error: describeError(err) }));
    };

    ensureAuth()
      .then(() => {
        if (cancelled) return;
        unsubs.push(
          onSnapshot(
            tournamentRef(code),
            { includeMetadataChanges: true },
            (snap) => {
              if (!snap.exists()) {
                if (snap.metadata.fromCache) return;
                setData((d) => ({ ...d, status: "not-found", tournament: null }));
                return;
              }
              setData((d) => ({
                ...d,
                status: "ready",
                error: null,
                tournament: parseTournament(snap),
                fromCache: snap.metadata.fromCache,
              }));
            },
            fail,
          ),
        );
        const seen = { players: false, teams: false, matches: false };
        const apply = (key: keyof typeof seen, patch: Partial<TournamentData>) => {
          if (cancelled) return;
          seen[key] = true;
          setData((d) => ({
            ...d,
            ...patch,
            collectionsReady: seen.players && seen.teams && seen.matches,
          }));
        };
        unsubs.push(
          onSnapshot(
            playersCol(code),
            (snap) => apply("players", { players: snap.docs.map(parsePlayer) }),
            fail,
          ),
          onSnapshot(
            teamsCol(code),
            (snap) => apply("teams", { teams: snap.docs.map(parseTeam) }),
            fail,
          ),
          onSnapshot(
            matchesCol(code),
            (snap) => apply("matches", { matches: snap.docs.map(parseMatch) }),
            fail,
          ),
        );
      })
      .catch(fail);

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [code]);

  return data;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Scoring controller for one match. Taps are applied optimistically and queued so a single
 * scorer never conflicts with themselves; a conflicting change from another device rejects the
 * queued taps and snaps back to the server score.
 */
interface QueuedOp {
  op: ScoreOp;
  /** Version written by the transaction; kept on screen until the live snapshot catches up. */
  committed: number | null;
}

export function useMatchScorer(code: string, match: Match | null, rules: ScoringRules) {
  const [items, setItems] = useState<QueuedOp[]>([]);
  const queue = useRef<QueuedOp[]>([]);
  const running = useRef(false);
  const knownVersion = useRef(0);
  const latest = useRef(match);
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  useEffect(() => {
    latest.current = match;
    if (!match) return;
    if (match.version > knownVersion.current) knownVersion.current = match.version;
    const before = queue.current.length;
    queue.current = queue.current.filter((q) => q.committed === null || q.committed > match.version);
    if (queue.current.length !== before) setItems([...queue.current]);
  }, [match]);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = queue.current.find((q) => q.committed === null);
        const current = latest.current;
        if (!next || !current) break;
        try {
          const expected = Math.max(knownVersion.current, current.version);
          const version = await applyScoreOp(code, current.id, expected, next.op);
          knownVersion.current = version;
          next.committed = version;
          const seen = latest.current?.version ?? 0;
          queue.current = queue.current.filter((q) => q.committed === null || q.committed > seen);
          setItems([...queue.current]);
        } catch (err) {
          queue.current = [];
          setItems([]);
          knownVersion.current = 0;
          if (err instanceof ScoreConflictError) toast.warning(err.message);
          else toast.error(describeError(err));
        }
      }
    } finally {
      running.current = false;
    }
  }, [code]);

  const submit = useCallback(
    (op: ScoreOp) => {
      const current = latest.current;
      if (!current) return false;
      try {
        let preview = current;
        for (const q of [...queue.current, { op, committed: null }]) preview = applyOp(preview, q.op, rulesRef.current);
      } catch (err) {
        toast.error(describeError(err));
        return false;
      }
      queue.current.push({ op, committed: null });
      setItems([...queue.current]);
      void pump();
      return true;
    },
    [pump],
  );

  let display = match;
  if (match) {
    try {
      for (const q of items) {
        if (q.committed === null || q.committed > match.version) display = applyOp(display!, q.op, rules);
      }
    } catch {
      display = match;
    }
  }

  return {
    match: display,
    syncing: items.length > 0,
    point: (side: Side) => submit({ type: "point", side }),
    undo: () => submit({ type: "undo" }),
    correct: (games: GameScore[]) => submit({ type: "correct", games }),
    end: (winner: Side) => submit({ type: "end", winner }),
  };
}
