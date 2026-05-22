#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const RULE_LIBRARY = {
  "self-check-missed": "Before approving a frontend design round, run the self-check and treat repeated findings as must-fix.",
  "missing-runtime-proof": "When source changed but runtime proof is absent, report the round as unsynced instead of live.",
  "design-review": "Prefer a design-review branch for non-trivial frontend rounds instead of direct implementation.",
  "explicit-verify": "Keep explicit verify commands in the round packet and run them before completion claims.",
  "pm-builder-reviewer": "Prefer the PM -> builder -> reviewer structure for review-sensitive rounds.",
  "verify-before-claim": "Keep verification before any live or completion claim.",
  "must-fix": "Before continuing self-loop evolution, route repeated must-fix outcomes into a bounded repair round.",
};

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    rootDir: ROOT,
    roundsDir: ".ai-sync/trace-to-skill/rounds",
    outputJson: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json",
    outputMd: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md",
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

function resolveWithin(rootDir, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function compactKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizePacket(packet) {
  const generatedAt = packet?.generatedAt || nowIso();
  const roundId = packet?.roundId || `${generatedAt.slice(0, 10)}-${compactKey(packet?.task || packet?.surface || "round")}`;
  const verdict = String(packet?.verdict || "unknown").trim();
  const review = String(packet?.review || "").trim();
  const problemClass = String(packet?.problemClass || "unknown").trim();
  const routeShape = String(packet?.routeShape || "unknown").trim();
  const runtimeProof = String(packet?.runtimeProof || "").trim();
  const verify = String(packet?.verify || "").trim();
  const blocker = String(packet?.blocker || "").trim();
  const selfCheck = packet?.selfCheck && typeof packet.selfCheck === "object" ? packet.selfCheck : {};
  const evidence = packet?.evidence && typeof packet.evidence === "object" ? packet.evidence : {};

  return {
    ...packet,
    generatedAt,
    roundId,
    task: String(packet?.task || "").trim(),
    surface: String(packet?.surface || "").trim(),
    verdict,
    review,
    problemClass,
    routeShape,
    verify,
    runtimeProof,
    blocker,
    selfCheck: {
      requiresFix: Boolean(selfCheck.requiresFix),
      highestSeverity: String(selfCheck.highestSeverity || "none").trim(),
    },
    evidence: {
      successTags: toArray(evidence.successTags),
      failureTags: toArray(evidence.failureTags),
      edgeTags: toArray(evidence.edgeTags),
      structureTags: toArray(evidence.structureTags),
    },
  };
}

function readRoundPackets(rootDir, roundsDir) {
  const fullDir = resolveWithin(rootDir, roundsDir);
  if (!fs.existsSync(fullDir)) return [];
  return fs.readdirSync(fullDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      try {
        return normalizePacket(JSON.parse(fs.readFileSync(path.join(fullDir, name), "utf8")));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function countTags(packets, tagSelector) {
  const counts = new Map();
  for (const packet of packets) {
    for (const tag of tagSelector(packet)) {
      const current = counts.get(tag) || { count: 0, rounds: [] };
      current.count += 1;
      current.rounds.push(packet.roundId);
      counts.set(tag, current);
    }
  }
  return counts;
}

function buildRulesFromCounts(counts, kind, minimumEvidence = 2) {
  return [...counts.entries()]
    .filter(([, value]) => value.count >= minimumEvidence)
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .map(([tag, value]) => ({
      kind,
      tag,
      rule: RULE_LIBRARY[tag] || `Preserve repeated workflow behavior: ${tag}.`,
      evidenceCount: value.count,
      supportingRounds: value.rounds,
      priority: value.count >= 4 ? "high" : value.count >= 3 ? "medium" : "low",
    }));
}

function mergeRules(analystGroups) {
  const merged = new Map();
  for (const group of analystGroups) {
    for (const rule of group.rules) {
      const key = rule.rule;
      const current = merged.get(key) || {
        rule: rule.rule,
        evidenceCount: 0,
        supportingRounds: new Set(),
        sources: new Set(),
        status: "soft-signal",
      };
      current.evidenceCount += rule.evidenceCount;
      rule.supportingRounds.forEach((roundId) => current.supportingRounds.add(roundId));
      current.sources.add(group.name);
      merged.set(key, current);
    }
  }

  return [...merged.values()]
    .map((entry) => ({
      rule: entry.rule,
      evidenceCount: entry.evidenceCount,
      supportingRounds: [...entry.supportingRounds],
      sources: [...entry.sources],
      status: entry.evidenceCount >= 2 ? "soft-signal" : "informational",
    }))
    .sort((left, right) => right.evidenceCount - left.evidenceCount || left.rule.localeCompare(right.rule));
}

function toRelativeSkillPath(relPath) {
  return relPath.replace(/\\/g, "/");
}

function dedupeByRule(rules) {
  const seen = new Set();
  const result = [];
  for (const rule of rules) {
    const key = String(rule?.rule || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(rule);
  }
  return result;
}

function formatRuleEntry(rule) {
  return {
    rule: String(rule?.rule || "").trim(),
    evidenceCount: Number(rule?.evidenceCount || 0),
    supportingRounds: Array.isArray(rule?.supportingRounds) ? rule.supportingRounds : [],
    sources: Array.isArray(rule?.sources) ? rule.sources : [],
    status: String(rule?.status || "informational"),
  };
}

function buildEvolvedSkill(report) {
  const mergedRules = Array.isArray(report?.mergedRules) ? report.mergedRules.map(formatRuleEntry) : [];
  if (!mergedRules.length) {
    return {
      mode: "none",
      slug: "auto-hermes-evolved",
      path: ".codex/skills/auto-hermes-evolved/SKILL.md",
      summary: "No evidence-backed evolved skill available yet.",
      coreRules: [],
      guidanceRules: [],
      edgeRules: [],
      patterns: [],
      failureModes: [],
    };
  }

  const successLike = mergedRules.filter((rule) => rule.sources.some((source) => source === "successAnalyst" || source === "structureAnalyst"));
  const failureLike = mergedRules.filter((rule) => rule.sources.some((source) => source === "errorAnalyst" || source === "edgeAnalyst"));

  let coreRules = mergedRules.filter((rule) => rule.evidenceCount >= 8);
  let guidanceRules = mergedRules.filter((rule) => rule.evidenceCount >= 4 && rule.evidenceCount < 8);
  let edgeRules = mergedRules.filter((rule) => rule.evidenceCount >= 2 && rule.evidenceCount < 4);

  if (!coreRules.length) {
    coreRules = mergedRules.slice(0, 1);
    guidanceRules = guidanceRules.filter((rule) => rule.rule !== coreRules[0]?.rule);
    edgeRules = edgeRules.filter((rule) => rule.rule !== coreRules[0]?.rule);
  }

  const patterns = dedupeByRule((successLike.length ? successLike : mergedRules).slice(0, 4))
    .map((rule) => rule.rule);
  const failureModes = dedupeByRule((failureLike.length ? failureLike : mergedRules.slice(1)).slice(0, 4))
    .map((rule) => `If repeated trace evidence shows "${rule.rule}", treat it as a preventive guardrail instead of incidental noise.`);

  return {
    mode: "repo-local-auto",
    slug: "auto-hermes-evolved",
    path: ".codex/skills/auto-hermes-evolved/SKILL.md",
    summary: `Auto-synthesized from ${report.totalRounds} trace-backed auto-hermes rounds.`,
    coreRules: coreRules.map(formatRuleEntry),
    guidanceRules: guidanceRules.map(formatRuleEntry),
    edgeRules: edgeRules.map(formatRuleEntry),
    patterns,
    failureModes,
  };
}

function renderRuleList(rules) {
  if (!rules.length) return ["- none"];
  return rules.flatMap((rule) => [
    `- ${rule.rule}`,
    `  Evidence: ${rule.evidenceCount} (${rule.supportingRounds.join(", ") || "none"})`,
  ]);
}

function renderEvolvedSkillMarkdown(evolvedSkill) {
  const lines = [
    "---",
    "name: auto-hermes-evolved",
    "description: Automatically synthesized advisory skill for /auto-hermes based on repeated repo-side execution traces.",
    "---",
    "",
    "# Auto-Hermes Evolved Skill",
    "",
    `Summary: ${evolvedSkill.summary}`,
    "",
    "Use this skill as advisory guidance inside `/auto-hermes` rounds. It does not override AGENTS.md, runtime proof gates, or owning workflow docs.",
    "",
    "## Core Rules",
    ...renderRuleList(evolvedSkill.coreRules),
    "",
    "## Guidance Rules",
    ...renderRuleList(evolvedSkill.guidanceRules),
    "",
    "## Repeatable Patterns",
    ...(evolvedSkill.patterns.length ? evolvedSkill.patterns.map((pattern) => `- ${pattern}`) : ["- none"]),
    "",
    "## Failure Modes",
    ...(evolvedSkill.failureModes.length ? evolvedSkill.failureModes.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "## Usage Notes",
    "- Advisory only: prefer current tool output, runtime proof, and owning docs when facts conflict.",
    "- Generated repo-side from `.ai-sync/trace-to-skill/rounds/*.json` and refreshed by `.tools/auto-hermes-trace-to-skill.mjs`.",
  ];
  return `${lines.join("\n")}\n`;
}

function renderEdgeCasesMarkdown(evolvedSkill) {
  const lines = [
    "# Auto-Hermes Evolved Edge Cases",
    "",
    `Generated: ${nowIso()}`,
    "",
    "These lower-confidence rules stay in references until stronger repeated evidence promotes them.",
    "",
    ...renderRuleList(evolvedSkill.edgeRules),
  ];
  return `${lines.join("\n")}\n`;
}

function writeEvolvedSkillArtifacts(rootDir, evolvedSkill) {
  if (!evolvedSkill || evolvedSkill.mode !== "repo-local-auto") return null;

  const skillPath = resolveWithin(rootDir, evolvedSkill.path);
  const referencesPath = resolveWithin(rootDir, ".codex/skills/auto-hermes-evolved/references/edge-cases.md");
  ensureParent(skillPath);
  ensureParent(referencesPath);
  fs.writeFileSync(skillPath, renderEvolvedSkillMarkdown(evolvedSkill), "utf8");
  fs.writeFileSync(referencesPath, renderEdgeCasesMarkdown(evolvedSkill), "utf8");

  return {
    skillPath,
    referencesPath,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Auto-Hermes Trace To Skill",
    "",
    `Generated: ${report.generatedAt}`,
    `Total Rounds: ${report.totalRounds}`,
    `Summary: ${report.summary}`,
    "",
  ];

  const sections = [
    ["Error Analyst", report.errorAnalyst.rules],
    ["Success Analyst", report.successAnalyst.rules],
    ["Structure Analyst", report.structureAnalyst.rules],
    ["Edge Analyst", report.edgeAnalyst.rules],
  ];

  for (const [title, rules] of sections) {
    lines.push(`## ${title}`);
    if (!rules.length) {
      lines.push("- none", "");
      continue;
    }
    for (const rule of rules) {
      lines.push(`- ${rule.rule}`);
      lines.push(`  Evidence: ${rule.evidenceCount} (${rule.supportingRounds.join(", ")})`);
    }
    lines.push("");
  }

  lines.push("## Merged Rules");
  if (!report.mergedRules.length) {
    lines.push("- none");
  } else {
    for (const rule of report.mergedRules) {
      lines.push(`- [${rule.status}] ${rule.rule}`);
      lines.push(`  Evidence: ${rule.evidenceCount} (${rule.supportingRounds.join(", ")})`);
      lines.push(`  Sources: ${rule.sources.join(", ")}`);
    }
  }

  lines.push("", "## Evolved Skill");
  if (!report.evolvedSkill || report.evolvedSkill.mode === "none") {
    lines.push("- none");
  } else {
    lines.push(`- mode: ${report.evolvedSkill.mode}`);
    lines.push(`- slug: ${report.evolvedSkill.slug}`);
    lines.push(`- path: ${toRelativeSkillPath(report.evolvedSkill.path)}`);
    lines.push(`- summary: ${report.evolvedSkill.summary}`);
    lines.push(`- core rules: ${report.evolvedSkill.coreRules.length}`);
    lines.push(`- guidance rules: ${report.evolvedSkill.guidanceRules.length}`);
    lines.push(`- edge rules: ${report.evolvedSkill.edgeRules.length}`);
  }

  return `${lines.join("\n")}\n`;
}

export function runAutoHermesTraceToSkill(rawArgs = {}) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  const rootDir = path.resolve(args.rootDir || ROOT);
  const packets = readRoundPackets(rootDir, args.roundsDir);
  const passPackets = packets.filter((packet) => packet.verdict === "pass");
  const nonPassPackets = packets.filter((packet) => packet.verdict !== "pass");

  const errorAnalyst = {
    name: "errorAnalyst",
    rules: buildRulesFromCounts(countTags(nonPassPackets, (packet) => packet.evidence.failureTags), "error"),
  };
  const successAnalyst = {
    name: "successAnalyst",
    rules: buildRulesFromCounts(countTags(passPackets, (packet) => packet.evidence.successTags), "success"),
  };
  const structureAnalyst = {
    name: "structureAnalyst",
    rules: buildRulesFromCounts(countTags(packets, (packet) => packet.evidence.structureTags), "structure"),
  };
  const edgeAnalyst = {
    name: "edgeAnalyst",
    rules: buildRulesFromCounts(countTags(nonPassPackets, (packet) => packet.evidence.edgeTags), "edge"),
  };

  const mergedRules = mergeRules([errorAnalyst, successAnalyst, structureAnalyst, edgeAnalyst]);
  const evolvedSkill = buildEvolvedSkill({
    totalRounds: packets.length,
    mergedRules,
  });
  const report = {
    generatedAt: nowIso(),
    totalRounds: packets.length,
    errorAnalyst,
    successAnalyst,
    structureAnalyst,
    edgeAnalyst,
    mergedRules,
    evolvedSkill,
    summary: mergedRules.length
      ? `${mergedRules.length} evidence-backed workflow candidates available as a soft signal.`
      : "No evidence-backed workflow candidates yet.",
  };

  if (args.write) {
    const outputJson = resolveWithin(rootDir, args.outputJson);
    const outputMd = resolveWithin(rootDir, args.outputMd);
    ensureParent(outputJson);
    ensureParent(outputMd);
    writeEvolvedSkillArtifacts(rootDir, evolvedSkill);
    fs.writeFileSync(outputJson, JSON.stringify(report, null, 2), "utf8");
    fs.writeFileSync(outputMd, renderMarkdown(report), "utf8");
  }

  return { report, markdown: renderMarkdown(report) };
}

export function writeTracePacketArtifacts({
  rootDir = ROOT,
  packet,
  roundsDir = ".ai-sync/trace-to-skill/rounds",
  outputJson = ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json",
  outputMd = ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md",
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const normalizedPacket = normalizePacket(packet || {});
  const fullRoundsDir = resolveWithin(absoluteRoot, roundsDir);
  fs.mkdirSync(fullRoundsDir, { recursive: true });
  const packetPath = path.join(fullRoundsDir, `${normalizedPacket.roundId}.json`);
  fs.writeFileSync(packetPath, JSON.stringify(normalizedPacket, null, 2), "utf8");

  const { report, markdown } = runAutoHermesTraceToSkill({
    rootDir: absoluteRoot,
    roundsDir,
    outputJson,
    outputMd,
    write: true,
  });

  return {
    packetPath,
    report,
    markdown,
    outputJson: resolveWithin(absoluteRoot, outputJson),
    outputMd: resolveWithin(absoluteRoot, outputMd),
  };
}

function main() {
  const { report, markdown } = runAutoHermesTraceToSkill(process.argv.slice(2));
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(markdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
