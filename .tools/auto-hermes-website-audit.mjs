#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function resolveFromRoot(rootDir, relPath) {
  const baseDir = path.resolve(String(rootDir || ROOT));
  return path.isAbsolute(relPath) ? relPath : path.resolve(baseDir, relPath);
}

function inferRepoRoot(rootDir) {
  const resolved = path.resolve(String(rootDir || ROOT));
  const parts = resolved.split(path.sep);
  const worktreesIndex = parts.lastIndexOf(".worktrees");
  if (worktreesIndex > 0) {
    return parts.slice(0, worktreesIndex).join(path.sep);
  }
  return resolved;
}

function shouldInferSharedInputs(rootDir) {
  const normalized = path.resolve(String(rootDir || ROOT));
  return normalized.split(path.sep).includes(".worktrees");
}

function candidateInputRoots(rootDir) {
  const resolvedRoot = path.resolve(String(rootDir || ROOT));
  const roots = [resolvedRoot];
  if (shouldInferSharedInputs(resolvedRoot)) {
    const repoRoot = inferRepoRoot(resolvedRoot);
    if (repoRoot && repoRoot !== resolvedRoot) roots.push(repoRoot);
  }
  return roots;
}

function resolveSharedInputPath(rootDir, relPath) {
  if (!relPath) return null;
  if (path.isAbsolute(relPath)) {
    return fs.existsSync(relPath) ? relPath : null;
  }

  for (const baseDir of candidateInputRoots(rootDir)) {
    const fullPath = path.resolve(baseDir, relPath);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return null;
}

function readOptional(rootDir, relPath) {
  const fullPath = resolveSharedInputPath(rootDir, relPath);
  if (!fullPath) {
    return { text: "", path: "", status: "missing" };
  }

  try {
    return {
      text: fs.readFileSync(fullPath, "utf8"),
      path: fullPath,
      status: "present",
    };
  } catch {
    return { text: "", path: fullPath, status: "missing" };
  }
}

function relativeFile(rootDir, filePath) {
  return path.relative(path.resolve(String(rootDir || ROOT)), filePath).replace(/\\/g, "/");
}

function parseArgs(argv) {
  const args = {
    json: false,
    write: false,
    rootDir: ROOT,
    tasks: "TASKS.md",
    product: "PRODUCT.md",
    contextLedger: ".ai-sync/CONTEXT_LEDGER.md",
    pagesIndex: ".ai-codex/pages.md",
    outputJson: ".ai-sync/AUTO_HERMES_WEBSITE_AUDIT.json",
    outputMd: ".ai-sync/AUTO_HERMES_WEBSITE_AUDIT.md",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--root-dir") args.rootDir = argv[++i] || args.rootDir;
    else if (arg === "--tasks") args.tasks = argv[++i] || args.tasks;
    else if (arg === "--product") args.product = argv[++i] || args.product;
    else if (arg === "--context-ledger") args.contextLedger = argv[++i] || args.contextLedger;
    else if (arg === "--pages-index") args.pagesIndex = argv[++i] || args.pagesIndex;
    else if (arg === "--output-json") args.outputJson = argv[++i] || args.outputJson;
    else if (arg === "--output-md") args.outputMd = argv[++i] || args.outputMd;
  }

  return args;
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .replace(/[’']s\b/gi, "")
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

function labelToScreenName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw
    .replace(/[’']s\b/gi, "")
    .replace(/[’']/g, "")
    .replace(/\bpage\b/gi, "")
    .trim();

  const words = normalized.match(/[A-Za-z0-9]+/g) || [];
  return words
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function screenKey(value) {
  return normalizeKey(labelToScreenName(value));
}

function stripMarkdownFormatting(value) {
  return String(value || "")
    .trim()
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^`(.+)`$/, "$1")
    .replace(/^\[(.+)\]$/, "$1")
    .trim();
}

function splitTableCells(line) {
  return String(line || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => stripMarkdownFormatting(cell.trim()));
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(String(line || ""));
}

function isLikelyHeaderRow(cells) {
  const normalized = cells.map((cell) => stripMarkdownFormatting(cell).toLowerCase());
  const isSimpleHeader = normalized.length > 0 && normalized.every((cell) => /^(screen|surface|page|label|display|goal|purpose|intent|description|file|path|success looks like|build when|product intent)$/i.test(cell));
  const isProductIntentHeader =
    normalized.length >= 3 &&
    normalized[0] === "screen" &&
    normalized[1] === "product intent" &&
    normalized[2] === "success looks like";
  return isSimpleHeader || isProductIntentHeader;
}

function extractSection(text, heading) {
  const lines = String(text || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return "";

  const block = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    block.push(lines[i]);
  }
  return block.join("\n").trim();
}

function hasQueuedTasks(tasksText) {
  return /^\s*-\s*\[\s*]\s+/m.test(String(tasksText || ""));
}

function extractProductIntentSection(productText) {
  const preferredHeadings = [
    "Screen-by-Screen Product Intent",
    "Screen Intent",
    "Screen table",
    "Product Intent",
  ];

  for (const heading of preferredHeadings) {
    const section = extractSection(productText, heading);
    if (section) return section;
  }

  return "";
}

function parseProductTableRows(sectionText) {
  const lines = String(sectionText || "").split(/\r?\n/);
  const entries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || !line.includes("|")) continue;

    const cells = splitTableCells(line);
    if (cells.length < 2) continue;

    const nextLine = lines[index + 1] || "";
    if (!isTableSeparator(nextLine)) continue;
    if (isLikelyHeaderRow(cells)) {
      const headerCells = cells.map((cell) => cell.toLowerCase());
      for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
        const rowLine = lines[rowIndex].trim();
        if (!rowLine) break;
        if (!rowLine.includes("|")) break;
        if (isTableSeparator(rowLine)) continue;

        const rowCells = splitTableCells(rowLine);
        if (rowCells.length < 2) continue;

        const row = {};
        for (let cellIndex = 0; cellIndex < headerCells.length && cellIndex < rowCells.length; cellIndex += 1) {
          row[headerCells[cellIndex]] = rowCells[cellIndex];
        }

        const displayLabel = stripMarkdownFormatting(
          row.screen ||
          row.surface ||
          row.label ||
          row.display ||
          row["display label"] ||
          row["surface name"] ||
          rowCells[0],
        );
        const pagePath = [row.file, row.path, row.page, row["page file"]]
          .map((value) => String(value || "").trim())
          .find((value) => /frontend\/src\/pages\/.+\.(jsx|tsx|js|ts)$/i.test(value)) || "";
        const description = [row.goal, row.intent, row.purpose, row.description, row.note, row["success looks like"]]
          .map((value) => String(value || "").trim())
          .find(Boolean) || rowCells.slice(1).filter(Boolean).join(" | ");

        if (!displayLabel && !pagePath) continue;
        entries.push({
          label: displayLabel,
          displayLabel,
          screen: labelToScreenName(displayLabel || pagePath),
          key: screenKey(displayLabel || pagePath),
          description: String(description || "").trim(),
          pagePath,
          source: "table",
        });
      }
      break;
    }
  }

  return entries;
}

function parseProductBullets(sectionText) {
  const entries = [];
  for (const line of String(sectionText || "").split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*(.+?)\s*:\s*(.+)$/);
    if (!match) continue;
    const label = stripMarkdownFormatting(match[1]);
    const description = stripMarkdownFormatting(match[2]);
    if (!label || !description) continue;
    if (/^(who|tools today|tier|label|screen|product intent|success looks like)$/i.test(label)) continue;
    entries.push({
      label,
      displayLabel: label,
      screen: labelToScreenName(label),
      key: screenKey(label),
      description,
      pagePath: "",
      source: "bullet",
    });
  }
  return entries;
}

function parseProductScreens(productText) {
  const section = extractProductIntentSection(productText);
  const tableEntries = parseProductTableRows(section);
  if (tableEntries.length) return tableEntries;
  return parseProductBullets(section);
}

function guessPageFile(rootDir, screenName) {
  const base = path.resolve(String(rootDir || ROOT), "frontend/src/pages");
  const normalizedScreen = labelToScreenName(screenName);
  const candidates = [
    `${normalizedScreen}.jsx`,
    `${normalizedScreen}.tsx`,
    `${normalizedScreen}.js`,
    `${normalizedScreen}.ts`,
  ];

  for (const fileName of candidates) {
    const fullPath = path.join(base, fileName);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return path.join(base, `${normalizedScreen || screenName}.jsx`);
}

function parsePagesIndex(rootDir, pagesText) {
  const entries = [];
  const lines = String(pagesText || "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const explicit = trimmed.match(/^(.+?)\s*->\s*(.+)$/);
    if (explicit) {
      const screen = explicit[1].trim();
      const relPath = explicit[2].trim();
      entries.push({
        screen,
        displayLabel: screen,
        key: screenKey(screen),
        file: resolveFromRoot(rootDir, relPath),
        source: "explicit",
      });
      continue;
    }

    const tableMatch = trimmed.match(/^\|(.+)\|$/);
    if (tableMatch) {
      const cells = splitTableCells(trimmed);
      if (cells.length >= 2 && !isTableSeparator(trimmed) && !isLikelyHeaderRow(cells)) {
        const label = cells[0];
        const fileCell = cells.find((cell) => /frontend\/src\/pages\/.+\.(jsx|tsx|js|ts)$/i.test(cell)) || "";
        entries.push({
          screen: labelToScreenName(label),
          displayLabel: label,
          key: screenKey(label),
          file: fileCell ? resolveFromRoot(rootDir, fileCell) : guessPageFile(rootDir, label),
          source: "table",
        });
      }
      continue;
    }

    const generated = trimmed.match(/^\/([^\s]+)\s+([A-Za-z][A-Za-z0-9_]*)(?:\s+\[[^\]]+\])?$/);
    if (generated) {
      const screen = generated[2].trim();
      entries.push({
        screen,
        displayLabel: screen,
        key: screenKey(screen),
        file: guessPageFile(rootDir, screen),
        source: "generated",
      });
    }
  }

  return entries;
}

function calculateQualitySignals(rootDir, filePath, screen, contextLedgerText) {
  if (!fs.existsSync(filePath)) return { score: 0, signals: {} };

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").length;
  const mentions = (contextLedgerText.match(new RegExp(screen, "gi")) || []).length;
  const hasTodo = /TODO|FIXME|閺堝秴濮/i.test(content);
  const isPlaceholder = lines < 20 || content.includes("Placeholder") || content.includes("TBD");

  // Score: higher means more "need" for refinement
  // - Mentions in context ledger: +10 per mention (important screen)
  // - Placeholder: +50 (high priority to fix)
  // - TODOs: +20
  // - Very small file (< 50 lines): +30
  // - Large file (> 300 lines) without sub-components: +15 (refactor candidate)
  let score = mentions * 10;
  if (isPlaceholder) score += 50;
  if (hasTodo) score += 20;
  if (lines < 50) score += 30;
  if (lines > 300 && !/import\s+.*from\s+['"]\.\.\/components/i.test(content)) score += 15;

  return {
    score,
    signals: {
      lines,
      mentions,
      hasTodo,
      isPlaceholder,
    },
  };
}

function findAuditCandidate({ rootDir, productText, pagesText, tasksText, contextLedgerText }) {
  if (!tasksText || tasksText.status !== "present") {
    return { selected: null, allCandidates: [] };
  }
  if (hasQueuedTasks(tasksText.text)) {
    return { selected: null, allCandidates: [] };
  }

  const productScreens = parseProductScreens(productText.text);
  const pageEntries = parsePagesIndex(rootDir, pagesText.text);
  const entryByKey = new Map(pageEntries.map((entry) => [entry.key, entry]));
  const candidates = [];

  for (const screen of productScreens) {
    const explicitEntry =
      entryByKey.get(screen.key) ||
      entryByKey.get(screenKey(screen.displayLabel)) ||
      entryByKey.get(screenKey(screen.screen));

    let filePath = "";
    let source = "";

    if (explicitEntry && fs.existsSync(explicitEntry.file)) {
      filePath = explicitEntry.file;
      source = explicitEntry.source;
    } else {
      const guessedFile =
        (screen.pagePath && resolveSharedInputPath(rootDir, screen.pagePath)) ||
        guessPageFile(rootDir, screen.displayLabel || screen.screen);
      if (fs.existsSync(guessedFile)) {
        filePath = guessedFile;
        source = "product";
      }
    }

    if (filePath) {
      const { score, signals } = calculateQualitySignals(rootDir, filePath, screen.displayLabel || screen.screen, contextLedgerText);
      candidates.push({
        screen: explicitEntry?.displayLabel || explicitEntry?.screen || screen.displayLabel || screen.screen,
        displayLabel: explicitEntry?.displayLabel || explicitEntry?.screen || screen.displayLabel || screen.screen,
        file: filePath,
        description: screen.description,
        source,
        score,
        signals,
      });
    }
  }

  if (candidates.length === 0) return { selected: null, allCandidates: [] };

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  return {
    selected: candidates[0],
    allCandidates: candidates,
  };
}

function buildCandidate(rootDir, candidate) {
  const file = relativeFile(rootDir, candidate.file);
  const displayLabel = candidate.displayLabel || candidate.screen;
  return {
    mode: "website-audit",
    surface: displayLabel,
    title: `Improve ${displayLabel} page`,
    files: [file],
    problemClass: "frontend-design",
    owner: "frontend-agent",
    verify: "cd frontend && npm run lint && npm run build",
    score: candidate.score,
    signals: candidate.signals,
    reason: candidate.source === "product"
      ? `PRODUCT.md highlights ${displayLabel}${candidate.description ? ` (${candidate.description})` : ""}, and the page file exists (Quality Score: ${candidate.score}).`
      : `Pages index resolves ${displayLabel} to an existing frontend page (Quality Score: ${candidate.score}).`,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Auto-Hermes Website Audit",
    "",
    `Mode: ${report.mode}`,
    `Queue Empty: ${report.queueEmpty ? "yes" : "no"}`,
    `Audit Candidates: ${report.signals.totalAuditCandidates}`,
  ];

  if (report.candidate) {
    lines.push(
      "",
      "## Selected Candidate",
      `- Surface: ${report.candidate.surface}`,
      `- Score: ${report.candidate.score}`,
      `- Files: ${report.candidate.files.join(", ")}`,
      `- Verify: ${report.candidate.verify}`,
      `- Reason: ${report.candidate.reason}`,
    );
  }

  if (Array.isArray(report.topCandidates) && report.topCandidates.length > 1) {
    lines.push(
      "",
      "## Top Refinement Candidates",
      "| Surface | Score | File |",
      "| :--- | :--- | :--- |",
      ...report.topCandidates.map((c) => `| ${c.surface} | ${c.score} | ${c.file} |`),
    );
  }

  return `${lines.join("\n")}\n`;
}

function writeOutput(rootDir, report, outputJson, outputMd) {
  const jsonPath = resolveFromRoot(rootDir, outputJson);
  const mdPath = resolveFromRoot(rootDir, outputMd);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, renderMarkdown(report), "utf8");
}

export function runAutoHermesWebsiteAudit(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  const rootDir = path.resolve(String(args.rootDir || ROOT));

  const tasksInput = readOptional(rootDir, args.tasks);
  const productInput = readOptional(rootDir, args.product);
  const pagesInput = readOptional(rootDir, args.pagesIndex);
  const contextLedgerInput = readOptional(rootDir, args.contextLedger);

  const { selected, allCandidates } = findAuditCandidate({
    rootDir,
    productText: productInput,
    pagesText: pagesInput,
    tasksText: tasksInput,
    contextLedgerText: contextLedgerInput.text,
  });

  const queueState = tasksInput.status === "present"
    ? (hasQueuedTasks(tasksInput.text)
      ? {
          status: "non-empty",
          path: relativeFile(rootDir, tasksInput.path),
          source: "explicit-or-inferred",
        }
      : {
          status: "confirmed-empty",
          path: relativeFile(rootDir, tasksInput.path),
          source: "explicit-or-inferred",
        })
    : {
        status: "missing",
        path: "",
        source: "unresolved",
      };

  const productScreens = parseProductScreens(productInput.text);
  const pageEntries = parsePagesIndex(rootDir, pagesInput.text);
  const candidate = selected ? buildCandidate(rootDir, selected) : null;

  const report = {
    mode: "website-audit",
    generatedAt: new Date().toISOString(),
    rootDir,
    queueState,
    queueEmpty: queueState.status === "confirmed-empty",
    candidate,
    candidates: candidate ? [candidate] : [],
    topCandidates: allCandidates.slice(0, 5).map((c) => ({
      surface: c.displayLabel || c.screen,
      score: c.score,
      file: relativeFile(rootDir, c.file),
    })),
    signals: {
      productScreens: productScreens.map((entry) => entry.displayLabel || entry.screen),
      pagesIndexed: pageEntries.map((entry) => entry.displayLabel || entry.screen),
      contextLedgerPresent: Boolean(String(contextLedgerInput.text || "").trim()),
      totalAuditCandidates: allCandidates.length,
    },
    inputs: {
      tasks: tasksInput.path ? relativeFile(rootDir, tasksInput.path) : "",
      product: productInput.path ? relativeFile(rootDir, productInput.path) : "",
      pagesIndex: pagesInput.path ? relativeFile(rootDir, pagesInput.path) : "",
      contextLedger: contextLedgerInput.path ? relativeFile(rootDir, contextLedgerInput.path) : "",
    },
  };

  if (args.write) {
    writeOutput(rootDir, report, args.outputJson, args.outputMd);
  }

  if (args.json) {
    return {
      report,
      output: `${JSON.stringify(report, null, 2)}\n`,
    };
  }

  return {
    report,
    output: renderMarkdown(report),
  };
}

function main() {
  const { output } = runAutoHermesWebsiteAudit(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
