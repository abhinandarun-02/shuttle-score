export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Pairing {
  pairs: [string, string][];
  /** Present when the player count is odd: this player sits out. */
  unpaired: string | null;
}

/** Randomly pairs players into doubles teams. Every player appears in exactly one pair (or as the unpaired player). */
export function pairPlayers(playerIds: readonly string[], rng: Rng = Math.random): Pairing {
  const unique = Array.from(new Set(playerIds));
  const shuffled = shuffle(unique, rng);
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
  return { pairs, unpaired: shuffled.length % 2 === 1 ? shuffled[shuffled.length - 1] : null };
}

/** A position in a pairing: a team slot, or the unpaired player (team === null). */
export interface PairSlot {
  team: number | null;
  position: 0 | 1;
}

export function playerAt(pairing: Pairing, slot: PairSlot): string | null {
  if (slot.team === null) return pairing.unpaired;
  return pairing.pairs[slot.team]?.[slot.position] ?? null;
}

/** Swaps the players in two slots (including the unpaired player) and returns a new pairing. */
export function swapSlots(pairing: Pairing, x: PairSlot, y: PairSlot): Pairing {
  const px = playerAt(pairing, x);
  const py = playerAt(pairing, y);
  if (px === null || py === null) return pairing;
  const pairs = pairing.pairs.map((p) => [...p] as [string, string]);
  let unpaired = pairing.unpaired;
  const put = (slot: PairSlot, id: string) => {
    if (slot.team === null) unpaired = id;
    else pairs[slot.team][slot.position] = id;
  };
  put(x, py);
  put(y, px);
  return { pairs, unpaired };
}

export function sameSlot(x: PairSlot, y: PairSlot): boolean {
  return x.team === y.team && (x.team === null || x.position === y.position);
}
