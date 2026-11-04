import { hasPoints, loserId, winnerId } from "./scoring";
import { BYE, isRealParticipant, type Match, type MatchLink } from "./types";

/**
 * Thrown by a getter when a match document hasn't been loaded yet. The data layer catches it,
 * loads the document (inside its transaction) and re-runs the pure function.
 */
export class MissingMatchError extends Error {
  constructor(public readonly matchId: string) {
    super(`Match ${matchId} is not loaded`);
    this.name = "MissingMatchError";
  }
}

export class ProgressionBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgressionBlockedError";
  }
}

/** Returns the match, null when it doesn't exist, or throws MissingMatchError when unknown. */
export type MatchGetter = (id: string) => Match | null;

export interface ProgressResult {
  changed: Map<string, Match>;
  created: Match[];
  deleted: string[];
  /** undefined = champion unchanged; string = new champion; null = champion cleared. */
  champion: string | null | undefined;
}

export function resetMatchId(grandFinalId: string): string {
  return `${grandFinalId}-reset`;
}

const clone = (m: Match): Match => ({
  ...m,
  games: m.games.map((g) => ({ ...g })),
  undo: [...m.undo],
});

/** Recomputes status for a match whose sides changed, auto-resolving byes. */
export function refreshSlots(m: Match): Match {
  if (m.a !== null && m.b !== null && (m.a === BYE || m.b === BYE)) {
    m.status = "completed";
    m.bye = true;
    m.winner = m.a === BYE && m.b !== BYE ? "B" : "A";
    return m;
  }
  m.bye = false;
  m.winner = null;
  m.status = m.a !== null && m.b !== null ? "upcoming" : "waiting";
  return m;
}

function isTerminal(m: Match): boolean {
  return m.nextWinner === null && (m.stage === "ko" || m.stage === "gf");
}

function linksOf(m: Match): [MatchLink | null, string | null][] {
  return [
    [m.nextWinner, winnerId(m)],
    [m.nextLoser, loserId(m)],
  ];
}

function makeLoader(get: MatchGetter, changed: Map<string, Match>) {
  return (id: string): Match => {
    const existing = changed.get(id);
    if (existing) return existing;
    const loaded = get(id);
    if (!loaded) throw new Error(`Bracket is missing match ${id}`);
    const copy = clone(loaded);
    changed.set(id, copy);
    return copy;
  };
}

/**
 * Pushes the result of a completed match through the bracket: places the winner/loser into
 * linked matches, resolves byes, creates the grand-final reset when needed and reports the champion.
 */
export function advance(start: Match, get: MatchGetter): ProgressResult {
  const changed = new Map<string, Match>();
  const created: Match[] = [];
  let champion: string | null | undefined = undefined;
  const load = makeLoader(get, changed);
  const queue: Match[] = [start];

  while (queue.length) {
    const m = queue.shift()!;
    if (m.status !== "completed" || !m.winner) continue;

    if (isTerminal(m)) {
      const w = winnerId(m);
      const needsReset =
        m.stage === "gf" &&
        m.round === 1 &&
        m.winner === "B" &&
        isRealParticipant(m.a) &&
        isRealParticipant(m.b);
      if (needsReset) {
        created.push({
          ...clone(m),
          id: resetMatchId(m.id),
          round: 2,
          slot: 0,
          order: m.order + 1,
          games: [],
          status: "upcoming",
          winner: null,
          bye: false,
          endedEarly: false,
          court: null,
          nextWinner: null,
          nextLoser: null,
          version: 0,
          undo: [],
        });
        champion = null;
      } else {
        champion = isRealParticipant(w) ? w : null;
      }
    }

    for (const [link, pid] of linksOf(m)) {
      if (!link || pid === null) continue;
      const target = load(link.matchId);
      if (link.side === "A") target.a = pid;
      else target.b = pid;
      refreshSlots(target);
      if (target.status === "completed") queue.push(target);
    }
  }
  changed.delete(start.id);
  return { changed, created, deleted: [], champion };
}

/**
 * Undoes the bracket effects of a match result (before it's reopened or its winner changes).
 * Throws ProgressionBlockedError when a downstream match has already been played.
 */
export function retract(prior: Match, get: MatchGetter): ProgressResult {
  const changed = new Map<string, Match>();
  const deleted: string[] = [];
  let champion: string | null | undefined = undefined;
  const load = makeLoader(get, changed);

  const walk = (m: Match) => {
    if (isTerminal(m)) {
      champion = null;
      if (m.stage === "gf" && m.round === 1) {
        const reset = get(resetMatchId(m.id));
        if (reset) {
          if (hasPoints(reset.games) || reset.status === "completed") {
            throw new ProgressionBlockedError(
              "The grand final reset has already started. Undo its score first.",
            );
          }
          deleted.push(reset.id);
        }
      }
    }
    for (const [link] of linksOf(m)) {
      if (!link) continue;
      const target = load(link.matchId);
      if (target.status === "completed" && target.bye) {
        walk(clone(target));
      } else if (target.status === "completed" || target.status === "live" || hasPoints(target.games)) {
        throw new ProgressionBlockedError(
          "A later match that depends on this result has already started. Undo that match first.",
        );
      }
      if (link.side === "A") target.a = null;
      else target.b = null;
      refreshSlots(target);
    }
  };

  walk(prior);
  return { changed, created: [], deleted, champion };
}

/** Resolves all byes in a freshly generated bracket (in place). */
export function resolveByes(matches: Match[]): Match[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const m of matches) {
    if (m.status !== "completed" && m.a !== null && m.b !== null) refreshSlots(m);
  }
  let progressed = true;
  const done = new Set<string>();
  while (progressed) {
    progressed = false;
    for (const m of matches) {
      if (m.status !== "completed" || done.has(m.id)) continue;
      done.add(m.id);
      progressed = true;
      const result = advance(m, (id) => byId.get(id) ?? null);
      for (const updated of result.changed.values()) Object.assign(byId.get(updated.id)!, updated);
    }
  }
  return matches;
}
