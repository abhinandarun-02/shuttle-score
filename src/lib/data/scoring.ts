import { doc, runTransaction, serverTimestamp, updateDoc, type Transaction } from "firebase/firestore";
import {
  advance,
  MissingMatchError,
  retract,
  type MatchGetter,
  type ProgressResult,
} from "@/lib/domain/progression";
import { addPoint, correctScore, endEarly, undoLast, winnerId } from "@/lib/domain/scoring";
import type { GameScore, Match, Side } from "@/lib/domain/types";
import { ensureAuth, getFirebase } from "@/lib/firebase/client";
import { matchToDoc, parseMatch } from "./converters";
import { eventsCol, matchRef, tournamentRef, UserFacingError } from "./refs";

export type ScoreOp =
  | { type: "point"; side: Side }
  | { type: "undo" }
  | { type: "correct"; games: GameScore[] }
  | { type: "end"; winner: Side };

export class ScoreConflictError extends Error {
  constructor() {
    super("The score was changed on another device. You're now seeing the latest score.");
    this.name = "ScoreConflictError";
  }
}

export function applyOp(match: Match, op: ScoreOp): Match {
  switch (op.type) {
    case "point":
      return addPoint(match, op.side);
    case "undo":
      return undoLast(match);
    case "correct":
      return correctScore(match, op.games);
    case "end":
      return endEarly(match, op.winner);
  }
}

/**
 * Runs a pure bracket function inside a transaction, loading any match documents it asks for.
 * All reads happen before any write, as Firestore transactions require.
 */
async function withLoadedMatches<T>(
  tx: Transaction,
  code: string,
  originals: Map<string, Match | null>,
  fn: (get: MatchGetter) => T,
): Promise<T> {
  for (let i = 0; i < 500; i++) {
    try {
      return fn((id) => {
        if (!originals.has(id)) throw new MissingMatchError(id);
        return originals.get(id) ?? null;
      });
    } catch (err) {
      if (!(err instanceof MissingMatchError)) throw err;
      const snap = await tx.get(matchRef(code, err.matchId));
      originals.set(err.matchId, snap.exists() ? parseMatch(snap) : null);
    }
  }
  throw new Error("Bracket is too deep to update.");
}

function overlay(get: MatchGetter, result: ProgressResult | null): MatchGetter {
  if (!result) return get;
  return (id) => {
    if (result.deleted.includes(id)) return null;
    return result.changed.get(id) ?? get(id);
  };
}

/**
 * Applies one scoring action in a transaction. `expectedVersion` is the version the scorer last
 * saw; if anyone else changed the match in between, the action is rejected instead of
 * double-counting a rally. Returns the new version.
 */
export async function applyScoreOp(
  code: string,
  matchId: string,
  expectedVersion: number,
  op: ScoreOp,
): Promise<number> {
  const user = await ensureAuth();
  const { db } = getFirebase();
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef(code, matchId));
    if (!snap.exists()) throw new UserFacingError("This match no longer exists.");
    const before = parseMatch(snap);
    if (before.version !== expectedVersion) throw new ScoreConflictError();

    const after: Match = { ...applyOp(before, op), version: before.version + 1, updatedAt: Date.now() };
    const wasDone = before.status === "completed";
    const isDone = after.status === "completed";
    const winnerChanged = wasDone && isDone && winnerId(before) !== winnerId(after);

    const originals = new Map<string, Match | null>([[before.id, before]]);
    const results = await withLoadedMatches(tx, code, originals, (get) => {
      const out: ProgressResult[] = [];
      const retracted = wasDone && (!isDone || winnerChanged) ? retract(before, get) : null;
      if (retracted) out.push(retracted);
      if (isDone && (!wasDone || winnerChanged)) out.push(advance(after, overlay(get, retracted)));
      return out;
    });

    const changed = new Map<string, Match>();
    const deleted = new Set<string>();
    const created = new Map<string, Match>();
    let champion: string | null | undefined;
    for (const r of results) {
      for (const [id, m] of r.changed) changed.set(id, m);
      for (const id of r.deleted) deleted.add(id);
      for (const m of r.created) {
        created.set(m.id, m);
        deleted.delete(m.id);
      }
      if (r.champion !== undefined) champion = r.champion;
    }
    changed.delete(after.id);

    const createdExisting = new Map<string, number>();
    for (const id of created.keys()) {
      if (!originals.has(id)) {
        const s = await tx.get(matchRef(code, id));
        originals.set(id, s.exists() ? parseMatch(s) : null);
      }
      const prior = originals.get(id);
      if (prior) createdExisting.set(id, prior.version);
    }

    const now = Date.now();
    tx.set(matchRef(code, after.id), matchToDoc(after));
    for (const m of changed.values()) {
      const original = originals.get(m.id);
      if (!original) continue;
      tx.set(matchRef(code, m.id), matchToDoc({ ...m, version: original.version + 1, updatedAt: now }));
    }
    for (const m of created.values()) {
      const priorVersion = createdExisting.get(m.id);
      const version = priorVersion === undefined ? 0 : priorVersion + 1;
      tx.set(matchRef(code, m.id), matchToDoc({ ...m, version, updatedAt: now }));
    }
    for (const id of deleted) tx.delete(matchRef(code, id));
    if (champion !== undefined) {
      tx.update(tournamentRef(code), { [`state.${after.category}.championId`]: champion });
    }
    tx.set(doc(eventsCol(code, after.id)), {
      type: op.type,
      side: op.type === "point" ? op.side : op.type === "end" ? op.winner : null,
      games: after.games,
      version: after.version,
      by: user.uid,
      at: serverTimestamp(),
    });
    return after.version;
  });
}

export async function setCourt(code: string, matchId: string, court: string) {
  await ensureAuth();
  const clean = court.trim().slice(0, 12);
  await updateDoc(matchRef(code, matchId), { court: clean || null, updatedAt: Date.now() });
}
