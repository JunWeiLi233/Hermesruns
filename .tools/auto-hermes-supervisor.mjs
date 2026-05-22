#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_NO_CANDIDATE_AUDIT_LIMIT = 3;

function nowIso() {
  return new Date().toISOString();
}

function clampPositiveInt(value, fallback = DEFAULT_NO_CANDIDATE_AUDIT_LIMIT) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeQueueState(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "available") return "available";
  if (normalized === "empty") return "empty";
  return "unknown";
}

function normalizeWebsiteAuditStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "candidate") return "candidate";
  if (normalized === "no-candidate") return "no-candidate";
  if (normalized === "pending") return "pending";
  return "skipped";
}

export function normalizeAutoHermesSupervisorState(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const createdAt = String(source.createdAt || nowIso());
  const updatedAt = String(source.updatedAt || createdAt);

  return {
    mode: String(source.mode || "auto-hermes"),
    continuityLayer: "supervisor",
    preferredContinuityLayer: "supervisor",
    firstExhaustionFallback: "website-audit-explorer",
    trueStopCondition: "repeated-no-candidate-audit-rounds",
    noCandidateAuditLimit: clampPositiveInt(source.noCandidateAuditLimit),
    repeatedNoCandidateAuditRounds: clampPositiveInt(source.repeatedNoCandidateAuditRounds, 0),
    stop: Boolean(source.stop),
    decision: String(source.decision || "continue"),
    rationale: String(source.rationale || ""),
    createdAt,
    updatedAt,
    lastObserved: {
      queueState: normalizeQueueState(source?.lastObserved?.queueState),
      websiteAuditStatus: normalizeWebsiteAuditStatus(source?.lastObserved?.websiteAuditStatus),
      summary: String(source?.lastObserved?.summary || "").trim(),
    },
  };
}

export function createAutoHermesSupervisorState({
  mode = "auto-hermes",
  noCandidateAuditLimit = DEFAULT_NO_CANDIDATE_AUDIT_LIMIT,
} = {}) {
  return normalizeAutoHermesSupervisorState({
    mode,
    noCandidateAuditLimit,
    repeatedNoCandidateAuditRounds: 0,
    stop: false,
    decision: "continue",
    rationale: "Supervisor initialized. Empty queue does not immediately stop; website-audit explorer is the first exhaustion fallback.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastObserved: {
      queueState: "unknown",
      websiteAuditStatus: "skipped",
      summary: "",
    },
  });
}

export function evaluateAutoHermesSupervisorRound({
  state,
  queueState = "unknown",
  websiteAuditStatus = "skipped",
  summary = "",
} = {}) {
  const current = normalizeAutoHermesSupervisorState(state);
  const nextQueueState = normalizeQueueState(queueState);
  const nextWebsiteAuditStatus = normalizeWebsiteAuditStatus(websiteAuditStatus);
  const normalizedSummary = String(summary || "").trim();

  let repeatedNoCandidateAuditRounds = current.repeatedNoCandidateAuditRounds;
  let decision = "continue";
  let stop = false;
  let rationale = "Supervisor is waiting for clearer continuity signals.";

  if (nextQueueState === "available") {
    repeatedNoCandidateAuditRounds = 0;
    rationale = "Promotable queue work is available. The supervisor keeps the run moving without using the exhaustion fallback.";
  } else if (nextQueueState === "empty" && nextWebsiteAuditStatus === "pending") {
    rationale = "Queue is empty, but empty queue does not immediately stop. Website-audit explorer is the first exhaustion fallback.";
  } else if (nextWebsiteAuditStatus === "candidate") {
    repeatedNoCandidateAuditRounds = 0;
    rationale = "Website-audit explorer found a bounded fallback candidate, so the run continues.";
  } else if (nextWebsiteAuditStatus === "no-candidate") {
    repeatedNoCandidateAuditRounds += 1;
    stop = repeatedNoCandidateAuditRounds >= current.noCandidateAuditLimit;
    decision = stop ? "stop" : "continue";
    rationale = stop
      ? `Website-audit explorer produced no candidate for ${repeatedNoCandidateAuditRounds} consecutive round(s). Repeated no-candidate audit rounds are the true stop condition.`
      : `Website-audit explorer produced no candidate for ${repeatedNoCandidateAuditRounds} consecutive round(s). The supervisor continues until the no-candidate audit limit is reached.`;
  } else if (nextQueueState === "empty") {
    rationale = "Queue is empty, and the supervisor still expects website-audit explorer to run before any stop decision.";
  }

  return normalizeAutoHermesSupervisorState({
    ...current,
    repeatedNoCandidateAuditRounds,
    decision,
    stop,
    rationale,
    updatedAt: nowIso(),
    lastObserved: {
      queueState: nextQueueState,
      websiteAuditStatus: nextWebsiteAuditStatus,
      summary: normalizedSummary,
    },
  });
}

export function renderAutoHermesSupervisorMarkdown(state) {
  const normalized = normalizeAutoHermesSupervisorState(state);
  return [
    "# Auto-Hermes Supervisor",
    "",
    `Mode: ${normalized.mode}`,
    `Continuity Layer: ${normalized.continuityLayer}`,
    `Preferred Continuity Layer: ${normalized.preferredContinuityLayer}`,
    `First Exhaustion Fallback: ${normalized.firstExhaustionFallback}`,
    `True Stop Condition: ${normalized.trueStopCondition}`,
    `No-Candidate Audit Limit: ${normalized.noCandidateAuditLimit}`,
    `Repeated No-Candidate Audit Rounds: ${normalized.repeatedNoCandidateAuditRounds}`,
    `Decision: ${normalized.decision}`,
    `Stop: ${normalized.stop ? "yes" : "no"}`,
    `Last Queue State: ${normalized.lastObserved.queueState}`,
    `Last Website Audit Status: ${normalized.lastObserved.websiteAuditStatus}`,
    `Summary: ${normalized.lastObserved.summary || "none"}`,
    "",
    normalized.rationale || "No rationale recorded.",
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    json: false,
    mode: "auto-hermes",
    queueState: "unknown",
    websiteAuditStatus: "skipped",
    noCandidateAuditLimit: DEFAULT_NO_CANDIDATE_AUDIT_LIMIT,
    repeatedNoCandidateAuditRounds: 0,
    summary: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      args.json = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args && i + 1 < argv.length) {
        args[key] = argv[i + 1];
        i += 1;
      }
    }
  }

  return {
    ...args,
    noCandidateAuditLimit: clampPositiveInt(args.noCandidateAuditLimit),
    repeatedNoCandidateAuditRounds: clampPositiveInt(args.repeatedNoCandidateAuditRounds, 0),
  };
}

export function runAutoHermesSupervisor(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : {
    ...parseArgs([]),
    ...rawArgs,
  };

  const initialState = createAutoHermesSupervisorState({
    mode: args.mode,
    noCandidateAuditLimit: args.noCandidateAuditLimit,
  });
  const state = evaluateAutoHermesSupervisorRound({
    state: {
      ...initialState,
      repeatedNoCandidateAuditRounds: clampPositiveInt(args.repeatedNoCandidateAuditRounds, 0),
    },
    queueState: args.queueState,
    websiteAuditStatus: args.websiteAuditStatus,
    summary: args.summary,
  });

  if (args.json) {
    return {
      state,
      output: `${JSON.stringify(state, null, 2)}\n`,
    };
  }

  return {
    state,
    output: renderAutoHermesSupervisorMarkdown(state),
  };
}

function main() {
  const { output } = runAutoHermesSupervisor(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
