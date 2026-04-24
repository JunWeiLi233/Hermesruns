#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = import.meta.dirname
  ? path.resolve(import.meta.dirname, "..")
  : path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const SHARED_CONTRACT_FILES = [
  "frontend/src/i18n/translations.js",
  "frontend/src/App.jsx",
  "backend/src/main/resources/application.properties",
  "backend/pom.xml",
  "frontend/package.json",
];

const PRODUCT_PREFIXES = [
  "frontend/src/",
  "backend/src/",
  "frontend/public/",
  "backend/src/main/resources/",
];

function isProductFile(filePath) {
  return PRODUCT_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function isSharedContract(filePath) {
  return SHARED_CONTRACT_FILES.includes(filePath.replace(/\\/g, "/"));
}

function git(...args) {
  try {
    const result = execFileSync("git", args, {
      cwd: ROOT,
      timeout: 30000,
      encoding: "utf-8",
    });
    return { ok: true, stdout: result.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function evaluateRollback(fromCommit, options = {}) {
  const maxFiles = options.maxFiles ?? 5;

  if (!fromCommit) {
    return { canAutoRevert: false, reason: "no from commit" };
  }

  const headResult = git("rev-parse", "HEAD");
  if (!headResult.ok) {
    return { canAutoRevert: false, reason: `git rev-parse failed: ${headResult.error}` };
  }
  const currentHead = headResult.stdout;

  const resolvedFrom = git("rev-parse", fromCommit);
  const fromHash = resolvedFrom.ok ? resolvedFrom.stdout : fromCommit;

  if (fromHash === currentHead) {
    return {
      canAutoRevert: false,
      reason: "from commit equals HEAD, nothing to revert",
      fromCommit: fromHash,
      currentHead,
    };
  }

  const diffResult = git("diff", "--name-only", `${fromCommit}..HEAD`);
  if (!diffResult.ok) {
    return { canAutoRevert: false, reason: `git diff failed: ${diffResult.error}` };
  }

  const changedFiles = diffResult.stdout
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  if (changedFiles.length === 0) {
    return {
      canAutoRevert: false,
      reason: "no changed files between from commit and HEAD",
      changedFiles: [],
      fromCommit: fromHash,
      currentHead,
    };
  }

  const nonProductFiles = changedFiles.filter((f) => !isProductFile(f));
  const contractFiles = changedFiles.filter((f) => isSharedContract(f));

  if (changedFiles.length > maxFiles) {
    return {
      canAutoRevert: false,
      reason: `too many changed files (${changedFiles.length} > max ${maxFiles}), manual review recommended`,
      changedFiles,
      fromCommit: fromHash,
      currentHead,
      suggestion: "manual-review",
    };
  }

  if (nonProductFiles.length > 0) {
    return {
      canAutoRevert: false,
      reason: `non-product files would be affected: ${nonProductFiles.join(", ")}`,
      changedFiles,
      fromCommit: fromHash,
      currentHead,
      suggestion: "manual-review",
    };
  }

  if (contractFiles.length > 0) {
    return {
      canAutoRevert: false,
      reason: `shared contract files would be affected: ${contractFiles.join(", ")}`,
      changedFiles,
      fromCommit: fromHash,
      currentHead,
      suggestion: "manual-review",
    };
  }

  return {
    canAutoRevert: true,
    reason: `safe to auto-revert ${changedFiles.length} product file(s)`,
    changedFiles,
    fromCommit: fromHash,
    currentHead,
  };
}

function executeRollback(fromCommit, changedFiles) {
  if (!fromCommit) {
    return { success: false, error: "no from commit provided" };
  }
  if (!changedFiles || changedFiles.length === 0) {
    return { success: false, error: "no files to revert" };
  }

  const result = git("checkout", fromCommit, "--", ...changedFiles);
  if (!result.ok) {
    return { success: false, fromCommit, error: result.error };
  }

  return {
    success: true,
    revertedFiles: changedFiles,
    fromCommit,
  };
}

function parseArgs(argv) {
  const args = { from: "", dryRun: false, write: false };
  for (const arg of argv) {
    if (arg.startsWith("--from=")) {
      args.from = arg.slice("--from=".length);
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--write") {
      args.write = true;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.from) {
    console.error('Usage: node .tools/auto-hermes-rollback.mjs --from=<commit-hash> [--dry-run] [--write]');
    console.error('');
    console.error('  --from=<hash>   Commit to roll back to');
    console.error('  --dry-run       Evaluate safety without making changes (default)');
    console.error('  --write         Actually execute the rollback');
    process.exit(1);
  }

  const evaluation = evaluateRollback(args.from);

  if (args.dryRun || !args.write) {
    console.log(JSON.stringify(evaluation, null, 2));
    if (!evaluation.canAutoRevert) {
      process.exit(0);
    }
    console.log("\nDry run: no changes made. Use --write to execute the rollback.");
    return;
  }

  if (!evaluation.canAutoRevert) {
    console.log(JSON.stringify(evaluation, null, 2));
    process.exit(1);
  }

  const result = executeRollback(args.from, evaluation.changedFiles);
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exit(1);
  }
}

export { evaluateRollback, executeRollback, isProductFile, isSharedContract, SHARED_CONTRACT_FILES };

const scriptPath = path.resolve(process.argv[1] || "");
const modulePath = fileURLToPath(import.meta.url);
if (scriptPath && (scriptPath === modulePath || scriptPath === path.resolve(ROOT, ".tools", "auto-hermes-rollback.mjs"))) {
  main();
}