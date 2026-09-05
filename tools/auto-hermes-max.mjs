#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAutoHermesController } from "./auto-hermes-controller.mjs";
import { inferWorkflowComposition } from "./auto-hermes-composition-patterns.mjs";
import { runAutoHermesWebsiteAudit } from "./auto-hermes-website-audit.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const MAX_LANES = 5;
const MAX_ITERATIONS = 10;
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

function makeContextSnapshotPath(runId) {
  return `.workspace/state/context-snapshots/${runId}.json`;
}

function makeProgressLedgerPath(runId) {
  return `.workspace/state/auto-hermes-max-state/${runId}-progress.json`;
}

function makeStatePath(runId) {
  return `.workspace/state/auto-hermes-max-state/${runId}-state.json`;
}

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    runtime: "codex-live",
    scope: "",
    mode: "adaptive",
    maxIterations: "10",
    tasks: "TASKS.md",
    humanLoop: ".workspace/state/HUMAN_LOOP.md",
    agentSync: ".workspace/state/AGENT_SYNC.md",
    contextLedger: ".workspace/state/CONTEXT_LEDGER.md",
    loopState: ".workspace/state/LOOP_STATE.md",
    liveControllerJson: ".workspace/state/AUTO_HERMES_CONTROLLER.json",
    liveControllerMd: ".workspace/state/AUTO_HERMES_CONTROLLER.md",
    planFile: ".workspace/state/AUTO_HERMES_MAX_PLAN.json",
    outputJson: ".workspace/state/AUTO_HERMES_MAX.json",
    outputMd: ".workspace/state/AUTO_HERMES_MAX.md",
    coordinatorJson: ".workspace/state/AUTO_HERMES_MAX_COORDINATOR.json",
    coordinatorMd: ".workspace/state/AUTO_HERMES_MAX_COORDINATOR.md",
    explorerJson: ".workspace/state/AUTO_HERMES_MAX_EXPLORER.json",
    explorerMd: ".workspace/state/AUTO_HERMES_MAX_EXPLORER.md",
    lanesDir: ".workspace/state/auto-hermes-max-lanes",
    resultsDir: ".workspace/state/auto-hermes-max-results",
    mergeJson: ".workspace/state/AUTO_HERMES_MAX_MERGE.json",
    mergeMd: ".workspace/state/AUTO_HERMES_MAX_MERGE.md",
    stateDir: ".workspace/state/auto-hermes-max-state",
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

  args.maxIterations = Math.max(1, Math.min(50, Number.parseInt(args.maxIterations, 10) || 10));

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

