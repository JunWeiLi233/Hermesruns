#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_ERROR_LEDGER = ".ai-sync/error.md";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function nowIso() {
  return new Date().toISOString();
}

function resolveFromRoot(rootDir, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(rootDir || ROOT, filePath);
}

function parseArgs(argv = []) {
  const args = {
    scan: false,
    write: false,
    json: false,
    failOnRepairRequired: false,
    ledgerPath: DEFAULT_ERROR_LEDGER,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--scan") args.scan = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--fail-on-repair-required") args.failOnRepairRequired = true;
    else if (arg === "--ledger" || arg === "--ledger-path") args.ledgerPath = argv[++index] || args.ledgerPath;
  }

  return args;
}

function extractLedgerPayload(markdown) {
  const match = String(markdown || "").match(/<!--\s*AUTO-HERMES-ERROR-LEDGER\s*([\s\S]*?)\s*AUTO-HERMES-ERROR-LEDGER\s*-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function normalizeEntry(entry = {}, generatedAt = nowIso()) {
  return {
    id: String(entry.id || `aherr-${Math.random().toString(16).slice(2)}`),
    status: String(entry.status || "open"),
    severity: String(entry.severity || "warn"),
    category: String(entry.category || "unknown"),
    source: String(entry.source || "unknown"),
    summary: String(entry.summary || "No summary provided."),
    detail: String(entry.detail || ""),
    repairAction: String(entry.repairAction || ""),
    evidence: String(entry.evidence || ""),
    owner: String(entry.owner || "auto-hermes"),
    round: String(entry.round || ""),
    firstSeenAt: String(entry.firstSeenAt || generatedAt),
    lastSeenAt: String(entry.lastSeenAt || generatedAt),
    resolvedAt: String(entry.resolvedAt || ""),
    resolution: String(entry.resolution || ""),
    managedBy: String(entry.managedBy || "auto-hermes-error-ledger"),
  };
}

function loadLedger(rootDir, ledgerPath) {
  const fullPath = resolveFromRoot(rootDir, ledgerPath || DEFAULT_ERROR_LEDGER);
  if (!fs.existsSync(fullPath)) {
    return {
      path: fullPath,
      payload: { version: 1, generatedAt: nowIso(), entries: [] },
      entries: [],
    };
  }

  const markdown = fs.readFileSync(fullPath, "utf8");
  const payload = extractLedgerPayload(markdown) || { version: 1, generatedAt: nowIso(), entries: [] };
  const entries = Array.isArray(payload.entries) ? payload.entries.map((entry) => normalizeEntry(entry, payload.generatedAt)) : [];
  return {
    path: fullPath,
    payload: { ...payload, entries },
    entries,
  };
}

function isOpen(entry) {
  return String(entry?.status || "").toLowerCase() === "open";
}

function requiresRepair(entry) {
  if (!isOpen(entry)) return false;
  const severity = String(entry?.severity || "").toLowerCase();
  const category = String(entry?.category || "").toLowerCase();
  return severity === "blocker" || severity === "error" || category === "blocker" || category === "error";
}

function summarize(entries) {
  const openEntries = entries.filter(isOpen);
  const repairRequiredEntries = entries.filter(requiresRepair);
  return {
    openCount: openEntries.length,
    repairRequiredCount: repairRequiredEntries.length,
    topRepair: repairRequiredEntries[0] || null,
  };
}

export function renderAutoHermesErrorLedgerBrief(entries = [], ledgerPath = DEFAULT_ERROR_LEDGER) {
  const state = summarize(Array.isArray(entries) ? entries : []);
  const lines = [
    `File: ${ledgerPath}`,
    `Open Entries: ${state.openCount}`,
    `Repair Required: ${state.repairRequiredCount}`,
  ];
  if (state.topRepair) {
    lines.push(`Top Repair: ${state.topRepair.id} ${state.topRepair.summary}`);
  }
  return lines;
}

function renderEntry(entry) {
  return [
    `### ${entry.id}`,
    `- Status: ${entry.status}`,
    `- Severity: ${entry.severity}`,
    `- Category: ${entry.category}`,
    `- Source: \`${entry.source}\``,
    `- Summary: ${entry.summary}`,
    entry.detail ? `- Detail: ${entry.detail}` : "",
    entry.repairAction ? `- Repair: ${entry.repairAction}` : "",
    `- First seen: ${entry.firstSeenAt}`,
    `- Last seen: ${entry.lastSeenAt}`,
    entry.resolvedAt ? `- Resolved: ${entry.resolvedAt}` : "",
  ].filter(Boolean).join("\n");
}

function renderMarkdown(payload, ledgerPath = DEFAULT_ERROR_LEDGER) {
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const openEntries = entries.filter(isOpen);
  const repairRequiredEntries = entries.filter(requiresRepair);
  const resolvedEntries = entries.filter((entry) => !isOpen(entry));
  return [
    "# Auto-Hermes Error Ledger",
    "",
    "Records failures while loading Auto-Hermes skills, repo-local files, plugin manifests, and related local workflow assets.",
    "",
    "<!-- AUTO-HERMES-ERROR-LEDGER",
    JSON.stringify(payload, null, 2),
    "AUTO-HERMES-ERROR-LEDGER -->",
    "",
    "## Round-End Repair Contract",
    "- Run `.tools/auto-hermes-error-ledger.mjs --scan --write` during `/auto-hermes` and `/auto-hermes-self` round close.",
    "- Repair open `blocker` and `error` entries before normal product-task continuation.",
    "- If a repair is not bounded inside the closing round, round-close must write a must-fix task that points back to this ledger.",
    "- `warn` entries are visible advisory load gaps; keep them open only when the manifest fallback is still intentional.",
    "",
    "## Open Errors",
    "",
    ...(openEntries.length ? openEntries.flatMap((entry) => [renderEntry(entry), ""]) : ["- none", ""]),
    "## Repair Required",
    "",
    ...(repairRequiredEntries.length ? repairRequiredEntries.map((entry) => `- ${entry.id}: ${entry.summary}`) : ["- none"]),
    "",
    "## Recently Resolved",
    ...(resolvedEntries.length ? resolvedEntries.slice(0, 5).map((entry) => `- ${entry.id}: ${entry.resolution || entry.summary}`) : ["- none"]),
    "",
  ].join("\n");
}

export function writeAutoHermesErrorLedger({
  rootDir = ROOT,
  ledgerPath = DEFAULT_ERROR_LEDGER,
  scan = true,
  write = false,
} = {}) {
  const loaded = loadLedger(rootDir, ledgerPath);
  const generatedAt = nowIso();
  const entries = loaded.entries.map((entry) => ({
    ...entry,
    lastSeenAt: scan && isOpen(entry) ? generatedAt : entry.lastSeenAt,
  }));
  const payload = {
    version: 1,
    generatedAt,
    entries,
  };
  const summary = summarize(entries);
  const repairRequiredEntries = entries.filter(requiresRepair);

  if (write) {
    fs.mkdirSync(path.dirname(loaded.path), { recursive: true });
    fs.writeFileSync(loaded.path, renderMarkdown(payload, ledgerPath), "utf8");
  }

  return {
    path: loaded.path,
    entries,
    summary,
    repairRequiredEntries,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = parseArgs(process.argv.slice(2));
  const state = writeAutoHermesErrorLedger({
    rootDir: ROOT,
    ledgerPath: args.ledgerPath,
    scan: args.scan,
    write: args.write,
  });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderAutoHermesErrorLedgerBrief(state.entries, args.ledgerPath).join("\n")}\n`);
  }
  if (args.failOnRepairRequired && state.repairRequiredEntries.length > 0) {
    process.exitCode = 1;
  }
}
