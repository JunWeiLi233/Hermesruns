#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAutoHermesDockerGate } from "./auto-hermes-docker-gate.mjs";
import { runAutoHermesNotify } from "./auto-hermes-notify.mjs";
import { HERMES_REPOSITORY_URL } from "./hermes-repository.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    commit: false,
    push: false,
    autoPushWhenNeeded: false,
    task: "",
    summary: "",
    surface: "",
    message: "",
    files: "",
    strictFiles: false,
    verify: "",
    dockerGateJson: ".workspace/state/AUTO_HERMES_DOCKER_GATE.json",
    dockerGateMd: ".workspace/state/AUTO_HERMES_DOCKER_GATE.md",
    dockerGateCommand: "",
    dockerGateSkipRepoCheck: false,
    outputJson: ".workspace/state/AUTO_HERMES_FINISH.json",
    outputMd: ".workspace/state/AUTO_HERMES_FINISH.md",
    notifyJson: "",
    notifyMd: "",
    targetRemoteName: "origin",
    targetRemoteUrl: HERMES_REPOSITORY_URL,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--commit") args.commit = true;
    else if (arg === "--push") args.push = true;
    else if (arg === "--strict-files") args.strictFiles = true;
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

function splitList(value) {
  return String(value || "")
    .split("||")
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function nowIso() {
  return new Date().toISOString();
}

function parseCount(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeRepoPath(filePath) {
  let normalized = String(filePath || "").replace(/\\/g, "/").trim();
  if (normalized.startsWith("./")) normalized = normalized.slice(2);
  if (normalized.startsWith("/")) normalized = normalized.slice(1);
  return normalized;
}

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function classifyPath(filePath) {
  const normalized = normalizeRepoPath(filePath);

  const codexWorkflowPublishableRegexes = [
    /^\.codex\/commands\/auto-hermes(?:-max)?\.md$/i,
    /^\.codex\/workflows\//i,
    /^\.codex\/skills\/architecture-diagram-generator\//i,
  ];

  for (const pattern of codexWorkflowPublishableRegexes) {
    if (pattern.test(normalized)) {
      return { path: normalized, bucket: "publishable", reason: "Repo-owned Codex workflow/diagram asset that should ship with Hermes." };
    }
  }

  const localOnlyRegexes = [
    /^AGENTS\.md$/i,
    /^CLAUDE\.md$/i,
    /^TASKS\.md$/i,
    /^PRODUCT\.md$/i,
    /^HERMES_SELF_EVOLVING_ENGINE\.md$/i,
    /^\.claude\//i,
    /^\.codex\//i,
    /^\.agents\//i,
    /^\.ai\//i,
    /^\.workspace\/state\//i,
    /^\.workspace\/codex\//i,
    /^\.workspace\/cache\//i,
    /^\.workspace\/tmp\//i,
    /^\.mempalace\//i,
    /^mempalace\.yaml$/i,
    /^entities\.json$/i,
    /^CODEX_.*/i,
    /^CLAUDE_.*/i,
    /.*_DAILY_GUIDE\.(md|txt)$/i,
    /.*_LOOP_GUIDE\.(md|txt)$/i,
    /^ALLOW_LIST_TERMINAL_COMMANDS\.txt$/i,
    /^TRANSLATION_WORKFLOW\.md$/i,
    /^frontend\/VISUAL_QA_LIGHT_SYSTEM\.md$/i,
    /^course-map-images\//i,
    /^task-images\//i,
    /^images\//i,
    /^tools\/mempalace\//i,
    /^tools\/token_tester\//i,
    /^tools\/prompt_optimizer\//i,
    /^tools\/generate-codex\.js$/i,
    /^tools\/optimize-agent-context\.mjs$/i,
    /^tools\/suggest-tasks\.mjs$/i,
    /^tools\/check-translations\.mjs$/i,
    /^tools\/write-agent-checkpoint\.mjs$/i,
    /^tools\/fixtures\//i,
    /^tools\/hermes_sync_config\.json$/i,
    /^tools\/shoe-catalog-sources\.example\.json$/i,
  ];

  for (const pattern of localOnlyRegexes) {
    if (pattern.test(normalized)) {
      return { path: normalized, bucket: "local-only", reason: "Local workflow, memory, reference, or operator file." };
    }
  }

  const shouldIgnoreRegexes = [
    /^\.env(\..+)?$/i,
    /^Hermes\.local\.env(\..+)?\.ps1$/i,
    /(^|\/)\.DS_Store$/i,
    /(^|\/)Thumbs\.db$/i,
    /(^|\/)Desktop\.ini$/i,
    /\.log$/i,
    /^backend_log\.txt$/i,
    /\.pid$/i,
    /\.seed$/i,
    /(^|\/)tmp_/i,
    /\.(pem|key|p12|pfx|jks)$/i,
    /^credentials\.json$/i,
    /^backend\/target\//i,
    /^backend\/\.mvn\/repository\//i,
    /^\.m2repo\//i,
    /^backend\/.*\.(mv|lock|trace)\.db$/i,
    /^frontend\/node_modules\//i,
    /^frontend\/dist\//i,
    /(^|\/)(__pycache__|venv|\.venv)(\/|$)/i,
    /\.pyc$/i,
    /^migration_export\//i,
    /^run\//i,
    /^Hermes\//i,
    /\.code-workspace$/i,
    /\.(url|lnk|heic|psd|sketch|fig|drawio|csv|tsv)$/i,
    /export.*\.json$/i,
    /backup.*\.json$/i,
  ];

  for (const pattern of shouldIgnoreRegexes) {
    if (pattern.test(normalized)) {
      return { path: normalized, bucket: "should-ignore", reason: "Local artifact, secret, cache, or machine-specific file should stay in .gitignore." };
    }
  }

  const publishableRegexes = [
    /^README\.md$/i,
    /^docs\/architecture\//i,
    /^\.gitignore$/i,
    /^design\.md$/i,
    /^DESIGN_VERSIONS\.md$/i,
    /^TICKET\.md$/i,
    /^frontend\/(src|public|package\.json|package-lock\.json|vite\.config.*|eslint\.config.*|scripts\/)/i,
    /^backend\/(src|pom\.xml|mvnw(\.cmd)?|\.mvn\/)/i,
    /^tools\/(auto-commit\.ps1|agent-sync\.mjs|verify-frontend-runtime-sync\.mjs|verify-backend-runtime-sync\.mjs|run-backend\.cmd|import-shoe-catalog\.mjs|auto-hermes-docker-gate\.mjs|auto-hermes-security\.(mjs|test\.mjs)|auto-hermes-push-main\.(mjs|test\.mjs)|refresh-architecture-diagrams\.(mjs|test\.mjs))$/i,
  ];

  for (const pattern of publishableRegexes) {
    if (pattern.test(normalized)) {
      return { path: normalized, bucket: "publishable", reason: "Repo code, product doc, or shared helper that may ship." };
    }
  }

  return { path: normalized, bucket: "review", reason: "Unknown path. Review before auto-staging." };
}

function runGit(args, runner = null) {
  if (typeof runner === "function") {
    return String(runner(args) ?? "").trim();
  }
  if (process.platform !== "win32") {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  }
  const command = `& git ${args.map((arg) => shellQuote(arg)).join(" ")}`;
  return execFileSync(
    "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-NoProfile", "-Command", command],
    { cwd: ROOT, encoding: "utf8" },
  ).trim();
}

function currentStatusSnapshot(runner = null) {
  const status = runGit(["status", "--short", "--untracked-files=all"], runner);
  if (!status) return "";
  return status
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .join("\n");
}

function currentChangedPaths(runner = null) {
  const status = runGit(["status", "--short", "--untracked-files=all"], runner);
  if (!status) return [];
  return status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .sort();
}

function normalizeRemoteUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function loadRemoteStatus(args, runner = null) {
  const remoteName = String(args.targetRemoteName || "origin").trim() || "origin";
  const targetUrl = String(args.targetRemoteUrl || "").trim();
  let actualUrl = "";

  try {
    actualUrl = runGit(["config", "--get", `remote.${remoteName}.url`], runner);
  } catch {
    try {
      const remotes = runGit(["remote", "-v"], runner)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const match = remotes
        .map((line) => line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/))
        .find((parts) => parts && parts[1] === remoteName);
      actualUrl = match?.[2] || "";
    } catch {
      actualUrl = "";
    }
  }

  if (!actualUrl) {
    return {
      remoteName,
      targetUrl,
      actualUrl: "",
      matchesTarget: false,
      reason: `Git remote '${remoteName}' is not configured.`,
    };
  }

  const matchesTarget = !targetUrl || normalizeRemoteUrl(actualUrl) === normalizeRemoteUrl(targetUrl);
  return {
    remoteName,
    targetUrl,
    actualUrl,
    matchesTarget,
    reason: matchesTarget
      ? `Git remote '${remoteName}' matches the expected publish target.`
      : `Git remote '${remoteName}' does not match the expected publish target.`,
  };
}

