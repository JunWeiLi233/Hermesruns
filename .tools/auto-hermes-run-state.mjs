import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_RUN_STATE_DIR = ".ai-sync/auto-hermes-run-state";

function resolveFromRoot(rootDir, relPath) {
  const baseDir = path.resolve(String(rootDir || process.cwd()));
  return path.isAbsolute(relPath) ? relPath : path.resolve(baseDir, relPath);
}

function runStateDir(rootDir) {
  return resolveFromRoot(rootDir, DEFAULT_RUN_STATE_DIR);
}

function validateRunId(runId) {
  const value = String(runId || "").trim();
  if (!value) {
    throw new RangeError("runId is required");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new RangeError("runId must contain only letters, numbers, underscore, or hyphen");
  }
  return value;
}

function runStatePath(rootDir, runId) {
  return path.join(runStateDir(rootDir), `${validateRunId(runId)}.json`);
}

function nowIso() {
  return new Date().toISOString();
}

function makeRunId() {
  return `ahr-${nowIso().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function clampCount(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeAttempt(attempt) {
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) return null;
  return {
    at: String(attempt.at || attempt.timestamp || nowIso()),
    foundCandidate: Boolean(attempt.foundCandidate),
    auditSummary: String(attempt.auditSummary || attempt.summary || "").trim(),
  };
}

function normalizeRunState(raw, fallback = {}) {
  const base = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const websiteAudit = base.websiteAudit && typeof base.websiteAudit === "object" && !Array.isArray(base.websiteAudit)
    ? base.websiteAudit
    : {};

  const attempts = Array.isArray(websiteAudit.attempts)
    ? websiteAudit.attempts.map(normalizeAttempt).filter(Boolean)
    : [];

  return {
    ...base,
    runId: String(base.runId || fallback.runId || makeRunId()).trim(),
    mode: String(base.mode || fallback.mode || "auto-hermes").trim(),
    goal: String(base.goal || fallback.goal || "").trim(),
    createdAt: String(base.createdAt || fallback.createdAt || nowIso()),
    updatedAt: String(base.updatedAt || fallback.updatedAt || base.createdAt || nowIso()),
    websiteAudit: {
      ...websiteAudit,
      emptyAuditCount: clampCount(websiteAudit.emptyAuditCount),
      attempts,
      lastAttemptAt: String(websiteAudit.lastAttemptAt || ""),
      lastFoundCandidateAt: String(websiteAudit.lastFoundCandidateAt || ""),
      lastAuditSummary: String(websiteAudit.lastAuditSummary || ""),
      lastFoundCandidateSummary: String(websiteAudit.lastFoundCandidateSummary || ""),
    },
  };
}

export function writeAutoHermesRunState({ rootDir, state } = {}) {
  const normalized = normalizeRunState(state, { rootDir });
  const filePath = runStatePath(rootDir, normalized.runId);
  writeJson(filePath, normalized);
  return normalized;
}

export function createAutoHermesRun({ rootDir, mode = "auto-hermes", goal = "" } = {}) {
  const state = normalizeRunState({
    runId: makeRunId(),
    mode,
    goal,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    websiteAudit: {
      emptyAuditCount: 0,
      attempts: [],
      lastAttemptAt: "",
      lastFoundCandidateAt: "",
      lastAuditSummary: "",
      lastFoundCandidateSummary: "",
    },
  });

  const persisted = writeAutoHermesRunState({ rootDir, state });
  return {
    state: persisted,
    statePath: runStatePath(rootDir, persisted.runId),
  };
}

export function loadAutoHermesRun({ rootDir, runId } = {}) {
  if (!runId) return null;
  let filePath;
  try {
    filePath = runStatePath(rootDir, runId);
  } catch {
    return null;
  }

  if (!fs.existsSync(filePath)) return null;

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (typeof parsed.runId !== "string" || !parsed.runId.trim()) return null;
  try {
    validateRunId(parsed.runId);
  } catch {
    return null;
  }

  const state = normalizeRunState(parsed, { runId: parsed.runId });
  return state.runId ? state : null;
}

export function recordWebsiteAuditAttempt({
  rootDir,
  runId,
  foundCandidate = false,
  auditSummary = "",
} = {}) {
  const current = loadAutoHermesRun({ rootDir, runId });
  if (!current) return null;

  const attempt = {
    at: nowIso(),
    foundCandidate: Boolean(foundCandidate),
    auditSummary: String(auditSummary || "").trim(),
  };

  const attempts = Array.isArray(current.websiteAudit?.attempts)
    ? [...current.websiteAudit.attempts, attempt].slice(-25)
    : [attempt];

  const nextWebsiteAudit = {
    ...(current.websiteAudit || {}),
    attempts,
    emptyAuditCount: foundCandidate ? 0 : clampCount(current.websiteAudit?.emptyAuditCount) + 1,
    lastAttemptAt: attempt.at,
    lastAuditSummary: attempt.auditSummary,
  };

  if (foundCandidate) {
    nextWebsiteAudit.lastFoundCandidateAt = attempt.at;
    nextWebsiteAudit.lastFoundCandidateSummary = attempt.auditSummary;
  }

  const nextState = normalizeRunState({
    ...current,
    updatedAt: attempt.at,
    websiteAudit: nextWebsiteAudit,
  }, { runId: current.runId });

  writeAutoHermesRunState({ rootDir, state: nextState });
  return nextState;
}
