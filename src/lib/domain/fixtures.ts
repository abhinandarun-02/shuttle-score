import { resolveByes } from "./progression";
import { shuffle, type Rng } from "./teams";
import {
  BYE,
  MIN_PARTICIPANTS,
  type Category,
  type Format,
  type Match,
  type Side,
  type Stage,
} from "./types";

export type IdFactory = () => string;

export function blankMatch(
  init: Pick<Match, "id" | "category" | "stage" | "round" | "slot"> & Partial<Match>,
): Match {
  return {
    group: null,
    order: 0,
    a: null,
    b: null,
    games: [],
    status: "waiting",
    winner: null,
    bye: false,
    endedEarly: false,
    court: null,
    nextWinner: null,
    nextLoser: null,
    version: 0,
    undo: [],
    updatedAt: 0,
    ...init,
  };
}

function initialStatus(m: Match): Match {
  if (m.a !== null && m.b !== null && m.a !== BYE && m.b !== BYE) m.status = "upcoming";
  return m;
}

// ---------------------------------------------------------------------------
// Round robin (circle method)
// ---------------------------------------------------------------------------

/** Every participant meets every other participant exactly once; nobody plays twice in a round. */
export function roundRobinPairings(ids: readonly string[]): [string, string][][] {
  const list: (string | null)[] = [...ids];
  if (list.length < 2) return [];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = list[i];
      const y = list[n - 1 - i];
      if (x === null || y === null) continue;
      round.push(i === 0 && r % 2 === 1 ? [y, x] : [x, y]);
    }
    rounds.push(round);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

function roundRobinMatches(
  ids: readonly string[],
  category: Category,
  stage: Stage,
  newId: IdFactory,
  group: number | null = null,
): Match[] {
  return roundRobinPairings(ids).flatMap((round, r) =>
    round.map(([a, b], slot) =>
      initialStatus(blankMatch({ id: newId(), category, stage, round: r + 1, slot, group, a, b })),
    ),
  );
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export function groupCountFor(n: number): number {
  return Math.max(2, Math.round(n / 4));
}

/** Snake distribution keeps group sizes within one of each other. */
export function assignGroups(ids: readonly string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  ids.forEach((id, i) => {
    const row = Math.floor(i / groupCount);
    const col = row % 2 === 0 ? i % groupCount : groupCount - 1 - (i % groupCount);
    groups[col].push(id);
  });
  return groups;
}

export function qualifiersPerGroupFor(groups: string[][]): number {
  return Math.min(...groups.map((g) => g.length)) >= 3 ? 2 : 1;
}

export const GROUP_NAMES = "ABCDEFGHIJKLMNOP";

// ---------------------------------------------------------------------------
// Brackets
// ---------------------------------------------------------------------------

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** Bracket positions for seeds 1..size so that top seeds meet as late as possible (1 v 8, 4 v 5, 2 v 7, 3 v 6…). */
export function seedOrder(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const len = seeds.length * 2;
    seeds = seeds.flatMap((s) => [s, len + 1 - s]);
  }
  return seeds;
}

/** First-round pairs (as indexes into the seeded list, or -1 for a bye) for a bracket. */
export function firstRoundPairs(count: number): [number, number][] {
  const size = nextPowerOfTwo(Math.max(2, count));
  const order = seedOrder(size).map((s) => (s <= count ? s - 1 : -1));
  const pairs: [number, number][] = [];
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

const sideOf = (index: number): Side => (index % 2 === 0 ? "A" : "B");

interface Bracket {
  rounds: Match[][];
}

function buildSingleBracket(
  seeded: readonly string[],
  category: Category,
  stage: Stage,
  newId: IdFactory,
): Bracket {
  const size = nextPowerOfTwo(Math.max(2, seeded.length));
  const roundCount = Math.log2(size);
  const rounds: Match[][] = [];
  for (let r = 1; r <= roundCount; r++) {
    rounds.push(
      Array.from({ length: size / 2 ** r }, (_, slot) =>
        blankMatch({ id: newId(), category, stage, round: r, slot }),
      ),
    );
  }
  firstRoundPairs(seeded.length).forEach(([x, y], slot) => {
    const m = rounds[0][slot];
    m.a = x >= 0 ? seeded[x] : BYE;
    m.b = y >= 0 ? seeded[y] : BYE;
    initialStatus(m);
  });
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((m, slot) => {
      m.nextWinner = { matchId: rounds[r + 1][Math.floor(slot / 2)].id, side: sideOf(slot) };
    });
  }
  return { rounds };
}

export function knockoutMatches(
  seeded: readonly string[],
  category: Category,
  newId: IdFactory,
  orderOffset = 0,
): Match[] {
  const { rounds } = buildSingleBracket(seeded, category, "ko", newId);
  const matches = rounds.flat();
  matches.forEach((m) => (m.order = orderOffset + m.round * 1000 + m.slot));
  return resolveByes(matches);
}

