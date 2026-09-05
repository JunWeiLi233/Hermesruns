#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inferSurfaceFromTask, normalizeFiles } from "./auto-hermes-task-meta.mjs";
import { runAutoHermesController } from "./auto-hermes-controller.mjs";
import { runAutoHermesFinish } from "./auto-hermes-finish.mjs";
import { runAutoHermesLoop } from "./auto-hermes-loop.mjs";
import { loadAutoHermesRun, recordWebsiteAuditAttempt } from "./auto-hermes-run-state.mjs";
import { writeTracePacketArtifacts } from "./auto-hermes-trace-to-skill.mjs";
import {
  renderAutoHermesSelfCheckMarkdown,
  runAutoHermesSelfCheck,
} from "./auto-hermes-self-check.mjs";
import {
  DEFAULT_ERROR_LEDGER,
  renderAutoHermesErrorLedgerBrief,
  writeAutoHermesErrorLedger,
} from "./auto-hermes-error-ledger.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    refreshController: true,
    refreshLoopBriefs: true,
    refreshFinish: true,
    refreshSuggestions: true,
    promoteNext: true,
    push: false,
    surface: "",
    task: "",
    agent: "codex",
    owner: "",
    files: "",
    verify: "",
    verdict: "pass",
    rollback: "",
    summary: "",
    changes: "",
    goal: "",
    preserve: "",
    risk: "",
    blocker: "none",
    review: "approve-next-round",
    note: "",
    next: "",
    evidence: "",
    verifyResult: "",
    runtimeProof: "",
    consoleClean: "",
    consoleSummary: "",
    consoleObservedCount: "",
    liveClaim: "",
    architectVerdict: "",
    deslopPass: "",
    regressionPass: "",
    qualityAudit: ".workspace/state/QUALITY_AUDIT.md",
    contextLedger: ".workspace/state/CONTEXT_LEDGER.md",
    loopState: ".workspace/state/LOOP_STATE.md",
    loopStateJson: ".workspace/state/AUTO_HERMES_LOOP_STATE.json",
    tasks: "TASKS.md",
    humanLoop: ".workspace/state/HUMAN_LOOP.md",
    selfCheck: true,
    selfCheckJson: ".workspace/state/AUTO_HERMES_SELF_CHECK.json",
    selfCheckMd: ".workspace/state/AUTO_HERMES_SELF_CHECK.md",
    traceToSkillRoundsDir: ".workspace/state/trace-to-skill/rounds",
    traceToSkillJson: ".workspace/state/AUTO_HERMES_TRACE_TO_SKILL.json",
    traceToSkillMd: ".workspace/state/AUTO_HERMES_TRACE_TO_SKILL.md",
    roundResultJson: ".workspace/state/AUTO_HERMES_ROUND_RESULT.json",
    roundResultMd: ".workspace/state/AUTO_HERMES_ROUND_RESULT.md",
    promotionJson: ".workspace/state/AUTO_HERMES_PROMOTION.json",
    promotionMd: ".workspace/state/AUTO_HERMES_PROMOTION.md",
    controllerJson: ".workspace/state/AUTO_HERMES_CONTROLLER.json",
    controllerMd: ".workspace/state/AUTO_HERMES_CONTROLLER.md",
    loopJson: ".workspace/state/AUTO_HERMES_LOOP.json",
    loopMd: ".workspace/state/AUTO_HERMES_LOOP.md",
    coordinatorJson: ".workspace/state/AUTO_HERMES_COORDINATOR.json",
    coordinatorMd: ".workspace/state/AUTO_HERMES_COORDINATOR.md",
    promptFile: ".workspace/state/AUTO_HERMES_NEXT_PROMPT.md",
    finishJson: ".workspace/state/AUTO_HERMES_FINISH.json",
    finishMd: ".workspace/state/AUTO_HERMES_FINISH.md",
    agentSyncMd: ".workspace/state/AGENT_SYNC.md",
    agentSyncJson: ".workspace/state/AGENT_SYNC.json",
    selfEvolvingAudit: ".workspace/state/SELF_EVOLVING_AUDIT.md",
    round: "",
    roundStart: "",
    telemetryJson: ".workspace/state/AUTO_HERMES_TELEMETRY.json",
    errorLedger: DEFAULT_ERROR_LEDGER,
    errorLedgerScan: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--no-refresh-controller") args.refreshController = false;
    else if (arg === "--no-refresh-loop-briefs") args.refreshLoopBriefs = false;
    else if (arg === "--no-refresh-finish") args.refreshFinish = false;
    else if (arg === "--no-refresh-suggestions") args.refreshSuggestions = false;
    else if (arg === "--no-promote-next") args.promoteNext = false;
    else if (arg === "--push") args.push = true;
    else if (arg === "--no-self-check") args.selfCheck = false;
    else if (arg === "--no-error-ledger-scan") args.errorLedgerScan = false;
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

function inferWorkspaceRoot(args) {
  if (args?.tasks && path.isAbsolute(args.tasks) && path.basename(args.tasks).toLowerCase() === "tasks.md") {
    return path.dirname(args.tasks);
  }
  return ROOT;
}