function normalizeBranchPublishStatus(raw = {}) {
  const branch = String(raw.branch || "").trim();
  const remoteName = String(raw.remoteName || "origin").trim() || "origin";
  const remoteRef = String(raw.remoteRef || (branch ? `refs/remotes/${remoteName}/${branch}` : "")).trim();
  const remoteBranchExists = Boolean(raw.remoteBranchExists);
  const aheadCount = parseCount(raw.aheadCount);
  const behindCount = parseCount(raw.behindCount);
  const hasUnpublishedCommits = Boolean(raw.hasUnpublishedCommits ?? (branch && (aheadCount > 0 || !remoteBranchExists)));
  const safeToPushCurrentBranch = Boolean(
    raw.safeToPushCurrentBranch
      ?? (branch && hasUnpublishedCommits && behindCount === 0),
  );

  return {
    branch,
    remoteName,
    remoteRef,
    remoteBranchExists,
    aheadCount,
    behindCount,
    hasUnpublishedCommits,
    safeToPushCurrentBranch,
    reason: String(raw.reason || "").trim(),
  };
}

function loadBranchPublishStatus(args, runner = null) {
  const remoteName = String(args.targetRemoteName || "origin").trim() || "origin";
  let branch = "";
  try {
    branch = runGit(["branch", "--show-current"], runner);
  } catch {
    branch = "";
  }
  branch = String(branch || "").trim();

  if (!branch) {
    return normalizeBranchPublishStatus({
      branch: "",
      remoteName,
      reason: "Current HEAD is detached, so there is no current branch to auto-push.",
    });
  }

  const remoteRef = `refs/remotes/${remoteName}/${branch}`;
  let remoteBranchExists = false;
  try {
    runGit(["rev-parse", "--verify", remoteRef], runner);
    remoteBranchExists = true;
  } catch {
    remoteBranchExists = false;
  }

  if (!remoteBranchExists) {
    return normalizeBranchPublishStatus({
      branch,
      remoteName,
      remoteRef,
      remoteBranchExists: false,
      aheadCount: 1,
      behindCount: 0,
      hasUnpublishedCommits: true,
      safeToPushCurrentBranch: true,
      reason: `Remote branch '${remoteName}/${branch}' does not exist yet, so the current branch still has unpublished local commits.`,
    });
  }

  let aheadCount = 0;
  let behindCount = 0;
  try {
    aheadCount = parseCount(runGit(["rev-list", "--count", `${remoteRef}..HEAD`], runner));
  } catch {
    aheadCount = 0;
  }
  try {
    behindCount = parseCount(runGit(["rev-list", "--count", `HEAD..${remoteRef}`], runner));
  } catch {
    behindCount = 0;
  }

  const hasUnpublishedCommits = aheadCount > 0;
  const safeToPushCurrentBranch = hasUnpublishedCommits && behindCount === 0;
  const reason = !hasUnpublishedCommits
    ? `Current branch '${branch}' has no unpublished local commits relative to ${remoteName}/${branch}.`
    : behindCount > 0
      ? `Current branch '${branch}' is ahead by ${aheadCount} commit(s) but also behind ${remoteName}/${branch} by ${behindCount}, so auto-push is not safe.`
      : `Current branch '${branch}' is ahead of ${remoteName}/${branch} by ${aheadCount} unpublished local commit(s).`;

  return normalizeBranchPublishStatus({
    branch,
    remoteName,
    remoteRef,
    remoteBranchExists,
    aheadCount,
    behindCount,
    hasUnpublishedCommits,
    safeToPushCurrentBranch,
    reason,
  });
}

