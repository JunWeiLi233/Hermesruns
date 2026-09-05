#!/usr/bin/env node
// auto-hermes-issues.mjs
// Bridge between GitHub issues on JunWeiLi233/Hermesruns and the Auto-Hermes task queue.
// Used by /auto-hermes and /auto-hermes-self session-start checklists.
//
// Subcommands:
//   --list                              List open issues as JSON (default)
//   --list --task-format                Emit TASKS.md `## Active Tasks`-style blocks
//   --list --task-format --decompose    Split large issues into bounded sub-tasks
//   --close <N> --comment "..."         Close issue #N with an optional comment
//
// Requires `gh` CLI authenticated against https://github.com/JunWeiLi233/Hermesruns.
// Exits 0 with `{ "skipped": true }` when gh is missing so the session checklist
// keeps moving rather than blocking. Real errors surface non-zero.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { HERMES_REPOSITORY } from "./hermes-repository.mjs";

const REPO = HERMES_REPOSITORY;

function parseArgs(argv) {
  const args = {
    list: false,
    taskFormat: false,
    decompose: false,
    close: null,
    comment: "",
    state: "open",
    limit: 50,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--task-format") args.taskFormat = true;
    else if (a === "--decompose") args.decompose = true;
    else if (a === "--close") args.close = parseInt(argv[++i], 10);
    else if (a === "--comment") args.comment = argv[++i] || "";
    else if (a === "--state") args.state = argv[++i] || "open";
    else if (a === "--limit") args.limit = parseInt(argv[++i], 10) || 50;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "Usage: auto-hermes-issues.mjs [--list [--task-format [--decompose]]] [--close N --comment STR]\n"
      );
      process.exit(0);
    }
  }
  if (!args.list && args.close == null) args.list = true; // default
  return args;
}

function ghAvailable() {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gh(args, opts = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
}

function fetchIssues({ state, limit }) {
  const raw = gh([
    "issue", "list",
    "--repo", REPO,
    "--state", state,
    "--limit", String(limit),
    "--json", "number,title,labels,body,url,author,createdAt,updatedAt",
  ]);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`gh issue list returned non-JSON output: ${err.message}`);
  }
}

// Convert an issue body into a Files: list by scanning for backticked paths
// that look like real repo files (extension whitelist + existence check).
function extractFiles(body) {
  const matches = String(body || "").match(/`([^`\n]+\.(?:jsx?|tsx?|mjs|java|css|md|json|properties|ya?ml|sql))`/gi) || [];
  const files = new Set();
  for (const m of matches) {
    const path = m.replace(/`/g, "").trim();
    if (path && !path.includes(" ") && existsSync(path)) {
      files.add(path);
    }
  }
  return [...files];
}

// Pull a Verify: command out of the body if the author named a script,
// otherwise return a safe default based on which stack the files target.
function deriveVerify(files) {
  const hasFrontend = files.some((f) => f.startsWith("frontend/"));
  const hasBackend = files.some((f) => f.startsWith("backend/"));
  if (hasFrontend && hasBackend) {
    return "cd frontend && npm run lint && cd ../backend && ./mvnw -q -DskipTests compile";
  }
  if (hasBackend) return "cd backend && ./mvnw -q -DskipTests compile";
  if (hasFrontend) return "cd frontend && npm run lint && node scripts/run-vite-build.mjs";
  return "(no auto-derived verify — pick one before promoting)";
}

