#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAutoHermesLoop } from "./auto-hermes-loop.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const SELF_LOOP_CONTRACT = "true Ralph self-loop version of /auto-hermes";
const PRACTICAL_FOREVER_ROUNDS = Number.MAX_SAFE_INTEGER;

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    dryRun: false,
    runtime: "generic",
    executorCommand: "",
    maxRounds: "",
    maxSameWorkUnitRepeats: "",
    tasks: "",
    humanLoop: "",
    agentSync: "",
    contextLedger: "",
    loopState: "",
    traceToSkillJson: "",
    claimDir: "",
    claimOwner: "",
    claimTtlMinutes: "",
    controllerJson: "",
    controllerMd: "",
    promotionJson: "",
    promotionMd: "",
    outputJson: "",
    outputMd: "",
    coordinatorJson: "",
    coordinatorMd: "",
    promptFile: "",
    executorConfig: "",
    omxBridgeJson: "",
    loopStateJson: "",
    roundResultJson: "",
    roundResultMd: "",
    maxExecutorRetries: "",
    executorRetryBackoff: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[i + 1] || args[key];
      if (key in args) i += 1;
    }
  }

  return args;
}

function applySelfDefaults(rawArgs = {}) {
  return {
    ...rawArgs,
    mode: "self-ralph",
    tasks: rawArgs.tasks || "TASKS.md",
    humanLoop: rawArgs.humanLoop || ".ai-sync/HUMAN_LOOP.md",
    agentSync: rawArgs.agentSync || ".ai-sync/AGENT_SYNC.md",
    contextLedger: rawArgs.contextLedger || ".ai-sync/CONTEXT_LEDGER.md",
    loopState: rawArgs.loopState || ".ai-sync/LOOP_STATE.md",
    maxRounds: rawArgs.maxRounds || String(PRACTICAL_FOREVER_ROUNDS),
    controllerJson: rawArgs.controllerJson || ".ai-sync/AUTO_HERMES_SELF_CONTROLLER.json",
    controllerMd: rawArgs.controllerMd || ".ai-sync/AUTO_HERMES_SELF_CONTROLLER.md",
    promotionJson: rawArgs.promotionJson || ".ai-sync/AUTO_HERMES_SELF_PROMOTION.json",
    promotionMd: rawArgs.promotionMd || ".ai-sync/AUTO_HERMES_SELF_PROMOTION.md",
    outputJson: rawArgs.outputJson || ".ai-sync/AUTO_HERMES_SELF_LOOP.json",
    outputMd: rawArgs.outputMd || ".ai-sync/AUTO_HERMES_SELF_LOOP.md",
    coordinatorJson: rawArgs.coordinatorJson || ".ai-sync/AUTO_HERMES_SELF_COORDINATOR.json",
    coordinatorMd: rawArgs.coordinatorMd || ".ai-sync/AUTO_HERMES_SELF_COORDINATOR.md",
    promptFile: rawArgs.promptFile || ".ai-sync/AUTO_HERMES_SELF_NEXT_PROMPT.md",
    loopStateJson: rawArgs.loopStateJson || ".ai-sync/AUTO_HERMES_SELF_LOOP_STATE.json",
    roundResultJson: rawArgs.roundResultJson || ".ai-sync/AUTO_HERMES_SELF_ROUND_RESULT.json",
    roundResultMd: rawArgs.roundResultMd || ".ai-sync/AUTO_HERMES_SELF_ROUND_RESULT.md",
  };
}
function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function decoratePrompt(promptText) {
  const header = [
    "# Auto-Hermes Self Loop",
    "",
    "This is the true Ralph self-loop version of `/auto-hermes`.",
    "Keep iterating until a real stop gate fires.",
    "If no promotable task exists, use the standard find-the-task path: promote queue candidates when present, otherwise seed suggestions, then use the website-audit fallback before stopping.",
    "",
  ].join("\n");

  if (String(promptText || "").includes("# Auto-Hermes Self Loop")) return String(promptText || "");
  return `${header}${String(promptText || "")}`;
}

