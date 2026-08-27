#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const README_PATH = "README.md";
const APP_PATH = "frontend/src/App.jsx";
const AGENT_WORKFLOW_PATH = ".codex/workflows/hermes-multi-agent.md";
const AUTO_HERMES_COMMAND_PATH = ".codex/commands/auto-hermes.md";
const AUTO_HERMES_MAX_COMMAND_PATH = ".codex/commands/auto-hermes-max.md";
const OUTPUT_DIR = "docs/architecture";
const AGENT_DIAGRAM_SLUG = "ai-agents-workflow";
const SAAS_DIAGRAM_SLUG = "saas-architecture";
const README_MARKER_START = "<!-- AUTO-GENERATED ARCHITECTURE DIAGRAMS START -->";
const README_MARKER_END = "<!-- AUTO-GENERATED ARCHITECTURE DIAGRAMS END -->";
const SKILL_TEMPLATE_PATH = ".codex/skills/architecture-diagram-generator/assets/template.html";

const PALETTE = {
  background: "#020617",
  panel: "#0f172a",
  panelBorder: "#1e293b",
  text: "#e2e8f0",
  muted: "#94a3b8",
  frontendFill: "rgba(8, 51, 68, 0.42)",
  frontendStroke: "#22d3ee",
  backendFill: "rgba(6, 78, 59, 0.42)",
  backendStroke: "#34d399",
  databaseFill: "rgba(76, 29, 149, 0.38)",
  databaseStroke: "#a78bfa",
  cloudFill: "rgba(120, 53, 15, 0.34)",
  cloudStroke: "#fbbf24",
  securityFill: "rgba(136, 19, 55, 0.38)",
  securityStroke: "#fb7185",
  externalFill: "rgba(30, 41, 59, 0.56)",
  externalStroke: "#94a3b8",
  busFill: "rgba(251, 146, 60, 0.28)",
  busStroke: "#fb923c",
};

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    force: false,
    changedFiles: [],
    rootDir: ROOT,
    outputDir: OUTPUT_DIR,
    readmePath: README_PATH,
    appPath: APP_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--changed-file") args.changedFiles.push(argv[++index] || "");
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[++index] || args[key];
    }
  }

  return args;
}

function resolveFromRoot(rootDir, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
}

function readText(rootDir, relPath) {
  return fs.readFileSync(resolveFromRoot(rootDir, relPath), "utf8");
}

