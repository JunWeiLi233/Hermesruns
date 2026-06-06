#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const SUSPICIOUS_BUTTON_TOKENS = [
  "debug",
  "test",
  "temp",
  "placeholder",
  "mock",
  "sample",
  "demo",
  "todo",
  "prototype",
];

const MATERIAL_LIGATURE_TOKENS = [
  "play_arrow",
  "calendar_today",
  "keyboard_double_arrow_left",
  "keyboard_double_arrow_right",
  "keyboard_double_arrow",
  "dashboard",
  "history",
  "flag",
  "insights",
  "speed",
  "distance",
  "neurology",
];

const INTERNAL_COPY_SUFFIXES = [
  "_label",
  "_surface_label",
  "_preview_label",
  "_kicker",
  "_subtitle",
  "_copy",
  "_desc",
  "_description",
  "_helper",
  "_hint",
  "_actions",
  "_reset",
  "_status",
  "_caption",
  "_eyebrow",
];

const SHELL_INVARIANTS = {
  "ProfileDashboard.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Analysis.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Runs.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Races.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Schedule.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Shoes.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "TodayRun.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Rewards.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "PredictionDetail.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Vo2MaxDetail.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Heatmap.jsx": {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    kind: "runner-shell",
  },
  "Landing.jsx": {
    forbidden: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle", "analysis-stitch-sidebar"],
    kind: "public-page",
  },
  "Login.jsx": {
    forbidden: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle", "analysis-stitch-sidebar"],
    kind: "public-page",
  },
  "Signup.jsx": {
    forbidden: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle", "analysis-stitch-sidebar"],
    kind: "public-page",
  },
};

const SEVERITY_RANK = {
  high: 3,
  medium: 2,
  low: 1,
};

function parseArgs(argv) {
  const args = {
    json: false,
    write: false,
    files: "",
    surface: "",
    task: "",
    outputJson: ".ai-sync/AUTO_HERMES_SELF_CHECK.json",
    outputMd: ".ai-sync/AUTO_HERMES_SELF_CHECK.md",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--write") args.write = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[++i] || args[key];
    }
  }

  return args;
}

function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
}

