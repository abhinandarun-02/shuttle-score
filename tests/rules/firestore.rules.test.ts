import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { generateFixtures } from "../../src/lib/domain/fixtures";
import { addPoint } from "../../src/lib/domain/scoring";

let env: RulesTestEnvironment;
const CODE = "BDM482";

const tournament = (uid: string) => ({
  code: CODE,
  name: "Club Night",
  categories: ["singles", "doubles"],
  format: "double_elim",
  createdAt: Date.now(),
  createdBy: uid,
  state: {
    singles: { phase: "registration", teamsConfirmed: false, championId: null, groupCount: null, qualifiersPerGroup: null },
    doubles: { phase: "registration", teamsConfirmed: false, championId: null, groupCount: null, qualifiersPerGroup: null },
  },
});

const db = (uid = "alice"): Firestore => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

function toDoc(m: ReturnType<typeof generateFixtures>["matches"][number]) {
  const { id: _id, ...rest } = m;
  void _id;
  return { ...rest, updatedAt: Date.now() };
}

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8181").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-shuttle-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

async function seedTournament() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, "tournaments", CODE), tournament("alice"));
  });
}

describe("tournaments", () => {
  it("requires sign-in for everything", async () => {
    await assertFails(setDoc(doc(anon(), "tournaments", CODE), tournament("x")));
    await seedTournament();
    await assertFails(getDoc(doc(anon(), "tournaments", CODE)));
  });

  it("lets a signed-in user create a valid tournament as themselves", async () => {
    await assertSucceeds(setDoc(doc(db("alice"), "tournaments", CODE), tournament("alice")));
  });

  it("rejects spoofed creators, bad codes and extra fields", async () => {
    await assertFails(setDoc(doc(db("alice"), "tournaments", CODE), tournament("bob")));
    await assertFails(setDoc(doc(db("alice"), "tournaments", "abc123"), { ...tournament("alice"), code: "abc123" }));
    await assertFails(setDoc(doc(db("alice"), "tournaments", CODE), { ...tournament("alice"), admin: true }));
    await assertFails(setDoc(doc(db("alice"), "tournaments", CODE), { ...tournament("alice"), name: "x".repeat(61) }));
  });

  it("can be fetched by code but never listed", async () => {
    await seedTournament();
    await assertSucceeds(getDoc(doc(db("bob"), "tournaments", CODE)));
    await assertFails(getDocs(collection(db("bob"), "tournaments")));
  });

  it("lets collaborators rename and update state, but not change format or owner", async () => {
    await seedTournament();
    const ref = doc(db("bob"), "tournaments", CODE);
    await assertSucceeds(updateDoc(ref, { name: "Renamed" }));
    await assertSucceeds(updateDoc(ref, { "state.doubles.teamsConfirmed": true }));
    await assertFails(updateDoc(ref, { format: "knockout" }));
    await assertFails(updateDoc(ref, { createdBy: "bob" }));
    await assertFails(updateDoc(ref, { "state.singles.phase": "finished" }));
  });

  it("only the creator can delete", async () => {
    await seedTournament();
    await assertFails(deleteDoc(doc(db("bob"), "tournaments", CODE)));
    await assertSucceeds(deleteDoc(doc(db("alice"), "tournaments", CODE)));
  });
});

