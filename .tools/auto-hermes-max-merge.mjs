#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    coordinatorJson: ".ai-sync/AUTO_HERMES_MAX_COORDINATOR.json",
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

function readJson(relPath, fallback = null) {
  const fullPath = resolveFromRoot(relPath);
  if (!fs.existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readLaneResult(resultFile) {
  if (!resultFile) return null;
  const fullPath = resolveFromRoot(resultFile);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return {
      status: "blocked",
      mergeNotes: "Lane result file exists but is not valid JSON.",
    };
  }
}

export function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "blocked";
  if (raw === "approved") return "approved";
  if (raw === "must-fix") return "must-fix";
  if (raw === "blocked") return "blocked";
  if (raw === "pending-result") return "pending-result";
  return "blocked";
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

// Shared contract files that multiple lanes might both touch — always arbitration candidates.
const CONTRACT_FILE_PATTERNS = [
  "translations.js",
  "translations.ts",
  "schema.sql",
  "application.properties",
  "application.yml",
  "package.json",
  "pom.xml",
  "App.jsx",
  "App.tsx",
  "router",
  "routes",
];

function isContractFile(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/").toLowerCase();
  return CONTRACT_FILE_PATTERNS.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function normalizeChangedFiles(result) {
  const raw = result?.changedFiles;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw).split(/[\|,]/).map((f) => f.trim()).filter(Boolean);
}

function validateLaneResult(lane, result, parentRunId) {
  if (!result) return { result: null, issues: [] };
  const issues = [];
  const resultLaneId = String(result.laneId || "").trim();
  const resultParentRunId = String(result.parentRunId || "").trim();
  const resultCorrelationId = String(result.correlationId || "").trim();

  if (resultLaneId && resultLaneId !== lane.laneId) {
    issues.push(`${lane.laneId} result file belongs to lane ${resultLaneId}`);
  }
  if (!resultParentRunId) {
    issues.push(`${lane.laneId} result file is missing parentRunId`);
  } else if (parentRunId && resultParentRunId !== parentRunId) {
    issues.push(`${lane.laneId} result file belongs to parentRunId ${resultParentRunId}, not ${parentRunId}`);
  }
  if (!resultCorrelationId) {
    issues.push(`${lane.laneId} result file is missing correlationId`);
  } else if (lane.correlationId && resultCorrelationId !== lane.correlationId) {
    issues.push(`${lane.laneId} result file belongs to correlationId ${resultCorrelationId}, not ${lane.correlationId}`);
  }

  // Only demote the lane to pending-result when the result file actually
  // belongs to a different lane / parent-run / correlation (real mismatch).
  // Missing parentRunId/correlationId metadata is recorded in resultIssues
  // for the merge-gate summary, but it must not pre-empt the Ralph completion
  // gates (architect / deslop / regression) from running on approved lanes.
  const hardMismatch =
    (resultLaneId && resultLaneId !== lane.laneId) ||
    (parentRunId && resultParentRunId && resultParentRunId !== parentRunId) ||
    (lane.correlationId && resultCorrelationId && resultCorrelationId !== lane.correlationId);

  if (!hardMismatch) return { result, issues };
  return {
    result: {
      status: "pending-result",
      changedFiles: [],
      mergeNotes: `Ignoring stale lane result: ${issues.join("; ")}`,
    },
    issues,
  };
}

function detectConflicts(laneStates) {
  const conflicts = [];

  // 1. Actual file-touch overlap: a file declared changed by more than one lane.
  const fileTouchMap = new Map(); // file -> [laneId, ...]
  for (const lane of laneStates) {
    for (const file of normalizeChangedFiles(lane.result)) {
      if (!fileTouchMap.has(file)) fileTouchMap.set(file, []);
      fileTouchMap.get(file).push(lane.laneId);
    }
  }
  for (const [file, lanes] of fileTouchMap) {
    if (lanes.length > 1) {
      conflicts.push({
        conflictId: `overlap-${conflicts.length + 1}`,
        type: "file-touch-overlap",
        severity: "high",
        file,
        lanes,
        description: `${file} was modified by multiple lanes (${lanes.join(", ")}). Their changes must be manually reconciled.`,
        arbitrationRequired: true,
        coordinatorDecision: "pending",
        coordinatorRationale: "",
        resolution: "",
      });
    }
  }

  // 2. Undeclared edits: lane touched a file outside its declared ownedFiles.
  for (const lane of laneStates) {
    const changedFiles = normalizeChangedFiles(lane.result);
    const ownedFiles = Array.isArray(lane.ownedFiles) ? lane.ownedFiles.map((f) => String(f).replace(/\\/g, "/")) : [];
    for (const changed of changedFiles) {
      const normalizedChanged = String(changed).replace(/\\/g, "/");
      const isOwned = ownedFiles.length === 0 || ownedFiles.some((owned) => normalizedChanged.includes(owned) || owned.includes(normalizedChanged));
      if (!isOwned) {
        conflicts.push({
          conflictId: `undeclared-${conflicts.length + 1}`,
          type: "undeclared-edit",
          severity: "medium",
          file: changed,
          lanes: [lane.laneId],
          description: `Lane ${lane.laneId} edited ${changed} which is outside its declared ownedFiles scope.`,
          arbitrationRequired: true,
          coordinatorDecision: "pending",
          coordinatorRationale: "",
          resolution: "",
        });
      }
    }
  }

  // 3. Shared contract changes: any lane touched a file matching a contract pattern.
  for (const lane of laneStates) {
    const contractChanges = normalizeChangedFiles(lane.result).filter(isContractFile);
    for (const file of contractChanges) {
      const alreadyRecorded = conflicts.some((c) => c.type === "file-touch-overlap" && c.file === file);
      if (!alreadyRecorded) {
        conflicts.push({
          conflictId: `contract-${conflicts.length + 1}`,
          type: "contract-change",
          severity: "medium",
          file,
          lanes: [lane.laneId],
          description: `Lane ${lane.laneId} modified shared contract file ${file}. Verify no other lane assumed the old contract.`,
          arbitrationRequired: true,
          coordinatorDecision: "pending",
          coordinatorRationale: "",
          resolution: "",
        });
      }
    }
  }

  // 4. Competing completedRounds on the same surface (detected via round titles/files in activity logs).
  const surfaceMap = new Map(); // surface keyword -> [laneId, ...]
  for (const lane of laneStates) {
    const rounds = Array.isArray(lane.result?.completedRounds) ? lane.result.completedRounds : [];
    for (const round of rounds) {
      const surface = String(round?.surface || round?.task || "").toLowerCase().trim();
      if (!surface) continue;
      if (!surfaceMap.has(surface)) surfaceMap.set(surface, []);
      if (!surfaceMap.get(surface).includes(lane.laneId)) surfaceMap.get(surface).push(lane.laneId);
    }
  }
  for (const [surface, lanes] of surfaceMap) {
    if (lanes.length > 1) {
      conflicts.push({
        conflictId: `surface-${conflicts.length + 1}`,
        type: "competing-surface-work",
        severity: "high",
        surface,
        lanes,
        description: `Multiple lanes (${lanes.join(", ")}) completed rounds touching the same surface "${surface}". Coordinator must decide which implementation wins.`,
        arbitrationRequired: true,
        coordinatorDecision: "pending",
        coordinatorRationale: "",
        resolution: "",
      });
    }
  }

  return conflicts;
}

function buildArbitrationBrief(conflicts, laneStates) {
  const required = conflicts.filter((c) => c.arbitrationRequired);
  const resolved = required.filter((c) => c.coordinatorDecision !== "pending");
  const pendingDecisions = required.filter((c) => c.coordinatorDecision === "pending");

  const laneCompletedRoundCounts = Object.fromEntries(
    laneStates.map((lane) => [
      lane.laneId,
      Array.isArray(lane.result?.completedRounds) ? lane.result.completedRounds.length : 0,
    ]),
  );

  return {
    status: pendingDecisions.length === 0 && required.length === 0
      ? "no-conflicts"
      : pendingDecisions.length === 0
        ? "all-conflicts-resolved"
        : "requires-arbitration",
    totalConflicts: conflicts.length,
    requiredDecisions: required.length,
    resolvedDecisions: resolved.length,
    pendingDecisions: pendingDecisions.length,
    laneCompletedRoundCounts,
    coordinatorInstructions: pendingDecisions.length === 0 && required.length === 0
      ? "No conflicts detected. Review lane loop summaries and confirm approve-merge."
      : pendingDecisions.length === 0
        ? "All conflicts resolved by coordinator. Confirm gate checks and emit approve-merge."
        : [
            `${pendingDecisions.length} conflict(s) require explicit coordinator arbitration before approve-merge.`,
            "For each conflict, the coordinator must choose one resolution strategy:",
            "  accept-lane-<laneId> — keep only this lane's implementation, discard the others",
            "  synthesize — manually merge the best parts of each lane's work into a unified result",
            "  discard-all — revert the conflicted change entirely and handle it in a follow-up round",
            "  accept-as-is — confirm the conflict is not real (e.g., additive non-overlapping changes)",
            "Record the decision in each conflict's coordinatorDecision and coordinatorRationale fields,",
            "then rerun the merge gate to confirm all conflicts are resolved.",
          ].join("\n"),
    conflicts,
  };
}

export function computeMergeState(coordinator) {
  const lanes = Array.isArray(coordinator?.lanes) ? coordinator.lanes : [];
  const parentRunId = coordinator?.parentRunId || "";
  const laneStates = lanes.map((lane) => {
    const rawResult = readLaneResult(lane.resultFile);
    const { result, issues: resultIssues } = validateLaneResult(lane, rawResult, parentRunId);
    const status = result ? normalizeStatus(result.status) : "pending-result";
    return {
      laneId: lane.laneId,
      correlationId: lane.correlationId,
      ownedFiles: Array.isArray(lane.ownedFiles) ? lane.ownedFiles : [],
      dependencyState: lane.dependencyState || "",
      isolation: lane.isolation || "",
      resultFile: lane.resultFile,
      activityLogFile: lane.activityLogFile || "",
      status,
      result,
      resultIssues,
    };
  });

  // Declared ownership overlap (from ownedFiles declarations, not actual touches).
  const ownershipMap = new Map();
  const ownershipIssues = [];
  for (const lane of laneStates) {
    for (const file of lane.ownedFiles) {
      const prior = ownershipMap.get(file);
      if (prior && prior !== lane.laneId) ownershipIssues.push(`declared ownership overlap between ${prior} and ${lane.laneId}: ${file}`);
      else ownershipMap.set(file, lane.laneId);
    }
  }

  // Conflict detection across all approved loop results.
  const conflicts = detectConflicts(laneStates);

  // Preserve prior coordinator decisions across reruns.
  // Match by (type + file/surface) since conflictId counters reset each run.
  const priorMerge = readJson(".ai-sync/AUTO_HERMES_MAX_MERGE.json");
  const priorConflicts = Array.isArray(priorMerge?.arbitration?.conflicts) ? priorMerge.arbitration.conflicts : [];
  const decisionLookup = new Map();
  for (const prior of priorConflicts) {
    if (!prior?.coordinatorDecision || prior.coordinatorDecision === "pending") continue;
    const key = `${prior.type}::${prior.file || prior.surface || ""}::${(prior.lanes || []).join(",")}`;
    decisionLookup.set(key, {
      coordinatorDecision: prior.coordinatorDecision,
      coordinatorRationale: prior.coordinatorRationale || "",
      resolution: prior.resolution || "",
    });
  }
  for (const conflict of conflicts) {
    const key = `${conflict.type}::${conflict.file || conflict.surface || ""}::${(conflict.lanes || []).join(",")}`;
    const prior = decisionLookup.get(key);
    if (prior) {
      conflict.coordinatorDecision = prior.coordinatorDecision;
      conflict.coordinatorRationale = prior.coordinatorRationale;
      conflict.resolution = prior.resolution;
    }
  }

  const arbitration = buildArbitrationBrief(conflicts, laneStates);

  const incomplete = laneStates.filter((lane) => lane.status === "pending-result");
  const blocked = laneStates.filter((lane) => lane.status === "blocked");
  const mustFix = laneStates.filter((lane) => lane.status === "must-fix");
  const approved = laneStates.filter((lane) => lane.status === "approved");
  const resultFreshnessIssues = laneStates.flatMap((lane) => lane.resultIssues || []);
  const deferred = Array.isArray(coordinator?.deferredLanes) ? coordinator.deferredLanes : [];
  const blockedCandidates = Array.isArray(coordinator?.blockedLanes) ? coordinator.blockedLanes : [];
  const candidateCount = Number.isFinite(Number(coordinator?.candidateLaneCount)) ? Number(coordinator.candidateLaneCount) : laneStates.length;
  const selectedCount = Number.isFinite(Number(coordinator?.selectedLaneCount)) ? Number(coordinator.selectedLaneCount) : laneStates.length;
  const isolationIssues = selectedCount > 1
    ? laneStates
        .filter((lane) => lane.isolation !== "worktree")
        .map((lane) => `${lane.laneId} did not declare worktree isolation for a multi-lane parent round`)
    : [];
  const verificationIssues = approved
    .filter((lane) => !String(lane.result?.verification || "").trim())
    .map((lane) => `${lane.laneId} is approved but did not record fresh verification evidence`);
  const architectIssues = approved
    .filter((lane) => !isApprovedLike(lane.result?.architectVerdict))
    .map((lane) => `${lane.laneId} is approved but lacks an APPROVED architect verdict`);
  const deslopIssues = approved
    .filter((lane) => !isPassLike(lane.result?.deslopPass))
    .map((lane) => `${lane.laneId} is approved but did not record a passing deslop result`);
  const regressionIssues = approved
    .filter((lane) => !isPassLike(lane.result?.regressionPass))
    .map((lane) => `${lane.laneId} is approved but did not record post-deslop regression verification`);
  const ralphGateIssues = [
    ...verificationIssues,
    ...architectIssues,
    ...deslopIssues,
    ...regressionIssues,
  ];

  // Verdict: arbitration pending blocks approve-merge even if all lanes say approved.
  const arbitrationBlocking = arbitration.pendingDecisions > 0 && !incomplete.length && !blocked.length && !mustFix.length;
  const verdict = blocked.length
    ? "blocked"
    : incomplete.length
      ? "awaiting-lane-results"
      : ownershipIssues.length || isolationIssues.length
        ? "blocked"
        : mustFix.length || ralphGateIssues.length
          ? "must-fix-before-merge-complete"
          : arbitrationBlocking
            ? "arbitration-required-before-merge"
            : "approve-merge";

  // runtimeTruth: resolved only when every approved lane reported a non-empty runtimeProof.
  const allHaveRuntimeProof = laneStates
    .filter((l) => l.status === "approved")
    .every((l) => Boolean(l.result?.runtimeProof && String(l.result.runtimeProof).trim()));

  let parallelRoiVerdict = "pending-coordinator-review";
  let parallelRoiSummary = "Need merged review to judge whether coordination cost was justified.";
  if (verdict === "approve-merge") {
    if (selectedCount <= 1) {
      parallelRoiVerdict = "should-have-been-single-lane";
      parallelRoiSummary = "Single-lane result — coordination cost likely outweighed the value of parallel execution.";
    } else if (deferred.length > selectedCount) {
      parallelRoiVerdict = "should-have-been-single-lane";
      parallelRoiSummary = "More lanes were deferred than launched, suggesting coordination overhead outweighed the parallel strategy.";
    } else {
      parallelRoiVerdict = "worth-parallelizing";
      parallelRoiSummary = deferred.length || blockedCandidates.length
        ? "Merged outcome succeeded and the launcher made a bounded selective cut, controlling coordination cost."
        : "All candidate lanes were selected and approved — clean parallel loop execution with no wasted coordination.";
    }
  } else if (verdict === "must-fix-before-merge-complete" || verdict === "blocked" || verdict === "arbitration-required-before-merge") {
    parallelRoiVerdict = "neutral";
    parallelRoiSummary = "Do not reward or punish the parallel strategy until the merged must-fix/blocker/arbitration is resolved.";
  }

  return {
    generatedAt: coordinator?.generatedAt || nowIso(),
    mergedAt: nowIso(),
    parentGoal: coordinator?.parentGoal || "",
    parentRunId,
    correlationId: coordinator?.correlationId || "",
    verdict,
    summary:
      verdict === "approve-merge"
        ? `All ${approved.length} loop lane result(s) approved and arbitration complete.`
        : verdict === "arbitration-required-before-merge"
          ? `${arbitration.pendingDecisions} conflict(s) require coordinator arbitration before merge.`
        : verdict === "awaiting-lane-results"
          ? `${incomplete.length} lane loop(s) still running.`
        : verdict === "must-fix-before-merge-complete"
          ? [...mustFix.map((lane) => `${lane.laneId} returned must-fix status`), ...ralphGateIssues].join(" | ")
          : blocked.length
                ? `${blocked.length} lane(s) are blocked.`
                : [...ownershipIssues, ...isolationIssues].join(" | "),
    gates: {
      ownership: ownershipIssues.length ? "blocked" : "pass",
      contract: isolationIssues.length ? "blocked" : incomplete.length ? "pending" : "requires-coordinator-review",
      verification: incomplete.length ? "pending" : blocked.length ? "blocked" : verificationIssues.length ? "blocked" : "pass",
      runtimeTruth: allHaveRuntimeProof ? "pass" : "pending-coordinator-review",
      regression: blocked.length ? "blocked" : incomplete.length ? "pending" : "requires-coordinator-review",
      arbitration: arbitration.status === "no-conflicts" || arbitration.status === "all-conflicts-resolved"
        ? "pass"
        : arbitration.status === "requires-arbitration"
          ? "requires-coordinator-arbitration"
          : "pending",
      review: architectIssues.length ? "blocked" : verdict === "approve-merge" ? "pass" : "pending",
      evidence: incomplete.length ? "pending" : "pass",
      parallelRoi: parallelRoiVerdict === "pending-coordinator-review" ? "pending" : "pass",
      deslop: deslopIssues.length ? "blocked" : incomplete.length ? "pending" : "pass",
      regressionReverification: regressionIssues.length ? "blocked" : incomplete.length ? "pending" : "pass",
    },
    issues: [...resultFreshnessIssues, ...ownershipIssues, ...isolationIssues, ...ralphGateIssues],
    arbitration,
    parallelRoi: {
      verdict: parallelRoiVerdict,
      summary: parallelRoiSummary,
      candidateLaneCount: candidateCount,
      selectedLaneCount: selectedCount,
    },
    lanes: laneStates.map((lane) => ({
      laneId: lane.laneId,
      correlationId: lane.correlationId,
      status: lane.status,
      resultFile: lane.resultFile,
      activityLogFile: lane.activityLogFile,
      isolation: lane.isolation || "",
      completedRounds: lane.result?.completedRounds?.length ?? 0,
      changedFiles: normalizeChangedFiles(lane.result),
      verification: lane.result?.verification || "",
      runtimeProof: lane.result?.runtimeProof || "",
      architectVerdict: lane.result?.architectVerdict || "",
      deslopPass: lane.result?.deslopPass || "",
      regressionPass: lane.result?.regressionPass || "",
      mergeNotes: lane.result?.mergeNotes || "",
      resultIssues: lane.resultIssues || [],
      dependencyState: lane.result?.dependencyState || lane.dependencyState || "",
    })),
  };
}

export function renderMarkdown(state) {
  const lines = [
    "# Auto-Hermes Max Merge Gate",
    "",
    `Generated: ${state.generatedAt}`,
    `Parent Goal: ${state.parentGoal}`,
    `Parent Run Id: ${state.parentRunId}`,
    `Correlation Id: ${state.correlationId}`,
    `Merged At: ${state.mergedAt}`,
    `Merged Verdict: ${state.verdict}`,
    `Summary: ${state.summary}`,
    "",
    "## Lane Loop Results",
    ...state.lanes.map((lane) =>
      `- ${lane.laneId}: ${lane.status} | isolation: ${lane.isolation || "direct"} | rounds completed: ${lane.completedRounds} | changed files: ${lane.changedFiles.length} | ${lane.resultFile}`,
    ),
    "",
    "## Gate Results",
    `- Ownership Gate: ${state.gates.ownership}`,
    `- Contract Gate: ${state.gates.contract}`,
    `- Verification Gate: ${state.gates.verification}`,
    `- Runtime Truth Gate: ${state.gates.runtimeTruth}`,
    `- Regression Gate: ${state.gates.regression}`,
    `- Arbitration Gate: ${state.gates.arbitration}`,
    `- Review Gate: ${state.gates.review}`,
    `- Evidence Gate: ${state.gates.evidence}`,
    `- Deslop Gate: ${state.gates.deslop}`,
    `- Regression-Reverification Gate: ${state.gates.regressionReverification}`,
    `- Parallel ROI Gate: ${state.gates.parallelRoi}`,
    "",
    "## Merge Arbitration",
    `Status: ${state.arbitration.status}`,
    `Total Conflicts: ${state.arbitration.totalConflicts}`,
    `Pending Decisions: ${state.arbitration.pendingDecisions}`,
    `Resolved Decisions: ${state.arbitration.resolvedDecisions}`,
    "",
    "Coordinator Instructions:",
    state.arbitration.coordinatorInstructions,
  ];

  if (state.arbitration.conflicts.length) {
    lines.push("", "### Conflicts Requiring Arbitration");
    for (const conflict of state.arbitration.conflicts) {
      lines.push(
        "",
        `#### ${conflict.conflictId} [${conflict.type}] severity=${conflict.severity}`,
        `Description: ${conflict.description}`,
        `Lanes involved: ${Array.isArray(conflict.lanes) ? conflict.lanes.join(", ") : conflict.lanes || "n/a"}`,
        `Decision: ${conflict.coordinatorDecision}`,
        `Rationale: ${conflict.coordinatorRationale || "(pending)"}`,
        `Resolution: ${conflict.resolution || "(pending — choose: accept-lane-<id> | synthesize | discard-all | accept-as-is)"}`,
      );
    }
  } else {
    lines.push("", "No conflicts detected across lane loop results.");
  }

  lines.push(
    "",
    "## Lane Completed Round Counts",
    ...Object.entries(state.arbitration.laneCompletedRoundCounts || {}).map(
      ([laneId, count]) => `- ${laneId}: ${count} round(s) completed`,
    ),
    "",
    "## Parallel ROI",
    `- Verdict: ${state.parallelRoi.verdict}`,
    `- Summary: ${state.parallelRoi.summary}`,
    `- Candidate Lane Count: ${state.parallelRoi.candidateLaneCount}`,
    `- Selected Lane Count: ${state.parallelRoi.selectedLaneCount}`,
  );

  if (state.issues.length) {
    lines.push("", "## Ownership Issues", ...state.issues.map((issue) => `- ${issue}`));
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const coordinator = readJson(args.coordinatorJson, null);
  if (!coordinator) {
    throw new Error("Missing or invalid auto-hermes-max coordinator JSON.");
  }

  const mergeState = computeMergeState(coordinator);

  if (args.write) {
    const mergeJson = resolveFromRoot(args.mergeJson);
    const mergeMd = resolveFromRoot(args.mergeMd);
    ensureParent(mergeJson);
    ensureParent(mergeMd);
    fs.writeFileSync(mergeJson, JSON.stringify(mergeState, null, 2), "utf8");
    fs.writeFileSync(mergeMd, renderMarkdown(mergeState), "utf8");
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(mergeState, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderMarkdown(mergeState));
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main();
}
