/**
 * Monthly dashboard numbers.
 *
 * Given the whole ledger and a month (YYYY-MM), this adds up that month
 * and splits the total by category. Other months are ignored. Categories
 * are ordered by the largest total first.
 */

import { assertMonth, fromCents, toCents } from "./model.js";

export function summarizeMonth(entries, month) {
  assertMonth(month);
  const prefix = `${month}-`;
  const totals = new Map();
  let totalCents = 0;

  for (const entry of entries) {
    if (!entry.date.startsWith(prefix)) continue;
    const cents = toCents(entry.amount);
    if (cents == null) continue;
    totalCents += cents;
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + cents);
  }

  const byCategory = [...totals.entries()]
    .map(([category, cents]) => ({ category, total: fromCents(cents) }))
    .sort((a, b) => toCents(b.total) - toCents(a.total) || a.category.localeCompare(b.category));

  return { month, total: fromCents(totalCents), byCategory };
}

/** Entries in one month, newest day first. Later writes on that day stay on top. */
export function entriesForMonth(entries, month) {
  assertMonth(month);
  const prefix = `${month}-`;
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.date.startsWith(prefix))
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.index - a.index)
    .map(({ entry }) => entry);
}
