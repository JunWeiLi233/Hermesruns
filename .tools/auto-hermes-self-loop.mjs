#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAutoHermesLoop } from "./auto-hermes-loop.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const SELF_LOOP_CONTRACT = "true Ralph self-loop version of /auto-hermes";
const PRACTICAL_FOREVER_ROUNDS = Number.MAX_SAFE_INTEGER;
const DEFAULT_SELF_RUNTIME = "codex";
const DEFAULT_SAME_WORK_UNIT_REPEATS = "3";
const DEFAULT_EXECUTOR_RETRIES = "3";
const DEFAULT_EXECUTOR_RETRY_BACKOFF = "0,30000,120000";
const DEFAULT_SELF_REENTRY_LIMIT = "12";
const CLAUDE_CODE_TEAM_AGENT_POLICY = {
  runtime: "claude",
  agentOwner: "Claude Code",
  agentLabel: "Claude Code specialist team agents",
  model: "claude-sonnet-4-6",
  modelPolicy: "use Claude Code Agent tool with specialist subagents (frontend-agent, backend-agent, code-reviewer, QA Agent, debugger) for team-based bounded round execution",
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
};

const CODEX_LIVE_CHILD_AGENT_POLICY = {
  runtime: "codex-live",
  agentOwner: "Codex",
  agentLabel: "Codex live child agents",
  model: "gpt-5.5",
  reasoningEffort: "medium",
  modelPolicy: "use GPT-5.5 with medium reasoning effort for Codex live child agents",
  executorPolicy: "native-runtime-agents-only",
  codexFallbackAllowed: false,
  fallback: "If child-agent delegation is unavailable, the live Codex coordinator executes the bounded round directly while preserving the same GPT-5.5 medium-thinking policy.",
};
const RALPH_LOOP_STRENGTH = {
  mode: "strict-ralph-loop",
  completionPromise: "continue until a real stop gate fires; never treat one successful bounded round as natural completion; the configured executor-backed runtime must actively re-enter the loop after each round",
  requiredRoundEvidence: [
    "verify-result pass with fresh command evidence",
    "runtime-proof pass when source changes affect a live/runtime surface",
    "architect-verdict approved",
    "deslop-pass pass or explicit skip",
    "regression-pass pass after deslop",
    "round-close writeback with result packet",
  ],
  stopGates: [
    "human-loop pause/stop/must-ask",
    "repeated no-candidate website-audit exhaustion",
    "same work unit repeats without new round-result evidence",
    "course-map extraction mission proof: live non-empty routePoints render on the runner OpenStreetMap; city-level-only references do not qualify",
    "executor unavailable after configured retries",
    "unsafe or irreversible recovery requires human input",
    "Ralph loop integrity broken and unrepairable in-process (loop-critical files corrupted beyond minimal fix, requires human restore)",
  ],
  repeatedWorkUnitPolicy: "carry forward last round-result evidence; reset same-task stall history only when the result signature changes",
  claudeSelfExecution: {
    enabled: true,
    description: "Claude Code is the active executor — not just a brief-preparer. The parent Claude session initializes state, dispatches the specialist team for each bounded round, collects results, runs the merge gate, writes round-close, and immediately re-enters the loop without waiting for user input.",
    loopBody: [
      "read coordinator brief for current work unit",
      "read controller JSON for subagent plan and route",
      "run pre-round Ralph integrity gate (check previous task did not break loop-critical files)",
      "dispatch specialist agents per team model (parallel where safe, sequential for review/QA gates)",
      "collect specialist results and run merge gate",
      "execute verification from task Verify field",
      "run post-round Ralph integrity fix if pre-round gate found breakage",
      "run round-close with real evidence (pass or fail verdict, include ralph-integrity-fix if applied)",
      "re-run self-loop script to refresh state",
      "if Next Action is claude-execute-round: go to step 1 immediately",
      "if Next Action is stop: report reason, run finish actions, stop",
    ],
    contextPressurePolicy: "if approaching token limits mid-loop, complete current round-close then use ScheduleWakeup(delaySeconds=60, prompt='/auto-hermes-self') to re-enter with fresh context",
  },
  ralphIntegrityGate: {
    enabled: true,
    description: "Before every round, verify the Ralph self-loop ability is intact. If the previous task changed loop-critical files and broke the loop, fix it before proceeding.",
    loopCriticalFiles: [
      ".codex/commands/auto-hermes-self.md",
      ".claude/commands/auto-hermes-self.md",
      ".tools/auto-hermes-self-loop.mjs",
      ".tools/auto-hermes-loop.mjs",
    ],
    checks: [
      {
        id: "last-round-touched-loop-files",
        description: "Check if the last round's changed files include any loop-critical files. If none were touched, skip remaining checks.",
        command: "read .ai-sync/AUTO_HERMES_SELF_ROUND_RESULT.json and inspect changed files",
      },
      {
        id: "script-parse-check",
        description: "Verify both loop scripts parse without syntax errors.",
        command: "node --check .tools/auto-hermes-self-loop.mjs && node --check .tools/auto-hermes-loop.mjs",
      },
      {
        id: "contract-check",
        description: "Verify the self execution contract matches the selected runtime.",
        command: "node .tools/auto-hermes-self-loop.mjs --write --runtime <runtime> --dry-run; verify selfExecutionContract matches the selected runtime in .ai-sync/AUTO_HERMES_SELF_LOOP.json",
      },
      {
        id: "protocol-check",
        description: "Verify the coordinator brief still contains the active execution protocol.",
        command: "grep 'Self-Loop Protocol (Active Execution)' .ai-sync/AUTO_HERMES_SELF_COORDINATOR.md",
      },
    ],
    fixPolicy: {
      timing: "post-round",
      description: "If any integrity check fails, apply the minimal fix at the end of the current round (Step 5b) before round-close. Record the fix in round-close evidence as 'ralph-integrity-fix: <files> — <what was fixed>'.",
      rule: "Fix exactly what broke — do not redesign the loop mechanism. Restore the previous working state of loop-critical files.",
      mustFixNow: true,
    },
  },
};

