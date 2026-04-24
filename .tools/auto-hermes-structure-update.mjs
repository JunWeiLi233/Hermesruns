import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const DEFAULT_COMMAND_NAME = "auto-hermes-structure-update";
const DEFAULT_MAX_TASKS = 4;
const DEFAULT_STALE_AFTER_HOURS = 72;
const STRUCTURE_SUBHEADING = "### Structure Update Recommendations";
const DEFAULT_BRIEF_JSON = ".ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.json";
const DEFAULT_BRIEF_MD = ".ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.md";

const REQUIRED_RUNTIME_FILES = [
  ".codex/commands/auto-hermes-structure-update.md",
  ".claude/commands/auto-hermes-structure-update.md",
  ".opencode/commands/auto-hermes-structure-update.md",
  ".gemini/commands/auto-hermes-structure-update.toml",
  ".github/prompts/auto-hermes-structure-update.prompt.md",
];

const OWNER_MAP_FILES = [
  "docs/auto-hermes/index.md",
  ".codex/workflows/auto-hermes-architecture.md",
];

const STRUCTURE_TEST_FILES = [
  ".tools/auto-hermes-structure-update.test.mjs",
  "frontend/src/utils/copilotPromptFiles.smoke.test.js",
];

export function runAutoHermesStructureUpdate(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const commandName = options.commandName || DEFAULT_COMMAND_NAME;
  const maxTasks = Math.max(1, Number(options.maxTasks || DEFAULT_MAX_TASKS));
  const staleAfterHours = Math.max(1, Number(options.staleAfterHours || DEFAULT_STALE_AFTER_HOURS));
  const tasksPath = options.tasks || "TASKS.md";
  const tasksAbsolutePath = path.join(rootDir, tasksPath);
  const briefJsonPath = options.briefJson || DEFAULT_BRIEF_JSON;
  const briefMdPath = options.briefMd || DEFAULT_BRIEF_MD;
  const write = Boolean(options.write);

  const tasksContent = fs.existsSync(tasksAbsolutePath) ? fs.readFileSync(tasksAbsolutePath, "utf8") : "";
  const existingTitles = collectExistingTaskTitles(tasksContent);
  const candidates = collectCandidates(rootDir);
  const selectedTasks = candidates
    .filter((candidate) => !existingTitles.has(candidate.title))
    .sort(compareCandidates)
    .slice(0, maxTasks)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      markdown: formatTaskMarkdown(candidate, index === 0),
    }));

  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.parse(generatedAt) + staleAfterHours * 60 * 60 * 1000).toISOString();
  const recommendedDefault = selectedTasks[0]
    ? {
        title: selectedTasks[0].title,
        structureClass: selectedTasks[0].structureClass,
        files: selectedTasks[0].files,
        source: "suggested-task",
        taskSection: "Suggested Next Tasks",
        taskSubsection: "Structure Update Recommendations",
      }
    : null;

  const report = {
    commandName,
    generatedAt,
    status: selectedTasks.length > 0 ? "ready" : "no-gaps-found",
    summary: selectedTasks.length > 0
      ? `Prepared ${selectedTasks.length} bounded structure-update task(s) and marked 1 recommended default for the next eligible /auto-hermes round.`
      : "No structure gaps were detected in the current auto-hermes control-plane surfaces.",
    steering: {
      mode: "next-eligible-round",
      advisory: true,
      respectsActiveQueue: true,
      recommendedDefault,
    },
    freshness: {
      staleAfterHours,
      expiresAt,
    },
    shortlist: selectedTasks.map((task) => ({
      rank: task.rank,
      title: task.title,
      structureClass: task.structureClass,
      score: task.score,
      files: task.files,
      context: task.context,
      doneWhen: task.doneWhen,
      verify: task.verify,
      rollbackTarget: task.rollbackTarget,
    })),
    writeback: {
      attempted: write,
      tasksUpdated: false,
      briefJsonPath,
      briefMdPath,
    },
  };

  if (write && fs.existsSync(tasksAbsolutePath)) {
    const nextTasksContent = writeStructureTasks(tasksContent, selectedTasks);
    fs.writeFileSync(tasksAbsolutePath, nextTasksContent, "utf8");
    report.writeback.tasksUpdated = nextTasksContent !== tasksContent;
  }

  if (write) {
    const briefJsonAbsolute = path.join(rootDir, briefJsonPath);
    const briefMdAbsolute = path.join(rootDir, briefMdPath);
    fs.mkdirSync(path.dirname(briefJsonAbsolute), { recursive: true });
    fs.mkdirSync(path.dirname(briefMdAbsolute), { recursive: true });
    fs.writeFileSync(briefJsonAbsolute, JSON.stringify(report, null, 2), "utf8");
    fs.writeFileSync(briefMdAbsolute, renderMarkdown(report), "utf8");
  }

  return { report };
}