function ensureParent(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function normalizeRepoPath(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function gitStagedFiles(rootDir) {
  try {
    const output = execFileSync("git", ["diff", "--cached", "--name-only"], {
      cwd: rootDir,
      encoding: "utf8",
    });
    return String(output || "")
      .split(/\r?\n/)
      .map(normalizeRepoPath)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function architectureRelevantPatterns() {
  return [
    /^README\.md$/i,
    /^docs\/architecture\//i,
    /^frontend\/src\/App\.jsx$/i,
    /^frontend\/src\/pages\//i,
    /^frontend\/src\/components\//i,
    /^frontend\/src\/utils\/runnerShellNav\.js$/i,
    /^backend\/src\/main\/java\//i,
    /^backend\/src\/main\/resources\/application.*\.properties$/i,
    /^start_hermes.*\.(bat|ps1)$/i,
    /^\.codex\/commands\/auto-hermes(?:-max)?\.md$/i,
    /^\.codex\/workflows\//i,
    /^\.codex\/skills\/architecture-diagram-generator\//i,
    /^\.tools\/auto-hermes.*\.(mjs|ps1)$/i,
    /^\.tools\/refresh-architecture-diagrams\.(mjs|test\.mjs)$/i,
  ];
}

function isArchitectureRelevantPath(filePath) {
  const normalized = normalizeRepoPath(filePath);
  return architectureRelevantPatterns().some((pattern) => pattern.test(normalized));
}

function resolveChangedFiles(args) {
  const explicit = Array.isArray(args.changedFiles)
    ? args.changedFiles.map(normalizeRepoPath).filter(Boolean)
    : [];
  if (explicit.length) return explicit;
  return gitStagedFiles(args.rootDir);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hardWrapToken(token, maxLength) {
  if (token.length <= maxLength) return [token];
  const chunks = [];
  let rest = token;
  while (rest.length > maxLength) {
    let cut = Math.max(rest.lastIndexOf("/", maxLength), rest.lastIndexOf("-", maxLength));
    if (cut < maxLength / 2) cut = maxLength;
    chunks.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function wrapTextLines(input, maxLength = 26) {
  const words = String(input || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = "";
  for (const word of words) {
    for (const chunk of hardWrapToken(word, maxLength)) {
      if (!current) current = chunk;
      else if ((`${current} ${chunk}`).length <= maxLength) current = `${current} ${chunk}`;
      else {
        lines.push(current);
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function extractLazyPageNames(appSource) {
  const names = [];
  const regex = /^const\s+([A-Z][A-Za-z0-9]+)\s*=\s*React\.lazy/mg;
  for (const match of appSource.matchAll(regex)) {
    names.push(match[1]);
  }
  return names;
}

function humanizeComponentName(name) {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\bVo2\b/g, "VO2")
    .replace(/\bId\b/g, "ID");
}

const FEATURED_RUNNER_PATHS = [
  "/today-run",
  "/profile",
  "/runs",
  "/analysis",
  "/shoes",
  "/races",
  "/schedule",
  "/weather",
];

function parseRoutes(appSource) {
  const routes = [];
  const regex = /<Route\s+path="([^"]+)"\s+element={<([^]+?)}\s*\/>/g;
  for (const match of appSource.matchAll(regex)) {
    const routePath = match[1];
    const elementSource = match[2];
    const innerComponent =
      elementSource.match(/><([A-Z][A-Za-z0-9]*)\s*\/>/)?.[1]
      || elementSource.match(/<([A-Z][A-Za-z0-9]*)\s*\/?>/)?.[1]
      || "Unknown";

    let audience = "public";
    if (
      elementSource.includes("AdminOnlyRoute")
      || routePath === "/admin"
      || innerComponent === "AdminLogin"
    ) {
      audience = "admin";
    } else if (elementSource.includes("UserOnlyRoute")) {
      audience = "runner";
    } else if (elementSource.includes("Navigate")) {
      audience = "redirect";
    }

    routes.push({
      path: routePath,
      audience,
      component: innerComponent,
      label: audience === "redirect"
        ? `Redirect -> ${elementSource.match(/to="([^"]+)"/)?.[1] || "/"}`
        : humanizeComponentName(innerComponent),
    });
  }
  return routes;
}

function formatRouteList(routes, limit = 6) {
  const subset = routes.slice(0, limit).map((route) => route.path);
  if (routes.length > limit) subset.push(`+${routes.length - limit} more`);
  return subset;
}

function formatFeaturedRouteList(routes, featuredPaths, limit = 8) {
  const featuredSet = new Set(featuredPaths);
  const featured = featuredPaths
    .map((path) => routes.find((route) => route.path === path))
    .filter(Boolean);
  const rest = routes.filter((route) => !featuredSet.has(route.path));
  return formatRouteList([...featured, ...rest], limit);
}

function summarizeAudience(routes, audience, options = {}) {
  const filtered = routes.filter((route) => route.audience === audience);
  const examples = options.featuredPaths
    ? formatFeaturedRouteList(filtered, options.featuredPaths, options.limit || 8)
    : formatRouteList(filtered, options.limit || (audience === "runner" ? 8 : 5));
  return {
    count: filtered.length,
    examples,
  };
}

function detectNpmDependencyMajor(rootDir, packageRelPath, packageName) {
  try {
    const pkg = JSON.parse(readText(rootDir, packageRelPath));
    const raw = pkg.dependencies?.[packageName] || pkg.devDependencies?.[packageName] || "";
    const match = String(raw).match(/(\d+)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function parseAgentLanes(agentWorkflowSource) {
  const seen = new Set();
  for (const match of agentWorkflowSource.matchAll(/`([a-z-]+agent)`/g)) {
    seen.add(match[1]);
  }
  return [...seen].filter((name) => /^(planning|reviewer|debugger|frontend|backend)-agent$/.test(name));
}

function routeForBox(x, y, width, height) {
  return { x, y, width, height, centerX: x + (width / 2), centerY: y + (height / 2) };
}

const BODY_FONT_SIZE = 9;
const MONOSPACE_CHAR_RATIO = 0.6;

function bodyLineCharBudget(boxWidth) {
  return Math.max(12, Math.floor((boxWidth - 22) / (BODY_FONT_SIZE * MONOSPACE_CHAR_RATIO)));
}

function lineArrow(x1, y1, x2, y2, label = "", options = {}) {
  return {
    x1,
    y1,
    x2,
    y2,
    label,
    dashed: Boolean(options.dashed),
    color: options.color || PALETTE.muted,
    labelDx: options.labelDx || 0,
    labelDy: options.labelDy || 0,
    labelAnchor: options.labelAnchor,
  };
}

function pathArrow(points, label = "", options = {}) {
  return {
    points,
    label,
    dashed: Boolean(options.dashed),
    color: options.color || PALETTE.muted,
    labelAt: options.labelAt,
    labelAnchor: options.labelAnchor,
  };
}

function createBox(box) {
  const paletteKey = box.kind || "external";
  const fill = PALETTE[`${paletteKey}Fill`] || PALETTE.externalFill;
  const stroke = PALETTE[`${paletteKey}Stroke`] || PALETTE.externalStroke;
  const lines = box.lines || [];
  const titleLines = wrapTextLines(box.title, 24);
  const budget = bodyLineCharBudget(box.width);
  const wrappedLines = lines.flatMap((line) => wrapTextLines(line, budget));
  const allLines = [...titleLines, ...wrappedLines];
  const titleCount = titleLines.length;
  const textY = box.y + 22;
  const text = allLines.map((line, index) => {
    const isTitle = index < titleCount;
    return `<text x="${box.x + 14}" y="${textY + (index * 14)}" fill="${isTitle ? PALETTE.text : PALETTE.muted}" font-size="${isTitle ? 12 : 9}" font-weight="${isTitle ? 600 : 400}" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(line)}</text>`;
  }).join("\n");

  return `
    <g>
      <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="8" fill="${PALETTE.panel}" opacity="0.92"></rect>
      <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></rect>
      ${text}
    </g>
  `;
}

function createGroup(group) {
  const stroke = group.kind === "security" ? PALETTE.securityStroke : PALETTE.cloudStroke;
  const dash = group.kind === "security" ? "4,4" : "8,4";
  return `
    <g>
      <rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" rx="12" fill="none" stroke="${stroke}" stroke-width="1.25" stroke-dasharray="${dash}"></rect>
      <text x="${group.x + 12}" y="${group.y + 18}" fill="${stroke}" font-size="10" font-weight="600" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(group.label)}</text>
    </g>
  `;
}

function createArrow(arrow) {
  const dash = arrow.dashed ? `stroke-dasharray="6,4"` : "";
  const label = arrow.label
    ? `<text x="${((arrow.x1 + arrow.x2) / 2) + (arrow.labelDx || 0)}" y="${((arrow.y1 + arrow.y2) / 2) - 6 + (arrow.labelDy || 0)}"${arrow.labelAnchor ? ` text-anchor="${arrow.labelAnchor}"` : ""} fill="${arrow.color}" font-size="8" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(arrow.label)}</text>`
    : "";
  return `
    <g>
      <line x1="${arrow.x1}" y1="${arrow.y1}" x2="${arrow.x2}" y2="${arrow.y2}" stroke="${arrow.color}" stroke-width="1.4" marker-end="url(#arrowhead)" ${dash}></line>
      ${label}
    </g>
  `;
}

function createPathArrow(arrow) {
  const dash = arrow.dashed ? `stroke-dasharray="6,4"` : "";
  const d = arrow.points.map((point, index) => `${index === 0 ? "M" : "L"}${point[0]} ${point[1]}`).join(" ");
  const [labelX, labelY] = arrow.labelAt || [0, 0];
  const label = arrow.label
    ? `<text x="${labelX}" y="${labelY}"${arrow.labelAnchor ? ` text-anchor="${arrow.labelAnchor}"` : ""} fill="${arrow.color}" font-size="8" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(arrow.label)}</text>`
    : "";
  return `
    <g>
      <path d="${d}" fill="none" stroke="${arrow.color}" stroke-width="1.4" marker-end="url(#arrowhead)" ${dash}></path>
      ${label}
    </g>
  `;
}

function createLegend(items, x, y) {
  const rowHeight = 16;
  const width = 248;
  const height = 18 + (items.length * rowHeight);
  const entries = items.map((item, index) => {
    const fill = PALETTE[`${item.kind}Fill`] || PALETTE.externalFill;
    const stroke = PALETTE[`${item.kind}Stroke`] || PALETTE.externalStroke;
    return `
      <rect x="${x + 12}" y="${y + 14 + (index * rowHeight)}" width="14" height="10" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1"></rect>
      <text x="${x + 34}" y="${y + 23 + (index * rowHeight)}" fill="${PALETTE.muted}" font-size="9" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(item.label)}</text>
    `;
  }).join("\n");
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${PALETTE.panel}" stroke="${PALETTE.panelBorder}" stroke-width="1"></rect>
      <text x="${x + 12}" y="${y + 12}" fill="${PALETTE.text}" font-size="10" font-weight="600" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">Legend</text>
      ${entries}
    </g>
  `;
}

function buildGrid(width, height) {
  return `
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.08)" stroke-width="1"></path>
      </pattern>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${PALETTE.muted}"></polygon>
      </marker>
    </defs>
    <rect width="${width}" height="${height}" fill="${PALETTE.background}"></rect>
    <rect width="${width}" height="${height}" fill="url(#grid)"></rect>
  `;
}

function renderSvgDocument(spec) {
  const groups = (spec.groups || []).map(createGroup).join("\n");
  const arrows = (spec.arrows || []).map((arrow) => (arrow.points ? createPathArrow(arrow) : createArrow(arrow))).join("\n");
  const boxes = (spec.boxes || []).map(createBox).join("\n");
  const legend = createLegend(spec.legend || [], spec.legendX ?? (spec.width - 268), spec.legendY ?? (spec.height - 160));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.width} ${spec.height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(spec.title)}</title>
  <desc id="desc">${escapeXml(spec.subtitle)}</desc>
  ${buildGrid(spec.width, spec.height)}
  <text x="40" y="42" fill="${PALETTE.text}" font-size="24" font-weight="700" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(spec.title)}</text>
  <text x="40" y="64" fill="${PALETTE.muted}" font-size="11" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(spec.subtitle)}</text>
  ${groups}
  ${boxes}
  ${arrows}
  ${legend}
</svg>
`;
}

function renderHtmlDocument(spec, svgMarkup) {
  const cards = (spec.cards || []).map((card) => `
    <article class="card">
      <h3>${escapeXml(card.title)}</h3>
      <ul>
        ${card.items.map((item) => `<li>${escapeXml(item)}</li>`).join("")}
      </ul>
    </article>
  `).join("\n");
  const templateNote = fs.existsSync(resolveFromRoot(ROOT, SKILL_TEMPLATE_PATH))
    ? `<p class="meta">Styled from the vendored architecture-diagram-generator skill template.</p>`
    : `<p class="meta">Repo-local architecture diagram artifact.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(spec.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: ${PALETTE.background};
        --panel: ${PALETTE.panel};
        --panel-border: ${PALETTE.panelBorder};
        --text: ${PALETTE.text};
        --muted: ${PALETTE.muted};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        background: radial-gradient(circle at top, rgba(34, 211, 238, 0.1), transparent 30%), var(--bg);
        color: var(--text);
      }
      .container {
        max-width: 1320px;
        margin: 0 auto;
        padding: 32px;
      }
      .shell {
        border: 1px solid var(--panel-border);
        border-radius: 24px;
        background: rgba(15, 23, 42, 0.92);
        overflow: hidden;
        box-shadow: 0 30px 80px rgba(2, 6, 23, 0.45);
      }
      .header {
        padding: 24px 28px 12px;
      }
      .header h1 {
        margin: 0 0 10px;
        font-size: 28px;
      }
      .header p, .meta {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }
      .diagram {
        padding: 0 20px 20px;
      }
      .diagram svg {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.16);
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        padding: 0 20px 24px;
      }
      .card {
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 18px;
        background: rgba(15, 23, 42, 0.9);
        padding: 18px 18px 16px;
      }
      .card h3 {
        margin: 0 0 10px;
        font-size: 13px;
      }
      .card ul {
        margin: 0;
        padding-left: 16px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.55;
      }
      .footer {
        border-top: 1px solid rgba(148, 163, 184, 0.12);
        padding: 16px 20px 24px;
      }
      @media (max-width: 960px) {
        .cards { grid-template-columns: 1fr; }
        .container { padding: 16px; }
      }
    </style>
  </head>
  <body>
    <main class="container">
      <section class="shell">
        <header class="header">
          <h1>${escapeXml(spec.title)}</h1>
          <p>${escapeXml(spec.subtitle)}</p>
        </header>
        <section class="diagram">
          ${svgMarkup}
        </section>
        <section class="cards">
          ${cards}
        </section>
        <footer class="footer">
          ${templateNote}
          <p class="meta">${escapeXml(spec.footer)}</p>
        </footer>
      </section>
    </main>
  </body>
</html>
`;
}

function createAgentWorkflowSpec(agentLanes) {
  const user = routeForBox(48, 120, 150, 72);
  const commands = routeForBox(242, 114, 184, 86);
  const controller = routeForBox(466, 126, 168, 72);
  const stateFiles = routeForBox(676, 96, 226, 126);
  const loopOwners = routeForBox(254, 274, 182, 86);
  const supervisor = routeForBox(474, 274, 160, 86);
  const lanes = routeForBox(694, 266, 222, 106);
  const roundClose = routeForBox(274, 442, 162, 86);
  const finish = routeForBox(482, 442, 170, 86);
  const docs = routeForBox(710, 430, 210, 96);

  // Writeback routes outside the control-plane border (x > 926) and re-enters
  // through the commit boundary so it never crosses another node or arrow.
  const writebackChannelX = 952;
  const writebackLaneY = 546;

  const workflowLines = agentLanes.length
    ? [`lanes: ${agentLanes.join(", ")}`, "website-audit fallback", "merge gate on max mode"]
    : ["reviewer/frontend/backend", "debugger/planner lanes", "website-audit fallback"];

  return {
    slug: AGENT_DIAGRAM_SLUG,
    title: "Hermes AI Agents Workflow",
    subtitle: "Current /auto-hermes and /auto-hermes-max execution flow, grounded in repo state and shared artifacts.",
    width: 980,
    height: 680,
    groups: [
      { x: 226, y: 82, width: 700, height: 308, label: "Control Plane / State Plane", kind: "cloud" },
      { x: 254, y: 418, width: 690, height: 132, label: "Round Writeback / Commit Boundary", kind: "security" },
    ],
    boxes: [
      { ...user, kind: "external", title: "User + Prompt", lines: ["/auto-hermes", "/auto-hermes-max"] },
      { ...commands, kind: "frontend", title: "Command Surfaces", lines: [".codex/commands/auto-hermes.md", ".codex/commands/auto-hermes-max.md"] },
      { ...controller, kind: "backend", title: "Controller", lines: [".tools/auto-hermes-controller.mjs", "bounded round selection"] },
      { ...stateFiles, kind: "database", title: "Queue + Context", lines: ["TASKS.md", ".ai-sync/CONTEXT_LEDGER.md", ".ai-sync/AGENT_SYNC.md", ".ai-sync/HUMAN_LOOP.md"] },
      { ...loopOwners, kind: "backend", title: "Loop Owners", lines: [".tools/auto-hermes-loop.mjs", ".tools/auto-hermes-max-loop.mjs"] },
      { ...supervisor, kind: "security", title: "Supervisor", lines: [".tools/auto-hermes-supervisor.mjs", "website-audit exhaustion stop gate"] },
      { ...lanes, kind: "frontend", title: "Specialist Lanes", lines: workflowLines },
      { ...roundClose, kind: "backend", title: "Round Close", lines: [".tools/auto-hermes-round-close.mjs", "promotion + trace writeback"] },
      { ...finish, kind: "backend", title: "Finish Helper", lines: [".tools/auto-hermes-finish.mjs", ".tools/auto-commit.ps1"] },
      { ...docs, kind: "cloud", title: "Architecture Docs Refresh", lines: ["README.md block refresh", "docs/architecture/*.html", "docs/architecture/*.svg"] },
    ],
    arrows: [
      lineArrow(user.centerX, user.centerY, commands.x, commands.centerY, "invoke", { labelDx: 38 }),
      lineArrow(commands.centerX, commands.height + commands.y, loopOwners.centerX, loopOwners.y, "dispatch", { labelDx: 26 }),
      lineArrow(commands.x + commands.width, commands.centerY, controller.x, controller.centerY, "route"),
      lineArrow(controller.x + controller.width, controller.centerY, stateFiles.x, stateFiles.centerY, "reads"),
      lineArrow(controller.centerX, controller.y + controller.height, supervisor.centerX, supervisor.y, "fallback", { labelDx: -32 }),
      lineArrow(loopOwners.x + loopOwners.width, loopOwners.centerY, supervisor.x, supervisor.centerY, "handoff"),
      lineArrow(supervisor.x + supervisor.width, supervisor.centerY, lanes.x, lanes.centerY, "launch"),
      lineArrow(lanes.centerX, lanes.y + lanes.height, docs.centerX, docs.y, "results + proofs", {
        color: PALETTE.frontendStroke,
        labelAnchor: "start",
        labelDx: 12,
        labelDy: 6,
      }),
      lineArrow(loopOwners.centerX, loopOwners.y + loopOwners.height, roundClose.centerX, roundClose.y, "verified round", {
        labelAnchor: "end",
        labelDx: -6,
        labelDy: 5,
      }),
      lineArrow(roundClose.x + roundClose.width, roundClose.centerY, finish.x, finish.centerY, "true clean stop", { labelDy: -42 }),
      lineArrow(finish.x + finish.width, finish.centerY, docs.x, docs.centerY, "conditional diagram refresh", { labelDy: -42 }),
      pathArrow(
        [
          [stateFiles.x + stateFiles.width, stateFiles.centerY],
          [writebackChannelX, stateFiles.centerY],
          [writebackChannelX, writebackLaneY],
          [roundClose.centerX, writebackLaneY],
          [roundClose.centerX, roundClose.y + roundClose.height],
        ],
        "writeback",
        { labelAt: [(writebackChannelX + roundClose.centerX) / 2, writebackLaneY - 6] },
      ),
    ],
    legend: [
      { kind: "frontend", label: "workflow surfaces / child lanes" },
      { kind: "backend", label: "repo-owned orchestration helpers" },
      { kind: "database", label: "state + memory artifacts" },
      { kind: "security", label: "merge / stop / review gates" },
      { kind: "cloud", label: "documentation outputs" },
      { kind: "external", label: "human entrypoint" },
    ],
    legendX: 254,
    legendY: 556,
    cards: [
      {
        title: "Execution Flow",
        items: [
          "Controller chooses one bounded round from TASKS + .ai-sync state.",
          "Loop owners and the supervisor enforce website-audit fallback and repeated-no-candidate stop semantics.",
          "Round-close and finish helpers own promotion, auto-commit gating, and commit-time docs refresh.",
        ],
      },
      {
        title: "State Sources",
        items: [
          "TASKS.md remains the shared queue.",
          "CONTEXT_LEDGER and AGENT_SYNC keep reclaim-safe surface intent and live claims.",
          "README + docs/architecture now become auto-refreshed documentation outputs on architecture-impact commits.",
        ],
      },
      {
        title: "Active Lane Shape",
        items: [
          `Detected specialist lanes: ${agentLanes.join(", ") || "frontend-agent, backend-agent, reviewer-agent"}.`,
          "Normal round path: reviewer/planner/debugger -> owning builder lane -> round-close.",
          "Max mode adds lane result packets and a merge gate before finish.",
        ],
      },
    ],
    footer: "Generated from Hermes repo workflow docs and command surfaces.",
  };
}

// Two horizontal bands keep every primary flow axis-aligned:
// band A centerY = 180 (publicUi/frontend/backend/database),
// band B centerY = 360 (runnerUi/auth/services/integrations).
// Group frames share the same top (y=78) and an 8px gutter, and the two
// two-row frames share the same bottom so the columns read as one grid.
const SAAS_BAND_A_CENTER = 180;
const SAAS_BAND_B_CENTER = 360;
const SAAS_GROUP_TOP = 78;

function createSaasArchitectureSpec(routeSummary, lazyPageNames, stackFacts = {}) {
  const users = routeForBox(40, 290, 176, 100);
  const publicUi = routeForBox(276, SAAS_BAND_A_CENTER - 59, 236, 118);
  const runnerUi = routeForBox(276, SAAS_BAND_B_CENTER - 84, 236, 168);
  const adminUi = routeForBox(276, 470, 236, 92);
  const frontend = routeForBox(560, SAAS_BAND_A_CENTER - 59, 204, 118);
  const auth = routeForBox(560, SAAS_BAND_B_CENTER - 48, 204, 96);
  const backend = routeForBox(812, SAAS_BAND_A_CENTER - 75, 214, 150);
  const services = routeForBox(812, SAAS_BAND_B_CENTER - 78, 214, 156);
  const database = routeForBox(1072, SAAS_BAND_A_CENTER - 54, 188, 108);
  const integrations = routeForBox(1072, SAAS_BAND_B_CENTER - 92, 188, 184);

  const publicLines = routeSummary.public.examples;
  const runnerLines = routeSummary.runner.examples;
  const adminLines = routeSummary.admin.examples;
  const pageCount = lazyPageNames.length;
  const reactLabel = stackFacts.reactLabel || "React + Vite";
  const routerLabel = stackFacts.routerLabel || "React Router";

  return {
    slug: SAAS_DIAGRAM_SLUG,
    title: "Hermes SaaS Application Architecture",
    subtitle: "Public entry, runner shell, admin tooling, JWT API boundary, data stores, and third-party integrations.",
    width: 1320,
    height: 744,
    groups: [
      { x: 248, y: SAAS_GROUP_TOP, width: 288, height: 514, label: "React Route Families", kind: "cloud" },
      { x: 544, y: SAAS_GROUP_TOP, width: 244, height: 400, label: "Client Runtime + Auth", kind: "security" },
      { x: 796, y: SAAS_GROUP_TOP, width: 480, height: 400, label: "Spring Boot Runtime + Integrations", kind: "cloud" },
    ],
    boxes: [
      { ...users, kind: "external", title: "Users", lines: ["public visitors", "signed-in runners", "admin operators"] },
      { ...publicUi, kind: "frontend", title: `Public Routes (${routeSummary.public.count})`, lines: publicLines },
      { ...runnerUi, kind: "frontend", title: `Runner Routes (${routeSummary.runner.count})`, lines: runnerLines },
      { ...adminUi, kind: "frontend", title: `Admin Routes (${routeSummary.admin.count})`, lines: adminLines },
      {
        ...frontend,
        kind: "frontend",
        title: `${reactLabel} SPA`,
        lines: [
          routerLabel,
          `lazy pages: ${pageCount}`,
          "shared runner shell + themes",
          `legacy redirects: ${routeSummary.redirect.count}`,
        ],
      },
      {
        ...auth,
        kind: "security",
        title: "Auth Gates",
        lines: ["UserOnlyRoute", "AdminOnlyRoute", "JWT on /api"],
      },
      {
        ...backend,
        kind: "backend",
        title: "Spring Boot API",
        lines: ["auth + controllers", "REST /api", "serves SPA on :8080", "inbound webhooks"],
      },
      {
        ...services,
        kind: "backend",
        title: "Domain Services",
        lines: [
          "analysis / coaching",
          "imports / wellness sync",
          "races / shoes / maps",
          "weather + billing",
        ],
      },
      {
        ...database,
        kind: "database",
        title: "Data Layer",
        lines: ["H2 local default", "PostgreSQL production", "JPA / Hibernate"],
      },
      {
        ...integrations,
        kind: "cloud",
        title: "External Integrations",
        lines: [
          "Strava OAuth + webhook",
          "Google OAuth + Health",
          "Garmin Connect",
          "Stripe checkout",
          "Open-Meteo + NWS",
          "Gemini + maps",
        ],
      },
    ],
    arrows: [
      lineArrow(users.x + users.width, users.centerY - 28, publicUi.x, publicUi.centerY, "browse", { labelAnchor: "end", labelDx: -6, labelDy: -2 }),
      lineArrow(users.x + users.width, users.centerY, runnerUi.x, runnerUi.centerY, "train", { labelDx: -6, labelDy: -4 }),
      lineArrow(users.centerX + 72, users.y + users.height, adminUi.x, adminUi.centerY, "operate", { labelDx: 14, labelDy: 9 }),
      lineArrow(publicUi.x + publicUi.width, publicUi.centerY, frontend.x, frontend.centerY, "route"),
      lineArrow(runnerUi.x + runnerUi.width, runnerUi.centerY, auth.x, auth.centerY, "UserOnlyRoute"),
      lineArrow(adminUi.x + adminUi.width, adminUi.centerY, auth.centerX - 42, auth.y + auth.height, "AdminOnlyRoute", { labelAnchor: "start", labelDx: -16, labelDy: 54 }),
      lineArrow(auth.centerX, auth.y, frontend.centerX, frontend.y + frontend.height, "session", { labelAnchor: "end", labelDx: -12, labelDy: 5 }),
      lineArrow(frontend.x + frontend.width, frontend.centerY, backend.x, backend.centerY, "host SPA"),
      lineArrow(auth.x + auth.width, auth.centerY, backend.x, backend.y + 114, "/api + JWT", { labelAnchor: "end", labelDx: -9, labelDy: -2 }),
      lineArrow(backend.centerX, backend.y + backend.height, services.centerX, services.y, "service calls", { labelAnchor: "start", labelDx: 12, labelDy: 9 }),
      lineArrow(backend.x + backend.width, backend.centerY, database.x, database.centerY, "persist"),
      lineArrow(services.x + services.width, services.centerY, integrations.x, integrations.centerY, "sync"),
      lineArrow(integrations.x, integrations.y + 24, backend.x + backend.width, backend.y + 138, "webhooks", { dashed: true, color: PALETTE.securityStroke, labelAnchor: "end", labelDx: -11, labelDy: 14 }),
      lineArrow(integrations.x, integrations.centerY + 36, services.x + services.width, services.centerY + 36, "provider data", { dashed: true, color: PALETTE.securityStroke, labelDy: -2 }),
    ],
    legend: [
      { kind: "frontend", label: "client routes and SPA runtime" },
      { kind: "security", label: "auth gates / JWT boundary" },
      { kind: "backend", label: "Spring Boot API / services" },
      { kind: "database", label: "persistent application state" },
      { kind: "cloud", label: "third-party providers and infra edges" },
      { kind: "external", label: "human users / operators" },
    ],
    legendX: 40,
    legendY: 614,
    cards: [
      {
        title: "Route Inventory",
        items: [
          `Public routes: ${routeSummary.public.count}`,
          `Runner routes: ${routeSummary.runner.count}`,
          `Admin routes: ${routeSummary.admin.count}`,
          `Legacy redirects: ${routeSummary.redirect.count}`,
        ],
      },
      {
        title: "Product Surface",
        items: [
          `Detected lazy pages: ${pageCount}`,
          `${reactLabel}; ${routerLabel}.`,
          "Primary runner surfaces: Today Run, Profile, Runs, Analysis, Shoes, Races, Schedule, Weather.",
        ],
      },
      {
        title: "Service Edges",
        items: [
          "Spring Boot serves the built SPA on :8080 and the JSON API under /api.",
          "UserOnlyRoute / AdminOnlyRoute gate pages; api.js attaches the JWT.",
          "Strava and Stripe webhooks hit controllers; weather falls back from Open-Meteo to NWS.",
        ],
      },
    ],
    footer: "Generated from App.jsx routes, frontend/package.json, and integration-aware repo rules.",
  };
}

function buildReadmeBlock() {
  return `${README_MARKER_START}
### Live Architecture Diagrams

#### AI Agents Workflow

![Hermes AI agents workflow](docs/architecture/${AGENT_DIAGRAM_SLUG}.svg)

Source artifact: [docs/architecture/${AGENT_DIAGRAM_SLUG}.html](docs/architecture/${AGENT_DIAGRAM_SLUG}.html)

#### SaaS Architecture

![Hermes SaaS architecture](docs/architecture/${SAAS_DIAGRAM_SLUG}.svg)

Source artifact: [docs/architecture/${SAAS_DIAGRAM_SLUG}.html](docs/architecture/${SAAS_DIAGRAM_SLUG}.html)
${README_MARKER_END}`;
}

function upsertReadmeBlock(rootDir, readmePath) {
  const fullPath = resolveFromRoot(rootDir, readmePath);
  const source = fs.readFileSync(fullPath, "utf8");
  const block = buildReadmeBlock();

  if (source.includes(README_MARKER_START) && source.includes(README_MARKER_END)) {
    return source.replace(new RegExp(`${README_MARKER_START}[\\s\\S]*?${README_MARKER_END}`), block);
  }

  const anchor = "### AI-Agent Workflow (Shared) /";
  if (source.includes(anchor)) {
    return source.replace(anchor, `${block}\n\n${anchor}`);
  }

  return `${source.trimEnd()}\n\n${block}\n`;
}

export function runArchitectureDiagramRefresh(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  const changedFiles = resolveChangedFiles(args);
  const relevantFiles = changedFiles.filter(isArchitectureRelevantPath);
  const shouldRefresh = Boolean(args.force || relevantFiles.length);

  const result = {
    generatedAt: new Date().toISOString(),
    changedFiles,
    relevantFiles,
    refreshed: shouldRefresh,
    outputs: [],
    readmeUpdated: false,
    reason: shouldRefresh
      ? "Architecture-impact changes detected."
      : "No architecture-impact files detected in the current staged/explicit file set.",
  };

  if (!shouldRefresh) {
    const output = args.json ? `${JSON.stringify(result, null, 2)}\n` : `${result.reason}\n`;
    return { result, output };
  }

  const appSource = readText(args.rootDir, args.appPath);
  const workflowSource = readText(args.rootDir, AGENT_WORKFLOW_PATH);
  const lazyPageNames = extractLazyPageNames(appSource);
  const routes = parseRoutes(appSource);
  const routeSummary = {
    public: summarizeAudience(routes, "public", { limit: 6 }),
    runner: summarizeAudience(routes, "runner", { featuredPaths: FEATURED_RUNNER_PATHS, limit: 8 }),
    admin: summarizeAudience(routes, "admin"),
    redirect: summarizeAudience(routes, "redirect"),
  };
  const reactMajor = detectNpmDependencyMajor(args.rootDir, "frontend/package.json", "react");
  const routerMajor = detectNpmDependencyMajor(args.rootDir, "frontend/package.json", "react-router");
  const stackFacts = {
    reactLabel: reactMajor ? `React ${reactMajor} + Vite` : "React + Vite",
    routerLabel: routerMajor ? `React Router ${routerMajor}` : "React Router",
  };
  const agentLanes = parseAgentLanes(workflowSource);

  const specs = [
    createAgentWorkflowSpec(agentLanes),
    createSaasArchitectureSpec(routeSummary, lazyPageNames, stackFacts),
  ];

  const writtenPaths = [];
  for (const spec of specs) {
    const svgMarkup = renderSvgDocument(spec);
    const htmlMarkup = renderHtmlDocument(spec, svgMarkup.replace(/^<\?xml[^>]+>\s*/i, ""));
    const outputDir = resolveFromRoot(args.rootDir, args.outputDir);
    const svgPath = path.join(outputDir, `${spec.slug}.svg`);
    const htmlPath = path.join(outputDir, `${spec.slug}.html`);
    ensureParent(svgPath);
    fs.writeFileSync(svgPath, svgMarkup, "utf8");
    fs.writeFileSync(htmlPath, htmlMarkup, "utf8");
    writtenPaths.push(normalizeRepoPath(path.relative(args.rootDir, svgPath)));
    writtenPaths.push(normalizeRepoPath(path.relative(args.rootDir, htmlPath)));
  }

  const nextReadme = upsertReadmeBlock(args.rootDir, args.readmePath);
  fs.writeFileSync(resolveFromRoot(args.rootDir, args.readmePath), nextReadme, "utf8");
  writtenPaths.push(normalizeRepoPath(args.readmePath));

  result.outputs = writtenPaths;
  result.readmeUpdated = true;
  const output = args.json ? `${JSON.stringify(result, null, 2)}\n` : `Refreshed: ${writtenPaths.join(", ")}\n`;
  return { result, output };
}

function main() {
  const { output } = runArchitectureDiagramRefresh(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