function normalizeRuntime(runtime) {
  return String(runtime || "").trim().toLowerCase();
}

function resolveSelfRuntimeNativeExecution(runtime, existing = null) {
  if (existing) return existing;
  const normalized = normalizeRuntime(runtime);
  if (normalized === "claude") return { ...CLAUDE_CODE_TEAM_AGENT_POLICY };
  if (normalized === "codex-live") return { ...CODEX_LIVE_CHILD_AGENT_POLICY };
  return null;
}

function resolveSelfExecutionContract(runtime) {
  const normalized = normalizeRuntime(runtime || DEFAULT_SELF_RUNTIME);
  if (normalized === "codex-live") return "coordinator-awaiting";
  if (normalized === "claude") return "claude-self-executing";
  if (["gemini", "opencode"].includes(normalized)) return "native-runtime-owned";
  return "executor-backed";
}

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    dryRun: false,
    runtime: DEFAULT_SELF_RUNTIME,
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
    maxSelfReentries: "",
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
    runtime: rawArgs.runtime || DEFAULT_SELF_RUNTIME,
    tasks: rawArgs.tasks || "TASKS.md",
    humanLoop: rawArgs.humanLoop || ".ai-sync/HUMAN_LOOP.md",
    agentSync: rawArgs.agentSync || ".ai-sync/AGENT_SYNC.md",
    contextLedger: rawArgs.contextLedger || ".ai-sync/CONTEXT_LEDGER.md",
    loopState: rawArgs.loopState || ".ai-sync/LOOP_STATE.md",
    traceToSkillJson: rawArgs.traceToSkillJson || ".ai-sync/AUTO_HERMES_SELF_TRACE_TO_SKILL.json",
    claimDir: rawArgs.claimDir || ".ai-sync/auto-hermes-self-claims",
    claimTtlMinutes: rawArgs.claimTtlMinutes || "15",
    maxRounds: rawArgs.maxRounds || String(PRACTICAL_FOREVER_ROUNDS),
    maxSameWorkUnitRepeats: rawArgs.maxSameWorkUnitRepeats || DEFAULT_SAME_WORK_UNIT_REPEATS,
    controllerJson: rawArgs.controllerJson || ".ai-sync/AUTO_HERMES_SELF_CONTROLLER.json",
    controllerMd: rawArgs.controllerMd || ".ai-sync/AUTO_HERMES_SELF_CONTROLLER.md",
    promotionJson: rawArgs.promotionJson || ".ai-sync/AUTO_HERMES_SELF_PROMOTION.json",
    promotionMd: rawArgs.promotionMd || ".ai-sync/AUTO_HERMES_SELF_PROMOTION.md",
    outputJson: rawArgs.outputJson || ".ai-sync/AUTO_HERMES_SELF_LOOP.json",
    outputMd: rawArgs.outputMd || ".ai-sync/AUTO_HERMES_SELF_LOOP.md",
    coordinatorJson: rawArgs.coordinatorJson || ".ai-sync/AUTO_HERMES_SELF_COORDINATOR.json",
    coordinatorMd: rawArgs.coordinatorMd || ".ai-sync/AUTO_HERMES_SELF_COORDINATOR.md",
    promptFile: rawArgs.promptFile || ".ai-sync/AUTO_HERMES_SELF_NEXT_PROMPT.md",
    executorConfig: rawArgs.executorConfig || ".ai-sync/AUTO_HERMES_SELF_EXECUTOR.json",
    omxBridgeJson: rawArgs.omxBridgeJson || ".ai-sync/OMX_AUTO_HERMES_BRIDGE.json",
    loopStateJson: rawArgs.loopStateJson || ".ai-sync/AUTO_HERMES_SELF_LOOP_STATE.json",
    roundResultJson: rawArgs.roundResultJson || ".ai-sync/AUTO_HERMES_SELF_ROUND_RESULT.json",
    roundResultMd: rawArgs.roundResultMd || ".ai-sync/AUTO_HERMES_SELF_ROUND_RESULT.md",
    maxExecutorRetries: rawArgs.maxExecutorRetries || DEFAULT_EXECUTOR_RETRIES,
    executorRetryBackoff: rawArgs.executorRetryBackoff || DEFAULT_EXECUTOR_RETRY_BACKOFF,
    maxSelfReentries: rawArgs.maxSelfReentries || DEFAULT_SELF_REENTRY_LIMIT,
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

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildSelfReentryHistoryEntry(result, invocation) {
  const state = result?.state || {};
  return {
    invocation,
    status: state.status || "unknown",
    nextAction: state.nextAction || null,
    hasWorkUnit: Boolean(state.lastWorkUnit?.title),
    supervisorDecision: state.supervisorState?.decision || null,
    supervisorStop: state.supervisorState?.stop ?? null,
    repeatedNoCandidateAuditRounds: state.supervisorState?.repeatedNoCandidateAuditRounds ?? null,
  };
}

