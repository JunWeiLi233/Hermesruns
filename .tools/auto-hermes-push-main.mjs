#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runArchitectureDiagramRefresh } from "./refresh-architecture-diagrams.mjs";
import { runAutoHermesSecurity } from "./auto-hermes-security.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const EXPECTED_REMOTE_URL = "https://github.com/520HXC/run.git";
const EXPECTED_USER_NAME = "JunWeiLi233";
const EXPECTED_USER_EMAIL = "mcpejunwei@gmail.com";

function parseArgs(argv) {
  const args = {
    rootDir: ROOT,
    execute: false,
    json: false,
    sourceRef: "HEAD",
    targetBranch: "main",
    backupBranch: "save-old-version",
    remoteName: "origin",
    targetRemoteUrl: EXPECTED_REMOTE_URL,
    message: "auto-hermes push main",
    prTitle: "",
    prBody: "",
    skipChecks: false,
    outputJson: ".ai-sync/AUTO_HERMES_PUSH_MAIN.json",
    outputMd: ".ai-sync/AUTO_HERMES_PUSH_MAIN.md",
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") args.execute = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--skip-checks") args.skipChecks = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[++index] || args[key];
    }
  }
  args.rootDir = path.resolve(String(args.rootDir || ROOT));
  return args;
}

function normalizeRemoteUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function defaultRunCommand(command, args, options = {}) {
  if (process.platform === "win32") {
    const quote = (value) => `'${String(value || "").replace(/'/g, "''")}'`;
    const psCommand = `& ${quote(command)} ${args.map(quote).join(" ")}`;
    return execFileSync("C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoProfile", "-Command", psCommand], {
      cwd: options.cwd || ROOT,
      encoding: "utf8",
      stdio: options.stdio || ["ignore", "pipe", "pipe"],
    }).trim();
  }
  return execFileSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveFromRoot(rootDir, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
}

function resolveGitDir(rootDir) {
  const dotGit = path.join(rootDir, ".git");
  if (!fs.existsSync(dotGit)) return "";
  const stat = fs.statSync(dotGit);
  if (stat.isDirectory()) return dotGit;
  const content = fs.readFileSync(dotGit, "utf8");
  const match = content.match(/^gitdir:\s*(.+)$/im);
  if (!match) return "";
  return path.resolve(rootDir, match[1].trim());
}

function readGitConfigValue(rootDir, section, key) {
  const gitDir = resolveGitDir(rootDir);
  if (!gitDir) return "";
  const configPath = path.join(gitDir, "config");
  if (!fs.existsSync(configPath)) return "";
  let activeSection = "";
  for (const line of fs.readFileSync(configPath, "utf8").split(/\r?\n/)) {
    const sectionMatch = line.match(/^\s*\[(.+)]\s*$/);
    if (sectionMatch) {
      activeSection = sectionMatch[1].trim();
      continue;
    }
    if (activeSection !== section) continue;
    const keyMatch = line.match(/^\s*([^=]+?)\s*=\s*(.+?)\s*$/);
    if (keyMatch && keyMatch[1].trim() === key) return keyMatch[2].trim();
  }
  return "";
}

function readGitHead(rootDir) {
  const gitDir = resolveGitDir(rootDir);
  if (!gitDir) return { branch: "", head: "" };
  const headPath = path.join(gitDir, "HEAD");
  if (!fs.existsSync(headPath)) return { branch: "", head: "" };
  const headContent = fs.readFileSync(headPath, "utf8").trim();
  const refMatch = headContent.match(/^ref:\s+refs\/heads\/(.+)$/);
  if (!refMatch) return { branch: "", head: headContent };
  const branch = refMatch[1];
  const refPath = path.join(gitDir, "refs", "heads", ...branch.split("/"));
  let head = fs.existsSync(refPath) ? fs.readFileSync(refPath, "utf8").trim() : "";
  if (!head) {
    const packedRefs = path.join(gitDir, "packed-refs");
    if (fs.existsSync(packedRefs)) {
      const packed = fs.readFileSync(packedRefs, "utf8");
      const line = packed.split(/\r?\n/).find((candidate) => candidate.endsWith(` refs/heads/${branch}`));
      head = line ? line.split(/\s+/)[0] : "";
    }
  }
  return { branch, head };
}

function loadDryRunGitMetadata(rootDir, remoteName) {
  const head = readGitHead(rootDir);
  return {
    remoteUrl: readGitConfigValue(rootDir, `remote "${remoteName}"`, "url"),
    userName: readGitConfigValue(rootDir, "user", "name"),
    userEmail: readGitConfigValue(rootDir, "user", "email"),
    sourceBranch: head.branch,
    sourceHead: head.head,
  };
}

