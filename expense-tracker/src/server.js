/**
 * Local web app.
 *
 * Serves the dashboard in public/ and a small JSON API for adding
 * entries and reading a month. It listens on 127.0.0.1 only: this is
 * a personal tool, not something to put on the public internet.
 *
 *   GET  /api/categories
 *   GET  /api/expenses?month=YYYY-MM
 *   POST /api/expenses          { amount, category, date, note? }
 *   DELETE /api/expenses/:id
 *   GET  /api/summary?month=YYYY-MM
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EntryError, SUGGESTED_CATEGORIES, assertMonth } from "./model.js";
import { defaultLedgerPath, openStore } from "./store.js";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
]);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

export function createApp(store = openStore()) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        await handleApi(store, req, res, url);
        return;
      }
      // Browsers ask for this on every page. There is no icon yet.
      if (url.pathname === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      await handleFile(res, url.pathname);
    } catch (err) {
      const status = err.status ?? 500;
      sendJson(res, status, {
        error: status === 500 && !err.status ? "Something went wrong." : err.message,
      });
      if (status === 500) console.error(err);
    }
  });
}

async function handleApi(store, req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/categories") {
    sendJson(res, 200, { categories: SUGGESTED_CATEGORIES });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/summary") {
    const summary = await store.summary(monthFrom(url));
    sendJson(res, 200, summary);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/expenses") {
    const month = monthFrom(url);
    sendJson(res, 200, { month, entries: await store.list(month) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/expenses") {
    const created = await store.add(await readJson(req));
    sendJson(res, 201, created);
    return;
  }

  const removal = /^\/api\/expenses\/([^/]+)$/.exec(url.pathname);
  if (req.method === "DELETE" && removal) {
    const removed = await store.remove(decodeURIComponent(removal[1]));
    if (!removed) throw new EntryError("No entry with that id.", 404);
    sendJson(res, 200, { removed: true });
    return;
  }

  throw new EntryError("No such API route.", 404);
}

function monthFrom(url) {
  const month = url.searchParams.get("month") ?? currentMonth();
  return assertMonth(month);
}

function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) throw new EntryError("Request body is too large.", 413);
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new EntryError("Request body must be JSON.");
  }
}

async function handleFile(res, pathname) {
  const name = FILES.get(pathname);
  if (!name) throw new EntryError("Not found.", 404);
  const body = await readFile(join(PUBLIC_DIR, name));
  res.writeHead(200, {
    "Content-Type": TYPES[extname(name)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function isMain() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isMain()) {
  const port = Number(process.env.PORT ?? 4318);
  const file = process.env.EXPENSES_FILE ?? defaultLedgerPath();
  const server = createApp(openStore(file));
  server.listen(port, "127.0.0.1", () => {
    console.log(`Expense tracker at http://127.0.0.1:${port}`);
    console.log(`Ledger file: ${file}`);
  });
}
