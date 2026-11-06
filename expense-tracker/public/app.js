/**
 * Dashboard page.
 *
 * Loads one month, draws the category totals, and posts the add form
 * back to the local API. Text is inserted with textContent so a note
 * cannot become HTML.
 */

const monthLabel = document.querySelector("#month-label");
const monthTotal = document.querySelector("#month-total");
const byCategory = document.querySelector("#by-category");
const emptySummary = document.querySelector("#empty-summary");
const entriesEl = document.querySelector("#entries");
const emptyEntries = document.querySelector("#empty-entries");
const form = document.querySelector("#add-form");
const formError = document.querySelector("#form-error");
const categories = document.querySelector("#categories");

let month = todayMonth();

document.querySelector("#prev-month").addEventListener("click", () => {
  month = shiftMonth(month, -1);
  load().catch(showLoadError);
});

document.querySelector("#next-month").addEventListener("click", () => {
  month = shiftMonth(month, 1);
  load().catch(showLoadError);
});

form.elements.date.value = todayIso();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  const submit = form.querySelector("button[type=submit]");
  const data = new FormData(form);
  const body = {
    amount: String(data.get("amount") ?? "").trim(),
    category: String(data.get("category") ?? "").trim(),
    date: String(data.get("date") ?? ""),
    note: String(data.get("note") ?? "").trim(),
  };

  submit.disabled = true;
  try {
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      formError.textContent = payload.error ?? "Could not add that entry.";
      return;
    }

    form.elements.amount.value = "";
    form.elements.note.value = "";
    form.elements.amount.focus();
    month = body.date.slice(0, 7);
    await load();
  } catch (err) {
    showLoadError(err);
  } finally {
    submit.disabled = false;
  }
});

loadCategories().catch(showLoadError);
load().catch(showLoadError);

async function loadCategories() {
  const response = await fetch("/api/categories");
  const payload = await response.json();
  for (const name of payload.categories ?? []) {
    const option = document.createElement("option");
    option.value = name;
    categories.append(option);
  }
}

async function load() {
  monthLabel.textContent = formatMonth(month);
  const [summaryRes, listRes] = await Promise.all([
    fetch(`/api/summary?month=${month}`),
    fetch(`/api/expenses?month=${month}`),
  ]);
  const summary = await summaryRes.json();
  const list = await listRes.json();
  if (!summaryRes.ok) throw new Error(summary.error ?? "Could not load the month.");
  if (!listRes.ok) throw new Error(list.error ?? "Could not load entries.");
  renderSummary(summary);
  renderEntries(list.entries ?? []);
}

function renderSummary(summary) {
  monthTotal.textContent = money(summary.total);
  byCategory.replaceChildren();
  const rows = summary.byCategory ?? [];
  emptySummary.hidden = rows.length > 0;
  for (const row of rows) {
    const item = document.createElement("li");
    item.className = "cat";
    const name = document.createElement("span");
    name.textContent = row.category;
    const amount = document.createElement("span");
    amount.className = "cat-amount";
    amount.textContent = money(row.total);
    const track = document.createElement("span");
    track.className = "track";
    const fill = document.createElement("span");
    fill.className = "fill";
    const share = summary.total > 0 ? (row.total / summary.total) * 100 : 0;
    fill.style.width = `${share}%`;
    track.append(fill);
    item.append(name, amount, track);
    byCategory.append(item);
  }
}

function renderEntries(entries) {
  entriesEl.replaceChildren();
  emptyEntries.hidden = entries.length > 0;
  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "entry";

    const date = document.createElement("time");
    date.dateTime = entry.date;
    date.textContent = formatDate(entry.date);

    const category = document.createElement("strong");
    category.textContent = entry.category;

    const amount = document.createElement("span");
    amount.className = "money";
    amount.textContent = money(entry.amount);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      removeEntry(entry.id).catch(showLoadError);
    });

    item.append(date, category, amount, remove);
    if (entry.note) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = entry.note;
      item.append(note);
    }
    entriesEl.append(item);
  }
}

async function removeEntry(id) {
  const response = await fetch(`/api/expenses/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json();
    formError.textContent = payload.error ?? "Could not remove that entry.";
    return;
  }
  await load();
}

function showLoadError(err) {
  formError.textContent = err.message ?? "Could not reach the ledger.";
}

function todayMonth() {
  return todayIso().slice(0, 7);
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function shiftMonth(value, delta) {
  const [year, monthIndex] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(value) {
  const [year, monthIndex] = value.split("-").map(Number);
  return new Date(Date.UTC(year, monthIndex - 1, 1)).toLocaleString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDate(iso) {
  const [year, monthIndex, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, monthIndex - 1, day)).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function money(amount) {
  return Number(amount).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
