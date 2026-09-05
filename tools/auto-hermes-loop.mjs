#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAutoHermesController } from "./auto-hermes-controller.mjs";
import { makeClaim, renderClaimMarkdown } from "./auto-hermes-claim-state.mjs";
import { acquireTaskClaim, releaseTaskClaim } from "./auto-hermes-task-claims.mjs";
import { createAutoHermesRun, loadAutoHermesRun, recordWebsiteAuditAttempt } from "./auto-hermes-run-state.mjs";
import { createAutoHermesSupervisorState, evaluateAutoHermesSupervisorRound } from "./auto-hermes-supervisor.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const YOLO_EXECUTOR_PERMISSION = {
  mode: "yolo",
  codexFlag: "--dangerously-bypass-approvals-and-sandbox",
  omxFlag: "--madmax",
  description: "full-permission worker execution: bypass Codex approvals and sandbox for externally supervised Hermes agent rounds",
};
const RUNTIME_NATIVE_EXECUTION = {
  gemini: {
    runtime: "gemini",
    agentOwner: "Gemini CLI",
    agentLabel: "Gemini parallel agents",
    modelPolicy: "use the current Gemini CLI model/session",
    executorPolicy: "native-runtime-agents-only",
    codexFallbackAllowed: false,
    fallback: "If Gemini parallel agents are unavailable, run sequential/adaptive Gemini lanes; do not invoke Codex.",
  },
  opencode: {
    runtime: "opencode",
    agentOwner: "OpenCode",
    agentLabel: "OpenCode parallel agents",
    modelPolicy: "use the current OpenCode model/session",
    executorPolicy: "native-runtime-agents-only",
    codexFallbackAllowed: false,
    fallback: "If OpenCode parallel agents are unavailable, run sequential/adaptive OpenCode lanes; do not invoke Codex.",
  },
  claude: {
    runtime: "claude",
    agentOwner: "Claude Code",
    agentLabel: "Claude Code specialist team agents",
    modelPolicy: "Claude Code parent session uses Agent tool to dispatch specialist subagents (frontend-agent, backend-agent, code-reviewer, QA Agent, debugger, planning-agent, reviewer-agent, test-writer, security-auditor) for team-based bounded round execution. Parent owns coordination, merge gate, and round-close writeback.",
    executorPolicy: "claude-code-agent-team-only",
    codexFallbackAllowed: false,
    teamDispatch: {
      coordinator: "parent Claude session",
      specialists: ["frontend-agent", "backend-agent", "code-reviewer", "QA Agent", "debugger", "planning-agent", "reviewer-agent", "test-writer", "security-auditor"],
      parallelOk: ["frontend-agent", "backend-agent", "test-writer"],
      sequentialOnly: ["code-reviewer", "QA Agent", "security-auditor", "reviewer-agent"],
      mergeGate: "parent collects specialist results, runs reviewer-agent verdict, writes round-close packet",
    },
    fallback: "If Agent-based specialist dispatch is unavailable, the parent Claude session executes the bounded round directly with the same specialist role cards applied sequentially.",
  },
};

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    dryRun: false,
    mode: "self-loop",
    runtime: "generic",
    maxRounds: "24",
    maxSameWorkUnitRepeats: "3",
    tasks: "TASKS.md",
    humanLoop: ".workspace/state/HUMAN_LOOP.md",
    agentSync: ".workspace/state/AGENT_SYNC.md",
    contextLedger: ".workspace/state/CONTEXT_LEDGER.md",
    loopState: ".workspace/state/LOOP_STATE.md",
    traceToSkillJson: ".workspace/state/AUTO_HERMES_TRACE_TO_SKILL.json",
    claimDir: ".workspace/state/auto-hermes-claims",
    claimOwner: "",
    claimTtlMinutes: "15",
    controllerJson: ".workspace/state/AUTO_HERMES_CONTROLLER.json",
    controllerMd: ".workspace/state/AUTO_HERMES_CONTROLLER.md",
    promotionJson: ".workspace/state/AUTO_HERMES_PROMOTION.json",
    promotionMd: ".workspace/state/AUTO_HERMES_PROMOTION.md",
    outputJson: ".workspace/state/AUTO_HERMES_LOOP.json",
    outputMd: ".workspace/state/AUTO_HERMES_LOOP.md",
    coordinatorJson: ".workspace/state/AUTO_HERMES_COORDINATOR.json",
    coordinatorMd: ".workspace/state/AUTO_HERMES_COORDINATOR.md",
    promptFile: ".workspace/state/AUTO_HERMES_NEXT_PROMPT.md",
    executorConfig: ".workspace/state/AUTO_HERMES_EXECUTOR.json",
    omxBridgeJson: ".workspace/state/OMX_AUTO_HERMES_BRIDGE.json",
    executorCommand: "",
    parentCodexCoordinatorOnly: false,
    loopStateJson: ".workspace/state/AUTO_HERMES_LOOP_STATE.json",
    roundResultJson: ".workspace/state/AUTO_HERMES_ROUND_RESULT.json",
    roundResultMd: ".workspace/state/AUTO_HERMES_ROUND_RESULT.md",
    maxExecutorRetries: "3",
    executorRetryBackoff: "0,30000,120000",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--parent-codex-coordinator-only" || arg === "--parentCodexCoordinatorOnly") args.parentCodexCoordinatorOnly = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[++i] || args[key];
    }
  }

  return {
    ...args,
    maxRounds: Math.max(1, Number.parseInt(args.maxRounds, 10) || 1),
    maxSameWorkUnitRepeats: Math.max(1, Number.parseInt(args.maxSameWorkUnitRepeats, 10) || 1),
    maxExecutorRetries: Math.max(0, Number.parseInt(args.maxExecutorRetries, 10) || 3),
    executorRetryBackoff: String(args.executorRetryBackoff).split(",").map(Number).filter((n) => !Number.isNaN(n)),
  };
}

function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
}

function inferLoopRootDir(args) {
  const tasksPath = resolveFromRoot(args.tasks || "TASKS.md");
  return path.dirname(tasksPath);
}

