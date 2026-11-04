import { doc, runTransaction } from "firebase/firestore";
import { generateFixtures, knockoutMatches } from "@/lib/domain/fixtures";
import {
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  type Category,
  type Format,
  type Match,
} from "@/lib/domain/types";
import { ensureAuth, getFirebase } from "@/lib/firebase/client";
import { matchToDoc, parseTournament } from "./converters";
import { matchesCol, matchRef, tournamentRef, UserFacingError } from "./refs";

const KNOCKOUT_ORDER_OFFSET = 1_000_000;

function stamp(matches: Match[]): Match[] {
  const now = Date.now();
  return matches.map((m) => ({ ...m, version: 0, updatedAt: now }));
}

export async function generateMatches(code: string, category: Category, format: Format, participantIds: string[]) {
  if (participantIds.length < MIN_PARTICIPANTS[format]) {
    throw new UserFacingError(`Add at least ${MIN_PARTICIPANTS[format]} entries first.`);
  }
  if (participantIds.length > MAX_PARTICIPANTS[format]) {
    throw new UserFacingError(`This format supports up to ${MAX_PARTICIPANTS[format]} entries.`);
  }
  await ensureAuth();
  const { db } = getFirebase();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(tournamentRef(code));
    if (!snap.exists()) throw new UserFacingError("This tournament no longer exists.");
    const state = parseTournament(snap).state[category];
    if (!state || state.phase !== "registration") {
      throw new UserFacingError("Matches have already been generated.");
    }
    if (category === "doubles" && !state.teamsConfirmed) {
      throw new UserFacingError("Confirm the doubles teams first.");
    }
    const plan = generateFixtures({
      category,
      format,
      participantIds,
      newId: () => doc(matchesCol(code)).id,
    });
    for (const m of stamp(plan.matches)) tx.set(matchRef(code, m.id), matchToDoc(m));
    tx.update(tournamentRef(code), {
      [`state.${category}.phase`]: "playing",
      [`state.${category}.championId`]: null,
      [`state.${category}.groupCount`]: plan.groupCount,
      [`state.${category}.qualifiersPerGroup`]: plan.qualifiersPerGroup,
    });
  });
}

/** Deletes every match in a category and reopens registration. */
export async function resetMatches(code: string, category: Category, matchIds: string[]) {
  await ensureAuth();
  const { db } = getFirebase();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(tournamentRef(code));
    if (!snap.exists()) throw new UserFacingError("This tournament no longer exists.");
    for (const id of matchIds) tx.delete(matchRef(code, id));
    tx.update(tournamentRef(code), {
      [`state.${category}.phase`]: "registration",
      [`state.${category}.championId`]: null,
      [`state.${category}.groupCount`]: null,
      [`state.${category}.qualifiersPerGroup`]: null,
    });
  });
}

/** Builds the knockout bracket from group qualifiers (already seeded). */
export async function startKnockout(code: string, category: Category, seeded: string[]) {
  if (seeded.length < 2) throw new UserFacingError("At least two qualifiers are needed.");
  await ensureAuth();
  const { db } = getFirebase();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(tournamentRef(code));
    if (!snap.exists()) throw new UserFacingError("This tournament no longer exists.");
    const state = parseTournament(snap).state[category];
    if (!state || state.phase !== "playing") throw new UserFacingError("The knockout stage has already started.");
    const matches = knockoutMatches(seeded, category, () => doc(matchesCol(code)).id, KNOCKOUT_ORDER_OFFSET);
    for (const m of stamp(matches)) tx.set(matchRef(code, m.id), matchToDoc(m));
    tx.update(tournamentRef(code), { [`state.${category}.phase`]: "knockout" });
  });
}

/** Removes the knockout bracket of a group tournament so groups can be corrected. */
export async function cancelKnockout(code: string, category: Category, knockoutMatchIds: string[]) {
  await ensureAuth();
  const { db } = getFirebase();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(tournamentRef(code));
    if (!snap.exists()) throw new UserFacingError("This tournament no longer exists.");
    for (const id of knockoutMatchIds) tx.delete(matchRef(code, id));
    tx.update(tournamentRef(code), {
      [`state.${category}.phase`]: "playing",
      [`state.${category}.championId`]: null,
    });
  });
}
