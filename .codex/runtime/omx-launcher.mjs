#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

const child = spawn(process.execPath, [resolvedScript, ...restArgs], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
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