// Derive a Done-when sentence from the issue's "验收标准" / "Acceptance criteria"
// section. Falls back to a one-line restatement of the title.
function deriveDoneWhen(body, title) {
  const lines = String(body || "").split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^#+\s*(验收标准|acceptance criteria|done when)/i.test(l));
  if (startIdx >= 0) {
    const bullets = [];
    for (let i = startIdx + 1; i < lines.length && bullets.length < 4; i++) {
      const m = lines[i].match(/^[-*]\s+(.+?)\s*$/);
      if (m) bullets.push(m[1]);
      else if (/^#+/.test(lines[i]) && bullets.length) break;
    }
    if (bullets.length) return bullets.join(" AND ");
  }
  return title;
}

function toTaskBlock(issue, { decompose } = {}) {
  const files = extractFiles(issue.body);
  const verify = deriveVerify(files);
  const doneWhen = deriveDoneWhen(issue.body, issue.title);
  const filesLine = files.length ? files.join("||") : "(none extracted — fill in)";

  const header = `- [issue #${issue.number}] ${issue.title}`;
  const meta = [
    `  Files: ${filesLine}`,
    `  Context: ${issue.url} — ${issue.author?.login || "unknown"} opened ${issue.createdAt?.slice(0, 10) || ""}`,
    `  Done when: ${doneWhen}`,
    `  Verify: ${verify}`,
    `  Closes: #${issue.number}`,
  ];

  if (!decompose) return [header, ...meta].join("\n");

  // Decompose: if the body lists discrete items (numbered or bulleted under
  // a "已确认的缺口" / "Confirmed gaps" / "Sub-tasks" section), emit one task per item.
  const lines = String(issue.body || "").split(/\r?\n/);
  const gapsIdx = lines.findIndex((l) => /^#+\s*(已确认的缺口|confirmed gaps|sub-tasks?|subtasks?)/i.test(l));
  if (gapsIdx < 0) return [header, ...meta].join("\n");

  const items = [];
  for (let i = gapsIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^[-*]\s+`?([^`\n]+?)`?\s*$/);
    if (m) items.push(m[1].trim());
    else if (/^#+/.test(lines[i]) && items.length) break;
  }
  if (items.length < 2) return [header, ...meta].join("\n");

  const subBlocks = items.map((item, idx) =>
    [
      `- [issue #${issue.number}.${idx + 1}] ${issue.title} — ${item}`,
      `  Files: ${filesLine}`,
      `  Context: ${issue.url} (decomposed item ${idx + 1}/${items.length}: ${item})`,
      `  Done when: ${item} is wired into the surface`,
      `  Verify: ${verify}`,
      `  Closes: #${issue.number}`,
    ].join("\n")
  );

  return [header, ...meta, "", ...subBlocks].join("\n");
}

function listIssues(args) {
  if (!ghAvailable()) {
    process.stdout.write(JSON.stringify({ skipped: true, reason: "gh CLI not on PATH" }) + "\n");
    return;
  }
  const issues = fetchIssues({ state: args.state, limit: args.limit });
  if (!args.taskFormat) {
    process.stdout.write(JSON.stringify({ count: issues.length, issues }, null, 2) + "\n");
    return;
  }
  if (!issues.length) {
    process.stdout.write("# No open issues on " + REPO + "\n");
    return;
  }
  const blocks = issues.map((issue) => toTaskBlock(issue, { decompose: args.decompose }));
  process.stdout.write(blocks.join("\n\n") + "\n");
}

function closeIssue(args) {
  if (!ghAvailable()) {
    process.stdout.write(JSON.stringify({ skipped: true, reason: "gh CLI not on PATH" }) + "\n");
    return;
  }
  const n = args.close;
  if (!Number.isInteger(n) || n <= 0) {
    process.stderr.write(`auto-hermes-issues: --close requires a positive integer issue number\n`);
    process.exit(2);
  }
  const closeArgs = ["issue", "close", String(n), "--repo", REPO];
  if (args.comment) closeArgs.push("--comment", args.comment);
  try {
    const out = gh(closeArgs);
    process.stdout.write(JSON.stringify({ closed: n, comment: args.comment, output: out.trim() }) + "\n");
  } catch (err) {
    process.stderr.write(`auto-hermes-issues: failed to close #${n}: ${err.message}\n`);
    process.exit(3);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.close != null) closeIssue(args);
else listIssues(args);
