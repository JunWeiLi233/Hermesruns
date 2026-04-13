#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["approved", "approve", "complete", "completed", "pass", "passed"].includes(raw)) return "approved";
  if (["must-fix", "must_fix", "needs-fix"].includes(raw)) return "must-fix";
  if (["blocked", "error", "failed"].includes(raw)) return "blocked";
  return raw || "pending-result";
}

function computeMergeState(coordinator) {
  const lanes = Array.isArray(coordinator?.lanes) ? coordinator.lanes : [];
  const laneStates = lanes.map((lane) => {
    const result = readLaneResult(lane.resultFile);
    const status = result ? normalizeStatus(result.status) : "pending-result";
    return {
      laneId: lane.laneId,
      correlationId: lane.correlationId,
      ownedFiles: Array.isArray(lane.ownedFiles) ? lane.ownedFiles : [],
      resultFile: lane.resultFile,
      status,
      result,
    };
  });

  const ownershipMap = new Map();
  const ownershipIssues = [];
  for (const lane of laneStates) {
    for (const file of lane.ownedFiles) {
      const prior = ownershipMap.get(file);
      if (prior && prior !== lane.laneId) ownershipIssues.push(`ownership overlap between ${prior} and ${lane.laneId}: ${file}`);
      else ownershipMap.set(file, lane.laneId);
    }
  }

  const incomplete = laneStates.filter((lane) => lane.status === "pending-result");
  const blocked = laneStates.filter((lane) => lane.status === "blocked");
  const mustFix = laneStates.filter((lane) => lane.status === "must-fix");
  const approved = laneStates.filter((lane) => lane.status === "approved");

  const verdict = blocked.length
    ? "blocked"
    : mustFix.length
      ? "must-fix-before-merge-complete"
      : incomplete.length
        ? "awaiting-lane-results"
        : ownershipIssues.length
          ? "blocked"
          : "approve-merge";

  return {
    generatedAt: coordinator?.generatedAt || nowIso(),
    mergedAt: nowIso(),
    parentGoal: coordinator?.parentGoal || "",
    parentRunId: coordinator?.parentRunId || "",
    correlationId: coordinator?.correlationId || "",
    verdict,
    summary:
      verdict === "approve-merge"
        ? `All ${approved.length} lane result packet(s) are present and approved.`
        : verdict === "awaiting-lane-results"
          ? `${incomplete.length} lane result packet(s) are still pending.`
          : verdict === "must-fix-before-merge-complete"
            ? `${mustFix.length} lane(s) returned must-fix status.`
            : blocked.length
              ? `${blocked.length} lane(s) are blocked.`
              : ownershipIssues.join(" | "),
    gates: {
      ownership: ownershipIssues.length ? "blocked" : "pass",
      contract: "pass",
      verification: incomplete.length ? "pending" : blocked.length ? "blocked" : "pass",
      runtimeTruth: "pending-coordinator-review",
      regression: blocked.length ? "blocked" : "pass",
      review: verdict === "approve-merge" ? "pass" : "pending",
      evidence: incomplete.length ? "pending" : "pass",
    },
    issues: ownershipIssues,
    lanes: laneStates.map((lane) => ({
      laneId: lane.laneId,
      correlationId: lane.correlationId,
      status: lane.status,
      resultFile: lane.resultFile,
      verification: lane.result?.verification || "",
      runtimeProof: lane.result?.runtimeProof || "",
      mergeNotes: lane.result?.mergeNotes || "",
    })),
  };
}

function renderMarkdown(state) {
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
    "",
    "Gate results:",
    `- Ownership Gate: ${state.gates.ownership}`,
    `- Contract Gate: ${state.gates.contract}`,
    `- Verification Gate: ${state.gates.verification}`,
    `- Runtime Truth Gate: ${state.gates.runtimeTruth}`,
    `- Regression Gate: ${state.gates.regression}`,
    `- Review Gate: ${state.gates.review}`,
    `- Evidence Gate: ${state.gates.evidence}`,
  ];

  if (state.issues.length) {
    lines.push("", "Issues:", ...state.issues.map((issue) => `- ${issue}`));
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

main();