function writeJson(relPath, data) {
  const fullPath = resolveFromRoot(relPath);
  ensureParent(fullPath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
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
  const dependsOn = normalizeFileList(lane?.dependsOn);
  const dependencyMode = String(lane?.dependencyMode || "").trim().toLowerCase();
  const parallelSafe = lane?.parallelSafe !== false;
  let dependencyState = "parallel-ready";
  if (!parallelSafe) dependencyState = "not-parallel-safe";
  else if (dependencyMode === "blocked-by-plan") dependencyState = "blocked-by-plan";
  else if (dependsOn.length > 0) dependencyState = `sequential-after:${dependsOn.join("|")}`;
  return {
    ...lane,
    laneId: String(lane?.laneId || `lane-${index + 1}`).trim() || `lane-${index + 1}`,
    goal: String(lane?.goal || "").trim(),
    ownedFiles: normalizeFileList(lane?.ownedFiles),
    mustPreserve: normalizeFileList(lane?.mustPreserve),
    verify: String(lane?.verify || "").trim(),
    mergeNotes: String(lane?.mergeNotes || "").trim(),
    dependsOn,
    dependencyState,
    priority: normalizePriority(lane?.priority, index + 1),
    effort: normalizeEffort(lane?.effort),
    parallelSafe,
  };
}

// Ralph-style context snapshot - grounding before execution
function buildContextSnapshot(args, controllerResult, plan) {
  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  const classification = controllerResult?.classification || {};

  return {
    generatedAt: nowIso(),
    taskStatement: args.scope || controllerResult?.title || "Auto-hermes-max parallel execution",
    desiredOutcome: plan?.parentGoal || "Complete all lane work with verification and merge",
    knownFacts: {
      controllerDecision: controllerResult?.loopDecision || "unknown",
      surface: controllerResult?.surface || "unknown",
      problemClass: controllerResult?.problemClass || "unknown",
      touchesFrontend: classification.touchesFrontend || false,
      touchesBackend: classification.touchesBackend || false,
      isCrossStack: classification.crossStack || false,
    },
    constraints: {
      maxLanes: MAX_LANES,
      maxIterations: args.maxIterations,
      disjointFileOwnership: true,
      requiresVerification: true,
      requiresArchitectReview: true,
    },
    unknowns: [],
    likelyTouchpoints: files,
    lanesPlanned: plan?.lanes?.length || 0,
  };
}

// Ralph-style progress ledger
function buildProgressLedger(runId, parentGoal, lanes) {
  return {
    runId,
    parentGoal,
    generatedAt: nowIso(),
    mode: "ralph-style-parallel",
    active: true,
    currentPhase: "executing",
    iteration: 1,
    maxIterations: MAX_ITERATIONS,
    lanes: lanes.map((lane) => ({
      laneId: lane.laneId,
      goal: lane.goal,
      status: "pending-launch",
      ownedFiles: lane.ownedFiles,
      completedRounds: 0,
      verification: null,
      runtimeProof: null,
      architectApproved: false,
    })),
    gates: {
      ownership: "pending",
      contract: "pending",
      verification: "pending",
      runtimeTruth: "pending",
      regression: "pending",
      arbitration: "pending",
      review: "pending",
      evidence: "pending",
      deslop: "pending",
    },
  };
}

// Ralph-style state management
function writeRalphState(runId, state) {
  const statePath = makeStatePath(runId);
  writeJson(statePath, {
    mode: "auto-hermes-max",
    active: state.active,
    iteration: state.iteration,
    maxIterations: state.maxIterations,
    currentPhase: state.currentPhase,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    runId,
    parentGoal: state.parentGoal,
    contextSnapshotPath: state.contextSnapshotPath,
    progressLedgerPath: state.progressLedgerPath,
  });
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
  const blockedCandidateLanes = normalizedLanes
    .filter((lane) => lane.dependencyState === "blocked-by-plan" || lane.dependencyState === "not-parallel-safe")
    .sort((a, b) => a.priority - b.priority);
  const sequentialCandidateLanes = normalizedLanes
    .filter((lane) => lane.parallelSafe && lane.dependsOn.length > 0 && lane.dependencyState !== "blocked-by-plan")
    .sort((a, b) => a.priority - b.priority);
  const readyLanes = normalizedLanes
    .filter((lane) => lane.parallelSafe && lane.dependsOn.length === 0 && lane.dependencyState !== "blocked-by-plan")
    .sort((a, b) => a.priority - b.priority);
  const candidateLanes = readyLanes;
  const modeLaneTarget = parseModeLaneTarget(mode);
  const requestedLaneCount = normalizeInteger(laneSelection.requestedLaneCount);
  const recommendedLaneCount = normalizeInteger(laneSelection.recommendedLaneCount);
  const explicitLaneTarget = requestedLaneCount ?? recommendedLaneCount ?? modeLaneTarget;

  let selectedLaneCount = 0;
  let rationale = "";
  if (candidateLanes.length === 0) {
    rationale = sequentialCandidateLanes.length
      ? "No parallel-ready lanes were produced by the plan; remaining lanes require sequential execution."
      : blockedCandidateLanes.length
        ? "All candidate lanes are blocked by plan-level constraints."
        : "No launchable lanes were produced by the plan.";
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
    rationale = `Auto-selected ${selectedLaneCount} lane(s) from ${candidateLanes.length} parallel-ready candidate lane(s) using effort, coordination cost, and merge complexity.`;
  }

  const selectedLanes = candidateLanes.slice(0, selectedLaneCount);
  const deferredLanes = candidateLanes.slice(selectedLaneCount);
  const selectionReasons = new Map();
  for (const lane of selectedLanes) {
    selectionReasons.set(
      lane.laneId,
      `launched: priority ${lane.priority}, effort ${lane.effort}, dependency ${lane.dependencyState}`,
    );
  }
  for (const lane of deferredLanes) {
    selectionReasons.set(
      lane.laneId,
      `deferred: launch count capped at ${selectedLaneCount}; lane stayed below the cut after effort/coordination scoring`,
    );
  }
  for (const lane of sequentialCandidateLanes) {
    selectionReasons.set(
      lane.laneId,
      `deferred: ${lane.dependencyState}; do not treat dependency chains as parallel-ready`,
    );
  }
  for (const lane of blockedCandidateLanes) {
    selectionReasons.set(
      lane.laneId,
      lane.dependencyState === "not-parallel-safe"
        ? "blocked: parallelSafe is false 鈥?cannot run as a parallel lane"
        : "blocked: plan marked this lane blocked-by-plan",
    );
  }
  return {
    strategy,
    minLaneCount,
    maxLaneCount,
    candidateLanes: normalizedLanes.slice().sort((a, b) => a.priority - b.priority),
    parallelReadyCandidateLanes: candidateLanes,
    selectedLanes,
    deferredLanes,
    sequentialCandidateLanes,
    blockedCandidateLanes,
    selectedLaneCount,
    rationale,
    selectionReasons,
  };
}

function splitFilesIntoLanes(controllerResult, scope = "") {
  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  const classification = controllerResult?.classification;
  const isCrossStack = classification?.crossStack;
  const touchesFrontend = classification?.touchesFrontend;
  const touchesBackend = classification?.touchesBackend;

  const frontendFiles = files.filter((f) => f.replace(/\\/g, "/").includes("frontend/"));
  const backendFiles = files.filter((f) => f.replace(/\\/g, "/").includes("backend/"));
  const otherFiles = files.filter((f) => !f.replace(/\\/g, "/").includes("frontend/") && !f.replace(/\\/g, "/").includes("backend/"));

  const goal = controllerResult?.title
    ? `${controllerResult.title} on ${controllerResult.surface || "unknown surface"}`
    : "Auto-hermes-max round";
  const surface = controllerResult?.surface || "unknown";

  if (isCrossStack && frontendFiles.length > 0 && backendFiles.length > 0) {
    const lanes = [
      {
        laneId: "lane-frontend",
        goal: `Frontend slice: ${goal}`,
        ownedFiles: [...frontendFiles, ...otherFiles.filter((f) => f.replace(/\\/g, "/").includes("frontend/") === false && f.replace(/\\/g, "/").includes("backend/") === false && (f.endsWith(".css") || f.endsWith(".jsx") || f.endsWith(".tsx") || f.endsWith(".js") && !f.includes("backend/")))],
        mustPreserve: [],
        verify: controllerResult?.verify || "",
        effort: frontendFiles.length > 3 ? "large" : frontendFiles.length > 1 ? "medium" : "small",
        dependencyState: "parallel-ready",
      },
      {
        laneId: "lane-backend",
        goal: `Backend slice: ${goal}`,
        ownedFiles: [...backendFiles, ...otherFiles.filter((f) => f.replace(/\\/g, "/").includes("backend/") === false && f.replace(/\\/g, "/").includes("frontend/") === false && (f.endsWith(".java") || f.endsWith(".xml") || f.endsWith(".properties") || f.endsWith(".sql")))],
        mustPreserve: [],
        verify: controllerResult?.verify || "",
        effort: backendFiles.length > 3 ? "large" : backendFiles.length > 1 ? "medium" : "small",
        dependencyState: "parallel-ready",
      },
    ].filter((lane) => lane.ownedFiles.length > 0);

    if (lanes.length < 2) {
      return singleLanePlan(goal, files, controllerResult);
    }

    return {
      parentGoal: goal,
      preserve: [],
      laneSelection: { strategy: "auto", minLaneCount: 1, maxLaneCount: 5 },
      lanes,
    };
  }

  // Scope-based companion lanes: when a scope question is provided and the task
  // is single-surface, add a companion investigation lane for the opposite stack
  // layer so multi-agent dispatch always fires for scope-qualified invocations.
  if (scope) {
    const briefScope = scope.slice(0, 80).replace(/"/g, "'");
    if (backendFiles.length > 0 && frontendFiles.length === 0) {
      return {
        parentGoal: goal,
        preserve: [],
        laneSelection: {
          strategy: "auto",
          minLaneCount: 2,
          maxLaneCount: MAX_LANES,
          coordinationCost: "low",
          mergeComplexity: "medium",
        },
        lanes: [
          {
            laneId: "lane-backend",
            goal: `Backend: ${goal}`,
            ownedFiles: [...backendFiles, ...otherFiles],
            mustPreserve: [],
            verify: controllerResult?.verify || "",
            effort: backendFiles.length > 3 ? "large" : backendFiles.length > 1 ? "medium" : "small",
            parallelSafe: true,
          },
          {
            laneId: "lane-frontend-investigation",
            goal: `Frontend impact analysis: ${briefScope}`,
            ownedFiles: ["frontend/src"],
            mustPreserve: [],
            verify: "cd frontend && npm run lint",
            effort: "small",
            parallelSafe: true,
          },
        ],
      };
    }
    if (frontendFiles.length > 0 && backendFiles.length === 0) {
      return {
        parentGoal: goal,
        preserve: [],
        laneSelection: {
          strategy: "auto",
          minLaneCount: 2,
          maxLaneCount: MAX_LANES,
          coordinationCost: "low",
          mergeComplexity: "medium",
        },
        lanes: [
          {
            laneId: "lane-frontend",
            goal: `Frontend: ${goal}`,
            ownedFiles: [...frontendFiles, ...otherFiles],
            mustPreserve: [],
            verify: controllerResult?.verify || "",
            effort: frontendFiles.length > 3 ? "large" : frontendFiles.length > 1 ? "medium" : "small",
            parallelSafe: true,
          },
          {
            laneId: "lane-backend-investigation",
            goal: `Backend API impact analysis: ${briefScope}`,
            ownedFiles: ["backend/src/main/java/com/hermes/backend"],
            mustPreserve: [],
            verify: "cd backend && ./mvnw -q -DskipTests compile",
            effort: "small",
            parallelSafe: true,
          },
        ],
      };
    }
  }

  return singleLanePlan(goal, files, controllerResult);
}

function singleLanePlan(goal, files, controllerResult) {
  if (!files.length) {
    return {
      parentGoal: goal,
      preserve: [],
      laneSelection: { strategy: "auto", minLaneCount: 1, maxLaneCount: 5 },
      lanes: [],
    };
  }
  return {
    parentGoal: goal,
    preserve: [],
    laneSelection: { strategy: "auto", minLaneCount: 1, maxLaneCount: 5 },
    lanes: [
      {
        laneId: "lane-1",
        goal,
        ownedFiles: files,
        mustPreserve: [],
        verify: controllerResult?.verify || "",
        effort: files.length > 3 ? "large" : files.length > 1 ? "medium" : "small",
      },
    ],
  };
}

function buildExplorerReport(controllerResult, plan) {
  const files = Array.isArray(controllerResult?.files) ? controllerResult.files : [];
  const classification = controllerResult?.classification;
  const lanes = Array.isArray(plan?.lanes) ? plan.lanes : [];
  const workflowComposition = inferWorkflowComposition({
    classification,
    route: controllerResult?.route,
    subagentPlan: controllerResult?.subagentPlan,
    laneCount: lanes.length,
  });

  const remainingWork = [];
  if (classification?.touchesFrontend) {
    remainingWork.push({
      description: `Frontend work on ${controllerResult?.surface || "unknown surface"}`,
      surface: controllerResult?.surface || "unknown",
      problemClass: "frontend-design",
      estimatedScope: "frontend",
      effort: "medium",
    });
  }
  if (classification?.touchesBackend) {
    remainingWork.push({
      description: `Backend work on ${controllerResult?.surface || "unknown surface"}`,
      surface: controllerResult?.surface || "unknown",
      problemClass: "backend-logic",
      estimatedScope: "backend",
      effort: "medium",
    });
  }
  if (!classification?.touchesFrontend && !classification?.touchesBackend) {
    remainingWork.push({
      description: controllerResult?.title || "Follow-up work",
      surface: controllerResult?.surface || "unknown",
      problemClass: "other",
      estimatedScope: "unknown",
      effort: "small",
    });
  }

  const suggestedLanes = Math.min(lanes.length || 1, MAX_LANES);

  return {
    completedTask: controllerResult?.title || "Explorer discovery round",
    changedFiles: files,
    verification: controllerResult?.verify || "",
    workflowComposition,
    remainingWork,
    parallelismRecommendation: {
      suggestedLanes,
      rationale: lanes.length > 1
        ? `Cross-stack work detected: ${lanes.length} lanes with disjoint file ownership.`
        : "Single-lane work: no disjoint file ownership for parallel execution.",
      proposedScopes: lanes.map((lane) => ({
        goal: lane.goal,
        surface: controllerResult?.surface || "unknown",
        problemClass: classification?.problemClass || "other",
        ownedFiles: lane.ownedFiles,
      })),
    },
  };
}

function renderExplorerMarkdown(report) {
  const remainingWork = Array.isArray(report?.remainingWork) ? report.remainingWork : [];
  const proposedScopes = Array.isArray(report?.parallelismRecommendation?.proposedScopes)
    ? report.parallelismRecommendation.proposedScopes
    : [];

  const lines = [
    "# Auto-Hermes Max Explorer",
    "",
    `Generated: ${nowIso()}`,
    "",
    "## Completed Task",
    `Completed Task: ${report?.completedTask || "none"}`,
    `Changed Files: ${Array.isArray(report?.changedFiles) && report.changedFiles.length ? report.changedFiles.join(" | ") : "none"}`,
    `Verification: ${report?.verification || "none"}`,
    "",
    "## Remaining Work",
  ];

  if (!remainingWork.length) {
    lines.push("No remaining work was identified.");
  } else {
    for (const item of remainingWork) {
      lines.push(`${item.description || "Unspecified follow-up"}. Surface: ${item.surface || "unknown"}. Scope: ${item.estimatedScope || "unknown"}. Effort: ${item.effort || "unknown"}. Problem class: ${item.problemClass || "other"}.`);
    }
  }

  lines.push("", "## Parallelism Recommendation");
  lines.push(`Parallelism Recommendation: ${report?.parallelismRecommendation?.suggestedLanes ?? 0} lane(s). ${report?.parallelismRecommendation?.rationale || "No rationale recorded."}`);
  if (report?.workflowComposition) {
    lines.push(
      "",
      "## Workflow Composition",
      `Primary: ${report.workflowComposition.primary || "none"}`,
      `Applied: ${Array.isArray(report.workflowComposition.applied) && report.workflowComposition.applied.length ? report.workflowComposition.applied.join(" | ") : "none"}`,
    );
  }
  if (proposedScopes.length) {
    for (const scope of proposedScopes) {
      lines.push(`- ${scope.goal || "Unnamed scope"} | surface: ${scope.surface || "unknown"} | problem: ${scope.problemClass || "other"} | owned: ${Array.isArray(scope.ownedFiles) && scope.ownedFiles.length ? scope.ownedFiles.join(" | ") : "none"}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function defaultPlan(scope, controllerResult) {
  const controllerFiles = Array.isArray(controllerResult?.files) && controllerResult.files.length
    ? controllerResult.files
    : [];
  const controllerGoal = controllerResult?.title
    ? `${controllerResult.title} on ${controllerResult.surface || "unknown surface"}`
    : (scope || "Define one parent /auto-hermes-max round");

  if (controllerFiles.length > 0) {
    return {
      parentGoal: controllerGoal,
      preserve: [],
      laneSelection: {
        strategy: "auto",
        minLaneCount: 1,
        maxLaneCount: 5,
      },
      lanes: [
        {
          laneId: "lane-1",
          goal: controllerGoal,
          ownedFiles: controllerFiles,
          mustPreserve: [],
          verify: controllerResult?.verify || "",
          effort: "medium",
        },
      ],
    };
  }

  return {
    parentGoal: scope || "Define one parent /auto-hermes-max round",
    preserve: [],
    laneSelection: {
      strategy: "auto",
      minLaneCount: 1,
      maxLaneCount: 5,
    },
    lanes: [],
  };
}

function planHasLaunchableLane(plan) {
  const lanes = Array.isArray(plan?.lanes) ? plan.lanes : [];
  return lanes.some((lane) => normalizeFileList(lane?.ownedFiles).length > 0);
}

function normalizeGoalSignature(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function goalsMatch(left, right) {
  const normalizedLeft = normalizeGoalSignature(left);
  const normalizedRight = normalizeGoalSignature(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function controllerGoal(controllerResult) {
  return controllerResult?.title
    ? `${controllerResult.title} on ${controllerResult.surface || "unknown surface"}`
    : "";
}

function shouldUseExplicitPlan(explicitPlan, controllerResult, args = {}) {
  if (!explicitPlan || typeof explicitPlan !== "object") return false;
  const controllerHasWork = controllerResult?.loopDecision === "continue-self-loop" && controllerResult?.title;
  const explicitGoal = String(explicitPlan.parentGoal || "").trim();
  if (controllerHasWork && !explicitGoal) {
    return false;
  }
  if (planHasLaunchableLane(explicitPlan)) {
    if (!controllerHasWork) return true;

    const requestedScope = String(args.scope || "").trim();
    if (requestedScope) return goalsMatch(explicitGoal, requestedScope);

    return (
      goalsMatch(explicitGoal, controllerGoal(controllerResult)) ||
      goalsMatch(explicitGoal, controllerResult.title)
    );
  }

  // Ignore stale no-lane plan files whenever fresher controller-selected work exists.
  if (controllerHasWork) {
    return false;
  }

  return true;
}

function validatePlan(plan) {
  const issues = [];
  const lanes = Array.isArray(plan?.lanes) ? plan.lanes.map((lane, index) => normalizeLane(lane, index)) : [];

  if (!String(plan?.parentGoal || "").trim()) {
    issues.push("plan must include a non-empty parentGoal");
  }
  if (!lanes.length) {
    issues.push("plan has no lanes 鈥?no promotable work to distribute across child lanes");
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

function inferLaneAgentRole(normalizedLane) {
  const ownedFiles = Array.isArray(normalizedLane?.ownedFiles) ? normalizedLane.ownedFiles : [];
  const normalizedPaths = ownedFiles.map((file) => String(file || "").replace(/\\/g, "/"));
  const hasFrontend = normalizedPaths.some((file) => file.includes("frontend/"));
  const hasBackend = normalizedPaths.some((file) => file.includes("backend/"));

  if (hasFrontend && !hasBackend) return "frontend-agent";
  if (hasBackend && !hasFrontend) return "backend-agent";
  return "Dev Agent";
}

function buildTeamRoles(runtime) {
  if (String(runtime || "").trim().toLowerCase() === "claude") {
    return {
      coordinator: "current-session",
      explorer: "explorer-agent",
      planner: "planning-agent",
      runnerLens: "customer-agent",
      reviewer: "reviewer-agent",
      laneBuilders: ["frontend-agent", "backend-agent", "Dev Agent"],
    };
  }
  return {
    coordinator: "current-session",
    explorer: "discovery-pass",
    planner: "plan-file",
    runnerLens: "optional",
    reviewer: "merge-gate",
    laneBuilders: ["lane-worker"],
  };
}

function buildLanePacket(plan, lane, index, parentRunId, options = {}) {
  const normalizedLane = normalizeLane(lane, index);
  const laneId = normalizedLane.laneId;
  const normalizedOwnedFiles = normalizedLane.ownedFiles;
  const resultsDir = resolveFromRoot(".workspace/state/auto-hermes-max-results");
  const resultFile = path.join(resultsDir, `${laneId}.json`);
  const activityLogFile = path.join(resultsDir, `${laneId}-activity.json`);
  const isolation = options.parallelLaneCount > 1 ? "worktree" : "direct";
  const agentRole = inferLaneAgentRole(normalizedLane);
  return {
    laneId,
    parentRunId,
    correlationId: `${parentRunId}:${laneId}`,
    goal: normalizedLane.goal,
    parentGoal: String(plan.parentGoal || "").trim(),
    // Ralph-style: full loop with verification requirements
    mode: "loop",
    stopCondition: "owned-scope-exhausted",
    ownedFiles: normalizedOwnedFiles,
    mustPreserve: normalizedLane.mustPreserve,
    verify: normalizedLane.verify,
    mergeNotes: normalizedLane.mergeNotes,
    priority: normalizedLane.priority,
    effort: normalizedLane.effort,
    dependsOn: normalizedLane.dependsOn,
    dependencyState: normalizedLane.dependencyState,
    status: "pending-launch",
    isolation,
    agentRole,
    executionModel: "claude-code-agent-team",
    queueWritebackMode: "deferred-to-parent",
    contextLedgerWritebackMode: "deferred-to-parent",
    allowedStatuses: ["approved", "must-fix", "blocked"],
    resultFile,
    activityLogFile,
    // Ralph-style verification requirements
    requiresVerification: true,
    requiresArchitectReview: true,
    requiresDeslopPass: true,
    requiresRegressionReverification: true,
    command: `/auto-hermes scope="${normalizedLane.goal}" mode=loop owned="${normalizedOwnedFiles.join("|")}" isolation="${isolation}" role="${agentRole}"`,
  };
}

function renderCompactLanePrompt(lanePacket, contextSnapshotPath) {
  return [
    "# Auto-Hermes Max Lane - Claude Agent Team",
    "",
    `Lane: ${lanePacket.laneId}`,
    `Agent Role: ${lanePacket.agentRole || "Dev Agent"}`,
    `Parent Run Id: ${lanePacket.parentRunId}`,
    `Correlation Id: ${lanePacket.correlationId}`,
    `Parent Goal: ${lanePacket.parentGoal}`,
    `Goal: ${lanePacket.goal}`,
    "",
    "## Contract",
    "- Run this lane as a Claude Code child agent executing a scoped child /auto-hermes loop.",
    "- Stop when no promotable task remains inside ownedFiles or a real blocker appears.",
    "- Do not edit files owned by another lane.",
    "- Do not claim runtime/live changes without runtime proof.",
    `Context Snapshot: ${contextSnapshotPath}`,
    "- Read the snapshot before broad exploration; it owns parent goal, facts, and constraints.",
    "",
    "## Lane Scope",
    `Owned Files: ${lanePacket.ownedFiles.length ? lanePacket.ownedFiles.join(" | ") : "none"}`,
    `Stop Condition: ${lanePacket.stopCondition}`,
    `Priority: ${lanePacket.priority}`,
    `Effort: ${lanePacket.effort}`,
    `Depends On: ${lanePacket.dependsOn.length ? lanePacket.dependsOn.join(" | ") : "none"}`,
    `Dependency State: ${lanePacket.dependencyState}`,
    `Isolation: ${lanePacket.isolation || "direct"}`,
    `Must Preserve: ${lanePacket.mustPreserve.length ? lanePacket.mustPreserve.join(" | ") : "none"}`,
    `Verify: ${lanePacket.verify || "none"}`,
    `Merge Notes: ${lanePacket.mergeNotes || "none"}`,
    "",
    `Lane Entrypoint: ${lanePacket.command}`,
    "",
    "## Gates",
    "- Stay inside ownedFiles.",
    "- Run fresh verification and record exact evidence.",
    "- Record architectVerdict=approved.",
    "- Record deslopPass=pass or an explicit skip reason.",
    "- Record regressionPass=pass after deslop.",
    "- Write the lane result packet before stopping.",
    "",
    "## Result Contract",
    `Result File: ${lanePacket.resultFile}`,
    `Activity Log File: ${lanePacket.activityLogFile || "n/a"}`,
    "Required fields: laneId, goal, ownedFiles, changedFiles, completedRounds, verification, runtimeProof, architectVerdict, deslopPass, regressionPass, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId.",
    "Allowed status: approved | must-fix | blocked.",
    "Parent owns TASKS.md and CONTEXT_LEDGER.md writeback; put follow-ups in mergeNotes/risks.",
    "",
  ].join("\n");
}

// Ralph-style lane prompt with grounding and verification requirements
function renderLanePrompt(lanePacket, contextSnapshotPath) {
  return renderCompactLanePrompt(lanePacket, contextSnapshotPath);
}

function renderMergeMarkdown(state) {
  const lines = [
    "# Auto-Hermes Max Merge Gate (Ralph-Style)",
    "",
    `Generated: ${state.generatedAt}`,
    `Parent Goal: ${state.parentGoal}`,
    `Parent Run Id: ${state.parentRunId}`,
    `Correlation Id: ${state.correlationId}`,
    `Current Phase: ${state.currentPhase || "initializing"}`,
    `Iteration: ${state.iteration || 1}/${state.maxIterations || MAX_ITERATIONS}`,
    "",
    "## Ralph Loop Gates (All Must Pass Before approve-merge)",
    "1. [auto] Ownership Gate 鈥?disjoint file ownership confirmed",
    "2. [auto] Contract Gate 鈥?lane contracts honored",
    "3. [auto] Verification Gate 鈥?each lane has fresh verification evidence",
    "4. [coordinator] Runtime Truth Gate 鈥?each lane has runtimeProof",
    "5. [coordinator] Regression Gate 鈥?no regressions detected",
    "6. [coordinator] Arbitration Gate 鈥?all conflicts have recorded decisions",
    "7. [auto] Review Gate 鈥?architect verdict: APPROVED for all lanes",
    "8. [auto] Evidence Gate 鈥?result files exist and are valid JSON",
    "9. [auto] Deslop Gate 鈥?all lanes completed deslop pass",
    "10. [auto] Regression-Reverification Gate 鈥?post-deslop tests still pass",
    "",
    "Run: node tools/auto-hermes-max-merge.mjs --write",
    "Then review arbitration brief and record coordinatorDecision for each conflict.",
    "Rerun the merge script to confirm approve-merge.",
    "",
    "## Progress Ledger",
    `Path: ${state.progressLedgerPath || "not yet created"}`,
    state.progressLedger
      ? [
          `Active: ${state.progressLedger.active}`,
          `Current Phase: ${state.progressLedger.currentPhase}`,
          `Iteration: ${state.progressLedger.iteration}/${state.progressLedger.maxIterations}`,
        ].map((s) => `- ${s}`)
      : "- Not yet initialized",
    "",
    "## Context Snapshot",
    `Path: ${state.contextSnapshotPath || "not yet created"}`,
    "",
    "## Lane loop statuses (pending until lanes complete):",
    ...state.lanes.map((lane) => `- ${lane.laneId}: ${lane.status} | resultFile: ${lane.resultFile} | activityLogFile: ${lane.activityLogFile || "n/a"}`),
  ];
  return `${lines.join("\n")}\n`;
}

function renderCoordinatorMarkdown(state) {
  const lines = [
    "# Auto-Hermes Max Coordinator (Claude Agent Team)",
    "",
    `Generated: ${state.generatedAt}`,
    `Runtime: ${state.runtime}`,
    `Execution Model: ${state.executionModel || "parallel-lane-launcher"}`,
    `Status: ${state.status}`,
    `Next Action: ${state.nextAction}`,
    `Must Not Reply Yet: ${state.mustNotReplyYet ? "yes" : "no"}`,
    `Current Phase: ${state.currentPhase || "initializing"}`,
    `Iteration: ${state.iteration || 1}/${state.maxIterations || MAX_ITERATIONS}`,
    `Selection Strategy: ${state.laneSelection.strategy}`,
    `Plan Source: ${state.planSource || "controller-derived"}`,
    `Candidate Lane Count: ${state.candidateLaneCount}`,
    `Parallel-Ready Candidate Lane Count: ${state.parallelReadyCandidateLaneCount}`,
    `Selected Lane Count: ${state.selectedLaneCount}`,
    `Coordination Cost: ${state.decisionSignals.coordinationCost}`,
    `Merge Complexity: ${state.decisionSignals.mergeComplexity}`,
    `Workflow Composition: ${state.workflowComposition?.summary || "none"}`,
    "",
    `Parent Goal: ${state.parentGoal}`,
    `Parent Run Id: ${state.parentRunId}`,
    `Correlation Id: ${state.correlationId}`,
    `Selection Rationale: ${state.selectionRationale}`,
    "",
    "## Context Snapshot (Grounding)",
    `Path: ${state.contextSnapshotPath || "not created"}`,
    "- Read this FIRST before any lane execution.",
    "- Contains: task statement, desired outcome, known facts, constraints.",
    "",
    "## Progress Ledger (State)",
    `Path: ${state.progressLedgerPath || "not created"}`,
    "- Tracks: iteration, phase, lane statuses, gate states.",
    "- Updated after each verification/fix cycle.",
    "",
    "## Team Topology",
    `- Coordinator: ${state.teamRoles?.coordinator || "current-session"}`,
    `- Explorer: ${state.teamRoles?.explorer || "discovery-pass"}`,
    `- Planner: ${state.teamRoles?.planner || "plan-file"}`,
    `- Runner Lens: ${state.teamRoles?.runnerLens || "optional"}`,
    `- Reviewer: ${state.teamRoles?.reviewer || "merge-gate"}`,
    `- Lane Builders: ${Array.isArray(state.teamRoles?.laneBuilders) && state.teamRoles.laneBuilders.length ? state.teamRoles.laneBuilders.join(" | ") : "lane-worker"}`,
    "",
    "## Workflow Composition",
    `- primary: ${state.workflowComposition?.primary || "none"}`,
    `- applied: ${Array.isArray(state.workflowComposition?.applied) && state.workflowComposition.applied.length ? state.workflowComposition.applied.join(" | ") : "none"}`,
    `- execution: ${state.workflowComposition?.executionPattern || "none"}`,
    `- coordination: ${state.workflowComposition?.coordinationPattern || "none"}`,
    `- quality: ${state.workflowComposition?.qualityPattern || "none"}`,
    `- delegation: ${state.workflowComposition?.delegationPattern || "none"}`,
    "",
    "## Launched Lanes",
    ...state.lanes.map((lane) => `- ${lane.laneId}: ${lane.agentRole || "Dev Agent"} :: ${lane.goal} :: ${lane.ownedFiles.join(" | ")} :: ${lane.dependencyState} :: result ${lane.resultFile}`),
    "",
    "## 🚨 Coordinator Next Action — call the `Agent` tool now",
    "This file is **briefs on disk**, not a launch. The script CANNOT call the `Agent` tool. The coordinator must.",
    "",
    "Send the wave-1 `Agent` calls in a SINGLE assistant message with multiple `Agent` blocks so they run in parallel:",
    "",
    "```",
    state.lanes.map((lane) => [
      "Agent({",
      `  description: "Lane ${lane.laneId}: ${lane.goal.slice(0, 60).replace(/"/g, "'")}",`,
      `  subagent_type: "${lane.agentRole || "Dev Agent"}",`,
      "  run_in_background: true,",
      `  prompt: "Lane ${lane.laneId}: ${(lane.goal || "").slice(0, 80).replace(/"/g, "'").replace(/\n/g, " ")}. Owned files: ${(lane.ownedFiles || []).join(" | ") || "none"}. Read brief at ${lane.briefPath || `.workspace/state/auto-hermes-max-lanes/${lane.laneId}.md`}."`,
      "})",
    ].join("\n")).join("\n\n"),
    "```",
    "",
    state.deferredLanes.length || state.blockedLanes.length
      ? `Deferred / blocked lanes (do NOT launch in wave 1): ${[...state.deferredLanes, ...state.blockedLanes].map((l) => l.laneId).join(", ")}. After wave 1 commits, re-run this script — those lanes admit into wave 2 once their deps are satisfied.`
      : "All planned lanes are wave-1 admissible.",
    "",
    "## Ralph Loop Requirements",
    "Each lane MUST provide before completion:",
    "- Fresh verification evidence (test/build output)",
    "- Architect verification verdict: APPROVED",
    "- Deslop pass completed on changed files",
    "- Post-deslop regression verification (tests still pass)",
    "- Zero pending TODO items",
    "",
    "## Launch Decision Card",
    ...state.launchDecisionCard.map((lane) => `- ${lane.laneId}: ${lane.decision} :: ${lane.dependencyState} :: ${lane.reason}`),
    "",
    "## Coordinator Contract (Ralph-Style)",
    "- Launch all approved lanes in parallel as Claude Code child agents running scoped `/auto-hermes` loops.",
    "- Keep ownership disjoint; no lane may edit another lane's files.",
    "- Wait for every lane loop to stop and write its result packet.",
    "- REQUIRE fresh verification evidence; no 'should work' claims allowed.",
    "- REQUIRE architect verification (STANDARD tier minimum) for each lane.",
    "- REQUIRE deslop pass on all changed files.",
    "- REQUIRE post-deslop regression verification.",
    "- For runner-facing work, run customer-agent on the merged result before final approval.",
    "- Run reviewer-agent on the merged workspace state before any final success claim.",
    "- Run the merge gate and arbitrate every conflict before any combined live claim.",
    "- If merge gate fails or arbitration is pending, do NOT declare parent round complete.",
    "- After approve-merge, update CONTEXT_LEDGER and TASKS.md, then re-enter self-loop cascade.",
  ];
  if (state.deferredLanes.length) {
    lines.push("", "## Deferred Candidate Lanes", ...state.deferredLanes.map((lane) => `- ${lane.laneId}: ${lane.goal} :: priority ${lane.priority} :: effort ${lane.effort}`));
  }
  if (state.blockedLanes.length) {
    lines.push("", "## Blocked Candidate Lanes", ...state.blockedLanes.map((lane) => `- ${lane.laneId}: ${lane.goal} :: ${lane.dependencyState}`));
  }
  if (state.websiteAudit?.attempted) {
    const auditCandidate = state.websiteAudit.candidate;
    lines.push(
      "",
      "## Website Audit",
      `Mode: ${state.websiteAudit.mode || "website-audit"}`,
      `Website Audit: ${state.websiteAudit.status}`,
      `Summary: ${state.websiteAudit.summary || "none"}`,
      `Queue State: ${state.websiteAudit.queueState?.status || "unknown"}`,
      `Candidate Count: ${state.websiteAudit.candidateCount ?? 0}`,
    );
    if (auditCandidate) {
      lines.push(`Candidate: ${auditCandidate.surface || "unknown"} :: ${auditCandidate.files.join(" | ") || "none"}`);
    }
  }
  if (state.issues.length) {
    lines.push("", "## Blocking Issues", ...state.issues.map((issue) => `- ${issue}`));
  }
  return `${lines.join("\n")}\n`;
}

function writeArtifacts(args, state) {
  const coordinatorJson = resolveFromRoot(args.coordinatorJson);
  const coordinatorMd = resolveFromRoot(args.coordinatorMd);
  const explorerJson = resolveFromRoot(args.explorerJson);
  const explorerMd = resolveFromRoot(args.explorerMd);
  const mergeJson = resolveFromRoot(args.mergeJson);
  const mergeMd = resolveFromRoot(args.mergeMd);
  const lanesDir = resolveFromRoot(args.lanesDir);
  const resultsDir = resolveFromRoot(args.resultsDir);
  const stateDir = resolveFromRoot(args.stateDir);

  ensureParent(coordinatorJson);
  ensureParent(coordinatorMd);
  ensureParent(explorerJson);
  ensureParent(explorerMd);
  ensureParent(mergeJson);
  ensureParent(mergeMd);
  fs.mkdirSync(lanesDir, { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });

  // Write context snapshot
  if (state.contextSnapshot) {
    writeJson(state.contextSnapshotPath, state.contextSnapshot);
  }

  // Write progress ledger
  if (state.progressLedger) {
    writeJson(state.progressLedgerPath, state.progressLedger);
  }

  // Write ralph-style state
  if (state.runId) {
    writeRalphState(state.runId, {
      active: state.status === "ready-to-launch" || state.status === "running",
      iteration: state.iteration || 1,
      maxIterations: state.maxIterations || MAX_ITERATIONS,
      currentPhase: state.currentPhase || "executing",
      startedAt: state.generatedAt,
      completedAt: null,
      parentGoal: state.parentGoal,
      contextSnapshotPath: state.contextSnapshotPath,
      progressLedgerPath: state.progressLedgerPath,
    });
  }

  // coordinatorJson and coordinatorMd are the single canonical artifacts
  fs.writeFileSync(coordinatorJson, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(coordinatorMd, renderCoordinatorMarkdown(state), "utf8");
  fs.writeFileSync(explorerJson, JSON.stringify(state.explorerReport || {}, null, 2), "utf8");
  fs.writeFileSync(explorerMd, renderExplorerMarkdown(state.explorerReport || {}), "utf8");

  const mergeState = {
    generatedAt: state.generatedAt,
    parentGoal: state.parentGoal,
    parentRunId: state.parentRunId,
    correlationId: state.correlationId,
    currentPhase: state.currentPhase || "initializing",
    iteration: state.iteration || 1,
    maxIterations: state.maxIterations || MAX_ITERATIONS,
    contextSnapshotPath: state.contextSnapshotPath,
    progressLedgerPath: state.progressLedgerPath,
    resultsDir,
    lanes: state.lanes.map((lane) => ({
      laneId: lane.laneId,
      correlationId: lane.correlationId,
      status: "pending-result",
      resultFile: lane.resultFile,
      activityLogFile: lane.activityLogFile || "",
      ownedFiles: lane.ownedFiles,
      dependencyState: lane.dependencyState,
      requiresVerification: lane.requiresVerification,
      requiresArchitectReview: lane.requiresArchitectReview,
      requiresDeslopPass: lane.requiresDeslopPass,
      requiresRegressionReverification: lane.requiresRegressionReverification,
    })),
    parallelRoi: {
      verdict: "pending-coordinator-review",
      summary: "Merge helper must decide whether parallelization was worth the coordination cost after integrated review.",
    },
  };
  fs.writeFileSync(mergeJson, JSON.stringify(mergeState, null, 2), "utf8");
  fs.writeFileSync(mergeMd, renderMergeMarkdown(mergeState), "utf8");

  for (const lane of state.lanes) {
    const laneJson = path.join(lanesDir, `${lane.laneId}.json`);
    const laneMd = path.join(lanesDir, `${lane.laneId}.md`);
    fs.writeFileSync(laneJson, JSON.stringify(lane, null, 2), "utf8");
    fs.writeFileSync(laneMd, renderLanePrompt(lane, state.contextSnapshotPath), "utf8");
  }
}

function readControllerState(args) {
  return runAutoHermesController({
    write: true,
    json: true,
    tasks: args.tasks,
    humanLoop: args.humanLoop,
    agentSync: args.agentSync,
    contextLedger: args.contextLedger,
    loopState: args.loopState,
    outputJson: args.liveControllerJson,
    outputMd: args.liveControllerMd,
  }).result;
}

function buildStopState(args, controllerResult) {
  const parentRunId = makeRunId();
  const controllerReason = String(controllerResult?.reason || "").trim();
  return {
    generatedAt: nowIso(),
    runtime: args.runtime,
    executionModel: String(args.runtime || "").trim().toLowerCase() === "claude"
      ? "claude-code-agent-team"
      : "parallel-lane-launcher",
    mode: args.mode,
    status: "stop-exhausted",
    nextAction: "stop",
    mustNotReplyYet: false,
    planSource: "controller-stop",
    parentGoal: String(args.scope || "").trim() || "No promotable work found",
    parentRunId,
    runId: parentRunId,
    correlationId: `${parentRunId}:parent`,
    currentPhase: "complete",
    iteration: 1,
    maxIterations: args.maxIterations,
    contextSnapshotPath: makeContextSnapshotPath(parentRunId),
    progressLedgerPath: makeProgressLedgerPath(parentRunId),
    contextSnapshot: null,
    progressLedger: null,
    preserve: [],
    laneSelection: {
      strategy: "auto",
      minLaneCount: 1,
      maxLaneCount: MAX_LANES,
    },
    decisionSignals: {
      coordinationCost: "medium",
      mergeComplexity: "low",
    },
    candidateLaneCount: 0,
    parallelReadyCandidateLaneCount: 0,
    selectedLaneCount: 0,
    selectionRationale: controllerReason
      ? `No promotable work found in the live controller/queue state: ${controllerReason}`
      : "No promotable work found in the live controller/queue state.",
    deferredLanes: [],
    blockedLanes: [],
    launchDecisionCard: [],
    lanes: [],
    teamRoles: buildTeamRoles(args.runtime),
    issues: [],
    controller: controllerResult || null,
    websiteAudit: buildWebsiteAuditMetadata(null),
  };
}

function inferAuditRootDir(args) {
  const tasksPath = resolveFromRoot(args.tasks || "TASKS.md");
  return path.dirname(tasksPath);
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
    files: normalizeFileList(candidate.files),
    problemClass: String(candidate.problemClass || "").trim(),
    owner: String(candidate.owner || "").trim(),
    verify: String(candidate.verify || "").trim(),
    reason: String(candidate.reason || "").trim(),
  };
}

function normalizeWebsiteAuditQueueState(queueState, attempted) {
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

function runWebsiteAuditFallback(args) {
  const rootDir = inferAuditRootDir(args);
  return runAutoHermesWebsiteAudit({
    rootDir,
    tasks: args.tasks,
    contextLedger: args.contextLedger,
    json: true,
    write: args.write,
  }).report;
}

function buildWebsiteAuditPlannerInput(controllerResult, report) {
  const candidate = normalizeWebsiteAuditCandidate(report?.candidate);
  if (!candidate) return null;

  return {
    ...controllerResult,
    loopDecision: "continue-self-loop",
    surface: candidate.surface || controllerResult?.surface || "unknown",
    title: candidate.title || controllerResult?.title || "Website audit follow-up",
    files: candidate.files,
    problemClass: candidate.problemClass || "frontend-design",
    owner: candidate.owner || "frontend-agent",
    verify: candidate.verify || controllerResult?.verify || "",
    reason: candidate.reason || controllerResult?.reason || "",
    classification: {
      ...(controllerResult?.classification && typeof controllerResult.classification === "object"
        ? controllerResult.classification
        : {}),
      touchesFrontend: true,
      touchesBackend: false,
      crossStack: false,
      problemClass: candidate.problemClass || "frontend-design",
    },
  };
}

export function runAutoHermesMax(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : {
    ...parseArgs([]),
    ...rawArgs,
  };
  const controllerResult = readControllerState(args);
  const explicitPlan = readJson(args.planFile, null);
  const hasExplicitPlan = shouldUseExplicitPlan(explicitPlan, controllerResult, args);
  const controllerExhausted = controllerResult?.loopDecision !== "continue-self-loop";
  const shouldAttemptWebsiteAudit = controllerExhausted;
  const websiteAuditReport = shouldAttemptWebsiteAudit ? runWebsiteAuditFallback(args) : null;
  const websiteAuditMetadata = buildWebsiteAuditMetadata(websiteAuditReport, {
    usedFallback: shouldAttemptWebsiteAudit && Boolean(websiteAuditReport?.candidate),
  });
  const auditPlannerInput = websiteAuditMetadata.usedFallback
    ? buildWebsiteAuditPlannerInput(controllerResult, websiteAuditReport)
    : null;

  if (controllerExhausted && !auditPlannerInput) {
    const baseStopState = buildStopState(args, controllerResult);
    const stopState = {
      ...baseStopState,
      planSource: websiteAuditMetadata.attempted ? "website-audit-empty" : baseStopState.planSource,
      selectionRationale: websiteAuditMetadata.attempted
        ? `${baseStopState.selectionRationale} Website audit found no bounded fallback candidate.`
        : baseStopState.selectionRationale,
      websiteAudit: websiteAuditMetadata,
    };
    if (args.write) writeArtifacts(args, stopState);
    if (args.json) {
      return {
        state: stopState,
        output: `${JSON.stringify(stopState, null, 2)}\n`,
      };
    }
    return {
      state: stopState,
      output: renderCoordinatorMarkdown(stopState),
    };
  }

  const rawPlan = auditPlannerInput
    ? splitFilesIntoLanes(auditPlannerInput)
    : hasExplicitPlan
      ? explicitPlan
      : splitFilesIntoLanes(controllerResult, args.scope);
  const plannerInput = auditPlannerInput || controllerResult;
  const explorerReport = buildExplorerReport(plannerInput, rawPlan);
  const validation = validatePlan(rawPlan);
  const parentRunId = makeRunId();
  const correlationId = `${parentRunId}:parent`;
  const resultsDir = resolveFromRoot(args.resultsDir);
  const normalizedPlanLanes = (Array.isArray(rawPlan.lanes) ? rawPlan.lanes : [])
    .slice(0, MAX_LANES)
    .map((lane, index) => normalizeLane(lane, index));
  const launchSelection = chooseLaunchSet(rawPlan, normalizedPlanLanes, args.mode);
  const lanes = launchSelection.selectedLanes
    .map((lane, index) => buildLanePacket(rawPlan, lane, index, parentRunId, {
      parallelLaneCount: launchSelection.selectedLaneCount,
    }))
    .map((lane) => ({
      ...lane,
      resultFile: path.join(resultsDir, `${lane.laneId}.json`),
    }));
  const workflowComposition = inferWorkflowComposition({
    classification: plannerInput?.classification,
    route: plannerInput?.route,
    subagentPlan: plannerInput?.subagentPlan,
    laneCount: launchSelection.selectedLaneCount,
  });

  // Ralph-style context snapshot and progress ledger
  const contextSnapshotPath = makeContextSnapshotPath(parentRunId);
  const progressLedgerPath = makeProgressLedgerPath(parentRunId);
  const contextSnapshot = buildContextSnapshot(args, plannerInput, rawPlan);
  const progressLedger = buildProgressLedger(parentRunId, rawPlan.parentGoal, lanes);
  const teamRoles = buildTeamRoles(args.runtime);

  const state = {
    generatedAt: nowIso(),
    runtime: args.runtime,
    executionModel: String(args.runtime || "").trim().toLowerCase() === "claude"
      ? "claude-code-agent-team"
      : "parallel-lane-launcher",
    mode: args.mode,
    status: validation.ok && launchSelection.selectedLaneCount > 0 ? "ready-to-launch" : "invalid-plan",
    nextAction: validation.ok && launchSelection.selectedLaneCount > 0
      ? `${args.runtime}-launch-${launchSelection.selectedLaneCount === 1 ? "single-lane" : "lanes"}`
      : "stop",
    mustNotReplyYet: validation.ok && launchSelection.selectedLaneCount > 0,
    planSource: websiteAuditMetadata.usedFallback
      ? "website-audit-fallback"
      : hasExplicitPlan
        ? "explicit-plan-file"
        : "controller-derived",
    parentGoal: String(rawPlan.parentGoal || args.scope || "").trim(),
    parentRunId,
    runId: parentRunId,
    correlationId,
    currentPhase: "executing",
    iteration: 1,
    maxIterations: args.maxIterations,
    contextSnapshotPath,
    progressLedgerPath,
    contextSnapshot,
    progressLedger,
    preserve: normalizeFileList(rawPlan.preserve),
    resultsDir,
    laneSelection: {
      strategy: launchSelection.strategy,
      minLaneCount: launchSelection.minLaneCount,
      maxLaneCount: launchSelection.maxLaneCount,
    },
    decisionSignals: {
      coordinationCost: String(rawPlan?.laneSelection?.coordinationCost || "medium").trim().toLowerCase() || "medium",
      mergeComplexity: String(rawPlan?.laneSelection?.mergeComplexity || "medium").trim().toLowerCase() || "medium",
    },
    candidateLaneCount: launchSelection.candidateLanes.length,
    parallelReadyCandidateLaneCount: launchSelection.parallelReadyCandidateLanes.length,
    selectedLaneCount: launchSelection.selectedLaneCount,
    selectionRationale: launchSelection.rationale,
    workflowComposition,
    deferredLanes: launchSelection.deferredLanes.map((lane) => ({
      laneId: lane.laneId,
      goal: lane.goal,
      priority: lane.priority,
      effort: lane.effort,
      ownedFiles: lane.ownedFiles,
      dependencyState: lane.dependencyState,
    })),
    blockedLanes: launchSelection.blockedCandidateLanes.map((lane) => ({
      laneId: lane.laneId,
      goal: lane.goal,
      priority: lane.priority,
      effort: lane.effort,
      ownedFiles: lane.ownedFiles,
      dependencyState: lane.dependencyState,
    })),
    launchDecisionCard: launchSelection.candidateLanes.map((lane) => {
      const isSelected = launchSelection.selectedLanes.some((selected) => selected.laneId === lane.laneId);
      const isBlocked = launchSelection.blockedCandidateLanes.some((blocked) => blocked.laneId === lane.laneId);
      const isSequential = launchSelection.sequentialCandidateLanes.some((sequential) => sequential.laneId === lane.laneId);
      return {
        laneId: lane.laneId,
        agentRole: inferLaneAgentRole(lane),
        goal: lane.goal,
        decision: isSelected ? "launched" : isBlocked ? "blocked" : isSequential ? "deferred" : "deferred",
        dependencyState: lane.dependencyState,
        reason: launchSelection.selectionReasons.get(lane.laneId) || "no explicit reason recorded",
      };
    }),
    lanes,
    teamRoles,
    issues: launchSelection.selectedLaneCount > 0 ? validation.issues : [...validation.issues, "launcher selected zero lanes"],
    controller: controllerResult,
    websiteAudit: websiteAuditMetadata,
    explorerReport,
  };

  if (args.write) {
    writeArtifacts(args, state);
    const explorerPath = resolveFromRoot(".workspace/state/AUTO_HERMES_MAX_EXPLORER.json");
    ensureParent(explorerPath);
    fs.writeFileSync(explorerPath, JSON.stringify(explorerReport, null, 2), "utf8");
  }

  if (args.json) {
    return {
      state,
      output: `${JSON.stringify(state, null, 2)}\n`,
    };
  }

  return {
    state,
    output: renderCoordinatorMarkdown(state),
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  const { output } = runAutoHermesMax(process.argv.slice(2));
  process.stdout.write(output);
}
