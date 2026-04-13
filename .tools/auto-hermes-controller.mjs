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
    refreshSuggestions: true,
    tasks: "TASKS.md",
    humanLoop: ".ai-sync/HUMAN_LOOP.md",
    agentSync: ".ai-sync/AGENT_SYNC.md",
    contextLedger: ".ai-sync/CONTEXT_LEDGER.md",
    loopState: ".ai-sync/LOOP_STATE.md",
    outputJson: ".ai-sync/AUTO_HERMES_CONTROLLER.json",
    outputMd: ".ai-sync/AUTO_HERMES_CONTROLLER.md",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--no-refresh-suggestions") args.refreshSuggestions = false;
    else if (arg === "--tasks") args.tasks = argv[++i] || args.tasks;
    else if (arg === "--human-loop") args.humanLoop = argv[++i] || args.humanLoop;
    else if (arg === "--agent-sync") args.agentSync = argv[++i] || args.agentSync;
    else if (arg === "--context-ledger") args.contextLedger = argv[++i] || args.contextLedger;
    else if (arg === "--loop-state") args.loopState = argv[++i] || args.loopState;
    else if (arg === "--output-json") args.outputJson = argv[++i] || args.outputJson;
    else if (arg === "--output-md") args.outputMd = argv[++i] || args.outputMd;
  }
  return args;
}

function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
}

function readOptional(relPath) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf8");
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

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function isRepoTasksPath(relPath) {
  return resolveFromRoot(relPath) === resolveFromRoot("TASKS.md");
}