function shouldReenterSelfLoop(result, args, selfReentriesAttempted, maxSelfReentries) {
  if (args.dryRun) return false;
  if (selfReentriesAttempted >= maxSelfReentries) return false;

  const state = result?.state || {};
  const supervisor = state.supervisorState || {};
  const supervisorWantsContinue = supervisor.decision === "continue" && supervisor.stop === false;
  const exhaustedWithoutWork = !state.lastWorkUnit?.title && state.status === "stop-exhausted";
  const auditRetryArmed = state.status === "audit-retry-armed";
  return supervisorWantsContinue && (exhaustedWithoutWork || auditRetryArmed);
}

function runSelfExecutableLoop(args, loopRunner = runAutoHermesLoop) {
  const maxSelfReentries = parsePositiveInt(args.maxSelfReentries, Number(DEFAULT_SELF_REENTRY_LIMIT));
  const selfReentryHistory = [];
  let selfReentriesAttempted = 0;
  let result = null;

  while (true) {
    result = loopRunner(args);
    selfReentryHistory.push(buildSelfReentryHistoryEntry(result, selfReentryHistory.length + 1));

    if (!shouldReenterSelfLoop(result, args, selfReentriesAttempted, maxSelfReentries)) {
      break;
    }

    selfReentriesAttempted += 1;
  }

  const state = result?.state || {};
  const maxReached =
    selfReentriesAttempted >= maxSelfReentries &&
    shouldReenterSelfLoop(result, { ...args, maxSelfReentries: String(maxSelfReentries + 1) }, selfReentriesAttempted, maxSelfReentries + 1);

  return {
    ...result,
    state: {
      ...state,
      maxSelfReentries,
      selfLoopInvocations: selfReentryHistory.length,
      selfReentriesAttempted,
      selfReentryHistory,
      selfReentryLimitReached: maxReached,
    },
  };
}

