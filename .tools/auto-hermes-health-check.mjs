#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const STATE_FILES = {
  TASKS_MD: {
    path: "TASKS.md",
    type: "markdown",
    requiredSections: ["## Active Tasks", "## Suggested Next Tasks"],
    description: "Task queue",
  },
  AGENT_SYNC_MD: {
    path: ".ai-sync/AGENT_SYNC.md",
    type: "markdown",
    requiredSections: ["## Active Claims", "## Recently Completed"],
    description: "Agent coordination board",
  },
  CONTEXT_LEDGER_MD: {
    path: ".ai-sync/CONTEXT_LEDGER.md",
    type: "markdown",
    requiredSections: ["## Goal Stack", "## Surface Capsules"],
    description: "Context ledger",
  },
  LOOP_STATE_JSON: {
    path: ".ai-sync/AUTO_HERMES_LOOP_STATE.json",
    type: "json",
    schema: {
      loopId: "string",
      currentRound: "number",
      status: "string",
      resumable: "boolean",
    },
    description: "Loop state (JSON)",
  },
  HUMAN_LOOP_MD: {
    path: ".ai-sync/HUMAN_LOOP.md",
    type: "markdown",
    requiredSections: [],
    description: "Human gate",
  },
};

const FRESHNESS_DAYS = 7;

function resolvePath(relPath) {
  return path.resolve(ROOT, relPath);
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function readJsonFile(filePath) {
  const text = readTextFile(filePath);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return "PARSE_ERROR";
  }
}

function backupFile(filePath) {
  const backupDir = resolvePath(".ai-sync/backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const basename = path.basename(filePath);
  const backupPath = path.join(backupDir, `${timestamp}_${basename}`);
  try {
    const content = readTextFile(filePath);
    if (content !== null) {
      fs.writeFileSync(backupPath, content, "utf8");
      return backupPath;
    }
  } catch {}
  return null;
}

function getFileAgeDays(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs / (1000 * 60 * 60 * 24);
  } catch {
    return null;
  }
}

function checkMarkdownFile(key, config, options) {
  const filePath = resolvePath(config.path);
  const result = {
    key,
    path: config.path,
    description: config.description,
    exists: false,
    parseable: false,
    missingSections: [],
    stale: false,
    staleAgeDays: null,
    repaired: false,
    critical: false,
    messages: [],
  };

  const content = readTextFile(filePath);
  if (content === null) {
    result.exists = false;
    result.critical = true;
    result.messages.push(`File missing: ${config.path}`);
    return result;
  }

  result.exists = true;
  result.parseable = true;

  if (config.requiredSections.length > 0) {
    for (const section of config.requiredSections) {
      if (!content.includes(section)) {
        result.missingSections.push(section);
      }
    }
  }

  const ageDays = getFileAgeDays(filePath);
  result.staleAgeDays = ageDays;
  if (ageDays !== null && ageDays > FRESHNESS_DAYS) {
    result.stale = true;
  }

  if (result.missingSections.length > 0 && options.repair) {
    const backedUp = backupFile(filePath);
    if (backedUp) {
      result.messages.push(`Backed up to ${path.relative(ROOT, backedUp)} before repair.`);
    }
    let updated = content;
    for (const section of result.missingSections) {
      updated += `\n\n${section}\n\n`;
    }
    try {
      fs.writeFileSync(filePath, updated, "utf8");
      result.repaired = true;
      result.missingSections = [];
      result.messages.push(`Repaired: added missing sections.`);
    } catch (e) {
      result.critical = true;
      result.messages.push(`Failed to write repair: ${e.message}`);
    }
  } else if (result.missingSections.length > 0) {
    result.messages.push(`Missing sections: ${result.missingSections.join(", ")}`);
  }

  return result;
}

