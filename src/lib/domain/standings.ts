import { firstRoundPairs } from "./fixtures";
import { gamesWon } from "./scoring";
import { isRealParticipant, type Match } from "./types";

export interface StandingRow {
  id: string;
  rank: number;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

function countable(m: Match): boolean {
  return m.status === "completed" && !m.bye && isRealParticipant(m.a) && isRealParticipant(m.b);
}

/**
 * Ranks participants by matches won. Ties between two players are broken by their head-to-head
 * result; larger ties by game difference, then point difference, then points scored.
 */
export function computeStandings(participantIds: readonly string[], matches: readonly Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  participantIds.forEach((id) =>
    rows.set(id, {
      id,
      rank: 0,
      played: 0,
      won: 0,
      lost: 0,
      gamesWon: 0,
      gamesLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    }),
  );
  const relevant = matches.filter((m) => countable(m) && rows.has(m.a!) && rows.has(m.b!));
  for (const m of relevant) {
    const a = rows.get(m.a!)!;
    const b = rows.get(m.b!)!;
    const g = gamesWon(m.games);
    const pa = m.games.reduce((s, x) => s + x.a, 0);
    const pb = m.games.reduce((s, x) => s + x.b, 0);
    a.played++;
    b.played++;
    if (m.winner === "A") {
      a.won++;
      b.lost++;
    } else {
      b.won++;
      a.lost++;
    }
    a.gamesWon += g.a;
    a.gamesLost += g.b;
    b.gamesWon += g.b;
    b.gamesLost += g.a;
    a.pointsFor += pa;
    a.pointsAgainst += pb;
    b.pointsFor += pb;
    b.pointsAgainst += pa;
  }
  for (const r of rows.values()) r.pointDiff = r.pointsFor - r.pointsAgainst;

  const order = new Map(participantIds.map((id, i) => [id, i]));
  const byStats = (x: StandingRow, y: StandingRow) =>
    y.gamesWon - y.gamesLost - (x.gamesWon - x.gamesLost) ||
    y.pointDiff - x.pointDiff ||
    y.pointsFor - x.pointsFor ||
    order.get(x.id)! - order.get(y.id)!;

  const headToHead = (x: string, y: string): number => {
    const m = relevant.find((mm) => (mm.a === x && mm.b === y) || (mm.a === y && mm.b === x));
    if (!m) return 0;
    const winner = m.winner === "A" ? m.a : m.b;
    return winner === x ? -1 : 1;
  };

  const byWins = [...rows.values()].sort((x, y) => y.won - x.won);
  const result: StandingRow[] = [];
  for (let i = 0; i < byWins.length; ) {
    let j = i;
    while (j < byWins.length && byWins[j].won === byWins[i].won) j++;
    const tied = byWins.slice(i, j);
    if (tied.length === 2) {
      tied.sort((x, y) => headToHead(x.id, y.id) || byStats(x, y));
    } else {
      tied.sort(byStats);
    }
    result.push(...tied);
    i = j;
  }
  result.forEach((r, i) => (r.rank = i + 1));
  return result;
}

/**
 * Orders group qualifiers into knockout seeds: all group winners first, then runners-up rotated
 * so that two players from the same group don't meet in the first knockout round when avoidable.
 */
export function seedQualifiers(rankedGroups: readonly string[][], qualifiersPerGroup: number): string[] {
  const groupOf = new Map<string, number>();
  rankedGroups.forEach((g, gi) => g.forEach((id) => groupOf.set(id, gi)));
  const tiers: string[][] = [];
  for (let t = 0; t < qualifiersPerGroup; t++) {
    tiers.push(rankedGroups.map((g) => g[t]).filter((x): x is string => Boolean(x)));
  }
  const winners = tiers[0] ?? [];
  if (tiers.length < 2) return winners;
  const runners = tiers[1];

  const clashes = (seeded: string[]) =>
    firstRoundPairs(seeded.length).filter(
      ([x, y]) => x >= 0 && y >= 0 && groupOf.get(seeded[x]) === groupOf.get(seeded[y]),
    ).length;

  let best: string[] = [...winners, ...runners];
  let bestClashes = clashes(best);
  for (const list of [runners, [...runners].reverse()]) {
    for (let k = 0; k < list.length && bestClashes > 0; k++) {
      const rotated = [...list.slice(k), ...list.slice(0, k)];
      const candidate = [...winners, ...rotated];
      const c = clashes(candidate);
      if (c < bestClashes) {
        best = candidate;
        bestClashes = c;
      }
    }
  }
  return best;
}