function renderRalphLoopStrengthLines() {
  const gate = RALPH_LOOP_STRENGTH.ralphIntegrityGate || {};
  return [
    "## Strict Ralph Loop Gates",
    `- Completion promise: ${RALPH_LOOP_STRENGTH.completionPromise}.`,
    `- Repeated work-unit policy: ${RALPH_LOOP_STRENGTH.repeatedWorkUnitPolicy}.`,
    "- Required round evidence:",
    ...RALPH_LOOP_STRENGTH.requiredRoundEvidence.map((item) => `  - ${item}`),
    "- Real stop gates:",
    ...RALPH_LOOP_STRENGTH.stopGates.map((item) => `  - ${item}`),
    "",
    "## Ralph Loop Integrity Gate (pre-round + post-round fix)",
    `- Enabled: ${gate.enabled ? "yes" : "no"}`,
    `- Description: ${gate.description}`,
    "- Loop-critical files:",
    ...(gate.loopCriticalFiles || []).map((f) => `  - ${f}`),
    "- Pre-round checks:",
    ...(gate.checks || []).map((c) => `  - ${c.id}: ${c.description}`),
    `- Fix timing: ${gate.fixPolicy?.timing || "post-round"}`,
    `- Fix rule: ${gate.fixPolicy?.rule || "fix exactly what broke"}`,
    `- Must-fix-now: ${gate.fixPolicy?.mustFixNow ? "yes" : "no"}`,
  ];
}

function renderRuntimeNativePolicyLines(runtimeNativeExecution) {
  if (!runtimeNativeExecution) return [];
  if (runtimeNativeExecution.runtime === "codex-live") {
    return [
      "## Codex Live Child-Agent Policy",
      `- Runtime: ${runtimeNativeExecution.runtime}`,
      `- Agent surface: ${runtimeNativeExecution.agentLabel}`,
      `- Model: ${runtimeNativeExecution.model}`,
      `- Reasoning effort: ${runtimeNativeExecution.reasoningEffort}`,
      "- Apply this policy to delegated child agents for `/auto-hermes-self`.",
      "",
    ];
  }
  if (runtimeNativeExecution.runtime === "claude") {
    const team = runtimeNativeExecution.teamDispatch || {};
    return [
      "## Claude Code Team Model",
      `- Runtime: ${runtimeNativeExecution.runtime}`,
      `- Coordinator: ${team.coordinator || "parent Claude session"}`,
      `- Agent surface: ${runtimeNativeExecution.agentLabel}`,
      `- Model policy: ${runtimeNativeExecution.modelPolicy}`,
      `- Specialists: ${(team.specialists || []).join(", ")}`,
      `- Parallel-ok lanes: ${(team.parallelOk || []).join(", ")}`,
      `- Sequential-only gates: ${(team.sequentialOnly || []).join(", ")}`,
      `- Merge gate: ${team.mergeGate || "parent collects results and writes round-close"}`,
      `- Fallback: ${runtimeNativeExecution.fallback}`,
      "",
    ];
  }
  return [];
}

function decoratePrompt(promptText, runtimeNativeExecution = null) {
  const header = [
    "# Auto-Hermes Self Loop",
    "",
    "This is the true Ralph self-loop version of `/auto-hermes`.",
    "Keep iterating until a real stop gate fires.",
    "If no promotable task exists, use the standard find-the-task path: promote queue candidates when present, otherwise seed suggestions, then use the website-audit fallback before stopping.",
    "",
  ].join("\n");

  const body = String(promptText || "").includes("# Auto-Hermes Self Loop")
    ? String(promptText || "")
    : `${header}${String(promptText || "")}`;
  if (body.includes("## Strict Ralph Loop Gates")) return body;
  const codexLivePolicyText = renderRuntimeNativePolicyLines(runtimeNativeExecution).join("\n");
  const strengthText = `${renderRalphLoopStrengthLines().join("\n")}\n\n`;
  if (body.includes(header)) return body.replace(header, `${header}${codexLivePolicyText}${strengthText}`);
  return `${body.trimEnd()}\n\n${codexLivePolicyText}${strengthText}`;
}

