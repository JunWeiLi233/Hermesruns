#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const MAX_LANES = 5;
const EFFORT_WEIGHT = {
  tiny: 0.35,
  small: 0.7,
  medium: 1,
  large: 1.35,
  xlarge: 1.7,
};

function makeRunId() {
  return `ahm-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    runtime: "codex-live",
    scope: "",
    mode: "adaptive",
    planFile: ".ai-sync/AUTO_HERMES_MAX_PLAN.json",
    outputJson: ".ai-sync/AUTO_HERMES_MAX.json",
    outputMd: ".ai-sync/AUTO_HERMES_MAX.md",
    coordinatorJson: ".ai-sync/AUTO_HERMES_MAX_COORDINATOR.json",
    coordinatorMd: ".ai-sync/AUTO_HERMES_MAX_COORDINATOR.md",
    lanesDir: ".ai-sync/auto-hermes-max-lanes",
    resultsDir: ".ai-sync/auto-hermes-max-results",
    mergeJson: ".ai-sync/AUTO_HERMES_MAX_MERGE.json",
    mergeMd: ".ai-sync/AUTO_HERMES_MAX_MERGE.md",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
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

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(relPath, fallback) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeFileList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseModeLaneTarget(mode) {
  const raw = String(mode || "").trim().toLowerCase();
  const match = raw.match(/^parallel-(\d+)$/);
  if (!match) return null;
  return clamp(Number.parseInt(match[1], 10), 1, MAX_LANES);
}

function normalizeEffort(value) {
  const raw = String(value || "").trim().toLowerCase();
  return EFFORT_WEIGHT[raw] ? raw : "medium";
}

function normalizePriority(value, fallback) {
  const parsed = normalizeInteger(value);
  return parsed === null ? fallback : parsed;
}

function normalizeLane(lane, index) {
  return {
    ...lane,
    laneId: String(lane?.laneId || `lane-${index + 1}`).trim() || `lane-${index + 1}`,
    goal: String(lane?.goal || "").trim(),
    ownedFiles: normalizeFileList(lane?.ownedFiles),
    mustPreserve: normalizeFileList(lane?.mustPreserve),
    verify: String(lane?.verify || "").trim(),
    mergeNotes: String(lane?.mergeNotes || "").trim(),
    dependsOn: normalizeFileList(lane?.dependsOn),
    priority: normalizePriority(lane?.priority, index + 1),
    effort: normalizeEffort(lane?.effort),
    parallelSafe: lane?.parallelSafe !== false,
  };
}

function chooseLaunchSet(plan, normalizedLanes, mode) {
  const laneSelection = plan?.laneSelection && typeof plan.laneSelection === "object" ? plan.laneSelection : {};
  const strategy = String(laneSelection.strategy || "auto").trim().toLowerCase() || "auto";
  const maxLaneCount = clamp(
    normalizeInteger(laneSelection.maxLaneCount) ?? MAX_LANES,
    1,
    MAX_LANES,
  );
  const minLaneCount = clamp(
    normalizeInteger(laneSelection.minLaneCount) ?? 1,
    1,
    maxLaneCount,
  );
  const readyLanes = normalizedLanes
    .filter((lane) => lane.parallelSafe && lane.dependsOn.length === 0)
    .sort((a, b) => a.priority - b.priority);
  const candidateLanes = readyLanes.length ? readyLanes : normalizedLanes.slice().sort((a, b) => a.priority - b.priority);
  const modeLaneTarget = parseModeLaneTarget(mode);
  const requestedLaneCount = normalizeInteger(laneSelection.requestedLaneCount);
  const recommendedLaneCount = normalizeInteger(laneSelection.recommendedLaneCount);
  const explicitLaneTarget = requestedLaneCount ?? recommendedLaneCount ?? modeLaneTarget;

  let selectedLaneCount = 0;
  let rationale = "";
  if (candidateLanes.length === 0) {
    rationale = "No launchable lanes were produced by the plan.";
  } else if (explicitLaneTarget !== null && strategy !== "auto") {
    selectedLaneCount = clamp(explicitLaneTarget, minLaneCount, Math.min(maxLaneCount, candidateLanes.length));
    rationale = `Plan strategy '${strategy}' requested ${selectedLaneCount} lane(s).`;
  } else if (explicitLaneTarget !== null && strategy === "auto") {
    selectedLaneCount = clamp(explicitLaneTarget, minLaneCount, Math.min(maxLaneCount, candidateLanes.length));
    rationale = `Auto strategy honored the explicit lane target of ${selectedLaneCount}.`;
  } else {
    const coordinationCost = String(laneSelection.coordinationCost || "medium").trim().toLowerCase();
    const mergeComplexity = String(laneSelection.mergeComplexity || "medium").trim().toLowerCase();
    const totalWeight = candidateLanes.reduce((sum, lane) => sum + EFFORT_WEIGHT[lane.effort], 0);
    let heuristicCount = Math.max(1, Math.round(totalWeight));

    if (coordinationCost === "high") heuristicCount -= 1;
    if (mergeComplexity === "high") heuristicCount -= 1;
    if (coordinationCost === "low" && mergeComplexity === "low" && heuristicCount < candidateLanes.length) {
      heuristicCount += 1;
    }

    selectedLaneCount = clamp(heuristicCount, minLaneCount, Math.min(maxLaneCount, candidateLanes.length));
    rationale = `Auto-selected ${selectedLaneCount} lane(s) from ${candidateLanes.length} candidate lane(s) using effort, coordination cost, and merge complexity.`;
  }

  const selectedLanes = candidateLanes.slice(0, selectedLaneCount);
  const deferredLanes = candidateLanes.slice(selectedLaneCount);
  return {
    strategy,
    minLaneCount,
    maxLaneCount,
    candidateLanes,
    selectedLanes,
    deferredLanes,
    selectedLaneCount,
    rationale,
  };
}

function defaultPlan(scope) {
  return {
    parentGoal: scope || "Define one parent /auto-hermes-max round",
    preserve: [],
    laneSelection: {
      strategy: "auto",
      minLaneCount: 1,
      maxLaneCount: 5,
    },
    lanes: [
      {
        laneId: "lane-1",
        goal: "Define the first bounded child /auto-hermes round",
        ownedFiles: [],
        mustPreserve: [],
        verify: "",
        effort: "medium",
      },
    ],
  };
}

function validatePlan(plan) {
  const issues = [];
  const lanes = Array.isArray(plan?.lanes) ? plan.lanes.map((lane, index) => normalizeLane(lane, index)) : [];

  if (!String(plan?.parentGoal || "").trim()) {
    issues.push("plan must include a non-empty parentGoal");
  }
  if (!lanes.length) {
    issues.push("plan must include at least one child lane");
  }
  if (lanes.length > MAX_LANES) {
    issues.push(`plan exceeds max lane count (${MAX_LANES})`);
  }

  const ownership = new Map();
  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index] || {};
    const laneId = lane.laneId;
    const goal = lane.goal;
    const ownedFiles = lane.ownedFiles;
    if (!laneId) issues.push(`lane ${index + 1} must have laneId`);
    if (!goal) issues.push(`${laneId || `lane-${index + 1}`} must have a goal`);
    if (!ownedFiles.length) issues.push(`${laneId || `lane-${index + 1}`} must declare ownedFiles`);
    for (const file of ownedFiles) {
      const prior = ownership.get(file);
      if (prior && prior !== laneId) {
        issues.push(`file ownership overlaps between ${prior} and ${laneId}: ${file}`);
      } else {
        ownership.set(file, laneId);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

function buildLanePacket(plan, lane, index, parentRunId) {
  const normalizedLane = normalizeLane(lane, index);
  const laneId = normalizedLane.laneId;
  const normalizedOwnedFiles = normalizedLane.ownedFiles;
  const resultFile = path.join(resolveFromRoot(".ai-sync/auto-hermes-max-results"), `${laneId}.json`);
  return {
    laneId,
    parentRunId,
    correlationId: `${parentRunId}:${laneId}`,
    goal: normalizedLane.goal,
    parentGoal: String(plan.parentGoal || "").trim(),
    mode: "single-round",
    ownedFiles: normalizedOwnedFiles,
    mustPreserve: normalizedLane.mustPreserve,
    verify: normalizedLane.verify,
    mergeNotes: normalizedLane.mergeNotes,
    priority: normalizedLane.priority,
    effort: normalizedLane.effort,
    dependsOn: normalizedLane.dependsOn,
    status: "pending-launch",
    resultFile,
    command: `/auto-hermes scope="${normalizedLane.goal}" mode=single-round`,
  };
}

function renderLanePrompt(lanePacket) {
  return [
    "# Auto-Hermes Max Lane",
    "",
    `Lane: ${lanePacket.laneId}`,
    `Parent Run Id: ${lanePacket.parentRunId}`,
    `Correlation Id: ${lanePacket.correlationId}`,
    `Parent Goal: ${lanePacket.parentGoal}`,
    `Goal: ${lanePacket.goal}`,
    "",
    "Contract:",
    "- This lane is one bounded `/auto-hermes` worker round.",
    "- Do not self-loop inside the child lane.",
    "- Do not edit files outside owned ownership.",
    "- Return a compact lane result packet for merge.",
    "- Write or report the lane result packet against the provided result file path so the parent merge gate can correlate long-running child rounds later.",
    "",
    `Owned Files: ${lanePacket.ownedFiles.length ? lanePacket.ownedFiles.join(" | ") : "none"}`,
    `Priority: ${lanePacket.priority}`,
    `Effort: ${lanePacket.effort}`,
    `Depends On: ${lanePacket.dependsOn.length ? lanePacket.dependsOn.join(" | ") : "none"}`,
    `Must Preserve: ${lanePacket.mustPreserve.length ? lanePacket.mustPreserve.join(" | ") : "none"}`,
    `Verify: ${lanePacket.verify || "none"}`,
    `Merge Notes: ${lanePacket.mergeNotes || "none"}`,
    `Result File: ${lanePacket.resultFile}`,
    "",
    `Launch Command: ${lanePacket.command}`,
  ].join("\n") + "\n";
}

function renderMergeMarkdown(state) {
  const lines = [
    "# Auto-Hermes Max Merge Gate",
    "",
    `Generated: ${state.generatedAt}`,
    `Parent Goal: ${state.parentGoal}`,
    `Parent Run Id: ${state.parentRunId}`,
    `Correlation Id: ${state.correlationId}`,
    "",
    "Required checks:",
    "1. Ownership Gate",
    "2. Contract Gate",
    "3. Verification Gate",
    "4. Runtime Truth Gate",
    "5. Regression Gate",
    "6. Review Gate",
    "7. Evidence Gate",
    "",
    "Lane statuses:",
    ...state.lanes.map((lane) => `- ${lane.laneId}: ${lane.status} :: ${lane.resultFile}`),
  ];
  return `${lines.join("\n")}\n`;
}

function renderCoordinatorMarkdown(state) {
  const lines = [
    "# Auto-Hermes Max Coordinator",
    "",
    `Generated: ${state.generatedAt}`,
    `Runtime: ${state.runtime}`,
    `Status: ${state.status}`,
    `Next Action: ${state.nextAction}`,
    `Must Not Reply Yet: ${state.mustNotReplyYet ? "yes" : "no"}`,
    `Selection Strategy: ${state.laneSelection.strategy}`,
    `Candidate Lane Count: ${state.candidateLaneCount}`,
    `Selected Lane Count: ${state.selectedLaneCount}`,
    "",
    `Parent Goal: ${state.parentGoal}`,
    `Parent Run Id: ${state.parentRunId}`,
    `Correlation Id: ${state.correlationId}`,
    `Selection Rationale: ${state.selectionRationale}`,
    "",
    "## Launched Lanes",
    ...state.lanes.map((lane) => `- ${lane.laneId}: ${lane.goal} :: ${lane.ownedFiles.join(" | ")} :: result ${lane.resultFile}`),
    "",
    "## Coordinator Contract",
    "- Launch all approved lanes in parallel as child `/auto-hermes` single-round workers.",
    "- Keep ownership disjoint.",
    "- Collect one lane result packet per lane.",
    "- Run the merge gate before any combined live claim.",
    "- If the merge gate fails, do not declare the parent round complete.",
  ];
  if (state.deferredLanes.length) {
    lines.push("", "## Deferred Candidate Lanes", ...state.deferredLanes.map((lane) => `- ${lane.laneId}: ${lane.goal} :: priority ${lane.priority} :: effort ${lane.effort}`));
  }
  if (state.issues.length) {
    lines.push("", "## Blocking Issues", ...state.issues.map((issue) => `- ${issue}`));
  }
  return `${lines.join("\n")}\n`;
}

function writeArtifacts(args, state) {
  const outputJson = resolveFromRoot(args.outputJson);
  const outputMd = resolveFromRoot(args.outputMd);
  const coordinatorJson = resolveFromRoot(args.coordinatorJson);
  const coordinatorMd = resolveFromRoot(args.coordinatorMd);
  const mergeJson = resolveFromRoot(args.mergeJson);
  const mergeMd = resolveFromRoot(args.mergeMd);
  const lanesDir = resolveFromRoot(args.lanesDir);
  const resultsDir = resolveFromRoot(args.resultsDir);

  ensureParent(outputJson);
  ensureParent(outputMd);
  ensureParent(coordinatorJson);
  ensureParent(coordinatorMd);
  ensureParent(mergeJson);
  ensureParent(mergeMd);
  fs.mkdirSync(lanesDir, { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });

  fs.writeFileSync(outputJson, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(outputMd, renderCoordinatorMarkdown(state), "utf8");
  fs.writeFileSync(coordinatorJson, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(coordinatorMd, renderCoordinatorMarkdown(state), "utf8");

  const mergeState = {
    generatedAt: state.generatedAt,
    parentGoal: state.parentGoal,
    parentRunId: state.parentRunId,
    correlationId: state.correlationId,
    resultsDir,
    lanes: state.lanes.map((lane) => ({
      laneId: lane.laneId,
      correlationId: lane.correlationId,
      status: "pending-result",
      resultFile: lane.resultFile,
      ownedFiles: lane.ownedFiles,
    })),
  };
  fs.writeFileSync(mergeJson, JSON.stringify(mergeState, null, 2), "utf8");
  fs.writeFileSync(mergeMd, renderMergeMarkdown(mergeState), "utf8");

  for (const lane of state.lanes) {
    const laneJson = path.join(lanesDir, `${lane.laneId}.json`);
    const laneMd = path.join(lanesDir, `${lane.laneId}.md`);
    fs.writeFileSync(laneJson, JSON.stringify(lane, null, 2), "utf8");
    fs.writeFileSync(laneMd, renderLanePrompt(lane), "utf8");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawPlan = readJson(args.planFile, null) || defaultPlan(args.scope);
  const validation = validatePlan(rawPlan);
  const parentRunId = makeRunId();
  const correlationId = `${parentRunId}:parent`;
  const resultsDir = resolveFromRoot(args.resultsDir);
  const normalizedPlanLanes = (Array.isArray(rawPlan.lanes) ? rawPlan.lanes : [])
    .slice(0, MAX_LANES)
    .map((lane, index) => normalizeLane(lane, index));
  const launchSelection = chooseLaunchSet(rawPlan, normalizedPlanLanes, args.mode);
  const lanes = launchSelection.selectedLanes
    .map((lane, index) => buildLanePacket(rawPlan, lane, index, parentRunId))
    .map((lane) => ({
      ...lane,
      resultFile: path.join(resultsDir, `${lane.laneId}.json`),
    }));

  const state = {
    generatedAt: nowIso(),
    runtime: args.runtime,
    mode: args.mode,
    status: validation.ok && launchSelection.selectedLaneCount > 0 ? "ready-to-launch" : "invalid-plan",
    nextAction: validation.ok
      ? launchSelection.selectedLaneCount <= 1
        ? "codex-max-launch-single-lane"
        : "codex-max-launch-lanes"
      : "stop",
    mustNotReplyYet: validation.ok && launchSelection.selectedLaneCount > 0,
    parentGoal: String(rawPlan.parentGoal || args.scope || "").trim(),
    parentRunId,
    correlationId,
    preserve: normalizeFileList(rawPlan.preserve),
    resultsDir,
    laneSelection: {
      strategy: launchSelection.strategy,
      minLaneCount: launchSelection.minLaneCount,
      maxLaneCount: launchSelection.maxLaneCount,
    },
    candidateLaneCount: launchSelection.candidateLanes.length,
    selectedLaneCount: launchSelection.selectedLaneCount,
    selectionRationale: launchSelection.rationale,
    deferredLanes: launchSelection.deferredLanes.map((lane) => ({
      laneId: lane.laneId,
      goal: lane.goal,
      priority: lane.priority,
      effort: lane.effort,
      ownedFiles: lane.ownedFiles,
    })),
    lanes,
    issues: launchSelection.selectedLaneCount > 0 ? validation.issues : [...validation.issues, "launcher selected zero lanes"],
  };

  if (args.write) writeArtifacts(args, state);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderCoordinatorMarkdown(state));
}

main();
