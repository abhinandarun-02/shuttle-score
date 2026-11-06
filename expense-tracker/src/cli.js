/**
 * Add entries and print the monthly dashboard without opening the browser.
 *
 *   node src/cli.js add --amount 12.50 --category Food --date 2026-11-06 --note lunch
 *   node src/cli.js list --month 2026-11
 *   node src/cli.js summary --month 2026-11
 *
 * Uses the same JSON file as the web app. Set EXPENSES_FILE to use another path.
 */

import { pathToFileURL } from "node:url";
import { defaultLedgerPath, openStore } from "./store.js";

function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function printSummary(summary) {
  console.log(`${summary.month}  total ${summary.total.toFixed(2)}`);
  if (summary.byCategory.length === 0) {
    console.log("No entries.");
    return;
  }
  for (const row of summary.byCategory) {
    console.log(`  ${row.total.toFixed(2).padStart(10)}  ${row.category}`);
  }
}

export async function run(argv, store = openStore(process.env.EXPENSES_FILE ?? defaultLedgerPath())) {
  const [command, ...rest] = argv;
  const args = flags(rest);
  const month = typeof args.month === "string" ? args.month : currentMonth();

  if (command === "add") {
    const entry = await store.add({
      amount: args.amount,
      category: args.category,
      date: args.date,
      note: args.note,
    });
    console.log(`Added ${entry.id}  ${entry.date}  ${entry.amount.toFixed(2)}  ${entry.category}`);
    return;
  }

  if (command === "list") {
    const entries = await store.list(month);
    if (entries.length === 0) console.log(`No entries in ${month}.`);
    for (const entry of entries) {
      const note = entry.note ? `  ${entry.note}` : "";
      console.log(`${entry.date}  ${entry.amount.toFixed(2).padStart(10)}  ${entry.category}${note}`);
    }
    return;
  }

  if (command === "summary") {
    printSummary(await store.summary(month));
    return;
  }

  console.log(`Usage:
  node src/cli.js add --amount 12.50 --category Food --date 2026-11-06 [--note lunch]
  node src/cli.js list [--month 2026-11]
  node src/cli.js summary [--month 2026-11]`);
  if (command) process.exitCode = 1;
}

function isMain() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isMain()) {
  run(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
