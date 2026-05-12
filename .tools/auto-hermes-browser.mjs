#!/usr/bin/env node
// .tools/auto-hermes-browser.mjs
//
// Single-tab, silent Hermes wrapper around browser-harness.
//
// Why this exists:
//   The raw `browser-harness` Python helpers default to `new_tab(url)`, which
//   *creates* a tab and brings the browser to front. Repeated rounds pile up
//   dozens of identical localhost tabs and the harness keeps attaching to
//   whichever tab Chrome happens to focus next — usually one of the user's
//   real tabs, not ours.
//
// What this wrapper guarantees:
//   1. Exactly ONE tab per Hermes URL prefix (default: localhost:8080 +
//      localhost:5173). Duplicate Hermes tabs from prior rounds are closed.
//   2. The Hermes tab is reused across rounds — we never call `new_tab`.
//   3. No focus stealing. We never call `Target.activateTarget` or
//      `Page.bringToFront`. Screenshots, JS evaluation, and navigation all
//      operate via an attached CDP session, which works on hidden tabs.
//   4. If a Hermes tab does not exist, we create one with `Target.createTarget`
//      `background:true` so Chrome does not pop to the front.
//
// All Python is generated here and shelled out to `browser-harness -c <code>`.
// The wrapper writes the Python to a temp file and asks browser-harness to
// `exec(open(...).read())` so no shell-quoting hell.
//
// Usage:
//   node .tools/auto-hermes-browser.mjs goto       --url http://localhost:8080/schedule [--wait-ms 8000]
//   node .tools/auto-hermes-browser.mjs eval       --js "document.title" [--await] [--json]
//   node .tools/auto-hermes-browser.mjs screenshot --out task-images/foo.png
//   node .tools/auto-hermes-browser.mjs status                  # prints url + readyState + console error count
//   node .tools/auto-hermes-browser.mjs cleanup                 # close duplicate Hermes tabs only
//   node .tools/auto-hermes-browser.mjs reset                   # close ALL Hermes tabs (next goto re-creates)
//
// Exit codes:
//   0 success
//   1 browser-harness invocation failed or returned an error payload
//   2 invalid arguments
//   3 timeout waiting for page load

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const subcommand = args[0];

function readArg(name, fallback = "") {
  const flag = `--${name}`;
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return fallback;
  return String(args[idx + 1] || "").trim();
}
function readFlag(name) { return args.includes(`--${name}`); }

const DEFAULT_HERMES_MARKERS = ["localhost:8080", "127.0.0.1:8080", "localhost:5173", "127.0.0.1:5173"];

function hermesMarkers() {
  const override = readArg("markers");
  if (!override) return DEFAULT_HERMES_MARKERS;
  return override.split(",").map((s) => s.trim()).filter(Boolean);
}

// --- Python templates --------------------------------------------------------
//
// All templates assume browser-harness is already loaded, so `cdp(...)` is in
// scope. We import `_send` for session-targeted CDP and `time/json/base64` as
// needed.

