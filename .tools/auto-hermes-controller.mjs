#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inferStackFromTask, inferSurfaceFromTask, normalizeFiles } from "./auto-hermes-task-meta.mjs";
import { makeClaim, renderClaimMarkdown } from "./auto-hermes-claim-state.mjs";
import { buildFrontendConsoleGatePlan } from "./auto-hermes-console-gate.mjs";
import { listFreshTaskClaims, taskClaimKey } from "./auto-hermes-task-claims.mjs";
import { loadVoltAgentCatalog, recommendVoltAgentSpecialists } from "./auto-hermes-subagent-catalog.mjs";
import { runAutoHermesWebsiteAudit } from "./auto-hermes-website-audit.mjs";
import { inferWorkflowComposition } from "./auto-hermes-composition-patterns.mjs";
import { buildAutoHermesSkillsManifest } from "./auto-hermes-skills.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const HARDCODED_DEFAULTS = {
  gates: {
    minor_fix: { required: ["EG", "SP", "tiny_QA"], complexity_threshold: 2 },
    milestone: { required: ["SIG", "FIG", "SE7"], complexity_threshold: 4 },
    epic: { required: ["SIG", "CPG", "FIG", "SE7"], complexity_threshold: 7 },
  },
  complexity: {
    files_touched_weight: 1,
    duplication_weight: 1,
    state_complexity_weight: 1,
    translation_drift_weight: 1,
    verification_complexity_weight: 1,
    fragility_weight: 1,
    tech_debt_threshold: 4,
  },
  promotion: {
    must_fix_priority: 100,
    trust_resilience_priority: 80,
    product_depth_priority: 60,
    motivation_delight_priority: 40,
    tech_debt_priority: 20,
  },
  loop: {
    max_rounds: 24,
    max_same_work_unit_repeats: 3,
    runaway_threshold: 3,
    stall_recovery_retries: 2,
    evolve_interval: 5,
  },
  routing: {
    single_agent_threshold: 0.3,
    specialist_threshold: 0.6,
    parallel_builders_threshold: 0.8,
  },
  rollback: {
    auto_revert_max_files: 5,
    auto_revert_product_only: true,
  },
  human_gate: {
    default_mode: "autonomous",
    destructive_require_human: true,
    irreversible_require_human: true,
    high_risk_pause: true,
    medium_risk_auto_proceed: true,
  },
};

const COURSE_MAP_EXTRACTION_MISSION = {
  id: "course-map-extraction",
  label: "Marathon course-map route extraction",
  surface: "Route Extraction Pipeline",
  stopGate: "Mission stop gate: a verified standard city road marathon course-map candidate has live non-empty routePoints that render as the extracted route on the runner OpenStreetMap.",
  nonStopCondition: "City-level-only references do not satisfy the stop condition.",
  stopProof: [
    "fresh backend evidence that Qwen/CV extracted route geometry from a real course-map image",
    "live course-map payload contains non-empty live routePoints",
    "runner OpenStreetMap route rendering is verified",
  ],
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function loadConfig(args) {
  const configPath = resolveFromRoot(args.configJson);
  let fileConfig = {};
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    fileConfig = JSON.parse(raw);
  } catch {
    fileConfig = {};
  }
  return deepMerge(HARDCODED_DEFAULTS, fileConfig);
}

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    refreshSuggestions: true,
    tasks: "TASKS.md",
    humanLoop: ".ai-sync/HUMAN_LOOP.md",
    humanLoopJson: ".tools/auto-hermes-human-loop.json",
    agentSync: ".ai-sync/AGENT_SYNC.md",
    contextLedger: ".ai-sync/CONTEXT_LEDGER.md",
    loopState: ".ai-sync/LOOP_STATE.md",
    traceToSkillJson: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json",
    claimDir: ".ai-sync/auto-hermes-claims",
    claimOwner: "",
    claimTtlMinutes: "15",
    outputJson: ".ai-sync/AUTO_HERMES_CONTROLLER.json",
    outputMd: ".ai-sync/AUTO_HERMES_CONTROLLER.md",
    configJson: ".tools/auto-hermes-config.json",
    structureUpdateJson: ".ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.json",
    runtime: "",
    };

    for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--no-refresh-suggestions") args.refreshSuggestions = false;
    else if (arg === "--tasks") args.tasks = argv[++i] || args.tasks;
    else if (arg === "--human-loop") args.humanLoop = argv[++i] || args.humanLoop;
    else if (arg === "--human-loop-json") args.humanLoopJson = argv[++i] || args.humanLoopJson;
    else if (arg === "--agent-sync") args.agentSync = argv[++i] || args.agentSync;
    else if (arg === "--context-ledger") args.contextLedger = argv[++i] || args.contextLedger;
    else if (arg === "--loop-state") args.loopState = argv[++i] || args.loopState;
    else if (arg === "--trace-to-skill-json") args.traceToSkillJson = argv[++i] || args.traceToSkillJson;
    else if (arg === "--structure-update-json") args.structureUpdateJson = argv[++i] || args.structureUpdateJson;
    else if (arg === "--output-json") args.outputJson = argv[++i] || args.outputJson;
    else if (arg === "--output-md") args.outputMd = argv[++i] || args.outputMd;
    else if (arg === "--runtime") args.runtime = argv[++i] || args.runtime;
    }
    return args;
    }
function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
}

function inferWorkspaceRoot(args) {
  if (args?.rootDir) return path.resolve(args.rootDir);
  if (args?.tasks && path.isAbsolute(args.tasks) && path.basename(args.tasks).toLowerCase() === "tasks.md") {
    return path.dirname(args.tasks);
  }
  return ROOT;
}

function readOptional(relPath) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf8");
}

function readJsonOptional(relPath) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return null;
  }
}

function loadStructureUpdateSteering(args) {
  const report = readJsonOptional(args.structureUpdateJson);
  if (!report || typeof report !== "object") {
    return {
      status: "inactive",
      applied: false,
      reason: "no structure-update brief loaded",
      recommendedDefault: null,
    };
  }

  const recommended = report?.steering?.recommendedDefault;
  if (!recommended || typeof recommended.title !== "string" || !recommended.title.trim()) {
    return {
      status: String(report.status || "inactive"),
      applied: false,
      reason: "structure-update brief has no recommended default",
      recommendedDefault: null,
      summary: String(report.summary || ""),
      generatedAt: String(report.generatedAt || ""),
      expiresAt: String(report?.freshness?.expiresAt || ""),
    };
  }

  const expiresAt = String(report?.freshness?.expiresAt || "");
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs < Date.now();

  return {
    status: isExpired ? "expired" : String(report.status || "ready"),
    applied: false,
    reason: isExpired
      ? `structure-update brief expired at ${expiresAt}`
      : "structure-update brief is ready",
    recommendedDefault: {
      title: String(recommended.title || ""),
      source: String(recommended.source || ""),
      files: Array.isArray(recommended.files)
        ? recommended.files.map((file) => String(file || "").trim()).filter(Boolean)
        : [],
    },
    summary: String(report.summary || ""),
    generatedAt: String(report.generatedAt || ""),
    expiresAt,
  };
}