function readOptional(relPath) {
  const fullPath = resolveFromRoot(relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function defaultClaimOwner(runtime) {
  return `auto-hermes-${runtime || "generic"}-${process.pid}-${Date.now().toString(36)}`;
}

function normalizeRuntime(runtime) {
  return String(runtime || "").trim().toLowerCase();
}

function getRuntimeNativeExecution(runtime) {
  return RUNTIME_NATIVE_EXECUTION[normalizeRuntime(runtime)] || null;
}

function isRuntimeNativeManaged(runtime) {
  return Boolean(getRuntimeNativeExecution(runtime));
}

function runtimeExecutorLabel(runtime) {
  const nativeExecution = getRuntimeNativeExecution(runtime);
  if (nativeExecution) return `${nativeExecution.agentLabel} (native)`;
  return String(runtime || "");
}

function configuredExecutorLabel(runtime, executor) {
  if (executor?.label) return executor.label;
  return getRuntimeNativeExecution(runtime) ? runtimeExecutorLabel(runtime) : "";
}

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function compactKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function makeLoopId() {
  return `ah-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function makeContextSnapshotPath(loopId) {
  return `.workspace/state/context-snapshots/${loopId}.json`;
}

function makeProgressLedgerPath(loopId) {
  return `.workspace/state/auto-hermes-state/${loopId}-progress.json`;
}

function makeRalphStatePath(loopId) {
  return `.workspace/state/auto-hermes-state/${loopId}-state.json`;
}

function absoluteLoopArtifactPath(rootDir, relPath) {
  return path.join(rootDir, relPath.replace(/\//g, path.sep));
}

function buildContextSnapshot(args, controllerResult) {
  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  const classification = controllerResult?.classification || {};
  return {
    generatedAt: nowIso(),
    taskStatement: controllerResult?.title || "Auto-hermes loop round",
    desiredOutcome: controllerResult?.doneWhen || "Complete the selected bounded Hermes round with real verification evidence.",
    knownFacts: {
      source: controllerResult?.source || "unknown",
      surface: controllerResult?.surface || "unknown",
      problemClass: classification.problemClass || controllerResult?.problemClass || "unknown",
      owner: controllerResult?.owner || "unknown",
      loopDecision: controllerResult?.loopDecision || "unknown",
      touchesFrontend: classification.touchesFrontend === true,
      touchesBackend: classification.touchesBackend === true,
      isCrossStack: classification.crossStack === true,
    },
    constraints: {
      mode: args.mode,
      runtime: args.runtime,
      maxRounds: args.maxRounds,
      requiresVerification: true,
      requiresArchitectReview: true,
      requiresDeslopPass: true,
      requiresRegressionReverification: true,
      recordSystemMap: "docs/auto-hermes/index.md",
    },
    unknowns: [],
    likelyTouchpoints: files,
  };
}

function buildProgressLedger(state, args, controllerResult) {
  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  return {
    runId: state.loopId,
    mode: "ralph-style-single-lane",
    generatedAt: nowIso(),
    active: !["stop-exhausted", "stalled-same-work-unit", "executor-unavailable", "single-round-complete", "loop-complete"].includes(state.status),
    currentPhase: state.currentPhase || "grounding",
    iteration: Math.max(1, state.roundsAttempted + (state.status === "running" ? 0 : 1)),
    maxIterations: args.maxRounds,
    workUnit: controllerResult?.title
      ? {
          title: controllerResult.title,
          surface: controllerResult.surface || "unknown",
          source: controllerResult.source || "unknown",
          files,
          verify: controllerResult.verify || "",
        }
      : null,
    gates: {
      verification: state.status === "single-round-complete" ? "pass" : "pending",
      runtimeTruth: state.status === "single-round-complete" ? "pass" : "pending",
      architectReview: "pending",
      deslop: "pending",
      regressionReverification: "pending",
      writeback: state.status === "single-round-complete" ? "pass" : "pending",
    },
    supervisor: {
      decision: state.supervisorState?.decision || "continue",
      stop: Boolean(state.supervisorState?.stop),
      repeatedNoCandidateAuditRounds: state.supervisorState?.repeatedNoCandidateAuditRounds || 0,
    },
  };
}

function writeRalphState(loopId, state) {
  const statePath = state.ralphStatePath || resolveFromRoot(makeRalphStatePath(loopId));
  ensureParent(statePath);
  fs.writeFileSync(statePath, JSON.stringify({
    mode: "auto-hermes",
    active: !["stop-exhausted", "stalled-same-work-unit", "executor-unavailable", "single-round-complete", "loop-complete"].includes(state.status),
    currentPhase: state.currentPhase || "grounding",
    startedAt: state.generatedAt,
    completedAt: ["stop-exhausted", "stalled-same-work-unit", "executor-unavailable", "single-round-complete", "loop-complete"].includes(state.status)
      ? nowIso()
      : "",
    runId: loopId,
    status: state.status,
    contextSnapshotPath: state.contextSnapshotPath,
    progressLedgerPath: state.progressLedgerPath,
  }, null, 2), "utf8");
}

function loadJsonFile(relPath, fallback = null) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}

function loadLoopState(args) {
  const statePath = resolveFromRoot(args.loopStateJson || ".workspace/state/AUTO_HERMES_LOOP_STATE.json");
  const defaultSupervisorState = createAutoHermesSupervisorState({
    mode: "auto-hermes",
    noCandidateAuditLimit: parseInt(args.maxSameWorkUnitRepeats, 10) || 3,
  });
  const fallback = {
    loopId: makeLoopId(),
    currentRound: 0,
    maxRounds: parseInt(args.maxRounds, 10) || 24,
    status: "idle",
    currentPhase: "grounding",
    currentTask: "",
    roundHistory: [],
    stallCounter: 0,
    runawayCounter: 0,
    sameWorkUnitStreak: 0,
    lastWorkUnitSignature: null,
    lastRoundResultSignature: null,
    lastRoundResult: null,
    lastCheckpoint: "",
    resumable: true,
    preRoundCommit: "",
    evolveCycleCount: 0,
    lastEvolveRound: 0,
    auditRunId: "",
    websiteAudit: null,
    supervisorState: defaultSupervisorState,
  };
  const loaded = loadJsonFile(statePath, fallback);
  return {
    ...fallback,
    ...(loaded || {}),
    loopId: String(loaded?.loopId || fallback.loopId).trim() || fallback.loopId,
    currentPhase: String(loaded?.currentPhase || fallback.currentPhase).trim() || fallback.currentPhase,
    supervisorState: loaded?.supervisorState || defaultSupervisorState,
  };
}

function normalizeSameWorkUnitStreak(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeWorkUnitSignature(value) {
  const signature = String(value || "").trim();
  return signature || null;
}

function normalizeRoundResult(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const verdict = String(raw.verdict || "").trim();
  const review = String(raw.review || "").trim();
  const blocker = String(raw.blocker || "").trim();
  const ralphGateSummary = String(raw?.ralphGate?.summary || "").trim();
  const verifyResult = String(raw.verifyResult || "").trim();
  const runtimeProof = String(raw.runtimeProof || "").trim();
  const consoleSummary = String(raw.consoleSummary || "").trim();
  const consoleObservedCount = Number.parseInt(String(raw.consoleObservedCount ?? ""), 10);

  const normalized = {
    task: String(raw.task || "").trim(),
    surface: String(raw.surface || "").trim(),
    verdict,
    review,
    blocker,
    verifyResult,
    runtimeProof,
    consoleSummary,
    consoleObservedCount: Number.isFinite(consoleObservedCount) ? consoleObservedCount : 0,
    ralphGate: {
      pass: Boolean(raw?.ralphGate?.pass),
      summary: ralphGateSummary,
    },
  };

  if (
    !normalized.task
    && !normalized.surface
    && !verdict
    && !review
    && !blocker
    && !verifyResult
    && !runtimeProof
    && !consoleSummary
    && !normalized.ralphGate.summary
  ) {
    return null;
  }

  return normalized;
}

function normalizeRoundResultSignature(value) {
  const signature = String(value || "").trim();
  return signature || null;
}

function makeRoundResultSignature(roundResult) {
  const normalized = normalizeRoundResult(roundResult);
  if (!normalized) return null;

  const signature = compactKey([
    normalized.task,
    normalized.surface,
    normalized.verdict,
    normalized.review,
    normalized.blocker,
    normalized.verifyResult,
    normalized.runtimeProof,
    normalized.consoleSummary,
    String(normalized.consoleObservedCount),
    normalized.ralphGate.pass ? "ralph-pass" : "ralph-fail",
    normalized.ralphGate.summary,
  ].join(" "));

  return signature || null;
}

function loadRoundResult(args) {
  const roundResultPath = resolveFromRoot(args.roundResultJson || ".workspace/state/AUTO_HERMES_ROUND_RESULT.json");
  return normalizeRoundResult(loadJsonFile(roundResultPath, null));
}

function shouldTreatRepeatedWorkUnitAsProgress(args, previousRoundResultSignature, nextRoundResultSignature) {
  if (args.mode !== "self-ralph") return false;
  if (!previousRoundResultSignature || !nextRoundResultSignature) return false;
  return previousRoundResultSignature !== nextRoundResultSignature;
}

function writeLoopState(args, persistedState) {
  const statePath = resolveFromRoot(args.loopStateJson || ".workspace/state/AUTO_HERMES_LOOP_STATE.json");
  persistedState.lastCheckpoint = new Date().toISOString();
  try {
    fs.writeFileSync(statePath, JSON.stringify(persistedState, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

function getCurrentGitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "";
  }
}

function loadExecutorConfig(args) {
  if (args.parentCodexCoordinatorOnly && normalizeRuntime(args.runtime) === "codex") {
    return null;
  }
  if (isRuntimeNativeManaged(args.runtime)) {
    return null; // Native runtimes must use their own model/agent surface instead of Codex fallbacks.
  }
  if (args.executorCommand) {
    return {
      label: "inline-arg",
      command: args.executorCommand,
    };
  }

  if (process.env.AUTO_HERMES_EXECUTOR_COMMAND) {
    return {
      label: "env",
      command: process.env.AUTO_HERMES_EXECUTOR_COMMAND,
    };
  }

  const config = loadJsonFile(args.executorConfig, null);
  if (config && typeof config.command === "string" && config.command.trim()) {
    return {
      label: config.label || "config",
      command: config.command.trim(),
    };
  }

  const omxRalphExecutor = detectOmxRalphExecutor(args);
  if (omxRalphExecutor) {
    return omxRalphExecutor;
  }

  return detectCodexExecutor();
}

function detectOmxRalphExecutor(args) {
  if (isRuntimeNativeManaged(args.runtime)) {
    return null; // Native runtimes must not route worker execution through OMX/Codex.
  }
  const bridge = loadJsonFile(args.omxBridgeJson || ".workspace/state/OMX_AUTO_HERMES_BRIDGE.json", null);
  if (!bridge || bridge.autoReady !== true) return null;

  const loopMapping = String(bridge?.mapping?.loop || "").trim();
  const availableSkills = Array.isArray(bridge?.availableSkills) ? bridge.availableSkills : [];
  const prefersRalph = loopMapping === "$ralph" || availableSkills.includes("ralph");
  if (!prefersRalph) return null;

  const omxCommand = commandExists("omx");
  if (!omxCommand) return null;

  return {
    label: "omx-ralph-yolo",
    permissionMode: YOLO_EXECUTOR_PERMISSION.mode,
    permissionFlag: YOLO_EXECUTOR_PERMISSION.omxFlag,
    permissionDescription: YOLO_EXECUTOR_PERMISSION.description,
    command: `& ${shellQuote(omxCommand)} ralph ${YOLO_EXECUTOR_PERMISSION.omxFlag} --no-deslop "Read the bounded /auto-hermes worker brief at {promptFile}. Treat {controllerJson} as the authoritative routing brief for task {task} on surface {surface}. Execute that single round, verify it, then stop."`,
  };
}

function readCodexHelp(codexCommand) {
  try {
    return execFileSync(
      "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      ["-Command", `& ${shellQuote(codexCommand)} --help`],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {
    return null;
  }
}

function codexSupportsFlag(codexCommand, flag) {
  const help = readCodexHelp(codexCommand);
  if (help == null) return null;
  return help.includes(flag);
}

function findCodexExecutorCandidate() {
  const localCodex = resolveFromRoot("tools/codex-local.exe");
  const globalCodex = commandExists("codex");
  const candidates = [
    globalCodex ? { command: globalCodex, source: "global" } : null,
    fs.existsSync(localCodex) ? { command: localCodex, source: "bundled" } : null,
  ].filter(Boolean);

  return candidates.find((candidate) => codexSupportsFlag(candidate.command, "--dangerously-bypass-hook-trust") === true)
    || candidates.find((candidate) => candidate.source === "global" && codexSupportsFlag(candidate.command, "--dangerously-bypass-hook-trust") == null)
    || candidates.find((candidate) => codexSupportsFlag(candidate.command, YOLO_EXECUTOR_PERMISSION.codexFlag) !== false)
    || null;
}

function detectCodexExecutor() {
  const codexCandidate = findCodexExecutorCandidate();
  if (!codexCandidate) return null;
  const codexCommand = codexCandidate.command;
  const localCodexHome = resolveFromRoot(".tmp/codex-home");
  const userCodexHome = path.join(process.env.USERPROFILE || process.env.HOME || "", ".codex");
  const authSeedFiles = ["auth.json", "config.toml", "cap_sid", "installation_id"];
  const proxyVars = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy"];
  const supportsHookTrustBypass = codexSupportsFlag(codexCommand, "--dangerously-bypass-hook-trust");
  const codexPermissionFlags = [
    YOLO_EXECUTOR_PERMISSION.codexFlag,
    supportsHookTrustBypass === true || (supportsHookTrustBypass == null && codexCandidate.source === "global")
      ? "--dangerously-bypass-hook-trust"
      : "",
  ].filter(Boolean);
  const seedCommands = authSeedFiles
    .map((name) => {
      const source = path.join(userCodexHome, name);
      const target = path.join(localCodexHome, name);
      return `if (Test-Path ${shellQuote(source)}) { Copy-Item -LiteralPath ${shellQuote(source)} -Destination ${shellQuote(target)} -Force }`;
    })
    .join("; ");
  const clearProxyCommands = proxyVars
    .map((name) => `$env:${name}=$null`)
    .join("; ");

  return {
    label: `${codexCandidate.source}-codex-yolo-noninteractive`,
    permissionMode: YOLO_EXECUTOR_PERMISSION.mode,
    permissionFlag: codexPermissionFlags.join(" "),
    permissionDescription: YOLO_EXECUTOR_PERMISSION.description,
    command: `${clearProxyCommands}; $env:CODEX_HOME=${shellQuote(localCodexHome)}; New-Item -ItemType Directory -Force $env:CODEX_HOME | Out-Null; New-Item -ItemType Directory -Force (Join-Path $env:CODEX_HOME '.tmp') | Out-Null; ${seedCommands}; Get-Content -Raw {promptFile} | & ${shellQuote(codexCommand)} ${codexPermissionFlags.join(" ")} exec --ephemeral --color never -C {cwd} -`,
  };
}

function runNodeScript(scriptPath, scriptArgs, options = {}) {
  const command = [
    "& 'C:\\Program Files\\nodejs\\node.exe'",
    shellQuote(scriptPath),
    ...scriptArgs.map((arg) => shellQuote(arg)),
  ].join(" ");
  return execFileSync(
    "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-Command", command],
    {
      cwd: ROOT,
      encoding: options.encoding,
      stdio: options.stdio,
    },
  );
}

function detectRtk() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const nativeWindows = process.platform === "win32";
  const fallbackPaths = [
    home ? path.join(home, ".local", "bin", "rtk.exe") : "",
    home ? path.join(home, ".cargo", "bin", "rtk.exe") : "",
  ].filter(Boolean);
  try {
    const output = execFileSync(
      "C:\\WINDOWS\\System32\\where.exe",
      ["rtk"],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const resolved = String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0] || "";
    return {
      available: Boolean(resolved),
      command: "rtk",
      resolvedPath: resolved,
      mode: resolved ? (nativeWindows ? "manual-only" : "auto-enabled") : "unavailable",
      nativeWindows,
    };
  } catch {
    const fallback = fallbackPaths.find((candidate) => fs.existsSync(candidate)) || "";
    return {
      available: Boolean(fallback),
      command: fallback || "rtk",
      resolvedPath: fallback,
      mode: fallback ? (nativeWindows ? "manual-only" : "auto-enabled") : "unavailable",
      nativeWindows,
    };
  }
}

function resolveCommandFromPath(commandName) {
  const raw = String(commandName || "").trim();
  if (!raw) return "";

  if (raw.includes("\\") || raw.includes("/")) {
    return fs.existsSync(raw) ? raw : "";
  }

  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const pathExts = String(process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD;.PS1")
    .split(";")
    .map((ext) => ext.trim())
    .filter(Boolean);
  const hasExtension = /\.[^./\\]+$/.test(raw);
  const candidates = hasExtension
    ? [raw]
    : [raw, ...pathExts.map((ext) => `${raw}${ext}`)];

  for (const dir of pathEntries) {
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return "";
}

function commandExists(commandName) {
  const fromPath = resolveCommandFromPath(commandName);
  if (fromPath) return fromPath;

  try {
    const output = execFileSync(
      "C:\\WINDOWS\\System32\\where.exe",
      [commandName],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0] || "";
  } catch {
    try {
      const output = execFileSync(
        "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        ["-Command", `(Get-Command ${commandName} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)`],
        {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      return String(output || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)[0] || "";
    } catch {
      return "";
    }
  }
}

function detectEverythingClaudeCode() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const claudeSettings = home ? path.join(home, ".claude", "settings.json") : "";
  const candidatePaths = [
    home ? path.join(home, ".claude", "plugins", "everything-claude-code") : "",
    home ? path.join(home, ".claude", "skills", "everything-claude-code") : "",
    home ? path.join(home, ".codex", "plugins", "everything-claude-code") : "",
    home ? path.join(home, ".codex", "skills", "everything-claude-code") : "",
  ].filter(Boolean);

  const hits = [];
  const eccCli = commandExists("ecc");
  const agentShieldCli = commandExists("ecc-agentshield");
  if (eccCli) hits.push(`cli:ecc=${eccCli}`);
  if (agentShieldCli) hits.push(`cli:ecc-agentshield=${agentShieldCli}`);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) hits.push(`path:${candidate}`);
  }

  if (claudeSettings && fs.existsSync(claudeSettings)) {
    try {
      const raw = fs.readFileSync(claudeSettings, "utf8");
      if (/everything-claude-code|ecc-agentshield|\/code-review|\/tdd|\/plan/i.test(raw)) {
        hits.push(`settings:${claudeSettings}`);
      }
    } catch {
      // ignore settings read failures and fall back to compatibility mode
    }
  }

  return {
    detected: hits.length > 0,
    mode: hits.length > 0 ? "native-detected" : "compatibility-fallback",
    source: hits.length > 0
      ? "detected local everything-claude-code install markers"
      : "no native everything-claude-code install markers detected; using repo-side compatibility layer",
    evidence: hits,
  };
}

function runController(args) {
  return runAutoHermesController({
    write: true,
    json: true,
    tasks: args.tasks,
    humanLoop: args.humanLoop,
    agentSync: args.agentSync,
    contextLedger: args.contextLedger,
    loopState: args.loopState,
    traceToSkillJson: args.traceToSkillJson,
    claimDir: args.claimDir,
    claimOwner: args.claimOwner,
    claimTtlMinutes: args.claimTtlMinutes,
    outputJson: args.controllerJson,
    outputMd: args.controllerMd,
    runtime: args.runtime,
  }).result;
}
function workSignature(controllerResult) {
  if (!controllerResult?.title) return "none";
  return compactKey(`${controllerResult.source} ${controllerResult.surface} ${controllerResult.title}`);
}

function roleCardsFor(controllerResult) {
  const cards = {
    "planning-agent": [
      "You are a senior product planning engineer for Hermes.",
      "You are highly skilled at decomposing broad product work into bounded, execution-ready rounds with explicit ownership, file scope, and focused verification.",
      "Bias toward the smallest high-value unit that improves runner usefulness, trust, or clarity right now.",
    ],
    "reviewer-agent": [
      "You are a senior software reviewer for Hermes.",
      "You are highly skilled at finding concrete regressions, trust gaps, brittle logic, weak UX states, and missing verification before they reach runners.",
      "Prioritize actionable findings and the single strongest next must-fix over summaries or praise.",
    ],
    "debugger-agent": [
      "You are a senior debugging engineer for Hermes.",
      "You are highly skilled at reproduction, root-cause isolation, contract tracing, and regression-proof fixes across React, Spring Boot, and shared runtime state.",
      "Stay tight on scope: prove the failure, fix the root cause, and name any exact downstream impact instead of widening the round.",
    ],
    "frontend-agent": [
      "You are a senior frontend developer for Hermes.",
      "You are highly skilled in React, JavaScript, JSX, CSS, responsive UI systems, state presentation, interaction design, translation-safe UI copy, and premium product polish grounded in design.md.",
      "Preserve real Hermes behavior while making the surface clearer, more trustworthy, and more editorial rather than drifting into generic SaaS chrome.",
    ],
    "backend-agent": [
      "You are a senior backend developer for Hermes.",
      "You are highly skilled in Spring Boot, Java, REST API design, controller/service/repository contracts, persistence flows, validation, scheduler-safe logic, and backend/runtime verification.",
      "Preserve stable frontend contracts unless the round explicitly changes them, and if a contract must change, describe the exact UI impact precisely.",
    ],
  };

  const names = Array.isArray(controllerResult?.route?.recommendedAgents)
    ? controllerResult.route.recommendedAgents.filter(Boolean)
    : [];

  if (!names.length) {
    return [
      "You are a senior Hermes product engineer.",
      "You are highly skilled at bounded end-to-end delivery across product reasoning, implementation, verification, and safe loop writeback.",
    ];
  }

  const ordered = [];
  for (const name of names) {
    const lines = cards[name];
    if (!lines) continue;
    ordered.push(`Role: ${name}`);
    ordered.push(...lines.map((line) => `- ${line}`));
  }
  return ordered;
}

function renderEvolvedTraceSkillLines(traceToSkill) {
  const evolvedSkill = traceToSkill?.evolvedSkill;
  if (!evolvedSkill || evolvedSkill.mode !== "repo-local-auto") {
    return [
      "Evolved Trace Skill:",
      "- none",
    ];
  }

  return [
    "Evolved Trace Skill:",
    `- slug: ${evolvedSkill.slug || "auto-hermes-evolved"}`,
    `- mode: ${evolvedSkill.mode}`,
    `- path: ${evolvedSkill.path || ".codex/skills/auto-hermes-evolved/SKILL.md"}`,
    `- summary: ${evolvedSkill.summary || "none"}`,
    "- advisory only: treat this as reusable repo-side guidance, not as a replacement for AGENTS.md or runtime proof gates.",
    ...(Array.isArray(evolvedSkill.coreRules) && evolvedSkill.coreRules.length
      ? evolvedSkill.coreRules.slice(0, 3).map((rule) => `- core rule: ${rule.rule} [${rule.evidenceCount || 0}]`)
      : ["- core rule: none"]),
    ...(Array.isArray(evolvedSkill.failureModes) && evolvedSkill.failureModes.length
      ? evolvedSkill.failureModes.slice(0, 2).map((entry) => `- failure mode: ${entry}`)
      : []),
  ];
}

function deriveEccProfile(controllerResult) {
  const nativeEcc = detectEverythingClaudeCode();
  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  const text = [
    controllerResult?.title || "",
    controllerResult?.surface || "",
    controllerResult?.context || "",
    controllerResult?.verify || "",
    controllerResult?.doneWhen || "",
    files.join(" "),
  ].join(" ").toLowerCase();

  const recommendedAgents = Array.isArray(controllerResult?.route?.recommendedAgents)
    ? controllerResult.route.recommendedAgents
    : [];

  const hasBackendFile = files.some((file) => /backend\/src\/main\/java|backend\\src\\main\\java/i.test(file));
  const hasFrontendFile = files.some((file) => /frontend\/src|frontend\\src/i.test(file));
  const needsPlanning = recommendedAgents.includes("planning-agent")
    || /\b(broad|ambiguous|decompose|plan|split|refactor)\b/.test(text);
  const needsTdd = recommendedAgents.includes("debugger-agent")
    || recommendedAgents.includes("backend-agent")
    || /\b(bug|regression|root cause|controller|service|repository|validation|parser|scheduler|compile|test)\b/.test(text)
    || hasBackendFile;
  const needsSecurity = /\b(auth|oauth|token|session|stripe|billing|admin|upload|file upload|sanitize|url|secret|permission|role)\b/.test(text);
  const needsFrontendReview = recommendedAgents.includes("frontend-agent")
    || /\b(layout|hierarchy|design|translation|copy|responsive|theme|light mode|dark mode|mimic|visual)\b/.test(text)
    || hasFrontendFile;

  const packs = [
    {
      key: "plan",
      enabled: needsPlanning,
      summary: "ECC-style planning: restate goal, preserve list, owned files, verify path, and bounded execution order before coding.",
    },
    {
      key: "tdd",
      enabled: needsTdd,
      summary: "ECC-style TDD/debug loop: prefer reproduce -> smallest failing proof -> root-cause fix -> rerun focused verification.",
    },
    {
      key: "code-review",
      enabled: true,
      summary: needsFrontendReview
        ? "ECC-style code review: require findings-first review plus design-quality checks for hierarchy, spacing, theme correctness, and regressions."
        : "ECC-style code review: require findings-first review plus concrete regression and contract checks before approval.",
    },
    {
      key: "security-review",
      enabled: needsSecurity,
      summary: "ECC-style security pass: inspect auth, input validation, output encoding, file/url handling, and secret safety before approval.",
    },
    {
      key: "verify",
      enabled: true,
      summary: "ECC-style verify pack: capture the exact verify command/result and keep runtime-proof gates separate from source-only success.",
    },
  ];

  return {
    mode: nativeEcc.mode,
    source: nativeEcc.detected
      ? `${nativeEcc.source}; /auto-hermes may borrow native ECC commands/hooks when the active runtime actually supports them`
      : "repo-side compatibility layer inspired by affaan-m/everything-claude-code",
    evidence: nativeEcc.evidence,
    enabled: packs.filter((pack) => pack.enabled).map((pack) => pack.key),
    packs,
  };
}

function deriveLoopClaimStates({
  state,
  controllerResult,
  executor,
  args,
  eccProfile,
  rtk,
  nextAction,
}) {
  const preparedWorkUnit = Boolean(controllerResult?.title) && controllerResult?.loopDecision === "continue-self-loop";
  const subagentPlan = controllerResult?.subagentPlan || {};
  const runtimeNativeExecution = getRuntimeNativeExecution(args.runtime);
  const codexSubagentPrepared = !runtimeNativeExecution && Boolean(subagentPlan.useCodexSubagents);

  return {
    loopOwner: makeClaim("loop owner", {
      verified: state.status === "loop-complete" || state.status === "single-round-complete",
      executing: state.status === "running",
      configured: Boolean(executor),
    }, {
      detail: executor?.label || "tools/auto-hermes-loop.mjs",
      rationale: executor
        ? "the loop helper can own round re-entry directly instead of relying on prompt-only continuation"
        : "no executor is configured, so the loop helper can only prepare the next round",
      evidence: [
        `status=${state.status}`,
        `executorLabel=${executor?.label || "none"}`,
      ],
    }),
    workerRound: makeClaim("worker round execution", {
      verified: state.status === "loop-complete" || state.status === "single-round-complete",
      executing: state.status === "running",
      prepared: preparedWorkUnit,
    }, {
      detail: controllerResult?.title || "none",
      rationale: preparedWorkUnit
        ? "the loop emitted a worker prompt for the next bounded round"
        : "no next worker round is currently armed",
      evidence: [
        `status=${state.status}`,
        `loopDecision=${controllerResult?.loopDecision || "unknown"}`,
      ],
    }),
    codexCoordinator: makeClaim("codex live coordinator", {
      requested: args.runtime === "codex-live" && nextAction === "codex-coordinator-execute-round",
    }, {
      detail: nextAction,
      rationale: nextAction === "codex-coordinator-execute-round"
        ? "the brief is requesting live coordinator execution, not claiming it already started"
        : "no live coordinator execution is currently requested",
      evidence: [
        `runtime=${args.runtime}`,
        `nextAction=${nextAction}`,
      ],
    }),
    unattendedExecutor: makeClaim("unattended executor", {
      configured: Boolean(executor),
    }, {
      detail: executor?.label || "none",
      rationale: executor
        ? "an executor command is configured, but configuration alone is not execution proof"
        : "no unattended executor command is configured",
      evidence: [
        `executorLabel=${executor?.label || "none"}`,
        `permissionMode=${executor?.permissionMode || "default"}`,
        `permissionFlag=${executor?.permissionFlag || "none"}`,
      ],
    }),
    rtk: makeClaim("rtk shell compactor", {
      configured: Boolean(rtk?.available),
    }, {
      detail: rtk?.available ? (rtk.resolvedPath || rtk.command || "rtk") : "not detected",
      rationale: rtk?.available
        ? (rtk?.mode === "manual-only"
          ? "rtk is available for manual output compaction, but native Windows does not provide automatic hook rewrite here"
          : "rtk is available for output compaction, but availability is not proof of command success")
        : "rtk is unavailable in this runtime",
      evidence: [
        `available=${rtk?.available ? "true" : "false"}`,
        `mode=${rtk?.mode || "unavailable"}`,
      ],
    }),
    eccNative: makeClaim("ecc native install markers", {
      configured: eccProfile?.mode === "native-detected",
    }, {
      detail: eccProfile?.mode || "unknown",
      rationale: eccProfile?.mode === "native-detected"
        ? "native markers were detected locally, but that only proves configuration and not live native execution"
        : "auto-hermes is using the repo compatibility layer instead of native ECC behavior",
      evidence: Array.isArray(eccProfile?.evidence) ? eccProfile.evidence : [],
    }),
    codexSubagents: makeClaim("codex subagent dispatch", {
      prepared: codexSubagentPrepared,
    }, {
      detail: codexSubagentPrepared
        ? `planned agents: ${Array.isArray(subagentPlan.spawnOrder) && subagentPlan.spawnOrder.length ? subagentPlan.spawnOrder.join(", ") : "none"}`
        : runtimeNativeExecution
          ? `${runtimeNativeExecution.agentOwner} owns native lane execution for this runtime`
          : "no subagent dispatch is armed",
      rationale: codexSubagentPrepared
        ? "the loop prepared a dispatch plan, but that is not proof that any lane is executing"
        : runtimeNativeExecution
          ? "native-runtime modes must not route parallel lanes through Codex subagents"
          : "the round remains local or sequential",
      evidence: [
        `useCodexSubagents=${codexSubagentPrepared ? "true" : "false"}`,
        ...(runtimeNativeExecution ? [`nativeRuntime=${runtimeNativeExecution.runtime}`] : []),
      ],
    }),
    runtimeNativeAgents: makeClaim("runtime-native agent dispatch", {
      configured: Boolean(runtimeNativeExecution),
      prepared: Boolean(runtimeNativeExecution && subagentPlan.useCodexSubagents),
    }, {
      detail: runtimeNativeExecution
        ? `${runtimeNativeExecution.agentLabel}; ${runtimeNativeExecution.modelPolicy}`
        : "not a runtime-native agent mode",
      rationale: runtimeNativeExecution
        ? "parallel/specialist lanes stay inside the current runtime's own model and agent surface instead of calling Codex"
        : "native agent dispatch is not configured for this runtime",
      evidence: [
        `runtime=${args.runtime}`,
        `codexFallbackAllowed=${runtimeNativeExecution?.codexFallbackAllowed === false ? "false" : "n/a"}`,
      ],
    }),
  };
}

function deriveMemoryPlan(controllerResult) {
  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  const recommendedAgents = Array.isArray(controllerResult?.route?.recommendedAgents)
    ? controllerResult.route.recommendedAgents
    : [];
  const text = [
    controllerResult?.title || "",
    controllerResult?.surface || "",
    controllerResult?.context || "",
    controllerResult?.verify || "",
    controllerResult?.doneWhen || "",
    controllerResult?.source || "",
    files.join(" "),
  ].join(" ").toLowerCase();

  const needsHistoricalRecall = /\b(previous|prior|before|last time|history|historical|resume|continue|handoff|already fixed|did we|why is this|decision|root cause|regression|broke last time|incident)\b/.test(text);
  const touchesRiskyStableDomain = /\b(auth|oauth|billing|stripe|import|strava|garmin|admin|scheduler|validation|contract|schema)\b/.test(text);
  const debuggingRound = recommendedAgents.includes("debugger-agent") || /\b(debug|bug|regression|root cause|repro|failure|unexpected)\b/.test(text);
  const reviewRound = recommendedAgents.includes("reviewer-agent") || /\breview\b/.test(text);
  const frontendRound = recommendedAgents.includes("frontend-agent") || files.some((file) => /frontend\/src|frontend\\src/i.test(file));
  const backendRound = recommendedAgents.includes("backend-agent") || files.some((file) => /backend\/src|backend\\src/i.test(file));

  let mode = "skip";
  if (needsHistoricalRecall || touchesRiskyStableDomain || debuggingRound || reviewRound) {
    mode = "required";
  } else if (frontendRound || backendRound || /\b(context|surface|translation|contract)\b/.test(text)) {
    mode = "recommended";
  }

  let owner = "general";
  if (debuggingRound) owner = "debugger";
  else if (reviewRound) owner = "reviewer";
  else if (frontendRound && !backendRound) owner = "frontend";
  else if (backendRound && !frontendRound) owner = "backend";

  const query = compactKey(controllerResult?.surface || controllerResult?.title || controllerResult?.context || "hermes");
  const roomHint = compactKey(controllerResult?.surface || "");
  const steps = [
    "1. call `mempalace_status` to confirm the palace is live in this session",
    owner !== "general"
      ? `2. read recent specialist diary for \`${owner}\` when the task depends on prior incidents or decisions`
      : "2. skip diary read unless the round clearly depends on prior incidents or decisions",
    `3. run a narrow \`mempalace_search\` for \`${query}\`${roomHint ? ` and prefer room/surface hints like \`${roomHint}\`` : ""}`,
    "4. only if durable facts change or a confirmed root cause is discovered, write back after verification",
  ];

  return {
    mode,
    owner,
    query,
    roomHint,
    reason: mode === "required"
      ? "this round depends on prior decisions, bug history, or a stable domain where historical recall materially reduces risk"
      : mode === "recommended"
        ? "this round touches a meaningful surface/domain and should cheaply check for prior context before broad repo exploration"
        : "this round looks self-contained enough that MemPalace is optional if local repo context already answers the question",
    steps,
  };
}

function deriveKnowledgePack(controllerResult) {
  const knowledgePack = controllerResult?.knowledgePack;
  if (knowledgePack) return knowledgePack;

  return {
    strategy: "progressive-disclosure",
    recordSystemMap: null,
    readOrder: [
      {
        label: "Policy plane",
        relPath: "AGENTS.md",
        path: resolveFromRoot("AGENTS.md"),
        reason: "Fallback read order because the controller did not emit a richer knowledge pack.",
      },
    ],
    rules: [
      "Start from the controller brief and the smallest owning files before broad workflow scans.",
    ],
    docGardening: {
      mode: "conditional",
      smallestOwningDocs: [],
      triggers: [
        "If durable workflow behavior changes, update the smallest owning doc or helper instead of leaving chat-only context.",
      ],
    },
  };
}

function deriveTechDebtReview(controllerResult) {
  const review = controllerResult?.techDebtReview;
  if (review) return review;

  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  return {
    requiredEveryRound: true,
    scope: "changed-files-plus-2-related",
    primaryFiles: files,
    relatedFiles: [],
    maxItems: 1,
    taskFormat: ["Files:", "Context:", "Done when:", "Verify:"],
    rules: [
      "Inspect only the just-changed files plus at most 2 directly related files.",
      "Produce at most 1 implementation-ready debt item or none.",
      "Do not write vague cleanup, speculative architecture, or weaker duplicates.",
    ],
    concreteModeRule: "In concrete mode, still run the debt review but do not treat it as permission to extend into autonomous self-loop continuation unless the round owns queue writeback.",
    prompt: "Check whether this round exposed exactly one bounded reusable engineering cleanup. If not, emit none.",
  };
}

function renderCompactArtifactRefs(ralphArtifacts, controllerResult = {}) {
  return [
    "Artifacts:",
    `- Controller JSON: ${ralphArtifacts.controllerJson || resolveFromRoot(".workspace/state/AUTO_HERMES_CONTROLLER.json")}`,
    `- Context snapshot: ${ralphArtifacts.contextSnapshotPath || "not yet written"}`,
    `- Progress ledger: ${ralphArtifacts.progressLedgerPath || "not yet written"}`,
    `- Round result JSON: ${ralphArtifacts.roundResultJson || resolveFromRoot(".workspace/state/AUTO_HERMES_ROUND_RESULT.json")}`,
    `- Round result Markdown: ${ralphArtifacts.roundResultMd || resolveFromRoot(".workspace/state/AUTO_HERMES_ROUND_RESULT.md")}`,
    `- Full routing detail: ${controllerResult?.claimKey ? "controller JSON owns the complete route, knowledge pack, subagent plan, and catalog." : "controller JSON"}`,
  ];
}

function renderCompactRalphGate(frontendGuard) {
  return [
    "Required gates before pass:",
    "- verify-result pass with fresh command evidence",
    `- --console-clean pass when frontend guard is enabled (${frontendGuard.enabled ? frontendGuard.routes.join(", ") : "not-needed"})`,
    "- architect-verdict approved",
    "- deslop-pass pass or explicit skip",
    "- regression-pass pass",
  ];
}

function renderCompactPreviousRound(ralphArtifacts) {
  if (!ralphArtifacts.lastRoundResult) return [];
  return [
    "",
    "Previous round:",
    `- ${ralphArtifacts.lastRoundResult.verdict || "none"} | ${ralphArtifacts.lastRoundResult.task || "none"} | ${ralphArtifacts.lastRoundResult.ralphGate?.summary || "no gate summary"}`,
    `- signature: ${ralphArtifacts.lastRoundResultSignature || "none"}`,
  ];
}

function renderCompactRuntimeSection(rtk, eccProfile, memoryPlan) {
  return [
    "Runtime helpers:",
    `- RTK: ${rtk?.mode || "unavailable"}${rtk?.available ? ` (${rtk.command})` : ""}; compacts output only, not success proof.`,
    `- ECC: ${eccProfile.mode}; packs=${eccProfile.enabled.length ? eccProfile.enabled.join(", ") : "none"}.`,
    `- MemPalace: ${memoryPlan.mode}; owner=${memoryPlan.owner}; query=${memoryPlan.query || "none"}. Use only if tools are available.`,
  ];
}

function renderCompactKnowledgePack(knowledgePack) {
  const readOrder = Array.isArray(knowledgePack.readOrder) ? knowledgePack.readOrder : [];
  return [
    "Knowledge pack:",
    `- strategy: ${knowledgePack.strategy || "progressive-disclosure"}`,
    `- read order: ${readOrder.length ? readOrder.map((entry) => entry.relPath).join(" -> ") : "AGENTS.md"}`,
    `- doc-gardening: ${knowledgePack.docGardening?.mode || "conditional"}`,
  ];
}

function renderCompactTechDebt(techDebtReview) {
  return [
    "Tech-debt reviewer:",
    `- scope: ${techDebtReview.scope || "changed-files-plus-2-related"}; max items: ${techDebtReview.maxItems ?? 1}`,
    `- primary: ${techDebtReview.primaryFiles?.length ? techDebtReview.primaryFiles.join(" | ") : "selected files"}`,
    `- related: ${techDebtReview.relatedFiles?.length ? techDebtReview.relatedFiles.join(" | ") : "none"}`,
  ];
}

function renderCompactSubagents(subagentPlan, externalCatalog, roleLines, runtimeNativeExecution = null, executorPermission = null) {
  const roles = roleLines
    .filter((line) => !line.startsWith("- "))
    .map((line) => line.replace(/^Role:\s*/, ""))
    .filter(Boolean);
  const optional = Array.isArray(subagentPlan.optionalSupportAgents)
    ? subagentPlan.optionalSupportAgents
    : [];
  const agentLabel = runtimeNativeExecution?.agentLabel || "Codex subagents";
  const useAgentLabel = runtimeNativeExecution
    ? `use ${agentLabel}: ${subagentPlan.useCodexSubagents ? "yes, mapped from controller subagent plan" : "no"}`
    : `use Codex subagents: ${subagentPlan.useCodexSubagents ? "yes" : "no"}`;
  const claudeTeamLines = runtimeNativeExecution?.runtime === "claude" && runtimeNativeExecution.teamDispatch
    ? [
        `- team coordinator: ${runtimeNativeExecution.teamDispatch.coordinator}`,
        `- team specialists: ${(runtimeNativeExecution.teamDispatch.specialists || []).join(", ")}`,
        `- parallel-ok: ${(runtimeNativeExecution.teamDispatch.parallelOk || []).join(", ")}`,
        `- sequential-only: ${(runtimeNativeExecution.teamDispatch.sequentialOnly || []).join(", ")}`,
        `- merge gate: ${runtimeNativeExecution.teamDispatch.mergeGate}`,
      ]
    : [];
  return [
    "Subagent dispatch:",
    `- ${useAgentLabel}`,
    ...(executorPermission?.mode
      ? [
          `- executor permission: ${executorPermission.mode}${executorPermission.flag ? ` (${executorPermission.flag})` : ""}`,
          "- planned child-agent lanes inherit the active executor permission context; do not downgrade to sandboxed execution unless the command/config explicitly overrides it",
        ]
      : []),
    ...(runtimeNativeExecution
      ? [
          `- native runtime owner: ${runtimeNativeExecution.agentOwner}; model policy: ${runtimeNativeExecution.modelPolicy}`,
          `- Codex fallback allowed: ${runtimeNativeExecution.codexFallbackAllowed ? "yes" : "no"}`,
          ...claudeTeamLines,
        ]
      : []),
    `- spawn order: ${subagentPlan.spawnOrder.length ? subagentPlan.spawnOrder.join(" -> ") : "none"}`,
    `- lanes: ${subagentPlan.lanes.length ? subagentPlan.lanes.map((lane) => `${lane.agent}:${lane.ownership}`).join(" | ") : "none"}`,
    `- role cards: ${roles.length ? roles.join(", ") : "senior Hermes product engineer"}`,
    `- optional support: ${optional.length ? optional.join(", ") : "none"}; catalog installed=${externalCatalog.installedCount}`,
    "- Full role text and catalog details stay in controller JSON.",
  ];
}

function renderCompactFrontendGuard(frontendGuard) {
  return [
    "Frontend console guard:",
    `- enabled: ${frontendGuard.enabled ? "yes" : "no"}; routes: ${frontendGuard.routes.length ? frontendGuard.routes.join(" | ") : "none"}`,
    `- smoke tests: ${frontendGuard.smokeTests.length ? frontendGuard.smokeTests.join(" | ") : "none"}`,
    ...(frontendGuard.enabled
      ? [
          `- pre-round snapshot: ${frontendGuard.preRoundCommand}`,
          `- post-round compare: ${frontendGuard.postRoundCommand}`,
          ...frontendGuard.smokeCommands.map((command) => `- smoke command: ${command}`),
          "- Gate rule: fail only on newly observed console errors for tracked routes.",
        ]
      : ["- Gate rule: console-clean is not required when no common frontend route is inferred."]),
  ];
}

function renderCompactWorkerRules() {
  return [
    "Rules:",
    "- Execute exactly one bounded worker round, then stop.",
    "- Read AGENTS.md, the controller JSON, and the compact read order before widening.",
    "- HUMAN_LOOP only gates pause/stop/must-ask; task selection comes from controller JSON.",
    "- Implement only the selected work unit and verify before any live/runtime claim.",
    "- Run auto-hermes-round-close with real gate evidence before stopping.",
  ];
}

function renderWorkerPrompt(controllerResult, roundIndex, rtk, ralphArtifacts = {}) {
  const files = Array.isArray(controllerResult?.files) && controllerResult.files.length
    ? controllerResult.files.join(" | ")
    : "not specified";
  const roleLines = roleCardsFor(controllerResult);
  const eccProfile = deriveEccProfile(controllerResult);
  const memoryPlan = deriveMemoryPlan(controllerResult);
  const knowledgePack = deriveKnowledgePack(controllerResult);
  const techDebtReview = deriveTechDebtReview(controllerResult);
  const subagentPlan = controllerResult?.subagentPlan || {
    useCodexSubagents: false,
    coordinatorMode: "local-coordinator-only",
    spawnOrder: [],
    parallelGroups: [],
    lanes: [],
    optionalSupportAgents: [],
    notes: [],
  };
  const externalCatalog = controllerResult?.externalCatalog || {
    mode: "repo-local-codex-only",
    available: false,
    installedCount: 0,
    installedNames: [],
    recommended: [],
    notes: [],
  };
  const designContext = controllerResult?.designContext || null;
  const frontendGuard = controllerResult?.frontendGuard || {
    enabled: false,
    routes: [],
    smokeTests: [],
    smokeCommands: [],
    preRoundCommand: "",
    postRoundCommand: "",
    summary: "No frontend console guard is required for this round.",
  };
  const runtimeNativeExecution = ralphArtifacts.runtimeNativeExecution || null;
  const executorPermission = ralphArtifacts.executorPermission || null;
  const evolvedTraceSkillLines = renderEvolvedTraceSkillLines(controllerResult?.traceToSkill);
  return [
    "# Auto-Hermes Worker Round",
    "",
    `Round: ${roundIndex}`,
    `Generated: ${nowIso()}`,
    "",
    "Execute one bounded Hermes worker round. Use artifact refs for detail; do not re-expand the full workflow corpus unless the selected task needs it.",
    "",
    ...renderCompactArtifactRefs(ralphArtifacts, controllerResult),
    ...renderCompactPreviousRound(ralphArtifacts),
    "",
    ...renderCompactRalphGate(frontendGuard),
    "",
    ...renderCompactRuntimeSection(rtk, eccProfile, memoryPlan),
    "",
    ...renderCompactKnowledgePack(knowledgePack),
    "",
    ...renderCompactTechDebt(techDebtReview),
    "",
    ...renderCompactSubagents(subagentPlan, externalCatalog, roleLines, runtimeNativeExecution, executorPermission),
    "",
    ...renderCompactFrontendGuard(frontendGuard),
    "",
    ...evolvedTraceSkillLines,
    ...(controllerResult?.websiteAudit?.attempted
      ? [
          "",
          "Website audit context:",
          `- Status: ${controllerResult.websiteAudit.status || "unknown"}`,
          `- Website audit summary: ${controllerResult.websiteAudit.summary || "none"}`,
          `- Used fallback: ${controllerResult.websiteAudit.usedFallback ? "yes" : "no"}`,
          `- Candidate: ${controllerResult.websiteAudit.candidate?.surface || "none"}`,
          ...(controllerResult.websiteAudit.usedFallback
            ? [
                "- This work unit came from the website-audit fallback because the controller reported no promotable work.",
                "- Treat this audit-generated fallback work exactly like a normal first parent goal once selected.",
              ]
            : []),
        ]
      : []),
    ...(controllerResult?.mission
      ? [
          "",
          "Mission:",
          `- ID: ${controllerResult.mission.id}`,
          `- Label: ${controllerResult.mission.label}`,
          `- Stop gate: ${controllerResult.mission.stopGate}`,
          `- Non-stop condition: ${controllerResult.mission.nonStopCondition}`,
          ...controllerResult.mission.stopProof.map((item) => `- Proof: ${item}`),
        ]
      : []),
    "",
    ...renderCompactWorkerRules(),
    "",
    "Selected work unit:",
    `- Source: ${controllerResult?.source || "none"}`,
    `- Title: ${controllerResult?.title || "none"}`,
    `- Surface: ${controllerResult?.surface || "none"}`,
    `- Files: ${files}`,
    `- Context: ${controllerResult?.context || "none"}`,
    `- Done when: ${controllerResult?.doneWhen || "none"}`,
    `- Verify: ${controllerResult?.verify || "none"}`,
    ...(designContext
      ? [
          "",
          "Design authority:",
          `- Authority file: ${designContext.authorityFile} (${designContext.authorityPath})`,
          `- Reference source: ${designContext.referenceSource}`,
          `- Target mode: ${designContext.targetMode}`,
          `- Round type: ${designContext.roundType}`,
          `- Visual goal: ${designContext.visualGoal}`,
          `- Preserve: ${designContext.preserve}`,
          ...(designContext.frontendSkillStack
            ? [
                `- Frontend skill manifest: node tools/auto-hermes-skills.mjs --json`,
                `- Active frontend skills: ${designContext.frontendSkillStack.stack.map((skill) => `${skill.name}:${skill.available ? "available" : "missing"}`).join(" | ")}`,
                `- Missing required frontend skills: ${designContext.frontendSkillStack.unavailableRequired.length ? designContext.frontendSkillStack.unavailableRequired.join(" | ") : "none"}`,
              ]
            : []),
          "- Read the authority file before editing UI and keep the implementation inside that design system.",
        ]
      : []),
    "",
  ].join("\n");
}

function applyTemplate(template, values) {
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (match, key) => {
    if (!(key in values)) return match;
    return values[key];
  });
}

function runExecutor(executor, controllerResult, promptPath, roundIndex, args) {
  const command = applyTemplate(executor.command, {
    cwd: shellQuote(ROOT),
    promptFile: shellQuote(promptPath),
    round: String(roundIndex),
    task: shellQuote(controllerResult?.title || ""),
    surface: shellQuote(controllerResult?.surface || ""),
    controllerJson: shellQuote(resolveFromRoot(args.controllerJson)),
  });

  execFileSync(
    "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-Command", command],
    {
      cwd: ROOT,
      stdio: "inherit",
    },
  );
}

function sleepSync(ms) {
  if (ms <= 0) return;
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

function runExecutorWithRetry(executor, controllerResult, promptPath, roundIndex, args) {
  const maxRetries = args.maxExecutorRetries;
  const backoffDelays = args.executorRetryBackoff;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    if (attempt > 1) {
      const delayIndex = attempt - 1;
      const delay = delayIndex < backoffDelays.length
        ? backoffDelays[delayIndex]
        : backoffDelays[backoffDelays.length - 1] || 0;
      if (!args.dryRun && delay > 0) {
        sleepSync(delay);
      }
    }

    if (args.dryRun) {
      return { success: true, result: undefined, attempt };
    }

    try {
      runExecutor(executor, controllerResult, promptPath, roundIndex, args);
      return { success: true, result: undefined, attempt };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError || "executor command failed"),
    attempts: maxRetries,
  };
}

function renderLoopMarkdown(state) {
  const lines = [
    "# Auto-Hermes Loop",
    "",
    `Generated: ${state.generatedAt}`,
    `Mode: ${state.mode}`,
    `Status: ${state.status}`,
    `Current phase: ${state.currentPhase || "grounding"}`,
    `Rounds attempted: ${state.roundsAttempted}`,
    `Rounds completed: ${state.roundsCompleted}`,
    `Same work-unit streak: ${state.sameWorkUnitStreak || 0}`,
    `Executor: ${state.executorLabel || "unconfigured"}`,
    `Executor permission: ${state.executorPermissionMode || "default"}${state.executorPermissionFlag ? ` (${state.executorPermissionFlag})` : ""}`,
    "",
  ];

  if (state.stopReason) lines.push(`Stop reason: ${state.stopReason}`, "");
  if (state.lastWorkUnit) {
    lines.push(
      "## Last Work Unit",
      `- Title: ${state.lastWorkUnit.title || "none"}`,
      `- Surface: ${state.lastWorkUnit.surface || "none"}`,
      `- Source: ${state.lastWorkUnit.source || "none"}`,
      "",
    );
  }

  lines.push(
    "## Ralph Grounding",
    `- Context snapshot: ${state.contextSnapshotPath || "none"}`,
    `- Progress ledger: ${state.progressLedgerPath || "none"}`,
    `- Last round result signature: ${state.lastRoundResultSignature || "none"}`,
    "",
    "## Supervisor Continuity",
    `- Decision: ${state.supervisorState?.decision || "continue"}`,
    `- Stop: ${state.supervisorState?.stop ? "yes" : "no"}`,
    `- Repeated no-candidate audits: ${state.supervisorState?.repeatedNoCandidateAuditRounds ?? 0}`,
    "",
  );

  if (state.lastRoundResult) {
    lines.push(
      "## Previous Round Carry-Forward",
      `- Task: ${state.lastRoundResult.task || "none"}`,
      `- Surface: ${state.lastRoundResult.surface || "none"}`,
      `- Verdict: ${state.lastRoundResult.verdict || "none"}`,
      `- Review: ${state.lastRoundResult.review || "none"}`,
      `- Blocker: ${state.lastRoundResult.blocker || "none"}`,
      `- Ralph gate: ${state.lastRoundResult.ralphGate?.summary || "none"}`,
      "",
    );
  }

  lines.push("## History");
  if (!state.history.length) {
    lines.push("- none");
  } else {
    for (const item of state.history) {
      lines.push(`- round ${item.round}: ${item.action} :: ${item.title || "none"} (${item.status})`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function buildCoordinatorBrief(state, promptText, latestControllerResult, executor, args, rtk) {
  const controllerResult = latestControllerResult || {};
  const eccProfile = deriveEccProfile(controllerResult);
  const memoryPlan = deriveMemoryPlan(controllerResult);
  const knowledgePack = deriveKnowledgePack(controllerResult);
  const techDebtReview = deriveTechDebtReview(controllerResult);
  const subagentPlan = controllerResult.subagentPlan || {
    useCodexSubagents: false,
    coordinatorMode: "local-coordinator-only",
    spawnOrder: [],
    parallelGroups: [],
    lanes: [],
    optionalSupportAgents: [],
    notes: [],
  };
  const externalCatalog = controllerResult.externalCatalog || {
    mode: "repo-local-codex-only",
    available: false,
    installedCount: 0,
    installedNames: [],
    recommended: [],
    notes: [],
  };
  const runtimeNativeExecution = getRuntimeNativeExecution(args.runtime);
  const nativeRuntime = normalizeRuntime(args.runtime);
  const nativeAwaitingStatus = nativeRuntime === "claude"
    ? "claude-execute-round"
    : `${nativeRuntime}-awaiting-worker-round`;

  let nextAction = "stop";
  let mustNotReplyYet = false;
  if (state.status === "running" && executor) {
    nextAction = "loop-owner-running";
    mustNotReplyYet = true;
  } else if (
    executor &&
    (
      state.status === "starting" ||
      state.status === "loop-complete" ||
      state.status === "dry-run-complete" ||
      state.status === "single-round-complete" ||
      state.status === "max-rounds-reached"
    )
  ) {
    nextAction = controllerResult.loopDecision === "continue-self-loop"
      ? "loop-owner-execute-round"
      : "stop";
    mustNotReplyYet = nextAction !== "stop";
  } else if ((state.status === "executor-unconfigured" || state.status === "codex-live-awaiting-coordinator") && args.runtime === "codex-live") {
    nextAction = "codex-coordinator-execute-round";
    mustNotReplyYet = true;
  } else if (state.status === "executor-unconfigured" && args.parentCodexCoordinatorOnly && args.runtime === "codex") {
    nextAction = controllerResult.loopDecision === "continue-self-loop"
      ? "codex-coordinator-execute-round"
      : "stop";
    mustNotReplyYet = nextAction !== "stop";
  } else if (
    runtimeNativeExecution &&
    (
      state.status === "starting" ||
      state.status === nativeAwaitingStatus ||
      state.status === "loop-complete" ||
      state.status === "dry-run-complete" ||
      state.status === "single-round-complete" ||
      state.status === "max-rounds-reached"
    )
  ) {
    nextAction = controllerResult.loopDecision === "continue-self-loop"
      ? `${nativeRuntime}-execute-round`
      : "stop";
    mustNotReplyYet = nextAction !== "stop";
  } else if (
    state.status === "starting" ||
    state.status === "loop-complete" ||
    state.status === "dry-run-complete" ||
    state.status === "single-round-complete" ||
    state.status === "max-rounds-reached"
  ) {
    nextAction = controllerResult.loopDecision === "continue-self-loop"
      ? "codex-coordinator-execute-round"
      : "stop";
    mustNotReplyYet = nextAction !== "stop";
  }

  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  const claudeSelfLoopProtocol = args.runtime === "claude" ? {
    enabled: true,
    description: "Claude Code is the active executor in a Ralph self-loop. The parent Claude session initializes state, dispatches the specialist team for each bounded round, collects results, runs the merge gate, writes round-close, and immediately re-enters the loop without waiting for user input. This is NOT a prepare-and-wait protocol — Claude owns the full execution cycle.",
    steps: [
      "1. Read `.workspace/state/AUTO_HERMES_SELF_COORDINATOR.md` for the current work unit (title, surface, files, verify, done-when).",
      "2. Read `.workspace/state/AUTO_HERMES_CONTROLLER.json` for the full subagent plan, route, knowledge pack, and design context.",
      "3. PRE-ROUND RALPH INTEGRITY GATE — before dispatching, verify the previous task did not break the loop:",
      "   a. Check if last round touched loop-critical files (.claude/commands/auto-hermes-self.md, tools/auto-hermes-self-loop.mjs, tools/auto-hermes-loop.mjs).",
      "   b. Run `node --check tools/auto-hermes-self-loop.mjs && node --check tools/auto-hermes-loop.mjs` — must pass.",
      "   c. Run `node tools/auto-hermes-self-loop.mjs --write --runtime claude --dry-run` — verify selfExecutionContract is 'claude-self-executing'.",
      "   d. Verify coordinator contains 'Claude Self-Loop Protocol (Active Execution)'.",
      "   e. If any check fails: record the breakage. The post-round fix step (step 6b) will repair it before round-close.",
      "4. Dispatch specialist agents per the team model:",
      "   - Parallel-safe (frontend-agent + backend-agent + test-writer): spawn together via background Agent calls.",
      "   - Sequential gates (code-reviewer, QA Agent, security-auditor): spawn after implementation agents complete.",
      "   - Reviewer-agent always runs last for the final verdict.",
      "   - Parent Claude session is the coordinator — it dispatches and merges, it does NOT implement directly.",
      "5. Collect specialist results. If any failed: create must-fix, round-close with --verdict fail, re-enter.",
      "6. Run verification from the task's Verify field. Capture fresh command output as evidence.",
      "6b. POST-ROUND RALPH INTEGRITY FIX — if the pre-round gate (step 3) found loop-critical breakage, fix it NOW:",
      "   - Apply the minimal fix to restore loop-critical files to working state.",
      "   - Re-run pre-round checks to confirm the fix resolved all failures.",
      "   - Record the fix in round-close evidence as 'ralph-integrity-fix: <files> — <what was fixed>'.",
      "   - This step is NOT optional. The Ralph loop must be healthy before the next round begins.",
      "7. Run round-close with real evidence:",
      `   node tools/auto-hermes-round-close.mjs --write --agent claude --task "<title>" --surface "<surface>" --owner "<owner>" --files "<f1>||<f2>" --verify "<verify>" --verify-result pass --architect-verdict approved --deslop-pass pass --regression-pass pass --verdict pass`,
      "   If verification failed: --verdict fail --blocker \"<reason>\".",
      "8. Re-run the loop helper to refresh state and pick the next task:",
      "   node tools/auto-hermes-loop.mjs --write --runtime claude",
      "9. Read `.workspace/state/AUTO_HERMES_COORDINATOR.md` — check Next Action:",
      "   - `claude-execute-round` → go to step 1 immediately. Do not wait. Do not ask. Just execute.",
      "   - `stop` → auto-publish: run `node tools/auto-hermes-push-main.mjs --execute --write --message \"auto-hermes: <summary>\"` to push the branch and create a PR, then report the PR URL. If no product changes, skip the PR and report exhaustion.",
      "10. Never skip round-close (step 7) — it advances TASKS.md and promotes the next task.",
      "11. If context pressure is high mid-loop: complete current round-close, then use ScheduleWakeup(delaySeconds=60, prompt='/auto-hermes-self') to re-enter with fresh context.",
    ],
    roundCloseTemplate: `node tools/auto-hermes-round-close.mjs --write --agent claude --task "${controllerResult?.title || ""}" --surface "${controllerResult?.surface || ""}" --owner "${controllerResult?.owner || "frontend"}" --files "${files.join("||")}" --verify "${controllerResult?.verify || ""}" --verify-result pass --architect-verdict approved --deslop-pass pass --regression-pass pass --verdict pass`,
    loopRefreshCommand: "node tools/auto-hermes-loop.mjs --write --runtime claude",
    coordinatorBriefPath: resolveFromRoot(args.coordinatorMd),
  } : null;

  return {
    generatedAt: state.generatedAt,
    runtime: args.runtime,
    status: state.status,
    stopReason: state.stopReason,
    nextAction,
    mustNotReplyYet,
    executorLabel: executor?.label || state.executorLabel || runtimeExecutorLabel(args.runtime),
    executorPermissionMode: executor?.permissionMode || state.executorPermissionMode || "",
    executorPermissionFlag: executor?.permissionFlag || state.executorPermissionFlag || "",
    executorPermissionDescription: executor?.permissionDescription || state.executorPermissionDescription || "",
    runtimeNativeExecution,
    parentCodexCoordinatorOnly: Boolean(args.parentCodexCoordinatorOnly && args.runtime === "codex"),
    rtk,
    eccProfile,
    memoryPlan,
    knowledgePack,
    techDebtReview,
    currentRound: state.roundsAttempted + 1,
    mode: state.mode,
    externalCatalog,
    traceToSkill: controllerResult.traceToSkill || { mode: "none", summary: "No trace-to-skill evidence loaded.", candidates: [], evolvedSkill: null },
    claudeSelfLoopProtocol,
    currentPhase: state.currentPhase || "grounding",
    contextSnapshotPath: state.contextSnapshotPath || resolveFromRoot(makeContextSnapshotPath(state.loopId || "auto-hermes")),
    progressLedgerPath: state.progressLedgerPath || resolveFromRoot(makeProgressLedgerPath(state.loopId || "auto-hermes")),
    roundResultJson: resolveFromRoot(args.roundResultJson || ".workspace/state/AUTO_HERMES_ROUND_RESULT.json"),
    roundResultMd: resolveFromRoot(args.roundResultMd || ".workspace/state/AUTO_HERMES_ROUND_RESULT.md"),
    lastRoundResult: state.lastRoundResult || null,
    lastRoundResultSignature: state.lastRoundResultSignature || "",
    supervisorState: state.supervisorState || createAutoHermesSupervisorState({ mode: "auto-hermes" }),
      workUnit: controllerResult?.title
        ? {
            source: controllerResult.source || "",
            title: controllerResult.title || "",
            surface: controllerResult.surface || "",
            files: Array.isArray(controllerResult.files) ? controllerResult.files : [],
            verify: controllerResult.verify || "",
            mission: controllerResult.mission || null,
            designContext: controllerResult.designContext || null,
          }
        : null,
    subagentPlan,
    claimStates: deriveLoopClaimStates({
      state,
      controllerResult,
      executor,
      args,
      eccProfile,
      rtk,
      nextAction,
    }),
    workerPromptFile: resolveFromRoot(args.promptFile),
    workerPromptPreview: promptText,
  };
}