function collectCandidates(rootDir) {
  const candidates = [];
  const runtimeParity = createRuntimeParityCandidate(rootDir);
  if (runtimeParity) candidates.push(runtimeParity);

  const controllerSteering = createControllerSteeringCandidate(rootDir);
  if (controllerSteering) candidates.push(controllerSteering);

  const ownerMapDrift = createOwnerMapDriftCandidate(rootDir);
  if (ownerMapDrift) candidates.push(ownerMapDrift);

  const focusedCoverage = createFocusedCoverageCandidate(rootDir);
  if (focusedCoverage) candidates.push(focusedCoverage);

  return candidates;
}

function createRuntimeParityCandidate(rootDir) {
  const missingFiles = REQUIRED_RUNTIME_FILES.filter((relPath) => !fs.existsSync(path.join(rootDir, relPath)));
  if (missingFiles.length === 0) return null;

  return {
    title: "Expose /auto-hermes-structure-update across Hermes runtimes",
    structureClass: "runtime-parity-gap",
    score: 110 - missingFiles.length,
    files: [
      ".codex/commands/auto-hermes-structure-update.md",
      ...missingFiles,
    ],
    context: `The new structure-update workflow is missing native runtime surfaces: ${missingFiles.map((file) => `\`${file}\``).join(", ")}. Without those adapters, the command is not consistently available in Claude Code, OpenCode, Gemini CLI, and repo-side prompt integrations.`,
    doneWhen: "The structure-update command exists as a native adapter in every Hermes runtime surface and each adapter points back to the shared engine/contract instead of inventing its own behavior.",
    verify: "node .tools/auto-hermes-structure-update.test.mjs",
    rollbackTarget: "working tree before the auto-hermes-structure-update command family was introduced",
  };
}

function createControllerSteeringCandidate(rootDir) {
  const controllerPath = path.join(rootDir, ".tools/auto-hermes-controller.mjs");
  const controllerSource = readText(controllerPath);
  if (!controllerSource || /AUTO_HERMES_STRUCTURE_UPDATE/.test(controllerSource)) {
    return null;
  }

  return {
    title: "Teach auto-hermes to honor structure-update steering briefs",
    structureClass: "steering-gap",
    score: 95,
    files: [
      ".tools/auto-hermes-controller.mjs",
      ".ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.json",
    ],
    context: "The controller does not currently consume a dedicated structure-update brief, so `/auto-hermes` cannot safely bias the next eligible round toward the highest-priority structure repair without hard-coding queue order.",
    doneWhen: "The controller reads the structure-update brief, prefers the recommended default on the next eligible round, and defers safely when higher-priority active work already exists.",
    verify: "node .tools/auto-hermes-structure-update.test.mjs",
    rollbackTarget: "controller behavior before structure-update steering was introduced",
  };
}

function createOwnerMapDriftCandidate(rootDir) {
  const missingRefs = OWNER_MAP_FILES.filter((relPath) => {
    const content = readText(path.join(rootDir, relPath));
    return !/auto-hermes-structure-update/i.test(content);
  });
  if (missingRefs.length === 0) return null;

  return {
    title: "Document structure-update ownership in the auto-hermes record system",
    structureClass: "owner-map-drift",
    score: 88,
    files: missingRefs,
    context: `The durable owner docs do not mention the structure-update command or steering brief in ${missingRefs.map((file) => `\`${file}\``).join(", ")}. That leaves long-term behavior harder to rediscover and easier to drift.`,
    doneWhen: "The auto-hermes record map and architecture summary describe where structure-update suggestions live, how the steering brief is consumed, and which file owns that behavior.",
    verify: "node .tools/auto-hermes-structure-update.test.mjs",
    rollbackTarget: "docs state before the structure-update ownership map was added",
  };
}

function createFocusedCoverageCandidate(rootDir) {
  const missingTests = STRUCTURE_TEST_FILES.filter((relPath) => !fs.existsSync(path.join(rootDir, relPath)));
  if (missingTests.length === 0) return null;

  return {
    title: "Add focused coverage for auto-hermes-structure-update",
    structureClass: "verification-gap",
    score: 84,
    files: [
      ".tools/auto-hermes-structure-update.mjs",
      ...missingTests,
    ],
    context: `The structure-update command family is missing focused verification coverage for ${missingTests.map((file) => `\`${file}\``).join(", ")}. Without that coverage, runtime parity and controller steering can silently drift.`,
    doneWhen: "The shared engine, steering behavior, and Copilot prompt registration have focused tests that fail when structure-update wiring drifts.",
    verify: "node .tools/auto-hermes-structure-update.test.mjs && node frontend/src/utils/copilotPromptFiles.smoke.test.js",
    rollbackTarget: "current command-family state before new structure-update coverage landed",
  };
}

function compareCandidates(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  return left.title.localeCompare(right.title);
}

function collectExistingTaskTitles(tasksContent) {
  const titles = new Set();
  const matches = tasksContent.matchAll(/^- \[[ x]\] (.+)$/gm);
  for (const match of matches) {
    titles.add(match[1].trim());
  }
  return titles;
}

function writeStructureTasks(tasksContent, selectedTasks) {
  const section = extractMarkdownSection(tasksContent, "Suggested Next Tasks");
  const cleaned = removeSubheadingBlock(section, STRUCTURE_SUBHEADING).trim();
  const structureBlock = selectedTasks.length > 0
    ? [
        STRUCTURE_SUBHEADING,
        ...selectedTasks.map((task) => task.markdown),
      ].join("\n")
    : "";

  const nextSectionContent = [structureBlock, cleaned]
    .filter(Boolean)
    .join("\n\n")
    .trimEnd();

  return replaceOrAppendMarkdownSection(tasksContent, "Suggested Next Tasks", nextSectionContent);
}

function formatTaskMarkdown(task, isDefault) {
  const filesText = task.files.map((file) => `\`${file}\``).join(", ");
  return [
    `- [ ] ${task.title}`,
    `  Files: ${filesText}`,
    "  Owner: tooling-agent",
    `  Context: ${task.context}`,
    `  Structure Class: ${task.structureClass}`,
    `  Structure Update Default: ${isDefault ? "yes" : "no"}`,
    `  Done when: ${task.doneWhen}`,
    `  Verify: \`${task.verify}\``,
    `  Rollback target: ${task.rollbackTarget}`,
  ].join("\n");
}

