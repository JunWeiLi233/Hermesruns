#!/usr/bin/env node
// .tools/auto-hermes-teamwork.mjs
//
// Round-scoped team bulletin board for /auto-hermes-self and /auto-hermes-max.
// The coordinator opens a board at round start; each specialist posts status +
// bulletin notes; the coordinator closes it with a verdict. This is the single
// source of truth for "what's happening and what's next" inside a round.
//
// State of record is .ai-sync/TEAMWORK.json (easy + safe to mutate). A human-
// readable .ai-sync/TEAMWORK.md is re-rendered from the JSON on every call, so
// the markdown never drifts from the data.
//
// Subcommands:
//   init   --round <id> --goal <text> --team "role:agent,role:agent"
//          --owned "role=f1||f2;role=f3"
//   status --role <role> --state <running|done|failed|blocked>
//          [--now <text>] [--next <text>] [--blockers <text|none>]
//   append --role <role> --note <text>
//   close  --verdict <approved|must-fix|blocked> [--commits <a,b>] [--notes <text>]
//   show                      # print current board JSON
//
// Concurrency: a .ai-sync/TEAMWORK.json.lock dir is acquired (mkdir is atomic on
// every OS) with bounded retries, so parallel lane agents can call safely.
//
// Exit codes: 0 ok, 2 invalid args/usage.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..");
const SYNC_DIR = join(ROOT, ".ai-sync");
const JSON_PATH = join(SYNC_DIR, "TEAMWORK.json");
const MD_PATH = join(SYNC_DIR, "TEAMWORK.md");
const LOCK_PATH = join(SYNC_DIR, "TEAMWORK.json.lock");

const argv = process.argv.slice(2);
const subcommand = argv[0];

function arg(name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : fallback;
}
function fail(msg) {
  process.stderr.write(`[teamwork] ${msg}\n`);
  process.exit(2);
}
function nowIso() {
  return new Date().toISOString();
}

