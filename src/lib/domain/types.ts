export type Category = "singles" | "doubles";
export type CategoryChoice = Category | "both";
export type Format = "round_robin" | "groups" | "knockout" | "double_elim";
export type Side = "A" | "B";
export type PointsToWin = 11 | 15 | 21;
export type MatchLength = "single" | "best_of_3";

export interface ScoringRules {
  pointsToWin: PointsToWin;
  matchLength: MatchLength;
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  pointsToWin: 21,
  matchLength: "best_of_3",
};

export function isPointsToWin(value: unknown): value is PointsToWin {
  return value === 11 || value === 15 || value === 21;
}

export function isMatchLength(value: unknown): value is MatchLength {
  return value === "single" || value === "best_of_3";
}

/** Rules stored on the tournament, or the historical default when a document predates them. */
export function scoringRulesOf(source: { pointsToWin?: unknown; matchLength?: unknown } | null | undefined): ScoringRules {
  return {
    pointsToWin: isPointsToWin(source?.pointsToWin) ? source.pointsToWin : DEFAULT_SCORING_RULES.pointsToWin,
    matchLength: isMatchLength(source?.matchLength) ? source.matchLength : DEFAULT_SCORING_RULES.matchLength,
  };
}

/** Sentinel participant id for an empty bracket slot that auto-advances the opponent. */
export const BYE = "BYE";

export interface GameScore {
  a: number;
  b: number;
}

/**
 * waiting   – at least one side is still to be decided by an earlier match
 * upcoming  – both sides known, no points scored
 * live      – points scored, no winner yet
 * completed – winner decided (by play, early end, or bye)
 */
export type MatchStatus = "waiting" | "upcoming" | "live" | "completed";

/**
 * rr    – round robin
 * group – group stage round robin
 * ko    – single-elimination knockout (incl. knockout after groups)
 * wb/lb – double elimination winners / losers bracket
 * gf    – double elimination grand final (round 2 is the bracket reset)
 */
export type Stage = "rr" | "group" | "ko" | "wb" | "lb" | "gf";

export interface MatchLink {
  matchId: string;
  side: Side;
}

export interface Match {
  id: string;
  category: Category;
  stage: Stage;
  round: number;
  slot: number;
  group: number | null;
  order: number;
  a: string | null;
  b: string | null;
  games: GameScore[];
  status: MatchStatus;
  winner: Side | null;
  bye: boolean;
  endedEarly: boolean;
  court: string | null;
  nextWinner: MatchLink | null;
  nextLoser: MatchLink | null;
  version: number;
  undo: string[];
  updatedAt: number;
}

export interface Player {
  id: string;
  name: string;
  category: Category;
  createdAt: number;
}

export interface Team {
  id: string;
  category: "doubles";
  playerIds: [string, string];
  order: number;
}

export interface Participant {
  id: string;
  name: string;
}

export type Phase = "registration" | "playing" | "knockout";

export interface CategoryState {
  phase: Phase;
  teamsConfirmed: boolean;
  championId: string | null;
  groupCount: number | null;
  qualifiersPerGroup: number | null;
}

export interface Tournament {
  code: string;
  name: string;
  categories: Category[];
  format: Format;
  pointsToWin: PointsToWin;
  matchLength: MatchLength;
  createdAt: number;
  createdBy: string;
  state: Partial<Record<Category, CategoryState>>;
}

export const FORMAT_LABELS: Record<Format, string> = {
  round_robin: "Round Robin",
  groups: "Group Stage",
  knockout: "Knockout",
  double_elim: "Double Elimination",
};

export const MATCH_LENGTH_LABELS: Record<MatchLength, string> = {
  single: "One game",
  best_of_3: "Best of 3",
};

export function scoringSummary(rules: ScoringRules): string {
  return `${rules.pointsToWin} · ${MATCH_LENGTH_LABELS[rules.matchLength]}`;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  singles: "Singles",
  doubles: "Doubles",
};

export const MIN_PARTICIPANTS: Record<Format, number> = {
  round_robin: 2,
  knockout: 2,
  double_elim: 3,
  groups: 4,
};

/** Keeps every fixture set within a single Firestore transaction (round robin grows quadratically). */
export const MAX_PARTICIPANTS: Record<Format, number> = {
  round_robin: 24,
  knockout: 64,
  double_elim: 64,
  groups: 64,
};

export const MAX_PLAYERS_PER_CATEGORY = 128;

export function emptyCategoryState(): CategoryState {
  return {
    phase: "registration",
    teamsConfirmed: false,
    championId: null,
    groupCount: null,
    qualifiersPerGroup: null,
  };
}

export function isRealParticipant(id: string | null): id is string {
  return id !== null && id !== BYE;
}