function loadTraceToSkillSignal(args) {
  const reportPath = args.traceToSkillJson || ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json";
  const report = readJsonOptional(args.traceToSkillJson);
  if (!report || typeof report !== "object") {
    return {
      mode: "none",
      summary: "No trace-to-skill evidence loaded.",
      candidates: [],
      evolvedSkill: null,
      reportPath,
    };
  }

  const mergedRules = Array.isArray(report.mergedRules) ? report.mergedRules : [];
  const candidates = mergedRules
    .filter((rule) => typeof rule?.rule === "string")
    .slice(0, 3)
    .map((rule) => ({
      rule: rule.rule.length > 240 ? `${rule.rule.slice(0, 237)}...` : rule.rule,
      evidenceCount: Number(rule.evidenceCount || 0),
      status: String(rule.status || "informational"),
    }));

  // Inlined trace-to-skill payload used to be ~100 KB per coordinator JSON read.
  // Only the slim summary view is embedded now; downstream agents load the full
  // rule bodies on demand from evolvedSkillPath when their work actually
  // evolves the workflow.
  return {
    mode: candidates.length ? "soft-signal" : "none",
    summary: String(report.summary || (candidates.length ? "Evidence-backed workflow candidates available as a soft signal." : "No trace-to-skill evidence loaded.")),
    candidates,
    evolvedSkill: report.evolvedSkill && typeof report.evolvedSkill === "object"
      ? {
          mode: String(report.evolvedSkill.mode || "none"),
          slug: String(report.evolvedSkill.slug || ""),
          path: String(report.evolvedSkill.path || ""),
          summary: String(report.evolvedSkill.summary || ""),
          // Slim sample preserves renderer compatibility while dropping the
          // ~70 KB full-rule payload. Full rules live at `reportPath` on disk.
          coreRules: (Array.isArray(report.evolvedSkill.coreRules) ? report.evolvedSkill.coreRules : [])
            .slice(0, 3)
            .map((rule) => ({
              rule: typeof rule?.rule === "string"
                ? (rule.rule.length > 200 ? `${rule.rule.slice(0, 197)}...` : rule.rule)
                : "",
              evidenceCount: Number(rule?.evidenceCount || 0),
            })),
          failureModes: (Array.isArray(report.evolvedSkill.failureModes) ? report.evolvedSkill.failureModes : [])
            .slice(0, 2)
            .map((entry) => typeof entry === "string" && entry.length > 200 ? `${entry.slice(0, 197)}...` : entry),
          coreRulesCount: Array.isArray(report.evolvedSkill.coreRules) ? report.evolvedSkill.coreRules.length : 0,
          guidanceRulesCount: Array.isArray(report.evolvedSkill.guidanceRules) ? report.evolvedSkill.guidanceRules.length : 0,
          edgeRulesCount: Array.isArray(report.evolvedSkill.edgeRules) ? report.evolvedSkill.edgeRules.length : 0,
          patternsCount: Array.isArray(report.evolvedSkill.patterns) ? report.evolvedSkill.patterns.length : 0,
          failureModesCount: Array.isArray(report.evolvedSkill.failureModes) ? report.evolvedSkill.failureModes.length : 0,
        }
      : null,
    reportPath,
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

  const suggested = parseTaskBlocks(taskText, "Suggested Next Tasks")
    .filter((task) => !task.checked)
    .filter(isPromotableSuggestedTask);
  const techDebt = parseTaskBlocks(taskText, "Tech Debt Tasks")
    .filter((task) => !task.checked)
    .filter(isPromotableTechDebtTask);
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

function inferProblemClass(task, options = {}) {
  const explicit = collapseWhitespace(helperValue(task, "Problem")).toLowerCase();
  if (explicit) return explicit;

  const combined = collapseWhitespace(options.combined || "");
  const touchesFrontend = Boolean(options.touchesFrontend);
  const touchesBackend = Boolean(options.touchesBackend);

  if (
    touchesFrontend &&
    /layout|hierarchy|visual|redesign|mimic|reference|theme|responsive|spacing|copy|translation|empty state|loading state|error state|hero|card|surface|page|shell drift|coach-voice/i.test(combined)
  ) {
    return "frontend-design";
  }
  if (
    touchesBackend &&
    /backend logic|controller|service|repository|validation|auth|response|contract|persistence|scheduler|query|business logic|untested/i.test(combined)
  ) {
    return "backend-logic";
  }
  if (touchesFrontend && touchesBackend) return "cross-stack-contract";
  if (touchesBackend) return "backend-logic";
  if (touchesFrontend) return "frontend-logic";
  return "workflow";
}

function hasSpecificFiles(task) {
  const files = helperValue(task, "Files");
  return Boolean(files && !/^none$/i.test(files));
}

function hasDoneWhen(task) {
  return Boolean(helperValue(task, "Done when"));
}

function hasVerify(task) {
  return Boolean(helperValue(task, "Verify"));
}

function isPromotableSuggestedTask(task) {
  return hasSpecificFiles(task) && hasDoneWhen(task) && hasVerify(task);
}

function isPromotableTechDebtTask(task) {
  return hasSpecificFiles(task) && hasDoneWhen(task) && hasVerify(task);
}

function parseHumanLoopItems(sectionText) {
  return String(sectionText || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter((line) => line && !/^none$/i.test(line));
}

function parseHumanLoop(text) {
  const currentStatusSection = extractMarkdownSection(text, "Current Status");
  const agentModeSection = extractMarkdownSection(text, "Agent Mode");
  const agentWritebackSection = extractMarkdownSection(text, "Agent Writeback Format");
  const humanRequestsSection = extractMarkdownSection(text, "Human Requests");
  const priorityOverridesSection = extractMarkdownSection(text, "Priority Overrides");
  const statusMatch = currentStatusSection.match(/^- Status:\s*(.+)$/m);
  const modeMatch = agentModeSection.match(/^- Mode:\s*(.+)$/m);
  const currentSurfaceMatch = agentWritebackSection.match(/^- Current owned surface:\s*(.+)$/m);
  const nextRoundMatch = agentWritebackSection.match(/^- Next intended round:\s*(.+)$/m);
  const explicitMustAsk =
    /\bStatus:\s*must-ask\b/i.test(currentStatusSection) ||
    /\bmust-ask\b/i.test(humanRequestsSection) ||
    /\bmust-ask\b/i.test(priorityOverridesSection);
  return {
    status: statusMatch ? statusMatch[1].trim() : "unknown",
    mode: modeMatch ? modeMatch[1].trim() : "unknown",
    currentOwnedSurface: currentSurfaceMatch ? currentSurfaceMatch[1].trim() : "",
    nextIntendedRound: nextRoundMatch ? nextRoundMatch[1].trim() : "",
    humanRequestsText: humanRequestsSection,
    priorityOverridesText: priorityOverridesSection,
    human_requests: parseHumanLoopItems(humanRequestsSection),
    priority_overrides: parseHumanLoopItems(priorityOverridesSection),
    mustAsk: explicitMustAsk,
    pause: /\bStatus:\s*pause\b/i.test(text),
    stop: /\bStatus:\s*stop\b/i.test(text),
  };
}

function parseHumanLoopJson(text) {
  try {
    const config = JSON.parse(text);
    const mode = config.mode || "autonomous";
    const status = mode === "autonomous" ? "autonomous" : mode;
    const safetyBrakes = config.safety_brakes || {};
    const agentWriteback = config.agent_writeback || {};
    return {
      source: "json",
      mode,
      status,
      pause: false,
      stop: false,
      mustAsk: false,
      safety_brakes: safetyBrakes,
      human_requests: Array.isArray(config.human_requests) ? config.human_requests : [],
      priority_overrides: Array.isArray(config.priority_overrides) ? config.priority_overrides : [],
      reversal_requests: Array.isArray(config.reversal_requests) ? config.reversal_requests : [],
      currentOwnedSurface: agentWriteback.last_action || "",
      nextIntendedRound: agentWriteback.next_action || "",
      risk_level: agentWriteback.risk_level || "low",
    };
  } catch {
    return null;
  }
}

function mergeHumanLoop(jsonConfig, mdConfig) {
  if (!jsonConfig) return mdConfig;
  if (!mdConfig) return jsonConfig;
  const merged = { ...jsonConfig, ...mdConfig };
  const mdHumanRequests = Array.isArray(mdConfig.human_requests) ? mdConfig.human_requests : [];
  const jsonHumanRequests = Array.isArray(jsonConfig.human_requests) ? jsonConfig.human_requests : [];
  const mdPriorityOverrides = Array.isArray(mdConfig.priority_overrides) ? mdConfig.priority_overrides : [];
  const jsonPriorityOverrides = Array.isArray(jsonConfig.priority_overrides) ? jsonConfig.priority_overrides : [];
  merged.human_requests = [...jsonHumanRequests, ...mdHumanRequests].filter(Boolean);
  merged.priority_overrides = [...jsonPriorityOverrides, ...mdPriorityOverrides].filter(Boolean);
  merged.humanRequestsText = [
    jsonHumanRequests.join("\n"),
    mdConfig.humanRequestsText || "",
  ].filter(Boolean).join("\n");
  merged.priorityOverridesText = [
    jsonPriorityOverrides.join("\n"),
    mdConfig.priorityOverridesText || "",
  ].filter(Boolean).join("\n");
  if (mdConfig.pause || mdConfig.stop || mdConfig.mustAsk) {
    merged.safety_brakes = jsonConfig.safety_brakes || {};
  }
  return merged;
}

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sanitizeHumanLoopForTask(humanLoop, taskMeta) {
  if (!taskMeta?.title) {
    return {
      ...humanLoop,
      effectiveCurrentOwnedSurface: humanLoop.currentOwnedSurface || "none",
      effectiveNextIntendedRound: humanLoop.nextIntendedRound || "none",
      staleAgentWriteback: false,
      staleFields: [],
    };
  }

  const staleFields = [];
  const expectedNext = `${taskMeta.title} (${taskMeta.source}) on ${taskMeta.surface}`;
  const effectiveCurrentOwnedSurface =
    !humanLoop.currentOwnedSurface ||
    /^unknown$/i.test(collapseWhitespace(humanLoop.currentOwnedSurface)) ||
    collapseWhitespace(humanLoop.currentOwnedSurface).toLowerCase() !== collapseWhitespace(taskMeta.surface).toLowerCase()
      ? taskMeta.surface
      : humanLoop.currentOwnedSurface;
  const effectiveNextIntendedRound =
    !humanLoop.nextIntendedRound ||
    !collapseWhitespace(humanLoop.nextIntendedRound).toLowerCase().includes(collapseWhitespace(taskMeta.title).toLowerCase())
      ? expectedNext
      : humanLoop.nextIntendedRound;

  if (collapseWhitespace(effectiveCurrentOwnedSurface) !== collapseWhitespace(humanLoop.currentOwnedSurface)) {
    staleFields.push("currentOwnedSurface");
  }
  if (collapseWhitespace(effectiveNextIntendedRound) !== collapseWhitespace(humanLoop.nextIntendedRound)) {
    staleFields.push("nextIntendedRound");
  }

  return {
    ...humanLoop,
    effectiveCurrentOwnedSurface,
    effectiveNextIntendedRound,
    staleAgentWriteback: staleFields.length > 0,
    staleFields,
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

function classifyRound(task, surface, config) {
  const { files, touchesFrontend, touchesBackend, touchesDocsOnly } = inferStackFromTask(task, surface);
  const verify = helperValue(task, "Verify");
  const context = helperValue(task, "Context");
  const combined = `${task.title} ${context} ${verify} ${surface}`;
  const problemClass = inferProblemClass(task, {
    combined,
    touchesFrontend,
    touchesBackend,
  });
  const destructivePattern = /\bdelete\b|\bremove table\b|\btruncate\b|\bforce push\b|\bforce-push\b|\bmigration\b|\bdrop\s+(table|column|index|database|schema)\b/i;
  const irreversiblePattern = /\bdelete\b|\btruncate\b|\bforce push\b|\bforce-push\b|\bmigration\b|\bremove table\b|\bdrop\s+(table|column|index|database|schema)\b|\bpermanent\b|\birreversible\b/i;
  const destructive = destructivePattern.test(combined);
  const irreversible = irreversiblePattern.test(combined);
  const fileCount = files.length;
  const crossStack = touchesFrontend && touchesBackend;
  const reviewSensitive =
    problemClass === "backend-logic" ||
    /review|audit|regression|trust|verify|hardening|resilience|fix broken|repair/i.test(combined) ||
    /runtime sync|http:\/\/localhost:8080|compile|build|auth|validation|contract|response shape|persistence/i.test(`${combined} ${verify}`);
  const broad =
    /work through|fix the broken part|wire.*together|full|broad|system|architecture/i.test(combined) ||
    fileCount > 4;
  const frontendDesignSignals =
    /layout|hierarchy|visual|redesign|mimic|reference|theme|light mode|dark mode|responsive|spacing|copy|translation|empty state|loading state|error state|hero|card|surface|page/i.test(combined) ||
    files.some((file) => file.endsWith(".css") || /frontend\/src\/pages\//.test(file));
  const frontendDirectSignals =
    /logic|algorithm|schedule|route selection|route logic|gps|nearby|cluster|sort|rank|cache|state|persist|refresh|controller|service|test|bug/i.test(combined);
  const frontendDesignGateRequired =
    problemClass === "frontend-design" ||
    (touchesFrontend && !touchesBackend && frontendDesignSignals && !frontendDirectSignals);
  const backendLogicGateRequired = problemClass === "backend-logic";
  const backendLogicReviewRequired =
    backendLogicGateRequired &&
    /auth|validation|contract|response|persistence|service|controller|repository|scheduler/i.test(combined);
  const frontendRouteDecision = touchesFrontend && !touchesBackend
    ? (frontendDesignGateRequired ? "design-review" : "direct-implement")
    : "not-applicable";
  const tiny =
    !crossStack &&
    !reviewSensitive &&
    !broad &&
    (fileCount === 0 || fileCount <= 1) &&
    !/rebuild|redesign|shell|route/i.test(combined) &&
    problemClass !== "frontend-design" &&
    problemClass !== "backend-logic";

  let complexity = 0;
  const cw = config?.complexity || HARDCODED_DEFAULTS.complexity;
  if (fileCount > 3) complexity += cw.files_touched_weight;
  if (crossStack) complexity += cw.state_complexity_weight;
  if (reviewSensitive) complexity += cw.verification_complexity_weight;
  if (broad) complexity += cw.fragility_weight;
  if (/translation|i18n/i.test(combined)) complexity += cw.translation_drift_weight;

  return {
    files,
    fileCount,
    touchesFrontend,
    touchesBackend,
    touchesDocsOnly,
    crossStack,
    reviewSensitive,
    broad,
    problemClass,
    frontendDesignGateRequired,
    backendLogicGateRequired,
    backendLogicReviewRequired,
    frontendRouteDecision,
    tiny,
    complexity,
    destructive,
    irreversible,
  };
}

function routeRound(classification, humanLoop, config) {
  const reasons = [];
  let shape = "single-agent";
  let visibleMultiAgent = false;
  let recommendedAgents = [];
  const autoDecisionGate = {
    name: "problem-route-optimizer",
    decision: classification.frontendRouteDecision || "not-applicable",
    reason: "",
  };

  if (humanLoop.pause || humanLoop.stop) {
    return {
      shape: "paused",
      visibleMultiAgent: false,
      recommendedAgents: [],
      reasons: [`human loop status is ${humanLoop.status}`],
    };
  }

  const safetyBrakes = humanLoop.safety_brakes || {};
  if (classification.destructive && safetyBrakes.destructive_actions === "require_human") {
    return {
      shape: "paused",
      visibleMultiAgent: false,
      recommendedAgents: [],
      reasons: ["safety brake: destructive action requires human approval"],
    };
  }
  if (classification.irreversible && safetyBrakes.irreversible_changes === "require_human") {
    return {
      shape: "paused",
      visibleMultiAgent: false,
      recommendedAgents: [],
      reasons: ["safety brake: irreversible change requires human approval"],
    };
  }

  const rw = config?.routing || HARDCODED_DEFAULTS.routing;
  const maxComplexity = Math.max(classification.complexity, 0);
  const normalizedComplexity = maxComplexity / (Object.values(rw).reduce((sum, v) => sum + v, 0) || 1);

  if (classification.tiny && normalizedComplexity < rw.specialist_threshold) {
    reasons.push("task scoped as tiny local work");
    return {
      shape,
      visibleMultiAgent,
      recommendedAgents,
      autoDecisionGate,
      reasons,
    };
  }

  if (classification.crossStack) {
    shape = "parallel-builders";
    visibleMultiAgent = true;
    recommendedAgents = ["frontend-agent", "backend-agent"];
    reasons.push("task touches both frontend and backend");
    reasons.push("visible multi-agent policy prefers real parallel builders for bounded cross-stack work");
    autoDecisionGate.reason = "cross-stack round bypasses the frontend-only decision gate";
    return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
  }

  if (classification.broad) {
    shape = "single-specialist";
    visibleMultiAgent = true;
    recommendedAgents = ["planning-agent"];
    reasons.push("task is broad enough to benefit from decomposition first");
    reasons.push("visible multi-agent policy prefers at least one spawned specialist on non-tiny work");
    autoDecisionGate.reason = "broad rounds decompose first before builder routing";
    return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
  }

  if (classification.frontendDesignGateRequired) {
    shape = "pm-builder-reviewer";
    visibleMultiAgent = true;
    recommendedAgents = ["reviewer-agent", "frontend-agent"];
    reasons.push("frontend auto-decision gate marked this round as design-review required");
    reasons.push("optimized route chooses reviewer-backed frontend execution instead of a plain builder-only path");
    autoDecisionGate.reason = "detected non-trivial frontend design signals without stronger logic-first signals";
    return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
  }

  if (classification.backendLogicGateRequired) {
    if (classification.backendLogicReviewRequired || classification.broad || classification.fileCount > 1) {
      shape = "pm-builder-reviewer";
      visibleMultiAgent = true;
      recommendedAgents = ["reviewer-agent", "backend-agent"];
      reasons.push("problem classification marked this round as a backend-logic issue");
      reasons.push("backend logic touching auth, validation, contracts, or persistence uses reviewer-backed backend execution");
      autoDecisionGate.reason = "backend-logic problems route to backend specialist ownership, with reviewer support for trust-sensitive logic";
      return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
    }

    shape = "single-specialist";
    visibleMultiAgent = true;
    recommendedAgents = ["backend-agent"];
    reasons.push("problem classification marked this round as a backend-logic issue");
    reasons.push("bounded backend logic work should go straight to a backend specialist");
    autoDecisionGate.reason = "backend-logic problem is bounded enough for a single backend specialist";
    return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
  }

  if (classification.reviewSensitive) {
    shape = "pm-builder-reviewer";
    visibleMultiAgent = true;
    recommendedAgents = classification.touchesBackend
      ? ["reviewer-agent", "backend-agent"]
      : ["reviewer-agent", "frontend-agent"];
    reasons.push("task is review-sensitive or verification-heavy");
    reasons.push("visible multi-agent policy prefers a real reviewer lane on non-tiny work");
    autoDecisionGate.reason = classification.touchesFrontend
      ? "frontend auto-decision gate chose the lighter direct path, but review sensitivity still requires reviewer-backed routing"
      : "non-frontend review-sensitive round";
    return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
  }

  if (classification.touchesBackend) {
    shape = "single-specialist";
    visibleMultiAgent = true;
    recommendedAgents = ["backend-agent"];
    reasons.push("task is bounded backend work");
    reasons.push("visible multi-agent policy prefers one real spawned specialist");
    autoDecisionGate.reason = "backend-only round";
    return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
  }

  if (classification.touchesFrontend || classification.touchesDocsOnly) {
    shape = "single-specialist";
    visibleMultiAgent = true;
    recommendedAgents = [classification.touchesDocsOnly ? "planning-agent" : "frontend-agent"];
    reasons.push(classification.touchesDocsOnly ? "task is workflow/control-plane work" : "task is bounded frontend work");
    reasons.push("visible multi-agent policy prefers one real spawned specialist");
    autoDecisionGate.reason = classification.touchesFrontend
      ? "frontend auto-decision gate chose the optimized direct implementation route"
      : "docs/control-plane round";
    return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
  }

  reasons.push("defaulted to local execution due to low-confidence ownership");
  autoDecisionGate.reason = "no frontend-specific routing needed";
  return { shape, visibleMultiAgent, recommendedAgents, autoDecisionGate, reasons };
}

function buildSubagentPlan(route, classification, args = {}) {
  const agents = Array.isArray(route?.recommendedAgents) ? route.recommendedAgents.filter(Boolean) : [];
  const optionalSupportAgents = Array.isArray(route?.optionalExternalAgents) ? route.optionalExternalAgents.filter(Boolean) : [];
  const isGemini = args.runtime === "gemini";
  const isCodexSwarm = args.runtime === "codex";
  const plan = {
    useCodexSubagents: !isGemini && route.visibleMultiAgent && agents.length > 0,
    useGeminiParallelAgents: isGemini && route.visibleMultiAgent && agents.length > 0,
    coordinatorMode: route?.visibleMultiAgent
      ? isCodexSwarm
        ? "codex-app-subagent-swarm"
        : "coordinator-with-subagents"
      : "local-coordinator-only",
    lanes: [],
    spawnOrder: [],
    parallelGroups: [],
    optionalSupportAgents: [],
    notes: [],
  };

  if (!route || route.shape === "paused") {
    plan.notes.push("human loop pause/stop gate blocks subagent dispatch");
    return plan;
  }

  if (!route.visibleMultiAgent || !agents.length) {
    plan.notes.push("task stays local because delegation would cost more than execution");
    if (optionalSupportAgents.length) {
      plan.optionalSupportAgents = [...optionalSupportAgents];
      if (isGemini) {
        plan.notes.push(`repo-local external Gemini parallel agents available for this round: ${optionalSupportAgents.join(", ")}`);
      } else {
        plan.notes.push(`repo-local external Codex agents available for this round: ${optionalSupportAgents.join(", ")}`);
      }
      plan.notes.push("these are repo-local installed agents, not proof of live execution; delegate only when they materially help");
    }
    return plan;
  }

  plan.spawnOrder = [...agents];
  if (isCodexSwarm && agents.length) {
    plan.notes.push("Codex self runtime dispatches planned lanes through Codex app custom subagents only; console helpers only write durable briefs/state.");
  }

  if (route.shape === "parallel-builders") {
    plan.parallelGroups.push([...agents]);
    for (const agent of agents) {
      plan.lanes.push({
        agent,
        mode: isGemini ? "sequential/adaptive" : "parallel",
        ownership: agent === "frontend-agent" ? "frontend files only" : "backend files only",
      });
    }
    if (isGemini) {
      plan.notes.push("Gemini CLI executes planned lanes sequentially while preserving the max parallel contract");
    } else {
      plan.notes.push("spawn frontend/backend builders together only because the round is bounded cross-stack");
    }
    plan.notes.push("keep file ownership disjoint and reunify verification in the coordinator");
    return plan;
  }

  if (isCodexSwarm && agents.length) {
    plan.parallelGroups.push([...agents]);
  }

  for (let index = 0; index < agents.length; index += 1) {
    const agent = agents[index];
    plan.lanes.push({
      agent,
      mode: isGemini ? "sequential/adaptive" : isCodexSwarm ? "parallel" : "sequential",
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
  if (optionalSupportAgents.length) {
    plan.optionalSupportAgents = [...optionalSupportAgents];
    plan.notes.push(`repo-local external Codex agents available for this round: ${optionalSupportAgents.join(", ")}`);
    plan.notes.push("these are repo-local installed agents, not proof of live execution; use them only as bounded support specialists");
  }

  return plan;
}

function buildDesignContext(task, surface, classification) {
  if (!classification?.frontendDesignGateRequired) return null;

  const skillsManifest = buildAutoHermesSkillsManifest();
  const explicitReference = helperValue(task, "Reference Source");
  const explicitVisualGoal = helperValue(task, "Visual goal");
  const explicitPreserve = helperValue(task, "Preserve");
  const explicitMode = helperValue(task, "Target mode");
  const combined = collapseWhitespace(`${task.title} ${helperValue(task, "Context")} ${helperValue(task, "Done when")}`).toLowerCase();

  let roundType = "visual-bug";
  if (/\bmimic|reference|match\b/.test(combined)) roundType = "mimic-implementation";
  else if (/\blayout|hierarchy|redesign|shell|structure\b/.test(combined)) roundType = "structural-redesign";
  else if (/\binteraction|click|hover|toggle|flow|state\b/.test(combined)) roundType = "interaction-bug";

  let targetMode = explicitMode || "dual-mode";
  if (!explicitMode) {
    if (/\blight mode|light\b/.test(combined)) targetMode = "light";
    else if (/\bdark mode|dark\b/.test(combined)) targetMode = "dark";
  }

  return {
    authorityFile: "design.md",
    authorityPath: resolveFromRoot("design.md"),
    referenceSource: explicitReference || "design.md",
    surface,
    roundType,
    targetMode,
    visualGoal: explicitVisualGoal || `Make ${surface} align with the Kinetic Editorial system in design.md while preserving live Hermes behavior.`,
    preserve: explicitPreserve || "Preserve real data wiring, route behavior, auth, and runner usefulness while refining hierarchy and visual trust.",
    frontendSkillStack: skillsManifest.frontendDesign,
    browserVerification: {
      required: true,
      preferredCodexSurface: "browser-use:browser",
      codexFallbackSurface: ".tools/auto-hermes-browser.mjs, then .tools/auto-hermes-playwright.mjs if Browser Harness is unavailable or blocked",
      checklist: [
        "hierarchy and reading order",
        "spacing, density, and visual balance",
        "theme/contrast correctness",
        "responsive integrity at realistic viewport widths",
        "reference fidelity when the round uses a mimic/reference target",
      ],
      evidence: [
        "tested route URL",
        "console clean/error summary",
        "screenshot or DOM observation",
        "explicit design-quality verdict",
      ],
      qualityAudit: {
        manifestCommand: "node .tools/auto-hermes-skills.mjs --json",
        skillName: "auto-hermes-frontend-design-stack",
        source: "design.md plus installed Codex frontend design skills",
      },
    },
  };
}

function buildKnowledgePack(task, surface, classification, route, designContext) {
  const title = collapseWhitespace(task?.title || "");
  const context = collapseWhitespace(helperValue(task, "Context"));
  const doneWhen = collapseWhitespace(helperValue(task, "Done when"));
  const combined = `${title} ${surface} ${context} ${doneWhen}`.toLowerCase();
  const mapRelPath = "docs/auto-hermes/index.md";
  const mapExists = fs.existsSync(resolveFromRoot(mapRelPath));
  const readOrder = [];

  function pushRead(label, relPath, reason) {
    const normalized = collapseWhitespace(relPath);
    if (!normalized || readOrder.some((entry) => entry.relPath === normalized)) return;
    readOrder.push({
      label,
      relPath: normalized,
      path: resolveFromRoot(normalized),
      reason,
    });
  }

  pushRead("Policy plane", "AGENTS.md", "Truth, runtime-proof, safety, and repo rules.");
  if (mapExists) {
    pushRead("Record-system map", mapRelPath, "Start from the stable `/auto-hermes` map before drilling into deeper owners.");
  }
  pushRead("Compressed repo brief", ".ai-codex/optimized-codex.md", "Use the compact queue/context brief instead of broad repo scans.");
  pushRead("Surface memory", ".ai-sync/CONTEXT_LEDGER.md", "Preserve the latest durable surface intent before editing.");
  pushRead("Cross-agent claims", ".ai-sync/AGENT_SYNC.md", "Avoid reclaiming conflicting or stale work.");

  const needsWorkflowOwners =
    classification?.touchesDocsOnly
    || /auto-hermes|workflow|controller|loop|command|brief|claim|promotion|doc-gardening|record system/.test(combined);
  if (needsWorkflowOwners) {
    pushRead("Shared lifecycle owner", ".codex/workflows/auto-hermes-shared-contract.md", "Owns lifecycle and runtime wording shared across runtimes.");
    pushRead("Control-plane owner", ".codex/workflows/auto-hermes-architecture.md", "Owns control-plane boundaries and writeback expectations.");
  }
  if (route?.visibleMultiAgent || classification?.crossStack || classification?.reviewSensitive) {
    pushRead("Delegation owner", ".codex/workflows/hermes-multi-agent.md", "Owns delegation and visible multi-agent routing.");
  }
  if (designContext?.authorityPath) {
    pushRead("Design authority", "design.md", "Use the approved Hermes design system before touching meaningful UI.");
  }
  if (designContext?.browserVerification?.qualityAudit?.manifestCommand) {
    pushRead(
      "Frontend quality manifest",
      ".tools/auto-hermes-skills.mjs",
      "Use the auto-hermes skills manifest before browser-backed frontend design-quality verification.",
    );
  }

  const docGardeningMode = needsWorkflowOwners || classification?.touchesDocsOnly ? "required" : "conditional";
  const smallestOwningDocs = needsWorkflowOwners
    ? [mapRelPath, ".codex/workflows/auto-hermes-shared-contract.md", ".codex/workflows/auto-hermes-architecture.md"]
    : [".ai-sync/CONTEXT_LEDGER.md", ".ai-sync/AGENT_SYNC.md"];

  return {
    strategy: "progressive-disclosure",
    recordSystemMap: mapExists
      ? {
          relPath: mapRelPath,
          path: resolveFromRoot(mapRelPath),
        }
      : null,
    readOrder,
    rules: [
      "Start from the map and the selected owner files instead of broad repo scans.",
      "Treat AGENTS.md as policy/top-level routing, not as the storage layer for every workflow detail.",
      "When durable workflow behavior changes, update the smallest owning doc or helper rather than copying rules into multiple files.",
    ],
    docGardening: {
      mode: docGardeningMode,
      smallestOwningDocs,
      triggers: [
        "If the round changes lasting `/auto-hermes` behavior, update the owning doc/helper in the same round when bounded.",
        "If docs drift from helper behavior and the fix is too large, write a concrete doc-gardening follow-up instead of leaving silent drift.",
      ],
    },
  };
}

function buildTechDebtReview(task, classification) {
  const files = Array.isArray(classification?.files) ? classification.files : [];
  const likelyRelated = [];

  if (classification?.touchesFrontend) {
    likelyRelated.push("frontend/src/index.css");
    likelyRelated.push("frontend/src/i18n/translations.js");
  }
  if (classification?.touchesBackend) {
    likelyRelated.push("backend/src/test/java");
    likelyRelated.push("backend/src/main/resources");
  }
  if (classification?.touchesDocsOnly) {
    likelyRelated.push("docs/auto-hermes/index.md");
    likelyRelated.push(".codex/workflows/auto-hermes-shared-contract.md");
  }

  const relatedFiles = [];
  for (const candidate of likelyRelated) {
    if (!relatedFiles.includes(candidate)) relatedFiles.push(candidate);
    if (relatedFiles.length >= 2) break;
  }

  return {
    requiredEveryRound: true,
    scope: "changed-files-plus-2-related",
    primaryFiles: files,
    relatedFiles,
    maxItems: 1,
    taskFormat: ["Files:", "Context:", "Done when:", "Verify:"],
    rules: [
      "Inspect only the just-changed files plus at most 2 directly related files.",
      "Produce at most 1 implementation-ready debt item or none.",
      "Do not write vague cleanup, speculative architecture, or weaker duplicates.",
    ],
    concreteModeRule: "In concrete mode, still run the debt review but do not treat it as permission to extend into autonomous self-loop continuation unless the round owns queue writeback.",
    prompt: `Check whether this round exposed exactly one bounded reusable engineering cleanup in ${files.length ? files.join(", ") : "the touched area"}. If not, emit none.`,
  };
}

function pickAvailableTask(tasks, source, claimsByKey, claimOwner, capsules, activeClaims, defaultSurface) {
  for (const task of tasks) {
    const surface = inferSurfaceFromTask(task, {
      activeClaims,
      capsules,
      defaultSurface,
    });
    const key = taskClaimKey({ source, surface, title: task.title });
    const existingClaim = claimsByKey.get(key) || null;
    if (existingClaim && existingClaim.ownerId && existingClaim.ownerId !== claimOwner) {
      continue;
    }
    return {
      task,
      source,
      surface,
      claimKey: key,
      claimOwnerId: existingClaim?.ownerId || "",
    };
  }
  return null;
}

function findRecommendedStructureTask(tasks, source, claimsByKey, claimOwner, capsules, activeClaims, defaultSurface, structureUpdate) {
  const recommendedTitle = collapseWhitespace(structureUpdate?.recommendedDefault?.title || "").toLowerCase();
  if (!recommendedTitle) return null;

  const matchingTasks = tasks.filter((task) => collapseWhitespace(task.title).toLowerCase() === recommendedTitle);
  if (matchingTasks.length === 0) return null;

  return pickAvailableTask(matchingTasks, source, claimsByKey, claimOwner, capsules, activeClaims, defaultSurface);
}

function humanLoopMissionText(humanLoop) {
  return collapseWhitespace([
    humanLoop?.humanRequestsText || "",
    humanLoop?.priorityOverridesText || "",
    Array.isArray(humanLoop?.human_requests) ? humanLoop.human_requests.join(" ") : "",
    Array.isArray(humanLoop?.priority_overrides) ? humanLoop.priority_overrides.join(" ") : "",
    humanLoop?.nextIntendedRound || "",
    humanLoop?.currentOwnedSurface || "",
  ].join(" "));
}

function isCourseMapExtractionMissionActive(humanLoop) {
  if (!humanLoop || humanLoop.pause || humanLoop.stop || humanLoop.mustAsk) return false;
  const text = humanLoopMissionText(humanLoop);
  if (!text) return false;
  return (
    /course\s*-?\s*map|coursemap/i.test(text) &&
    /marathon/i.test(text) &&
    /qwen|extract|route|path|openstreetmap|osm/i.test(text)
  );
}

function buildCourseMapExtractionMissionTask() {
  const stopGate = `${COURSE_MAP_EXTRACTION_MISSION.stopGate} ${COURSE_MAP_EXTRACTION_MISSION.nonStopCondition}`;
  return {
    checked: false,
    title: "[human-mission] Course-map route extraction must publish to OpenStreetMap",
    helpers: [
      "Surface: Route Extraction Pipeline",
      "Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`, `backend/src/main/java/com/hermes/backend/MarathonRouteExtractionService.java`, `backend/src/main/java/com/hermes/backend/QwenCourseMapAlignmentClient.java`, `backend/src/main/java/com/hermes/backend/AdminRacePortalController.java`, `frontend/src/pages/RacesDetail.jsx`, `frontend/src/utils/raceDetailMapTrust.js`, `frontend/src/utils/courseMapCatalogQueue.js`",
      "Problem: cross-stack-contract",
      "Owner: backend-agent",
      `Context: Human mission from \`/auto-hermes-self\`: find course-map candidates for every standard city road marathon, run Qwen plus route extraction on each course-map image, and fix the first failing pipeline stage until the system extracts route geometry. ${stopGate}`,
      "Done when: a verified standard city road marathon course-map candidate produces a live course-map asset with non-empty live routePoints that pass backend plausibility/trust gates and render as the extracted route on the runner OpenStreetMap view; city-level-only references do not satisfy the stop condition.",
      "Verify: `cd backend && ./mvnw -q -Dtest=RaceCourseMapServiceTests,QwenCourseMapAlignmentClientTests,MarathonRouteExtractionServiceTests test` and `cd frontend && node src/utils/raceDetailMapTrust.test.js && node src/pages/raceDetailCourseMapOverlay.smoke.test.js`",
    ],
    section: "Human Mission",
  };
}

function pickCourseMapExtractionMission(humanLoop, claimsByKey, claimOwner) {
  if (!isCourseMapExtractionMissionActive(humanLoop)) return null;
  const task = buildCourseMapExtractionMissionTask();
  const source = "human-mission";
  const surface = COURSE_MAP_EXTRACTION_MISSION.surface;
  const key = taskClaimKey({ source, surface, title: task.title });
  const existingClaim = claimsByKey.get(key) || null;
  if (existingClaim && existingClaim.ownerId && existingClaim.ownerId !== claimOwner) return null;
  return {
    task,
    source,
    surface,
    claimKey: key,
    claimOwnerId: existingClaim?.ownerId || "",
    mission: COURSE_MAP_EXTRACTION_MISSION,
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeWebsiteAuditCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  return {
    mode: String(candidate.mode || "website-audit").trim() || "website-audit",
    surface: String(candidate.surface || "").trim(),
    title: String(candidate.title || "").trim(),
    files: normalizeFiles(candidate.files),
    problemClass: String(candidate.problemClass || "").trim() || "frontend-design",
    owner: String(candidate.owner || "").trim() || "frontend-agent",
    verify: String(candidate.verify || "").trim(),
    reason: String(candidate.reason || "").trim(),
  };
}

function normalizeWebsiteAuditQueueState(queueState, attempted = false) {
  const raw = queueState && typeof queueState === "object" && !Array.isArray(queueState)
    ? queueState
    : {};
  const defaultStatus = attempted ? "unknown" : "not-attempted";
  return {
    status: String(raw.status || defaultStatus).trim() || defaultStatus,
    path: String(raw.path || "").trim(),
    source: String(raw.source || defaultStatus).trim() || defaultStatus,
  };
}

function normalizeWebsiteAuditSignals(signals) {
  const raw = signals && typeof signals === "object" && !Array.isArray(signals)
    ? signals
    : {};
  return {
    productScreens: normalizeStringArray(raw.productScreens),
    pagesIndexed: normalizeStringArray(raw.pagesIndexed),
    contextLedgerPresent: raw.contextLedgerPresent === true,
  };
}

function buildWebsiteAuditSummary({ attempted, usedFallback, candidate, queueState }) {
  if (!attempted) {
    return "Website audit was not attempted because the controller still had promotable work.";
  }
  if (usedFallback && candidate) {
    const candidateFiles = candidate.files.length ? candidate.files.join(" | ") : "no files recorded";
    return `Controller reported no promotable work; website audit selected ${candidate.surface || "an unknown surface"} as the bounded fallback candidate (${candidateFiles}).`;
  }
  if (candidate) {
    return `Controller reported no promotable work; website audit found a bounded candidate for ${candidate.surface || "an unknown surface"}.`;
  }
  return `Controller reported no promotable work; website audit found no bounded fallback candidate (queue state: ${queueState.status}).`;
}

function buildWebsiteAuditMetadata(report, { usedFallback = false } = {}) {
  const candidate = normalizeWebsiteAuditCandidate(report?.candidate);
  const attempted = Boolean(report);
  let status = "not-attempted";
  if (attempted) {
    status = usedFallback && candidate
      ? "fallback-selected"
      : candidate
        ? "candidate-available"
        : "no-candidate";
  }

  const normalizedQueueState = normalizeWebsiteAuditQueueState(report?.queueState, attempted);
  return {
    mode: "website-audit",
    summary: buildWebsiteAuditSummary({
      attempted,
      usedFallback: Boolean(usedFallback && candidate),
      candidate,
      queueState: normalizedQueueState,
    }),
    attempted,
    status,
    usedFallback: Boolean(usedFallback && candidate),
    generatedAt: String(report?.generatedAt || "").trim(),
    queueState: normalizedQueueState,
    candidateCount: Array.isArray(report?.candidates) ? report.candidates.length : candidate ? 1 : 0,
    candidate,
    metadata: {
      signals: normalizeWebsiteAuditSignals(report?.signals),
    },
  };
}

function buildWebsiteAuditTask(candidate) {
  const normalizedCandidate = normalizeWebsiteAuditCandidate(candidate);
  if (!normalizedCandidate) return null;
  return {
    checked: false,
    title: normalizedCandidate.title || "Website audit follow-up",
    helpers: [
      normalizedCandidate.files.length ? `Files: \`${normalizedCandidate.files.join(", ")}\`` : "",
      `Problem: ${normalizedCandidate.problemClass || "frontend-design"}`,
      `Owner: ${normalizedCandidate.owner || "frontend-agent"}`,
      normalizedCandidate.reason ? `Context: ${normalizedCandidate.reason}` : "",
      "Done when: the website-audit fallback candidate is investigated and the bounded surface issue is resolved with targeted verification.",
      normalizedCandidate.verify ? `Verify: ${normalizedCandidate.verify}` : "",
      normalizedCandidate.surface ? `Surface: ${normalizedCandidate.surface}` : "",
      "Website Audit: fallback-selected",
      normalizedCandidate.reason ? `Website Audit Summary: ${normalizedCandidate.reason}` : "",
    ].filter(Boolean),
    section: "Website Audit",
  };
}

function restoreWebsiteAuditMetadata(task) {
  const status = helperValue(task, "Website Audit");
  if (!status) return null;

  const candidate = normalizeWebsiteAuditCandidate({
    surface: helperValue(task, "Surface") || inferSurfaceFromTask(task),
    title: task.title,
    files: normalizeFiles(helperValue(task, "Files")),
    problemClass: helperValue(task, "Problem") || "frontend-design",
    owner: helperValue(task, "Owner") || "frontend-agent",
    verify: helperValue(task, "Verify"),
    reason: helperValue(task, "Context"),
  });

  return {
    mode: "website-audit",
    summary: helperValue(task, "Website Audit Summary") || "Persisted website-audit context from the queue.",
    attempted: true,
    status,
    usedFallback: status === "fallback-selected",
    generatedAt: "",
    queueState: {
      status: "rehydrated-from-round-close",
      path: "TASKS.md",
      source: "round-close-queue",
    },
    candidateCount: candidate ? 1 : 0,
    candidate,
    metadata: {
      signals: {
        productScreens: [],
        pagesIndexed: [],
        contextLedgerPresent: Boolean(helperValue(task, "Context")),
      },
    },
  };
}

function inferAuditRootDir(args) {
  const tasksPath = resolveFromRoot(args.tasks || "TASKS.md");
  return path.dirname(tasksPath);
}

function runWebsiteAuditFallback(args) {
  return runAutoHermesWebsiteAudit({
    rootDir: inferAuditRootDir(args),
    tasks: args.tasks,
    contextLedger: args.contextLedger,
    json: true,
    write: args.write,
  }).report;
}

function buildWorkUnitResult({
  task,
  source,
  surface,
  claimKey,
  claimOwnerId = "",
  humanLoop,
  activeClaims = [],
  freshClaims = [],
  catalogOptions = {},
  websiteAudit = null,
  structureUpdate = null,
  mission = null,
  args = {},
  }) {
  const classification = classifyRound(task, surface);
  const route = routeRound(classification, humanLoop);
  const catalog = loadVoltAgentCatalog(catalogOptions);
  const context = helperValue(task, "Context");
  const doneWhen = helperValue(task, "Done when");
  const verify = helperValue(task, "Verify");
  const blocker = helperValue(task, "Blocker");
  const externalRecommendations = recommendVoltAgentSpecialists({
  task: {
    title: task.title,
    context,
    doneWhen,
    verify,
  },
  classification,
  route,
  catalog,
  });
  route.optionalExternalAgents = externalRecommendations.recommended.map((entry) => entry.installedName);
  route.optionalExternalAgentReasons = externalRecommendations.recommended.map((entry) => `${entry.installedName}: ${entry.reason}`);
  const subagentPlan = buildSubagentPlan(route, classification, args);
  const workflowComposition = inferWorkflowComposition({
    classification,
    route,
    subagentPlan,
  });
  const designContext = buildDesignContext(task, surface, classification);
  const knowledgePack = buildKnowledgePack(task, surface, classification, route, designContext);
  const techDebtReview = buildTechDebtReview(task, classification);
  const frontendGuard = classification.touchesFrontend
    ? buildFrontendConsoleGatePlan(classification.files)
    : {
        enabled: false,
        routes: [],
        smokeTests: [],
        smokeCommands: [],
        preRoundCommand: "",
        postRoundCommand: "",
        summary: "No common frontend routes were inferred from the touched files.",
        matches: [],
      };
  const effectiveHumanLoop = sanitizeHumanLoopForTask(humanLoop, {
    title: task.title,
    source,
    surface,
  });

  return {
    stop: route.shape === "paused",
    source,
    claimKey: claimKey || taskClaimKey({ source, surface, title: task.title }),
    claimOwnerId,
    title: task.title,
    section: task.section || "",
    surface,
    files: classification.files,
    context,
    doneWhen,
    verify,
    blocker,
    classification,
    route,
    subagentPlan,
    workflowComposition,
    frontendGuard,
    designContext,
    knowledgePack,
    techDebtReview,
    externalCatalog: {
      mode: catalog.mode,
      available: catalog.available,
      installedCount: catalog.installedCount,
      installedNames: catalog.installedNames,
      recommended: externalRecommendations.recommended,
      notes: externalRecommendations.notes,
    },
    activeClaims,
    freshClaims,
    humanLoop: effectiveHumanLoop,
    websiteAudit,
    structureUpdate,
    mission,
  };
}

function chooseWorkUnit(
  taskText,
  humanLoop,
  activeClaimsText,
  contextLedgerText,
  claimState = {},
  config = loadConfig({ configJson: ".tools/auto-hermes-config.json" }),
  catalogOptions = {},
  structureUpdate = {
    status: "inactive",
    applied: false,
    reason: "no structure-update brief loaded",
    recommendedDefault: null,
    },
    args = {},
    ) {
    const activeTasks = parseTaskBlocks(taskText, "Active Tasks").filter((task) => !task.checked);
    const suggested = parseTaskBlocks(taskText, "Suggested Next Tasks")
      .filter((task) => !task.checked)
      .filter(isPromotableSuggestedTask);
    const techDebt = parseTaskBlocks(taskText, "Tech Debt Tasks")
      .filter((task) => !task.checked)
      .filter(isPromotableTechDebtTask);
    const capsules = parseSurfaceCapsules(contextLedgerText);
    const activeClaims = parseActiveClaims(activeClaimsText);
    const freshClaims = Array.isArray(claimState.freshClaims) ? claimState.freshClaims : [];
    const claimsByKey = new Map(freshClaims.map((claim) => [claim.key, claim]));
    const claimOwner = claimState.claimOwner || "";
    const defaultSurface = humanLoop.currentOwnedSurface || "unknown";

    let structureSignal = { ...structureUpdate };
    let selection = null;
    if (structureSignal.status === "ready" && structureSignal.recommendedDefault?.title) {
      const activeSelection = findRecommendedStructureTask(
        activeTasks,
        "active-task",
        claimsByKey,
        claimOwner,
        capsules,
        activeClaims,
        defaultSurface,
        structureSignal,
      );
      if (activeSelection) {
        structureSignal = {
          ...structureSignal,
          applied: true,
          reason: "recommended structure task is already active",
        };
        selection = activeSelection;
      } else if (activeTasks.length > 0) {
        structureSignal = {
          ...structureSignal,
          reason: "active-task-present",
        };
      } else {
        selection =
          findRecommendedStructureTask(suggested, "suggested-task", claimsByKey, claimOwner, capsules, activeClaims, defaultSurface, structureSignal)
          || findRecommendedStructureTask(techDebt, "tech-debt", claimsByKey, claimOwner, capsules, activeClaims, defaultSurface, structureSignal);
        if (selection) {
          structureSignal = {
            ...structureSignal,
            applied: true,
            reason: `selected structure-update default from ${selection.source}`,
          };
        } else {
          structureSignal = {
            ...structureSignal,
            reason: "recommended structure task not found in promotable queue",
          };
        }
      }
    }

    if (!selection) {
      selection =
        pickAvailableTask(activeTasks, "active-task", claimsByKey, claimOwner, capsules, activeClaims, defaultSurface)
        || pickAvailableTask(suggested, "suggested-task", claimsByKey, claimOwner, capsules, activeClaims, defaultSurface)
        || pickAvailableTask(techDebt, "tech-debt", claimsByKey, claimOwner, capsules, activeClaims, defaultSurface);
    }

    if (!selection) {
      selection = pickCourseMapExtractionMission(humanLoop, claimsByKey, claimOwner);
    }

    if (!selection) {
      const hadCandidates = activeTasks.length || suggested.length || techDebt.length;
      return {
        stop: true,
        reason: hadCandidates
          ? "all promotable tasks are currently claimed by other auto-hermes threads"
          : "no active, suggested, or tech-debt task is currently promotable",
        activeClaims,
        humanLoop,
        freshClaims,
        structureUpdate: structureSignal,
      };
    }

    const { task, source, surface, claimKey, claimOwnerId, mission = null } = selection;
    const restoredWebsiteAudit = restoreWebsiteAuditMetadata(task);
    return buildWorkUnitResult({
      task,
      source: restoredWebsiteAudit ? "website-audit" : source,
      surface,
      claimKey: restoredWebsiteAudit
        ? taskClaimKey({ source: "website-audit", surface, title: task.title })
        : claimKey,
      claimOwnerId,
      humanLoop,
      activeClaims,
      freshClaims,
      catalogOptions,
      websiteAudit: restoredWebsiteAudit,
      structureUpdate: structureSignal,
      mission,
      args,
    });
    }

function deriveClaimStates(result) {
  const hasPreparedNextRound = Boolean(result?.title) && result?.loopDecision === "continue-self-loop";
  const recommendedAgents = Array.isArray(result?.route?.recommendedAgents) ? result.route.recommendedAgents : [];
  const useCodexSubagents = Boolean(result?.subagentPlan?.useCodexSubagents);
  const useGeminiParallelAgents = Boolean(result?.subagentPlan?.useGeminiParallelAgents);

  return {
    selfLoop: makeClaim("self-loop continuation", { prepared: hasPreparedNextRound }, {
      detail: hasPreparedNextRound ? "controller selected a next bounded round" : "no next bounded round is armed",
      rationale: hasPreparedNextRound
        ? "the controller prepared another round but has not started executing it yet"
        : "the controller either paused or exhausted promotable work",
      evidence: [
        `loopDecision=${result?.loopDecision || "unknown"}`,
        `title=${result?.title || "none"}`,
      ],
    }),
    codexSubagents: makeClaim("codex subagent dispatch", { prepared: useCodexSubagents }, {
      detail: useCodexSubagents
        ? `planned agents: ${recommendedAgents.length ? recommendedAgents.join(", ") : "none"}`
        : "no live subagent dispatch is armed",
      rationale: useCodexSubagents
        ? "a dispatch plan exists, but the plan itself is not proof that any lane is executing"
        : "the round is staying local or sequential",
      evidence: [
        `useCodexSubagents=${useCodexSubagents ? "true" : "false"}`,
        `shape=${result?.route?.shape || "unknown"}`,
        `optionalExternalAgents=${Array.isArray(result?.route?.optionalExternalAgents) && result.route.optionalExternalAgents.length ? result.route.optionalExternalAgents.join(", ") : "none"}`,
      ],
    }),
    geminiParallelAgents: makeClaim("gemini parallel agent dispatch", { prepared: useGeminiParallelAgents }, {
      detail: useGeminiParallelAgents
        ? `planned agents: ${recommendedAgents.length ? recommendedAgents.join(", ") : "none"}`
        : "no live gemini parallel agent dispatch is armed",
      rationale: useGeminiParallelAgents
        ? "gemini CLI will execute planned lanes sequentially as parallel agents"
        : "the round is not using gemini parallel mode",
      evidence: [
        `useGeminiParallelAgents=${useGeminiParallelAgents ? "true" : "false"}`,
      ],
    }),
    humanLoopGate: makeClaim("human loop gate", { configured: true }, {
      detail: result?.humanLoop?.status || "unknown",
      rationale: "the controller reads HUMAN_LOOP before deciding whether continuation is allowed",
      evidence: [
        `status=${result?.humanLoop?.status || "unknown"}`,
        `mustAsk=${result?.humanLoop?.mustAsk ? "true" : "false"}`,
      ],
    }),
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
      `Structure Update Steering: ${result.structureUpdate?.reason || "inactive"}`,
      ...(Array.isArray(result.freshClaims) && result.freshClaims.length
        ? ["", "Fresh task claims:", ...result.freshClaims.map((claim) => `- ${claim.surface || "unknown"} :: ${claim.title || claim.key} :: ${claim.ownerLabel || claim.ownerId}`)]
        : []),
    ].join("\n") + "\n";
  }

  const lines = [
    "# Auto-Hermes Controller",
    "",
    `Decision: ${result.stop ? "pause-self-loop" : "continue-self-loop"}`,
    `Work Unit Source: ${result.source}`,
    `Claim Key: ${result.claimKey || "none"}`,
    `Title: ${result.title}`,
    `Surface: ${result.surface}`,
    `Round Shape: ${result.route.shape}`,
    `Visible Multi-Agent: ${result.route.visibleMultiAgent ? "yes" : "no"}`,
    `Recommended Agents: ${result.route.recommendedAgents.length ? result.route.recommendedAgents.join(", ") : "none"}`,
    `Optional External Agents: ${result.route.optionalExternalAgents?.length ? result.route.optionalExternalAgents.join(", ") : "none"}`,
    `Use Codex Subagents: ${result.subagentPlan.useCodexSubagents ? "yes" : "no"}`,
    `Use Gemini Parallel Agents: ${result.subagentPlan.useGeminiParallelAgents ? "yes" : "no"}`,
    `External Catalog Installed Count: ${result.externalCatalog?.installedCount ?? 0}`,
    "",
    "## Claim States",
    ...Object.values(result.claimStates || {}).flatMap((claim) => renderClaimMarkdown(claim)),
    "",
    "## Why",
    ...result.route.reasons.map((reason) => `- ${reason}`),
    ...(result.mission
      ? [
          "",
          "## Mission",
          `- id: ${result.mission.id}`,
          `- label: ${result.mission.label}`,
          `- stop gate: ${result.mission.stopGate}`,
          `- non-stop condition: ${result.mission.nonStopCondition}`,
          ...result.mission.stopProof.map((item) => `- proof: ${item}`),
        ]
      : []),
    "",
    "## Workflow Composition",
    `- primary: ${result.workflowComposition?.primary || "none"}`,
    `- applied: ${Array.isArray(result.workflowComposition?.applied) && result.workflowComposition.applied.length ? result.workflowComposition.applied.join(", ") : "none"}`,
    `- execution: ${result.workflowComposition?.executionPattern || "none"}`,
    `- coordination: ${result.workflowComposition?.coordinationPattern || "none"}`,
    `- quality: ${result.workflowComposition?.qualityPattern || "none"}`,
    `- delegation: ${result.workflowComposition?.delegationPattern || "none"}`,
    ...(Array.isArray(result.workflowComposition?.reasons)
      ? result.workflowComposition.reasons.map((reason) => `- reason: ${reason}`)
      : []),
    "",
    "## Subagent Plan",
    `- coordinator mode: ${result.subagentPlan.coordinatorMode}`,
    `- spawn order: ${result.subagentPlan.spawnOrder.length ? result.subagentPlan.spawnOrder.join(" -> ") : "none"}`,
    `- parallel groups: ${result.subagentPlan.parallelGroups.length ? result.subagentPlan.parallelGroups.map((group) => group.join(" + ")).join(" | ") : "none"}`,
    ...result.subagentPlan.lanes.map((lane) => `- ${lane.agent}: ${lane.mode}, ${lane.ownership}`),
    ...(result.subagentPlan.optionalSupportAgents?.length
      ? result.subagentPlan.optionalSupportAgents.map((agent) => `- optional support: ${agent}`)
      : []),
    ...result.subagentPlan.notes.map((note) => `- note: ${note}`),
    ...(result.knowledgePack
      ? [
          "",
          "## Knowledge Pack",
          `- strategy: ${result.knowledgePack.strategy}`,
          ...(result.knowledgePack.recordSystemMap
            ? [`- record-system map: ${result.knowledgePack.recordSystemMap.relPath}`]
            : ["- record-system map: none"]),
          ...result.knowledgePack.readOrder.map((entry, index) => `- read ${index + 1}: ${entry.relPath} (${entry.reason})`),
          ...result.knowledgePack.rules.map((rule) => `- rule: ${rule}`),
          `- doc-gardening: ${result.knowledgePack.docGardening.mode}`,
          ...result.knowledgePack.docGardening.smallestOwningDocs.map((entry) => `- owner: ${entry}`),
          ...result.knowledgePack.docGardening.triggers.map((rule) => `- trigger: ${rule}`),
        ]
      : []),
    "",
    "## Tech-Debt Reviewer",
    `- required every round: ${result.techDebtReview?.requiredEveryRound ? "yes" : "no"}`,
    `- scope: ${result.techDebtReview?.scope || "none"}`,
    `- max items: ${result.techDebtReview?.maxItems ?? 0}`,
    `- primary files: ${result.techDebtReview?.primaryFiles?.length ? result.techDebtReview.primaryFiles.join(" | ") : "not specified"}`,
    `- related files: ${result.techDebtReview?.relatedFiles?.length ? result.techDebtReview.relatedFiles.join(" | ") : "none"}`,
    ...(Array.isArray(result.techDebtReview?.taskFormat)
      ? result.techDebtReview.taskFormat.map((entry) => `- task format: ${entry}`)
      : []),
    ...(Array.isArray(result.techDebtReview?.rules)
      ? result.techDebtReview.rules.map((rule) => `- rule: ${rule}`)
      : []),
    ...(result.techDebtReview?.concreteModeRule ? [`- concrete mode: ${result.techDebtReview.concreteModeRule}`] : []),
    "",
    "## Trace To Skill",
    `- mode: ${result.traceToSkill?.mode || "none"}`,
    `- summary: ${result.traceToSkill?.summary || "No trace-to-skill evidence loaded."}`,
    ...(Array.isArray(result.traceToSkill?.candidates) && result.traceToSkill.candidates.length
      ? result.traceToSkill.candidates.map((candidate) => `- candidate: ${candidate.rule} [${candidate.evidenceCount}]`)
      : ["- candidate: none"]),
    ...(result.traceToSkill?.evolvedSkill?.slug
      ? [
          `- evolved skill: ${result.traceToSkill.evolvedSkill.slug}`,
          `- evolved skill summary: ${result.traceToSkill.evolvedSkill.summary || "none"}`,
        ]
      : []),
    "",
    "## Repo-Local External Codex Agents",
    `- installed count: ${result.externalCatalog?.installedCount ?? 0}`,
    `- recommended this round: ${result.route.optionalExternalAgents?.length ? result.route.optionalExternalAgents.join(", ") : "none"}`,
    ...(Array.isArray(result.externalCatalog?.notes)
      ? result.externalCatalog.notes.map((note) => `- note: ${note}`)
      : []),
    ...(result.claimOwnerId
      ? ["", "## Claim State", `- existing owner: ${result.claimOwnerId}`]
      : []),
    "",
    "## Inputs",
    `- Files: ${result.files.length ? result.files.join(" | ") : "not specified"}`,
    `- Context: ${result.context || "none"}`,
    `- Done when: ${result.doneWhen || "none"}`,
    `- Verify: ${result.verify || "none"}`,
    ...(result.frontendGuard
      ? [
          "",
          "## Frontend Guard",
          `- enabled: ${result.frontendGuard.enabled ? "yes" : "no"}`,
          `- summary: ${result.frontendGuard.summary || "none"}`,
          `- routes: ${result.frontendGuard.routes.length ? result.frontendGuard.routes.join(" | ") : "none"}`,
          `- smoke tests: ${result.frontendGuard.smokeTests.length ? result.frontendGuard.smokeTests.join(" | ") : "none"}`,
        ]
      : []),
    ...(result.designContext
      ? [
          "",
          "## Design Context",
          `- authority file: ${result.designContext.authorityFile}`,
          `- reference source: ${result.designContext.referenceSource}`,
          `- target mode: ${result.designContext.targetMode}`,
          `- round type: ${result.designContext.roundType}`,
          `- visual goal: ${result.designContext.visualGoal}`,
          `- preserve: ${result.designContext.preserve}`,
          ...(result.designContext.frontendSkillStack
            ? [
                `- frontend skills: ${result.designContext.frontendSkillStack.stack.map((skill) => `${skill.name}:${skill.available ? "available" : "missing"}`).join(" | ")}`,
                `- missing required frontend skills: ${result.designContext.frontendSkillStack.unavailableRequired.length ? result.designContext.frontendSkillStack.unavailableRequired.join(" | ") : "none"}`,
              ]
            : []),
          ...(result.designContext.browserVerification
            ? [
                `- browser proof: required via ${result.designContext.browserVerification.preferredCodexSurface} (fallback ${result.designContext.browserVerification.codexFallbackSurface})`,
                `- browser checklist: ${result.designContext.browserVerification.checklist.join(" | ")}`,
                `- browser evidence: ${result.designContext.browserVerification.evidence.join(" | ")}`,
                `- quality audit: ${result.designContext.browserVerification.qualityAudit?.manifestCommand} -> ${result.designContext.browserVerification.qualityAudit?.skillName}`,
              ]
            : []),
        ]
      : []),
      "",
    "## Signals",
    `- problemClass: ${result.classification.problemClass}`,
    `- tiny: ${result.classification.tiny}`,
    `- broad: ${result.classification.broad}`,
    `- reviewSensitive: ${result.classification.reviewSensitive}`,
    `- crossStack: ${result.classification.crossStack}`,
    `- touchesFrontend: ${result.classification.touchesFrontend}`,
    `- touchesBackend: ${result.classification.touchesBackend}`,
    `- frontendDesignGateRequired: ${result.classification.frontendDesignGateRequired}`,
    `- backendLogicGateRequired: ${result.classification.backendLogicGateRequired}`,
    `- complexity: ${result.classification.complexity}`,
    "",
    "## Human Loop",
    `- status: ${result.humanLoop.status}`,
    `- mode: ${result.humanLoop.mode}`,
    `- current owned surface: ${result.humanLoop.effectiveCurrentOwnedSurface || result.humanLoop.currentOwnedSurface || "none"}`,
    `- next intended round: ${result.humanLoop.effectiveNextIntendedRound || result.humanLoop.nextIntendedRound || "none"}`,
  ];

  if (result.humanLoop.staleAgentWriteback) {
    lines.push(`- note: stale HUMAN_LOOP agent-writeback fields were ignored for ${result.humanLoop.staleFields.join(", ")}`);
  }

  if (result.structureUpdate) {
    lines.push(
      "",
      "## Structure Update",
      `- status: ${result.structureUpdate.status}`,
      `- applied: ${result.structureUpdate.applied ? "yes" : "no"}`,
      `- reason: ${result.structureUpdate.reason || "none"}`,
      `- recommended default: ${result.structureUpdate.recommendedDefault?.title || "none"}`,
    );
  }

  if (result.activeClaims.length) {
    lines.push("", "## Active Claims");
    for (const claim of result.activeClaims) {
      lines.push(`- ${claim.surface || "unknown"} :: ${claim.task || "unknown task"}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function runAutoHermesController(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : {
    ...parseArgs([]),
    ...rawArgs,
  };
  const workspaceRoot = inferWorkspaceRoot(args);
  const humanLoopText = readOptional(args.humanLoop);
  const humanLoopJsonText = readOptional(args.humanLoopJson);
  const agentSyncText = readOptional(args.agentSync);
  const contextLedgerText = readOptional(args.contextLedger);
  const loopStateText = readOptional(args.loopState);
  const humanLoopMd = parseHumanLoop(humanLoopText);
  const humanLoopJson = parseHumanLoopJson(humanLoopJsonText);
  const humanLoop = mergeHumanLoop(humanLoopJson, humanLoopMd);
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
  const claimState = {
    claimOwner: args.claimOwner,
    freshClaims: listFreshTaskClaims({
      claimDir: args.claimDir,
      ttlMinutes: args.claimTtlMinutes,
    }),
  };
  const structureUpdate = loadStructureUpdateSteering(args);
  const catalogOptions = {
    rootDir: workspaceRoot,
    tasksPath: args.tasks,
  };
  let result = chooseWorkUnit(taskText, humanLoop, agentSyncText, contextLedgerText, claimState, undefined, catalogOptions, structureUpdate, args);

  if (
    result.stop
    && !result.title
    && /no active, suggested, or tech-debt task is currently promotable/i.test(result.reason || "")
    && !humanLoop.pause
    && !humanLoop.stop
    && !humanLoop.mustAsk
    && humanLoop.mode === "autonomous-loop"
  ) {
    if (args.refreshSuggestions) {
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
        result = chooseWorkUnit(taskText, humanLoop, agentSyncText, contextLedgerText, claimState, undefined, catalogOptions, structureUpdate, args);
        result.seededFromSuggestions = true;
      }
    }
  }

  if (
    result.stop
    && !result.title
    && !humanLoop.pause
    && !humanLoop.stop
    && !humanLoop.mustAsk
    && humanLoop.mode === "autonomous-loop"
  ) {
    const websiteAuditReport = runWebsiteAuditFallback(args);
    const queueConfirmedEmpty = websiteAuditReport?.queueState?.status === "confirmed-empty";
    const websiteAudit = buildWebsiteAuditMetadata(websiteAuditReport, {
      usedFallback: queueConfirmedEmpty && Boolean(websiteAuditReport?.candidate),
    });

    if (websiteAudit.usedFallback && websiteAudit.candidate) {
      const fallbackTask = buildWebsiteAuditTask(websiteAudit.candidate);
      result = buildWorkUnitResult({
        task: fallbackTask,
        source: "website-audit",
        surface: websiteAudit.candidate.surface || "unknown",
        claimKey: taskClaimKey({
          source: "website-audit",
          surface: websiteAudit.candidate.surface || "unknown",
          title: fallbackTask?.title || "Website audit follow-up",
        }),
        claimOwnerId: "",
        humanLoop,
        activeClaims: result.activeClaims,
        freshClaims: result.freshClaims,
        catalogOptions,
        websiteAudit,
        structureUpdate,
        args,
      });
      result.reason = websiteAudit.summary;
    } else {
      result = {
        ...result,
        reason: queueConfirmedEmpty ? websiteAudit.summary : result.reason,
        websiteAudit,
        structureUpdate: result.structureUpdate || structureUpdate,
      };
    }
  }

  result.generatedAt = new Date().toISOString();
  result.loopStateSummary = loopStateText.split(/\r?\n/).slice(0, 8).join("\n");
  result.loopDecision = result.stop
    ? (result.title ? "pause-self-loop" : "stop-exhausted")
    : "continue-self-loop";
  result.claimStates = deriveClaimStates(result);
  result.traceToSkill = loadTraceToSkillSignal(args);

  if (args.write) {
    const jsonPath = resolveFromRoot(args.outputJson);
    const mdPath = resolveFromRoot(args.outputMd);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");
    fs.writeFileSync(mdPath, renderMarkdown(result), "utf8");
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
  const { output } = runAutoHermesController(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