// ── Lock (atomic mkdir + bounded retry) ──────────────────────────────────────
async function withLock(fn) {
  mkdirSync(SYNC_DIR, { recursive: true });
  const deadline = Date.now() + 5000;
  let held = false;
  while (Date.now() < deadline) {
    try {
      mkdirSync(LOCK_PATH); // throws if it already exists → someone else holds it
      held = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }
  if (!held) {
    // Stale lock fallback: force through rather than hang the round forever.
    try { rmdirSync(LOCK_PATH); } catch { /* ignore */ }
    try { mkdirSync(LOCK_PATH); held = true; } catch { /* ignore */ }
  }
  try {
    return fn();
  } finally {
    if (held) { try { rmdirSync(LOCK_PATH); } catch { /* ignore */ } }
  }
}

function loadBoard() {
  if (!existsSync(JSON_PATH)) return null;
  try {
    return JSON.parse(readFileSync(JSON_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveBoard(board) {
  mkdirSync(SYNC_DIR, { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(board, null, 2), "utf8");
  writeFileSync(MD_PATH, renderMarkdown(board), "utf8");
}

function esc(v) {
  // Escape pipe so a note/owned-file with `|` can't break a markdown table cell.
  return String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderMarkdown(b) {
  const lines = [];
  lines.push("# Teamwork Board");
  lines.push("");
  lines.push(`- Round: ${b.round || "(unset)"}`);
  lines.push(`- Goal: ${b.goal || "(unset)"}`);
  lines.push(`- Started: ${b.startedAt || "(unset)"}`);
  lines.push("");
  lines.push("## Roster");
  lines.push("| Role | Agent | Owned files |");
  lines.push("|---|---|---|");
  for (const m of b.team || []) {
    lines.push(`| ${esc(m.role)} | ${esc(m.agent)} | ${esc((m.owned || []).join(" || "))} |`);
  }
  lines.push("");
  lines.push("## Status");
  lines.push("| Role | State | Now | Next | Blockers | Updated |");
  lines.push("|---|---|---|---|---|---|");
  for (const role of Object.keys(b.status || {})) {
    const s = b.status[role];
    lines.push(`| ${esc(role)} | ${esc(s.state)} | ${esc(s.now)} | ${esc(s.next)} | ${esc(s.blockers || "none")} | ${esc(s.updatedAt)} |`);
  }
  lines.push("");
  lines.push("## Bulletin");
  if ((b.bulletin || []).length === 0) {
    lines.push("_(no entries yet)_");
  } else {
    for (const e of b.bulletin) {
      lines.push(`- [${e.ts}] **${esc(e.role)}**: ${esc(e.note)}`);
    }
  }
  lines.push("");
  if (b.close) {
    lines.push("## Round Close");
    lines.push(`- Verdict: ${esc(b.close.verdict)}`);
    lines.push(`- Commits: ${esc((b.close.commits || []).join(", ") || "none")}`);
    lines.push(`- Notes: ${esc(b.close.notes || "")}`);
    lines.push(`- Closed: ${b.close.closedAt}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ── Subcommands ──────────────────────────────────────────────────────────────
function cmdInit() {
  const round = arg("round");
  const goal = arg("goal");
  if (!round) fail("init requires --round");
  const teamRaw = arg("team", "");
  const ownedRaw = arg("owned", "");
  const ownedMap = {};
  for (const part of ownedRaw.split(";").map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const role = part.slice(0, eq).trim();
    const files = part.slice(eq + 1).split("||").map((s) => s.trim()).filter(Boolean);
    ownedMap[role] = files;
  }
  const team = [];
  const status = {};
  for (const pair of teamRaw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const colon = pair.indexOf(":");
    const role = (colon === -1 ? pair : pair.slice(0, colon)).trim();
    const agent = (colon === -1 ? "" : pair.slice(colon + 1)).trim();
    team.push({ role, agent, owned: ownedMap[role] || [] });
    status[role] = { state: "pending", now: "", next: "", blockers: "none", updatedAt: nowIso() };
  }
  const board = { round, goal: goal || "", startedAt: nowIso(), team, status, bulletin: [], close: null };
  saveBoard(board);
  process.stdout.write(JSON.stringify({ ok: true, action: "init", round, roles: team.map((t) => t.role) }) + "\n");
}

function cmdStatus() {
  const role = arg("role");
  if (!role) fail("status requires --role");
  const board = loadBoard() || { round: "(adhoc)", goal: "", startedAt: nowIso(), team: [], status: {}, bulletin: [], close: null };
  const prev = board.status[role] || { state: "pending", now: "", next: "", blockers: "none" };
  board.status[role] = {
    state: arg("state", prev.state),
    now: arg("now", prev.now),
    next: arg("next", prev.next),
    blockers: arg("blockers", prev.blockers),
    updatedAt: nowIso(),
  };
  // A status for an unknown role still registers it on the board.
  if (!board.team.find((t) => t.role === role)) {
    board.team.push({ role, agent: "", owned: [] });
  }
  saveBoard(board);
  process.stdout.write(JSON.stringify({ ok: true, action: "status", role, state: board.status[role].state }) + "\n");
}

function cmdAppend() {
  const role = arg("role");
  const note = arg("note");
  if (!role) fail("append requires --role");
  if (!note) fail("append requires --note");
  const board = loadBoard() || { round: "(adhoc)", goal: "", startedAt: nowIso(), team: [], status: {}, bulletin: [], close: null };
  board.bulletin.push({ ts: nowIso(), role, note });
  saveBoard(board);
  process.stdout.write(JSON.stringify({ ok: true, action: "append", role, entries: board.bulletin.length }) + "\n");
}

function cmdClose() {
  const verdict = arg("verdict");
  if (!verdict) fail("close requires --verdict");
  const board = loadBoard();
  if (!board) fail("no board to close — run init first");
  board.close = {
    verdict,
    commits: (arg("commits", "") || "").split(",").map((s) => s.trim()).filter(Boolean),
    notes: arg("notes", "") || "",
    closedAt: nowIso(),
  };
  saveBoard(board);
  process.stdout.write(JSON.stringify({ ok: true, action: "close", verdict }) + "\n");
}

function cmdShow() {
  const board = loadBoard();
  if (!board) {
    process.stdout.write(JSON.stringify({ ok: false, error: "no board" }) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify({ ok: true, board }, null, 2) + "\n");
}

function printHelp() {
  process.stdout.write(
    [
      "Round-scoped team bulletin board (.ai-sync/TEAMWORK.{json,md}).",
      "",
      "Subcommands:",
      '  init   --round <id> --goal <text> --team "role:agent,role:agent" --owned "role=f1||f2;role=f3"',
      "  status --role <role> --state <running|done|failed|blocked> [--now <t>] [--next <t>] [--blockers <t>]",
      "  append --role <role> --note <text>",
      "  close  --verdict <approved|must-fix|blocked> [--commits <a,b>] [--notes <text>]",
      "  show",
      "",
    ].join("\n"),
  );
}

const handlers = { init: cmdInit, status: cmdStatus, append: cmdAppend, close: cmdClose, show: cmdShow };

if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
  printHelp();
  process.exit(0);
}
const handler = handlers[subcommand];
if (!handler) {
  printHelp();
  fail(`unknown subcommand: ${subcommand}`);
}
// show is read-only — no lock needed.
if (subcommand === "show") {
  handler();
} else {
  await withLock(handler);
}