function extractMarkdownSection(text, heading) {
  const lines = String(text || "").split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex === -1) return "";

  const collected = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    collected.push(lines[index]);
  }
  return collected.join("\n").trimEnd();
}

function replaceOrAppendMarkdownSection(text, heading, content) {
  if (String(text || "").includes(`## ${heading}`)) {
    return replaceMarkdownSection(text, heading, content);
  }
  const suffix = text.endsWith("\n") ? "" : "\n";
  return `${text}${suffix}\n## ${heading}\n${content.trimEnd()}\n`;
}

function replaceMarkdownSection(text, heading, content) {
  const lines = String(text || "").split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex === -1) return text;

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  const before = lines.slice(0, startIndex + 1);
  const nextContent = content.trimEnd() ? content.trimEnd().split(/\r?\n/) : [];
  const after = lines.slice(endIndex);
  return [...before, ...nextContent, "", ...after].join("\n").replace(/\n{3,}/g, "\n\n");
}

function removeSubheadingBlock(sectionText, subheading) {
  if (!sectionText) return "";
  const lines = sectionText.split(/\r?\n/);
  const result = [];
  let skipping = false;

  for (const line of lines) {
    if (line.trim() === subheading) {
      skipping = true;
      continue;
    }
    if (skipping && /^###\s+/.test(line)) {
      skipping = false;
    }
    if (skipping) continue;
    result.push(line);
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function renderMarkdown(report) {
  const lines = [
    "# Auto-Hermes Structure Update",
    "",
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    "",
    "## Summary",
    report.summary,
    "",
    "## Steering",
    `- mode: ${report.steering.mode}`,
    `- advisory: ${report.steering.advisory ? "yes" : "no"}`,
    `- respects active queue: ${report.steering.respectsActiveQueue ? "yes" : "no"}`,
    `- recommended default: ${report.steering.recommendedDefault?.title || "none"}`,
    "",
    "## Shortlist",
  ];

  if (report.shortlist.length === 0) {
    lines.push("- none");
  } else {
    for (const task of report.shortlist) {
      lines.push(`- [${task.rank}] ${task.title} (${task.structureClass})`);
      lines.push(`  Files: ${task.files.join(" | ")}`);
      lines.push(`  Verify: ${task.verify}`);
      lines.push(`  Rollback: ${task.rollbackTarget}`);
    }
  }

  lines.push(
    "",
    "## Freshness",
    `- stale after hours: ${report.freshness.staleAfterHours}`,
    `- expires at: ${report.freshness.expiresAt}`,
  );

  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    maxTasks: DEFAULT_MAX_TASKS,
    staleAfterHours: DEFAULT_STALE_AFTER_HOURS,
    commandName: DEFAULT_COMMAND_NAME,
    tasks: "TASKS.md",
    briefJson: DEFAULT_BRIEF_JSON,
    briefMd: DEFAULT_BRIEF_MD,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--max") {
      options.maxTasks = Number(argv[index + 1] || DEFAULT_MAX_TASKS);
      index += 1;
      continue;
    }
    if (arg === "--stale-after-hours") {
      options.staleAfterHours = Number(argv[index + 1] || DEFAULT_STALE_AFTER_HOURS);
      index += 1;
      continue;
    }
    if (arg === "--command-name") {
      options.commandName = argv[index + 1] || DEFAULT_COMMAND_NAME;
      index += 1;
      continue;
    }
    if (arg === "--tasks") {
      options.tasks = argv[index + 1] || "TASKS.md";
      index += 1;
      continue;
    }
    if (arg === "--brief-json") {
      options.briefJson = argv[index + 1] || DEFAULT_BRIEF_JSON;
      index += 1;
      continue;
    }
    if (arg === "--brief-md") {
      options.briefMd = argv[index + 1] || DEFAULT_BRIEF_MD;
      index += 1;
      continue;
    }
  }

  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const options = parseArgs(process.argv.slice(2));
  const { report } = runAutoHermesStructureUpdate(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderMarkdown(report));
  }
}