function readOptional(relPath) {
  const fullPath = resolveFromRoot(relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function loadJsonFile(relPath) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function shouldExecuteFinishCommit(args, promotion) {
  if (args.verdict !== "pass") return false;
  if (args.promoteNext === false) return true;
  return !promotion?.recommended;
}

export function shouldExecuteFinishPush(args, promotion) {
  return Boolean(args.push) && shouldExecuteFinishCommit(args, promotion);
}

function runFinishHelper(args, promotion) {
  try {
    runAutoHermesFinish({
      write: true,
      commit: shouldExecuteFinishCommit(args, promotion),
      push: Boolean(args.push),
      autoPushWhenNeeded: true,
      task: args.task || "",
      surface: args.surface || "",
      summary: args.summary || "",
      files: args.files || "",
      verify: args.verify || "",
      outputJson: args.finishJson,
      outputMd: args.finishMd,
    });
  } catch {
    // Finish briefs should not block queue/state writeback.
  }
}

function runControllerHelper(args) {
  try {
    runAutoHermesController({
      write: true,
      tasks: args.tasks,
      humanLoop: args.humanLoop,
      agentSync: args.agentSyncMd,
      contextLedger: args.contextLedger,
      loopState: args.loopState,
      outputJson: args.controllerJson,
      outputMd: args.controllerMd,
      refreshSuggestions: args.refreshSuggestions,
    });
  } catch {
    // Controller refresh should not block deterministic writeback.
  }
}

function runLoopHelper(args) {
  const runtime = args.agent === "codex" ? "codex-live" : "generic";
  try {
    runAutoHermesLoop({
      write: true,
      dryRun: true,
      mode: "self-loop",
      maxRounds: 1,
      runtime,
      tasks: args.tasks,
      humanLoop: args.humanLoop,
      agentSync: args.agentSyncMd,
      contextLedger: args.contextLedger,
      loopState: args.loopState,
      controllerJson: args.controllerJson,
      controllerMd: args.controllerMd,
      promotionJson: args.promotionJson,
      promotionMd: args.promotionMd,
      outputJson: args.loopJson,
      outputMd: args.loopMd,
      coordinatorJson: args.coordinatorJson,
      coordinatorMd: args.coordinatorMd,
      promptFile: args.promptFile,
    });
  } catch {
    // Loop/coordinator refresh should not block deterministic writeback.
  }
}

function todayDate() {
  return nowIso().slice(0, 10);
}

function splitList(value, separator = "||") {
  return String(value || "")
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRepoTasksPath(relPath) {
  return resolveFromRoot(relPath) === resolveFromRoot("TASKS.md");
}

function compactKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeKey(value, surface, task) {
  const raw = String(value || "").trim();
  if (!raw || raw === task || /^Task:/i.test(raw)) {
    return compactKey(`${surface || ""} ${task || ""}`);
  }
  return raw;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMarkdownSection(text, heading) {
  const lines = text.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex === -1) return "";

  const collected = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    collected.push(lines[i]);
  }
  return collected.join("\n").trimEnd();
}

function replaceMarkdownSection(text, heading, content) {
  const lines = text.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex === -1) return text;

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  const before = lines.slice(0, startIndex + 1);
  const nextContent = content.trimEnd() ? content.trimEnd().split(/\r?\n/) : [];
  const after = lines.slice(endIndex);
  return [...before, ...nextContent, "", ...after].join("\n").replace(/\n{3,}/g, "\n\n");
}

function replaceOrAppendMarkdownSection(text, heading, content) {
  if (text.includes(`## ${heading}`)) {
    return replaceMarkdownSection(text, heading, content);
  }
  const suffix = text.endsWith("\n") ? "" : "\n";
  return `${text}${suffix}\n## ${heading}\n${content.trimEnd()}\n`;
}

function replaceLine(text, pattern, replacement) {
  if (!pattern.test(text)) return text;
  return text.replace(pattern, replacement);
}

function parseTaskBlocks(taskText, heading) {
  const section = extractMarkdownSection(taskText, heading);
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  const tasks = [];
  let current = null;
  let sectionName = "";

  function flush() {
    if (!current) return;
    tasks.push(current);
    current = null;
  }

  for (const line of lines) {
    const subHeading = line.match(/^###\s+(.+)$/);
    if (subHeading) {
      sectionName = subHeading[1].trim();
      continue;
    }
    const task = line.match(/^\s*-\s*\[( |x)\]\s*(.+)$/);
    if (task) {
      flush();
      current = {
        checked: task[1] === "x",
        title: task[2].trim(),
        helpers: [],
        section: sectionName,
      };
      continue;
    }
    const trimmed = line.trim();
    if (!current || !trimmed) continue;
    if (trimmed.startsWith("<!--") || trimmed.endsWith("-->")) continue;
    current.helpers.push(trimmed);
  }

  flush();
  return tasks;
}

function helperValue(task, key) {
  const prefix = `${key}:`;
  const hit = task.helpers.find((line) => line.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : "";
}

function inferSurface(task) {
  return inferSurfaceFromTask(task);
}

function summarizeTask(task, source) {
  if (!task) return null;
  return {
    source,
    title: task.title,
    surface: inferSurface(task),
    files: normalizeFiles(helperValue(task, "Files")),
    context: helperValue(task, "Context"),
    doneWhen: helperValue(task, "Done when"),
    verify: helperValue(task, "Verify"),
  };
}

export function taskFromControllerResult(controllerResult) {
  if (!controllerResult?.title) return null;
  const helpers = [];
  const files = Array.isArray(controllerResult.files) ? controllerResult.files.filter(Boolean) : [];
  if (files.length) helpers.push(`Files: \`${files.join(", ")}\``);
  const problemClass = controllerResult.classification?.problemClass || controllerResult.problemClass || "";
  if (problemClass) helpers.push(`Problem: ${problemClass}`);
  const owner = controllerResult.owner || controllerResult.websiteAudit?.candidate?.owner || "";
  if (owner) helpers.push(`Owner: ${owner}`);
  if (controllerResult.context) helpers.push(`Context: ${controllerResult.context}`);
  if (controllerResult.doneWhen) helpers.push(`Done when: ${controllerResult.doneWhen}`);
  if (controllerResult.verify) helpers.push(`Verify: ${controllerResult.verify}`);
  if (controllerResult.surface && controllerResult.surface !== "unknown") helpers.push(`Surface: ${controllerResult.surface}`);
  if (controllerResult.websiteAudit?.attempted) {
    helpers.push(`Website Audit: ${controllerResult.websiteAudit.status || (controllerResult.websiteAudit.usedFallback ? "fallback-selected" : "candidate-available")}`);
    if (controllerResult.websiteAudit.summary) {
      helpers.push(`Website Audit Summary: ${controllerResult.websiteAudit.summary}`);
    }
  }

  return {
    checked: false,
    title: controllerResult.title,
    helpers,
    section: "",
  };
}

function choosePromotion(taskText) {
  const active = parseTaskBlocks(taskText, "Active Tasks").filter((task) => !task.checked);
  const suggested = parseTaskBlocks(taskText, "Suggested Next Tasks").filter((task) => !task.checked);
  const techDebt = parseTaskBlocks(taskText, "Tech Debt Tasks").filter((task) => !task.checked);

  const activeLeader = active[0] || null;
  const suggestedLeader = suggested[0] || null;
  const techDebtLeader = techDebt[0] || null;
  const recommended = activeLeader || suggestedLeader || techDebtLeader;
  const source = activeLeader ? "active-task" : suggestedLeader ? "suggested-task" : techDebtLeader ? "tech-debt" : "none";

  return {
    generatedAt: nowIso(),
    recommended: summarizeTask(recommended, source),
    leaders: {
      active: summarizeTask(activeLeader, "active-task"),
      suggested: summarizeTask(suggestedLeader, "suggested-task"),
      techDebt: summarizeTask(techDebtLeader, "tech-debt"),
    },
    websiteAudit: null,
  };
}

function formatTaskBlock(task) {
  if (!task) return "";
  const helperLines = task.helpers.length ? task.helpers.map((line) => `  ${line}`) : [];
  return [`- [ ] ${task.title}`, ...helperLines].join("\n");
}

function removeTaskBlock(sectionText, task) {
  if (!sectionText || !task) return sectionText;
  const lines = sectionText.split(/\r?\n/);
  const result = [];
  let currentSection = "";
  let skip = false;
  let skipTaskSection = "";

  for (const line of lines) {
    const subHeading = line.match(/^###\s+(.+)$/);
    if (subHeading) {
      currentSection = subHeading[1].trim();
      if (skip && currentSection !== skipTaskSection) skip = false;
      result.push(line);
      continue;
    }

    const taskMatch = line.match(/^\s*-\s*\[( |x)\]\s*(.+)$/);
    if (taskMatch) {
      if (skip) skip = false;
      const title = taskMatch[2].trim();
      if (title === task.title && currentSection === (task.section || "")) {
        skip = true;
        skipTaskSection = currentSection;
        continue;
      }
      result.push(line);
      continue;
    }

    if (skip) {
      if (line.trim()) continue;
      skip = false;
      continue;
    }

    result.push(line);
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function appendTaskToActiveTasks(taskText, task) {
  if (!task) return taskText;
  const section = extractMarkdownSection(taskText, "Active Tasks").replace(/^\s*-\s*none\s*$/im, "").trim();
  const block = formatTaskBlock(task);
  if (!section) {
    return replaceMarkdownSection(taskText, "Active Tasks", `${block}\n`);
  }
  const next = `${section}\n${block}\n`;
  return replaceMarkdownSection(taskText, "Active Tasks", next);
}

function retireCompletedActiveTask(taskText, completedTitle) {
  if (!completedTitle) return taskText;
  const activeTasks = parseTaskBlocks(taskText, "Active Tasks").filter((task) => !task.checked);
  const matching = activeTasks.find((task) => task.title === completedTitle);
  if (!matching) return taskText;
  const activeSection = extractMarkdownSection(taskText, "Active Tasks");
  const updatedActive = removeTaskBlock(activeSection, matching);
  return replaceMarkdownSection(taskText, "Active Tasks", updatedActive || "");
}

function promoteRecommendedTask(taskText, promotion) {
  if (!promotion?.recommended) return { changed: false, taskText, promoted: null };
  if (promotion.recommended.source === "active-task") {
    return { changed: false, taskText, promoted: promotion.recommended };
  }

  const activeOpen = parseTaskBlocks(taskText, "Active Tasks").filter((task) => !task.checked);
  if (activeOpen.length > 0) {
    return { changed: false, taskText, promoted: promotion.recommended };
  }

  const sourceHeading = promotion.recommended.source === "suggested-task" ? "Suggested Next Tasks" : "Tech Debt Tasks";
  const sourceTasks = parseTaskBlocks(taskText, sourceHeading).filter((task) => !task.checked);
  const matching = sourceTasks.find((task) => task.title === promotion.recommended.title);
  if (!matching) return { changed: false, taskText, promoted: null };

  const sourceSection = extractMarkdownSection(taskText, sourceHeading);
  const updatedSource = removeTaskBlock(sourceSection, matching);
  let nextTaskText = replaceMarkdownSection(taskText, sourceHeading, updatedSource || "");
  nextTaskText = appendTaskToActiveTasks(nextTaskText, matching);

  return {
    changed: true,
    taskText: nextTaskText,
    promoted: summarizeTask(matching, "active-task"),
  };
}

function runSuggestTasks(args) {
  if (!isRepoTasksPath(args.tasks)) return false;
  // Controller owns suggestion seeding. Round-close should not shell-spawn a second
  // suggestion pass that can silently fail and diverge from controller state.
  return false;
}

function renderPromotionMarkdown(promotion) {
  const recommended = promotion.recommended;
  const lines = [
    "# Auto-Hermes Promotion",
    "",
    `Generated: ${promotion.generatedAt}`,
    "",
  ];

  if (!recommended) {
    lines.push("Decision: stop-exhausted", "Reason: no promotable task found in Active, Suggested, or Tech Debt.");
    if (promotion.websiteAudit?.attempted) {
      lines.push("", "## Website Audit", `- Status: ${promotion.websiteAudit.status || "unknown"}`, `- Summary: ${promotion.websiteAudit.summary || "none"}`);
    }
    return `${lines.join("\n")}\n`;
  }

  lines.push(
    "Decision: continue-self-loop",
    `Recommended Source: ${recommended.source}`,
    `Recommended Title: ${recommended.title}`,
    `Recommended Surface: ${recommended.surface}`,
    "",
    "## Recommended Task",
    `- Files: ${recommended.files.length ? recommended.files.join(" | ") : "not specified"}`,
    `- Context: ${recommended.context || "none"}`,
    `- Done when: ${recommended.doneWhen || "none"}`,
    `- Verify: ${recommended.verify || "none"}`,
    "",
    "## Section Leaders",
  );

  for (const [name, leader] of Object.entries(promotion.leaders)) {
    lines.push(`- ${name}: ${leader ? `${leader.title} (${leader.surface})` : "none"}`);
  }

  if (promotion.websiteAudit?.attempted) {
    lines.push(
      "",
      "## Website Audit",
      `- Status: ${promotion.websiteAudit.status || "unknown"}`,
      `- Summary: ${promotion.websiteAudit.summary || "none"}`,
      `- Used fallback: ${promotion.websiteAudit.usedFallback ? "yes" : "no"}`,
      `- Candidate: ${promotion.websiteAudit.candidate?.surface || "none"}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function runSelfCheck(args) {
  if (!args.selfCheck || !args.files || !String(args.files).trim()) return null;
  return runAutoHermesSelfCheck({
    files: args.files,
    task: args.task,
    surface: args.surface,
  });
}

function createSelfCheckTask(args, selfCheckReport) {
  const scannedFiles = Array.isArray(selfCheckReport?.scannedFiles) ? selfCheckReport.scannedFiles : [];
  return {
    checked: false,
    title: `Fix self-check findings on ${args.surface || args.task || "current surface"}`,
    helpers: [
      `Context: Auto-Hermes self-check flagged suspicious UI copy or control patterns after ${args.task || "the previous round"}.`,
      `Surface: ${args.surface || "unknown"}`,
      ...(scannedFiles.length ? [`Files: ${scannedFiles.join(" || ")}`] : []),
      "Done when: The suspicious title/button/copy finding is removed and the self-check report returns clean for the touched files.",
      `Verify: & 'C:\\Program Files\\nodejs\\node.exe' tools/auto-hermes-self-check.mjs --json --files "${scannedFiles.join("||")}" --surface "${args.surface || ""}" --task "${args.task || ""}"`,
    ],
    section: "",
  };
}

function createErrorLedgerTask(args, errorLedgerState) {
  const repair = errorLedgerState?.repairRequiredEntries?.[0];
  if (!repair) return null;
  const source = String(repair.source || "").trim();
  const files = [
    args.errorLedger || DEFAULT_ERROR_LEDGER,
    "tools/auto-hermes-error-ledger.mjs",
    source && !/^https?:\/\//i.test(source) ? source : "",
  ].filter(Boolean);

  return {
    checked: false,
    title: `Fix Auto-Hermes loader error: ${repair.summary}`,
    helpers: [
      `Files: ${[...new Set(files)].join(" || ")}`,
      `Context: ${args.errorLedger || DEFAULT_ERROR_LEDGER} has ${errorLedgerState.repairRequiredEntries.length} unresolved blocker/error loader entr${errorLedgerState.repairRequiredEntries.length === 1 ? "y" : "ies"}. Top entry ${repair.id} is ${repair.category} from ${repair.source}.`,
      "Done when: All open `blocker` and `error` entries in the Auto-Hermes error ledger are resolved or downgraded with evidence; advisory warnings may remain only when the manifest fallback is intentionally documented.",
      `Verify: & 'C:\\Program Files\\nodejs\\node.exe' tools/auto-hermes-error-ledger.mjs --scan --write --fail-on-repair-required`,
    ],
    section: "",
  };
}

function hasOpenTask(taskText, title) {
  return parseTaskBlocks(taskText, "Active Tasks")
    .filter((task) => !task.checked)
    .some((task) => task.title === title);
}

function loadControllerResult(args) {
  const controllerPath = resolveFromRoot(args.controllerJson);
  if (!fs.existsSync(controllerPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(controllerPath, "utf8"));
  } catch {
    return null;
  }
}

export function syncQueueWithController(taskText, controllerResult) {
  const controllerTask = taskFromControllerResult(controllerResult);
  if (!controllerTask) return taskText;

  const activeTasks = parseTaskBlocks(taskText, "Active Tasks").filter((task) => !task.checked);
  if (activeTasks.some((task) => task.title === controllerTask.title)) return taskText;

  const removeFromSection = (currentText, heading) => {
    const sectionTasks = parseTaskBlocks(currentText, heading).filter((task) => !task.checked);
    const existing = sectionTasks.find((task) => task.title === controllerTask.title);
    if (!existing) return currentText;
    const sectionText = extractMarkdownSection(currentText, heading);
    return replaceMarkdownSection(currentText, heading, removeTaskBlock(sectionText, existing) || "");
  };

  let nextTaskText = taskText;
  nextTaskText = removeFromSection(nextTaskText, "Suggested Next Tasks");
  nextTaskText = removeFromSection(nextTaskText, "Tech Debt Tasks");
  return appendTaskToActiveTasks(nextTaskText, controllerTask);
}

function updateQualityAudit(content, entry) {
  const section = extractMarkdownSection(content, "Latest Verdicts");
  const blocks = section
    .split(/\n(?=- surface: )/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !/^- none$/im.test(block))
    .filter((block) => !block.startsWith(`- surface: ${entry.surface}`));

  const newBlock = [
    `- surface: ${entry.surface}`,
    `  verdict: ${entry.verdict}`,
    `  blocker_or_must_fix: ${entry.blocker}`,
    `  rollback_target: ${entry.rollback}`,
  ].join("\n");

  let next = replaceMarkdownSection(content, "Latest Verdicts", [newBlock, ...blocks].join("\n"));

  if (entry.scorecard) {
    const scoreSection = extractMarkdownSection(next, "Latest Scorecards");
    const scoreBlocks = scoreSection
      .split(/\n(?=- surface: )/g)
      .map((block) => block.trim())
      .filter(Boolean)
      .filter((block) => !/^- none$/im.test(block))
      .filter((block) => !block.startsWith(`- surface: ${entry.surface}`));

    const newScoreBlock = [
      `- surface: ${entry.surface}`,
      ...Object.entries(entry.scorecard).map(([name, item]) => `  ${name}: ${item.grade} (${item.score}) - ${item.reason}`),
    ].join("\n");

    next = replaceOrAppendMarkdownSection(next, "Latest Scorecards", [newScoreBlock, ...scoreBlocks].join("\n"));
  }

  return next;
}

function detectRoundCapabilities(args, selfCheck) {
  const files = dedupe(splitList(args.files));
  const verify = dedupe(splitList(args.verify));
  const semanticText = `${args.surface} ${args.task} ${args.summary}`.toLowerCase();
  const normalizedFiles = files.map((file) => file.replace(/\\/g, "/"));
  const touchesFrontend =
    normalizedFiles.some((file) => file.includes("frontend/")) ||
    (selfCheck?.scannedFiles?.length || 0) > 0 ||
    /\b(frontend|react|jsx|css|layout|design|theme|translation|copy|hero|card|page)\b/.test(semanticText);
  const touchesBackend =
    normalizedFiles.some((file) => file.includes("backend/")) ||
    /\b(backend|service|repository|spring|validation|api|endpoint|database|persistence)\b/.test(semanticText);

  return { files, verify, semanticText, touchesFrontend, touchesBackend };
}

function scoreToGrade(score) {
  if (score >= 90) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

function makeGrade(score, reason) {
  return { grade: scoreToGrade(score), score, reason };
}

function normalizePassSignal(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "missing";
  if (["pass", "passed", "approved", "true", "yes", "1", "skip", "skipped", "not-needed"].includes(normalized)) {
    return normalized;
  }
  return normalized;
}

function isPassLike(value) {
  return ["pass", "passed", "approved", "true", "yes", "1", "skip", "skipped", "not-needed"].includes(normalizePassSignal(value));
}

function isApprovedLike(value) {
  return ["approved", "pass", "passed", "true", "yes", "1"].includes(normalizePassSignal(value));
}

function buildRalphGateResult(args) {
  const caps = detectRoundCapabilities(args, null);
  const verify = String(args.verify || "").trim();
  const verifyResult = String(args.verifyResult || "").trim();
  const consoleClean = String(args.consoleClean || "").trim();
  const architectVerdict = String(args.architectVerdict || "").trim();
  const deslopPass = String(args.deslopPass || "").trim();
  const regressionPass = String(args.regressionPass || "").trim();
  const failures = [];

  if (!verify || normalizePassSignal(verifyResult) !== "pass") {
    failures.push("fresh verify evidence");
  }
  if (caps.touchesFrontend && normalizePassSignal(consoleClean) !== "pass") {
    failures.push("console-clean proof");
  }
  if (!isApprovedLike(architectVerdict)) {
    failures.push("architect approval");
  }
  if (!isPassLike(deslopPass)) {
    failures.push("deslop pass");
  }
  if (!isPassLike(regressionPass)) {
    failures.push("post-deslop regression verification");
  }

  return {
    pass: failures.length === 0,
    summary: failures.length === 0
      ? "All required Ralph completion gates were satisfied."
      : `Missing required Ralph completion evidence: ${failures.join(", ")}.`,
    failures,
    gates: {
      verification: normalizePassSignal(verifyResult) === "pass" ? "pass" : normalizePassSignal(verifyResult),
      consoleClean: caps.touchesFrontend
        ? (normalizePassSignal(consoleClean) === "pass" ? "pass" : normalizePassSignal(consoleClean))
        : "not-needed",
      architectReview: isApprovedLike(architectVerdict) ? "pass" : normalizePassSignal(architectVerdict),
      deslop: isPassLike(deslopPass) ? "pass" : normalizePassSignal(deslopPass),
      regression: isPassLike(regressionPass) ? "pass" : normalizePassSignal(regressionPass),
    },
    raw: {
      verify,
      verifyResult,
      consoleClean,
      architectVerdict,
      deslopPass,
      regressionPass,
    },
  };
}

function buildRoundScorecard(args, promotion, selfCheck) {
  const caps = detectRoundCapabilities(args, selfCheck);
  const hasVerify = caps.verify.length > 0;
  const hasTaskIdentity = Boolean(String(args.surface || "").trim() && String(args.task || "").trim());
  const verifyResult = String(args.verifyResult || "").trim().toLowerCase();
  const runtimeProof = String(args.runtimeProof || "").trim().toLowerCase();
  const consoleClean = String(args.consoleClean || "").trim().toLowerCase();
  const liveClaim = /^(true|yes|1|live)$/i.test(String(args.liveClaim || "").trim());
  const evidence = String(args.evidence || "").trim();
  const hasStrongVerifyEvidence = verifyResult === "pass";
  const hasSomeEvidence = Boolean(evidence || hasStrongVerifyEvidence || runtimeProof === "pass" || runtimeProof === "not-needed");
  const hasLiveProof = !liveClaim || runtimeProof === "pass" || runtimeProof === "not-needed";
  const verifyPasses = hasVerify && args.verdict === "pass";
  const consoleGatePasses = !caps.touchesFrontend || consoleClean === "pass";
  const ralphGate = buildRalphGateResult(args);

  return {
    hallucination_control: hasTaskIdentity && hasVerify && hasStrongVerifyEvidence && hasLiveProof
      ? makeGrade(90, "Surface/task identity is explicit and the round includes recorded verification evidence strong enough for truthful claims.")
      : hasTaskIdentity && hasSomeEvidence
        ? makeGrade(50, "Round identity is explicit but lacks recorded verification evidence for full truthfulness.")
        : hasTaskIdentity
          ? makeGrade(50, "Round identity is explicit, but the scorecard lacks recorded evidence and should not overclaim truthfulness.")
          : makeGrade(20, "Round metadata is too thin to trust claims confidently."),
    task_achievability: verifyPasses
      ? makeGrade(100, "The round has an explicit verify command that passes.")
      : hasVerify
        ? makeGrade(40, "The round has a verify step, but the verdict does not confirm it passes.")
        : makeGrade(30, "No verify step is defined for this round."),
    console_cleanliness: consoleGatePasses
      ? makeGrade(90, caps.touchesFrontend ? "Touched frontend routes reported no newly observed console errors for this round." : "No frontend console-clean gate was required for this round.")
      : makeGrade(35, "Touched frontend files require a console-clean pass based on newly observed route errors before a pass verdict is trustworthy."),
    task_completeness: args.verdict === "pass"
      ? makeGrade(90, "Pass verdict confirms the task is complete.")
      : args.verdict === "must-fix"
        ? makeGrade(30, "Must-fix verdict means the task is not yet complete.")
        : makeGrade(50, "Verdict is neither pass nor must-fix; completeness is uncertain."),
    verification_reliability: verifyPasses
      ? makeGrade(95, "Verify step is present and passes.")
      : hasVerify
        ? makeGrade(60, "Verify step is present but does not pass.")
        : makeGrade(10, "No verify step is defined."),
    ralph_gate: ralphGate.pass
      ? makeGrade(95, "Round-close captured the architect, deslop, and regression gates required for a real Ralph completion.")
      : makeGrade(25, ralphGate.summary),
    promotion_accuracy: makeGrade(50, "Promotion accuracy is not yet tracked over time; defaulting to neutral."),
    time_efficiency: makeGrade(70, "Time efficiency is not yet compared against moving averages; defaulting to neutral."),
  };
}

function updateContextLedger(content, capsule) {
  const heading = `### ${capsule.surface}`;
  const block = [
    heading,
    `- Goal: ${capsule.goal}`,
    `- Changed: ${capsule.changed}`,
    `- Preserve: ${capsule.preserve}`,
    `- Next Risk: ${capsule.risk}`,
    `- Rollback Target: ${capsule.rollback}`,
  ].join("\n");

  const section = extractMarkdownSection(content, "Surface Capsules");
  if (!section) return content;

  const pattern = new RegExp(`^${escapeRegex(heading)}\\r?\\n[\\s\\S]*?(?=^### |\\Z)`, "m");
  const nextSection = pattern.test(section)
    ? section.replace(pattern, `${block}\n\n`)
    : `${block}\n\n${section.trimStart()}`;

  return replaceMarkdownSection(content, "Surface Capsules", nextSection.trimEnd());
}

function renderLoopState(args, promotion) {
  const changeLines = splitList(args.changes).map((item) => `- ${item}`);
  const verifyLines = splitList(args.verify).map((item) => `- ${item}`);
  const nextLines = [];

  if (args.next) nextLines.push(`- ${args.next}`);
  if (promotion.recommended) {
    nextLines.push(
      "- Self-loop remains armed; start the next bounded round immediately unless a human or blocker gate interrupts it.",
      `- ${promotion.recommended.title} (${promotion.recommended.source}) on ${promotion.recommended.surface}.`,
    );
  } else {
    nextLines.push("- Self-loop is exhausted cleanly; no promotable next step found in the queue.");
  }

  return [
    `# Loop State - ${todayDate()}`,
    "",
    "## Summary",
    args.summary,
    "",
    "## Changes",
    ...(changeLines.length ? changeLines : ["- none"]),
    "",
    "## Verification",
    ...(verifyLines.length ? verifyLines : ["- none"]),
    "",
    "## Next Steps",
    ...nextLines,
    "",
  ].join("\n");
}

function updateHumanLoop(content, args, promotion) {
  const nextRound = promotion?.recommended
    ? `${promotion.recommended.title} (${promotion.recommended.source}) on ${promotion.recommended.surface}`
    : "none";
  const selfLoopState = promotion?.recommended
    ? `continue-self-loop - promoted next bounded round: ${promotion.recommended.title}`
    : "stop-exhausted - no promotable next round remains after verification and promotion scan";

  let next = content;
  next = replaceLine(next, /^- Last round verdict:.*$/m, `- Last round verdict: ${args.verdict} - ${args.summary}`);
  next = replaceLine(next, /^- Current owned surface:.*$/m, `- Current owned surface: ${args.surface || "none"}`);
  next = replaceLine(next, /^- Next intended round:.*$/m, `- Next intended round: ${nextRound}`);
  next = replaceLine(next, /^- Self-loop state:.*$/m, `- Self-loop state: ${selfLoopState}`);
  next = replaceLine(next, /^- Reason to continue or stop:.*$/m, `- Self-loop state: ${selfLoopState}`);
  return next;
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function emptyAgentSyncState() {
  return {
    updatedAt: nowIso(),
    activeClaims: [],
    recentlyCompleted: [],
    mustFixQueue: [],
    humanInbox: [],
  };
}

function parseMdAgentItems(sectionText) {
  if (!sectionText || /^\s*-\s*none\s*$/im.test(sectionText)) return [];
  return sectionText
    .split(/\n(?=- Key: )/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const readLine = (label) => {
        const match = block.match(new RegExp(`^\\s*(?:-\\s*)?${label}:[ \\t]*(.+)$`, "m"));
        return match ? match[1].trim() : "";
      };
      const splitPipeList = (value) =>
        value
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean);

      const task = readLine("Task");
      const surface = readLine("Surface");
      return {
        key: normalizeKey(readLine("Key"), surface, task),
        task,
        surface,
        agent: readLine("Agent"),
        owner: readLine("Owner"),
        status: readLine("Status"),
        startedAt: readLine("Started"),
        completedAt: readLine("Completed"),
        verify: splitPipeList(readLine("Verify")),
        files: splitPipeList(readLine("Files")),
        rollbackTarget: readLine("Rollback Target"),
        rollbackFiles: splitPipeList(readLine("Rollback Files")),
        review: readLine("Review"),
        note: readLine("Note"),
        next: readLine("Next"),
      };
    });
}

function loadAgentSyncState(args) {
  const jsonPath = resolveFromRoot(args.agentSyncJson);
  const mdPath = resolveFromRoot(args.agentSyncMd);
  const jsonExists = fs.existsSync(jsonPath);
  const mdExists = fs.existsSync(mdPath);

  if (!jsonExists && !mdExists) return emptyAgentSyncState();

  const jsonMtime = jsonExists ? fs.statSync(jsonPath).mtimeMs : -1;
  const mdMtime = mdExists ? fs.statSync(mdPath).mtimeMs : -1;

  if (mdExists && mdMtime > jsonMtime) {
    const md = fs.readFileSync(mdPath, "utf8");
    const updatedAt = (md.match(/^Updated:\s*(.+)$/m) || [])[1]?.trim() || nowIso();
    return {
      updatedAt,
      activeClaims: parseMdAgentItems(extractMarkdownSection(md, "Active Claims")),
      recentlyCompleted: parseMdAgentItems(extractMarkdownSection(md, "Recently Completed")),
      mustFixQueue: parseMdAgentItems(extractMarkdownSection(md, "Must-Fix Queue")),
      humanInbox: parseMdAgentItems(extractMarkdownSection(md, "Human Inbox")),
    };
  }

  if (jsonExists) {
    try {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      const normalizeItem = (item) => ({
        ...item,
        key: normalizeKey(item?.key, item?.surface || "", item?.task || ""),
      });
      return {
        updatedAt: parsed.updatedAt || nowIso(),
        activeClaims: Array.isArray(parsed.activeClaims) ? parsed.activeClaims.map(normalizeItem) : [],
        recentlyCompleted: Array.isArray(parsed.recentlyCompleted)
          ? parsed.recentlyCompleted.map(normalizeItem)
          : [],
        mustFixQueue: Array.isArray(parsed.mustFixQueue) ? parsed.mustFixQueue.map(normalizeItem) : [],
        humanInbox: Array.isArray(parsed.humanInbox) ? parsed.humanInbox.map(normalizeItem) : [],
      };
    } catch {
      return emptyAgentSyncState();
    }
  }

  return emptyAgentSyncState();
}

function renderAgentSyncItem(item) {
  const lines = [`- Key: ${item.key}`];
  if (item.task) lines.push(`  Task: ${item.task}`);
  if (item.surface) lines.push(`  Surface: ${item.surface}`);
  if (item.agent) lines.push(`  Agent: ${item.agent}`);
  if (item.owner) lines.push(`  Owner: ${item.owner}`);
  if (item.status) lines.push(`  Status: ${item.status}`);
  if (item.startedAt) lines.push(`  Started: ${item.startedAt}`);
  if (item.completedAt) lines.push(`  Completed: ${item.completedAt}`);
  if (item.verify?.length) lines.push(`  Verify: ${item.verify.join(" | ")}`);
  if (item.files?.length) lines.push(`  Files: ${item.files.join(" | ")}`);
  if (item.rollbackTarget) lines.push(`  Rollback Target: ${item.rollbackTarget}`);
  if (item.rollbackFiles?.length) lines.push(`  Rollback Files: ${item.rollbackFiles.join(" | ")}`);
  if (item.review) lines.push(`  Review: ${item.review}`);
  if (item.note) lines.push(`  Note: ${item.note}`);
  if (item.next) lines.push(`  Next: ${item.next}`);
  return lines.join("\n");
}

function renderAgentSyncMarkdown(state) {
  const lines = [
    "# Cross-Agent Sync",
    "",
    `Updated: ${state.updatedAt}`,
    "",
    "Use this file as the shared cross-platform coordination layer for Codex, Claude, and other Hermes-capable agents.",
    "",
    "## Rules",
    "- Read this file before starting queue work, resuming a checkpoint, or reclaiming a user-visible task.",
    "- Claim a task before implementation when the work unit is not trivially local.",
    "- Do not re-pick recently completed work unless there is a recorded must-fix, regression, or explicit user request.",
    "- Reviewer must-fix items outrank fresh speculative ideas.",
    "- Before self-generated follow-up rounds, also read `.workspace/state/HUMAN_LOOP.md` for human steering, pause, or reversal requests.",
    "- Keep entries short and overwrite stale claims instead of appending long history.",
    "",
    "## Active Claims",
  ];

  const renderSection = (items) => {
    if (!items.length) return ["- none", ""];
    const rendered = [];
    items.forEach((item) => {
      rendered.push(renderAgentSyncItem(item));
      rendered.push("");
    });
    return rendered;
  };

  lines.push(...renderSection(state.activeClaims));
  lines.push("## Recently Completed");
  lines.push(...renderSection(state.recentlyCompleted));
  lines.push("## Must-Fix Queue");
  lines.push(...renderSection(state.mustFixQueue));
  lines.push("## Human Inbox");
  lines.push(...renderSection(state.humanInbox));
  return `${lines.join("\n").trimEnd()}\n`;
}

function writeAgentSync(args, key) {
  const state = loadAgentSyncState(args);
  const item = {
    key,
    task: args.task,
    surface: args.surface,
    agent: args.agent,
    owner: args.owner,
    status: args.verdict === "pass" ? "completed" : "must-fix",
    completedAt: args.verdict === "pass" ? nowIso() : "",
    startedAt: args.verdict === "pass" ? "" : nowIso(),
    verify: dedupe(splitList(args.verify)),
    files: dedupe(splitList(args.files)),
    rollbackTarget: args.rollback,
    rollbackFiles: [],
    review: args.review,
    note: args.note,
    next: args.next,
  };

  state.updatedAt = nowIso();
  state.activeClaims = state.activeClaims.filter((entry) => entry.key !== key);
  state.mustFixQueue = state.mustFixQueue.filter((entry) => entry.key !== key);
  state.recentlyCompleted = state.recentlyCompleted.filter((entry) => entry.key !== key);

  if (args.verdict === "pass") state.recentlyCompleted.unshift(item);
  else state.mustFixQueue.unshift(item);

  state.activeClaims = state.activeClaims.slice(0, 20);
  state.recentlyCompleted = state.recentlyCompleted.slice(0, 20);
  state.mustFixQueue = state.mustFixQueue.slice(0, 20);
  state.humanInbox = state.humanInbox.slice(0, 20);

  fs.writeFileSync(resolveFromRoot(args.agentSyncJson), JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(resolveFromRoot(args.agentSyncMd), renderAgentSyncMarkdown(state), "utf8");
}

function loadLoopStateCounters(args) {
  const statePath = resolveFromRoot(args.loopStateJson || ".workspace/state/AUTO_HERMES_LOOP_STATE.json");
  if (!fs.existsSync(statePath)) return { stallCounter: 0, runawayCounter: 0 };
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return {
      stallCounter: typeof parsed.stallCounter === "number" ? parsed.stallCounter : 0,
      runawayCounter: typeof parsed.runawayCounter === "number" ? parsed.runawayCounter : 0,
    };
  } catch {
    return { stallCounter: 0, runawayCounter: 0 };
  }
}

function loadLoopStateSnapshot(args) {
  const statePath = resolveFromRoot(args.loopStateJson || ".workspace/state/AUTO_HERMES_LOOP_STATE.json");
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function computeDurationSeconds(args) {
  const start = String(args.roundStart || "").trim();
  if (!start) return 0;
  try {
    const ms = Date.now() - new Date(start).getTime();
    return ms > 0 ? Math.round(ms / 1000) : 0;
  } catch {
    return 0;
  }
}

function computeMovingAverages(existingContent) {
  if (!existingContent) return "";
  const rounds = [];
  for (const match of existingContent.matchAll(/^## Round (\d+) — \d{4}-\d{2}-\d{2}\s*\n(- Verdict: .+\n- Duration: (\d+)s\n- Problem class: (.+)\n)/gm)) {
    rounds.push({ round: parseInt(match[1]), duration: parseInt(match[3]) || 0, problemClass: match[4].trim() });
  }
  if (rounds.length === 0) return "";
  const byClass = {};
  for (const r of rounds) {
    const cls = r.problemClass || "unknown";
    if (!byClass[cls]) byClass[cls] = { count: 0, totalDuration: 0 };
    byClass[cls].count += 1;
    byClass[cls].totalDuration += r.duration;
  }
  const parts = [];
  for (const [cls, data] of Object.entries(byClass)) {
    const avg = Math.round(data.totalDuration / data.count);
    parts.push(`${cls} rounds averaging ${avg}s`);
  }
  return parts.join("; ");
}

function buildTracePacket(args, key, promotion, controllerResult, selfCheck) {
  const generatedAt = nowIso();
  const blocker = String(args.blocker || "").trim();
  const runtimeProof = String(args.runtimeProof || "").trim();
  const verify = String(args.verify || "").trim();
  const review = String(args.review || "").trim();
  const verdict = String(args.verdict || "").trim();
  const consoleSummary = String(args.consoleSummary || "").trim();
  const consoleObservedCount = Number.parseInt(String(args.consoleObservedCount || "0"), 10) || 0;
  const ralphGate = buildRalphGateResult(args);
  const problemClass = controllerResult?.classification?.problemClass || "unknown";
  const routeShape = controllerResult?.route?.shape || "unknown";
  const successTags = [];
  const failureTags = [];
  const edgeTags = [];
  const structureTags = [];

  if (verify) {
    successTags.push("explicit-verify");
    structureTags.push("verify-before-claim");
  }
  if (routeShape) structureTags.push(routeShape);
  if (controllerResult?.classification?.frontendDesignGateRequired) successTags.push("design-review");
  if (selfCheck?.requiresFix) failureTags.push("self-check-missed");
  if (!runtimeProof) failureTags.push("missing-runtime-proof");
  if (consoleObservedCount > 0) failureTags.push("new-console-errors");
  if (consoleSummary) edgeTags.push("console-gate");
  if (!ralphGate.pass) failureTags.push("ralph-gate-missing");
  if (verdict !== "pass" || review === "must-fix-before-next-round") edgeTags.push("must-fix");
  if (blocker && blocker.toLowerCase() !== "none") edgeTags.push(compactKey(blocker));

  return {
    generatedAt,
    roundId: `${generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${compactKey(key || `${args.surface} ${args.task}`)}`,
    key,
    task: args.task,
    surface: args.surface,
    agent: args.agent,
    owner: args.owner,
    files: dedupe(splitList(args.files)),
    verify,
    verifyResult: String(args.verifyResult || "").trim(),
    runtimeProof,
    consoleClean: String(args.consoleClean || "").trim(),
    consoleSummary,
    consoleObservedCount,
    liveClaim: String(args.liveClaim || "").trim(),
    blocker,
    verdict,
    review,
    note: args.note,
    next: args.next,
    promotionSource: promotion?.recommended?.source || "none",
    recommendedTask: promotion?.recommended?.title || "",
    problemClass,
    routeShape,
    selfCheck: selfCheck
      ? {
          requiresFix: Boolean(selfCheck.requiresFix),
          highestSeverity: selfCheck.highestSeverity || "none",
        }
      : { requiresFix: false, highestSeverity: "none" },
    evidence: {
      successTags: dedupe(successTags),
      failureTags: dedupe(failureTags),
      edgeTags: dedupe(edgeTags),
      structureTags: dedupe(structureTags),
    },
  };
}

function writeObservation(args, promotion, scorecard, controllerResult, selfCheckResult) {
  const auditPath = resolveFromRoot(args.selfEvolvingAudit);
  const existingContent = fs.existsSync(auditPath) ? fs.readFileSync(auditPath, "utf8") : "";

  const round = String(args.round || "").trim() || "1";
  const date = todayDate();
  const taskTitle = String(args.task || args.title || "").trim() || "untitled";
  const verdict = String(args.verdict || "pass").trim();
  const duration = computeDurationSeconds(args);
  const promotionSource = promotion?.recommended?.source || "none";
  const gatePackage = controllerResult ? String(controllerResult.gatePackage || controllerResult.autoDecisionGate || "none") : "none";
  const complexityScore = controllerResult?.classification?.complexity ?? "";
  const problemClass = controllerResult?.classification?.problemClass ?? "";
  const executionShape = controllerResult?.route?.shape ?? "";
  const selfCheckLabel = typeof args.selfCheck === "boolean" && !args.selfCheck
    ? "skip"
    : selfCheckResult?.requiresFix
      ? "fail"
      : "pass";
  const counters = loadLoopStateCounters(args);
  const averages = computeMovingAverages(existingContent);

  const obsNote = averages ? `— ${averages}` : "— recorded by round-close";
  const fixNote = "— none this round";

  const entry = [
    `## Round ${round} — ${date}`,
    "",
    `- Task: ${taskTitle}`,
    `- Verdict: ${verdict}`,
    `- Duration: ${duration}s`,
    `- Promotion path: ${promotionSource}`,
    `- Gate package: ${gatePackage}`,
    `- Complexity score: ${complexityScore}`,
    `- Problem class: ${problemClass}`,
    `- Execution shape: ${executionShape}`,
    `- Self-check: ${selfCheckLabel}`,
    `- Stall counter: ${counters.stallCounter}`,
    `- Runaway counter: ${counters.runawayCounter}`,
    "",
    "### Observation",
    obsNote,
    "",
    "### Candidate Workflow Fix",
    fixNote,
    "",
  ].join("\n");

  const header = "# Self-Evolving Audit\n\nPer-round observations written by auto-hermes-round-close after every round.\n";
  const body = existingContent
    ? existingContent.replace(/^#\s+Self-Evolving Audit\s*\n/, "").replace(/^Per-round observations written by auto-hermes-round-close after every round\.\s*\n/, "").trim()
    : "";

  const newContent = existingContent
    ? `${header}\n${entry}\n${body}\n`
    : `${header}\n${entry}\n`;

  if (args.write) {
    fs.writeFileSync(auditPath, newContent, "utf8");
  }

  return newContent;
}

function appendTelemetry(args, promotion, controllerResult) {
  const telemetryPath = resolveFromRoot(args.telemetryJson);
  const existing = loadJsonFile(args.telemetryJson) || { rounds: [], moving_averages: {}, lastUpdated: "" };

  const round = parseInt(String(args.round || "").trim()) || existing.rounds.length + 1;
  const taskTitle = String(args.task || args.title || "").trim() || "untitled";
  const problemClass = controllerResult?.classification?.problemClass ?? "unknown";
  const executionShape = controllerResult?.route?.shape ?? "unknown";
  const verdict = String(args.verdict || "pass").trim();
  const duration_s = computeDurationSeconds(args);
  const files_changed = splitList(args.files).length;
  const must_fix_count = verdict === "must-fix" ? 1 : 0;
  const gate_package = controllerResult ? String(controllerResult.gatePackage || controllerResult.autoDecisionGate || "none") : "none";
  const complexity_score = controllerResult?.classification?.complexity ?? "";
  const promotion_type = promotion?.recommended ? promotion.recommended.source : "none";

  existing.rounds.push({
    round,
    task: taskTitle,
    problemClass,
    executionShape,
    verdict,
    duration_s,
    files_changed,
    must_fix_count,
    gate_package,
    complexity_score,
    promotion_type,
    timestamp: nowIso(),
  });

  if (existing.rounds.length > 100) {
    existing.rounds = existing.rounds.slice(-100);
  }

  const byClass = {};
  for (const r of existing.rounds) {
    const cls = r.problemClass || "unknown";
    if (!byClass[cls]) byClass[cls] = { durations: [], passes: 0, total: 0 };
    byClass[cls].durations.push(r.duration_s);
    if (r.verdict === "pass") byClass[cls].passes += 1;
    byClass[cls].total += 1;
  }

  existing.moving_averages = {};
  for (const [cls, data] of Object.entries(byClass)) {
    const avgDuration = data.durations.length > 0
      ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
      : 0;
    existing.moving_averages[cls] = {
      avg_duration_s: avgDuration,
      avg_verdict_pass_rate: data.total > 0 ? Math.round((data.passes / data.total) * 100) / 100 : 0,
      avg_promotion_accuracy: 0.5,
    };
  }

  existing.lastUpdated = nowIso();

  fs.writeFileSync(telemetryPath, JSON.stringify(existing, null, 2), "utf8");
}

function autoHermesRunStateDir(rootDir) {
  return path.join(rootDir, ".workspace/state", "auto-hermes-run-state");
}

function isConfirmedEmptyWebsiteAudit(websiteAudit) {
  return Boolean(
    websiteAudit?.attempted
    && String(websiteAudit?.queueState?.status || "").trim() === "confirmed-empty",
  );
}

function normalizeWebsiteAuditMatchString(value) {
  return String(value || "").trim();
}

function normalizeWebsiteAuditMatchFiles(value) {
  const files = Array.isArray(value) ? value : [];
  return files
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .sort();
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function matchesCurrentWebsiteAuditTask(roundControllerResult, websiteAudit) {
  if (!isConfirmedEmptyWebsiteAudit(websiteAudit)) return false;
  if (normalizeWebsiteAuditMatchString(roundControllerResult?.source) !== "website-audit") return false;

  const candidate = websiteAudit?.candidate || {};
  const roundTitle = normalizeWebsiteAuditMatchString(roundControllerResult?.title);
  const roundSurface = normalizeWebsiteAuditMatchString(roundControllerResult?.surface);
  const candidateTitle = normalizeWebsiteAuditMatchString(candidate.title);
  const candidateSurface = normalizeWebsiteAuditMatchString(candidate.surface);
  const roundFiles = normalizeWebsiteAuditMatchFiles(roundControllerResult?.files);
  const candidateFiles = normalizeWebsiteAuditMatchFiles(candidate.files);

  if (candidateTitle && roundTitle && candidateTitle !== roundTitle) return false;
  if (candidateSurface && roundSurface && candidateSurface !== roundSurface) return false;
  if (candidateFiles.length && roundFiles.length && !arraysEqual(candidateFiles, roundFiles)) return false;

  return Boolean(candidateTitle || candidateSurface || candidateFiles.length);
}

function resolveRoundCloseWebsiteAudit(roundControllerResult, loopStateSnapshot) {
  if (isConfirmedEmptyWebsiteAudit(roundControllerResult?.websiteAudit)) {
    return roundControllerResult.websiteAudit;
  }
  if (matchesCurrentWebsiteAuditTask(roundControllerResult, loopStateSnapshot?.websiteAudit)) {
    return loopStateSnapshot.websiteAudit;
  }
  return null;
}

function persistWebsiteAuditOutcome(rootDir, loopStateSnapshot, websiteAudit, reason = "") {
  if (!isConfirmedEmptyWebsiteAudit(websiteAudit)) return null;

  const runId = String(loopStateSnapshot?.auditRunId || "").trim();
  if (!runId) return null;

  const runState = loadAutoHermesRun({ rootDir, runId });
  if (!runState) return null;

  const currentAttempts = Array.isArray(runState.websiteAudit?.attempts) ? runState.websiteAudit.attempts : [];
  const snapshotAttempts = Array.isArray(loopStateSnapshot?.websiteAudit?.attempts)
    ? loopStateSnapshot.websiteAudit.attempts
    : [];
  const alreadyRecorded =
    currentAttempts.length > 0
    && snapshotAttempts.length > 0
    && String(runState.websiteAudit?.lastAttemptAt || "") === String(loopStateSnapshot?.websiteAudit?.lastAttemptAt || "")
    && String(runState.websiteAudit?.lastAuditSummary || "") === String(loopStateSnapshot?.websiteAudit?.lastAuditSummary || "")
    && Number(runState.websiteAudit?.emptyAuditCount || 0) === Number(loopStateSnapshot?.websiteAudit?.emptyAuditCount || 0);

  if (alreadyRecorded) {
    return runState;
  }

  return recordWebsiteAuditAttempt({
    rootDir,
    runId,
    foundCandidate: websiteAudit.usedFallback === true,
    auditSummary: websiteAudit.summary || reason || "",
  });
}

function renderRoundResultMarkdown(roundResult) {
  return [
    "# Auto-Hermes Round Result",
    "",
    `Generated: ${roundResult.generatedAt}`,
    `Task: ${roundResult.task}`,
    `Surface: ${roundResult.surface}`,
    `Verdict: ${roundResult.verdict}`,
    `Review: ${roundResult.review}`,
    `Blocker: ${roundResult.blocker || "none"}`,
    "",
    "## Ralph Gate",
    `Pass: ${roundResult.ralphGate.pass ? "yes" : "no"}`,
    `Summary: ${roundResult.ralphGate.summary}`,
    `Verification: ${roundResult.ralphGate.gates.verification}`,
    `Console Clean: ${roundResult.ralphGate.gates.consoleClean}`,
    `Architect Review: ${roundResult.ralphGate.gates.architectReview}`,
    `Deslop: ${roundResult.ralphGate.gates.deslop}`,
    `Regression: ${roundResult.ralphGate.gates.regression}`,
    "",
    "## Evidence",
    `Verify: ${roundResult.verify || "none"}`,
    `Verify Result: ${roundResult.verifyResult || "none"}`,
    `Runtime Proof: ${roundResult.runtimeProof || "none"}`,
    `Console Summary: ${roundResult.consoleSummary || "none"}`,
    `New Console Errors: ${roundResult.consoleObservedCount ?? 0}`,
    "",
    "## Workflow Error Ledger",
    `File: ${roundResult.errorLedger?.path || DEFAULT_ERROR_LEDGER}`,
    `Open Entries: ${roundResult.errorLedger?.openCount ?? 0}`,
    `Repair Required: ${roundResult.errorLedger?.repairRequiredCount ?? 0}`,
    ...(Array.isArray(roundResult.errorLedger?.brief) ? roundResult.errorLedger.brief : []),
  ].join("\n") + "\n";
}

export function runAutoHermesRoundClose(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : {
    ...parseArgs([]),
    ...rawArgs,
  };
  const workspaceRoot = inferWorkspaceRoot(args);
  const key = compactKey(`${args.surface} ${args.task}`) || "auto-hermes-round-close";
  const tasksPath = resolveFromRoot(args.tasks);
  let taskText = readOptional(args.tasks);
  const roundControllerResult = loadControllerResult(args);
  const loopStateSnapshot = loadLoopStateSnapshot(args);
  const roundWebsiteAudit = resolveRoundCloseWebsiteAudit(roundControllerResult, loopStateSnapshot);
  const selfCheck = args.verdict === "pass" ? runSelfCheck(args) : null;

  if (selfCheck?.requiresFix) {
    const selfCheckTask = createSelfCheckTask(args, selfCheck);
    if (!hasOpenTask(taskText, selfCheckTask.title)) {
      taskText = appendTaskToActiveTasks(taskText, selfCheckTask);
    }
    args.verdict = "must-fix";
    args.review = "self-check-must-fix";
    args.blocker = selfCheck.summary;
  }

  const errorLedgerState = writeAutoHermesErrorLedger({
    rootDir: workspaceRoot,
    ledgerPath: args.errorLedger,
    scan: args.errorLedgerScan,
    write: Boolean(args.write),
  });

  if (args.verdict === "pass" && errorLedgerState.repairRequiredEntries.length > 0) {
    const errorLedgerTask = createErrorLedgerTask(args, errorLedgerState);
    if (errorLedgerTask && !hasOpenTask(taskText, errorLedgerTask.title)) {
      taskText = appendTaskToActiveTasks(taskText, errorLedgerTask);
    }
    const topRepair = errorLedgerState.repairRequiredEntries[0];
    args.verdict = "must-fix";
    args.review = "error-ledger-must-fix";
    args.blocker = `Open Auto-Hermes loader error in ${args.errorLedger}: ${topRepair.id} ${topRepair.summary}`;
  }

  const initialRalphGate = buildRalphGateResult(args);
  if (args.verdict === "pass" && !initialRalphGate.pass) {
    args.verdict = "must-fix";
    args.review = "ralph-gate-must-fix";
    args.blocker = initialRalphGate.summary;
  }

  if (args.verdict === "pass") {
    taskText = retireCompletedActiveTask(taskText, args.task);
  }

  if (args.verdict === "pass" && args.refreshSuggestions) {
    const suggested = runSuggestTasks(args);
    if (suggested) {
      taskText = readOptional(args.tasks);
    }
  }

  if (args.write) {
    fs.writeFileSync(tasksPath, taskText, "utf8");
    if (args.refreshController) {
      runControllerHelper(args);
      const freshControllerResult = loadControllerResult(args);
      const controllerTaskText = readOptional(args.tasks) || taskText;
      const syncedTaskText = syncQueueWithController(controllerTaskText, freshControllerResult);
      if (syncedTaskText !== controllerTaskText) {
        taskText = syncedTaskText;
        fs.writeFileSync(tasksPath, taskText, "utf8");
      } else {
        taskText = controllerTaskText;
      }
    }
  }

  const controllerResult = loadControllerResult(args);
  let promotion = {
    ...choosePromotion(taskText),
    websiteAudit: controllerResult?.websiteAudit || null,
  };

  let promotedTask = promotion.recommended;
  if (args.verdict === "pass" && args.promoteNext) {
    const promoted = promoteRecommendedTask(taskText, promotion);
    if (promoted.changed) {
      taskText = promoted.taskText;
      promotion = {
        ...promotion,
        recommended: promoted.promoted,
        leaders: {
          ...promotion.leaders,
          active: promoted.promoted,
        },
      };
      promotedTask = promoted.promoted;
    }
  }

  const qualityAuditPath = resolveFromRoot(args.qualityAudit);
  const contextLedgerPath = resolveFromRoot(args.contextLedger);
  const loopStatePath = resolveFromRoot(args.loopState);
  const promotionJsonPath = resolveFromRoot(args.promotionJson);
  const promotionMdPath = resolveFromRoot(args.promotionMd);
  const humanLoopPath = resolveFromRoot(args.humanLoop);
  const selfCheckJsonPath = resolveFromRoot(args.selfCheckJson);
  const selfCheckMdPath = resolveFromRoot(args.selfCheckMd);
  const roundResultJsonPath = resolveFromRoot(args.roundResultJson);
  const roundResultMdPath = resolveFromRoot(args.roundResultMd);
  const finalRalphGate = buildRalphGateResult(args);
  const scorecard = buildRoundScorecard(args, promotion, selfCheck);

  writeObservation(args, promotion, scorecard, controllerResult, selfCheck);

  const qualityAuditNext = updateQualityAudit(readOptional(args.qualityAudit), {
    surface: args.surface,
    verdict: args.verdict,
    blocker: args.blocker || "none",
    rollback: args.rollback || "working tree before this round",
    scorecard,
  });

  const contextLedgerNext = updateContextLedger(readOptional(args.contextLedger), {
    surface: args.surface,
    goal: args.goal,
    changed: args.summary,
    preserve: args.preserve,
    risk: args.risk,
    rollback: args.rollback || "working tree before this round",
  });

  const loopStateNext = renderLoopState(args, promotion);
  const humanLoopNext = updateHumanLoop(readOptional(args.humanLoop), args, promotion);

  const result = {
    generatedAt: nowIso(),
    key,
    surface: args.surface,
    task: args.task,
    verdict: args.verdict,
    review: args.review,
    outputs: {
      qualityAudit: qualityAuditPath,
      contextLedger: contextLedgerPath,
      loopState: loopStatePath,
      agentSyncMd: resolveFromRoot(args.agentSyncMd),
      agentSyncJson: resolveFromRoot(args.agentSyncJson),
      selfCheckJson: selfCheckJsonPath,
      selfCheckMd: selfCheckMdPath,
      roundResultJson: roundResultJsonPath,
      roundResultMd: roundResultMdPath,
      traceToSkillJson: resolveFromRoot(args.traceToSkillJson),
      traceToSkillMd: resolveFromRoot(args.traceToSkillMd),
      promotionJson: promotionJsonPath,
      promotionMd: promotionMdPath,
      controllerJson: resolveFromRoot(args.controllerJson),
      controllerMd: resolveFromRoot(args.controllerMd),
      loopJson: resolveFromRoot(args.loopJson),
      loopMd: resolveFromRoot(args.loopMd),
      coordinatorJson: resolveFromRoot(args.coordinatorJson),
      coordinatorMd: resolveFromRoot(args.coordinatorMd),
      promptFile: resolveFromRoot(args.promptFile),
      finishJson: resolveFromRoot(args.finishJson),
      finishMd: resolveFromRoot(args.finishMd),
      selfEvolvingAudit: resolveFromRoot(args.selfEvolvingAudit),
      errorLedger: errorLedgerState.path,
    },
    selfCheck,
    errorLedger: {
      path: errorLedgerState.path,
      openCount: errorLedgerState.summary.openCount,
      repairRequiredCount: errorLedgerState.summary.repairRequiredCount,
      topRepair: errorLedgerState.summary.topRepair,
    },
    ralphGate: finalRalphGate,
    scorecard,
    promotion,
    promotedTask,
  };

  const roundResult = {
    generatedAt: result.generatedAt,
    key,
    task: args.task,
    surface: args.surface,
    verdict: args.verdict,
    review: args.review,
    blocker: args.blocker || "none",
    verify: args.verify,
    verifyResult: args.verifyResult,
    runtimeProof: args.runtimeProof,
    consoleSummary: args.consoleSummary,
    consoleObservedCount: args.consoleObservedCount,
    errorLedger: {
      path: errorLedgerState.path,
      openCount: errorLedgerState.summary.openCount,
      repairRequiredCount: errorLedgerState.summary.repairRequiredCount,
      brief: renderAutoHermesErrorLedgerBrief(errorLedgerState.entries, args.errorLedger),
    },
    ralphGate: finalRalphGate,
  };

  if (args.write) {
    fs.writeFileSync(tasksPath, taskText, "utf8");
    fs.writeFileSync(qualityAuditPath, qualityAuditNext, "utf8");
    fs.writeFileSync(contextLedgerPath, contextLedgerNext, "utf8");
    fs.writeFileSync(loopStatePath, loopStateNext, "utf8");
    fs.writeFileSync(humanLoopPath, humanLoopNext, "utf8");
    if (selfCheck) {
      fs.writeFileSync(selfCheckJsonPath, JSON.stringify(selfCheck, null, 2), "utf8");
      fs.writeFileSync(selfCheckMdPath, renderAutoHermesSelfCheckMarkdown(selfCheck), "utf8");
    }
    fs.writeFileSync(roundResultJsonPath, JSON.stringify(roundResult, null, 2), "utf8");
    fs.writeFileSync(roundResultMdPath, renderRoundResultMarkdown(roundResult), "utf8");
    try {
      writeTracePacketArtifacts({
        rootDir: workspaceRoot,
        packet: buildTracePacket(args, key, promotion, controllerResult, selfCheck),
        roundsDir: args.traceToSkillRoundsDir,
        outputJson: args.traceToSkillJson,
        outputMd: args.traceToSkillMd,
      });
    } catch {
      // Trace-to-skill refresh is advisory and must not block normal round-close writeback.
    }
    persistWebsiteAuditOutcome(workspaceRoot, loopStateSnapshot, roundWebsiteAudit, roundControllerResult?.reason || "");
    fs.writeFileSync(promotionJsonPath, JSON.stringify(promotion, null, 2), "utf8");
    fs.writeFileSync(promotionMdPath, renderPromotionMarkdown(promotion), "utf8");
    writeAgentSync(args, key);
    if (args.refreshFinish && args.verdict === "pass") runFinishHelper(args, promotion);
    if (args.refreshController) runControllerHelper(args);
    if (args.refreshLoopBriefs) runLoopHelper(args);
    appendTelemetry(args, promotion, controllerResult);
  }

  if (args.json) {
    return {
      result,
      output: `${JSON.stringify(result, null, 2)}\n`,
    };
  }

  return {
    result,
    output: renderPromotionMarkdown(promotion),
  };
}

function main() {
  const { output } = runAutoHermesRoundClose(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
