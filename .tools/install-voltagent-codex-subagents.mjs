#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installedNameFromRepoName } from "./auto-hermes-subagent-catalog.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_SOURCE_REPO = "https://github.com/VoltAgent/awesome-codex-subagents";
const DEFAULT_CACHE_DIR = ".ai-sync/voltagent-codex-subagents";
const DEFAULT_AGENTS_DIR = ".codex/agents";
const DEFAULT_MANIFEST_PATH = ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json";
const DEFAULT_MODE = "repo-local-codex-only";

function resolveAtRoot(rootDir, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
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

function rewriteAgentToml(content, installedName, sourceRelativePath) {
  const sourceComment = `# Installed from VoltAgent/awesome-codex-subagents\n# Source: ${sourceRelativePath}\n`;
  const rewritten = /^name\s*=\s*"[^"]*"/m.test(content)
    ? content.replace(/^name\s*=\s*"[^"]*"/m, `name = "${installedName}"`)
    : `name = "${installedName}"\n${content}`;
  return `${sourceComment}${rewritten}`;
}

function collectCatalogTomls(cacheDir) {
  return listTomlFiles(cacheDir)
    .filter((filePath) => filePath.includes(`${path.sep}categories${path.sep}`))
    .sort((a, b) => a.localeCompare(b));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function repoNameFromFile(filePath) {
  return path.basename(filePath, ".toml");
}

function categoryFromFile(cacheDir, filePath) {
  const rel = path.relative(cacheDir, filePath).replace(/\\/g, "/");
  const parts = rel.split("/");
  return parts.length >= 3 ? parts[1] : "";
}

function syncRepo({ cacheDir, sourceRepo, refreshRepo }) {
  if (!refreshRepo) return;

  const gitDir = path.join(cacheDir, ".git");
  ensureDir(path.dirname(cacheDir));

  if (!fs.existsSync(gitDir)) {
    execFileSync("git", ["clone", "--depth", "1", sourceRepo, cacheDir], {
      cwd: ROOT,
      stdio: "inherit",
    });
    return;
  }

  execFileSync("git", ["-C", cacheDir, "pull", "--ff-only"], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

export function syncVoltAgentCodexAgents(options = {}) {
  const rootDir = path.resolve(options.rootDir || ROOT);
  const sourceRepo = options.sourceRepo || DEFAULT_SOURCE_REPO;
  const cacheDir = resolveAtRoot(rootDir, options.cacheDir || DEFAULT_CACHE_DIR);
  const agentsDir = resolveAtRoot(rootDir, options.agentsDir || DEFAULT_AGENTS_DIR);
  const manifestPath = resolveAtRoot(rootDir, options.manifestPath || DEFAULT_MANIFEST_PATH);
  const mode = DEFAULT_MODE;
  const refreshRepo = options.refreshRepo !== false;

  syncRepo({ cacheDir, sourceRepo, refreshRepo });

  ensureDir(agentsDir);
  ensureDir(path.dirname(manifestPath));

  const catalogTomls = collectCatalogTomls(cacheDir);
  const installedAgents = [];

  for (const filePath of catalogTomls) {
    const repoName = repoNameFromFile(filePath);
    const installedName = installedNameFromRepoName(repoName);
    const sourceRelativePath = path.relative(cacheDir, filePath).replace(/\\/g, "/");
    const targetPath = path.join(agentsDir, `${installedName}.toml`);
    const original = fs.readFileSync(filePath, "utf8");
    const rewritten = rewriteAgentToml(original, installedName, sourceRelativePath);
    fs.writeFileSync(targetPath, rewritten, "utf8");
    installedAgents.push({
      repoName,
      installedName,
      category: categoryFromFile(cacheDir, filePath),
      description: (original.match(/^description\s*=\s*"([^"]+)"/m) || [])[1] || "",
      file: path.relative(rootDir, targetPath).replace(/\\/g, "/"),
      sourceRelativePath,
    });
  }

  const manifest = {
    sourceRepo,
    mode,
    updatedAt: new Date().toISOString(),
    cacheDir: path.relative(rootDir, cacheDir).replace(/\\/g, "/"),
    agentsDir: path.relative(rootDir, agentsDir).replace(/\\/g, "/"),
    installedAgents,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  return {
    rootDir,
    sourceRepo,
    mode,
    cacheDir,
    agentsDir,
    manifestPath,
    installedAgents,
  };
}

function parseArgs(argv) {
  const args = {
    rootDir: ROOT,
    sourceRepo: DEFAULT_SOURCE_REPO,
    cacheDir: DEFAULT_CACHE_DIR,
    agentsDir: DEFAULT_AGENTS_DIR,
    manifestPath: DEFAULT_MANIFEST_PATH,
    refreshRepo: true,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root-dir") args.rootDir = argv[++i] || args.rootDir;
    else if (arg === "--source-repo") args.sourceRepo = argv[++i] || args.sourceRepo;
    else if (arg === "--cache-dir") args.cacheDir = argv[++i] || args.cacheDir;
    else if (arg === "--agents-dir") args.agentsDir = argv[++i] || args.agentsDir;
    else if (arg === "--manifest-path") args.manifestPath = argv[++i] || args.manifestPath;
    else if (arg === "--no-refresh") args.refreshRepo = false;
    else if (arg === "--json") args.json = true;
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = syncVoltAgentCodexAgents(args);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write([
    "# VoltAgent Codex Subagent Sync",
    "",
    `Mode: ${result.mode}`,
    `Source Repo: ${result.sourceRepo}`,
    `Installed Agents: ${result.installedAgents.length}`,
    `Agents Dir: ${result.agentsDir}`,
    `Manifest Path: ${result.manifestPath}`,
  ].join("\n") + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
