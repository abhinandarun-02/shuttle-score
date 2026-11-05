import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import {
  emptyCategoryState,
  scoringRulesOf,
  type Category,
  type CategoryState,
  type Format,
  type GameScore,
  type Match,
  type MatchLink,
  type Player,
  type Team,
  type Tournament,
} from "@/lib/domain/types";

type Snap = DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>;

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function link(v: unknown): MatchLink | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.matchId !== "string" || (o.side !== "A" && o.side !== "B")) return null;
  return { matchId: o.matchId, side: o.side };
}

function games(v: unknown): GameScore[] {
  if (!Array.isArray(v)) return [];
  return v.map((g) => ({ a: num((g as GameScore)?.a), b: num((g as GameScore)?.b) }));
}

export function parseTournament(snap: Snap): Tournament {
  const d = snap.data() ?? {};
  const categories = (Array.isArray(d.categories) ? d.categories : []).filter(
    (c: unknown): c is Category => c === "singles" || c === "doubles",
  );
  const state: Tournament["state"] = {};
  for (const c of categories) {
    const raw = (d.state?.[c] ?? {}) as Partial<CategoryState>;
    state[c] = { ...emptyCategoryState(), ...raw };
  }
  const rules = scoringRulesOf(d);
  return {
    code: snap.id,
    name: str(d.name) ?? "Tournament",
    categories,
    format: (d.format as Format) ?? "round_robin",
    pointsToWin: rules.pointsToWin,
    matchLength: rules.matchLength,
    createdAt: num(d.createdAt),
    createdBy: str(d.createdBy) ?? "",
    state,
  };
}

export function parsePlayer(snap: Snap): Player {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    name: str(d.name) ?? "",
    category: d.category === "doubles" ? "doubles" : "singles",
    createdAt: num(d.createdAt),
  };
}

export function parseTeam(snap: Snap): Team {
  const d = snap.data() ?? {};
  const ids = Array.isArray(d.playerIds) ? d.playerIds : [];
  return {
    id: snap.id,
    category: "doubles",
    playerIds: [String(ids[0] ?? ""), String(ids[1] ?? "")],
    order: num(d.order),
  };
}

export function parseMatch(snap: Snap): Match {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    category: d.category === "doubles" ? "doubles" : "singles",
    stage: d.stage ?? "rr",
    round: num(d.round, 1),
    slot: num(d.slot),
    group: typeof d.group === "number" ? d.group : null,
    order: num(d.order),
    a: str(d.a),
    b: str(d.b),
    games: games(d.games),
    status: d.status ?? "waiting",
    winner: d.winner === "A" || d.winner === "B" ? d.winner : null,
    bye: Boolean(d.bye),
    endedEarly: Boolean(d.endedEarly),
    court: str(d.court),
    nextWinner: link(d.nextWinner),
    nextLoser: link(d.nextLoser),
    version: num(d.version),
    undo: Array.isArray(d.undo) ? d.undo.filter((x: unknown) => typeof x === "string") : [],
    updatedAt: num(d.updatedAt),
  };
}

export function matchToDoc(m: Match): DocumentData {
  const { id: _id, ...rest } = m;
  void _id;
  return { ...rest, games: m.games.map((g) => ({ a: g.a, b: g.b })) };
}