function renderSelfLoopMarkdown(state) {
  const lines = [
    "# Auto-Hermes Self Loop",
    "",
    `Generated: ${state.generatedAt}`,
    `Mode: ${state.mode}`,
    `Status: ${state.status}`,
    `Loop Contract: ${state.loopContract}`,
    `Unbounded: ${state.unbounded ? "yes" : "no"}`,
    `Rounds attempted: ${state.roundsAttempted}`,
    `Rounds completed: ${state.roundsCompleted}`,
    `Executor: ${state.executorLabel || "unconfigured"}`,
    `Last round result signature: ${state.lastRoundResultSignature || "none"}`,
    "",
    "This is the true Ralph self-loop version of `/auto-hermes`.",
    "It keeps iterating until a real stop gate fires instead of treating a bounded round as the finish state.",
  ];

  if (state.stopReason) lines.push("", `Stop reason: ${state.stopReason}`);
  if (state.lastWorkUnit?.title) {
    lines.push(
      "",
      "## Last Work Unit",
      `- Title: ${state.lastWorkUnit.title}`,
      `- Surface: ${state.lastWorkUnit.surface || "none"}`,
      `- Source: ${state.lastWorkUnit.source || "none"}`,
    );
  }

  if (state.lastRoundResult) {
    lines.push(
      "",
      "## Previous Round Carry-Forward",
      `- Task: ${state.lastRoundResult.task || "none"}`,
      `- Surface: ${state.lastRoundResult.surface || "none"}`,
      `- Verdict: ${state.lastRoundResult.verdict || "none"}`,
      `- Review: ${state.lastRoundResult.review || "none"}`,
      `- Blocker: ${state.lastRoundResult.blocker || "none"}`,
      `- Ralph gate: ${state.lastRoundResult.ralphGate?.summary || "none"}`,
    );
  }

  lines.push(
    "",
    "## Ralph Contract",
    "- Keep iterating until a real stop gate fires.",
    "- If there is a task, execute the next bounded round.",
    "- If there is no task, use the standard find-the-task path before stopping.",
    "- Website-audit fallback remains part of the discovery path, not a separate command family.",
  );

  return `${lines.join("\n")}\n`;
}

function writeSelfArtifacts(args, state) {
  const outputJsonPath = resolveFromRoot(args.outputJson);
  const outputMdPath = resolveFromRoot(args.outputMd);
  const coordinatorJsonPath = resolveFromRoot(args.coordinatorJson);
  const coordinatorMdPath = resolveFromRoot(args.coordinatorMd);
  const promptPath = resolveFromRoot(args.promptFile);
  const loopStateJsonPath = resolveFromRoot(args.loopStateJson);

  ensureParent(outputJsonPath);
  ensureParent(outputMdPath);
  ensureParent(coordinatorJsonPath);
  ensureParent(coordinatorMdPath);
  ensureParent(promptPath);
  ensureParent(loopStateJsonPath);

  fs.writeFileSync(outputJsonPath, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(outputMdPath, renderSelfLoopMarkdown(state), "utf8");

  const promptText = decoratePrompt(fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf8") : "");
  fs.writeFileSync(promptPath, promptText, "utf8");

  const coordinator = safeReadJson(coordinatorJsonPath) || {};
  const decoratedCoordinator = {
    ...coordinator,
    mode: state.mode,
    unbounded: true,
    maxRounds: null,
    loopContract: SELF_LOOP_CONTRACT,
    commandName: "/auto-hermes-self",
  };
  fs.writeFileSync(coordinatorJsonPath, JSON.stringify(decoratedCoordinator, null, 2), "utf8");

  const coordinatorMd = [
    "# Auto-Hermes Self Coordinator",
    "",
    `Generated: ${state.generatedAt}`,
    `Runtime: ${decoratedCoordinator.runtime || state.runtime || "generic"}`,
    `Status: ${decoratedCoordinator.status || state.status}`,
    `Next Action: ${decoratedCoordinator.nextAction || "stop"}`,
    `Loop Contract: ${SELF_LOOP_CONTRACT}`,
    `Unbounded: yes`,
    "",
    "This is the true Ralph self-loop version of `/auto-hermes`.",
    "Keep iterating until a real stop gate fires.",
    "If the queue is empty, use the standard find-the-task path before stopping, including the website-audit fallback when the controller reports no promotable work.",
    "",
    `Worker Prompt File: ${promptPath}`,
  ].join("\n");
  fs.writeFileSync(coordinatorMdPath, `${coordinatorMd}\n`, "utf8");

  const persistedState = safeReadJson(loopStateJsonPath) || {};
  fs.writeFileSync(loopStateJsonPath, JSON.stringify({
    ...persistedState,
    mode: state.mode,
    unbounded: true,
    maxRounds: null,
    loopContract: SELF_LOOP_CONTRACT,
  }, null, 2), "utf8");
}

function normalizeResult(result, args) {
  const state = {
    ...result.state,
    mode: "self-ralph",
    unbounded: true,
    maxRounds: null,
    loopContract: SELF_LOOP_CONTRACT,
    commandName: "/auto-hermes-self",
  };

  if (args.write) {
    writeSelfArtifacts(args, state);
  }

  return {
    state,
    output: args.json
      ? `${JSON.stringify(state, null, 2)}\n`
      : renderSelfLoopMarkdown(state),
  };
}

export function runAutoHermesSelfLoop(rawArgs = process.argv.slice(2)) {
  const parsedArgs = Array.isArray(rawArgs) ? parseArgs(rawArgs) : rawArgs;
  const args = applySelfDefaults(parsedArgs || {});
  const result = runAutoHermesLoop(args);
  return normalizeResult(result, args);
}

function main() {
  const { output } = runAutoHermesSelfLoop(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
