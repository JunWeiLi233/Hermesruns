#!/usr/bin/env node
// .tools/auto-hermes-playwright.mjs
//
// Hermes wrapper around Microsoft Playwright (https://github.com/microsoft/playwright)
// for headless, hermetic browser proof on /auto-hermes-* rounds.
//
// Why this exists alongside .tools/auto-hermes-browser.mjs:
//   * `auto-hermes-browser.mjs` piggybacks on the USER's running Chrome via
//     browser-harness — great for inheriting the user's logged-in session and
//     for visible debugging, but conflicts with whatever the user is doing in
//     the foreground.
//   * Playwright runs its own managed Chromium (headless by default), in a
//     persistent context directory under .ai-sync/playwright-state/<state>/,
//     so cookies + localStorage survive across rounds. Great for CI, for
//     auth-walled pages once you've signed in once, and for running while
//     the user keeps using their real browser uninterrupted.
//
// Decision rule (also documented in .claude/commands/auto-hermes-self.md):
//   * Default to `auto-hermes-browser.mjs` when the user is at the keyboard
//     and the page needs their existing logged-in Chrome session.
//   * Use `auto-hermes-playwright.mjs` when the round runs unattended, when
//     the user is using Chrome for other work, or when auth state needs to
//     persist deterministically across rounds (e.g. /muscle-training behind
//     the local-shared-runner login).
//
// Subcommand surface mirrors auto-hermes-browser.mjs so callers can swap:
//   goto       --url <url> [--wait-ms 12000] [--state default] [--headed]
//   eval       --js  <expr> [--state default] [--headed]
//   screenshot --out <path> [--state default] [--full-page] [--headed]
//   status     [--state default]
//   reset      [--state default]   # delete the persistent state dir
//   doctor                          # confirm Playwright + Chromium are installed
//
// Exit codes:
//   0 success
//   1 runtime / Playwright error
//   2 invalid arguments
//   3 Playwright not installed (install instructions printed in JSON)
//
// Install (one time, in repo root):
//   npm i -D @playwright/test
//   npx playwright install chromium
//
// Output: a single JSON line on stdout per call. No stderr noise.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR_BASE = path.join(REPO_ROOT, ".ai-sync", "playwright-state");

const args = process.argv.slice(2);
const subcommand = args[0];

function readArg(name, fallback = "") {
  const flag = `--${name}`;
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return fallback;
  return String(args[idx + 1] || "").trim();
}
function readFlag(name) { return args.includes(`--${name}`); }

const stateName = (readArg("state", "default") || "default").replace(/[^a-zA-Z0-9_.-]/g, "_");
const headed = readFlag("headed");

function emit(payload) { process.stdout.write(JSON.stringify(payload) + "\n"); }
function fail(code, msg, extra = {}) { emit({ ok: false, error: msg, ...extra }); process.exit(code); }

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (err) {
    fail(3, "Playwright is not installed.", {
      hint: "Run from repo root: npm i -D @playwright/test && npx playwright install chromium",
      detail: err && err.message ? err.message : String(err),
    });
  }
}

function ensureStateDir() {
  const dir = path.join(STATE_DIR_BASE, stateName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function openContext(pw) {
  const userDataDir = ensureStateDir();
  return pw.chromium.launchPersistentContext(userDataDir, {
    headless: !headed,
    viewport: { width: 1920, height: 1080 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

async function withPage(fn) {
  const pw = await loadPlaywright();
  const context = await openContext(pw);
  const errors = [];
  try {
    let page = context.pages()[0];
    if (!page) page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String((e && e.message) || e)));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    const out = await fn(page);
    return { ...out, consoleErrorCount: errors.length, consoleErrors: errors.slice(0, 5) };
  } finally {
    await context.close().catch(() => {});
  }
}

async function cmdGoto() {
  const url = readArg("url");
  if (!url) fail(2, "goto requires --url");
  const waitMs = Math.max(1000, parseInt(readArg("wait-ms", "12000"), 10) || 12000);
  try {
    const r = await withPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: waitMs });
      try { await page.waitForLoadState("networkidle", { timeout: Math.min(8000, waitMs) }); } catch { /* best effort */ }
      return { ok: true, action: "goto", url: page.url(), title: await page.title() };
    });
    emit(r);
  } catch (e) {
    fail(1, "goto failed", { detail: String((e && e.message) || e), url });
  }
}