function step(id, description, command = "") {
  return { id, description, command };
}

export function buildAutoHermesPushMainPlan(rawArgs = {}) {
  const args = { ...parseArgs([]), ...rawArgs };
  const node = "node";
  const ps = "powershell";
  const git = "git";
  const gh = "gh";
  const autoCommitMessage = String(args.message || "auto-hermes push main").replace(/"/g, '\\"');
  const prTitle = args.prTitle || autoCommitMessage;
  const prBody = args.prBody || "Auto-generated PR from Hermes auto-hermes-push-main workflow.\n\nGates passed: repo identity, diagrams, security audit, frontend lint, backend compile.";
  return {
    targetRemoteUrl: args.targetRemoteUrl,
    targetBranch: args.targetBranch,
    backupBranch: args.backupBranch,
    sourceRef: args.sourceRef,
    steps: [
      step("repo", "Verify this is a Git repository and the publish remote is the Hermes main repo.", `${git} config --get remote.${args.remoteName}.url`),
      step("identity", "Verify git identity before creating publish commits.", `${git} config user.name && ${git} config user.email`),
      step("readme-diagrams", "Always refresh README, /auto-hermes workflow diagram, SaaS diagram, and AI agents diagram.", `${node} .tools/refresh-architecture-diagrams.mjs --write --force`),
      step("static-security", "Run the repo-aware secret, PII, API-key, config, and leak detector before publishing.", `${node} .tools/auto-hermes-security.mjs --mode audit --write --json --command-name auto-hermes-push-main`),
      step("frontend", "Run frontend lint before publish.", "cd frontend && npm run lint"),
      step("backend", "Compile backend before publish.", "cd backend && ./mvnw -q -DskipTests compile"),
      step("docker", "Run Docker/main-repository publish gate.", `${node} .tools/auto-hermes-docker-gate.mjs --write`),
      step("commit", "Create a guarded publish commit for current changes when needed.", `${ps} -File .tools/auto-commit.ps1 -Message "${autoCommitMessage}"`),
      step("fetch", "Fetch the current remote main tip.", `${git} fetch ${args.remoteName} ${args.targetBranch}`),
      step("push-branch", "Push the current branch to remote so a PR can be opened.", `${git} push ${args.remoteName} HEAD`),
      step("create-pr", "Create a pull request from the current branch into main.", `${gh} pr create --base ${args.targetBranch} --head $(git branch --show-current) --title "${prTitle}" --body "${prBody}"`),
    ],
  };
}

export function isPublishBlockingFinding(finding) {
  const severity = String(finding?.severity || "").toUpperCase();
  const checker = String(finding?.checker || "").toLowerCase();
  const summary = String(finding?.summary || "").toLowerCase();
  const sensitive = /secret|pii|api|key|token|password|credential|leak|config/.test(`${checker} ${summary}`);
  if (/secret|pii/.test(checker)) return true;
  if (severity === "CRITICAL") return true;
  return severity === "HIGH" && sensitive;
}

function renderMarkdown(result) {
  const lines = [
    "# Auto-Hermes Push Main",
    "",
    `Generated: ${result.generatedAt}`,
    `Status: ${result.status}`,
    `Mode: ${result.execute ? "execute" : "dry-run"}`,
    `Reason: ${result.reason}`,
    "",
    "## Publish Target",
    `- remote: ${result.remoteName}`,
    `- expected: ${result.targetRemoteUrl}`,
    `- actual: ${result.remoteUrl || "not checked"}`,
    `- target branch: ${result.targetBranch}`,
    `- source branch: ${result.sourceBranch || "not checked"}`,
    `- source ref: ${result.sourceRef}`,
    ...(result.prUrl ? [`- PR: ${result.prUrl}`] : []),
    "",
    "## Steps",
  ];
  result.steps.forEach((item) => {
    lines.push(`- ${item.status}: ${item.id} - ${item.description}`);
    if (item.command) lines.push(`  Command: \`${item.command}\``);
  });
  if (result.blockingFindings.length) {
    lines.push("", "## Blocking Findings");
    result.blockingFindings.forEach((finding) => {
      lines.push(`- ${finding.severity || "UNKNOWN"} ${finding.checker || "security"}: ${finding.summary || finding.target || "publish-blocking finding"}`);
    });
  }
  return `${lines.join("\n")}\n`;
}

function runGit(runCommand, rootDir, args) {
  return runCommand("git", args, { cwd: rootDir });
}

function assertRemoteMatches(result, actualUrl, expectedUrl) {
  result.remoteUrl = actualUrl;
  if (normalizeRemoteUrl(actualUrl) !== normalizeRemoteUrl(expectedUrl)) {
    result.status = "blocked";
    result.reason = `Publish remote does not match ${expectedUrl}. Found: ${actualUrl || "missing remote"}.`;
    return false;
  }
  return true;
}

function assertIdentity(result, userName, userEmail) {
  result.gitIdentity = { userName, userEmail };
  if (String(userName).trim() !== EXPECTED_USER_NAME || String(userEmail).trim() !== EXPECTED_USER_EMAIL) {
    result.status = "blocked";
    result.reason = `Git identity must be ${EXPECTED_USER_NAME} / ${EXPECTED_USER_EMAIL} before publishing. Found ${userName || "(missing)"} / ${userEmail || "(missing)"}.`;
    return false;
  }
  return true;
}

async function runSecurityGate(rootDir, commandName) {
  const { report } = await runAutoHermesSecurity({
    rootDir,
    mode: "audit",
    commandName,
    write: true,
    json: true,
    outputDir: ".ai-sync/security-reports",
  });
  const blockingFindings = (report.findings || []).filter(isPublishBlockingFinding);
  return { report, blockingFindings };
}

function runNpmScript(runCommand, cwd, scriptName) {
  if (process.platform === "win32") {
    return runCommand("cmd", ["/c", "npm", "run", scriptName], { cwd });
  }
  return runCommand("npm", ["run", scriptName], { cwd });
}

function markStep(result, id, status, extra = {}) {
  const item = result.steps.find((candidate) => candidate.id === id);
  if (item) Object.assign(item, { status }, extra);
}

export async function runAutoHermesPushMain(rawArgs = process.argv.slice(2)) {
  const providedObject = !Array.isArray(rawArgs);
  const args = providedObject ? { ...parseArgs([]), ...rawArgs } : parseArgs(rawArgs);
  const runCommand = args.runCommand || defaultRunCommand;
  const plan = buildAutoHermesPushMainPlan(args);
  const result = {
    generatedAt: new Date().toISOString(),
    status: args.execute ? "running" : "dry-run",
    reason: args.execute ? "Executing guarded push-main workflow." : "Dry run only. Pass --execute to write branches and push.",
    execute: Boolean(args.execute),
    remoteName: args.remoteName,
    targetRemoteUrl: args.targetRemoteUrl,
    targetBranch: args.targetBranch,
    backupBranch: args.backupBranch,
    sourceRef: args.sourceRef,
    remoteUrl: "",
    sourceBranch: "",
    sourceHead: "",
    sourceCommit: "",
    prUrl: "",
    gitIdentity: null,
    securityReportId: "",
    blockingFindings: [],
    steps: plan.steps.map((item) => ({ ...item, status: "pending" })),
  };

  try {
    markStep(result, "repo", "running");
    if (!args.execute) {
      const metadata = loadDryRunGitMetadata(args.rootDir, args.remoteName);
      if (!metadata.remoteUrl) {
        result.status = "blocked";
        result.reason = "Dry-run could not read .git/config remote metadata.";
        return finish(args, result);
      }
      if (!assertRemoteMatches(result, metadata.remoteUrl, args.targetRemoteUrl)) return finish(args, result);
      result.sourceBranch = metadata.sourceBranch;
      result.sourceHead = metadata.sourceHead;
      markStep(result, "repo", "completed");

      markStep(result, "identity", "running");
      if (!assertIdentity(result, metadata.userName, metadata.userEmail)) return finish(args, result);
      markStep(result, "identity", "completed");
      result.status = "dry-run";
      return finish(args, result);
    }

    runGit(runCommand, args.rootDir, ["rev-parse", "--is-inside-work-tree"]);
    const remoteUrl = runGit(runCommand, args.rootDir, ["config", "--get", `remote.${args.remoteName}.url`]);
    if (!assertRemoteMatches(result, remoteUrl, args.targetRemoteUrl)) return finish(args, result);
    result.sourceBranch = runGit(runCommand, args.rootDir, ["branch", "--show-current"]);
    result.sourceHead = runGit(runCommand, args.rootDir, ["rev-parse", "HEAD"]);
    markStep(result, "repo", "completed");

    markStep(result, "identity", "running");
    const userName = runGit(runCommand, args.rootDir, ["config", "user.name"]);
    const userEmail = runGit(runCommand, args.rootDir, ["config", "user.email"]);
    if (!assertIdentity(result, userName, userEmail)) return finish(args, result);
    markStep(result, "identity", "completed");


    markStep(result, "readme-diagrams", "running");
    runArchitectureDiagramRefresh({ rootDir: args.rootDir, force: true, changedFiles: ["README.md"] });
    markStep(result, "readme-diagrams", "completed");

    if (!args.skipChecks) {
      markStep(result, "static-security", "running");
      const security = await runSecurityGate(args.rootDir, "auto-hermes-push-main");
      result.securityReportId = security.report.runId;
      result.blockingFindings = security.blockingFindings;
      if (result.blockingFindings.length) {
        result.status = "blocked";
        result.reason = "Security gate found publish-blocking secret, PII, API, or config leak findings.";
        markStep(result, "static-security", "blocked");
        return finish(args, result);
      }
      markStep(result, "static-security", "completed");

      markStep(result, "frontend", "running");
      runNpmScript(runCommand, path.join(args.rootDir, "frontend"), "lint");
      markStep(result, "frontend", "completed");

      markStep(result, "backend", "running");
      runCommand(process.platform === "win32" ? "cmd" : "./mvnw", process.platform === "win32"
        ? ["/c", "mvnw.cmd", "-q", "-DskipTests", "compile"]
        : ["-q", "-DskipTests", "compile"], { cwd: path.join(args.rootDir, "backend") });
      markStep(result, "backend", "completed");

      markStep(result, "docker", "running");
      runCommand("node", [resolveFromRoot(args.rootDir, ".tools/auto-hermes-docker-gate.mjs"), "--write"], { cwd: args.rootDir });
      markStep(result, "docker", "completed");
    } else {
      ["static-security", "frontend", "backend", "docker"].forEach((id) => markStep(result, id, "skipped"));
    }

    markStep(result, "commit", "running");
    const statusAfterDocs = runGit(runCommand, args.rootDir, ["status", "--short", "--untracked-files=all"]);
    if (statusAfterDocs.trim()) {
      runCommand("powershell", ["-File", resolveFromRoot(args.rootDir, ".tools/auto-commit.ps1"), "-Message", args.message], { cwd: args.rootDir });
      markStep(result, "commit", "completed");
    } else {
      markStep(result, "commit", "skipped", { note: "No source or README/diagram changes needed a publish commit." });
    }
    result.sourceCommit = runGit(runCommand, args.rootDir, ["rev-parse", args.sourceRef]);

    markStep(result, "fetch", "running");
    runGit(runCommand, args.rootDir, ["fetch", args.remoteName, args.targetBranch]);
    markStep(result, "fetch", "completed");

    markStep(result, "push-branch", "running");
    const currentBranch = runGit(runCommand, args.rootDir, ["branch", "--show-current"]);
    if (currentBranch === args.targetBranch) {
      result.status = "blocked";
      result.reason = `Cannot create a PR from ${args.targetBranch} into itself. Switch to a feature branch first.`;
      markStep(result, "push-branch", "blocked");
      return finish(args, result);
    }
    runGit(runCommand, args.rootDir, ["push", args.remoteName, "HEAD"]);
    result.sourceBranch = currentBranch;
    markStep(result, "push-branch", "completed");

    markStep(result, "create-pr", "running");
    try {
      const prUrl = runCommand("gh", [
        "pr", "create",
        "--base", args.targetBranch,
        "--head", currentBranch,
        "--title", args.prTitle || args.message || "auto-hermes push main",
        "--body", args.prBody || "Auto-generated PR from Hermes auto-hermes-push-main workflow.\\n\\nGates passed: repo identity, diagrams, security audit, frontend lint, backend compile.",
      ], { cwd: args.rootDir });
      result.prUrl = String(prUrl || "").trim();
      markStep(result, "create-pr", "completed", { url: result.prUrl });
    } catch {
      result.status = "blocked";
      result.reason = "Failed to create PR. Ensure `gh` CLI is installed and authenticated (gh auth login).";
      markStep(result, "create-pr", "failed");
      return finish(args, result);
    }
    result.status = "completed";
    result.reason = `PR created from ${currentBranch} into ${args.targetBranch}.`;
  } catch (error) {
    result.status = "failed";
    result.reason = error instanceof Error ? error.message : String(error);
  }

  return finish(args, result);
}

function finish(args, result) {
  const output = args.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result);
  if (args.write) {
    fs.mkdirSync(path.dirname(resolveFromRoot(args.rootDir, args.outputJson)), { recursive: true });
    fs.writeFileSync(resolveFromRoot(args.rootDir, args.outputJson), JSON.stringify(result, null, 2), "utf8");
    fs.writeFileSync(resolveFromRoot(args.rootDir, args.outputMd), renderMarkdown(result), "utf8");
  }
  return { result, output };
}

async function main() {
  const { output, result } = await runAutoHermesPushMain(process.argv.slice(2));
  process.stdout.write(output);
  if (result.status === "blocked" || result.status === "failed") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
