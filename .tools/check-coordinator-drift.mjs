#!/usr/bin/env node
// .tools/check-coordinator-drift.mjs
//
// Coordinator-drift gate for /auto-hermes-max (merge-gate step 8).
//
// In a parallel max round, every product-file change must be owned by some
// lane and declared in that lane's result packet. If the working tree has a
// dirty PRODUCT file that no lane packet claims, the coordinator (or a stray
// process) edited product code outside the lane model — that is "drift" and
// must be reverted or attributed to a lane before merge completes.
//
// This gate:
//   1. Lists dirty tracked + untracked files via `git status --porcelain`.
//   2. Drops non-product paths (AI-workflow scratch, docs, env, local artifacts)
//      — those are never lane-owned product code.
//   3. Builds the claimed set = union of every lane packet's changedFiles +
//      ownedFiles under .ai-sync/auto-hermes-max-results/*.json.
//   4. Any dirty product file not in the claimed set = drift.
//
// Exit 0 = no drift. Exit 1 = drift found (offending files printed). Exit 2 = usage/error.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..");
const RESULTS_DIR = join(ROOT, ".ai-sync", "auto-hermes-max-results");

// Paths that are never "product files" — AI-workflow scratch, agent config,
// docs, env, and machine-local artifacts. Mirrors CLAUDE.md's never-stage list.
const NON_PRODUCT_PREFIXES = [
  ".ai-sync/", ".claude/", ".codex/", ".opencode/", ".opencode-mem/", ".agents/", ".ai/",
  "autoresearch/", "task-images/", ".tools/token_tester/",
];
const NON_PRODUCT_FILES = new Set([
  "TASKS.md", "AGENTS.md", "CLAUDE.md", "memory.md",
]);
const NON_PRODUCT_SUFFIXES = [
  ".env", ".env.ps1", ".log", ".local.env.ps1",
];

function normalize(p) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^"|"$/g, "").trim();
}

function isProductFile(p) {
  const f = normalize(p);
  if (!f) return false;
  if (NON_PRODUCT_FILES.has(f)) return false;
  if (NON_PRODUCT_PREFIXES.some((pre) => f.startsWith(pre))) return false;
  if (NON_PRODUCT_SUFFIXES.some((suf) => f.endsWith(suf))) return false;
  // Daily/loop guide markdown at repo root (e.g. DAILY_*.md) are workflow docs.
  if (/^[A-Z0-9_]+_GUIDE\.md$/.test(f) || /^DAILY/.test(f)) return false;
  return true;
}

function gitDirtyFiles() {
  let out;
  try {
    out = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  } catch (e) {
    process.stderr.write(`[drift] git status failed: ${e.message}\n`);
    process.exit(2);
  }
  const files = [];
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    // porcelain v1: XY <path>  (rename shows "orig -> new")
    let path = line.slice(3);
    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4);
    files.push(normalize(path));
  }
  return files;
}

function claimedFiles() {
  const claimed = new Set();
  if (!existsSync(RESULTS_DIR)) return claimed;
  for (const name of readdirSync(RESULTS_DIR)) {
    if (!name.endsWith(".json")) continue;
    let packet;
    try {
      packet = JSON.parse(readFileSync(join(RESULTS_DIR, name), "utf8"));
    } catch {
      continue;
    }
    for (const key of ["changedFiles", "ownedFiles"]) {
      const list = packet[key];
      if (Array.isArray(list)) {
        for (const f of list) claimed.add(normalize(f));
      } else if (typeof list === "string") {
        for (const f of list.split(/\|\||,/)) claimed.add(normalize(f));
      }
    }
  }
  return claimed;
}

const dirty = gitDirtyFiles().filter(isProductFile);
const claimed = claimedFiles();
const drift = dirty.filter((f) => !claimed.has(f));

if (drift.length === 0) {
  process.stdout.write(
    JSON.stringify({ ok: true, drift: [], dirtyProductFiles: dirty.length, claimedFiles: claimed.size }) + "\n",
  );
  process.exit(0);
}

process.stdout.write(
  JSON.stringify(
    {
      ok: false,
      drift,
      message:
        "Product files are dirty but not claimed by any lane packet. Revert them or add them to a lane's result packet changedFiles before completing the merge. Never paper over drift.",
      dirtyProductFiles: dirty.length,
      claimedFiles: claimed.size,
    },
    null,
    2,
  ) + "\n",
);
process.exit(1);
