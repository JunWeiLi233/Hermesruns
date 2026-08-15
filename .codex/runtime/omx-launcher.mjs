#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const RUNTIME_DIR = path.dirname(__filename);
const CODEX_DIR = path.dirname(RUNTIME_DIR);
const ROOT = path.dirname(CODEX_DIR);

function normalize(p) {
  return p ? path.normalize(p) : "";
}

function existingFile(p) {
  if (!p) return "";
  try {
    return fs.existsSync(p) ? p : "";
  } catch {
    return "";
  }
}

function existingDir(p) {
  if (!p) return "";
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory() ? p : "";
  } catch {
    return "";
  }
}

function tryNpmRoot() {
  try {
    const output = execFileSync("npm", ["root", "-g"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return existingDir(output);
  } catch {
    return "";
  }
}

function windowsUserDirs() {
  const candidates = [];
  const userProfile = process.env.USERPROFILE || "";
  if (userProfile) candidates.push(userProfile);

  const appData = process.env.APPDATA || "";
  if (appData) candidates.push(path.dirname(path.dirname(appData)));

  const winUsersDir = process.platform === "win32" ? "C:\\Users" : "/mnt/c/Users";
  if (existingDir(winUsersDir)) {
    try {
      for (const entry of fs.readdirSync(winUsersDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        candidates.push(path.join(winUsersDir, entry.name));
      }
    } catch {
      // ignore
    }
  }

  return [...new Set(candidates.map(normalize).filter(Boolean))];
}

function npmRootCandidates() {
  const home = os.homedir();
  const candidates = [];

  const npmRoot = tryNpmRoot();
  if (npmRoot) candidates.push(npmRoot);

  candidates.push(path.join(home, ".npm-global", "lib", "node_modules"));
  candidates.push(path.join(home, ".local", "lib", "node_modules"));

  const nvmDir = process.env.NVM_DIR || path.join(home, ".nvm");
  const nvmVersions = path.join(nvmDir, "versions", "node");
  if (existingDir(nvmVersions)) {
    try {
      for (const version of fs.readdirSync(nvmVersions, { withFileTypes: true })) {
        if (!version.isDirectory()) continue;
        candidates.push(path.join(nvmVersions, version.name, "lib", "node_modules"));
      }
    } catch {
      // ignore
    }
  }

  for (const winUserDir of windowsUserDirs()) {
    candidates.push(path.join(winUserDir, "AppData", "Roaming", "npm", "node_modules"));
  }

  return [...new Set(candidates.map(normalize).filter(Boolean))];
}

function resolveOhMyCodexScript(relativeScriptPath) {
  const overrideDist = process.env.OMX_DIST_DIR || "";
  const overrideRoot = process.env.OMX_NODE_MODULES || "";
  const directCandidates = [];

  if (overrideDist) directCandidates.push(path.join(overrideDist, relativeScriptPath));
  if (overrideRoot) directCandidates.push(path.join(overrideRoot, "oh-my-codex", "dist", relativeScriptPath));

  for (const base of npmRootCandidates()) {
    directCandidates.push(path.join(base, "oh-my-codex", "dist", relativeScriptPath));
  }

  for (const candidate of directCandidates) {
    const hit = existingFile(candidate);
    if (hit) return hit;
  }

  return "";
}

function printUsageAndExit() {
  console.error("Usage: node .codex/runtime/omx-launcher.mjs <dist-relative-script> [args...]");
  process.exit(1);
}

const [, , firstArg, ...restArgs] = process.argv;
if (!firstArg) {
  printUsageAndExit();
}

if (firstArg === "--resolve") {
  const relativeScriptPath = restArgs[0];
  if (!relativeScriptPath) printUsageAndExit();
  const resolved = resolveOhMyCodexScript(relativeScriptPath);
  if (!resolved) {
    console.error(`Unable to resolve oh-my-codex script: ${relativeScriptPath}`);
    process.exit(1);
  }
  process.stdout.write(`${resolved}\n`);
  process.exit(0);
}

const resolvedScript = resolveOhMyCodexScript(firstArg);
if (!resolvedScript) {
  console.error(
    `Unable to resolve oh-my-codex runtime for ${firstArg}. ` +
    "Install oh-my-codex in this environment or set OMX_DIST_DIR/OMX_NODE_MODULES.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Background-leak guards (Windows-heavy environments):
// Codex hosts used to leave every OMX MCP server set running after a session
// or loop round ended, stacking dozens of stray node.exe processes. The launcher
// now (1) reaps the previous set for the same script when it belongs to a dead
// host or to our own host's earlier round, and (2) exits with its child when
// the parent host process is gone.
// Set OMX_LAUNCHER_NO_TAKEOVER=1 to disable the reaping behavior.
// ---------------------------------------------------------------------------

const WATCHDOG_INTERVAL_MS = 4000;
const TAKEOVER_KILL_GRACE_MS = 1500;

function pidAlive(pid) {
  if (!pid || pid <= 0 || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function killTree(pids) {
  for (const pid of pids) {
    if (!pid || pid <= 0) continue;
    for (const signal of ["SIGTERM", "SIGKILL"]) {
      try {
        process.kill(pid, signal);
      } catch {
        // already gone or inaccessible
      }
    }
  }
}

const scriptTag = crypto.createHash("sha1").update(resolvedScript).digest("hex").slice(0, 16);
const stateDir = path.join(os.tmpdir(), "omx-launcher");
const stateFile = path.join(stateDir, `${scriptTag}-${process.pid}.json`);
const parentPid = process.ppid || 0;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeOwnState(childPid) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        v: 1,
        script: resolvedScript,
        pid: process.pid,
        childPid: childPid || 0,
        ppid: parentPid,
        startedAt: Date.now(),
        heartbeat: Date.now(),
      }),
    );
  } catch {
    // state bookkeeping is best-effort; never block the server itself
  }
}

function removeOwnState() {
  try {
    fs.unlinkSync(stateFile);
  } catch {
    // already gone
  }
}

function listSiblingStates() {
  try {
    return fs
      .readdirSync(stateDir)
      .filter((name) => name.startsWith(`${scriptTag}-`) && name !== path.basename(stateFile))
      .map((name) => ({ name, state: readJson(path.join(stateDir, name)) }))
      .filter((entry) => entry.state);
  } catch {
    return [];
  }
}

function reapStaleInstances() {
  if (process.env.OMX_LAUNCHER_NO_TAKEOVER === "1") return;
  for (const { name, state: previous } of listSiblingStates()) {
    const statePath = path.join(stateDir, name);
    if (!previous.pid || previous.pid === process.pid) continue;

    if (!pidAlive(previous.pid)) {
      try {
        fs.unlinkSync(statePath);
      } catch {
        // already gone
      }
      continue;
    }

    // Only reap when the previous set is provably stale: its host is gone, or
    // it belongs to an earlier round of the very host that just spawned us. A
    // set owned by a different live host (a concurrent Codex session) is left
    // alone.
    const previousHostAlive = pidAlive(previous.ppid);
    if (previousHostAlive && previous.ppid !== parentPid) continue;

    killTree([previous.pid, previous.childPid]);
    setTimeout(() => {
      // SIGTERM on Windows is already TerminateProcess; this is just a
      // defensive second pass in case either pid ignored it.
      killTree([previous.pid, previous.childPid]);
      try {
        fs.unlinkSync(statePath);
      } catch {
        // already gone
      }
    }, TAKEOVER_KILL_GRACE_MS).unref();
  }
}

const child = spawn(process.execPath, [resolvedScript, ...restArgs], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

reapStaleInstances();
writeOwnState(child.pid ?? 0);

let tornDown = false;
function teardown() {
  if (tornDown) return;
  tornDown = true;
  try {
    if (!child.killed) child.kill();
  } catch {
    // already gone
  }
}

const watchdog = setInterval(() => {
  if (!pidAlive(parentPid)) {
    clearInterval(watchdog);
    teardown();
    removeOwnState();
    setTimeout(() => process.exit(0), 250).unref();
    return;
  }
  writeOwnState(child.pid ?? 0);
}, WATCHDOG_INTERVAL_MS);
watchdog.unref();

process.on("exit", () => {
  teardown();
  removeOwnState();
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  clearInterval(watchdog);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`Failed to start resolved oh-my-codex runtime: ${error.message}`);
  process.exit(1);
});