function checkJsonFile(key, config, options) {
  const filePath = resolvePath(config.path);
  const result = {
    key,
    path: config.path,
    description: config.description,
    exists: false,
    parseable: false,
    missingKeys: [],
    invalidTypes: [],
    stale: false,
    staleAgeDays: null,
    repaired: false,
    critical: false,
    messages: [],
  };

  const content = readTextFile(filePath);
  if (content === null) {
    result.exists = false;
    result.critical = true;
    result.messages.push(`File missing: ${config.path}`);
    return result;
  }

  const parsed = readJsonFile(filePath);
  if (parsed === "PARSE_ERROR") {
    result.exists = true;
    result.parseable = false;
    result.critical = true;
    result.messages.push(`JSON parse error in ${config.path}`);
    return result;
  }

  result.exists = true;
  result.parseable = true;

  const schema = config.schema || {};
  const defaults = {
    loopId: "",
    currentRound: 0,
    status: "idle",
    resumable: true,
    maxRounds: 24,
    stallCounter: 0,
    runawayCounter: 0,
    sameWorkUnitStreak: 0,
    lastWorkUnitSignature: null,
    roundHistory: [],
    evolveCycleCount: 0,
    lastEvolveRound: 0,
  };

  for (const [schemaKey, schemaType] of Object.entries(schema)) {
    if (!(schemaKey in parsed)) {
      result.missingKeys.push(schemaKey);
    } else {
      const actualType = typeof parsed[schemaKey];
      const expectedType = schemaType;
      if (expectedType === "number" && actualType !== "number") {
        result.invalidTypes.push(`${schemaKey}: expected ${expectedType}, got ${actualType}`);
      } else if (expectedType === "boolean" && actualType !== "boolean") {
        result.invalidTypes.push(`${schemaKey}: expected ${expectedType}, got ${actualType}`);
      } else if (expectedType === "string" && actualType !== "string") {
        result.invalidTypes.push(`${schemaKey}: expected ${expectedType}, got ${actualType}`);
      }
    }
  }

  const ageDays = getFileAgeDays(filePath);
  result.staleAgeDays = ageDays;
  if (ageDays !== null && ageDays > FRESHNESS_DAYS) {
    result.stale = true;
  }

  if ((result.missingKeys.length > 0 || result.invalidTypes.length > 0) && options.repair) {
    const backedUp = backupFile(filePath);
    if (backedUp) {
      result.messages.push(`Backed up to ${path.relative(ROOT, backedUp)} before repair.`);
    }
    const repaired = { ...parsed };
    for (const key of result.missingKeys) {
      if (key in defaults) {
        repaired[key] = defaults[key];
      } else {
        repaired[key] = schema[key] === "number" ? 0 : schema[key] === "boolean" ? false : schema[key] === "string" ? "" : null;
      }
    }
    for (const entry of result.invalidTypes) {
      const [keyRaw] = entry.split(":");
      const key = keyRaw.trim();
      if (key in defaults) {
        repaired[key] = defaults[key];
      } else if (schema[key] === "number") {
        repaired[key] = 0;
      } else if (schema[key] === "boolean") {
        repaired[key] = false;
      } else if (schema[key] === "string") {
        repaired[key] = "";
      }
    }
    try {
      fs.writeFileSync(filePath, JSON.stringify(repaired, null, 2) + "\n", "utf8");
      result.repaired = true;
      result.missingKeys = [];
      result.invalidTypes = [];
      result.messages.push(`Repaired: filled missing/invalid keys.`);
    } catch (e) {
      result.critical = true;
      result.messages.push(`Failed to write repair: ${e.message}`);
    }
  } else {
    if (result.missingKeys.length > 0) {
      result.messages.push(`Missing keys: ${result.missingKeys.join(", ")}`);
    }
    if (result.invalidTypes.length > 0) {
      result.messages.push(`Invalid types: ${result.invalidTypes.join("; ")}`);
    }
  }

  return result;
}

function checkReferentialIntegrity() {
  const findings = [];

  const tasksContent = readTextFile(resolvePath("TASKS.md"));
  if (tasksContent === null) {
    findings.push("Cannot check referential integrity: TASKS.md is missing.");
    return findings;
  }

  const syncContent = readTextFile(resolvePath(".ai-sync/AGENT_SYNC.md"));
  if (syncContent === null) {
    findings.push("Cannot check referential integrity: AGENT_SYNC.md is missing.");
    return findings;
  }

  const claimPattern = /^-\s+Key:\s+(.+)$/m;
  let match;
  const claims = [];
  const claimRegex = new RegExp(claimPattern.source, "gm");
  while ((match = claimRegex.exec(syncContent)) !== null) {
    claims.push(match[1].trim());
  }

  if (claims.length === 0) {
    return findings;
  }

  for (const claimKey of claims) {
    const taskBlockPattern = new RegExp(`- \\[.*\\].*\\b${escapeRegex(claimKey)}\\b`, "i");
    const simpleMentionPattern = new RegExp(escapeRegex(claimKey), "i");

    if (!simpleMentionPattern.test(tasksContent)) {
      findings.push(
        `Active claim "${claimKey}" in AGENT_SYNC.md has no matching task in TASKS.md.`
      );
    }
  }

  return findings;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkContextFreshness() {
  const findings = [];
  const ledgerPath = resolvePath(".ai-sync/CONTEXT_LEDGER.md");
  const content = readTextFile(ledgerPath);
  if (content === null) {
    findings.push("Cannot check freshness: CONTEXT_LEDGER.md is missing.");
    return findings;
  }

  const capsulePattern = /^###\s+(.+)$/gm;
  const capsuleStarts = [];
  let match;
  while ((match = capsulePattern.exec(content)) !== null) {
    capsuleStarts.push({ name: match[1].trim(), index: match.index });
  }

  for (let i = 0; i < capsuleStarts.length; i++) {
    const { name: capsuleName, index: startIdx } = capsuleStarts[i];
    const endIdx = i + 1 < capsuleStarts.length ? capsuleStarts[i + 1].index : content.length;
    const block = content.slice(startIdx, endIdx);

    const datePattern = /(?:Rollback Target:|Date:)\s*(.+)/i;
    const dateMatch = block.match(datePattern);

    if (dateMatch) {
      const dateStr = dateMatch[1].trim();
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        const ageDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > FRESHNESS_DAYS) {
          findings.push(
            `Context capsule "${capsuleName}" is ${Math.round(ageDays)} days old (threshold: ${FRESHNESS_DAYS} days).`
          );
        }
      }
    }
  }

  const ageDays = getFileAgeDays(ledgerPath);
  if (ageDays !== null && ageDays > FRESHNESS_DAYS) {
    findings.push(
      `CONTEXT_LEDGER.md file mtime is ${Math.round(ageDays)} days old (threshold: ${FRESHNESS_DAYS} days).`
    );
  }

  return findings;
}