function renderCoordinatorMarkdown(brief) {
  const lines = [
    "# Auto-Hermes Coordinator",
    "",
    `Generated: ${brief.generatedAt}`,
    `Runtime: ${brief.runtime}`,
    `Status: ${brief.status}`,
    `Next Action: ${brief.nextAction}`,
    `Must Not Reply Yet: ${brief.mustNotReplyYet ? "yes" : "no"}`,
    `Executor: ${brief.executorLabel || "none"}`,
    `Executor Permission: ${brief.executorPermissionMode || "default"}${brief.executorPermissionFlag ? ` (${brief.executorPermissionFlag})` : ""}`,
    `RTK Mode: ${brief.rtk?.mode || "unavailable"}`,
    `ECC Mode: ${brief.eccProfile?.mode || "compatibility-fallback"}`,
    `ECC Packs: ${brief.eccProfile?.enabled?.length ? brief.eccProfile.enabled.join(", ") : "none"}`,
    "",
  ];

  if (brief.stopReason) lines.push(`Stop reason: ${brief.stopReason}`, "");

  if (brief.workUnit) {
    lines.push(
      "## Current Work Unit",
      `- Source: ${brief.workUnit.source || "none"}`,
      `- Title: ${brief.workUnit.title || "none"}`,
      `- Surface: ${brief.workUnit.surface || "none"}`,
      `- Files: ${brief.workUnit.files.length ? brief.workUnit.files.join(" | ") : "not specified"}`,
      `- Verify: ${brief.workUnit.verify || "none"}`,
      "",
      "## Previous Round Carry-Forward",
      `- Progress signature: ${brief.lastRoundResultSignature || "none"}`,
      `- Task: ${brief.lastRoundResult?.task || "none"}`,
      `- Surface: ${brief.lastRoundResult?.surface || "none"}`,
      `- Verdict: ${brief.lastRoundResult?.verdict || "none"}`,
      `- Review: ${brief.lastRoundResult?.review || "none"}`,
      `- Blocker: ${brief.lastRoundResult?.blocker || "none"}`,
      `- Ralph gate: ${brief.lastRoundResult?.ralphGate?.summary || "none"}`,
      "",
      "## ECC Compatibility Mode",
      `- Mode: ${brief.eccProfile?.mode || "compatibility-fallback"}`,
      `- Source: ${brief.eccProfile?.source || "none"}`,
      ...(Array.isArray(brief.eccProfile?.evidence) && brief.eccProfile.evidence.length
        ? brief.eccProfile.evidence.map((item) => `- Evidence: ${item}`)
        : ["- Evidence: none; native install not detected"]),
      ...(Array.isArray(brief.eccProfile?.packs)
        ? brief.eccProfile.packs
            .filter((pack) => pack.enabled)
            .map((pack) => `- ${pack.key}: ${pack.summary}`)
        : []),
      "",
      "## MemPalace Plan",
      `- Mode: ${brief.memoryPlan?.mode || "skip"}`,
      `- Owner: ${brief.memoryPlan?.owner || "general"}`,
      `- Query target: ${brief.memoryPlan?.query || "none"}`,
      `- Reason: ${brief.memoryPlan?.reason || "none"}`,
      ...(Array.isArray(brief.memoryPlan?.steps) ? brief.memoryPlan.steps.map((step) => `- ${step}`) : []),
      "",
      "## Knowledge Pack",
      `- Strategy: ${brief.knowledgePack?.strategy || "progressive-disclosure"}`,
      ...(brief.knowledgePack?.recordSystemMap
        ? [`- Record-system map: ${brief.knowledgePack.recordSystemMap.relPath}`]
        : ["- Record-system map: none"]),
      ...(Array.isArray(brief.knowledgePack?.readOrder)
        ? brief.knowledgePack.readOrder.map((entry, index) => `- Read ${index + 1}: ${entry.relPath} (${entry.reason})`)
        : []),
      ...(Array.isArray(brief.knowledgePack?.rules)
        ? brief.knowledgePack.rules.map((rule) => `- Rule: ${rule}`)
        : []),
      `- Doc-gardening: ${brief.knowledgePack?.docGardening?.mode || "conditional"}`,
      ...(Array.isArray(brief.knowledgePack?.docGardening?.smallestOwningDocs)
        ? brief.knowledgePack.docGardening.smallestOwningDocs.map((entry) => `- Smallest owner: ${entry}`)
        : []),
      "",
      "## Tech-Debt Reviewer",
      `- Required every round: ${brief.techDebtReview?.requiredEveryRound ? "yes" : "no"}`,
      `- Scope: ${brief.techDebtReview?.scope || "none"}`,
      `- Max items: ${brief.techDebtReview?.maxItems ?? 0}`,
      `- Primary files: ${brief.techDebtReview?.primaryFiles?.length ? brief.techDebtReview.primaryFiles.join(" | ") : "not specified"}`,
      `- Related files: ${brief.techDebtReview?.relatedFiles?.length ? brief.techDebtReview.relatedFiles.join(" | ") : "none"}`,
      ...(Array.isArray(brief.techDebtReview?.taskFormat)
        ? brief.techDebtReview.taskFormat.map((entry) => `- Task format: ${entry}`)
        : []),
      ...(Array.isArray(brief.techDebtReview?.rules)
        ? brief.techDebtReview.rules.map((rule) => `- Rule: ${rule}`)
        : []),
      "",
      "## Subagent Plan",
      ...(brief.runtimeNativeExecution
        ? [
            `- use ${brief.runtimeNativeExecution.agentLabel}: ${brief.subagentPlan.useCodexSubagents ? "yes, mapped from controller subagent plan" : "no"}`,
            `- native runtime owner: ${brief.runtimeNativeExecution.agentOwner}`,
            `- model policy: ${brief.runtimeNativeExecution.modelPolicy}`,
            `- Codex fallback allowed: ${brief.runtimeNativeExecution.codexFallbackAllowed ? "yes" : "no"}`,
            ...(brief.runtimeNativeExecution.runtime === "claude" && brief.runtimeNativeExecution.teamDispatch
              ? [
                  `- team coordinator: ${brief.runtimeNativeExecution.teamDispatch.coordinator}`,
                  `- team specialists: ${(brief.runtimeNativeExecution.teamDispatch.specialists || []).join(", ")}`,
                  `- parallel-ok: ${(brief.runtimeNativeExecution.teamDispatch.parallelOk || []).join(", ")}`,
                  `- sequential-only: ${(brief.runtimeNativeExecution.teamDispatch.sequentialOnly || []).join(", ")}`,
                  `- merge gate: ${brief.runtimeNativeExecution.teamDispatch.mergeGate}`,
                ]
              : []),
          ]
        : [`- use Codex subagents: ${brief.subagentPlan.useCodexSubagents ? "yes" : "no"}`]),
      `- coordinator mode: ${brief.subagentPlan.coordinatorMode}`,
      `- spawn order: ${brief.subagentPlan.spawnOrder.length ? brief.subagentPlan.spawnOrder.join(" -> ") : "none"}`,
      `- parallel groups: ${brief.subagentPlan.parallelGroups.length ? brief.subagentPlan.parallelGroups.map((group) => group.join(" + ")).join(" | ") : "none"}`,
      ...brief.subagentPlan.lanes.map((lane) => `- ${lane.agent}: ${lane.mode}, ${lane.ownership}`),
      ...(brief.subagentPlan.optionalSupportAgents?.length
        ? brief.subagentPlan.optionalSupportAgents.map((agent) => `- optional support: ${agent}`)
        : []),
      ...brief.subagentPlan.notes.map((note) => `- note: ${note}`),
      "",
      ...(brief.parentCodexCoordinatorOnly && brief.runtime === "codex"
        ? [
            "## Repo-Local / Generated Agents Disabled",
            "- mode: parent-codex-native-subagents-only",
            "- generated-agent helpers are disabled for this Codex coordinator path.",
            "- Do not run `tools/generate-codex.js`, external repo agent generators, helper-generated executor agents, or repo-local external Codex agents.",
            "- If delegation is safe and useful, the parent Codex session must spawn Codex-native subagents with `multi_agent_v1.spawn_agent`; otherwise execute locally.",
            "- Repo-local installed agents may be listed as static reference material only; they are not proof of live execution and are not an execution surface for this path.",
          ]
        : [
            "## Repo-Local External Codex Agents",
            `- mode: ${brief.externalCatalog?.mode || "repo-local-codex-only"}`,
            `- installed count: ${brief.externalCatalog?.installedCount ?? 0}`,
            `- recommended this round: ${brief.externalCatalog?.recommended?.length ? brief.externalCatalog.recommended.map((entry) => entry.installedName).join(", ") : "none"}`,
            `- installed agents: ${brief.externalCatalog?.installedNames?.length ? brief.externalCatalog.installedNames.join(", ") : "none"}`,
            "- These are repo-local installed agents, not proof of live execution.",
            ...(brief.runtimeNativeExecution ? ["- Native-runtime lanes must not call these Codex agents; use the runtime-native agent surface above."] : []),
            ...(Array.isArray(brief.externalCatalog?.notes)
              ? brief.externalCatalog.notes.map((note) => `- note: ${note}`)
              : []),
          ]),
      "",
      "## Evolved Trace Skill",
      `- mode: ${brief.traceToSkill?.evolvedSkill?.mode || "none"}`,
      `- slug: ${brief.traceToSkill?.evolvedSkill?.slug || "none"}`,
      `- summary: ${brief.traceToSkill?.evolvedSkill?.summary || "No evolved trace skill loaded."}`,
      ...(Array.isArray(brief.traceToSkill?.evolvedSkill?.coreRules) && brief.traceToSkill.evolvedSkill.coreRules.length
        ? brief.traceToSkill.evolvedSkill.coreRules.slice(0, 3).map((rule) => `- core rule: ${rule.rule} [${rule.evidenceCount || 0}]`)
        : ["- core rule: none"]),
      "- advisory only: use this as reusable repo-side guidance and never let it outrank AGENTS.md, runtime proof, or fresher tool output.",
      "",
      "## Claim States",
      ...Object.values(brief.claimStates || {}).flatMap((claim) => renderClaimMarkdown(claim)),
      "",
      "## Ralph Grounding",
      `- Current phase: ${brief.currentPhase || "grounding"}`,
      `- Context snapshot: ${brief.contextSnapshotPath || "none"}`,
      `- Progress ledger: ${brief.progressLedgerPath || "none"}`,
      `- Round result JSON: ${brief.roundResultJson || "none"}`,
      `- Round result Markdown: ${brief.roundResultMd || "none"}`,
      "",
      "## Supervisor Continuity",
      `- Continuity layer: ${brief.supervisorState?.continuityLayer || "supervisor"}`,
      `- Decision: ${brief.supervisorState?.decision || "continue"}`,
      `- Stop: ${brief.supervisorState?.stop ? "yes" : "no"}`,
      `- Repeated no-candidate audits: ${brief.supervisorState?.repeatedNoCandidateAuditRounds ?? 0}`,
      `- Rationale: ${brief.supervisorState?.rationale || "none"}`,
      "",
      "## Coordinator Contract",
      "- If next action is `loop-owner-running`, `tools/auto-hermes-loop.mjs` is the active outer-loop owner and the run is already in flight.",
      "- If next action is `loop-owner-execute-round`, the loop helper is the next bounded round owner and can continue without handing control back to prompt-only coordination.",
      ...(brief.runtimeNativeExecution
        ? [
            `- If next action is \`${brief.runtimeNativeExecution.runtime}-execute-round\`, ${brief.runtimeNativeExecution.agentOwner} is the executor and must use ${brief.runtimeNativeExecution.agentLabel} with its current model/session.`,
            `- ${brief.runtimeNativeExecution.fallback}`,
          ]
        : []),
      "- If next action is `claude-execute-round`, Claude Code is the active Ralph executor — immediately execute the next bounded round using the team model (dispatch specialist agents, collect results, run merge gate, verify, round-close). Do NOT stop or wait for the user. Keep looping until Next Action is `stop`.",
      ...(brief.parentCodexCoordinatorOnly && brief.runtime === "codex"
        ? [
            "- If next action is `codex-coordinator-execute-round`, the parent Codex session executes the round directly and may use `multi_agent_v1.spawn_agent` only for safely separable lanes; generated-agent helpers remain disabled.",
          ]
        : [
            "- If next action is `codex-coordinator-execute-round`, that is now a fallback only when no executor-owned loop path is available.",
          ]),
      "- The loop owner now persists live Ralph grounding artifacts and supervisor continuity state in repo-local `.workspace/state` files.",
      "- The current work unit in this brief is authoritative for execution. Treat any stale `HUMAN_LOOP` / `LOOP_STATE` narrative writeback as non-operative background context unless it matches the controller-selected task.",
      "- Stop only when the rerun coordinator brief says `stop` or a real blocker/human gate fires. On stop, auto-publish: push branch + create PR via `node tools/auto-hermes-push-main.mjs --execute --write`. Skip PR if no product changes.",
      "- If the MemPalace plan is `required` or `recommended` and live MemPalace tools are available, execute that lookup before broad repo exploration or delegation.",
      "- Start from the emitted knowledge pack before opening deeper workflow docs. Treat the repo map and owning docs as the durable record system for `/auto-hermes` truth.",
      "- Run the tech-debt-reviewer check on every round before stop/writeback. It is a required bounded pass, not optional cleanup.",
      "- ECC mode is automatic: native marker detection only proves configuration, not live native execution.",
      ...(brief.rtk?.available
        ? [
            "- While this /auto-hermes run is active, prefer RTK-wrapped shell commands for shell-based inspection and noisy verification output, but do not treat RTK availability as proof of success.",
          ]
        : []),
      "",
      ...(brief.claudeSelfLoopProtocol?.enabled
        ? [
            "## Claude Self-Loop Protocol",
            `Description: ${brief.claudeSelfLoopProtocol.description}`,
            ...(Array.isArray(brief.claudeSelfLoopProtocol.steps) ? brief.claudeSelfLoopProtocol.steps : []),
            "",
            `Round-close template: ${brief.claudeSelfLoopProtocol.roundCloseTemplate}`,
            `Loop refresh command: ${brief.claudeSelfLoopProtocol.loopRefreshCommand}`,
            `Coordinator brief path: ${brief.claudeSelfLoopProtocol.coordinatorBriefPath}`,
            "",
          ]
        : []),
      `Worker prompt file: ${brief.workerPromptFile}`,
    );
  } else {
    lines.push("## Current Work Unit", "- none");
  }

  return `${lines.join("\n")}\n`;
}

