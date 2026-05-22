#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAutoHermesMax } from "./auto-hermes-max.mjs";
import { computeMergeState, renderMarkdown as renderMergeMarkdown } from "./auto-hermes-max-merge.mjs";
import {
  createAutoHermesSupervisorState,
  evaluateAutoHermesSupervisorRound,
} from "./auto-hermes-supervisor.mjs";
import { runAutoHermesFinish } from "./auto-hermes-finish.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    dryRun: false,
    runtime: "codex-live",
    mode: "adaptive",
    scope: "",
    maxIterations: "12",
    maxSameGoalRepeats: "2",
    tasks: "TASKS.md",
    humanLoop: ".ai-sync/HUMAN_LOOP.md",
    agentSync: ".ai-sync/AGENT_SYNC.md",
    contextLedger: ".ai-sync/CONTEXT_LEDGER.md",
    loopState: ".ai-sync/LOOP_STATE.md",
    liveControllerJson: ".ai-sync/AUTO_HERMES_CONTROLLER.json",
    liveControllerMd: ".ai-sync/AUTO_HERMES_CONTROLLER.md",
    planFile: ".ai-sync/AUTO_HERMES_MAX_PLAN.json",
    outputJson: ".ai-sync/AUTO_HERMES_MAX_LOOP.json",
    outputMd: ".ai-sync/AUTO_HERMES_MAX_LOOP.md",
    briefJson: ".ai-sync/AUTO_HERMES_MAX_LOOP_BRIEF.json",
    briefMd: ".ai-sync/AUTO_HERMES_MAX_LOOP_BRIEF.md",
    coordinatorJson: ".ai-sync/AUTO_HERMES_MAX_COORDINATOR.json",
    coordinatorMd: ".ai-sync/AUTO_HERMES_MAX_COORDINATOR.md",
    lanesDir: ".ai-sync/auto-hermes-max-lanes",
    resultsDir: ".ai-sync/auto-hermes-max-results",
    mergeJson: ".ai-sync/AUTO_HERMES_MAX_MERGE.json",
    mergeMd: ".ai-sync/AUTO_HERMES_MAX_MERGE.md",
    promptFile: ".ai-sync/AUTO_HERMES_MAX_NEXT_PROMPT.md",
    executorConfig: ".ai-sync/AUTO_HERMES_MAX_EXECUTOR.json",
    executorCommand: "",
    omxBridgeJson: ".ai-sync/OMX_AUTO_HERMES_BRIDGE.json",
    maxExecutorRetries: "3",
    executorRetryBackoff: "0,30000,120000",
    push: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--push") args.push = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[++i] || args[key];
    }
  }

  return {
    ...args,
    maxIterations: Math.max(1, Number.parseInt(args.maxIterations, 10) || 1),
    maxSameGoalRepeats: Math.max(1, Number.parseInt(args.maxSameGoalRepeats, 10) || 1),
    maxExecutorRetries: Math.max(0, Number.parseInt(args.maxExecutorRetries, 10) || 3),
    executorRetryBackoff: String(args.executorRetryBackoff).split(",").map(Number).filter((n) => !Number.isNaN(n)),
  };
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

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function applyTemplate(template, values) {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{${key}}`, String(value ?? ""));
  }
  return output;
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

function commandExists(commandName) {
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
    return "";
  }
}

function readJson(relPath, fallback = null) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}

function detectOmxRalphExecutor(args) {
  const bridge = readJson(args.omxBridgeJson, null);
  if (!bridge || bridge.autoReady !== true) return null;

  const loopMapping = String(bridge?.mapping?.loop || "").trim();
  const availableSkills = Array.isArray(bridge?.availableSkills) ? bridge.availableSkills : [];
  const prefersRalph = loopMapping === "$ralph" || availableSkills.includes("ralph");
  if (!prefersRalph) return null;

  const omxCommand = commandExists("omx");
  if (!omxCommand) return null;

  return {
    label: "omx-ralph-max",
    command: `& ${shellQuote(omxCommand)} ralph --no-deslop "Read the bounded /auto-hermes-max worker brief at {promptFile}. Treat {coordinatorJson} as the authoritative parent coordinator brief for {parentGoal}. Execute exactly one parent iteration, including child lane launches, merge arbitration, and post-merge writeback, then stop."`,
  };
}

function detectBundledCodexExecutor() {
  const localCodex = resolveFromRoot(".tools/codex-local.exe");
  if (!fs.existsSync(localCodex)) return null;
  const localCodexHome = resolveFromRoot(".tmp/codex-home");
  const userCodexHome = path.join(process.env.USERPROFILE || process.env.HOME || "", ".codex");
  const authSeedFiles = ["auth.json", "config.toml", "cap_sid", "installation_id"];
  const proxyVars = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy"];
  const seedCommands = authSeedFiles
    .map((name) => {
      const source = path.join(userCodexHome, name);
      const target = path.join(localCodexHome, name);
      return `if (Test-Path ${shellQuote(source)}) { Copy-Item -LiteralPath ${shellQuote(source)} -Destination ${shellQuote(target)} -Force }`;
    })
    .join("; ");
  const clearProxyCommands = proxyVars.map((name) => `$env:${name}=$null`).join("; ");

  return {
    label: "bundled-codex-local-max",
    command: `${clearProxyCommands}; $env:CODEX_HOME=${shellQuote(localCodexHome)}; New-Item -ItemType Directory -Force $env:CODEX_HOME | Out-Null; New-Item -ItemType Directory -Force (Join-Path $env:CODEX_HOME '.tmp') | Out-Null; ${seedCommands}; Get-Content -Raw {promptFile} | & ${shellQuote(localCodex)} exec --full-auto --ephemeral -C {cwd} -`,
  };
}

function loadExecutorConfig(args) {
  if (args.executorCommand) {
    return {
      label: "inline-arg",
      command: args.executorCommand,
    };
  }

  if (process.env.AUTO_HERMES_MAX_EXECUTOR_COMMAND) {
    return {
      label: "env",
      command: process.env.AUTO_HERMES_MAX_EXECUTOR_COMMAND,
    };
  }

  const config = readJson(args.executorConfig, null);
  if (config && typeof config.command === "string" && config.command.trim()) {
    return {
      label: config.label || "config",
      command: config.command.trim(),
    };
  }

  return detectOmxRalphExecutor(args) || detectBundledCodexExecutor();
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

function runPlanner(args, { write = true } = {}) {
  return runAutoHermesMax({
    write,
    json: true,
    runtime: args.runtime,
    scope: args.scope,
    mode: args.mode,
    tasks: args.tasks,
    humanLoop: args.humanLoop,
    agentSync: args.agentSync,
    contextLedger: args.contextLedger,
    loopState: args.loopState,
    liveControllerJson: args.liveControllerJson,
    liveControllerMd: args.liveControllerMd,
    planFile: args.planFile,
    coordinatorJson: args.coordinatorJson,
    coordinatorMd: args.coordinatorMd,
    lanesDir: args.lanesDir,
    resultsDir: args.resultsDir,
    mergeJson: args.mergeJson,
    mergeMd: args.mergeMd,
  }).state;
}

function runMergeRefresh(args) {
  try {
    const coordinatorPath = resolveFromRoot(args.coordinatorJson);
    const mergeJsonPath = resolveFromRoot(args.mergeJson);
    const mergeMdPath = resolveFromRoot(args.mergeMd);
    if (!fs.existsSync(coordinatorPath)) return;
    const coordinator = JSON.parse(fs.readFileSync(coordinatorPath, "utf8"));
    const mergeState = computeMergeState(coordinator);
    ensureParent(mergeJsonPath);
    ensureParent(mergeMdPath);
    fs.writeFileSync(mergeJsonPath, JSON.stringify(mergeState, null, 2), "utf8");
    fs.writeFileSync(mergeMdPath, renderMergeMarkdown(mergeState), "utf8");
  } catch {
    // Keep loop state observable even when merge refresh cannot run.
  }
}

function renderWorkerPrompt(plannerState, iterationIndex, args) {
  return [
    "# Auto-Hermes Max Worker Iteration",
    "",
    `Iteration: ${iterationIndex}`,
    `Parent Goal: ${plannerState.parentGoal || "unknown"}`,
    `Parent Run Id: ${plannerState.parentRunId || "unknown"}`,
    `Plan Source: ${plannerState.planSource || "controller-derived"}`,
    `Selection Rationale: ${plannerState.selectionRationale || "none"}`,
    ...(plannerState.websiteAudit?.attempted
      ? [`Website Audit Summary: ${plannerState.websiteAudit.summary || "none"}`]
      : []),
    "",
    "## Parent Contract",
    "- Execute exactly one /auto-hermes-max parent iteration, then stop.",
    "- Treat `.ai-sync/AUTO_HERMES_MAX_COORDINATOR.json` and `.ai-sync/AUTO_HERMES_MAX_COORDINATOR.md` as the authoritative parent coordinator state.",
    "- Use the launch decision card from the coordinator brief to decide which lanes actually run this iteration.",
    "- Treat audit-generated fallback work exactly like a normal first parent goal when it appears in the coordinator brief.",
    ...(plannerState.websiteAudit?.usedFallback
      ? ["- This parent goal came from the website-audit fallback because the controller reported no promotable work."]
      : []),
    "- Every launched child lane must run a full /auto-hermes loop within its owned files until that owned scope is exhausted.",
    "- Prefer the Ralph-backed /auto-hermes loop owner for child lanes when the OMX bridge maps loop -> $ralph; otherwise use the emitted /auto-hermes loop owner for this repo.",
    "- If multiple lanes are selected and real parallel child execution is available, use it. If not, run the selected lanes sequentially without widening ownership.",
    "- Each child lane must write its final result packet to the lane result file named in its lane brief before the parent continues.",
    "- After all launched lanes finish, run `node .tools/auto-hermes-max-merge.mjs --write`.",
    "- If the merge verdict is `arbitration-required-before-merge`, resolve every conflict autonomously, rerun the merge helper, and do not stop until the merge brief is no longer waiting on pending coordinator decisions.",
    "- If the merged verdict is `must-fix-before-merge-complete` or `blocked`, leave the next unresolved work in TASKS.md/.ai-sync state, then stop this parent iteration. The outer max loop owner will reassess.",
    "- If the merged verdict is `approve-merge`, refresh the queue/context writeback through the existing lane and merge helpers, then stop this parent iteration cleanly.",
    "",
    "## Inputs",
    `- Parent coordinator brief: ${resolveFromRoot(args.coordinatorMd)}`,
    `- Parent coordinator JSON: ${resolveFromRoot(args.coordinatorJson)}`,
    `- Lane briefs directory: ${resolveFromRoot(args.lanesDir)}`,
    `- Merge brief: ${resolveFromRoot(args.mergeMd)}`,
    `- Merge JSON: ${resolveFromRoot(args.mergeJson)}`,
    ...(plannerState.websiteAudit?.usedFallback
      ? [
          `- Website audit candidate: ${plannerState.websiteAudit.candidate?.surface || "unknown"} :: ${(plannerState.websiteAudit.candidate?.files || []).join(" | ") || "none"}`,
        ]
      : []),
    "",
    "## Stop Condition",
    "- Stop after one parent iteration only. Do not reply to the user. The outer max loop owner decides whether another parent iteration is needed.",
  ].join("\n") + "\n";
}

function runExecutor(executor, plannerState, promptPath, iterationIndex, args) {
  const command = applyTemplate(executor.command, {
    cwd: shellQuote(ROOT),
    promptFile: shellQuote(promptPath),
    iteration: String(iterationIndex),
    parentGoal: shellQuote(plannerState.parentGoal || ""),
    coordinatorJson: shellQuote(resolveFromRoot(args.coordinatorJson)),
    mergeJson: shellQuote(resolveFromRoot(args.mergeJson)),
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

function runExecutorWithRetry(executor, plannerState, promptPath, iterationIndex, args) {
  let lastError = null;
  for (let attempt = 1; attempt <= args.maxExecutorRetries; attempt += 1) {
    if (attempt > 1) {
      const delayIndex = attempt - 1;
      const delay = delayIndex < args.executorRetryBackoff.length
        ? args.executorRetryBackoff[delayIndex]
        : args.executorRetryBackoff[args.executorRetryBackoff.length - 1] || 0;
      if (!args.dryRun && delay > 0) sleepSync(delay);
    }

    if (args.dryRun) return { success: true, attempt };

    try {
      runExecutor(executor, plannerState, promptPath, iterationIndex, args);
      return { success: true, attempt };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError || "executor command failed"),
  };
}

function goalSignature(plannerState) {
  return String(plannerState?.parentGoal || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderLoopMarkdown(state) {
  const lines = [
    "# Auto-Hermes Max Loop",
    "",
    `Generated: ${state.generatedAt}`,
    `Runtime: ${state.runtime}`,
    `Status: ${state.status}`,
    `Iterations attempted: ${state.iterationsAttempted}`,
    `Iterations completed: ${state.iterationsCompleted}`,
    `Same goal streak: ${state.sameGoalStreak || 0}`,
    `Executor: ${state.executorLabel || "unconfigured"}`,
    "",
  ];

  if (state.stopReason) lines.push(`Stop reason: ${state.stopReason}`, "");
  if (state.lastParentGoal) lines.push(`Last parent goal: ${state.lastParentGoal}`, "");
  if (state.supervisorState) {
    lines.push(
      `Supervisor Decision: ${state.supervisorState.decision}`,
      `Supervisor Empty Audit Count: ${state.supervisorState.repeatedNoCandidateAuditRounds}`,
      "",
    );
  }

  lines.push("## History");
  if (!state.history.length) {
    lines.push("- none");
  } else {
    for (const item of state.history) {
      lines.push(`- iteration ${item.iteration}: ${item.action} :: ${item.parentGoal || "none"} (${item.status})`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function buildLoopBrief(state, plannerState, executor, args) {
  let nextAction = "stop";
  let mustNotReplyYet = false;

  if (state.status === "running" && executor) {
    nextAction = "max-loop-owner-running";
    mustNotReplyYet = true;
  } else if (
    executor &&
    (state.status === "starting" || state.status === "dry-run-complete" || state.status === "loop-complete" || state.status === "max-iterations-reached")
  ) {
    nextAction = plannerState?.nextAction && plannerState.nextAction !== "stop"
      ? "max-loop-owner-execute-iteration"
      : "stop";
    mustNotReplyYet = nextAction !== "stop";
  } else if (args.runtime === "codex-live" && (state.status === "executor-unconfigured" || state.status === "codex-live-awaiting-coordinator")) {
    nextAction = plannerState?.nextAction && plannerState.nextAction !== "stop"
      ? "codex-max-coordinator-execute-iteration"
      : "stop";
    mustNotReplyYet = nextAction !== "stop";
  }

  return {
    generatedAt: state.generatedAt,
    runtime: args.runtime,
    status: state.status,
    stopReason: state.stopReason,
    nextAction,
    mustNotReplyYet,
    executorLabel: executor?.label || "",
    currentIteration: state.iterationsAttempted + 1,
    parentGoal: plannerState?.parentGoal || "",
    selectedLaneCount: plannerState?.selectedLaneCount || 0,
    selectionRationale: plannerState?.selectionRationale || "",
    planSource: plannerState?.planSource || "controller-derived",
    websiteAudit: plannerState?.websiteAudit || null,
    workerPromptFile: resolveFromRoot(args.promptFile),
    coordinatorJson: resolveFromRoot(args.coordinatorJson),
    coordinatorMd: resolveFromRoot(args.coordinatorMd),
    mergeJson: resolveFromRoot(args.mergeJson),
    mergeMd: resolveFromRoot(args.mergeMd),
  };
}

function writeOutputs(args, state, plannerState, executor, promptText) {
  const jsonPath = resolveFromRoot(args.outputJson);
  const mdPath = resolveFromRoot(args.outputMd);
  const promptPath = resolveFromRoot(args.promptFile);
  const briefJsonPath = resolveFromRoot(args.briefJson);
  const briefMdPath = resolveFromRoot(args.briefMd);
  ensureParent(jsonPath);
  ensureParent(mdPath);
  ensureParent(promptPath);
  ensureParent(briefJsonPath);
  ensureParent(briefMdPath);
  fs.writeFileSync(jsonPath, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(mdPath, renderLoopMarkdown(state), "utf8");
  fs.writeFileSync(promptPath, promptText, "utf8");

  const brief = buildLoopBrief(state, plannerState, executor, args);
  fs.writeFileSync(briefJsonPath, JSON.stringify(brief, null, 2), "utf8");
  fs.writeFileSync(
    briefMdPath,
    [
      "# Auto-Hermes Max Loop Brief",
      "",
      `Generated: ${brief.generatedAt}`,
      `Runtime: ${brief.runtime}`,
      `Status: ${brief.status}`,
      `Next Action: ${brief.nextAction}`,
      `Must Not Reply Yet: ${brief.mustNotReplyYet ? "yes" : "no"}`,
      `Executor: ${brief.executorLabel || "none"}`,
      `Current Iteration: ${brief.currentIteration}`,
      `Parent Goal: ${brief.parentGoal || "none"}`,
      `Selected Lane Count: ${brief.selectedLaneCount}`,
      `Plan Source: ${brief.planSource}`,
      `Selection Rationale: ${brief.selectionRationale || "none"}`,
      ...(brief.websiteAudit?.usedFallback
        ? [
            `Website Audit: ${brief.websiteAudit.status || "fallback-selected"}`,
            `Website Audit Summary: ${brief.websiteAudit.summary || "none"}`,
          ]
        : []),
      `Worker Prompt File: ${brief.workerPromptFile}`,
      `Coordinator JSON: ${brief.coordinatorJson}`,
      `Merge JSON: ${brief.mergeJson}`,
      ...(brief.stopReason ? ["", `Stop reason: ${brief.stopReason}`] : []),
      "",
      "The max-loop owner is authoritative for parent re-entry. `prepared` is not `executing`.",
      "",
    ].join("\n"),
    "utf8",
  );
}

function shouldExecuteMaxFinishCommit(state, args) {
  if (args.dryRun) return false;
  return state.status === "loop-complete" || state.status === "stop-exhausted";
}

function shouldExecuteMaxFinishPush(state, args) {
  return Boolean(args.push) && shouldExecuteMaxFinishCommit(state, args);
}

function runMaxFinishHelper(state, args) {
  try {
    runAutoHermesFinish({
      write: true,
      commit: shouldExecuteMaxFinishCommit(state, args),
      push: Boolean(args.push),
      autoPushWhenNeeded: true,
      task: state.lastParentGoal || state.stopReason || "auto-hermes-max loop stop",
      surface: "auto-hermes-max",
      summary: state.stopReason || state.lastParentGoal || "",
      outputJson: ".ai-sync/AUTO_HERMES_MAX_FINISH.json",
      outputMd: ".ai-sync/AUTO_HERMES_MAX_FINISH.md",
    });
  } catch {
    // Finish briefs must not block max-loop state writeback.
  }
}

export function runAutoHermesMaxLoop(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  const executor = loadExecutorConfig(args);
  let supervisorState = createAutoHermesSupervisorState({ mode: "auto-hermes-max" });
  const state = {
    generatedAt: nowIso(),
    runtime: args.runtime,
    mode: args.mode,
    status: "starting",
    stopReason: "",
    executorLabel: executor?.label || "",
    iterationsAttempted: 0,
    iterationsCompleted: 0,
    sameGoalStreak: 0,
    lastParentGoal: "",
    supervisorState,
    history: [],
  };

  let plannerState = null;
  let promptText = "# Auto-Hermes Max Worker Iteration\n\nNo parent goal selected yet.\n";

  for (let iteration = 1; iteration <= args.maxIterations; iteration += 1) {
    plannerState = runPlanner(args, { write: true });

    if (!plannerState?.nextAction || plannerState.nextAction === "stop" || !plannerState.selectedLaneCount) {
      const queueState = plannerState?.websiteAudit?.queueState?.status === "confirmed-empty"
        ? "empty"
        : plannerState?.websiteAudit?.queueState?.status === "non-empty"
          ? "available"
          : "unknown";
      const websiteAuditStatus = plannerState?.websiteAudit?.status === "no-candidate"
        ? "no-candidate"
        : plannerState?.websiteAudit?.usedFallback
          ? "candidate"
          : plannerState?.websiteAudit?.attempted
            ? "pending"
            : "skipped";

      supervisorState = evaluateAutoHermesSupervisorRound({
        state: supervisorState,
        queueState,
        websiteAuditStatus,
        summary: plannerState?.websiteAudit?.summary || plannerState?.selectionRationale || "",
      });
      state.supervisorState = supervisorState;

      const shouldContinueAuditFallback =
        queueState === "empty" &&
        websiteAuditStatus === "no-candidate" &&
        supervisorState.decision === "continue" &&
        iteration < args.maxIterations;

      if (shouldContinueAuditFallback) {
        state.history.push({
          iteration,
          action: "audit-empty",
          parentGoal: plannerState?.parentGoal || "",
          status: "audit-retry-armed",
        });
        continue;
      }

      state.status = "stop-exhausted";
      state.stopReason = queueState === "empty" && websiteAuditStatus === "no-candidate"
        ? (supervisorState.stop
            ? "controller reported repeated website-audit exhaustion"
            : plannerState?.selectionRationale || "No promotable parent iteration remained.")
        : plannerState?.selectionRationale || "No promotable parent iteration remained.";
      state.history.push({
        iteration,
        action: queueState === "empty" && websiteAuditStatus === "no-candidate" ? "audit-empty" : "stop",
        parentGoal: plannerState?.parentGoal || "",
        status: state.status,
      });
      break;
    }

    promptText = renderWorkerPrompt(plannerState, iteration, args);
    state.iterationsAttempted += 1;
    state.lastParentGoal = plannerState.parentGoal || "";

    if (args.dryRun) {
      state.status = "dry-run-complete";
      state.stopReason = "dry-run refreshed the parent iteration brief without executing it";
      state.history.push({
        iteration,
        action: "dry-run",
        parentGoal: plannerState.parentGoal || "",
        status: state.status,
      });
      break;
    }

    if (!executor) {
      state.status = args.runtime === "codex-live" ? "codex-live-awaiting-coordinator" : "executor-unconfigured";
      state.stopReason = "no Ralph-capable executor is configured for unattended /auto-hermes-max iterations";
      state.history.push({
        iteration,
        action: "prepare-only",
        parentGoal: plannerState.parentGoal || "",
        status: state.status,
      });
      break;
    }

    state.status = "running";
    if (args.write) writeOutputs(args, state, plannerState, executor, promptText);

    const executorResult = runExecutorWithRetry(executor, plannerState, resolveFromRoot(args.promptFile), iteration, args);
    if (!executorResult.success) {
      state.status = "executor-unavailable";
      state.stopReason = executorResult.error || "executor unavailable";
      state.history.push({
        iteration,
        action: "execute",
        parentGoal: plannerState.parentGoal || "",
        status: state.status,
      });
      break;
    }

    runMergeRefresh(args);
    state.iterationsCompleted += 1;
    state.history.push({
      iteration,
      action: "execute",
      parentGoal: plannerState.parentGoal || "",
      status: "iteration-complete",
    });

    const nextPlanner = runPlanner(args, { write: false });
    const nextSignature = goalSignature(nextPlanner);
    const currentSignature = goalSignature(plannerState);
    if (nextSignature && nextSignature === currentSignature) {
      state.sameGoalStreak += 1;
      if (state.sameGoalStreak >= args.maxSameGoalRepeats) {
        state.status = "stalled-same-parent-goal";
        state.stopReason = `max loop returned to the same parent goal ${state.sameGoalStreak} time(s) without moving to a fresh iteration`;
        plannerState = nextPlanner;
        promptText = renderWorkerPrompt(plannerState, iteration + 1, args);
        break;
      }
    } else {
      state.sameGoalStreak = 0;
    }

    plannerState = nextPlanner;
    promptText = renderWorkerPrompt(plannerState, iteration + 1, args);

    if (plannerState?.nextAction === "stop" || !plannerState?.selectedLaneCount) {
      state.status = "loop-complete";
      state.stopReason = plannerState?.selectionRationale || "No further parent iteration remained after reassessment.";
      break;
    }

    if (iteration === args.maxIterations) {
      state.status = "max-iterations-reached";
      state.stopReason = `reached the configured max parent iterations (${args.maxIterations}) while work still remained`;
      break;
    }
  }

  if (state.status === "starting") {
    state.status = args.dryRun ? "dry-run-complete" : "loop-complete";
    state.stopReason = "max loop exited without additional work";
  }

  if (args.write) {
    writeOutputs(args, state, plannerState, executor, promptText);
    runMaxFinishHelper(state, args);
  }

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
  const { output } = runAutoHermesMaxLoop(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