const PY_PREAMBLE = String.raw`
import json, base64, time, sys, os
from browser_harness.helpers import _send

HERMES_URL_MARKERS = __MARKERS__

def _is_page(t):
    return t.get("type") == "page"

def _is_hermes(t):
    url = str(t.get("url",""))
    return any(m in url for m in HERMES_URL_MARKERS)

def list_hermes_tabs():
    targets = cdp("Target.getTargets", {})
    return [t for t in (targets.get("targetInfos") or []) if _is_page(t) and _is_hermes(t)]

def attach(target_id):
    sess = _send({"method": "Target.attachToTarget", "params": {"targetId": target_id, "flatten": True}})
    res = sess.get("result") or {}
    if "sessionId" not in res:
        raise SystemExit(json.dumps({"ok": False, "error": "attach failed", "raw": sess}))
    return res["sessionId"]

def consolidate_existing():
    """Close duplicate Hermes tabs. Return the kept targetId, or None if none exist."""
    tabs = list_hermes_tabs()
    if not tabs:
        return None
    keep = tabs[0]["targetId"]
    for stale in tabs[1:]:
        try:
            _send({"method": "Target.closeTarget", "params": {"targetId": stale["targetId"]}})
        except Exception:
            pass
    return keep

def consolidate_or_create(initial_url):
    """Single-tab guarantee. Never call activateTarget / bringToFront."""
    keep = consolidate_existing()
    if keep is not None:
        return keep
    # Create one BACKGROUND tab so Chrome does not pop to front.
    res = _send({"method": "Target.createTarget", "params": {"url": initial_url, "background": True}})
    result = res.get("result") or {}
    if "targetId" not in result:
        raise SystemExit(json.dumps({"ok": False, "error": "createTarget failed", "raw": res}))
    return result["targetId"]

def wait_for_load(session_id, max_ms=15000, poll_ms=500):
    deadline = time.time() + (max_ms / 1000.0)
    while time.time() < deadline:
        info = _send({
            "method": "Runtime.evaluate",
            "params": {"expression": "document.readyState", "returnByValue": True},
            "session_id": session_id,
        })
        val = (((info.get("result") or {}).get("result")) or {}).get("value")
        if val == "complete":
            return True
        time.sleep(poll_ms / 1000.0)
    return False

def emit(payload):
    sys.stdout.write("HERMES_RESULT " + json.dumps(payload) + "\n")
`;

function pythonGoto({ url, waitMs }) {
  return `
__url = ${JSON.stringify(url)}
__wait_ms = ${Number(waitMs) || 15000}
__tid = consolidate_or_create(__url)
__sid = attach(__tid)
# Navigate the already-attached session (no activateTarget, no bringToFront).
_send({"method": "Page.navigate", "params": {"url": __url}, "session_id": __sid})
__loaded = wait_for_load(__sid, max_ms=__wait_ms)
__final = _send({"method": "Runtime.evaluate", "params": {"expression": "location.href", "returnByValue": True}, "session_id": __sid})
__href = (((__final.get("result") or {}).get("result")) or {}).get("value")
emit({"ok": True, "targetId": __tid, "loaded": __loaded, "url": __href})
`;
}

function pythonEval({ js, awaitPromise }) {
  // We do not consolidate-or-create on eval; if no Hermes tab exists, error
  // out so callers do not get a silent miss.
  return `
__keep = consolidate_existing()
if __keep is None:
    emit({"ok": False, "error": "no Hermes tab — call 'goto' first"})
else:
    __sid = attach(__keep)
    __res = _send({
        "method": "Runtime.evaluate",
        "params": {
            "expression": ${JSON.stringify(js)},
            "returnByValue": True,
            "awaitPromise": ${awaitPromise ? "True" : "False"}
        },
        "session_id": __sid,
    })
    __payload = (__res.get("result") or {})
    __value = ((__payload.get("result")) or {}).get("value")
    __exception = (__payload.get("exceptionDetails") or {}).get("text")
    emit({"ok": __exception is None, "value": __value, "exception": __exception})
`;
}