function loadDockerGateStatus(args, runner = null) {
  const fullPath = resolveFromRoot(args.dockerGateJson);
  if (!fs.existsSync(fullPath)) {
    return {
      path: fullPath,
      present: false,
      passed: false,
      fresh: false,
      reason: "No Docker gate artifact exists yet.",
      artifact: null,
    };
  }

  let artifact = null;
  try {
    artifact = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return {
      path: fullPath,
      present: true,
      passed: false,
      fresh: false,
      reason: "Docker gate artifact exists but is not valid JSON.",
      artifact: null,
    };
  }

  if (args.dockerGateSkipRepoCheck) {
    return {
      path: fullPath,
      present: true,
      passed: Boolean(artifact.passed),
      fresh: Boolean(artifact.passed),
      reason: Boolean(artifact.passed)
        ? "Docker gate artifact accepted without repo freshness checks."
        : "Docker gate artifact recorded a failing result.",
      artifact,
    };
  }

  const currentHead = runGit(["rev-parse", "HEAD"], runner);
  const currentPaths = currentChangedPaths(runner);
  const sameHead = String(artifact.gitHead || "").trim() === currentHead;
  const artifactPaths = Array.isArray(artifact.changedPaths) ? artifact.changedPaths.map(String).sort() : [];
  const sameChangedPaths = artifactPaths.length === currentPaths.length && artifactPaths.every((value, index) => value === currentPaths[index]);
  const fresh = Boolean(artifact.passed) && sameHead && sameChangedPaths;
  const reason = !artifact.passed
    ? "Docker gate artifact recorded a failing result."
    : !sameHead
      ? "Docker gate artifact was generated for a different git HEAD."
      : !sameChangedPaths
        ? "Docker gate artifact does not match the current changed file set."
        : "Docker gate artifact matches the current working tree.";

  return {
    path: fullPath,
    present: true,
    passed: Boolean(artifact.passed),
    fresh,
    reason,
    artifact,
  };
}

