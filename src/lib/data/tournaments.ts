import { runTransaction, updateDoc } from "firebase/firestore";
import { generateCode } from "@/lib/domain/codes";
import {
  emptyCategoryState,
  type Category,
  type CategoryChoice,
  type Format,
  type MatchLength,
  type PointsToWin,
} from "@/lib/domain/types";
import { ensureAuth, getFirebase } from "@/lib/firebase/client";
import { tournamentRef, UserFacingError } from "./refs";

export const MAX_NAME_LENGTH = 60;

export function categoriesFor(choice: CategoryChoice): Category[] {
  return choice === "both" ? ["singles", "doubles"] : [choice];
}

export async function createTournament(input: {
  name: string;
  categories: CategoryChoice;
  format: Format;
  pointsToWin: PointsToWin;
  matchLength: MatchLength;
}): Promise<string> {
  const name = input.name.trim().slice(0, MAX_NAME_LENGTH);
  if (!name) throw new UserFacingError("Give your tournament a name.");
  const user = await ensureAuth();
  const { db } = getFirebase();
  const categories = categoriesFor(input.categories);
  const state = Object.fromEntries(categories.map((c) => [c, emptyCategoryState()]));

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCode();
    const ref = tournamentRef(code);
    const created = await runTransaction(db, async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists()) return false;
      tx.set(ref, {
        code,
        name,
        categories,
        format: input.format,
        pointsToWin: input.pointsToWin,
        matchLength: input.matchLength,
        createdAt: Date.now(),
        createdBy: user.uid,
        state,
      });
      return true;
    });
    if (created) return code;
  }
  throw new UserFacingError("Couldn't reserve a tournament code. Please try again.");
}

export async function renameTournament(code: string, name: string) {
  const clean = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!clean) throw new UserFacingError("The name can't be empty.");
  await ensureAuth();
  await updateDoc(tournamentRef(code), { name: clean });
}
