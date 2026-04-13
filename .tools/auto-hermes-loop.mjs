#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

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
    humanLoop: ".ai-sync/HUMAN_LOOP.md",
    agentSync: ".ai-sync/AGENT_SYNC.md",
    contextLedger: ".ai-sync/CONTEXT_LEDGER.md",
    loopState: ".ai-sync/LOOP_STATE.md",
    controllerJson: ".ai-sync/AUTO_HERMES_CONTROLLER.json",
    controllerMd: ".ai-sync/AUTO_HERMES_CONTROLLER.md",
    promotionJson: ".ai-sync/AUTO_HERMES_PROMOTION.json",
    promotionMd: ".ai-sync/AUTO_HERMES_PROMOTION.md",
    outputJson: ".ai-sync/AUTO_HERMES_LOOP.json",
    outputMd: ".ai-sync/AUTO_HERMES_LOOP.md",
    coordinatorJson: ".ai-sync/AUTO_HERMES_COORDINATOR.json",
    coordinatorMd: ".ai-sync/AUTO_HERMES_COORDINATOR.md",
    promptFile: ".ai-sync/AUTO_HERMES_NEXT_PROMPT.md",
    executorConfig: ".ai-sync/AUTO_HERMES_EXECUTOR.json",
    executorCommand: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[++i] || args[key];
    }
  }

  return {
    ...args,
    maxRounds: Math.max(1, Number.parseInt(args.maxRounds, 10) || 1),
    maxSameWorkUnitRepeats: Math.max(1, Number.parseInt(args.maxSameWorkUnitRepeats, 10) || 1),
  };
}

function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
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

function loadJsonFile(relPath, fallback = null) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}