function splitFiles(value) {
  return String(value || "")
    .split("||")
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

function shouldScanFile(filePath) {
  return /\.(jsx|tsx|js|ts|css)$/i.test(filePath) && /frontend\//i.test(filePath.replace(/\\/g, "/"));
}

function toRelative(filePath) {
  if (!filePath) return "";
  const fullPath = resolveFromRoot(filePath);
  return path.relative(ROOT, fullPath).replace(/\\/g, "/");
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function compactSnippet(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function isInternalCopyKey(key) {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("stitch_")) return false;
  return INTERNAL_COPY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function collectMatches(pattern, text, handler) {
  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(handler(match));
  }
  return matches;
}

function scanFile(relativePath) {
  const findings = [];
  const normalizedPath = toRelative(relativePath);
  const fullPath = resolveFromRoot(relativePath);

  if (!fs.existsSync(fullPath) || !shouldScanFile(normalizedPath)) return findings;

  const text = fs.readFileSync(fullPath, "utf8");
  const basename = path.basename(normalizedPath);
  const invariant = SHELL_INVARIANTS[basename];

  const rawTranslationKeyPatterns = [
    /<(h1|h2)[^>]*>[\s\S]{0,220}?["'`]([a-z0-9_.]*stitch_[a-z0-9_.]+)["'`][\s\S]{0,220}?<\/\1>/gi,
    /(?:aria-label|title)\s*=\s*["'`]([a-z0-9_.]*stitch_[a-z0-9_.]+)["'`]/gi,
  ];

  for (const pattern of rawTranslationKeyPatterns) {
    findings.push(
      ...collectMatches(pattern, text, (match) => {
        const snippet = compactSnippet(match[0]);
        if (/\bt\s*\(\s*["'`][a-z0-9_.]*stitch_[a-z0-9_.]+["'`]\s*\)/i.test(snippet)) return null;
        return {
          kind: "raw-translation-key",
          severity: "high",
          file: normalizedPath,
          line: lineNumberAt(text, match.index),
          message: `Potential raw translation key may leak into visible UI: ${match[2] || match[1]}`,
          snippet,
        };
      }).filter(Boolean),
    );
  }

  const headingLiteralStitchPattern = /<(h1|h2)[^>]*>[\s\S]{0,120}?\bstitch\b[\s\S]{0,120}?<\/\1>/gi;
  findings.push(
    ...collectMatches(headingLiteralStitchPattern, text, (match) => ({
      kind: "stitch-title-literal",
      severity: "high",
      file: normalizedPath,
      line: lineNumberAt(text, match.index),
      message: "Literal 'stitch' copy appears inside a visible heading.",
      snippet: compactSnippet(match[0]),
    })),
  );

  const translatedHeadingPattern = /<h1[^>]*>[\s\S]{0,220}?t\(\s*["'`]([^"'`]*)["'`]\s*\)[\s\S]{0,220}?<\/h1>/gi;
  findings.push(
    ...collectMatches(translatedHeadingPattern, text, (match) => {
      const key = match[1];
      if (!isInternalCopyKey(key)) return null;
      return {
        kind: "internal-copy-title",
        severity: "high",
        file: normalizedPath,
        line: lineNumberAt(text, match.index),
        message: `Internal/helper copy key rendered as a real heading: ${key}`,
        snippet: compactSnippet(match[0]),
      };
    }).filter(Boolean),
  );

  const suspiciousButtonPattern = new RegExp(
    `<button\\b[\\s\\S]{0,320}?(?:>|aria-label=|title=)[\\s\\S]{0,160}?\\b(${SUSPICIOUS_BUTTON_TOKENS.join("|")})\\b[\\s\\S]{0,160}?<\\/button>`,
    "gi",
  );
  findings.push(
    ...collectMatches(suspiciousButtonPattern, text, (match) => ({
      kind: "debug-button",
      severity: "high",
      file: normalizedPath,
      line: lineNumberAt(text, match.index),
      message: `Suspicious button/debug token '${match[1]}' appears in visible button markup.`,
      snippet: compactSnippet(match[0]),
    })),
  );

  if (invariant?.required?.length) {
    for (const token of invariant.required) {
      if (text.includes(token)) continue;
      findings.push({
        kind: "missing-shell-invariant",
        severity: "high",
        file: normalizedPath,
        line: 1,
        message: `${basename} is missing required ${invariant.kind} marker '${token}'.`,
        snippet: token,
      });
    }
  }

  if (invariant?.forbidden?.length) {
    for (const token of invariant.forbidden) {
      const index = text.indexOf(token);
      if (index === -1) continue;
      findings.push({
        kind: "forbidden-shell-pattern",
        severity: invariant.kind === "public-page" ? "high" : "medium",
        file: normalizedPath,
        line: lineNumberAt(text, index),
        message: `${basename} contains forbidden ${invariant.kind} pattern '${token}'.`,
        snippet: compactSnippet(token),
      });
    }
  }

  const suspiciousLabelPattern = new RegExp(
    `(?:aria-label|title)\\s*=\\s*["'\`][^"'\\\`]{0,80}\\b(${SUSPICIOUS_BUTTON_TOKENS.join("|")})\\b[^"'\\\`]{0,80}["'\`]`,
    "gi",
  );
  findings.push(
    ...collectMatches(suspiciousLabelPattern, text, (match) => ({
      kind: "debug-label",
      severity: "medium",
      file: normalizedPath,
      line: lineNumberAt(text, match.index),
      message: `Suspicious debug-ish label '${match[1]}' appears in visible metadata.`,
      snippet: compactSnippet(match[0]),
    })),
  );

  const ligaturePattern = />([A-Z_]{4,}|[a-z]+_[a-z_]+)</g;
  findings.push(
    ...collectMatches(ligaturePattern, text, (match) => {
      const token = String(match[1] || "").trim();
      if (!MATERIAL_LIGATURE_TOKENS.includes(token.toLowerCase())) return null;
      return {
        kind: "raw-material-ligature",
        severity: token.includes("_") || token === token.toUpperCase() ? "high" : "medium",
        file: normalizedPath,
        line: lineNumberAt(text, match.index),
        message: `Raw Material Symbols ligature text may leak into the UI: ${token}`,
        snippet: compactSnippet(match[0]),
      };
    }).filter(Boolean),
  );

  const unique = [];
  const seen = new Set();
  for (const finding of findings) {
    const key = `${finding.kind}|${finding.file}|${finding.line}|${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }

  return unique;
}

function buildSummary(findings) {
  if (!findings.length) return "No self-check findings.";
  const strongest = [...findings].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
  return `${findings.length} self-check finding(s); strongest: ${strongest.message} (${strongest.file}:${strongest.line})`;
}

export function renderAutoHermesSelfCheckMarkdown(report) {
  const lines = [
    "# Auto-Hermes Self Check",
    "",
    `Generated: ${report.generatedAt}`,
    `Task: ${report.task || "none"}`,
    `Surface: ${report.surface || "none"}`,
    `Result: ${report.requiresFix ? "must-fix" : "clean"}`,
    `Summary: ${report.summary}`,
    "",
  ];

  if (!report.findings.length) {
    lines.push("No suspicious UI title/button/copy findings detected.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Findings");
  for (const finding of report.findings) {
    lines.push(
      `- [${finding.severity}] ${finding.message}`,
      `  File: ${finding.file}:${finding.line}`,
      `  Snippet: ${finding.snippet || "none"}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function runAutoHermesSelfCheck({ files = "", surface = "", task = "" } = {}) {
  const scannedFiles = splitFiles(files).map(toRelative).filter(shouldScanFile);
  const findings = scannedFiles.flatMap((file) => scanFile(file));
  return {
    generatedAt: new Date().toISOString(),
    task,
    surface,
    scannedFiles,
    findings,
    findingCount: findings.length,
    requiresFix: findings.length > 0,
    highestSeverity: findings.length
      ? [...findings].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0].severity
      : "none",
    summary: buildSummary(findings),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = runAutoHermesSelfCheck(args);

  if (args.write) {
    fs.writeFileSync(resolveFromRoot(args.outputJson), JSON.stringify(report, null, 2), "utf8");
    fs.writeFileSync(resolveFromRoot(args.outputMd), renderAutoHermesSelfCheckMarkdown(report), "utf8");
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderAutoHermesSelfCheckMarkdown(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
