#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_MANIFEST_PATH = ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json";
const DEFAULT_AGENTS_DIR = ".codex/agents";
const DEFAULT_SOURCE_REPO = "https://github.com/VoltAgent/awesome-codex-subagents";
const DEFAULT_MODE = "repo-local-codex-only";

function resolveAtRoot(rootDir, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
}

function inferRootDir(options = {}) {
  if (options.rootDir) return path.resolve(options.rootDir);
  if (options.tasksPath && path.isAbsolute(options.tasksPath) && path.basename(options.tasksPath).toLowerCase() === "tasks.md") {
    return path.dirname(options.tasksPath);
  }
  return ROOT;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function listTomlFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTomlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".toml")) {
      files.push(fullPath);
    }
  }
  return files;
}

function matchTomlField(content, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}\\s*=\\s*"([^"]+)"`, "m");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

export function repoNameFromInstalledName(installedName = "") {
  return String(installedName || "").replace(/^voltagent-/, "");
}

export function installedNameFromRepoName(repoName = "") {
  const trimmed = String(repoName || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("voltagent-") ? trimmed : `voltagent-${trimmed}`;
}

function normalizeCategory(raw = "") {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mergeManifestEntry(manifestEntry = {}, scannedEntry = {}) {
  return {
    repoName: manifestEntry.repoName || scannedEntry.repoName || "",
    installedName: manifestEntry.installedName || scannedEntry.installedName || "",
    category: normalizeCategory(manifestEntry.category || scannedEntry.category || ""),
    description: manifestEntry.description || scannedEntry.description || "",
    file: manifestEntry.file || scannedEntry.file || "",
    sourceRelativePath: manifestEntry.sourceRelativePath || scannedEntry.sourceRelativePath || "",
  };
}

function scanInstalledVoltAgentAgents({ rootDir, agentsDir }) {
  const agentFiles = listTomlFiles(agentsDir)
    .filter((filePath) => path.basename(filePath).startsWith("voltagent-"));

  return agentFiles.map((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const installedName = matchTomlField(content, "name") || path.basename(filePath, ".toml");
    return {
      repoName: repoNameFromInstalledName(installedName),
      installedName,
      category: "",
      description: matchTomlField(content, "description"),
      file: path.relative(rootDir, filePath).replace(/\\/g, "/"),
      sourceRelativePath: "",
    };
  });
}

export function loadVoltAgentCatalog(options = {}) {
  const rootDir = inferRootDir(options);
  const manifestPath = resolveAtRoot(rootDir, options.manifestPath || DEFAULT_MANIFEST_PATH);
  const agentsDir = resolveAtRoot(rootDir, options.agentsDir || DEFAULT_AGENTS_DIR);
  const manifest = readJson(manifestPath) || {};
  const scanned = scanInstalledVoltAgentAgents({ rootDir, agentsDir });
  const manifestEntries = Array.isArray(manifest.installedAgents) ? manifest.installedAgents : [];
  const mergedByName = new Map();

  for (const entry of scanned) {
    if (entry.installedName) mergedByName.set(entry.installedName, mergeManifestEntry({}, entry));
  }
  for (const entry of manifestEntries) {
    const installedName = installedNameFromRepoName(entry.installedName || entry.repoName);
    const existing = mergedByName.get(installedName) || {};
    mergedByName.set(installedName, mergeManifestEntry(entry, { ...existing, installedName }));
  }

  const installedAgents = [...mergedByName.values()]
    .filter((entry) => entry.installedName)
    .sort((a, b) => a.installedName.localeCompare(b.installedName));

  const installedNames = installedAgents.map((entry) => entry.installedName);

  return {
    rootDir,
    sourceRepo: manifest.sourceRepo || DEFAULT_SOURCE_REPO,
    mode: manifest.mode || DEFAULT_MODE,
    manifestPath,
    agentsDir,
    manifestExists: fs.existsSync(manifestPath),
    available: installedAgents.length > 0,
    installedAgents,
    installedNames,
    installedCount: installedAgents.length,
  };
}

function addRuleRecommendations(recommendations, candidates, reason, catalog, limit) {
  for (const repoName of candidates) {
    const installedName = installedNameFromRepoName(repoName);
    if (!catalog.installedNames.includes(installedName)) continue;
    if (recommendations.some((entry) => entry.installedName === installedName)) continue;
    recommendations.push({
      repoName,
      installedName,
      reason,
    });
    if (recommendations.length >= limit) return;
  }
}

export function recommendVoltAgentSpecialists({ task, classification, route, catalog, limit = 3 }) {
  const safeCatalog = catalog || loadVoltAgentCatalog();
  if (!safeCatalog.available) {
    return {
      recommended: [],
      notes: ["no repo-local VoltAgent Codex agents are installed for this workspace"],
    };
  }

  const combined = [
    task?.title || "",
    task?.context || "",
    task?.doneWhen || "",
    task?.verify || "",
    classification?.problemClass || "",
    route?.shape || "",
  ].join(" ").toLowerCase();

  const recommendations = [];

  if (classification?.broad || classification?.crossStack) {
    addRuleRecommendations(
      recommendations,
      ["agent-organizer", "pied-piper", "code-mapper"],
      "broad or cross-stack round could benefit from stronger coordination and ownership mapping",
      safeCatalog,
      limit,
    );
  }

  if (classification?.backendLogicGateRequired || classification?.touchesBackend) {
    addRuleRecommendations(
      recommendations,
      ["spring-boot-engineer", "java-architect", "sql-pro"],
      "backend-heavy round matches Spring/Java/data specialist coverage",
      safeCatalog,
      limit,
    );
  }

  if (classification?.frontendDesignGateRequired) {
    addRuleRecommendations(
      recommendations,
      ["react-specialist", "ui-designer", "ui-fixer"],
      "frontend design-review round matches React/UI specialist coverage",
      safeCatalog,
      limit,
    );
  } else if (classification?.touchesFrontend) {
    addRuleRecommendations(
      recommendations,
      ["react-specialist", "typescript-pro", "ui-fixer"],
      "frontend implementation round matches React/TypeScript specialist coverage",
      safeCatalog,
      limit,
    );
  }

  if (classification?.reviewSensitive) {
    addRuleRecommendations(
      recommendations,
      ["code-reviewer", "qa-expert"],
      "review-sensitive round can use extra correctness and QA pressure",
      safeCatalog,
      limit,
    );
  }

  if (/\bauth|security|billing|upload|session|oauth|stripe\b/.test(combined)) {
    addRuleRecommendations(
      recommendations,
      ["security-auditor"],
      "security-sensitive round can use an additional security specialist",
      safeCatalog,
      limit,
    );
  }

  if (classification?.touchesDocsOnly || /\bdocs|document|readme|framework|api|search|research\b/.test(combined)) {
    addRuleRecommendations(
      recommendations,
      ["docs-researcher", "search-specialist", "api-documenter"],
      "research or documentation-heavy round matches docs/search specialist coverage",
      safeCatalog,
      limit,
    );
  }

  return {
    recommended: recommendations.slice(0, limit),
    notes: recommendations.length
      ? recommendations.map((entry) => `${entry.installedName}: ${entry.reason}`)
      : ["repo-local VoltAgent catalog is installed, but no extra specialist rule matched this round"],
  };
}

function renderCatalogMarkdown(catalog) {
  return [
    "# Auto-Hermes VoltAgent Catalog",
    "",
    `Mode: ${catalog.mode}`,
    `Source Repo: ${catalog.sourceRepo}`,
    `Installed Count: ${catalog.installedCount}`,
    `Manifest Path: ${catalog.manifestPath}`,
    `Agents Dir: ${catalog.agentsDir}`,
    "",
    "Installed Agents:",
    ...(catalog.installedAgents.length
      ? catalog.installedAgents.map((entry) => `- ${entry.installedName} (${entry.repoName || "unknown"})`)
      : ["- none"]),
  ].join("\n") + "\n";
}

function main() {
  const catalog = loadVoltAgentCatalog({
    rootDir: process.argv[2] || ROOT,
  });
  process.stdout.write(renderCatalogMarkdown(catalog));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
