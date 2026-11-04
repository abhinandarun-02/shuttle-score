import { describe, expect, it } from "vitest";
import {
  assignGroups,
  doubleEliminationMatches,
  generateFixtures,
  knockoutMatches,
  roundRobinPairings,
  seedOrder,
} from "./fixtures";
import { advance } from "./progression";
import { correctScore, loserId, winnerId } from "./scoring";
import { BYE, isRealParticipant, type Match, type Side } from "./types";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

function idFactory() {
  let i = 0;
  return () => `m${++i}`;
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const key = (a: string, b: string) => [a, b].sort().join("|");

describe("round robin", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 11, 16])("%i players: every pair exactly once, no clashes", (n) => {
    const rounds = roundRobinPairings(ids(n));
    const seen = new Set<string>();
    for (const round of rounds) {
      const inRound = new Set<string>();
      for (const [a, b] of round) {
        expect(a).not.toBe(b);
        expect(inRound.has(a) || inRound.has(b)).toBe(false);
        inRound.add(a);
        inRound.add(b);
        const k = key(a, b);
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    expect(seen.size).toBe((n * (n - 1)) / 2);
    expect(rounds).toHaveLength(n % 2 === 0 ? n - 1 : n);
  });

  it("generates upcoming matches with unique ids", () => {
    const plan = generateFixtures({ category: "singles", format: "round_robin", participantIds: ids(5), newId: idFactory() });
    expect(plan.matches).toHaveLength(10);
    expect(new Set(plan.matches.map((m) => m.id)).size).toBe(10);
    expect(plan.matches.every((m) => m.status === "upcoming")).toBe(true);
  });
});

describe("groups", () => {
  it("snake-assigns everyone to exactly one group with balanced sizes", () => {
    for (let n = 4; n <= 20; n++) {
      const plan = generateFixtures({ category: "singles", format: "groups", participantIds: ids(n), newId: idFactory(), rng: seededRng(n) });
      const groups = new Map<number, Set<string>>();
      for (const m of plan.matches) {
        const g = groups.get(m.group!) ?? new Set();
        g.add(m.a!);
        g.add(m.b!);
        groups.set(m.group!, g);
      }
      expect(groups.size).toBe(plan.groupCount);
      const all = [...groups.values()].flatMap((g) => [...g]);
      expect(new Set(all).size).toBe(n);
      expect(all).toHaveLength(n);
      const sizes = [...groups.values()].map((g) => g.size);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(plan.qualifiersPerGroup).toBe(Math.min(...sizes) >= 3 ? 2 : 1);
    }
  });

  it("assignGroups snakes", () => {
    expect(assignGroups(ids(8), 2)).toEqual([
      ["p1", "p4", "p5", "p8"],
      ["p2", "p3", "p6", "p7"],
    ]);
  });
});

describe("seedOrder", () => {
  it("places top seeds apart", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

/** Plays every playable match (random winner) until the bracket is finished. */
function simulate(initial: Match[], rng: () => number) {
  const byId = new Map(initial.map((m) => [m.id, m]));
  let champion: string | null | undefined;
  const played: Match[] = [];
  for (let guard = 0; guard < 1000; guard++) {
    const next = [...byId.values()]
      .filter((m) => m.status === "upcoming")
      .sort((x, y) => x.order - y.order)[0];
    if (!next) break;
    const side: Side = rng() < 0.5 ? "A" : "B";
    const games = side === "A" ? [{ a: 21, b: 10 }, { a: 21, b: 12 }] : [{ a: 10, b: 21 }, { a: 12, b: 21 }];
    const done = correctScore(next, games);
    byId.set(done.id, done);
    played.push(done);
    const result = advance(done, (id) => byId.get(id) ?? null);
    for (const m of result.changed.values()) byId.set(m.id, m);
    for (const m of result.created) byId.set(m.id, m);
    if (result.champion !== undefined) champion = result.champion;
  }
  return { byId, champion, played };
}

describe("knockout", () => {
  it.each(Array.from({ length: 16 }, (_, i) => i + 2))("%i entries: byes resolve and a single champion emerges", (n) => {
    const matches = knockoutMatches(ids(n), "singles", idFactory());
    const size = 2 ** Math.ceil(Math.log2(n));
    expect(matches).toHaveLength(size - 1);
    const byes = matches.filter((m) => m.bye);
    expect(byes).toHaveLength(size - n);
    for (const m of byes) expect(isRealParticipant(winnerId(m))).toBe(true);
    const round2 = matches.filter((m) => m.round === 2);
    for (const m of round2) expect(m.a === BYE || m.b === BYE).toBe(false);

    const { champion, played, byId } = simulate(matches, seededRng(n));
    expect(played).toHaveLength(n - 1);
    expect(champion && isRealParticipant(champion)).toBe(true);
    expect([...byId.values()].every((m) => m.status === "completed")).toBe(true);
    const losers = played.map((m) => loserId(m));
    expect(new Set(losers).size).toBe(n - 1);
    expect(losers).not.toContain(champion);
  });

  it("top seeds receive the byes", () => {
    const matches = knockoutMatches(ids(5), "singles", idFactory());
    const byeWinners = matches.filter((m) => m.bye).map((m) => winnerId(m));
    expect(byeWinners.sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("double elimination", () => {
  it.each(Array.from({ length: 16 }, (_, i) => i + 2))(
    "%i entries: everyone but the champion is out after exactly two losses",
    (n) => {
      for (let seed = 1; seed <= 6; seed++) {
        const matches = doubleEliminationMatches(ids(n), "singles", idFactory());
        const { byId, champion, played } = simulate(matches, seededRng(seed * 97 + n));
        expect(champion && isRealParticipant(champion)).toBe(true);
        for (const m of byId.values()) expect(m.status).toBe("completed");

        const losses = new Map<string, number>();
        for (const m of played) {
          for (const p of [m.a!, m.b!]) {
            expect((losses.get(p) ?? 0) < 2).toBe(true);
          }
          const l = loserId(m)!;
          losses.set(l, (losses.get(l) ?? 0) + 1);
        }
        for (const p of ids(n)) {
          if (p === champion) expect(losses.get(p) ?? 0).toBeLessThanOrEqual(1);
          else expect(losses.get(p)).toBe(2);
        }
      }
    },
  );

  it("creates a reset final only when the losers-bracket finalist wins", () => {
    const matches = doubleEliminationMatches(ids(4), "singles", idFactory());
    const byId = new Map(matches.map((m) => [m.id, m]));
    const gf = matches.find((m) => m.stage === "gf")!;
    const ready = { ...gf, a: "p1", b: "p2", status: "upcoming" as const };
    const bWins = correctScore(ready, [{ a: 1, b: 21 }, { a: 2, b: 21 }]);
    const r1 = advance(bWins, (id) => byId.get(id) ?? null);
    expect(r1.created).toHaveLength(1);
    expect(r1.champion).toBeNull();
    const aWins = correctScore(ready, [{ a: 21, b: 1 }, { a: 21, b: 2 }]);
    const r2 = advance(aWins, (id) => byId.get(id) ?? null);
    expect(r2.created).toHaveLength(0);
    expect(r2.champion).toBe("p1");
  });
});
