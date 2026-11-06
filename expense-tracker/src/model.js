/**
 * The expense entry, and the checks that decide whether one is usable.
 *
 * An entry is a single amount on a single day, filed under a category,
 * with an optional note. Amounts are currency units (12.5 means twelve
 * and a half). Internally they are converted to integer cents so totals
 * do not drift the way 0.1 + 0.2 does in floating point.
 */

/** Shown as suggestions. Any other short category name is allowed. */
export const SUGGESTED_CATEGORIES = [
  "Food",
  "Transport",
  "Housing",
  "Utilities",
  "Health",
  "Entertainment",
  "Other",
];

const MAX_CENTS = 100_000_000; // 1,000,000.00
const MAX_CATEGORY = 40;
const MAX_NOTE = 280;
const AMOUNT_TEXT = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_TEXT = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A caller-facing problem with an entry or a query. `status` is an HTTP code. */
export class EntryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Convert an amount to integer cents, or return null when it is not a
 * positive value with at most two decimal places, within the ledger cap.
 * Strings are read exactly ("10.10" stays 1010). Numbers are rounded to
 * the nearest cent, which is what JSON does to a typed amount.
 */
export function toCents(amount) {
  if (typeof amount === "string") {
    const text = amount.trim();
    if (!AMOUNT_TEXT.test(text)) return null;
    const [whole, frac = ""] = text.split(".");
    const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
    return centsInRange(cents) ? cents : null;
  }
  if (typeof amount === "number" && Number.isFinite(amount)) {
    const cents = Math.round(amount * 100);
    return centsInRange(cents) ? cents : null;
  }
  return null;
}

function centsInRange(cents) {
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_CENTS;
}

/** Cents back to a number JSON can print cleanly, such as 0.3. */
export function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

/** YYYY-MM, or an EntryError. */
export function assertMonth(month) {
  if (typeof month !== "string" || !MONTH_TEXT.test(month)) {
    throw new EntryError("Month must be written YYYY-MM.");
  }
  return month;
}

/**
 * Check a request body and return the fields worth storing.
 * The id is added by the store, not by the caller.
 */
export function parseEntry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new EntryError("Entry must be an object.");
  }

  const cents = toCents(input.amount);
  if (cents == null) {
    throw new EntryError(
      "Amount must be a positive number with at most two decimal places, up to 1000000.",
    );
  }

  const category = typeof input.category === "string" ? input.category.trim() : "";
  if (!category || category.length > MAX_CATEGORY || /[\u0000-\u001F]/.test(category)) {
    throw new EntryError("Category is required and must be 40 characters or fewer.");
  }

  const date = typeof input.date === "string" ? input.date : "";
  if (!isRealDate(date)) {
    throw new EntryError("Date must be a real calendar day, written YYYY-MM-DD.");
  }

  const entry = { amount: fromCents(cents), category, date };
  if (input.note != null && input.note !== "") {
    if (typeof input.note !== "string") {
      throw new EntryError("Note must be text.");
    }
    const note = input.note.trim();
    if (note.length > MAX_NOTE) {
      throw new EntryError("Note must be 280 characters or fewer.");
    }
    if (note) entry.note = note;
  }
  return entry;
}

function isRealDate(iso) {
  const match = DATE_TEXT.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
