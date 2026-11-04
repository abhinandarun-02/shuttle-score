import { sortMatches } from "./fixtures";
import { computeStandings, seedQualifiers, type StandingRow } from "./standings";
import {
  emptyCategoryState,
  isRealParticipant,
  MIN_PARTICIPANTS,
  type Category,
  type CategoryState,
  type Format,
  type Match,
  type Participant,
  type Player,
  type Team,
  type Tournament,
} from "./types";

export type NextStep =
  | { kind: "add-players"; needed: number }
  | { kind: "make-teams" }
  | { kind: "confirm-teams" }
  | { kind: "generate" }
  | { kind: "play"; live: Match[]; upNext: Match | null }
  | { kind: "start-knockout" }
  | { kind: "complete"; championId: string | null };

export interface GroupTable {
  index: number;
  rows: StandingRow[];
  complete: boolean;
}

export interface CategoryView {
  category: Category;
  format: Format;
  state: CategoryState;
  players: Player[];
  teams: Team[];
  /** Singles: players. Doubles: confirmed/draft teams. */
  participants: Participant[];
  nameOf: (id: string | null) => string;
  /** All matches in this category, in schedule order (byes included). */
  matches: Match[];
  /** Matches a person should see (no auto-resolved byes). */
  visibleMatches: Match[];
  groups: GroupTable[];
  standings: StandingRow[];
  championId: string | null;
  complete: boolean;
  nextStep: NextStep;
}

export function teamName(team: Team, playerNames: Map<string, string>): string {
  return team.playerIds.map((id) => playerNames.get(id) ?? "Removed player").join(" & ");
}

export function buildCategoryView(
  tournament: Tournament,
  category: Category,
  allPlayers: readonly Player[],
  allTeams: readonly Team[],
  allMatches: readonly Match[],
): CategoryView {
  const state = tournament.state[category] ?? emptyCategoryState();
  const format = tournament.format;
  const players = allPlayers
    .filter((p) => p.category === category)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const playerNames = new Map(players.map((p) => [p.id, p.name]));
  const teams = category === "doubles" ? [...allTeams].sort((a, b) => a.order - b.order) : [];

  const participants: Participant[] =
    category === "singles"
      ? players.map((p) => ({ id: p.id, name: p.name }))
      : teams.map((t) => ({ id: t.id, name: teamName(t, playerNames) }));
  const names = new Map(participants.map((p) => [p.id, p.name]));
  const nameOf = (id: string | null) => {
    if (id === null) return "TBD";
    if (!isRealParticipant(id)) return "Bye";
    return names.get(id) ?? "Unknown";
  };

  const matches = sortMatches(allMatches.filter((m) => m.category === category));
  const visibleMatches = matches.filter((m) => !m.bye);
  const groupMatches = matches.filter((m) => m.stage === "group");
  const knockout = matches.filter((m) => m.stage === "ko");

  let groups: GroupTable[] = [];
  if (format === "groups" && groupMatches.length) {
    const members = new Map<number, Set<string>>();
    for (const m of groupMatches) {
      const set = members.get(m.group ?? 0) ?? new Set<string>();
      if (isRealParticipant(m.a)) set.add(m.a);
      if (isRealParticipant(m.b)) set.add(m.b);
      members.set(m.group ?? 0, set);
    }
    const order = new Map(participants.map((p, i) => [p.id, i]));
    groups = [...members.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, ids]) => {
        const inGroup = groupMatches.filter((m) => (m.group ?? 0) === index);
        const sortedIds = [...ids].sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0));
        return {
          index,
          rows: computeStandings(sortedIds, inGroup),
          complete: inGroup.every((m) => m.status === "completed"),
        };
      });
  }

  const roundRobin = matches.filter((m) => m.stage === "rr");
  const standings =
    format === "round_robin" ? computeStandings(participants.map((p) => p.id), roundRobin) : [];

  let championId: string | null = null;
  let complete = false;
  if (format === "round_robin") {
    complete = roundRobin.length > 0 && roundRobin.every((m) => m.status === "completed");
    championId = complete ? (standings[0]?.id ?? null) : null;
  } else if (format === "groups") {
    complete = knockout.length > 0 && Boolean(state.championId);
    championId = complete ? state.championId : null;
  } else {
    complete = matches.length > 0 && Boolean(state.championId);
    championId = complete ? state.championId : null;
  }

  const nextStep = computeNextStep({ state, format, category, players, teams, participants, visibleMatches, groups, complete, championId });

  return {
    category,
    format,
    state,
    players,
    teams,
    participants,
    nameOf,
    matches,
    visibleMatches,
    groups,
    standings,
    championId,
    complete,
    nextStep,
  };
}

function computeNextStep(v: {
  state: CategoryState;
  format: Format;
  category: Category;
  players: Player[];
  teams: Team[];
  participants: Participant[];
  visibleMatches: Match[];
  groups: GroupTable[];
  complete: boolean;
  championId: string | null;
}): NextStep {
  const min = MIN_PARTICIPANTS[v.format];
  if (v.state.phase === "registration") {
    if (v.category === "singles") {
      if (v.players.length < min) return { kind: "add-players", needed: min - v.players.length };
      return { kind: "generate" };
    }
    if (v.players.length < min * 2) return { kind: "add-players", needed: min * 2 - v.players.length };
    if (!v.teams.length) return { kind: "make-teams" };
    if (!v.state.teamsConfirmed) return { kind: "confirm-teams" };
    if (v.teams.length < min) return { kind: "make-teams" };
    return { kind: "generate" };
  }
  if (v.complete) return { kind: "complete", championId: v.championId };
  if (
    v.format === "groups" &&
    v.state.phase === "playing" &&
    v.groups.length > 0 &&
    v.groups.every((g) => g.complete)
  ) {
    return { kind: "start-knockout" };
  }
  const live = v.visibleMatches.filter((m) => m.status === "live");
  const upNext = v.visibleMatches.find((m) => m.status === "upcoming") ?? null;
  return { kind: "play", live, upNext };
}

/** Seeds for the knockout stage of a group tournament, from final group tables. */
export function knockoutSeedsFor(view: CategoryView): string[] {
  const q = view.state.qualifiersPerGroup ?? 2;
  return seedQualifiers(
    view.groups.map((g) => g.rows.map((r) => r.id)),
    q,
  );
}

export type TournamentStatus = "setup" | "live" | "in-progress" | "completed";

export function tournamentStatus(views: readonly CategoryView[]): TournamentStatus {
  if (views.length && views.every((v) => v.complete)) return "completed";
  if (views.some((v) => v.visibleMatches.some((m) => m.status === "live"))) return "live";
  if (views.some((v) => v.state.phase !== "registration")) return "in-progress";
  return "setup";
}

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  setup: "Setting up",
  live: "Live",
  "in-progress": "In progress",
  completed: "Completed",
};
