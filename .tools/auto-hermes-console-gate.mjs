#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_LEDGER = ".ai-sync/LOCAL_CONSOLE_ERRORS.json";

const COMMON_FRONTEND_SURFACES = [
  {
    match: /frontend[\\/]+src[\\/]+pages[\\/]+AddShoes\.jsx$/i,
    route: "/shoes/add",
    surface: "AddShoes",
    smokeTests: [
      "frontend/src/pages/addShoesKineticEditorial.smoke.test.js",
      "frontend/src/pages/addShoesBrowserBrandInit.smoke.test.js",
    ],
  },
  {
    match: /frontend[\\/]+src[\\/]+pages[\\/]+TodayRun\.jsx$/i,
    route: "/today-run",
    surface: "TodayRun",
    smokeTests: [
      "frontend/src/utils/todayRunCoachDistance.smoke.test.js",
      "frontend/src/utils/todayRunAcwrNarrative.smoke.test.js",
    ],
  },
  {
    match: /frontend[\\/]+src[\\/]+pages[\\/]+Runs\.jsx$/i,
    route: "/runs",
    surface: "Runs",
    smokeTests: [
      "frontend/src/pages/runsRoutePreviewCache.smoke.test.js",
    ],
  },
];

function parseArgs(argv) {
  const args = {
    mode: "plan",
    rootDir: ROOT,
    ledger: DEFAULT_LEDGER,
    snapshot: "",
    before: "",
    after: "",
    files: "",
    routes: "",
    write: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
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

function splitList(value) {
  return String(value || "")
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRoute(route) {
  const normalized = String(route || "").trim();
  if (!normalized) return "";
  const clean = normalized.split("?")[0].trim();
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function readLedger(rootDir, ledgerRelPath = DEFAULT_LEDGER) {
  const ledgerPath = resolveFromRoot(rootDir, ledgerRelPath);
  if (!fs.existsSync(ledgerPath)) {
    return { lastUpdated: "", entries: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    return {
      lastUpdated: String(raw?.lastUpdated || ""),
      entries: Array.isArray(raw?.entries) ? raw.entries : [],
    };
  } catch {
    return { lastUpdated: "", entries: [] };
  }
}

function matchesTrackedRoute(entry, trackedRoutes) {
  const entryRoute = normalizeRoute(entry?.route);
  if (!trackedRoutes.length) return false;
  return trackedRoutes.some((route) => entryRoute === route || entryRoute.startsWith(`${route}/`));
}

function summarizeEntries(entries, trackedRoutes) {
  const counts = {};
  for (const entry of entries) {
    if (!matchesTrackedRoute(entry, trackedRoutes)) continue;
    const fingerprint = String(entry?.fingerprint || "").trim();
    if (!fingerprint) continue;
    counts[fingerprint] = {
      fingerprint,
      route: normalizeRoute(entry.route),
      message: String(entry.message || ""),
      severity: String(entry.severity || "error"),
      kind: String(entry.kind || ""),
      sourceUrl: String(entry.sourceUrl || ""),
      count: Number(entry.count || 0),
      lastSeen: String(entry.lastSeen || ""),
    };
  }
  return counts;
}

export function inferCommonFrontendRoutes(files) {
  const normalizedFiles = Array.isArray(files) ? files : splitList(files);
  const routes = [];
  const smokeTests = [];
  const matches = [];

  for (const file of normalizedFiles) {
    const normalized = String(file || "").replace(/\\/g, "/").trim();
    for (const surface of COMMON_FRONTEND_SURFACES) {
      if (!surface.match.test(normalized)) continue;
      if (!routes.includes(surface.route)) routes.push(surface.route);
      for (const smokeTest of surface.smokeTests) {
        if (!smokeTests.includes(smokeTest)) smokeTests.push(smokeTest);
      }
      matches.push({
        file: normalized,
        route: surface.route,
        surface: surface.surface,
      });
    }
  }

  return { routes, smokeTests, matches };
}

export function createConsoleSnapshot({ rootDir = ROOT, ledger = DEFAULT_LEDGER, routes = [] } = {}) {
  const trackedRoutes = routes.map(normalizeRoute).filter(Boolean);
  const current = readLedger(rootDir, ledger);
  return {
    generatedAt: new Date().toISOString(),
    ledgerLastUpdated: current.lastUpdated,
    routes: trackedRoutes,
    counts: summarizeEntries(current.entries, trackedRoutes),
  };
}

export function compareConsoleSnapshots({ beforeSnapshot, afterSnapshot } = {}) {
  const beforeCounts = beforeSnapshot?.counts || {};
  const afterCounts = afterSnapshot?.counts || {};
  const newlyObserved = [];

  for (const [fingerprint, after] of Object.entries(afterCounts)) {
    const before = beforeCounts[fingerprint];
    const beforeCount = before ? Number(before.count || 0) : 0;
    const afterCount = Number(after.count || 0);
    if (afterCount <= beforeCount) continue;
    newlyObserved.push({
      ...after,
      deltaCount: afterCount - beforeCount,
      previousCount: beforeCount,
    });
  }

  return {
    pass: newlyObserved.length === 0,
    routes: afterSnapshot?.routes || beforeSnapshot?.routes || [],
    newlyObserved,
    summary: newlyObserved.length === 0
      ? "No newly observed console errors were recorded for the tracked routes in this round."
      : `${newlyObserved.length} newly observed console error fingerprint(s) were recorded for the tracked routes.`,
  };
}

export function buildFrontendConsoleGatePlan(files) {
  const inferred = inferCommonFrontendRoutes(files);
  const smokeCommands = inferred.smokeTests.map(
    (testFile) => `& 'C:\\Program Files\\nodejs\\node.exe' ${testFile.replace(/\//g, "\\")}`,
  );
  return {
    enabled: inferred.routes.length > 0,
    routes: inferred.routes,
    smokeTests: inferred.smokeTests,
    smokeCommands,
    preRoundCommand: inferred.routes.length
      ? `node .tools/auto-hermes-console-gate.mjs --mode snapshot --routes "${inferred.routes.join("||")}" --json`
      : "",
    postRoundCommand: inferred.routes.length
      ? `node .tools/auto-hermes-console-gate.mjs --mode compare --routes "${inferred.routes.join("||")}" --before "<snapshot.json>" --after "<snapshot.json>" --json`
      : "",
    summary: inferred.routes.length
      ? `Track console delta on ${inferred.routes.join(", ")} and run ${inferred.smokeTests.length} inferred smoke test(s).`
      : "No common frontend routes were inferred from the touched files.",
    matches: inferred.matches,
  };
}

function writeSnapshotIfRequested(targetPath, snapshot) {
  if (!targetPath) return;
  const resolved = path.resolve(targetPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(snapshot, null, 2), "utf8");
}

function readSnapshot(targetPath) {
  if (!targetPath) return null;
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) return null;
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    return null;
  }
}

export function runAutoHermesConsoleGate(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  const routes = splitList(args.routes).map(normalizeRoute).filter(Boolean);

  let result;
  if (args.mode === "snapshot") {
    const snapshot = createConsoleSnapshot({
      rootDir: args.rootDir,
      ledger: args.ledger,
      routes,
    });
    if (args.write && args.snapshot) {
      writeSnapshotIfRequested(args.snapshot, snapshot);
    }
    result = snapshot;
  } else if (args.mode === "compare") {
    const beforeSnapshot = readSnapshot(args.before);
    const afterSnapshot = args.after
      ? readSnapshot(args.after)
      : createConsoleSnapshot({ rootDir: args.rootDir, ledger: args.ledger, routes });
    result = compareConsoleSnapshots({ beforeSnapshot, afterSnapshot });
  } else {
    result = buildFrontendConsoleGatePlan(splitList(args.files));
  }

  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${result.summary || "ok"}\n`;
  return { result, output };
}

function main() {
  const { output } = runAutoHermesConsoleGate(process.argv.slice(2));
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
