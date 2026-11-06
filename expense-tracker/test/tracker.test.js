/**
 * Checks the entry rules, the monthly category totals, the JSON file,
 * and the HTTP API that the dashboard uses.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { EntryError, parseEntry, toCents } from "../src/model.js";
import { createApp } from "../src/server.js";
import { openStore } from "../src/store.js";
import { summarizeMonth } from "../src/summary.js";
import { run } from "../src/cli.js";

describe("parseEntry", () => {
  test("keeps a valid entry and drops a blank note", () => {
    assert.deepEqual(
      parseEntry({ amount: "12.50", category: " Food ", date: "2026-11-06", note: "  " }),
      { amount: 12.5, category: "Food", date: "2026-11-06" },
    );
  });

  test("keeps a note when one was written", () => {
    const entry = parseEntry({
      amount: 4,
      category: "Transport",
      date: "2026-02-28",
      note: "bus",
    });
    assert.equal(entry.note, "bus");
    assert.equal(entry.amount, 4);
  });

  test("rejects amounts that are not a positive two-decimal value", () => {
    for (const amount of ["0", "-5", "1.234", "abc", "", 0]) {
      assert.throws(() => parseEntry({ amount, category: "Food", date: "2026-11-06" }), EntryError);
    }
  });

  test("rejects a date that is not a real day", () => {
    assert.throws(
      () => parseEntry({ amount: "1", category: "Food", date: "2026-02-31" }),
      /real calendar day/,
    );
  });
});

describe("summarizeMonth", () => {
  const entries = [
    { amount: 0.1, category: "Food", date: "2026-11-01" },
    { amount: 0.2, category: "Food", date: "2026-11-02" },
    { amount: 10, category: "Transport", date: "2026-11-03" },
    { amount: 99, category: "Food", date: "2026-10-31" },
  ];

  test("totals one month by category and ignores other months", () => {
    const summary = summarizeMonth(entries, "2026-11");
    assert.equal(summary.total.toFixed(2), "10.30");
    assert.deepEqual(
      summary.byCategory.map((row) => row.category),
      ["Transport", "Food"],
    );
    assert.equal(summary.byCategory[1].total.toFixed(2), "0.30");
  });

  test("an empty month is a zero total", () => {
    const summary = summarizeMonth(entries, "2026-01");
    assert.equal(summary.total, 0);
    assert.deepEqual(summary.byCategory, []);
  });

  test("0.1 and 0.2 become 30 cents", () => {
    assert.equal(toCents("0.10") + toCents("0.20"), 30);
  });
});

describe("json store and api", () => {
  let dir;
  let file;
  let store;
  let server;
  let base;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "expenses-"));
    file = join(dir, "expenses.json");
    store = openStore(file);
    server = createApp(store);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(dir, { recursive: true, force: true });
  });

  test("add, summarize, list, and remove through the API", async () => {
    const created = await request("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: "18.00",
        category: "Food",
        date: "2026-11-06",
        note: "lunch",
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.note, "lunch");

    await request("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "40", category: "Transport", date: "2026-11-07" }),
    });

    const summary = await request("/api/summary?month=2026-11");
    assert.equal(summary.body.total, 58);
    assert.equal(summary.body.byCategory[0].category, "Transport");

    const list = await request("/api/expenses?month=2026-11");
    assert.equal(list.body.entries.length, 2);
    assert.equal(list.body.entries[0].date, "2026-11-07");

    const saved = JSON.parse(await readFile(file, "utf8"));
    assert.equal(saved.entries.length, 2);

    const removed = await request(`/api/expenses/${created.body.id}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    const after = await request("/api/summary?month=2026-11");
    assert.equal(after.body.total, 40);
  });

  test("a bad entry is refused and the file is unchanged", async () => {
    const before = await readFile(file, "utf8");
    const response = await request("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "-2", category: "Food", date: "2026-11-06" }),
    });
    assert.equal(response.status, 400);
    assert.match(response.body.error, /Amount/);
    assert.equal(await readFile(file, "utf8"), before);
  });

  test("the cli adds into the same file", async () => {
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      await run(
        ["add", "--amount", "3.25", "--category", "Health", "--date", "2026-11-08", "--note", "pharmacy"],
        store,
      );
    } finally {
      console.log = original;
    }
    assert.match(lines[0], /Health/);
    const summary = await store.summary("2026-11");
    assert.equal(summary.total.toFixed(2), "43.25");
  });

  async function request(path, options) {
    const response = await fetch(`${base}${path}`, options);
    const body = await response.json();
    return { status: response.status, body };
  }
});