export function runHealthCheck({ repair = false, write = false } = {}) {
  const checks = {};
  const repairs = [];
  const criticalIssues = [];

  for (const [key, config] of Object.entries(STATE_FILES)) {
    const checker = config.type === "json" ? checkJsonFile : checkMarkdownFile;
    const result = checker(key, config, { repair });
    checks[key] = result;

    if (result.repaired) {
      repairs.push({
        key,
        path: config.path,
        action: result.missingSections?.length > 0
          ? `Added sections: ${result.missingSections?.join(", ") || "N/A"}`
          : result.missingKeys?.length > 0
            ? `Filled keys: ${result.missingKeys?.join(", ") || "N/A"}`
            : "Repaired",
      });
    }

    if (result.critical) {
      criticalIssues.push({
        key,
        path: config.path,
        description: config.description,
        messages: result.messages,
      });
    }
  }

  const refFindings = checkReferentialIntegrity();
  const freshnessFindings = checkContextFreshness();

  const healthy =
    criticalIssues.length === 0 &&
    refFindings.length === 0 &&
    !Object.values(checks).some(
      (c) => !c.exists || !c.parseable || (c.missingSections?.length > 0) || (c.missingKeys?.length > 0) || (c.invalidTypes?.length > 0)
    );

  const report = {
    generatedAt: new Date().toISOString(),
    healthy,
    checks,
    referentialIntegrity: refFindings,
    freshness: freshnessFindings,
    repairs,
    criticalIssues,
  };

  if (write) {
    const outputPath = resolvePath(".ai-sync/AUTO_HERMES_HEALTH_CHECK.json");
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  }

  return report;
}

export function renderHealthCheckMarkdown(results) {
  const lines = [
    "# Auto-Hermes Health Check",
    "",
    `Generated: ${results.generatedAt}`,
    `Overall: ${results.healthy ? "HEALTHY" : "UNHEALTHY"}`,
    "",
  ];

  lines.push("## State File Checks");
  for (const [key, check] of Object.entries(results.checks)) {
    const status = check.exists
      ? check.parseable
        ? check.missingSections?.length > 0 || check.missingKeys?.length > 0 || check.invalidTypes?.length > 0
          ? "DEGRADED"
          : "OK"
        : "PARSE_ERROR"
      : "MISSING";
    lines.push(`- **${key}** (${check.description}): ${status}`);
    if (check.stale) {
      lines.push(`  - Stale: ${Math.round(check.staleAgeDays)} days old (threshold: ${FRESHNESS_DAYS})`);
    }
    for (const msg of check.messages || []) {
      lines.push(`  - ${msg}`);
    }
    if (check.repaired) {
      lines.push(`  - Repaired: yes`);
    }
  }
  lines.push("");

  if (results.referentialIntegrity.length > 0) {
    lines.push("## Referential Integrity");
    for (const finding of results.referentialIntegrity) {
      lines.push(`- ${finding}`);
    }
    lines.push("");
  }

  if (results.freshness.length > 0) {
    lines.push("## Freshness");
    for (const finding of results.freshness) {
      lines.push(`- ${finding}`);
    }
    lines.push("");
  }

  if (results.repairs.length > 0) {
    lines.push("## Repairs Applied");
    for (const repair of results.repairs) {
      lines.push(`- **${repair.key}**: ${repair.action}`);
    }
    lines.push("");
  }

  if (results.criticalIssues.length > 0) {
    lines.push("## Critical Issues");
    for (const issue of results.criticalIssues) {
      lines.push(`- **${issue.key}** (${issue.description}):`);
      for (const msg of issue.messages) {
        lines.push(`  - ${msg}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const repair = argv.includes("--repair");
  const write = argv.includes("--write");
  const quiet = argv.includes("--quiet");

  const results = runHealthCheck({ repair, write });

  if (!quiet) {
    if (argv.includes("--json")) {
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    } else {
      process.stdout.write(renderHealthCheckMarkdown(results) + "\n");
    }
  }

  process.exit(results.healthy ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main();
}