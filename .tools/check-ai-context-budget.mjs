#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "docs/ai/context-manifest.json");

function fail(message) {
  process.stderr.write(`AI context budget check failed: ${message}\n`);
  process.exitCode = 1;
}

function estimatedTokens(file) {
  return Math.ceil(Buffer.byteLength(readFileSync(file, "utf8")) / 4);
}

function checkInstructionDiscipline(manifest) {
  if (manifest.guardedInstructionPaths === undefined) return;
  if (!Array.isArray(manifest.guardedInstructionPaths)) {
    fail("guardedInstructionPaths must be an array when provided");
    return;
  }

  const directHistoryRead = /(?:^|\n)\s*(?:\d+\.\s*|[-*]\s*)?(?:re-)?read\s+[`']?(?:\.ai-sync\/(?:CONTEXT_LEDGER|AGENT_SYNC)\.md|PRODUCT\.md|README\.md)/gim;

  for (const entry of manifest.guardedInstructionPaths) {
    const file = resolve(root, entry);
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch (error) {
      fail(`cannot read guarded instruction ${entry}: ${error.message}`);
      continue;
    }

    if (directHistoryRead.test(content)) {
      fail(`${entry} directly reads a full history or product archive; use the compact snapshot and a targeted query instead`);
    }
    directHistoryRead.lastIndex = 0;
  }
}

function main() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`cannot read ${relative(root, manifestPath)}: ${error.message}`);
    return;
  }

  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.requiredReadPaths)) {
    fail("manifest must declare schemaVersion 1 and requiredReadPaths");
    return;
  }

  const archives = new Set(manifest.searchOnlyArchives || []);
  let total = 0;

  checkInstructionDiscipline(manifest);

  for (const entry of manifest.requiredReadPaths) {
    if (!entry?.path || !Number.isInteger(entry.maxEstimatedTokens)) {
      fail("each requiredReadPaths entry needs path and maxEstimatedTokens");
      return;
    }
    if (archives.has(entry.path)) {
      fail(`${entry.path} cannot be both required context and a search-only archive`);
      return;
    }

    const file = resolve(root, entry.path);
    let tokens;
    try {
      tokens = estimatedTokens(file);
    } catch (error) {
      fail(`cannot read ${entry.path}: ${error.message}`);
      return;
    }

    if (tokens > entry.maxEstimatedTokens) {
      fail(`${entry.path} is about ${tokens} tokens (limit ${entry.maxEstimatedTokens})`);
      return;
    }
    total += tokens;
  }

  if (!Number.isInteger(manifest.maxTotalEstimatedTokens) || total > manifest.maxTotalEstimatedTokens) {
    fail(`required context is about ${total} tokens (limit ${manifest.maxTotalEstimatedTokens})`);
    return;
  }

  process.stdout.write(`AI context budget: ~${total}/${manifest.maxTotalEstimatedTokens} tokens.\n`);
}

main();