function writeOutputs(args, state, promptText, latestControllerResult, executor, rtk) {
  const jsonPath = resolveFromRoot(args.outputJson);
  const mdPath = resolveFromRoot(args.outputMd);
  const coordinatorJsonPath = resolveFromRoot(args.coordinatorJson);
  const coordinatorMdPath = resolveFromRoot(args.coordinatorMd);
  const promptPath = resolveFromRoot(args.promptFile);
  const contextSnapshotPath = resolveFromRoot(state.contextSnapshotPath || makeContextSnapshotPath(state.loopId || "auto-hermes"));
  const progressLedgerPath = resolveFromRoot(state.progressLedgerPath || makeProgressLedgerPath(state.loopId || "auto-hermes"));
  ensureParent(jsonPath);
  ensureParent(mdPath);
  ensureParent(coordinatorJsonPath);
  ensureParent(coordinatorMdPath);
  ensureParent(promptPath);
  ensureParent(contextSnapshotPath);
  ensureParent(progressLedgerPath);
  fs.writeFileSync(jsonPath, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(mdPath, renderLoopMarkdown(state), "utf8");
  fs.writeFileSync(promptPath, promptText, "utf8");
  if (state.contextSnapshot) {
    fs.writeFileSync(contextSnapshotPath, JSON.stringify(state.contextSnapshot, null, 2), "utf8");
  }
  if (state.progressLedger) {
    fs.writeFileSync(progressLedgerPath, JSON.stringify(state.progressLedger, null, 2), "utf8");
  }
  if (state.loopId) {
    writeRalphState(state.loopId, state);
  }
  const coordinatorBrief = buildCoordinatorBrief(state, promptText, latestControllerResult, executor, args, rtk);
  fs.writeFileSync(coordinatorJsonPath, JSON.stringify(coordinatorBrief, null, 2), "utf8");
  fs.writeFileSync(coordinatorMdPath, renderCoordinatorMarkdown(coordinatorBrief), "utf8");
}

export function runAutoHermesLoop(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : {
    ...parseArgs([]),
    ...rawArgs,
  };
  args.claimOwner = args.claimOwner || defaultClaimOwner(args.runtime);
  const executor = loadExecutorConfig(args);
  const runtimeNativeExecution = getRuntimeNativeExecution(args.runtime);
  const rtk = detectRtk();
  const promptPath = resolveFromRoot(args.promptFile);
  const persistedState = loadLoopState(args);
  const loopRootDir = inferLoopRootDir(args);
  const loopId = String(persistedState.loopId || makeLoopId()).trim() || makeLoopId();
  let previousWorkUnitSignature = normalizeWorkUnitSignature(persistedState.lastWorkUnitSignature);
  let previousRoundResultSignature = normalizeRoundResultSignature(persistedState.lastRoundResultSignature)
    || makeRoundResultSignature(persistedState.lastRoundResult);
  const state = {
    generatedAt: nowIso(),
    loopId,
    mode: args.mode,
    roundsAttempted: 0,
    roundsCompleted: 0,
    status: "starting",
    currentPhase: String(persistedState.currentPhase || "grounding").trim() || "grounding",
    stopReason: "",
    executorLabel: configuredExecutorLabel(args.runtime, executor),
    executorPermissionMode: executor?.permissionMode || "",
    executorPermissionFlag: executor?.permissionFlag || "",
    executorPermissionDescription: executor?.permissionDescription || "",
    runtimeNativeExecution,
    rtk,
    history: [],
    lastWorkUnit: null,
    sameWorkUnitStreak: normalizeSameWorkUnitStreak(persistedState.sameWorkUnitStreak),
    lastRoundResultSignature: previousRoundResultSignature,
    lastRoundResult: normalizeRoundResult(persistedState.lastRoundResult),
    websiteAudit: persistedState.websiteAudit || null,
    supervisorState: persistedState.supervisorState || createAutoHermesSupervisorState({
      mode: "auto-hermes",
      noCandidateAuditLimit: args.maxSameWorkUnitRepeats,
    }),
    contextSnapshotPath: absoluteLoopArtifactPath(loopRootDir, makeContextSnapshotPath(loopId)),
    progressLedgerPath: absoluteLoopArtifactPath(loopRootDir, makeProgressLedgerPath(loopId)),
    ralphStatePath: absoluteLoopArtifactPath(loopRootDir, makeRalphStatePath(loopId)),
    contextSnapshot: null,
    progressLedger: null,
  };

  let latestPrompt = "# Auto-Hermes Worker Round\n\nNo work unit selected yet.\n";
  let latestControllerResult = null;
  let activeClaimKey = "";
  let auditRun = loadAutoHermesRun({ rootDir: loopRootDir, runId: persistedState.auditRunId });
  if (!auditRun) {
    auditRun = createAutoHermesRun({
      rootDir: loopRootDir,
      mode: "auto-hermes",
      goal: "Standard auto-hermes website audit loop",
    }).state;
  }
  persistedState.auditRunId = auditRun?.runId || persistedState.auditRunId || "";

  const persistLoopState = ({
    status = state.status,
    lastWorkUnitSignature = previousWorkUnitSignature,
    lastRoundResultSignature = previousRoundResultSignature,
  } = {}) => {
    previousWorkUnitSignature = normalizeWorkUnitSignature(lastWorkUnitSignature);
    previousRoundResultSignature = normalizeRoundResultSignature(lastRoundResultSignature);
    const latestRecordedRound = Array.isArray(state.history) && state.history.length > 0
      ? Math.max(0, Number(state.history.at(-1)?.round) || 0)
      : 0;
    persistedState.currentRound = Math.max(state.roundsAttempted, latestRecordedRound);
    persistedState.loopId = state.loopId;
    persistedState.maxRounds = args.maxRounds;
    persistedState.status = status;
    persistedState.currentPhase = state.currentPhase;
    persistedState.currentTask = state.lastWorkUnit?.title || "";
    persistedState.roundHistory = state.history;
    persistedState.sameWorkUnitStreak = state.sameWorkUnitStreak;
    persistedState.lastWorkUnitSignature = previousWorkUnitSignature;
    persistedState.lastRoundResultSignature = previousRoundResultSignature;
    persistedState.lastRoundResult = state.lastRoundResult || null;
    persistedState.preRoundCommit = persistedState.preRoundCommit || getCurrentGitHead();
    persistedState.auditRunId = persistedState.auditRunId || auditRun?.runId || "";
    persistedState.websiteAudit = state.websiteAudit;
    persistedState.supervisorState = state.supervisorState;
    persistedState.resumable = false;
    if (args.write) writeLoopState(args, persistedState);
  };

  const recordLoopWebsiteAudit = (controllerResult) => {
    const queueConfirmedEmpty = controllerResult?.websiteAudit?.queueState?.status === "confirmed-empty";
    if (!controllerResult?.websiteAudit?.attempted || !persistedState.auditRunId || !queueConfirmedEmpty) {
      state.websiteAudit = null;
      persistedState.websiteAudit = state.websiteAudit;
      return auditRun;
    }
    const nextRun = recordWebsiteAuditAttempt({
      rootDir: loopRootDir,
      runId: persistedState.auditRunId,
      foundCandidate: controllerResult.websiteAudit.usedFallback === true,
      auditSummary: controllerResult.websiteAudit.summary || controllerResult.reason || "",
    }) || auditRun;
    auditRun = nextRun;
    state.websiteAudit = {
      ...(controllerResult.websiteAudit || {}),
      ...(nextRun?.websiteAudit || {}),
    };
    persistedState.websiteAudit = state.websiteAudit;
    return nextRun;
  };

  for (let roundIndex = 1; roundIndex <= args.maxRounds; roundIndex += 1) {
    persistedState.preRoundCommit = getCurrentGitHead();
    const controllerResult = runController(args);
    latestControllerResult = controllerResult;
    const signature = workSignature(controllerResult);
    if (signature !== previousWorkUnitSignature) {
      state.sameWorkUnitStreak = 0;
    }
    state.currentPhase = "grounding";
    state.contextSnapshot = buildContextSnapshot(args, controllerResult);
    state.progressLedger = buildProgressLedger(state, args, controllerResult);
    latestPrompt = renderWorkerPrompt(controllerResult, roundIndex, rtk, {
      contextSnapshotPath: resolveFromRoot(state.contextSnapshotPath),
      progressLedgerPath: resolveFromRoot(state.progressLedgerPath),
      controllerJson: resolveFromRoot(args.controllerJson || ".workspace/state/AUTO_HERMES_CONTROLLER.json"),
      roundResultJson: resolveFromRoot(args.roundResultJson || ".workspace/state/AUTO_HERMES_ROUND_RESULT.json"),
      roundResultMd: resolveFromRoot(args.roundResultMd || ".workspace/state/AUTO_HERMES_ROUND_RESULT.md"),
      lastRoundResult: state.lastRoundResult,
      lastRoundResultSignature: state.lastRoundResultSignature,
      runtimeNativeExecution: state.runtimeNativeExecution,
      executorPermission: {
        mode: state.executorPermissionMode,
        flag: state.executorPermissionFlag,
        description: state.executorPermissionDescription,
      },
    });
    state.lastWorkUnit = controllerResult?.title
      ? {
          title: controllerResult.title,
          surface: controllerResult.surface,
          source: controllerResult.source,
          mission: controllerResult.mission || null,
        }
      : null;

    const auditAttempt = recordLoopWebsiteAudit(controllerResult);
    const emptyAuditCount = auditAttempt?.websiteAudit?.emptyAuditCount || 0;
    const shouldExecuteFallbackCandidate = controllerResult.websiteAudit?.usedFallback === true && Boolean(controllerResult.title);
    const queueConfirmedEmpty = controllerResult.websiteAudit?.queueState?.status === "confirmed-empty";
    state.supervisorState = evaluateAutoHermesSupervisorRound({
      state: state.supervisorState,
      queueState: queueConfirmedEmpty ? "empty" : controllerResult?.title ? "available" : "unknown",
      websiteAuditStatus: controllerResult.websiteAudit?.attempted
        ? controllerResult.websiteAudit.usedFallback === true
          ? "candidate"
          : controllerResult.websiteAudit.candidate
            ? "candidate"
            : "no-candidate"
        : "skipped",
      summary: controllerResult.websiteAudit?.summary || controllerResult.reason || controllerResult.title || "",
    });

    if (controllerResult.loopDecision !== "continue-self-loop" && !shouldExecuteFallbackCandidate) {
      const shouldRetryAuditExhaustion =
        controllerResult.websiteAudit?.attempted
        && queueConfirmedEmpty
        && controllerResult.websiteAudit?.usedFallback !== true
        && emptyAuditCount > 0
        && state.supervisorState.decision === "continue"
        && roundIndex < args.maxRounds;

      if (shouldRetryAuditExhaustion) {
        state.status = "audit-retry-armed";
        state.currentPhase = "audit-retry";
        state.stopReason = `website audit exhausted ${emptyAuditCount}/${args.maxSameWorkUnitRepeats} time(s); retrying before final stop`;
        state.progressLedger = buildProgressLedger(state, args, controllerResult);
        state.history.push({
          round: roundIndex,
          action: "audit-empty",
          title: controllerResult.title || "",
          status: state.status,
        });
        persistLoopState({ status: state.status, lastWorkUnitSignature: signature });
        continue;
      }

      state.status = controllerResult.loopDecision || "stop-exhausted";
      state.currentPhase = "complete";
      state.progressLedger = buildProgressLedger(state, args, controllerResult);
      state.stopReason = controllerResult.websiteAudit?.attempted && queueConfirmedEmpty && state.supervisorState.stop
        ? controllerResult.reason || state.supervisorState.rationale || "controller reported repeated website-audit exhaustion"
        : controllerResult.reason || "controller reported no promotable next round";
      state.history.push({
        round: roundIndex,
        action: controllerResult.websiteAudit?.attempted && queueConfirmedEmpty ? "audit-empty" : "stop",
        title: controllerResult.title || "",
        status: state.status,
      });
      persistLoopState({ status: state.status, lastWorkUnitSignature: signature });
      break;
    }

    const claimAttempt = acquireTaskClaim({
      claimDir: args.claimDir,
      key: controllerResult.claimKey,
      ownerId: args.claimOwner,
      ownerLabel: executor?.label || args.runtime,
      source: controllerResult.source,
      surface: controllerResult.surface,
      title: controllerResult.title,
      ttlMinutes: args.claimTtlMinutes,
    });
    if (!claimAttempt.acquired) {
      state.status = "task-claimed-elsewhere";
      state.stopReason = `task is currently claimed by another auto-hermes thread: ${claimAttempt.claim?.ownerLabel || claimAttempt.claim?.ownerId || "unknown-owner"}`;
      state.history.push({
        round: roundIndex,
        action: "claim-contention",
        title: controllerResult.title || "",
        status: state.status,
      });
      persistLoopState({ status: state.status, lastWorkUnitSignature: signature });
      break;
    }
    activeClaimKey = controllerResult.claimKey || "";

    if (args.mode === "single-round" && roundIndex > 1) {
      state.status = "single-round-complete";
      state.stopReason = "single-round mode only permits one bounded worker round";
      if (activeClaimKey) releaseTaskClaim({ claimDir: args.claimDir, key: activeClaimKey, ownerId: args.claimOwner });
      activeClaimKey = "";
      persistLoopState({ status: state.status, lastWorkUnitSignature: signature });
      break;
    }

    state.roundsAttempted += 1;
    if (args.dryRun) {
      state.status = "dry-run-complete";
      state.stopReason = executor
        ? "dry-run refreshed the loop-owner brief without executing a worker round"
        : args.runtime === "codex-live"
          ? "dry-run refreshed the fallback live coordinator brief without executing a worker round"
          : "dry-run prepared the next worker brief without executing additional rounds";
      state.history.push({
        round: roundIndex,
        action: "dry-run",
        title: controllerResult.title || "",
        status: state.status,
      });
      if (activeClaimKey) releaseTaskClaim({ claimDir: args.claimDir, key: activeClaimKey, ownerId: args.claimOwner });
      activeClaimKey = "";
      persistLoopState({ status: state.status, lastWorkUnitSignature: signature });
      break;
    }

    if (!args.dryRun && !executor) {
      state.currentPhase = "prepared";
      state.progressLedger = buildProgressLedger(state, args, controllerResult);
      if (args.runtime === "gemini") {
        state.status = "gemini-awaiting-worker-round";
        state.stopReason = "Gemini CLI is the executor: read the worker brief at {promptFile} and use Gemini parallel agents with the current Gemini model/session; do not invoke Codex.";
      } else if (args.runtime === "opencode") {
        state.status = "opencode-awaiting-worker-round";
        state.stopReason = "OpenCode is the executor: read the worker brief at {promptFile} and use OpenCode parallel agents with the current OpenCode model/session; do not invoke Codex.";
      } else if (args.runtime === "claude") {
        state.status = "claude-execute-round";
        state.stopReason = "Claude Code is the active executor in a Ralph self-loop: initialize state, dispatch the specialist team for each bounded round, run the merge gate, write round-close, and immediately re-enter the loop. Do NOT stop after one round — keep executing until a real stop gate fires.";
      } else if (args.runtime === "codex-live") {
        state.status = "codex-live-awaiting-coordinator";
        state.stopReason = "live Codex coordinator should execute this round directly using the emitted coordinator brief";
      } else if (args.runtime === "codex" && args.parentCodexCoordinatorOnly) {
        state.status = "executor-unconfigured";
        state.stopReason = "parent Codex session should execute this round directly using native Codex subagents only for safely separable lanes; helper-generated executor agents are disabled";
      } else {
        state.status = "executor-unconfigured";
        state.stopReason = "no executor command is configured for unattended worker rounds";
      }
      state.history.push({
        round: roundIndex,
        action: "prepare-only",
        title: controllerResult.title || "",
        status: state.status,
      });
      if (activeClaimKey) releaseTaskClaim({ claimDir: args.claimDir, key: activeClaimKey, ownerId: args.claimOwner });
      activeClaimKey = "";
      persistLoopState({ status: state.status, lastWorkUnitSignature: signature });
      break;
    }

    state.status = "running";
    state.currentPhase = "executing";
    state.stopReason = "";
    state.progressLedger = buildProgressLedger(state, args, controllerResult);
    persistLoopState({ status: state.status, lastWorkUnitSignature: signature });
    if (args.write) writeOutputs(args, state, latestPrompt, latestControllerResult, executor, rtk);

    const retryResult = runExecutorWithRetry(executor, controllerResult, promptPath, roundIndex, args);
    if (!retryResult.success) {
      state.status = "executor-unavailable";
      state.currentPhase = "blocked";
      state.stopReason = retryResult.error || "executor unavailable after retries";
      state.progressLedger = buildProgressLedger(state, args, controllerResult);
      state.history.push({
        round: roundIndex,
        action: "execute",
        title: controllerResult.title || "",
        status: state.status,
      });
      if (activeClaimKey) releaseTaskClaim({ claimDir: args.claimDir, key: activeClaimKey, ownerId: args.claimOwner });
      activeClaimKey = "";
      persistLoopState({ status: state.status, lastWorkUnitSignature: signature });
      continue;
    }

    const postController = runController(args);
    latestControllerResult = postController;
    const nextSignature = workSignature(postController);
    const latestRoundResult = loadRoundResult(args);
    const latestRoundResultSignature = normalizeRoundResultSignature(
      makeRoundResultSignature(latestRoundResult),
    );
    state.currentPhase = "reassessing";
    state.lastWorkUnit = postController?.title
      ? {
          title: postController.title,
          surface: postController.surface,
          source: postController.source,
        }
      : null;
    state.websiteAudit = postController?.websiteAudit
      ? { ...postController.websiteAudit }
      : null;
    if (latestRoundResult) state.lastRoundResult = latestRoundResult;
    if (latestRoundResultSignature) state.lastRoundResultSignature = latestRoundResultSignature;
    state.history.push({
      round: roundIndex,
      action: args.dryRun ? "dry-run" : "execute",
      title: controllerResult.title || "",
      status: postController.loopDecision || "continue-self-loop",
    });
    state.roundsCompleted += 1;
    state.contextSnapshot = buildContextSnapshot(args, postController);
    state.progressLedger = buildProgressLedger(state, args, postController);

    if (args.mode === "single-round") {
      state.status = "single-round-complete";
      state.currentPhase = "complete";
      state.stopReason = "single-round mode completed one bounded worker round";
      state.progressLedger = buildProgressLedger(state, args, postController);
      latestPrompt = renderWorkerPrompt(postController, roundIndex + 1, rtk, {
        contextSnapshotPath: resolveFromRoot(state.contextSnapshotPath),
        progressLedgerPath: resolveFromRoot(state.progressLedgerPath),
        controllerJson: resolveFromRoot(args.controllerJson || ".workspace/state/AUTO_HERMES_CONTROLLER.json"),
        roundResultJson: resolveFromRoot(args.roundResultJson || ".workspace/state/AUTO_HERMES_ROUND_RESULT.json"),
        roundResultMd: resolveFromRoot(args.roundResultMd || ".workspace/state/AUTO_HERMES_ROUND_RESULT.md"),
        lastRoundResult: state.lastRoundResult,
        lastRoundResultSignature: state.lastRoundResultSignature,
        runtimeNativeExecution: state.runtimeNativeExecution,
      });
      if (activeClaimKey) releaseTaskClaim({ claimDir: args.claimDir, key: activeClaimKey, ownerId: args.claimOwner });
      activeClaimKey = "";
      persistLoopState({
        status: state.status,
        lastWorkUnitSignature: nextSignature,
        lastRoundResultSignature: state.lastRoundResultSignature,
      });
      break;
    }

    if (postController.loopDecision !== "continue-self-loop") {
      state.status = postController.loopDecision || "stop-exhausted";
      state.currentPhase = "complete";
      state.stopReason = postController.reason || "controller reported clean stop after worker round";
      state.progressLedger = buildProgressLedger(state, args, postController);
      latestPrompt = renderWorkerPrompt(postController, roundIndex + 1, rtk, {
        contextSnapshotPath: resolveFromRoot(state.contextSnapshotPath),
        progressLedgerPath: resolveFromRoot(state.progressLedgerPath),
        controllerJson: resolveFromRoot(args.controllerJson || ".workspace/state/AUTO_HERMES_CONTROLLER.json"),
        roundResultJson: resolveFromRoot(args.roundResultJson || ".workspace/state/AUTO_HERMES_ROUND_RESULT.json"),
        roundResultMd: resolveFromRoot(args.roundResultMd || ".workspace/state/AUTO_HERMES_ROUND_RESULT.md"),
        lastRoundResult: state.lastRoundResult,
        lastRoundResultSignature: state.lastRoundResultSignature,
        runtimeNativeExecution: state.runtimeNativeExecution,
      });
      if (activeClaimKey) releaseTaskClaim({ claimDir: args.claimDir, key: activeClaimKey, ownerId: args.claimOwner });
      activeClaimKey = "";
      persistLoopState({
        status: state.status,
        lastWorkUnitSignature: nextSignature,
        lastRoundResultSignature: state.lastRoundResultSignature,
      });
      break;
    }

    if (nextSignature === signature) {
      const repeatedTaskShowsProgress = shouldTreatRepeatedWorkUnitAsProgress(
        args,
        previousRoundResultSignature,
        latestRoundResultSignature,
      );
      if (repeatedTaskShowsProgress) {
        state.sameWorkUnitStreak = 0;
      } else {
        state.sameWorkUnitStreak += 1;
      }
      if (state.sameWorkUnitStreak >= args.maxSameWorkUnitRepeats) {
        state.status = "stalled-same-work-unit";
        state.currentPhase = "complete";
        state.stopReason = `worker round ${roundIndex} returned to the same selected task ${state.sameWorkUnitStreak} time(s) without meaningful progress evidence or queue exhaustion`;
        state.progressLedger = buildProgressLedger(state, args, postController);
        latestPrompt = renderWorkerPrompt(postController, roundIndex + 1, rtk, {
          contextSnapshotPath: resolveFromRoot(state.contextSnapshotPath),
          progressLedgerPath: resolveFromRoot(state.progressLedgerPath),
          controllerJson: resolveFromRoot(args.controllerJson || ".workspace/state/AUTO_HERMES_CONTROLLER.json"),
          roundResultJson: resolveFromRoot(args.roundResultJson || ".workspace/state/AUTO_HERMES_ROUND_RESULT.json"),
          roundResultMd: resolveFromRoot(args.roundResultMd || ".workspace/state/AUTO_HERMES_ROUND_RESULT.md"),
          lastRoundResult: state.lastRoundResult,
          lastRoundResultSignature: state.lastRoundResultSignature,
          runtimeNativeExecution: state.runtimeNativeExecution,
        });
        if (activeClaimKey) releaseTaskClaim({ claimDir: args.claimDir, key: activeClaimKey, ownerId: args.claimOwner });
        activeClaimKey = "";
        persistLoopState({
          status: state.status,
          lastWorkUnitSignature: nextSignature,
          lastRoundResultSignature: state.lastRoundResultSignature,
        });
        break;
      }
    } else {
      state.sameWorkUnitStreak = 0;
    }

    persistLoopState({
      status: state.status,
      lastWorkUnitSignature: nextSignature,
      lastRoundResultSignature: state.lastRoundResultSignature,
    });

    latestPrompt = renderWorkerPrompt(postController, roundIndex + 1, rtk, {
      contextSnapshotPath: resolveFromRoot(state.contextSnapshotPath),
      progressLedgerPath: resolveFromRoot(state.progressLedgerPath),
      controllerJson: resolveFromRoot(args.controllerJson || ".workspace/state/AUTO_HERMES_CONTROLLER.json"),
      roundResultJson: resolveFromRoot(args.roundResultJson || ".workspace/state/AUTO_HERMES_ROUND_RESULT.json"),
      roundResultMd: resolveFromRoot(args.roundResultMd || ".workspace/state/AUTO_HERMES_ROUND_RESULT.md"),
      lastRoundResult: state.lastRoundResult,
      lastRoundResultSignature: state.lastRoundResultSignature,
      runtimeNativeExecution: state.runtimeNativeExecution,
    });

    if (roundIndex === args.maxRounds) {
      state.status = "max-rounds-reached";
      state.currentPhase = "complete";
      state.stopReason = `reached the configured max rounds (${args.maxRounds}) while work still remained`;
      state.progressLedger = buildProgressLedger(state, args, postController);
      if (activeClaimKey) releaseTaskClaim({ claimDir: args.claimDir, key: activeClaimKey, ownerId: args.claimOwner });
      activeClaimKey = "";
      persistLoopState({
        status: state.status,
        lastWorkUnitSignature: nextSignature,
        lastRoundResultSignature: state.lastRoundResultSignature,
      });
      break;
    }
  }

  if (state.status === "starting") {
    state.status = args.dryRun ? "dry-run-complete" : "loop-complete";
    state.currentPhase = "complete";
    state.stopReason = "loop exited without additional work";
  }

  persistLoopState({ status: state.status });

  if (args.write) writeOutputs(args, state, latestPrompt, latestControllerResult, executor, rtk);

  if (args.json) {
    return {
      state,
      output: `${JSON.stringify(state, null, 2)}\n`,
    };
  }

  return {
    state,
    output: renderLoopMarkdown(state),
  };
}

function main() {
  const { output } = runAutoHermesLoop(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
