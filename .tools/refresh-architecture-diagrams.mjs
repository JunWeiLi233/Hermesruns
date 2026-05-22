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

function wrapTextLines(input, maxLength = 26) {
  const words = String(input || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = words.shift();
  for (const word of words) {
    if ((`${current} ${word}`).length <= maxLength) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
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

function parseRoutes(appSource) {
  const routes = [];
  const regex = /<Route\s+path="([^"]+)"\s+element={<([^]+?)}\s*\/>/g;
  for (const match of appSource.matchAll(regex)) {
    const routePath = match[1];
    const elementSource = match[2];
    let audience = "public";
    if (elementSource.includes("AdminOnlyRoute")) audience = "admin";
    else if (elementSource.includes("UserOnlyRoute")) audience = "runner";
    else if (elementSource.includes("Navigate")) audience = "redirect";

    const innerComponent =
      elementSource.match(/><([A-Z][A-Za-z0-9]*)\s*\/>/)?.[1]
      || elementSource.match(/<([A-Z][A-Za-z0-9]*)\s*\/>/)?.[1]
      || "Unknown";

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

function summarizeAudience(routes, audience) {
  const filtered = routes.filter((route) => route.audience === audience);
  return {
    count: filtered.length,
    examples: formatRouteList(filtered, audience === "runner" ? 8 : 5),
  };
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

function lineArrow(x1, y1, x2, y2, label = "", options = {}) {
  return { x1, y1, x2, y2, label, dashed: Boolean(options.dashed), color: options.color || PALETTE.muted };
}

function createBox(box) {
  const paletteKey = box.kind || "external";
  const fill = PALETTE[`${paletteKey}Fill`] || PALETTE.externalFill;
  const stroke = PALETTE[`${paletteKey}Stroke`] || PALETTE.externalStroke;
  const lines = box.lines || [];
  const titleLines = wrapTextLines(box.title, 24);
  const allLines = [...titleLines, ...lines];
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
    ? `<text x="${((arrow.x1 + arrow.x2) / 2)}" y="${((arrow.y1 + arrow.y2) / 2) - 6}" text-anchor="middle" fill="${arrow.color}" font-size="8" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(arrow.label)}</text>`
    : "";
  return `
    <g>
      <line x1="${arrow.x1}" y1="${arrow.y1}" x2="${arrow.x2}" y2="${arrow.y2}" stroke="${arrow.color}" stroke-width="1.4" marker-end="url(#arrowhead)" ${dash}></line>
      ${label}
    </g>
  `;
}

function createLegend(items, x, y) {
  const rowHeight = 18;
  const width = 200;
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
  const arrows = (spec.arrows || []).map(createArrow).join("\n");
  const boxes = (spec.boxes || []).map(createBox).join("\n");
  const legend = createLegend(spec.legend || [], spec.legendX || (spec.width - 220), spec.legendY || (spec.height - 160));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.width} ${spec.height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(spec.title)}</title>
  <desc id="desc">${escapeXml(spec.subtitle)}</desc>
  ${buildGrid(spec.width, spec.height)}
  <text x="40" y="42" fill="${PALETTE.text}" font-size="24" font-weight="700" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(spec.title)}</text>
  <text x="40" y="64" fill="${PALETTE.muted}" font-size="11" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${escapeXml(spec.subtitle)}</text>
  ${arrows}
  ${groups}
  ${boxes}
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
        max-width: 1280px;
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
  const roundClose = routeForBox(274, 442, 162, 72);
  const finish = routeForBox(482, 442, 170, 72);
  const docs = routeForBox(710, 430, 210, 96);

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
      lineArrow(user.centerX, user.centerY, commands.x, commands.centerY, "invoke"),
      lineArrow(commands.centerX, commands.height + commands.y, loopOwners.centerX, loopOwners.y, "dispatch"),
      lineArrow(commands.x + commands.width, commands.centerY, controller.x, controller.centerY, "route"),
      lineArrow(controller.x + controller.width, controller.centerY, stateFiles.x, stateFiles.centerY, "read queue"),
      lineArrow(controller.centerX, controller.y + controller.height, supervisor.centerX, supervisor.y, "fallback"),
      lineArrow(loopOwners.x + loopOwners.width, loopOwners.centerY, supervisor.x, supervisor.centerY, "continuity"),
      lineArrow(supervisor.x + supervisor.width, supervisor.centerY, lanes.x, lanes.centerY, "launch"),
      lineArrow(lanes.centerX, lanes.y + lanes.height, docs.centerX, docs.y, "results + proofs", { color: PALETTE.frontendStroke }),
      lineArrow(loopOwners.centerX, loopOwners.y + loopOwners.height, roundClose.centerX, roundClose.y, "verified round"),
      lineArrow(roundClose.x + roundClose.width, roundClose.centerY, finish.x, finish.centerY, "true clean stop"),
      lineArrow(finish.x + finish.width, finish.centerY, docs.x, docs.centerY, "conditional diagram refresh"),
      lineArrow(stateFiles.centerX, stateFiles.y + stateFiles.height, roundClose.x + 32, roundClose.centerY, "writeback"),
    ],
    legend: [
      { kind: "frontend", label: "workflow surfaces / child lanes" },
      { kind: "backend", label: "repo-owned orchestration helpers" },
      { kind: "database", label: "state + memory artifacts" },
      { kind: "security", label: "merge / stop / review gates" },
      { kind: "cloud", label: "documentation outputs" },
      { kind: "external", label: "human entrypoint" },
    ],
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

function createSaasArchitectureSpec(routeSummary, lazyPageNames) {
  const users = routeForBox(48, 120, 170, 92);
  const publicUi = routeForBox(282, 92, 222, 122);
  const runnerUi = routeForBox(282, 252, 222, 140);
  const adminUi = routeForBox(282, 430, 222, 92);
  const frontend = routeForBox(566, 180, 190, 112);
  const backend = routeForBox(806, 118, 200, 138);
  const services = routeForBox(806, 310, 200, 148);
  const database = routeForBox(1070, 170, 160, 94);
  const integrations = routeForBox(1070, 314, 160, 158);

  const publicLines = routeSummary.public.examples;
  const runnerLines = routeSummary.runner.examples;
  const adminLines = routeSummary.admin.examples;
  const pageCount = lazyPageNames.length;

  return {
    slug: SAAS_DIAGRAM_SLUG,
    title: "Hermes SaaS Application Architecture",
    subtitle: "Public entry, runner shell, admin tooling, backend services, data stores, and third-party integrations.",
    width: 1280,
    height: 740,
    groups: [
      { x: 248, y: 64, width: 286, height: 490, label: "React Route Families", kind: "cloud" },
      { x: 784, y: 86, width: 468, height: 408, label: "Spring Boot Runtime + Integrations", kind: "cloud" },
    ],
    boxes: [
      { ...users, kind: "external", title: "Users", lines: ["public visitors", "signed-in runners", "admin operators"] },
      { ...publicUi, kind: "frontend", title: `Public Routes (${routeSummary.public.count})`, lines: publicLines },
      { ...runnerUi, kind: "frontend", title: `Runner Routes (${routeSummary.runner.count})`, lines: runnerLines },
      { ...adminUi, kind: "frontend", title: `Admin / Redirect (${routeSummary.admin.count + routeSummary.redirect.count})`, lines: [...adminLines, `redirects: ${routeSummary.redirect.count}`] },
      { ...frontend, kind: "frontend", title: "React + Vite SPA", lines: [`lazy pages: ${pageCount}`, "React Router 7", "shared runner shell + themes"] },
      { ...backend, kind: "backend", title: "Spring Boot API", lines: ["auth + controllers", "REST endpoints", "serves built SPA on :8080"] },
      { ...services, kind: "backend", title: "Domain Services", lines: ["analysis / coaching", "imports / sync jobs", "races / shoes / workflow tools", "weather + billing + route extraction"] },
      { ...database, kind: "database", title: "Data Layer", lines: ["H2 local-first default", "PostgreSQL optional", "JPA / Hibernate persistence"] },
      { ...integrations, kind: "cloud", title: "External Integrations", lines: ["Strava OAuth + sync", "Google OAuth", "Garmin Connect", "Stripe", "Open-Meteo", "AI providers / route extraction"] },
    ],
    arrows: [
      lineArrow(users.centerX, users.centerY, publicUi.x, publicUi.centerY, "browse"),
      lineArrow(users.centerX, users.centerY + 20, runnerUi.x, runnerUi.centerY, "train"),
      lineArrow(users.centerX, users.centerY + 40, adminUi.x, adminUi.centerY, "operate"),
      lineArrow(publicUi.x + publicUi.width, publicUi.centerY, frontend.x, frontend.centerY - 28, "route"),
      lineArrow(runnerUi.x + runnerUi.width, runnerUi.centerY, frontend.x, frontend.centerY, "shell"),
      lineArrow(adminUi.x + adminUi.width, adminUi.centerY, frontend.x, frontend.centerY + 32, "dashboard"),
      lineArrow(frontend.x + frontend.width, frontend.centerY, backend.x, backend.centerY, "/api"),
      lineArrow(backend.centerX, backend.y + backend.height, services.centerX, services.y, "service calls"),
      lineArrow(backend.x + backend.width, backend.centerY, database.x, database.centerY, "persist"),
      lineArrow(services.x + services.width, services.centerY, database.x, database.centerY + 24, "state"),
      lineArrow(services.x + services.width, services.centerY, integrations.x, integrations.centerY, "sync / webhooks"),
      lineArrow(integrations.x, integrations.centerY - 26, services.x + services.width, services.centerY - 12, "provider data", { dashed: true, color: PALETTE.securityStroke }),
    ],
    legend: [
      { kind: "frontend", label: "client routes and SPA runtime" },
      { kind: "backend", label: "Spring Boot controllers and services" },
      { kind: "database", label: "persistent application state" },
      { kind: "cloud", label: "third-party providers and infra edges" },
      { kind: "external", label: "human users / operators" },
    ],
    cards: [
      {
        title: "Route Inventory",
        items: [
          `Public routes: ${routeSummary.public.count}`,
          `Runner routes: ${routeSummary.runner.count}`,
          `Admin routes: ${routeSummary.admin.count}`,
          `Redirect routes: ${routeSummary.redirect.count}`,
        ],
      },
      {
        title: "Product Surface",
        items: [
          `Detected lazy pages: ${pageCount}`,
          `Examples: ${lazyPageNames.slice(0, 6).map(humanizeComponentName).join(", ")}${pageCount > 6 ? "..." : ""}`,
          "Runner shell, admin dashboard, and public auth remain the three main surface families.",
        ],
      },
      {
        title: "Service Edges",
        items: [
          "Backend owns auth, imports, coaching, analytics, billing, and race tooling.",
          "Third-party edges currently include Strava, Google, Garmin, Stripe, weather, and AI providers.",
          "Route/page changes in frontend/src/pages or App routing now trigger diagram regeneration on clean auto-commit.",
        ],
      },
    ],
    footer: "Generated from Hermes route map, lazy-page inventory, and integration-aware repo rules.",
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
    public: summarizeAudience(routes, "public"),
    runner: summarizeAudience(routes, "runner"),
    admin: summarizeAudience(routes, "admin"),
    redirect: summarizeAudience(routes, "redirect"),
  };
  const agentLanes = parseAgentLanes(workflowSource);

  const specs = [
    createAgentWorkflowSpec(agentLanes),
    createSaasArchitectureSpec(routeSummary, lazyPageNames),
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