async function cmdEval() {
  const js = readArg("js");
  if (!js) fail(2, "eval requires --js");
  try {
    const r = await withPage(async (page) => {
      let value;
      try {
        value = await page.evaluate(`(async () => { return (${js}); })()`);
      } catch (e) {
        value = { error: String((e && e.message) || e) };
      }
      return { ok: true, action: "eval", url: page.url(), value };
    });
    emit(r);
  } catch (e) {
    fail(1, "eval failed", { detail: String((e && e.message) || e) });
  }
}

async function cmdScreenshot() {
  const out = readArg("out");
  if (!out) fail(2, "screenshot requires --out");
  const absOut = path.isAbsolute(out) ? out : path.join(REPO_ROOT, out);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  const fullPage = readFlag("full-page");
  const lower = absOut.toLowerCase();
  const isJpeg = lower.endsWith(".jpg") || lower.endsWith(".jpeg");
  try {
    const r = await withPage(async (page) => {
      await page.screenshot({
        path: absOut,
        fullPage,
        type: isJpeg ? "jpeg" : "png",
        quality: isJpeg ? 82 : undefined,
      });
      return { ok: true, action: "screenshot", url: page.url(), out: absOut };
    });
    emit(r);
  } catch (e) {
    fail(1, "screenshot failed", { detail: String((e && e.message) || e), out: absOut });
  }
}

async function cmdStatus() {
  try {
    const r = await withPage(async (page) => ({
      ok: true, action: "status", url: page.url(), title: await page.title(),
    }));
    emit(r);
  } catch (e) {
    fail(1, "status failed", { detail: String((e && e.message) || e) });
  }
}

function cmdReset() {
  const dir = path.join(STATE_DIR_BASE, stateName);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  emit({ ok: true, action: "reset", stateDir: dir });
}

async function cmdDoctor() {
  const pw = await loadPlaywright();
  try {
    const browser = await pw.chromium.launch({ headless: true });
    await browser.close();
  } catch (e) {
    fail(1, "Chromium binary missing", {
      hint: "Run from repo root: npx playwright install chromium",
      detail: String((e && e.message) || e),
    });
  }
  emit({
    ok: true,
    action: "doctor",
    chromiumOk: true,
    stateDirBase: STATE_DIR_BASE,
  });
}

function printHelp() {
  process.stdout.write([
    "Hermes Playwright wrapper (https://github.com/microsoft/playwright).",
    "",
    "Subcommands:",
    "  goto       --url <url> [--wait-ms 12000] [--state default] [--headed]",
    "  eval       --js  <expr> [--state default] [--headed]",
    "  screenshot --out <path> [--state default] [--full-page] [--headed]",
    "  status     [--state default]",
    "  reset      [--state default]",
    "  doctor",
    "",
    "Persistent context lives at .ai-sync/playwright-state/<state>/ so cookies",
    "and localStorage survive across rounds (sign in once, reuse forever).",
    "",
    "Install (one time, from repo root):",
    "  npm i -D @playwright/test",
    "  npx playwright install chromium",
    "",
    "When to prefer this over .tools/auto-hermes-browser.mjs:",
    "  * the user is actively using Chrome and shouldn't be interrupted",
    "  * the round needs deterministic auth state that survives across rounds",
    "  * running unattended / in CI with no foreground browser",
    "",
  ].join("\n"));
}

(async () => {
  switch (subcommand) {
    case "goto": await cmdGoto(); break;
    case "eval": await cmdEval(); break;
    case "screenshot": await cmdScreenshot(); break;
    case "status": await cmdStatus(); break;
    case "reset": cmdReset(); break;
    case "doctor": await cmdDoctor(); break;
    case undefined: case "": case "help": case "--help": case "-h":
      printHelp(); process.exit(0);
    default:
      printHelp();
      process.exit(2);
  }
})().catch((e) => fail(1, "wrapper crashed", { detail: String((e && e.stack) || e) }));
