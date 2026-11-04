import { describe, expect, it } from "vitest";
import { knockoutMatches } from "./fixtures";
import { advance, ProgressionBlockedError, retract } from "./progression";
import { addPoint, correctScore } from "./scoring";
import type { Match } from "./types";

function idFactory() {
  let i = 0;
  return () => `m${++i}`;
}

const win = [
  { a: 21, b: 5 },
  { a: 21, b: 5 },
];

function setup(n: number) {
  const matches = knockoutMatches(Array.from({ length: n }, (_, i) => `p${i + 1}`), "singles", idFactory());
  const byId = new Map(matches.map((m) => [m.id, m]));
  const get = (id: string) => byId.get(id) ?? null;
  const apply = (ms: Iterable<Match>) => {
    for (const m of ms) byId.set(m.id, m);
  };
  return { matches, byId, get, apply };
}

describe("retract", () => {
  it("removes the winner from the next match when a result is reopened", () => {
    const { byId, get, apply } = setup(4);
    const first = [...byId.values()].find((m) => m.round === 1 && m.slot === 0)!;
    const done = correctScore(first, win);
    apply([done]);
    apply(advance(done, get).changed.values());
    const final = byId.get(first.nextWinner!.matchId)!;
    expect(final.a).toBe(done.a);

    const result = retract(done, get);
    apply(result.changed.values());
    expect(byId.get(final.id)!.a).toBeNull();
    expect(byId.get(final.id)!.status).toBe("waiting");
  });

  it("is blocked when the next match has started", () => {
    const { byId, get, apply } = setup(4);
    const r1 = [...byId.values()].filter((m) => m.round === 1);
    for (const m of r1) {
      const done = correctScore(m, win);
      apply([done]);
      apply(advance(done, get).changed.values());
    }
    const final = [...byId.values()].find((m) => m.round === 2)!;
    expect(final.status).toBe("upcoming");
    apply([addPoint(final, "A")]);
    expect(() => retract(byId.get(r1[0].id)!, get)).toThrow(ProgressionBlockedError);
  });

  it("clears the champion when the final is reopened", () => {
    const { byId, get, apply } = setup(2);
    const final = [...byId.values()][0];
    const done = correctScore(final, win);
    expect(advance(done, get).champion).toBe(done.a);
    expect(retract(done, get).champion).toBeNull();
    apply([done]);
  });
});