function loadExecutorConfig(args) {
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
  if (!config || typeof config.command !== "string" || !config.command.trim()) return null;
  return {
    label: config.label || "config",
    command: config.command.trim(),
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

function runController(args) {
  const helperPath = resolveFromRoot(".tools/auto-hermes-controller.mjs");
  const commandArgs = [
    "--write",
    "--json",
    "--tasks", args.tasks,
    "--human-loop", args.humanLoop,
    "--agent-sync", args.agentSync,
    "--context-ledger", args.contextLedger,
    "--loop-state", args.loopState,
    "--output-json", args.controllerJson,
    "--output-md", args.controllerMd,
  ];
  const stdout = runNodeScript(helperPath, commandArgs, { encoding: "utf8" });
  return JSON.parse(stdout);
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

function renderWorkerPrompt(controllerResult, roundIndex) {
  const files = Array.isArray(controllerResult?.files) && controllerResult.files.length
    ? controllerResult.files.join(" | ")
    : "not specified";
  const roleLines = roleCardsFor(controllerResult);
  const subagentPlan = controllerResult?.subagentPlan || {
    useCodexSubagents: false,
    coordinatorMode: "local-coordinator-only",
    spawnOrder: [],
    parallelGroups: [],
    lanes: [],
    notes: [],
  };
  return [
    "# Auto-Hermes Worker Round",
    "",
    `Round: ${roundIndex}`,
    `Generated: ${nowIso()}`,
    "",
    "Execute exactly one bounded Hermes worker round.",
    "",
    "Specialist role frame:",
    ...roleLines,
    "",
    "Codex subagent dispatch plan:",
    `- use Codex subagents: ${subagentPlan.useCodexSubagents ? "yes" : "no"}`,
    `- coordinator mode: ${subagentPlan.coordinatorMode}`,
    `- spawn order: ${subagentPlan.spawnOrder.length ? subagentPlan.spawnOrder.join(" -> ") : "none"}`,
    `- parallel groups: ${subagentPlan.parallelGroups.length ? subagentPlan.parallelGroups.map((group) => group.join(" + ")).join(" | ") : "none"}`,
    ...subagentPlan.lanes.map((lane) => `- ${lane.agent}: ${lane.mode}, ${lane.ownership}`),
    ...subagentPlan.notes.map((note) => `- note: ${note}`),
    "",
    "Rules:",
    "- Treat this as a single worker round, not a self-loop.",
    "- Read `AGENTS.md`, `.ai-codex/optimized-codex.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, and `.ai-sync/HUMAN_LOOP.md` before editing.",
    "- Use `.ai-sync/AUTO_HERMES_CONTROLLER.json` as the deterministic routing brief.",
    "- If the dispatch plan says to use Codex subagents and they are available, prefer real spawned subagents over keeping those roles implicit.",
    "- Implement only the selected bounded task.",
    "- Verify the round before any live claim.",
    "- Run `.tools/auto-hermes-round-close.mjs --write ...` with the real round details before stopping.",
    "- Do not start another worker round inside this child run.",
    "",
    "Selected work unit:",
    `- Source: ${controllerResult?.source || "none"}`,
    `- Title: ${controllerResult?.title || "none"}`,
    `- Surface: ${controllerResult?.surface || "none"}`,
    `- Files: ${files}`,
    `- Context: ${controllerResult?.context || "none"}`,
    `- Done when: ${controllerResult?.doneWhen || "none"}`,
    `- Verify: ${controllerResult?.verify || "none"}`,
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

function renderLoopMarkdown(state) {
  const lines = [
    "# Auto-Hermes Loop",
    "",
    `Generated: ${state.generatedAt}`,
    `Mode: ${state.mode}`,
    `Status: ${state.status}`,
    `Rounds attempted: ${state.roundsAttempted}`,
    `Rounds completed: ${state.roundsCompleted}`,
    `Same work-unit streak: ${state.sameWorkUnitStreak || 0}`,
    `Executor: ${state.executorLabel || "unconfigured"}`,
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

function buildCoordinatorBrief(state, promptText, latestControllerResult, executor, args) {
  const controllerResult = latestControllerResult || {};
  const subagentPlan = controllerResult.subagentPlan || {
    useCodexSubagents: false,
    coordinatorMode: "local-coordinator-only",
    spawnOrder: [],
    parallelGroups: [],
    lanes: [],
    notes: [],
  };

  let nextAction = "stop";
  let mustNotReplyYet = false;
  if ((state.status === "executor-unconfigured" || state.status === "codex-live-awaiting-coordinator") && args.runtime === "codex-live") {
    nextAction = "codex-coordinator-execute-round";
    mustNotReplyYet = true;
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

  return {
    generatedAt: state.generatedAt,
    runtime: args.runtime,
    status: state.status,
    stopReason: state.stopReason,
    nextAction,
    mustNotReplyYet,
    executorLabel: executor?.label || "",
    currentRound: state.roundsAttempted + 1,
    mode: state.mode,
    workUnit: controllerResult?.title
      ? {
          source: controllerResult.source || "",
          title: controllerResult.title || "",
          surface: controllerResult.surface || "",
          files: Array.isArray(controllerResult.files) ? controllerResult.files : [],
          verify: controllerResult.verify || "",
        }
      : null,
    subagentPlan,
    workerPromptFile: resolveFromRoot(args.promptFile),
    workerPromptPreview: promptText,
  };
}

function renderCoordinatorMarkdown(brief) {
  const lines = [
    "# Auto-Hermes Codex Coordinator",
    "",
    `Generated: ${brief.generatedAt}`,
    `Runtime: ${brief.runtime}`,
    `Status: ${brief.status}`,
    `Next Action: ${brief.nextAction}`,
    `Must Not Reply Yet: ${brief.mustNotReplyYet ? "yes" : "no"}`,
    `Executor: ${brief.executorLabel || "none"}`,
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
      "## Subagent Plan",
      `- use Codex subagents: ${brief.subagentPlan.useCodexSubagents ? "yes" : "no"}`,
      `- coordinator mode: ${brief.subagentPlan.coordinatorMode}`,
      `- spawn order: ${brief.subagentPlan.spawnOrder.length ? brief.subagentPlan.spawnOrder.join(" -> ") : "none"}`,
      `- parallel groups: ${brief.subagentPlan.parallelGroups.length ? brief.subagentPlan.parallelGroups.map((group) => group.join(" + ")).join(" | ") : "none"}`,
      ...brief.subagentPlan.lanes.map((lane) => `- ${lane.agent}: ${lane.mode}, ${lane.ownership}`),
      ...brief.subagentPlan.notes.map((note) => `- note: ${note}`),
      "",
      "## Coordinator Contract",
      "- If next action is `codex-coordinator-execute-round`, the live Codex coordinator should spawn the recommended lanes, integrate results, verify, run round-close, rerun controller/loop owner, and continue without replying to the user yet.",
      "- Stop only when the rerun coordinator brief says `stop` or a real blocker/human gate fires.",
      "",
      `Worker prompt file: ${brief.workerPromptFile}`,
    );
  } else {
    lines.push("## Current Work Unit", "- none");
  }

  return `${lines.join("\n")}\n`;
}

function writeOutputs(args, state, promptText, latestControllerResult, executor) {
  const jsonPath = resolveFromRoot(args.outputJson);
  const mdPath = resolveFromRoot(args.outputMd);
  const coordinatorJsonPath = resolveFromRoot(args.coordinatorJson);
  const coordinatorMdPath = resolveFromRoot(args.coordinatorMd);
  const promptPath = resolveFromRoot(args.promptFile);
  ensureParent(jsonPath);
  ensureParent(mdPath);
  ensureParent(coordinatorJsonPath);
  ensureParent(coordinatorMdPath);
  ensureParent(promptPath);
  fs.writeFileSync(jsonPath, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(mdPath, renderLoopMarkdown(state), "utf8");
  fs.writeFileSync(promptPath, promptText, "utf8");
  const coordinatorBrief = buildCoordinatorBrief(state, promptText, latestControllerResult, executor, args);
  fs.writeFileSync(coordinatorJsonPath, JSON.stringify(coordinatorBrief, null, 2), "utf8");
  fs.writeFileSync(coordinatorMdPath, renderCoordinatorMarkdown(coordinatorBrief), "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const executor = loadExecutorConfig(args);
  const promptPath = resolveFromRoot(args.promptFile);
  const state = {
    generatedAt: nowIso(),
    mode: args.mode,
    roundsAttempted: 0,
    roundsCompleted: 0,
    status: "starting",
    stopReason: "",
    executorLabel: executor?.label || "",
    history: [],
    lastWorkUnit: null,
    sameWorkUnitStreak: 0,
  };

  let latestPrompt = "# Auto-Hermes Worker Round\n\nNo work unit selected yet.\n";
  let latestControllerResult = null;

  for (let roundIndex = 1; roundIndex <= args.maxRounds; roundIndex += 1) {
    const controllerResult = runController(args);
    latestControllerResult = controllerResult;
    const signature = workSignature(controllerResult);
    latestPrompt = renderWorkerPrompt(controllerResult, roundIndex);
    state.lastWorkUnit = controllerResult?.title
      ? {
          title: controllerResult.title,
          surface: controllerResult.surface,
          source: controllerResult.source,
        }
      : null;

    if (controllerResult.loopDecision !== "continue-self-loop") {
      state.status = controllerResult.loopDecision || "stop-exhausted";
      state.stopReason = controllerResult.reason || "controller reported no promotable next round";
      state.history.push({
        round: roundIndex,
        action: "stop",
        title: controllerResult.title || "",
        status: state.status,
      });
      break;
    }

    if (args.mode === "single-round" && roundIndex > 1) {
      state.status = "single-round-complete";
      state.stopReason = "single-round mode only permits one bounded worker round";
      break;
    }

    state.roundsAttempted += 1;
    if (!args.dryRun && !executor) {
      state.status = args.runtime === "codex-live" ? "codex-live-awaiting-coordinator" : "executor-unconfigured";
      state.stopReason = args.runtime === "codex-live"
        ? "live Codex coordinator should execute this round directly using the emitted coordinator brief"
        : "no executor command is configured for unattended worker rounds";
      state.history.push({
        round: roundIndex,
        action: "prepare-only",
        title: controllerResult.title || "",
        status: state.status,
      });
      break;
    }

    if (args.write) writeOutputs(args, state, latestPrompt, latestControllerResult, executor);

    if (!args.dryRun) {
      try {
        runExecutor(executor, controllerResult, promptPath, roundIndex, args);
      } catch (error) {
        state.status = "executor-failed";
        state.stopReason = error instanceof Error ? error.message : "executor command failed";
        state.history.push({
          round: roundIndex,
          action: "execute",
          title: controllerResult.title || "",
          status: state.status,
        });
        break;
      }
    }

      const postController = runController(args);
    latestControllerResult = postController;
    const nextSignature = workSignature(postController);
    state.history.push({
      round: roundIndex,
      action: args.dryRun ? "dry-run" : "execute",
      title: controllerResult.title || "",
      status: postController.loopDecision || "continue-self-loop",
    });
    state.roundsCompleted += 1;

    if (args.mode === "single-round") {
      state.status = "single-round-complete";
      state.stopReason = "single-round mode completed one bounded worker round";
      state.lastWorkUnit = controllerResult?.title
        ? {
            title: controllerResult.title,
            surface: controllerResult.surface,
            source: controllerResult.source,
          }
        : null;
      latestPrompt = renderWorkerPrompt(postController, roundIndex + 1);
      break;
    }

    if (postController.loopDecision !== "continue-self-loop") {
      state.status = postController.loopDecision || "stop-exhausted";
      state.stopReason = postController.reason || "controller reported clean stop after worker round";
      latestPrompt = renderWorkerPrompt(postController, roundIndex + 1);
      break;
    }

    if (nextSignature === signature) {
      state.sameWorkUnitStreak += 1;
      if (state.sameWorkUnitStreak >= args.maxSameWorkUnitRepeats) {
        state.status = "stalled-same-work-unit";
        state.stopReason = `worker round ${roundIndex} returned to the same selected task ${state.sameWorkUnitStreak} time(s) without exhausting the queue`;
        latestPrompt = renderWorkerPrompt(postController, roundIndex + 1);
        break;
      }
    } else {
      state.sameWorkUnitStreak = 0;
    }

    latestPrompt = renderWorkerPrompt(postController, roundIndex + 1);

    if (roundIndex === args.maxRounds) {
      state.status = "max-rounds-reached";
      state.stopReason = `reached the configured max rounds (${args.maxRounds}) while work still remained`;
      break;
    }
  }

  if (state.status === "starting") {
    state.status = args.dryRun ? "dry-run-complete" : "loop-complete";
    state.stopReason = "loop exited without additional work";
  }

  if (args.write) writeOutputs(args, state, latestPrompt, latestControllerResult, executor);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderLoopMarkdown(state));
}

main();
