import {
  DEFAULT_SCORING_RULES,
  isRealParticipant,
  type GameScore,
  type Match,
  type MatchLength,
  type MatchStatus,
  type PointsToWin,
  type ScoringRules,
  type Side,
} from "./types";

const UNDO_LIMIT = 250;

/** Hard cap is nine points above the target: 20, 24, or 30. */
export function pointCap(pointsToWin: PointsToWin): number {
  return pointsToWin + 9;
}

export function gamesNeeded(matchLength: MatchLength): number {
  return matchLength === "single" ? 1 : 2;
}

export function maxGames(matchLength: MatchLength): number {
  return matchLength === "single" ? 1 : 3;
}

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

const key = (side: Side) => (side === "A" ? "a" : "b");

/** Winner of a single game (target, win by 2, cap nine above), or null if still in play. */
export function gameWinner(game: GameScore, rules: ScoringRules = DEFAULT_SCORING_RULES): Side | null {
  const cap = pointCap(rules.pointsToWin);
  const target = rules.pointsToWin;
  if (game.a >= cap) return "A";
  if (game.b >= cap) return "B";
  if (game.a >= target && game.a - game.b >= 2) return "A";
  if (game.b >= target && game.b - game.a >= 2) return "B";
  return null;
}

/** A finished game score that can actually occur in play (e.g. 21-19, 24-22, 30-29; not 25-20). */
export function isValidFinalScore(game: GameScore, rules: ScoringRules = DEFAULT_SCORING_RULES): boolean {
  if (!gameWinner(game, rules)) return false;
  const target = rules.pointsToWin;
  const cap = pointCap(target);
  const w = Math.max(game.a, game.b);
  const l = Math.min(game.a, game.b);
  if (w === target) return l <= target - 2;
  if (w > target && w < cap) return l === w - 2;
  if (w === cap) return l === cap - 1 || l === cap - 2;
  return false;
}

export function gamesWon(games: GameScore[], rules: ScoringRules = DEFAULT_SCORING_RULES): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const g of games) {
    const w = gameWinner(g, rules);
    if (w === "A") a++;
    else if (w === "B") b++;
  }
  return { a, b };
}

export function matchWinnerFromGames(games: GameScore[], rules: ScoringRules = DEFAULT_SCORING_RULES): Side | null {
  const won = gamesWon(games, rules);
  const needed = gamesNeeded(rules.matchLength);
  if (won.a >= needed) return "A";
  if (won.b >= needed) return "B";
  return null;
}

export function hasPoints(games: GameScore[]): boolean {
  return games.some((g) => g.a > 0 || g.b > 0);
}

/** The game currently in play (or the last game once the match is over). */
export function currentGame(games: GameScore[]): GameScore {
  return games[games.length - 1] ?? { a: 0, b: 0 };
}

export function currentGameNumber(games: GameScore[]): number {
  return Math.max(1, games.length);
}

/** Appends a fresh 0-0 game when the last game is finished but the match is not. */
export function normalizeGames(games: GameScore[], rules: ScoringRules = DEFAULT_SCORING_RULES): GameScore[] {
  const out = games.map((g) => ({ a: g.a, b: g.b }));
  const last = out[out.length - 1];
  if (last && gameWinner(last, rules) && !matchWinnerFromGames(out, rules) && out.length < maxGames(rules.matchLength)) {
    out.push({ a: 0, b: 0 });
  }
  return out;
}

/** Returns a human-readable problem with a set of corrected game scores, or null when valid. */
export function validateCorrection(games: GameScore[], rules: ScoringRules = DEFAULT_SCORING_RULES): string | null {
  const cap = pointCap(rules.pointsToWin);
  const limit = maxGames(rules.matchLength);
  if (games.length === 0) return "Enter at least one game.";
  if (games.length > limit) return `A match has at most ${limit} ${limit === 1 ? "game" : "games"}.`;
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const label = `Game ${i + 1}`;
    for (const v of [g.a, g.b]) {
      if (!Number.isInteger(v) || v < 0 || v > cap) {
        return `${label}: scores must be whole numbers from 0 to ${cap}.`;
      }
    }
    const isLast = i === games.length - 1;
    if (gameWinner(g, rules) && !isValidFinalScore(g, rules)) {
      return `${label}: ${g.a}–${g.b} isn't a possible final score.`;
    }
    if (!isLast) {
      if (!gameWinner(g, rules)) return `${label} must be finished before game ${i + 2} starts.`;
      if (matchWinnerFromGames(games.slice(0, i + 1), rules)) {
        return `The match was already decided after game ${i + 1}.`;
      }
    }
  }
  return null;
}

