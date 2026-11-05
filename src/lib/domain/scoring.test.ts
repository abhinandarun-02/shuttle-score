import { describe, expect, it } from "vitest";
import { blankMatch } from "./fixtures";
import {
  addPoint,
  correctScore,
  endEarly,
  gameWinner,
  isValidFinalScore,
  matchWinnerFromGames,
  undoLast,
  validateCorrection,
} from "./scoring";
import type { Match, ScoringRules, Side } from "./types";

const fresh = (): Match =>
  blankMatch({ id: "m", category: "singles", stage: "rr", round: 1, slot: 0, a: "p1", b: "p2", status: "upcoming" });

function play(m: Match, sides: string, rules?: ScoringRules): Match {
  for (const ch of sides) m = rules ? addPoint(m, ch as Side, rules) : addPoint(m, ch as Side);
  return m;
}

const times = (side: Side, n: number) => side.repeat(n);

describe("gameWinner", () => {
  it.each([
    [21, 19, "A"],
    [19, 21, "B"],
    [21, 20, null],
    [22, 20, "A"],
    [20, 22, "B"],
    [29, 29, null],
    [30, 29, "A"],
    [29, 30, "B"],
    [28, 29, null],
    [0, 21, "B"],
    [20, 20, null],
  ] as const)("%i-%i → %s", (a, b, expected) => {
    expect(gameWinner({ a, b })).toBe(expected);
  });
});

describe("isValidFinalScore", () => {
  it.each([
    [21, 0, true],
    [21, 19, true],
    [22, 20, true],
    [27, 25, true],
    [30, 29, true],
    [30, 28, true],
    [21, 20, false],
    [25, 20, false],
    [23, 20, false],
    [30, 27, false],
  ] as const)("%i-%i → %s", (a, b, expected) => {
    expect(isValidFinalScore({ a, b })).toBe(expected);
  });
});

describe("addPoint", () => {
  it("starts the match and marks it live", () => {
    const m = addPoint(fresh(), "A");
    expect(m.status).toBe("live");
    expect(m.games).toEqual([{ a: 1, b: 0 }]);
  });

  it("finishes a game at 21-19 and opens game 2", () => {
    const m = play(fresh(), times("B", 19) + times("A", 21));
    expect(m.games).toEqual([
      { a: 21, b: 19 },
      { a: 0, b: 0 },
    ]);
    expect(m.status).toBe("live");
  });

  it("does not finish at 21-20 (win by two)", () => {
    const m = play(fresh(), times("B", 20) + times("A", 21));
    expect(m.games).toEqual([{ a: 21, b: 20 }]);
    const m2 = addPoint(m, "A");
    expect(m2.games[0]).toEqual({ a: 22, b: 20 });
    expect(m2.games).toHaveLength(2);
  });

  it("at 29-29 the next point wins, capped at 30", () => {
    let m = fresh();
    m = play(m, "AB".repeat(29));
    expect(m.games).toEqual([{ a: 29, b: 29 }]);
    m = addPoint(m, "B");
    expect(m.games[0]).toEqual({ a: 29, b: 30 });
    expect(m.games).toHaveLength(2);
  });

  it("finishes the match after two games won", () => {
    let m = play(fresh(), times("A", 21));
    m = play(m, times("A", 21));
    expect(m.status).toBe("completed");
    expect(m.winner).toBe("A");
    expect(m.games).toHaveLength(2);
    expect(() => addPoint(m, "B")).toThrow(/finished/);
  });

  it("goes to a deciding third game at one game all", () => {
    let m = play(fresh(), times("A", 21));
    m = play(m, times("B", 21));
    expect(m.games).toHaveLength(3);
    m = play(m, times("B", 21));
    expect(m.winner).toBe("B");
    expect(matchWinnerFromGames(m.games)).toBe("B");
  });

  it("refuses to score a match whose sides are not decided", () => {
    const m = { ...fresh(), b: null };
    expect(() => addPoint(m, "A")).toThrow(/decided/);
  });
});