function renderSelfLoopMarkdown(state) {
  const runtimeNativeExecution = state.runtimeNativeExecution || null;
  const lines = [
    "# Auto-Hermes Self Loop",
    "",
    `Generated: ${state.generatedAt}`,
    `Mode: ${state.mode}`,
    `Status: ${state.status}`,
    `Runtime: ${state.runtime || DEFAULT_SELF_RUNTIME}`,
    `Self execution contract: ${state.selfExecutionContract || resolveSelfExecutionContract(state.runtime)}`,
    `Loop Contract: ${state.loopContract}`,
    `Unbounded: ${state.unbounded ? "yes" : "no"}`,
    `Same-work-unit no-progress limit: ${state.maxSameWorkUnitRepeats || DEFAULT_SAME_WORK_UNIT_REPEATS}`,
    `Executor retries: ${state.maxExecutorRetries || DEFAULT_EXECUTOR_RETRIES}`,
    `Self re-entry limit: ${state.maxSelfReentries || DEFAULT_SELF_REENTRY_LIMIT}`,
    `Self loop invocations: ${state.selfLoopInvocations || 1}`,
    `Self re-entries attempted: ${state.selfReentriesAttempted || 0}`,
    `Rounds attempted: ${state.roundsAttempted}`,
    `Rounds completed: ${state.roundsCompleted}`,
    `Executor: ${state.executorLabel || "unconfigured"}`,
    `Last round result signature: ${state.lastRoundResultSignature || "none"}`,
    "",
    "This is the true Ralph self-loop version of `/auto-hermes`.",
    "It keeps iterating until a real stop gate fires instead of treating a bounded round as the finish state.",
  ];

  if (runtimeNativeExecution?.runtime === "claude") {
    const team = runtimeNativeExecution.teamDispatch || {};
    lines.push(
      "",
      "## Claude Code Team Model",
      `- Runtime: ${runtimeNativeExecution.runtime}`,
      `- Coordinator: ${team.coordinator || "parent Claude session"}`,
      `- Agent surface: ${runtimeNativeExecution.agentLabel}`,
      `- Model policy: ${runtimeNativeExecution.modelPolicy}`,
      `- Specialists: ${(team.specialists || []).join(", ")}`,
      `- Parallel-ok: ${(team.parallelOk || []).join(", ")}`,
      `- Sequential gates: ${(team.sequentialOnly || []).join(", ")}`,
      `- Merge gate: ${team.mergeGate || "parent collects results and writes round-close"}`,
    );
  } else if (runtimeNativeExecution?.runtime === "codex-live") {
    lines.push(
      "",
      "## Codex Live Child-Agent Policy",
      `- Runtime: ${runtimeNativeExecution.runtime}`,
      `- Agent surface: ${runtimeNativeExecution.agentLabel}`,
      `- Model: ${runtimeNativeExecution.model}`,
      `- Reasoning effort: ${runtimeNativeExecution.reasoningEffort}`,
    );
  }

  if (state.stopReason) lines.push("", `Stop reason: ${state.stopReason}`);
  if (state.selfReentryLimitReached) {
    lines.push(
      "",
      "Self re-entry safety limit reached before a true stop. Re-run `/auto-hermes-self` or raise `--max-self-reentries` after checking the latest loop state.",
    );
  }
  if (state.selfReentryHistory?.length) {
    lines.push(
      "",
      "## Self Re-Entry History",
      ...state.selfReentryHistory.map((entry) => {
        const supervisor = entry.supervisorDecision
          ? ` supervisor=${entry.supervisorDecision}${entry.supervisorStop === false ? ":continue" : ""}`
          : "";
        const auditRounds = entry.repeatedNoCandidateAuditRounds == null
          ? ""
          : ` no-candidate-audits=${entry.repeatedNoCandidateAuditRounds}`;
        return `- Invocation ${entry.invocation}: ${entry.status}${supervisor}${auditRounds}`;
      }),
    );
  }
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
    "- A bounded round is only complete after fresh verification, architect approval, deslop/regression evidence, and round-close writeback.",
    "",
    ...renderRalphLoopStrengthLines(),
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
  const runtimeNativeExecution = resolveSelfRuntimeNativeExecution(args.runtime, state.runtimeNativeExecution);
  const selfExecutionContract = state.selfExecutionContract || resolveSelfExecutionContract(state.runtime || args.runtime);

  ensureParent(outputJsonPath);
  ensureParent(outputMdPath);
  ensureParent(coordinatorJsonPath);
  ensureParent(coordinatorMdPath);
  ensureParent(promptPath);
  ensureParent(loopStateJsonPath);

  fs.writeFileSync(outputJsonPath, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(outputMdPath, renderSelfLoopMarkdown(state), "utf8");

  const promptText = decoratePrompt(
    fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf8") : "",
    runtimeNativeExecution,
  );
  fs.writeFileSync(promptPath, promptText, "utf8");

  const coordinator = safeReadJson(coordinatorJsonPath) || {};
  const decoratedCoordinator = {
    ...coordinator,
    mode: state.mode,
    runtime: state.runtime || DEFAULT_SELF_RUNTIME,
    selfExecutionRuntime: state.selfExecutionRuntime || state.runtime || DEFAULT_SELF_RUNTIME,
    selfExecutionContract,
    unbounded: true,
    runtimeNativeExecution: runtimeNativeExecution || coordinator.runtimeNativeExecution || null,
    maxRounds: null,
    maxSameWorkUnitRepeats: state.maxSameWorkUnitRepeats,
    maxExecutorRetries: state.maxExecutorRetries,
    maxSelfReentries: state.maxSelfReentries,
    ralphLoop: RALPH_LOOP_STRENGTH,
    loopContract: SELF_LOOP_CONTRACT,
    commandName: "/auto-hermes-self",
  };
  fs.writeFileSync(coordinatorJsonPath, JSON.stringify(decoratedCoordinator, null, 2), "utf8");

  const coordinatorMd = [
    "# Auto-Hermes Self Coordinator",
    "",
    `Generated: ${state.generatedAt}`,
    `Runtime: ${decoratedCoordinator.runtime || state.runtime || "generic"}`,
    `Self execution contract: ${selfExecutionContract}`,
    `Status: ${decoratedCoordinator.status || state.status}`,
    `Next Action: ${decoratedCoordinator.nextAction || "stop"}`,
    `Loop Contract: ${SELF_LOOP_CONTRACT}`,
    `Unbounded: yes`,
    `Same-work-unit no-progress limit: ${state.maxSameWorkUnitRepeats || DEFAULT_SAME_WORK_UNIT_REPEATS}`,
    `Executor retries: ${state.maxExecutorRetries || DEFAULT_EXECUTOR_RETRIES}`,
    `Self re-entry limit: ${state.maxSelfReentries || DEFAULT_SELF_REENTRY_LIMIT}`,
    `Self loop invocations: ${state.selfLoopInvocations || 1}`,
    `Self re-entries attempted: ${state.selfReentriesAttempted || 0}`,
    "",
    "This is the true Ralph self-loop version of `/auto-hermes`.",
    "Keep iterating until a real stop gate fires.",
    "If the queue is empty, use the standard find-the-task path before stopping, including the website-audit fallback when the controller reports no promotable work.",
    ...(runtimeNativeExecution?.runtime === "claude"
      ? [
          "",
          "## Claude Code Team Model",
          `- Runtime: ${runtimeNativeExecution.runtime}`,
          `- Coordinator: ${runtimeNativeExecution.teamDispatch?.coordinator || "parent Claude session"}`,
          `- Agent surface: ${runtimeNativeExecution.agentLabel}`,
          `- Model policy: ${runtimeNativeExecution.modelPolicy}`,
          `- Specialists: ${(runtimeNativeExecution.teamDispatch?.specialists || []).join(", ")}`,
          `- Parallel-ok: ${(runtimeNativeExecution.teamDispatch?.parallelOk || []).join(", ")}`,
          `- Sequential gates: ${(runtimeNativeExecution.teamDispatch?.sequentialOnly || []).join(", ")}`,
          `- Merge gate: ${runtimeNativeExecution.teamDispatch?.mergeGate || "parent collects results and writes round-close"}`,
          `- Fallback: ${runtimeNativeExecution.fallback}`,
        ]
      : []),
    ...(runtimeNativeExecution?.runtime === "codex-live"
      ? [
          "",
          "## Codex Live Child-Agent Policy",
          `- Runtime: ${runtimeNativeExecution.runtime}`,
          `- Agent surface: ${runtimeNativeExecution.agentLabel}`,
          `- Model: ${runtimeNativeExecution.model}`,
          `- Reasoning effort: ${runtimeNativeExecution.reasoningEffort}`,
        ]
      : []),
    "",
    ...renderRalphLoopStrengthLines(),
    ...(runtimeNativeExecution?.runtime === "claude" && RALPH_LOOP_STRENGTH.claudeSelfExecution?.enabled
      ? [
          "",
          "## Claude Self-Loop Protocol (Active Execution)",
          `Description: ${RALPH_LOOP_STRENGTH.claudeSelfExecution.description}`,
          "Loop body:",
          ...RALPH_LOOP_STRENGTH.claudeSelfExecution.loopBody.map((step) => `  ${step}`),
          `Context pressure policy: ${RALPH_LOOP_STRENGTH.claudeSelfExecution.contextPressurePolicy}`,
        ]
      : []),
    ...(normalizeRuntime(state.selfExecutionRuntime || state.runtime) === "codex"
      ? [
          "",
          "## Codex Self-Loop Protocol (Active Execution)",
          "Description: Codex runs through the executor-backed self-loop owner, executes or delegates authorized bounded rounds, records real gate evidence, and re-enters without waiting for user input until a true stop gate fires.",
          "Loop body:",
          "  read coordinator brief for current work unit",
          "  read controller JSON for subagent plan, route, files, and verification contract",
          "  run pre-round Ralph integrity gate for loop-critical files",
          "  execute locally or delegate authorized disjoint lanes",
          "  run required verification and runtime proof when needed",
          "  run review/merge gate with an explicit verdict",
          "  run round-close with real evidence",
          "  re-run self-loop owner and continue on loop-owner-execute-round or codex-coordinator-execute-round",
        ]
      : []),
    "",
    `Worker Prompt File: ${promptPath}`,
  ].join("\n");
  fs.writeFileSync(coordinatorMdPath, `${coordinatorMd}\n`, "utf8");

  const persistedState = safeReadJson(loopStateJsonPath) || {};
  fs.writeFileSync(loopStateJsonPath, JSON.stringify({
    ...persistedState,
    mode: state.mode,
    runtime: state.runtime || DEFAULT_SELF_RUNTIME,
    selfExecutionRuntime: state.selfExecutionRuntime || state.runtime || DEFAULT_SELF_RUNTIME,
    selfExecutionContract,
    unbounded: true,
    runtimeNativeExecution: runtimeNativeExecution || null,
    maxRounds: null,
    maxSameWorkUnitRepeats: state.maxSameWorkUnitRepeats,
    maxExecutorRetries: state.maxExecutorRetries,
    maxSelfReentries: state.maxSelfReentries,
    ralphLoop: RALPH_LOOP_STRENGTH,
    loopContract: SELF_LOOP_CONTRACT,
  }, null, 2), "utf8");
}

function normalizeResult(result, args) {
  const runtimeNativeExecution = resolveSelfRuntimeNativeExecution(args.runtime, result.state?.runtimeNativeExecution);
  const selfExecutionRuntime = args.runtime || DEFAULT_SELF_RUNTIME;
  const selfExecutionContract = resolveSelfExecutionContract(selfExecutionRuntime);
  const state = {
    ...result.state,
    mode: "self-ralph",
    unbounded: true,
    maxRounds: null,
    maxSameWorkUnitRepeats: parsePositiveInt(args.maxSameWorkUnitRepeats, Number(DEFAULT_SAME_WORK_UNIT_REPEATS)),
    maxExecutorRetries: parsePositiveInt(args.maxExecutorRetries, Number(DEFAULT_EXECUTOR_RETRIES)),
    maxSelfReentries: result.state?.maxSelfReentries || parsePositiveInt(args.maxSelfReentries, Number(DEFAULT_SELF_REENTRY_LIMIT)),
    selfLoopInvocations: result.state?.selfLoopInvocations || 1,
    selfReentriesAttempted: result.state?.selfReentriesAttempted || 0,
    selfReentryHistory: result.state?.selfReentryHistory || [],
    selfReentryLimitReached: Boolean(result.state?.selfReentryLimitReached),
    ralphLoop: RALPH_LOOP_STRENGTH,
    loopContract: SELF_LOOP_CONTRACT,
    commandName: "/auto-hermes-self",
    runtime: selfExecutionRuntime,
    selfExecutionRuntime,
    selfExecutionContract,
    runtimeNativeExecution,
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

export function runAutoHermesSelfLoop(rawArgs = process.argv.slice(2), options = {}) {
  const parsedArgs = Array.isArray(rawArgs) ? parseArgs(rawArgs) : rawArgs;
  const args = applySelfDefaults(parsedArgs || {});
  const result = runSelfExecutableLoop(args, options.loopRunner || runAutoHermesLoop);
  return normalizeResult(result, args);
}

function main() {
  const { output } = runAutoHermesSelfLoop(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
