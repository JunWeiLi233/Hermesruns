#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  renderAutoHermesSelfCheckMarkdown,
  runAutoHermesSelfCheck,
} from "./auto-hermes-self-check.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    refreshController: true,
    refreshFinish: true,
    refreshSuggestions: true,
    promoteNext: true,
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
    qualityAudit: ".ai-sync/QUALITY_AUDIT.md",
    contextLedger: ".ai-sync/CONTEXT_LEDGER.md",
    loopState: ".ai-sync/LOOP_STATE.md",
    tasks: "TASKS.md",
    humanLoop: ".ai-sync/HUMAN_LOOP.md",
    selfCheck: true,
    selfCheckJson: ".ai-sync/AUTO_HERMES_SELF_CHECK.json",
    selfCheckMd: ".ai-sync/AUTO_HERMES_SELF_CHECK.md",
    promotionJson: ".ai-sync/AUTO_HERMES_PROMOTION.json",
    promotionMd: ".ai-sync/AUTO_HERMES_PROMOTION.md",
    controllerJson: ".ai-sync/AUTO_HERMES_CONTROLLER.json",
    controllerMd: ".ai-sync/AUTO_HERMES_CONTROLLER.md",
    finishJson: ".ai-sync/AUTO_HERMES_FINISH.json",
    finishMd: ".ai-sync/AUTO_HERMES_FINISH.md",
    agentSyncMd: ".ai-sync/AGENT_SYNC.md",
    agentSyncJson: ".ai-sync/AGENT_SYNC.json",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--no-refresh-controller") args.refreshController = false;
    else if (arg === "--no-refresh-finish") args.refreshFinish = false;
    else if (arg === "--no-refresh-suggestions") args.refreshSuggestions = false;
    else if (arg === "--no-promote-next") args.promoteNext = false;
    else if (arg === "--no-self-check") args.selfCheck = false;
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

function readOptional(relPath) {
  const fullPath = resolveFromRoot(relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function nowIso() {
  return new Date().toISOString();
}

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
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
      stdio: options.stdio || "ignore",
      encoding: options.encoding,
    },
  );
}

function runFinishHelper(args) {
  const helperPath = resolveFromRoot(".tools/auto-hermes-finish.mjs");
  if (!fs.existsSync(helperPath)) return;
  const commandArgs = [
    helperPath,
    "--write",
    "--task", args.task || "",
    "--surface", args.surface || "",
    "--summary", args.summary || "",
    "--files", args.files || "",
    "--verify", args.verify || "",
    "--output-json", args.finishJson,
    "--output-md", args.finishMd,
  ];
  try {
    runNodeScript(helperPath, commandArgs.slice(1));
  } catch {
    // Finish briefs should not block queue/state writeback.
  }
}

function runControllerHelper(args) {
  const helperPath = resolveFromRoot(".tools/auto-hermes-controller.mjs");
  if (!fs.existsSync(helperPath)) return;
  const commandArgs = [
    helperPath,
    "--write",
    "--tasks", args.tasks,
    "--human-loop", args.humanLoop,
    "--agent-sync", args.agentSyncMd,
    "--context-ledger", args.contextLedger,
    "--loop-state", args.loopState,
    "--output-json", args.controllerJson,
    "--output-md", args.controllerMd,
  ];
  if (!args.refreshSuggestions) commandArgs.push("--no-refresh-suggestions");
  try {
    runNodeScript(helperPath, commandArgs.slice(1));
  } catch {
    // Controller refresh should not block deterministic writeback.
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

function normalizeFiles(value) {
  return String(value || "")
    .split(",")
    .flatMap((item) => item.split("||"))
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

function inferSurface(task) {
  const explicit = helperValue(task, "Surface");
  if (explicit) return explicit;
  const title = task.title.toLowerCase();
  if (title.includes("predictiondetail")) return "Prediction Detail / race prediction page";
  if (title.includes("rewards")) return "Rewards / badges page";
  return task.section || "unknown";
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
  const helperPath = resolveFromRoot(".tools/suggest-tasks.mjs");
  if (!fs.existsSync(helperPath)) return false;
  try {
    runNodeScript(helperPath, ["--write", "--max", "1", "--quiet"]);
    return true;
  } catch {
    return false;
  }
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
      `Verify: & 'C:\\Program Files\\nodejs\\node.exe' .tools/auto-hermes-self-check.mjs --json --files "${scannedFiles.join("||")}" --surface "${args.surface || ""}" --task "${args.task || ""}"`,
    ],
    section: "",
  };
}

function hasOpenTask(taskText, title) {
  return parseTaskBlocks(taskText, "Active Tasks")
    .filter((task) => !task.checked)
    .some((task) => task.title === title);
}

function updateQualityAudit(content, entry) {
  const section = extractMarkdownSection(content, "Latest Verdicts");
  const blocks = section
    .split(/\n(?=- surface: )/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !block.startsWith(`- surface: ${entry.surface}`));

  const newBlock = [
    `- surface: ${entry.surface}`,
    `  verdict: ${entry.verdict}`,
    `  blocker_or_must_fix: ${entry.blocker}`,
    `  rollback_target: ${entry.rollback}`,
  ].join("\n");

  return replaceMarkdownSection(content, "Latest Verdicts", [newBlock, ...blocks].join("\n"));
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
  next = replaceLine(next, /^- Current owned surface:.*$/m, `- Current owned surface: ${promotion?.recommended ? promotion.recommended.surface : "none"}`);
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
    "- Before self-generated follow-up rounds, also read `.ai-sync/HUMAN_LOOP.md` for human steering, pause, or reversal requests.",
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = compactKey(`${args.surface} ${args.task}`) || "auto-hermes-round-close";
  const tasksPath = resolveFromRoot(args.tasks);
  let taskText = readOptional(args.tasks);
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

  if (args.verdict === "pass") {
    taskText = retireCompletedActiveTask(taskText, args.task);
  }

  if (args.verdict === "pass" && args.refreshSuggestions) {
    const suggested = runSuggestTasks(args);
    if (suggested) {
      taskText = readOptional(args.tasks);
    }
  }

  let promotion = choosePromotion(taskText);

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

  const qualityAuditNext = updateQualityAudit(readOptional(args.qualityAudit), {
    surface: args.surface,
    verdict: args.verdict,
    blocker: args.blocker || "none",
    rollback: args.rollback || "working tree before this round",
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
      promotionJson: promotionJsonPath,
      promotionMd: promotionMdPath,
      controllerJson: resolveFromRoot(args.controllerJson),
      controllerMd: resolveFromRoot(args.controllerMd),
      finishJson: resolveFromRoot(args.finishJson),
      finishMd: resolveFromRoot(args.finishMd),
    },
    selfCheck,
    promotion,
    promotedTask,
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
    fs.writeFileSync(promotionJsonPath, JSON.stringify(promotion, null, 2), "utf8");
    fs.writeFileSync(promotionMdPath, renderPromotionMarkdown(promotion), "utf8");
    writeAgentSync(args, key);
    if (args.refreshFinish && args.verdict === "pass") runFinishHelper(args);
    if (args.refreshController) runControllerHelper(args);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderPromotionMarkdown(promotion));
}

main();
