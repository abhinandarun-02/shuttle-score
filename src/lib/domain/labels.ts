import { GROUP_NAMES } from "./fixtures";
import type { Match } from "./types";

export interface RoundContext {
  koRounds: number;
  wbRounds: number;
  lbRounds: number;
}

export function roundContext(matches: readonly Match[]): RoundContext {
  const max = (stage: Match["stage"]) =>
    matches.filter((m) => m.stage === stage).reduce((acc, m) => Math.max(acc, m.round), 0);
  return { koRounds: max("ko"), wbRounds: max("wb"), lbRounds: max("lb") };
}

export function groupName(index: number): string {
  return `Group ${GROUP_NAMES[index] ?? index + 1}`;
}

export function knockoutRoundName(round: number, totalRounds: number): string {
  const remaining = totalRounds - round;
  if (remaining === 0) return "Final";
  if (remaining === 1) return "Semifinals";
  if (remaining === 2) return "Quarterfinals";
  return `Round of ${2 ** (remaining + 1)}`;
}

export function roundLabel(m: Pick<Match, "stage" | "round" | "group">, ctx: RoundContext): string {
  switch (m.stage) {
    case "rr":
      return `Round ${m.round}`;
    case "group":
      return `${groupName(m.group ?? 0)} · Round ${m.round}`;
    case "ko":
      return knockoutRoundName(m.round, ctx.koRounds);
    case "wb":
      return m.round === ctx.wbRounds ? "Winners Final" : `Winners · Round ${m.round}`;
    case "lb":
      return m.round === ctx.lbRounds ? "Losers Final" : `Losers · Round ${m.round}`;
    case "gf":
      return m.round === 2 ? "Grand Final · Reset" : "Grand Final";
  }
}
