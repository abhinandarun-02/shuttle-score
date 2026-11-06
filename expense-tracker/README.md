# Expense tracker

A personal ledger that runs on your machine. You add an amount, a category, a date, and an optional note. The page shows what you spent in the selected month, split by category. Entries are stored in a JSON file.

It does not share code with the Shuttle tournament app. Node.js 22 is enough; there are no packages to install.

## Run the page

```bash
cd expense-tracker
node src/server.js
```

Open http://127.0.0.1:4318. The server listens on this machine only. The ledger is written to `expense-tracker/data/expenses.json` (that file is gitignored).

## Add an entry from the terminal

```bash
node src/cli.js add --amount 12.50 --category Food --date 2026-11-06 --note lunch
node src/cli.js summary --month 2026-11
node src/cli.js list --month 2026-11
```

Set `EXPENSES_FILE` to use a different JSON file, and `PORT` to change the web port.

## What each file does

| File | Role |
| --- | --- |
| `src/model.js` | Entry shape (amount, category, date, optional note) and the checks for a valid one. Amounts are summed in integer cents. |
| `src/store.js` | Reads and writes the JSON ledger. |
| `src/summary.js` | Monthly total, and the same total split by category. |
| `src/server.js` | Local page and JSON API used by the dashboard. |
| `src/cli.js` | Add, list, and summarize from the terminal. |
| `public/` | The dashboard: month totals by category, and the form that adds an entry. |
| `test/tracker.test.js` | Rules, totals, the file, and the API. |

```bash
node --test
```