function pythonScreenshot({ out, format, quality }) {
  const absOut = path.isAbsolute(out) ? out : path.join(REPO_ROOT, out);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  const pyOut = absOut.replace(/\\/g, "/");
  // Default to JPEG quality 78 — PNG payloads time out the harness's socket
  // recv on Windows for full-viewport captures. JPEG is ~10x smaller and
  // still adequate for visual proof.
  const fmt = (format || "jpeg").toLowerCase();
  const qty = Math.max(40, Math.min(100, Number(quality) || 78));
  const paramsJson = fmt === "png"
    ? `{"format": "png"}`
    : `{"format": "jpeg", "quality": ${qty}}`;
  return `
__keep = consolidate_existing()
if __keep is None:
    emit({"ok": False, "error": "no Hermes tab — call 'goto' first"})
else:
    __sid = attach(__keep)
    __data = ""
    __last_err = ""
    for __attempt in range(3):
        try:
            __shot = _send({"method": "Page.captureScreenshot", "params": ${paramsJson}, "session_id": __sid})
            __data = ((__shot.get("result") or {}).get("data")) or ""
            if __data:
                break
        except Exception as e:
            __last_err = str(e)
            time.sleep(0.5)
    if not __data:
        emit({"ok": False, "error": ("screenshot returned no data" if not __last_err else "screenshot failed: " + __last_err)})
    else:
        with open(${JSON.stringify(pyOut)}, "wb") as f:
            f.write(base64.b64decode(__data))
        emit({"ok": True, "path": ${JSON.stringify(pyOut)}, "bytes": len(__data)})
`;
}

function pythonStatus() {
  return `
__keep = consolidate_existing()
if __keep is None:
    emit({"ok": False, "error": "no Hermes tab"})
else:
    __sid = attach(__keep)
    __res = _send({
        "method": "Runtime.evaluate",
        "params": {"expression": "JSON.stringify({url:location.href, ready:document.readyState, title:document.title, hasRoot: !!document.getElementById('root'), rootChildren: document.getElementById('root')?.children?.length || 0})", "returnByValue": True},
        "session_id": __sid,
    })
    __raw = (((__res.get("result") or {}).get("result")) or {}).get("value") or "{}"
    emit({"ok": True, "targetId": __keep, "state": json.loads(__raw)})
`;
}

function pythonCleanup() {
  // Close duplicates, keep one. Returns count closed.
  return `
__tabs = list_hermes_tabs()
__closed = 0
if len(__tabs) > 1:
    for stale in __tabs[1:]:
        try:
            _send({"method": "Target.closeTarget", "params": {"targetId": stale["targetId"]}})
            __closed += 1
        except Exception:
            pass
emit({"ok": True, "kept": __tabs[0]["targetId"] if __tabs else None, "closed": __closed, "before": len(__tabs)})
`;
}

function pythonReset() {
  return `
__tabs = list_hermes_tabs()
__closed = 0
for t in __tabs:
    try:
        _send({"method": "Target.closeTarget", "params": {"targetId": t["targetId"]}})
        __closed += 1
    except Exception:
        pass
emit({"ok": True, "closed": __closed})
`;
}

// --- Execution ---------------------------------------------------------------

function runPython(scriptBody) {
  const markers = JSON.stringify(hermesMarkers());
  const preamble = PY_PREAMBLE.replace("__MARKERS__", markers);
  const full = `${preamble}\n${scriptBody}\n`;

  const tmp = path.join(os.tmpdir(), `hermes-browser-${crypto.randomBytes(6).toString("hex")}.py`);
  fs.writeFileSync(tmp, full, "utf8");
  // Tell browser-harness to exec our temp file. Single -c argument keeps the
  // shell quoting trivial. We pass the temp path as a raw Python string.
  // Force UTF-8 reading; Windows Chinese locales default to GBK and our
  // Python contains non-ASCII identifiers / messages that explode otherwise.
  const harnessScript = `exec(open(r'${tmp.replace(/'/g, "\\'")}', encoding='utf-8').read())`;

  // Try the `browser-harness` console-script first; if it's blocked (e.g.
  // Windows Device Guard) or missing, fall back to invoking the underlying
  // Python module directly. The module path is identical to what the .exe
  // wraps via the [project.scripts] entry in browser-harness's pyproject.
  let result = spawnSync("browser-harness", ["-c", harnessScript], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER_HARNESS_QUIET: "1" },
  });
  const harnessFailed = result.error || (result.status !== 0 && result.status !== null);
  if (harnessFailed) {
    result = spawnSync("python", ["-m", "browser_harness.run", "-c", harnessScript], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, BROWSER_HARNESS_QUIET: "1", PYTHONIOENCODING: "utf-8" },
    });
  }

  try { fs.unlinkSync(tmp); } catch { /* ignore */ }

  if (result.error) {
    return { ok: false, error: `browser-harness not on PATH or failed: ${result.error.message}` };
  }
  const stdout = (result.stdout || "").toString();
  const stderr = (result.stderr || "").toString();

  // Extract the LAST HERMES_RESULT line so we ignore any incidental output
  // from the harness daemon startup.
  const lines = stdout.split(/\r?\n/).filter((l) => l.startsWith("HERMES_RESULT "));
  if (lines.length === 0) {
    return {
      ok: false,
      error: "no HERMES_RESULT line in output",
      exitCode: result.status,
      stderr: stderr.slice(-800),
      stdout: stdout.slice(-800),
    };
  }
  try {
    return JSON.parse(lines[lines.length - 1].replace(/^HERMES_RESULT\s+/, ""));
  } catch (err) {
    return { ok: false, error: `failed to parse HERMES_RESULT: ${err.message}`, raw: lines[lines.length - 1] };
  }
}

