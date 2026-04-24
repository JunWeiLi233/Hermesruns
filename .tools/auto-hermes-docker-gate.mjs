#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    command: "",
    dockerfile: "Dockerfile",
    tag: "hermes-autohermes-gate:local",
    outputJson: ".ai-sync/AUTO_HERMES_DOCKER_GATE.json",
    outputMd: ".ai-sync/AUTO_HERMES_DOCKER_GATE.md",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[++i] || args[key];
    }
  }

  return args;
}

function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function resolveDockerExecutable() {
  const candidates = [
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    "C:\\Program Files (x86)\\Docker\\Docker\\resources\\bin\\docker.exe",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const dir of pathEntries) {
    const candidate = path.join(dir, "docker.exe");
    if (fs.existsSync(candidate)) return candidate;
  }

  try {
    const output = execFileSync(
      "C:\\WINDOWS\\System32\\where.exe",
      ["docker"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const resolved = String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0] || "";
    return resolved || "docker";
  } catch {
    return "docker";
  }
}

function resolveDockerCredentialHelper() {
  const candidates = [
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker-credential-desktop.exe",
    "C:\\Program Files (x86)\\Docker\\Docker\\resources\\bin\\docker-credential-desktop.exe",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const dir of pathEntries) {
    const candidate = path.join(dir, "docker-credential-desktop.exe");
    if (fs.existsSync(candidate)) return candidate;
  }

  try {
    const output = execFileSync(
      "C:\\WINDOWS\\System32\\where.exe",
      ["docker-credential-desktop"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const resolved = String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0] || "";
    return resolved || "";
  } catch {
    return "";
  }
}

function buildDockerEnv() {
  const env = { ...process.env };
  const dockerExecutable = resolveDockerExecutable();
  const helperExecutable = resolveDockerCredentialHelper();
  const extraDirs = [
    path.dirname(dockerExecutable),
    helperExecutable ? path.dirname(helperExecutable) : "",
  ].filter(Boolean);

  if (extraDirs.length) {
    const existingPathEntries = String(env.PATH || "")
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const merged = [...new Set([...extraDirs, ...existingPathEntries])];
    env.PATH = merged.join(path.delimiter);
  }

  return {
    env,
    dockerExecutable,
    helperExecutable,
  };
}

function runGit(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function currentStatusSnapshot() {
  return runGit(["status", "--short", "--untracked-files=all"])
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .join("\n");
}

function currentChangedPaths() {
  const status = runGit(["status", "--short", "--untracked-files=all"]);
  if (!status) return [];
  return status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .sort();
}

function renderMarkdown(result) {
  return [
    "# Auto-Hermes Docker Gate",
    "",
    `Generated: ${result.generatedAt}`,
    `Passed: ${result.passed ? "yes" : "no"}`,
    `Git Head: ${result.gitHead || "unknown"}`,
    `Command: ${result.command}`,
    `Reason: ${result.reason}`,
    "",
    "## Status Snapshot",
    result.statusSnapshot ? "```text" : "",
    result.statusSnapshot || "clean working tree",
    result.statusSnapshot ? "```" : "",
    "",
    "## Output",
    result.output ? "```text" : "",
    result.output || "none",
    result.output ? "```" : "",
  ].join("\n") + "\n";
}

function executeDockerGate(args) {
  const command = String(args.command || "").trim();
  if (command) {
    return execFileSync(
      "C:\\WINDOWS\\System32\\cmd.exe",
      ["/c", command],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  }

  const dockerRuntime = buildDockerEnv();
  return execFileSync(
    dockerRuntime.dockerExecutable,
    ["build", "-f", resolveFromRoot(args.dockerfile), "-t", args.tag, "."],
    { cwd: ROOT, env: dockerRuntime.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

export function runAutoHermesDockerGate(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  const result = {
    generatedAt: nowIso(),
    passed: false,
    gitHead: "",
    statusSnapshot: "",
    changedPaths: [],
    command: String(args.command || "").trim()
      || `docker build -f ${resolveFromRoot(args.dockerfile)} -t ${args.tag} .`,
    reason: "",
    output: "",
  };

  try {
    result.gitHead = runGit(["rev-parse", "HEAD"]);
  } catch {
    result.gitHead = "";
  }
  try {
    result.statusSnapshot = currentStatusSnapshot();
  } catch {
    result.statusSnapshot = "";
  }
  try {
    result.changedPaths = currentChangedPaths();
  } catch {
    result.changedPaths = [];
  }

  try {
    result.output = executeDockerGate(args);
    result.passed = true;
    result.reason = "Docker publish gate passed for the current working tree.";
  } catch (error) {
    result.output = [String(error?.stdout || "").trim(), String(error?.stderr || "").trim(), String(error?.message || "").trim()]
      .filter(Boolean)
      .join("\n")
      .trim();
    result.passed = false;
    result.reason = "Docker publish gate failed for the current working tree.";
  }

  if (args.write) {
    const jsonPath = resolveFromRoot(args.outputJson);
    const mdPath = resolveFromRoot(args.outputMd);
    ensureParent(jsonPath);
    ensureParent(mdPath);
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");
    fs.writeFileSync(mdPath, renderMarkdown(result), "utf8");
  }

  if (args.json) {
    return {
      result,
      output: `${JSON.stringify(result, null, 2)}\n`,
    };
  }

  return {
    result,
    output: renderMarkdown(result),
  };
}

function main() {
  const { output } = runAutoHermesDockerGate(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