interface ScoreSnapshot {
  games: GameScore[];
  winner: Side | null;
  endedEarly: boolean;
}

export function encodeSnapshot(s: ScoreSnapshot): string {
  return JSON.stringify({ g: s.games.map((x) => [x.a, x.b]), w: s.winner, e: s.endedEarly });
}

export function decodeSnapshot(raw: string): ScoreSnapshot {
  const parsed = JSON.parse(raw) as { g: [number, number][]; w: Side | null; e: boolean };
  return {
    games: parsed.g.map(([a, b]) => ({ a, b })),
    winner: parsed.w ?? null,
    endedEarly: Boolean(parsed.e),
  };
}

function snapshotOf(match: Match): ScoreSnapshot {
  return { games: match.games, winner: match.winner, endedEarly: match.endedEarly };
}

export function statusFor(games: GameScore[], winner: Side | null): MatchStatus {
  if (winner) return "completed";
  return hasPoints(games) ? "live" : "upcoming";
}

function withScore(match: Match, next: ScoreSnapshot, pushUndo: boolean): Match {
  const undo = pushUndo
    ? [...match.undo, encodeSnapshot(snapshotOf(match))].slice(-UNDO_LIMIT)
    : match.undo;
  return {
    ...match,
    games: next.games,
    winner: next.winner,
    endedEarly: next.endedEarly,
    status: statusFor(next.games, next.winner),
    undo,
  };
}

function assertPlayable(match: Match) {
  if (!isRealParticipant(match.a) || !isRealParticipant(match.b)) {
    throw new ScoringError("Both sides need to be decided before this match can be scored.");
  }
}

export function addPoint(match: Match, side: Side, rules: ScoringRules = DEFAULT_SCORING_RULES): Match {
  assertPlayable(match);
  if (match.status === "completed") throw new ScoringError("This match is already finished.");
  const games = (match.games.length ? match.games : [{ a: 0, b: 0 }]).map((g) => ({ ...g }));
  const game = games[games.length - 1];
  game[key(side)] += 1;
  let winner: Side | null = null;
  if (gameWinner(game, rules)) {
    winner = matchWinnerFromGames(games, rules);
    if (!winner) games.push({ a: 0, b: 0 });
  }
  return withScore(match, { games, winner, endedEarly: false }, true);
}

export function canUndo(match: Match): boolean {
  return match.undo.length > 0;
}

export function undoLast(match: Match): Match {
  if (!match.undo.length) throw new ScoringError("Nothing to undo.");
  const previous = decodeSnapshot(match.undo[match.undo.length - 1]);
  return withScore({ ...match, undo: match.undo.slice(0, -1) }, previous, false);
}

export function correctScore(match: Match, games: GameScore[], rules: ScoringRules = DEFAULT_SCORING_RULES): Match {
  assertPlayable(match);
  const problem = validateCorrection(games, rules);
  if (problem) throw new ScoringError(problem);
  const normalized = normalizeGames(games, rules);
  const winner = matchWinnerFromGames(normalized, rules);
  return withScore(match, { games: normalized, winner, endedEarly: false }, true);
}

/** Ends a match before it is decided on points (retirement, injury or walkover). */
export function endEarly(match: Match, winner: Side): Match {
  assertPlayable(match);
  if (match.status === "completed") throw new ScoringError("This match is already finished.");
  return withScore(match, { games: match.games, winner, endedEarly: true }, true);
}

export function winnerId(match: Match): string | null {
  if (!match.winner) return null;
  return match.winner === "A" ? match.a : match.b;
}

export function loserId(match: Match): string | null {
  if (!match.winner) return null;
  return match.winner === "A" ? match.b : match.a;
}
