/**
 * Ledger storage.
 *
 * Entries live in one JSON file so you can open it, back it up, or
 * edit it by hand. Writes go to a temporary file and then replace the
 * real one, so a crash mid-save does not leave a half-written ledger.
 * A small queue keeps two saves from overwriting each other.
 *
 * Shape of the file:
 *   { "entries": [ { "id", "amount", "category", "date", "note"? } ] }
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EntryError, parseEntry } from "./model.js";
import { entriesForMonth, summarizeMonth } from "./summary.js";

export function defaultLedgerPath() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data", "expenses.json");
}

export function openStore(filePath = defaultLedgerPath()) {
  let chain = Promise.resolve();

  // Run the next change only after the previous one finished.
  const queue = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => {},
      () => {},
    );
    return run;
  };

  async function readEntries() {
    let raw;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new EntryError(`Could not read ${filePath}: it is not valid JSON.`, 500);
    }
    if (!parsed || !Array.isArray(parsed.entries)) {
      throw new EntryError(`Could not read ${filePath}: expected an entries array.`, 500);
    }
    return parsed.entries.map(normalizeStored);
  }

  async function writeEntries(entries) {
    await mkdir(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ entries }, null, 2)}\n`);
    await rename(tmp, filePath);
  }

  return {
    filePath,
    list(month) {
      return queue(async () => entriesForMonth(await readEntries(), month));
    },
    summary(month) {
      return queue(async () => summarizeMonth(await readEntries(), month));
    },
    add(input) {
      return queue(async () => {
        const entry = { id: randomUUID(), ...parseEntry(input) };
        const entries = await readEntries();
        entries.push(entry);
        await writeEntries(entries);
        return entry;
      });
    },
    remove(id) {
      return queue(async () => {
        if (typeof id !== "string" || !id) {
          throw new EntryError("Missing entry id.");
        }
        const entries = await readEntries();
        const next = entries.filter((entry) => entry.id !== id);
        if (next.length === entries.length) return false;
        await writeEntries(next);
        return true;
      });
    },
  };
}

function normalizeStored(entry) {
  if (!entry || typeof entry.id !== "string" || !entry.id) {
    throw new EntryError("A stored entry is missing an id.", 500);
  }
  return { id: entry.id, ...parseEntry(entry) };
}
