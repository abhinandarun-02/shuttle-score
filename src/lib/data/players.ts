import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { MAX_PLAYERS_PER_CATEGORY, type Category, type Player, type Team } from "@/lib/domain/types";
import { ensureAuth, getFirebase } from "@/lib/firebase/client";
import { playersCol, teamsCol, tournamentRef, UserFacingError } from "./refs";

export const MAX_PLAYER_NAME = 40;

/** Splits pasted text ("Ana, Ben\nCleo") into clean, de-duplicated names. */
export function parseNames(input: string, existing: readonly string[] = []): string[] {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const out: string[] = [];
  for (const raw of input.split(/[\n,;]+/)) {
    const name = raw.replace(/\s+/g, " ").trim().slice(0, MAX_PLAYER_NAME);
    if (!name || taken.has(name.toLowerCase())) continue;
    taken.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export async function addPlayers(code: string, category: Category, names: string[], currentCount: number) {
  if (!names.length) return;
  if (currentCount + names.length > MAX_PLAYERS_PER_CATEGORY) {
    throw new UserFacingError(`A category can have up to ${MAX_PLAYERS_PER_CATEGORY} players.`);
  }
  await ensureAuth();
  const batch = writeBatch(getFirebase().db);
  const now = Date.now();
  names.forEach((name, i) => {
    batch.set(doc(playersCol(code)), { name, category, createdAt: now + i });
  });
  await batch.commit();
}

export async function renamePlayer(code: string, playerId: string, name: string) {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, MAX_PLAYER_NAME);
  if (!clean) throw new UserFacingError("Names can't be empty.");
  await ensureAuth();
  await updateDoc(doc(playersCol(code), playerId), { name: clean });
}

/** Removes a player; in doubles their draft team is dissolved and teams need confirming again. */
export async function removePlayer(code: string, player: Player, teams: readonly Team[]) {
  await ensureAuth();
  const batch = writeBatch(getFirebase().db);
  batch.delete(doc(playersCol(code), player.id));
  if (player.category === "doubles") {
    for (const team of teams) {
      if (team.playerIds.includes(player.id)) batch.delete(doc(teamsCol(code), team.id));
    }
    batch.update(tournamentRef(code), { "state.doubles.teamsConfirmed": false });
  }
  await batch.commit();
}