describe("players and teams", () => {
  it("allows adding players while registration is open", async () => {
    await seedTournament();
    const ref = doc(collection(db("bob"), "tournaments", CODE, "players"));
    await assertSucceeds(setDoc(ref, { name: "Ana", category: "singles", createdAt: 1 }));
    await assertSucceeds(updateDoc(ref, { name: "Ana B." }));
    await assertFails(updateDoc(ref, { category: "doubles" }));
    await assertFails(setDoc(doc(collection(db("bob"), "tournaments", CODE, "players")), { name: "", category: "singles", createdAt: 1 }));
  });

  it("rejects players for a tournament that doesn't exist", async () => {
    await assertFails(
      setDoc(doc(collection(db("bob"), "tournaments", "ZZZZZZ", "players")), { name: "Ana", category: "singles", createdAt: 1 }),
    );
  });

  it("locks the roster once matches are generated", async () => {
    await seedTournament();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore() as unknown as Firestore, "tournaments", CODE), { "state.singles.phase": "playing" });
    });
    await assertFails(
      setDoc(doc(collection(db("bob"), "tournaments", CODE, "players")), { name: "Late", category: "singles", createdAt: 1 }),
    );
  });

  it("validates teams", async () => {
    await seedTournament();
    const teams = collection(db("bob"), "tournaments", CODE, "teams");
    await assertSucceeds(setDoc(doc(teams), { category: "doubles", playerIds: ["p1", "p2"], order: 0 }));
    await assertFails(setDoc(doc(teams), { category: "doubles", playerIds: ["p1", "p1"], order: 1 }));
    await assertFails(setDoc(doc(teams), { category: "doubles", playerIds: ["p1"], order: 1 }));
  });
});

describe("matches", () => {
  it("generates a full double-elimination bracket in one transaction", async () => {
    await seedTournament();
    const store = db("bob");
    const ids = Array.from({ length: 32 }, (_, i) => `p${i}`);
    const plan = generateFixtures({
      category: "singles",
      format: "double_elim",
      participantIds: ids,
      newId: () => doc(collection(store, "tournaments", CODE, "matches")).id,
    });
    await assertSucceeds(
      runTransaction(store, async (tx) => {
        await tx.get(doc(store, "tournaments", CODE));
        for (const m of plan.matches) tx.set(doc(store, "tournaments", CODE, "matches", m.id), toDoc(m));
        tx.update(doc(store, "tournaments", CODE), { "state.singles.phase": "playing" });
      }),
    );
  });

  it("requires a version bump for score changes and enforces score bounds", async () => {
    await seedTournament();
    const store = db("bob");
    const plan = generateFixtures({
      category: "singles",
      format: "round_robin",
      participantIds: ["p1", "p2"],
      newId: () => doc(collection(store, "tournaments", CODE, "matches")).id,
    });
    const match = plan.matches[0];
    const ref = doc(store, "tournaments", CODE, "matches", match.id);
    await assertSucceeds(setDoc(ref, toDoc(match)));

    const scored = addPoint(match, "A");
    await assertSucceeds(setDoc(ref, { ...toDoc(scored), version: 1 }));
    await assertFails(setDoc(ref, { ...toDoc(addPoint(scored, "A")), version: 1 }));
    await assertFails(setDoc(ref, { ...toDoc(scored), version: 2, games: [{ a: 31, b: 0 }] }));
    await assertFails(setDoc(ref, { ...toDoc(scored), version: 2, nextWinner: { matchId: "x", side: "A" } }));
    await assertSucceeds(updateDoc(ref, { court: "3", updatedAt: Date.now() }));
  });

  it("keeps score history append-only and attributed", async () => {
    await seedTournament();
    const store = db("bob");
    const events = collection(store, "tournaments", CODE, "matches", "m1", "events");
    const ref = doc(events);
    await assertSucceeds(
      setDoc(ref, { type: "point", side: "A", games: [{ a: 1, b: 0 }], version: 1, by: "bob", at: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(events), { type: "point", side: "A", games: [{ a: 1, b: 0 }], version: 1, by: "alice", at: serverTimestamp() }),
    );
    await assertFails(deleteDoc(ref));
  });

  it("supports resetting fixtures in a batch", async () => {
    await seedTournament();
    const store = db("bob");
    const plan = generateFixtures({
      category: "singles",
      format: "round_robin",
      participantIds: ["p1", "p2", "p3"],
      newId: () => doc(collection(store, "tournaments", CODE, "matches")).id,
    });
    const batch = writeBatch(store);
    for (const m of plan.matches) batch.set(doc(store, "tournaments", CODE, "matches", m.id), toDoc(m));
    await assertSucceeds(batch.commit());
    const del = writeBatch(store);
    for (const m of plan.matches) del.delete(doc(store, "tournaments", CODE, "matches", m.id));
    await assertSucceeds(del.commit());
  });
});
