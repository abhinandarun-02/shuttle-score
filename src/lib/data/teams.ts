import { doc, updateDoc, writeBatch } from "firebase/firestore";
import type { Team } from "@/lib/domain/types";
import { ensureAuth, getFirebase } from "@/lib/firebase/client";
import { teamsCol, tournamentRef } from "./refs";

/** Replaces all doubles teams with a new set of pairs (generate / regenerate / swap). */
export async function saveTeams(code: string, pairs: [string, string][], existing: readonly Team[]) {
  await ensureAuth();
  const batch = writeBatch(getFirebase().db);
  pairs.forEach((pair, i) => {
    const current = existing[i];
    if (current) batch.set(doc(teamsCol(code), current.id), { category: "doubles", playerIds: pair, order: i });
    else batch.set(doc(teamsCol(code)), { category: "doubles", playerIds: pair, order: i });
  });
  for (const extra of existing.slice(pairs.length)) batch.delete(doc(teamsCol(code), extra.id));
  batch.update(tournamentRef(code), { "state.doubles.teamsConfirmed": false });
  await batch.commit();
}

export async function setTeamsConfirmed(code: string, confirmed: boolean) {
  await ensureAuth();
  await updateDoc(tournamentRef(code), { "state.doubles.teamsConfirmed": confirmed });
}