describe("undo", () => {
  it("reverts single points", () => {
    let m = play(fresh(), "AAB");
    m = undoLast(m);
    expect(m.games).toEqual([{ a: 2, b: 0 }]);
  });

  it("reopens a finished match across the game boundary", () => {
    let m = play(fresh(), times("A", 21) + times("A", 21));
    expect(m.status).toBe("completed");
    m = undoLast(m);
    expect(m.status).toBe("live");
    expect(m.winner).toBeNull();
    expect(m.games).toEqual([
      { a: 21, b: 0 },
      { a: 20, b: 0 },
    ]);
  });

  it("returns to upcoming when all points are undone", () => {
    let m = play(fresh(), "A");
    m = undoLast(m);
    expect(m.status).toBe("upcoming");
    expect(() => undoLast(m)).toThrow();
  });

  it("can undo a correction and an early end", () => {
    let m = play(fresh(), "AAA");
    m = correctScore(m, [{ a: 10, b: 4 }]);
    m = endEarly(m, "B");
    expect(m.status).toBe("completed");
    expect(m.endedEarly).toBe(true);
    m = undoLast(m);
    expect(m.games).toEqual([{ a: 10, b: 4 }]);
    m = undoLast(m);
    expect(m.games).toEqual([{ a: 3, b: 0 }]);
  });
});

describe("validateCorrection / correctScore", () => {
  it("accepts an in-progress state", () => {
    expect(validateCorrection([{ a: 21, b: 15 }, { a: 4, b: 8 }])).toBeNull();
  });

  it("rejects impossible finals and unfinished earlier games", () => {
    expect(validateCorrection([{ a: 25, b: 20 }])).toMatch(/possible final/);
    expect(validateCorrection([{ a: 20, b: 15 }, { a: 1, b: 0 }])).toMatch(/must be finished/);
    expect(validateCorrection([{ a: 21, b: 1 }, { a: 21, b: 1 }, { a: 0, b: 0 }])).toMatch(/already decided/);
    expect(validateCorrection([{ a: 31, b: 29 }])).toMatch(/0 to 30/);
    expect(validateCorrection([])).toMatch(/at least one/);
  });

  it("completes the match when corrected to a decided score", () => {
    const m = correctScore(fresh(), [
      { a: 21, b: 18 },
      { a: 30, b: 29 },
    ]);
    expect(m.status).toBe("completed");
    expect(m.winner).toBe("A");
  });

  it("opens the next game when the last corrected game is finished", () => {
    const m = correctScore(fresh(), [{ a: 19, b: 21 }]);
    expect(m.games).toEqual([
      { a: 19, b: 21 },
      { a: 0, b: 0 },
    ]);
    expect(m.status).toBe("live");
  });
});

describe("other targets and match lengths", () => {
  const to15: ScoringRules = { pointsToWin: 15, matchLength: "best_of_3" };
  const to11: ScoringRules = { pointsToWin: 11, matchLength: "best_of_3" };
  const single: ScoringRules = { pointsToWin: 21, matchLength: "single" };

  it("wins a 15-point game by two and caps at 24", () => {
    expect(gameWinner({ a: 15, b: 13 }, to15)).toBe("A");
    expect(gameWinner({ a: 15, b: 14 }, to15)).toBeNull();
    expect(gameWinner({ a: 23, b: 22 }, to15)).toBeNull();
    expect(gameWinner({ a: 24, b: 23 }, to15)).toBe("A");
    expect(isValidFinalScore({ a: 24, b: 22 }, to15)).toBe(true);
    expect(isValidFinalScore({ a: 20, b: 15 }, to15)).toBe(false);
    const m = play(fresh(), times("B", 13) + times("A", 15), to15);
    expect(m.games[0]).toEqual({ a: 15, b: 13 });
    expect(m.games).toHaveLength(2);
    expect(m.status).toBe("live");
  });

  it("wins an 11-point game by two and caps at 20", () => {
    expect(gameWinner({ a: 11, b: 9 }, to11)).toBe("A");
    expect(gameWinner({ a: 11, b: 10 }, to11)).toBeNull();
    expect(gameWinner({ a: 20, b: 19 }, to11)).toBe("A");
    expect(isValidFinalScore({ a: 16, b: 14 }, to11)).toBe(true);
    expect(isValidFinalScore({ a: 15, b: 11 }, to11)).toBe(false);
    let m = play(fresh(), "AB".repeat(19), to11);
    expect(m.games).toEqual([{ a: 19, b: 19 }]);
    m = addPoint(m, "A", to11);
    expect(m.games[0]).toEqual({ a: 20, b: 19 });
    expect(m.games).toHaveLength(2);
  });

  it("ends a single-game match when that game is won and rejects a second game", () => {
    const m = play(fresh(), times("A", 21), single);
    expect(m.status).toBe("completed");
    expect(m.winner).toBe("A");
    expect(m.games).toHaveLength(1);
    expect(validateCorrection([{ a: 21, b: 10 }, { a: 1, b: 0 }], single)).toMatch(/at most 1 game/);
    expect(() => correctScore(fresh(), [{ a: 21, b: 5 }, { a: 21, b: 5 }], single)).toThrow(/at most 1/);
  });
});