function runSuggestTasks(tasksPath) {
  if (!isRepoTasksPath(tasksPath)) return false;
  const helperPath = resolveFromRoot(".tools/suggest-tasks.mjs");
  if (!fs.existsSync(helperPath)) return false;
  try {
    runNodeScript(helperPath, ["--write", "--max", "1", "--quiet"]);
    return true;
  } catch {
    return false;
  }
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
    const sec = line.match(/^###\s+(.+)$/);
    if (sec) {
      sectionName = sec[1].trim();
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
  if (!section) return replaceMarkdownSection(taskText, "Active Tasks", `${block}\n`);
  return replaceMarkdownSection(taskText, "Active Tasks", `${section}\n${block}\n`);
}

function promoteLeaderToActive(taskText) {
  const active = parseTaskBlocks(taskText, "Active Tasks").filter((task) => !task.checked);
  if (active.length) return { changed: false, taskText, promoted: null };

  const suggested = parseTaskBlocks(taskText, "Suggested Next Tasks").filter((task) => !task.checked);
  const techDebt = parseTaskBlocks(taskText, "Tech Debt Tasks").filter((task) => !task.checked);
  const sourceHeading = suggested.length ? "Suggested Next Tasks" : techDebt.length ? "Tech Debt Tasks" : "";
  const candidate = suggested[0] || techDebt[0] || null;
  if (!sourceHeading || !candidate) return { changed: false, taskText, promoted: null };

  const sourceSection = extractMarkdownSection(taskText, sourceHeading);
  const updatedSource = removeTaskBlock(sourceSection, candidate);
  const nextTaskText = appendTaskToActiveTasks(
    replaceMarkdownSection(taskText, sourceHeading, updatedSource || ""),
    candidate,
  );

  return {
    changed: true,
    taskText: nextTaskText,
    promoted: candidate,
    sourceHeading,
  };
}

function helperValue(task, key) {
  const prefix = `${key}:`;
  const hit = task.helpers.find((line) => line.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : "";
}

function parseHumanLoop(text) {
  const currentStatusSection = extractMarkdownSection(text, "Current Status");
  const agentModeSection = extractMarkdownSection(text, "Agent Mode");
  const agentWritebackSection = extractMarkdownSection(text, "Agent Writeback Format");
  const statusMatch = currentStatusSection.match(/^- Status:\s*(.+)$/m);
  const modeMatch = agentModeSection.match(/^- Mode:\s*(.+)$/m);
  const currentSurfaceMatch = agentWritebackSection.match(/^- Current owned surface:\s*(.+)$/m);
  const nextRoundMatch = agentWritebackSection.match(/^- Next intended round:\s*(.+)$/m);
  const explicitMustAsk =
    /\bStatus:\s*must-ask\b/i.test(currentStatusSection) ||
    /\bmust-ask\b/i.test(extractMarkdownSection(text, "Human Requests")) ||
    /\bmust-ask\b/i.test(extractMarkdownSection(text, "Priority Overrides"));
  return {
    status: statusMatch ? statusMatch[1].trim() : "unknown",
    mode: modeMatch ? modeMatch[1].trim() : "unknown",
    currentOwnedSurface: currentSurfaceMatch ? currentSurfaceMatch[1].trim() : "",
    nextIntendedRound: nextRoundMatch ? nextRoundMatch[1].trim() : "",
    mustAsk: explicitMustAsk,
    pause: /\bStatus:\s*pause\b/i.test(text),
    stop: /\bStatus:\s*stop\b/i.test(text),
  };
}

function parseActiveClaims(mdText) {
  const section = extractMarkdownSection(mdText, "Active Claims");
  if (!section || /^\s*-\s*none\s*$/im.test(section)) return [];
  const entries = section
    .split(/\n(?=- Key: )/g)
    .map((block) => block.trim())
    .filter(Boolean);
  return entries.map((block) => {
    const task = (block.match(/^\s*Task:\s*(.+)$/m) || [])[1] || "";
    const surface = (block.match(/^\s*Surface:\s*(.+)$/m) || [])[1] || "";
    const files = (block.match(/^\s*Files:\s*(.+)$/m) || [])[1] || "";
    return {
      task: task.trim(),
      surface: surface.trim(),
      files: files
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  });
}

function parseSurfaceCapsules(mdText) {
  const capsules = [];
  const matches = mdText.matchAll(/^###\s+(.+)$/gm);
  const headers = [...matches];
  for (let i = 0; i < headers.length; i += 1) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : mdText.length;
    const block = mdText.slice(start, end);
    const surface = headers[i][1].trim();
    const goal = (block.match(/^- Goal:\s*(.+)$/m) || [])[1] || "";
    capsules.push({ surface, goal: goal.trim() });
  }
  return capsules;
}

function normalizeFiles(filesValue) {
  return filesValue
    .split(",")
    .flatMap((item) => item.split("||"))
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

function inferSurface(task, humanLoop, capsules, activeClaims) {
  const explicit = helperValue(task, "Surface");
  if (explicit) return explicit;
  const files = normalizeFiles(helperValue(task, "Files"));
  const matchingClaim = activeClaims.find((claim) => {
    const overlappingFile = claim.files.some((file) => files.includes(file));
    const titleOverlap = task.title && claim.task && claim.task.toLowerCase().includes(task.title.toLowerCase().replace(/`/g, ""));
    return overlappingFile || titleOverlap;
  });
  if (matchingClaim?.surface) return matchingClaim.surface;
  const context = helperValue(task, "Context");
  const haystack = `${task.title} ${context} ${humanLoop.currentOwnedSurface} ${humanLoop.nextIntendedRound}`;
  const capsule = capsules.find((entry) => haystack.toLowerCase().includes(entry.surface.toLowerCase()));
  if (capsule) return capsule.surface;
  return humanLoop.currentOwnedSurface || task.section || "unknown";
}

function classifyRound(task, surface) {
  const files = normalizeFiles(helperValue(task, "Files"));
  const verify = helperValue(task, "Verify");
  const context = helperValue(task, "Context");
  const combined = `${task.title} ${context} ${verify} ${surface}`;
  const fileCount = files.length;
  const touchesFrontend = files.some((file) => file.includes("frontend/"));
  const touchesBackend = files.some((file) => file.includes("backend/"));
  const touchesDocsOnly = files.length > 0 && files.every((file) => !file.includes("frontend/") && !file.includes("backend/"));
  const crossStack = touchesFrontend && touchesBackend;
  const reviewSensitive =
    /review|audit|regression|trust|verify|hardening|resilience|fix broken|repair/i.test(combined) ||
    /runtime sync|http:\/\/localhost:8080|compile|build/i.test(verify);
  const broad =
    /work through|fix the broken part|wire.*together|full|broad|system|architecture/i.test(combined) ||
    fileCount > 4;
  const tiny =
    !crossStack &&
    !reviewSensitive &&
    !broad &&
    (fileCount === 0 || fileCount <= 1) &&
    !/rebuild|redesign|shell|route/i.test(combined);

  let complexity = 0;
  if (fileCount > 3) complexity += 1;
  if (crossStack) complexity += 2;
  if (reviewSensitive) complexity += 1;
  if (broad) complexity += 1;
  if (/translation|i18n/i.test(combined)) complexity += 1;

  return {
    files,
    fileCount,
    touchesFrontend,
    touchesBackend,
    touchesDocsOnly,
    crossStack,
    reviewSensitive,
    broad,
    tiny,
    complexity,
  };
}

function routeRound(classification, humanLoop) {
  const reasons = [];
  let shape = "single-agent";
  let visibleMultiAgent = false;
  let recommendedAgents = [];

  if (humanLoop.pause || humanLoop.stop) {
    return {
      shape: "paused",
      visibleMultiAgent: false,
      recommendedAgents: [],
      reasons: [`human loop status is ${humanLoop.status}`],
    };
  }

  if (classification.tiny) {
    reasons.push("task scoped as tiny local work");
    return {
      shape,
      visibleMultiAgent,
      recommendedAgents,
      reasons,
    };
  }

  if (classification.crossStack) {
    shape = "parallel-builders";
    visibleMultiAgent = true;
    recommendedAgents = ["frontend-agent", "backend-agent"];
    reasons.push("task touches both frontend and backend");
    reasons.push("visible multi-agent policy prefers real parallel builders for bounded cross-stack work");
    return { shape, visibleMultiAgent, recommendedAgents, reasons };
  }

  if (classification.broad) {
    shape = "single-specialist";
    visibleMultiAgent = true;
    recommendedAgents = ["planning-agent"];
    reasons.push("task is broad enough to benefit from decomposition first");
    reasons.push("visible multi-agent policy prefers at least one spawned specialist on non-tiny work");
    return { shape, visibleMultiAgent, recommendedAgents, reasons };
  }

  if (classification.reviewSensitive) {
    shape = "pm-builder-reviewer";
    visibleMultiAgent = true;
    recommendedAgents = classification.touchesBackend
      ? ["reviewer-agent", "backend-agent"]
      : ["reviewer-agent", "frontend-agent"];
    reasons.push("task is review-sensitive or verification-heavy");
    reasons.push("visible multi-agent policy prefers a real reviewer lane on non-tiny work");
    return { shape, visibleMultiAgent, recommendedAgents, reasons };
  }

  if (classification.touchesBackend) {
    shape = "single-specialist";
    visibleMultiAgent = true;
    recommendedAgents = ["backend-agent"];
    reasons.push("task is bounded backend work");
    reasons.push("visible multi-agent policy prefers one real spawned specialist");
    return { shape, visibleMultiAgent, recommendedAgents, reasons };
  }

  if (classification.touchesFrontend || classification.touchesDocsOnly) {
    shape = "single-specialist";
    visibleMultiAgent = true;
    recommendedAgents = [classification.touchesDocsOnly ? "planning-agent" : "frontend-agent"];
    reasons.push(classification.touchesDocsOnly ? "task is workflow/control-plane work" : "task is bounded frontend work");
    reasons.push("visible multi-agent policy prefers one real spawned specialist");
    return { shape, visibleMultiAgent, recommendedAgents, reasons };
  }

  reasons.push("defaulted to local execution due to low-confidence ownership");
  return { shape, visibleMultiAgent, recommendedAgents, reasons };
}

function buildSubagentPlan(route, classification) {
  const agents = Array.isArray(route?.recommendedAgents) ? route.recommendedAgents.filter(Boolean) : [];
  const plan = {
    useCodexSubagents: false,
    coordinatorMode: route?.visibleMultiAgent ? "coordinator-with-subagents" : "local-coordinator-only",
    lanes: [],
    spawnOrder: [],
    parallelGroups: [],
    notes: [],
  };

  if (!route || route.shape === "paused") {
    plan.notes.push("human loop pause/stop gate blocks subagent dispatch");
    return plan;
  }

  if (!route.visibleMultiAgent || !agents.length) {
    plan.notes.push("task stays local because delegation would cost more than execution");
    return plan;
  }

  plan.useCodexSubagents = true;
  plan.spawnOrder = [...agents];

  if (route.shape === "parallel-builders") {
    plan.parallelGroups.push([...agents]);
    for (const agent of agents) {
      plan.lanes.push({
        agent,
        mode: "parallel",
        ownership: agent === "frontend-agent" ? "frontend files only" : "backend files only",
      });
    }
    plan.notes.push("spawn frontend/backend builders together only because the round is bounded cross-stack");
    plan.notes.push("keep file ownership disjoint and reunify verification in the coordinator");
    return plan;
  }

  for (let index = 0; index < agents.length; index += 1) {
    const agent = agents[index];
    plan.lanes.push({
      agent,
      mode: "sequential",
      ownership:
        agent === "frontend-agent"
          ? "frontend files only"
          : agent === "backend-agent"
            ? "backend files only"
            : "analysis/review/planning only",
    });
  }

  if (route.shape === "pm-builder-reviewer") {
    plan.notes.push("review-sensitive work should use a real reviewer lane before or alongside the owning builder");
  }
  if (classification?.broad) {
    plan.notes.push("planning lane should shrink the round before builder work expands");
  }
  if (classification?.touchesFrontend && !classification?.touchesBackend) {
    plan.notes.push("frontend specialist owns implementation; coordinator keeps final verification local");
  }
  if (classification?.touchesBackend && !classification?.touchesFrontend) {
    plan.notes.push("backend specialist owns implementation; coordinator keeps final verification local");
  }

  return plan;
}

function chooseWorkUnit(taskText, humanLoop, activeClaimsText, contextLedgerText) {
  const activeTasks = parseTaskBlocks(taskText, "Active Tasks").filter((task) => !task.checked);
  const suggested = parseTaskBlocks(taskText, "Suggested Next Tasks").filter((task) => !task.checked);
  const techDebt = parseTaskBlocks(taskText, "Tech Debt Tasks").filter((task) => !task.checked);
  const capsules = parseSurfaceCapsules(contextLedgerText);
  const activeClaims = parseActiveClaims(activeClaimsText);

  let source = "active-task";
  let task = activeTasks[0] || null;
  if (!task) {
    task = suggested[0] || null;
    source = "suggested-task";
  }
  if (!task) {
    task = techDebt[0] || null;
    source = "tech-debt";
  }
  if (!task) {
    return {
      stop: true,
      reason: "no active, suggested, or tech-debt task is currently promotable",
      activeClaims,
      humanLoop,
    };
  }

  const surface = inferSurface(task, humanLoop, capsules, activeClaims);
  const classification = classifyRound(task, surface);
  const route = routeRound(classification, humanLoop);
  const subagentPlan = buildSubagentPlan(route, classification);

  return {
    stop: route.shape === "paused",
    source,
    title: task.title,
    section: task.section || "",
    surface,
    files: classification.files,
    context: helperValue(task, "Context"),
    doneWhen: helperValue(task, "Done when"),
    verify: helperValue(task, "Verify"),
    blocker: helperValue(task, "Blocker"),
    classification,
    route,
    subagentPlan,
    activeClaims,
    humanLoop,
  };
}

function renderMarkdown(result) {
  if (result.stop && !result.title) {
    return [
      "# Auto-Hermes Controller",
      "",
      `Decision: stop-exhausted`,
      `Reason: ${result.reason}`,
      "",
      `Human Loop Status: ${result.humanLoop.status}`,
    ].join("\n") + "\n";
  }

  const lines = [
    "# Auto-Hermes Controller",
    "",
    `Decision: ${result.stop ? "pause-self-loop" : "continue-self-loop"}`,
    `Work Unit Source: ${result.source}`,
    `Title: ${result.title}`,
    `Surface: ${result.surface}`,
    `Round Shape: ${result.route.shape}`,
    `Visible Multi-Agent: ${result.route.visibleMultiAgent ? "yes" : "no"}`,
    `Recommended Agents: ${result.route.recommendedAgents.length ? result.route.recommendedAgents.join(", ") : "none"}`,
    `Use Codex Subagents: ${result.subagentPlan.useCodexSubagents ? "yes" : "no"}`,
    "",
    "## Why",
    ...result.route.reasons.map((reason) => `- ${reason}`),
    "",
    "## Subagent Plan",
    `- coordinator mode: ${result.subagentPlan.coordinatorMode}`,
    `- spawn order: ${result.subagentPlan.spawnOrder.length ? result.subagentPlan.spawnOrder.join(" -> ") : "none"}`,
    `- parallel groups: ${result.subagentPlan.parallelGroups.length ? result.subagentPlan.parallelGroups.map((group) => group.join(" + ")).join(" | ") : "none"}`,
    ...result.subagentPlan.lanes.map((lane) => `- ${lane.agent}: ${lane.mode}, ${lane.ownership}`),
    ...result.subagentPlan.notes.map((note) => `- note: ${note}`),
    "",
    "## Inputs",
    `- Files: ${result.files.length ? result.files.join(" | ") : "not specified"}`,
    `- Context: ${result.context || "none"}`,
    `- Done when: ${result.doneWhen || "none"}`,
    `- Verify: ${result.verify || "none"}`,
    "",
    "## Signals",
    `- tiny: ${result.classification.tiny}`,
    `- broad: ${result.classification.broad}`,
    `- reviewSensitive: ${result.classification.reviewSensitive}`,
    `- crossStack: ${result.classification.crossStack}`,
    `- touchesFrontend: ${result.classification.touchesFrontend}`,
    `- touchesBackend: ${result.classification.touchesBackend}`,
    `- complexity: ${result.classification.complexity}`,
    "",
    "## Human Loop",
    `- status: ${result.humanLoop.status}`,
    `- mode: ${result.humanLoop.mode}`,
    `- current owned surface: ${result.humanLoop.currentOwnedSurface || "none"}`,
    `- next intended round: ${result.humanLoop.nextIntendedRound || "none"}`,
  ];

  if (result.activeClaims.length) {
    lines.push("", "## Active Claims");
    for (const claim of result.activeClaims) {
      lines.push(`- ${claim.surface || "unknown"} :: ${claim.task || "unknown task"}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const humanLoopText = readOptional(args.humanLoop);
  const agentSyncText = readOptional(args.agentSync);
  const contextLedgerText = readOptional(args.contextLedger);
  const loopStateText = readOptional(args.loopState);
  const humanLoop = parseHumanLoop(humanLoopText);
  const tasksPath = resolveFromRoot(args.tasks);
  let taskText = readOptional(args.tasks);
  const canMutateQueue = isRepoTasksPath(args.tasks) && args.write;
  if (canMutateQueue) {
    const promoted = promoteLeaderToActive(taskText);
    if (promoted.changed) {
      taskText = promoted.taskText;
      fs.writeFileSync(tasksPath, taskText, "utf8");
    }
  }
  let result = chooseWorkUnit(taskText, humanLoop, agentSyncText, contextLedgerText);

  if (
    result.stop
    && !result.title
    && args.refreshSuggestions
    && !humanLoop.pause
    && !humanLoop.stop
    && !humanLoop.mustAsk
    && humanLoop.mode === "autonomous-loop"
  ) {
    const seeded = runSuggestTasks(args.tasks);
    if (seeded) {
      taskText = readOptional(args.tasks);
      if (canMutateQueue) {
        const promoted = promoteLeaderToActive(taskText);
        if (promoted.changed) {
          taskText = promoted.taskText;
          fs.writeFileSync(tasksPath, taskText, "utf8");
        }
      }
      result = chooseWorkUnit(taskText, humanLoop, agentSyncText, contextLedgerText);
      result.seededFromSuggestions = true;
    }
  }

  result.generatedAt = new Date().toISOString();
  result.loopStateSummary = loopStateText.split(/\r?\n/).slice(0, 8).join("\n");
  result.loopDecision = result.stop
    ? (result.title ? "pause-self-loop" : "stop-exhausted")
    : "continue-self-loop";

  if (args.write) {
    const jsonPath = resolveFromRoot(args.outputJson);
    const mdPath = resolveFromRoot(args.outputMd);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");
    fs.writeFileSync(mdPath, renderMarkdown(result), "utf8");
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderMarkdown(result));
}

main();
