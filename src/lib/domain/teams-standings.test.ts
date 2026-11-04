import { describe, expect, it } from "vitest";
import { blankMatch, firstRoundPairs } from "./fixtures";
import { computeStandings, seedQualifiers } from "./standings";
import { pairPlayers, swapSlots } from "./teams";
import { normalizeCode, isValidCode, generateCode } from "./codes";
import type { GameScore, Match } from "./types";

describe("pairPlayers", () => {
  it.each([2, 3, 4, 7, 10, 15])("%i players: each assigned exactly once", (n) => {
    const players = Array.from({ length: n }, (_, i) => `p${i}`);
    const { pairs, unpaired } = pairPlayers(players);
    const placed = pairs.flat();
    if (unpaired) placed.push(unpaired);
    expect(placed.sort()).toEqual([...players].sort());
    expect(pairs).toHaveLength(Math.floor(n / 2));
    expect(unpaired !== null).toBe(n % 2 === 1);
  });

  it("swaps between teams and with the unpaired player", () => {
    const pairing = { pairs: [["a", "b"], ["c", "d"]] as [string, string][], unpaired: "e" };
    const swapped = swapSlots(pairing, { team: 0, position: 1 }, { team: 1, position: 0 });
    expect(swapped.pairs).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
    const withBench = swapSlots(swapped, { team: 1, position: 1 }, { team: null, position: 0 });
    expect(withBench.pairs[1]).toEqual(["b", "e"]);
    expect(withBench.unpaired).toBe("d");
  });
});

function result(id: string, a: string, b: string, games: GameScore[], winner: "A" | "B"): Match {
  return blankMatch({ id, category: "singles", stage: "rr", round: 1, slot: 0, a, b, games, winner, status: "completed" });
}

describe("computeStandings", () => {
  it("ranks by wins and breaks two-way ties head to head", () => {
    const ms = [
      result("1", "x", "y", [{ a: 21, b: 19 }, { a: 21, b: 19 }], "A"),
      result("2", "y", "z", [{ a: 21, b: 2 }, { a: 21, b: 2 }], "A"),
      result("3", "x", "z", [{ a: 5, b: 21 }, { a: 5, b: 21 }], "B"),
      result("4", "w", "z", [{ a: 5, b: 21 }, { a: 5, b: 21 }], "B"),
      result("5", "x", "w", [{ a: 21, b: 5 }, { a: 21, b: 5 }], "A"),
      result("6", "y", "w", [{ a: 21, b: 5 }, { a: 21, b: 5 }], "A"),
    ];
    // x: 2 wins, y: 2 wins, z: 2 wins → three-way tie broken by game diff then point diff
    const rows = computeStandings(["x", "y", "z", "w"], ms);
    expect(rows.map((r) => r.id)).toEqual(["y", "z", "x", "w"]);
    expect(rows[3]).toMatchObject({ played: 3, won: 0, lost: 3 });
    expect(rows[0].pointDiff).toBe(66);
  });

  it("uses head-to-head for exactly two tied players", () => {
    const ms = [
      result("1", "a", "b", [{ a: 21, b: 19 }, { a: 21, b: 19 }], "A"),
      result("2", "b", "c", [{ a: 21, b: 0 }, { a: 21, b: 0 }], "A"),
      result("3", "a", "c", [{ a: 0, b: 21 }, { a: 0, b: 21 }], "B"),
      result("4", "c", "d", [{ a: 21, b: 0 }, { a: 21, b: 0 }], "A"),
    ];
    // a: 1 win, b: 1 win, c: 2 wins; a beat b
    const rows = computeStandings(["a", "b", "c", "d"], ms);
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("ignores byes and unfinished matches", () => {
    const bye = { ...result("1", "a", "b", [], "A"), bye: true };
    const live = { ...result("2", "a", "b", [{ a: 3, b: 1 }], "A"), status: "live" as const, winner: null };
    const rows = computeStandings(["a", "b"], [bye, live]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});

describe("seedQualifiers", () => {
  const groupOf = (id: string) => id[0];
  it.each([2, 3, 4, 5, 6])("%i groups: no same-group first-round meetings", (g) => {
    const groups = Array.from({ length: g }, (_, i) => [`${"ABCDEF"[i]}1`, `${"ABCDEF"[i]}2`]);
    const seeded = seedQualifiers(groups, 2);
    expect(seeded).toHaveLength(2 * g);
    for (const [x, y] of firstRoundPairs(seeded.length)) {
      if (x < 0 || y < 0) continue;
      expect(groupOf(seeded[x])).not.toBe(groupOf(seeded[y]));
    }
  });
});

describe("codes", () => {
  it("generates valid codes and normalizes input", () => {
    for (let i = 0; i < 100; i++) expect(isValidCode(generateCode())).toBe(true);
    expect(normalizeCode(" bdm-482 ")).toBe("BDM482");
    expect(normalizeCode("https://example.com/t/BDM482?x=1")).toBe("BDM482");
  });
});