function die(code, payload) {
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(code);
}

function printHelp() {
  process.stdout.write([
    "Single-tab, silent Hermes wrapper around browser-harness.",
    "",
    "Subcommands:",
    "  goto       --url <url> [--wait-ms 15000] [--markers <list>]",
    "  eval       --js <expr> [--await] [--markers <list>]",
    "  screenshot --out <path> [--markers <list>]",
    "  status     [--markers <list>]",
    "  cleanup    [--markers <list>]    # close duplicate Hermes tabs",
    "  reset      [--markers <list>]    # close ALL Hermes tabs",
    "",
    "Guarantees: never opens more than one Hermes tab; never steals focus.",
    "Output: JSON on stdout. Exit 0 on success, non-zero on failure.",
    "",
    `Default Hermes URL markers: ${DEFAULT_HERMES_MARKERS.join(", ")}`,
  ].join("\n") + "\n");
}

switch (subcommand) {
  case undefined:
  case "--help":
  case "-h":
    printHelp();
    process.exit(0);
    break;

  case "goto": {
    const url = readArg("url");
    if (!url) die(2, { ok: false, error: "--url is required" });
    const waitMs = Number(readArg("wait-ms", "15000"));
    const out = runPython(pythonGoto({ url, waitMs }));
    if (!out.ok) die(1, out);
    if (!out.loaded) die(3, { ...out, error: "page did not reach readyState=complete in time" });
    if (typeof out.url === "string" && out.url.startsWith("chrome-error://")) {
      die(1, { ...out, ok: false, error: `navigation failed — landed on ${out.url}. Target likely unreachable.` });
    }
    die(0, out);
    break;
  }

  case "eval": {
    const js = readArg("js");
    if (!js) die(2, { ok: false, error: "--js is required" });
    const awaitPromise = readFlag("await");
    const out = runPython(pythonEval({ js, awaitPromise }));
    die(out.ok ? 0 : 1, out);
    break;
  }

  case "screenshot": {
    const out = readArg("out");
    if (!out) die(2, { ok: false, error: "--out is required" });
    const format = readArg("format", "jpeg");
    const quality = readArg("quality", "78");
    const result = runPython(pythonScreenshot({ out, format, quality }));
    die(result.ok ? 0 : 1, result);
    break;
  }

  case "status": {
    const out = runPython(pythonStatus());
    die(out.ok ? 0 : 1, out);
    break;
  }

  case "cleanup": {
    const out = runPython(pythonCleanup());
    die(out.ok ? 0 : 1, out);
    break;
  }

  case "reset": {
    const out = runPython(pythonReset());
    die(out.ok ? 0 : 1, out);
    break;
  }

  default:
    process.stderr.write(`auto-hermes-browser: unknown subcommand '${subcommand}'. Run with --help.\n`);
    process.exit(2);
}