/**
 * Double elimination: winners bracket, losers bracket (2·(R−1) rounds) and a grand final.
 * A grand-final reset match is created on demand if the losers-bracket finalist wins the first final.
 */
export function doubleEliminationMatches(
  seeded: readonly string[],
  category: Category,
  newId: IdFactory,
): Match[] {
  const { rounds: wb } = buildSingleBracket(seeded, category, "wb", newId);
  const size = 2 ** wb.length;
  const R = wb.length;
  const lbRoundCount = 2 * (R - 1);
  const lb: Match[][] = [];
  for (let lr = 1; lr <= lbRoundCount; lr++) {
    const count = size / 2 ** (Math.ceil(lr / 2) + 1);
    lb.push(
      Array.from({ length: count }, (_, slot) =>
        blankMatch({ id: newId(), category, stage: "lb", round: lr, slot }),
      ),
    );
  }
  const gf = blankMatch({ id: newId(), category, stage: "gf", round: 1, slot: 0 });

  wb[R - 1][0].nextWinner = { matchId: gf.id, side: "A" };

  if (R === 1) {
    wb[0][0].nextLoser = { matchId: gf.id, side: "B" };
  } else {
    wb[0].forEach((m, j) => {
      m.nextLoser = { matchId: lb[0][Math.floor(j / 2)].id, side: sideOf(j) };
    });
    for (let r = 2; r <= R; r++) {
      const target = lb[2 * (r - 1) - 1];
      wb[r - 1].forEach((m, j) => {
        const idx = r % 2 === 0 ? target.length - 1 - j : j;
        m.nextLoser = { matchId: target[idx].id, side: "B" };
      });
    }
    lb.forEach((round, i) => {
      const lr = i + 1;
      round.forEach((m, j) => {
        if (lr === lbRoundCount) {
          m.nextWinner = { matchId: gf.id, side: "B" };
        } else if (lr % 2 === 1) {
          m.nextWinner = { matchId: lb[i + 1][j].id, side: "A" };
        } else {
          m.nextWinner = { matchId: lb[i + 1][Math.floor(j / 2)].id, side: sideOf(j) };
        }
      });
    });
  }

  wb.forEach((round, i) =>
    round.forEach((m) => (m.order = 2 * i * 1000 + m.slot)),
  );
  // Losers round lr becomes playable right after the winners round that feeds it.
  lb.forEach((round, i) => round.forEach((m) => (m.order = (i + 2) * 1000 + 500 + m.slot)));
  gf.order = (2 * R + lbRoundCount + 2) * 1000;

  return resolveByes([...wb.flat(), ...lb.flat(), gf]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface FixturePlan {
  matches: Match[];
  groupCount: number | null;
  qualifiersPerGroup: number | null;
}

export function generateFixtures(options: {
  category: Category;
  format: Format;
  participantIds: readonly string[];
  newId: IdFactory;
  rng?: Rng;
}): FixturePlan {
  const { category, format, newId, rng = Math.random } = options;
  const ids = Array.from(new Set(options.participantIds));
  if (ids.length < MIN_PARTICIPANTS[format]) {
    throw new Error(`This format needs at least ${MIN_PARTICIPANTS[format]} entries.`);
  }
  const drawn = shuffle(ids, rng);

  if (format === "round_robin") {
    const matches = roundRobinMatches(drawn, category, "rr", newId);
    matches.forEach((m) => (m.order = m.round * 1000 + m.slot));
    return { matches, groupCount: null, qualifiersPerGroup: null };
  }

  if (format === "groups") {
    const groupCount = groupCountFor(drawn.length);
    const groups = assignGroups(drawn, groupCount);
    const matches = groups.flatMap((g, gi) => roundRobinMatches(g, category, "group", newId, gi));
    matches.forEach((m) => (m.order = m.round * 1000 + (m.group ?? 0) * 50 + m.slot));
    return { matches, groupCount, qualifiersPerGroup: qualifiersPerGroupFor(groups) };
  }

  if (format === "knockout") {
    return { matches: knockoutMatches(drawn, category, newId), groupCount: null, qualifiersPerGroup: null };
  }

  return {
    matches: doubleEliminationMatches(drawn, category, newId),
    groupCount: null,
    qualifiersPerGroup: null,
  };
}

/** Matches that should be shown to people (auto-resolved byes are hidden). */
export function isVisibleMatch(m: Match): boolean {
  return !m.bye;
}

export function sortMatches(matches: readonly Match[]): Match[] {
  const stageRank: Record<Stage, number> = { rr: 0, group: 0, wb: 1, lb: 1, ko: 2, gf: 3 };
  return [...matches].sort(
    (x, y) => stageRank[x.stage] - stageRank[y.stage] || x.order - y.order || x.id.localeCompare(y.id),
  );
}