function changedPathsFromStatus() {
  const status = runGit(["status", "--short", "--untracked-files=all"]);
  if (!status) return [];
  return dedupe(
    status
      .split(/\r?\n/)
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
  );
}

function changedPathsFromStatusWithRunner(runner = null) {
  return currentChangedPaths(runner);
}

function buildMessage(args) {
  if (args.message.trim()) return args.message.trim();
  const base = [args.task, args.surface, args.summary]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "auto-hermes round";
  return base
    .replace(/\s+/g, " ")
    .replace(/[`"]/g, "")
    .slice(0, 72);
}

function deriveNotifyArtifactPath(finishArtifactPath, token) {
  const parsed = path.parse(String(finishArtifactPath || ""));
  const baseName = parsed.name || "AUTO_HERMES_FINISH";
  const notifyName = /finish/i.test(baseName)
    ? baseName.replace(/finish/i, token)
    : `${baseName}-${token.toLowerCase()}`;
  return path.join(parsed.dir, `${notifyName}${parsed.ext || ".json"}`);
}

function renderMarkdown(result) {
  const lines = [
    "# Auto-Hermes Finish",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Decision: ${result.eligible ? "auto-commit ready" : "not ready"}`,
    `Message: ${result.message}`,
    `Command: ${result.command}`,
    `Reason: ${result.reason}`,
    "",
    "## Files",
  ];

  if (result.files.length) {
    result.files.forEach((file) => {
      const note = result.autoIncludedFiles?.includes(file) ? " *(auto-included from working tree)*" : "";
      lines.push(`- ${file}${note}`);
    });
  } else {
    lines.push("- none");
  }
  if (result.autoIncludedFiles?.length) {
    lines.push("", `Auto-included ${result.autoIncludedFiles.length} publishable file(s) from \`git status\` that were not in the explicit \`--files\` list.`);
  }
  if (result.strictFiles) {
    lines.push("", "Strict mode: only explicit `--files` were considered; working-tree augmentation skipped.");
  }

  if (result.policies?.length) {
    lines.push("", "## Policy");
    result.policies.forEach((policy) => lines.push(`- ${policy.path}: ${policy.bucket} (${policy.reason})`));
  }

  if (result.dockerGate) {
    lines.push(
      "",
      "## Docker Gate",
      `- fresh: ${result.dockerGate.fresh ? "yes" : "no"}`,
      `- passed: ${result.dockerGate.passed ? "yes" : "no"}`,
      `- path: ${result.dockerGate.path}`,
      `- reason: ${result.dockerGate.reason}`,
    );
  }

  if (result.remoteStatus) {
    lines.push(
      "",
      "## Publish Target",
      `- remote: ${result.remoteStatus.remoteName}`,
      `- expected: ${result.remoteStatus.targetUrl || "not specified"}`,
      `- actual: ${result.remoteStatus.actualUrl || "not configured"}`,
      `- matches: ${result.remoteStatus.matchesTarget ? "yes" : "no"}`,
      `- reason: ${result.remoteStatus.reason}`,
    );
  }

  if (result.verify.length) {
    lines.push("", "## Verification");
    result.verify.forEach((item) => lines.push(`- ${item}`));
  }

  if (result.commitResult) {
    lines.push("", "## Commit Result", result.commitResult);
  }

  if (result.notification) {
    lines.push(
      "",
      "## Notification",
      `- status: ${result.notification.status}`,
      `- recipient: ${result.notification.recipient || "not configured"}`,
      `- reason: ${result.notification.reason}`,
    );
    if (result.notification.subject) {
      lines.push(`- subject: ${result.notification.subject}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function runAutoHermesFinish(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : {
    ...parseArgs([]),
    ...rawArgs,
  };
  const gitRunner = typeof args.gitRunner === "function" ? args.gitRunner : null;
  const notifyJson = args.notifyJson || deriveNotifyArtifactPath(args.outputJson, "NOTIFY");
  const notifyMd = args.notifyMd || deriveNotifyArtifactPath(args.outputMd, "NOTIFY");
  const explicitFiles = splitList(args.files);
  const statusFiles = Array.isArray(args.statusFilesOverride)
    ? dedupe(args.statusFilesOverride.map(String))
    : changedPathsFromStatusWithRunner(gitRunner);
  let autoIncludedFiles = [];
  let files;
  if (args.strictFiles && explicitFiles.length) {
    files = dedupe(explicitFiles);
  } else if (explicitFiles.length) {
    autoIncludedFiles = statusFiles.filter((f) => !explicitFiles.includes(f) && classifyPath(f).bucket === "publishable");
    files = dedupe([...explicitFiles, ...autoIncludedFiles]);
  } else {
    files = dedupe(statusFiles);
  }
  const message = buildMessage(args);

  const policies = files.map(classifyPath);
  const blockedPolicies = policies.filter((policy) => policy.bucket !== "publishable");
  const publishablePolicies = policies.filter((policy) => policy.bucket === "publishable");
  const commitNeeded = publishablePolicies.length > 0 && blockedPolicies.length === 0;
  const wantsPush = Boolean(args.push || args.autoPushWhenNeeded);
  const remoteStatus = wantsPush
    ? (args.remoteStatusOverride || loadRemoteStatus(args, gitRunner))
    : null;
  const branchPublishStatus = wantsPush
    ? normalizeBranchPublishStatus(args.branchPublishStatusOverride || loadBranchPublishStatus(args, gitRunner))
    : null;
  const pushOnlyNeeded = wantsPush
    && !commitNeeded
    && blockedPolicies.length === 0
    && Boolean(branchPublishStatus?.safeToPushCurrentBranch);
  const pushNeeded = wantsPush && (commitNeeded || pushOnlyNeeded);
  let dockerGate = null;
  const shouldRunDockerGate =
    pushNeeded &&
    remoteStatus?.matchesTarget &&
    (commitNeeded || pushOnlyNeeded) &&
    blockedPolicies.length === 0 &&
    (!args.dockerGateSkipRepoCheck || !fs.existsSync(resolveFromRoot(args.dockerGateJson)));
  if (args.dockerGateStatusOverride) {
    dockerGate = args.dockerGateStatusOverride;
  } else if (shouldRunDockerGate) {
    runAutoHermesDockerGate({
      write: true,
      json: true,
      command: args.dockerGateCommand || "",
      outputJson: args.dockerGateJson,
      outputMd: args.dockerGateMd,
    });
  }
  if (!dockerGate && pushNeeded && blockedPolicies.length === 0) {
    dockerGate = loadDockerGateStatus(args, gitRunner);
  }

  const commitEligible = commitNeeded
    && blockedPolicies.length === 0
    && (!wantsPush || (Boolean(remoteStatus?.matchesTarget) && Boolean(dockerGate?.fresh)));
  const pushEligible = pushNeeded
    && blockedPolicies.length === 0
    && Boolean(remoteStatus?.matchesTarget)
    && Boolean(dockerGate?.fresh)
    && (commitNeeded || Boolean(branchPublishStatus?.safeToPushCurrentBranch));

  let command = "";
  if (commitNeeded) {
    const commandParts = [
      "powershell",
      "-File",
      "tools/auto-commit.ps1",
      "-Message",
      `"${message}"`,
    ];
    if (files.length) {
      commandParts.push("-Paths", files.map((file) => `"${file}"`).join(","));
    }
    if (pushEligible) {
      commandParts.push("-Push");
    }
    command = commandParts.join(" ");
  } else if (pushOnlyNeeded && branchPublishStatus?.branch) {
    command = `git push ${branchPublishStatus.remoteName} ${branchPublishStatus.branch}`;
  } else {
    command = 'powershell -File tools/auto-commit.ps1 -Message "' + message + '"';
  }

  let reason = "No changed files were detected for the finish helper to stage/commit.";
  if (commitNeeded) {
    reason = "Only clearly publishable files were detected, so the finish helper can hand off to the repo auto-commit guardrail.";
    if (wantsPush && remoteStatus && !remoteStatus.matchesTarget) {
      reason = `Finish helper blocked: publish target mismatch. ${remoteStatus.reason} Expected ${remoteStatus.targetUrl}, found ${remoteStatus.actualUrl || "missing remote"}.`;
    } else if (wantsPush && dockerGate && !dockerGate.fresh) {
      reason = `Finish helper blocked by Docker publish gate: ${dockerGate.reason} Run tools/auto-hermes-docker-gate.mjs before submitting to the main repository.`;
    } else if (pushEligible && args.autoPushWhenNeeded) {
      reason = "Auto-push marked as needed because this finish path reached a true clean stop with publishable product files.";
    }
  } else if (pushOnlyNeeded) {
    reason = "Auto-push marked as needed because this true clean stop left unpublished local commits on the current branch.";
    if (remoteStatus && !remoteStatus.matchesTarget) {
      reason = `Finish helper blocked: publish target mismatch. ${remoteStatus.reason} Expected ${remoteStatus.targetUrl}, found ${remoteStatus.actualUrl || "missing remote"}.`;
    } else if (dockerGate && !dockerGate.fresh) {
      reason = `Finish helper blocked by Docker publish gate: ${dockerGate.reason} Run tools/auto-hermes-docker-gate.mjs before submitting to the main repository.`;
    } else if (branchPublishStatus?.reason) {
      reason = `${reason} ${branchPublishStatus.reason}`;
    }
  } else if (blockedPolicies.length > 0) {
    reason = `Finish helper blocked: ${blockedPolicies.map((policy) => `${policy.path} [${policy.bucket}]`).join("; ")}`;
  } else if (wantsPush && branchPublishStatus?.hasUnpublishedCommits && !branchPublishStatus.safeToPushCurrentBranch) {
    reason = `Finish helper blocked: ${branchPublishStatus.reason}`;
  } else if (files.length > 0) {
    reason = "No clearly publishable files were detected for the finish helper.";
  }

  const result = {
    generatedAt: nowIso(),
    eligible: commitEligible || pushEligible,
    attemptedCommit: Boolean(args.commit),
    attemptedPush: wantsPush,
    commitNeeded,
    pushNeeded,
    commitEligible,
    pushEligible,
    message,
    surface: args.surface,
    task: args.task,
    summary: args.summary,
    files,
    explicitFiles,
    autoIncludedFiles,
    strictFiles: Boolean(args.strictFiles),
    policies,
    remoteStatus,
    branchPublishStatus,
    dockerGate,
    verify: splitList(args.verify),
    reason,
    command,
    commitResult: "",
    commitError: "",
    pushResult: "",
    pushError: "",
    notification: null,
  };

  if (args.commit && commitEligible) {
    const psArgs = ["-File", resolveFromRoot("tools/auto-commit.ps1"), "-Message", message];
    if (files.length) {
      psArgs.push("-Paths", ...files);
    }
    if (wantsPush) {
      psArgs.push("-Push");
    }
    try {
      result.commitResult = execFileSync("powershell", psArgs, { cwd: ROOT, encoding: "utf8" }).trim();
    } catch (error) {
      const stdout = String(error?.stdout || "").trim();
      const stderr = String(error?.stderr || "").trim();
      result.commitError = [stdout, stderr, error?.message].filter(Boolean).join("\n").trim();
      result.reason = `Auto-commit execution failed: ${result.commitError || "unknown error"}`;
    }
  }

  if (pushEligible && !commitEligible) {
    try {
      if (typeof args.pushExecutor === "function") {
        result.pushResult = String(args.pushExecutor({
          remoteName: branchPublishStatus?.remoteName || String(args.targetRemoteName || "origin"),
          branch: branchPublishStatus?.branch || "",
        }) || "").trim();
      } else {
        const remoteName = branchPublishStatus?.remoteName || String(args.targetRemoteName || "origin");
        const branch = branchPublishStatus?.branch || "";
        runGit(["push", remoteName, branch]);
        result.pushResult = `Pushed branch: ${branch}`;
      }
    } catch (error) {
      const stdout = String(error?.stdout || "").trim();
      const stderr = String(error?.stderr || "").trim();
      result.pushError = [stdout, stderr, error?.message].filter(Boolean).join("\n").trim();
      result.reason = `Auto-push execution failed: ${result.pushError || "unknown error"}`;
    }
  }

  try {
    result.notification = runAutoHermesNotify({
      write: args.write,
      json: true,
      shouldNotify: Boolean(args.commit || pushEligible),
      task: args.task,
      surface: args.surface,
      summary: args.summary,
      message,
      reason: result.reason,
      files: files.join("||"),
      verify: result.verify.join("||"),
      finishEligible: result.eligible,
      commitAttempted: result.attemptedCommit,
      commitResult: result.commitResult,
      commitError: result.commitError,
      pushAttempted: Boolean(result.attemptedPush || result.pushResult),
      outputJson: notifyJson,
      outputMd: notifyMd,
      notifyEnv: args.notifyEnv,
      notifyTransport: args.notifyTransport,
    }).result;
  } catch (error) {
    result.notification = {
      generatedAt: nowIso(),
      status: "warning",
      reason: `Completion email failed: ${String(error?.message || error || "unknown notification error").trim()}`,
      recipient: "",
      from: "",
      host: "",
      port: 0,
      transport: "",
      deliveryId: "",
      subject: "",
      warning: String(error?.message || error || "unknown notification error").trim(),
    };
  }

  if (args.write) {
    fs.writeFileSync(resolveFromRoot(args.outputJson), JSON.stringify(result, null, 2), "utf8");
    fs.writeFileSync(resolveFromRoot(args.outputMd), renderMarkdown(result), "utf8");
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
  const { output } = runAutoHermesFinish(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
