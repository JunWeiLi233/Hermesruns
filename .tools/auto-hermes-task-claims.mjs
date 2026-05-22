#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
}

function nowIso() {
  return new Date().toISOString();
}

function compactKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function asClaimTtlMs(value) {
  const minutes = Number.parseInt(String(value ?? ""), 10);
  return Math.max(1, Number.isFinite(minutes) ? minutes : 15) * 60_000;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function claimDirPath(claimDir) {
  return resolveFromRoot(claimDir || ".ai-sync/auto-hermes-claims");
}

function claimFilePath(claimDir, key) {
  return path.join(claimDirPath(claimDir), `${key}.json`);
}

function claimTimestamp(record) {
  return Date.parse(record?.updatedAt || record?.claimedAt || "") || 0;
}

export function taskClaimKey({ source = "", surface = "", title = "" } = {}) {
  return compactKey(`${source} ${surface} ${title}`) || "auto-hermes-task";
}

export function isClaimFresh(record, ttlMs) {
  const timestamp = claimTimestamp(record);
  if (!timestamp) return false;
  return (Date.now() - timestamp) < ttlMs;
}

export function listFreshTaskClaims({ claimDir, ttlMinutes = 15 } = {}) {
  const ttlMs = asClaimTtlMs(ttlMinutes);
  const dir = claimDirPath(claimDir);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(path.join(dir, name)))
    .filter((record) => record && record.key && isClaimFresh(record, ttlMs));
}

export function readTaskClaim({ claimDir, key } = {}) {
  if (!key) return null;
  return readJson(claimFilePath(claimDir, key));
}

export function acquireTaskClaim({
  claimDir,
  key,
  ownerId,
  ownerLabel = "",
  source = "",
  surface = "",
  title = "",
  ttlMinutes = 15,
} = {}) {
  if (!key || !ownerId) {
    return { acquired: false, reason: "missing-claim-key-or-owner", claim: null };
  }

  const ttlMs = asClaimTtlMs(ttlMinutes);
  const dir = claimDirPath(claimDir);
  const filePath = claimFilePath(claimDir, key);
  fs.mkdirSync(dir, { recursive: true });

  const record = {
    key,
    ownerId,
    ownerLabel,
    source,
    surface,
    title,
    claimedAt: nowIso(),
    updatedAt: nowIso(),
  };

  try {
    const handle = fs.openSync(filePath, "wx");
    fs.writeFileSync(handle, JSON.stringify(record, null, 2), "utf8");
    fs.closeSync(handle);
    return { acquired: true, reason: "created", claim: record };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  const existing = readJson(filePath);
  if (!existing) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // ignore and retry through the normal path
    }
    return acquireTaskClaim({
      claimDir,
      key,
      ownerId,
      ownerLabel,
      source,
      surface,
      title,
      ttlMinutes,
    });
  }

  if (existing.ownerId === ownerId) {
    const refreshed = { ...existing, ownerLabel, source, surface, title, updatedAt: nowIso() };
    fs.writeFileSync(filePath, JSON.stringify(refreshed, null, 2), "utf8");
    return { acquired: true, reason: "refreshed", claim: refreshed };
  }

  if (!isClaimFresh(existing, ttlMs)) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      return { acquired: false, reason: "stale-claim-remove-failed", claim: existing };
    }
    return acquireTaskClaim({
      claimDir,
      key,
      ownerId,
      ownerLabel,
      source,
      surface,
      title,
      ttlMinutes,
    });
  }

  return { acquired: false, reason: "claimed-by-other-owner", claim: existing };
}

export function releaseTaskClaim({ claimDir, key, ownerId } = {}) {
  if (!key || !ownerId) return { released: false, reason: "missing-claim-key-or-owner" };
  const filePath = claimFilePath(claimDir, key);
  const existing = readJson(filePath);
  if (!existing) return { released: true, reason: "already-missing" };
  if (existing.ownerId !== ownerId) {
    return { released: false, reason: "owned-by-other", claim: existing };
  }
  fs.rmSync(filePath, { force: true });
  return { released: true, reason: "released" };
}
