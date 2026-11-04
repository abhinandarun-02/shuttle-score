import { collection, doc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";

export const tournamentRef = (code: string) => doc(getFirebase().db, "tournaments", code);
export const playersCol = (code: string) => collection(getFirebase().db, "tournaments", code, "players");
export const teamsCol = (code: string) => collection(getFirebase().db, "tournaments", code, "teams");
export const matchesCol = (code: string) => collection(getFirebase().db, "tournaments", code, "matches");
export const matchRef = (code: string, id: string) => doc(matchesCol(code), id);
export const eventsCol = (code: string, matchId: string) => collection(matchRef(code, matchId), "events");

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** Converts Firestore/network failures into a sentence a person can act on. */
export function describeError(err: unknown): string {
  if (err instanceof UserFacingError) return err.message;
  if (err instanceof Error) {
    if (err.name === "ScoringError" || err.name === "ProgressionBlockedError") return err.message;
    const code = (err as { code?: string }).code ?? "";
    if (code === "permission-denied") return "That change isn't allowed.";
    if (code === "unavailable" || /offline/i.test(err.message)) {
      return "You're offline. Reconnect and try again.";
    }
    if (code === "failed-precondition" || code === "aborted") {
      return "Someone else changed this at the same time. Try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
