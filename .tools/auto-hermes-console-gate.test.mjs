import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-console-gate.mjs")).href;
const {
  inferCommonFrontendRoutes,
  createConsoleSnapshot,
  compareConsoleSnapshots,
  buildFrontendConsoleGatePlan,
} = await import(moduleUrl);

{
  const result = inferCommonFrontendRoutes([
    "frontend/src/pages/AddShoes.jsx",
    "frontend/src/pages/TodayRun.jsx",
    "frontend/src/pages/Runs.jsx",
  ]);

  assert.deepEqual(result.routes, ["/shoes/add", "/today-run", "/runs"]);
  assert.deepEqual(result.smokeTests, [
    "frontend/src/pages/addShoesKineticEditorial.smoke.test.js",
    "frontend/src/pages/addShoesBrowserBrandInit.smoke.test.js",
    "frontend/src/utils/todayRunCoachDistance.smoke.test.js",
    "frontend/src/utils/todayRunAcwrNarrative.smoke.test.js",
    "frontend/src/pages/runsRoutePreviewCache.smoke.test.js",
  ]);
}

{
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ah-console-"));
  const ledgerDir = path.join(rootDir, ".ai-sync");
  fs.mkdirSync(ledgerDir, { recursive: true });
  const ledgerPath = path.join(ledgerDir, "LOCAL_CONSOLE_ERRORS.json");

  fs.writeFileSync(ledgerPath, JSON.stringify({
    lastUpdated: "2026-04-21T00:00:00.000Z",
    entries: [
      {
        fingerprint: "a",
        route: "/shoes/add",
        message: "ReferenceError",
        severity: "error",
        kind: "window.error",
        count: 1,
        lastSeen: "2026-04-21T00:00:00.000Z",
      },
      {
        fingerprint: "b",
        route: "/analysis",
        message: "Ignored",
        severity: "error",
        kind: "window.error",
        count: 9,
        lastSeen: "2026-04-21T00:00:00.000Z",
      },
    ],
  }, null, 2), "utf8");

  const beforeSnapshot = createConsoleSnapshot({
    rootDir,
    routes: ["/shoes/add"],
  });
  assert.equal(Object.keys(beforeSnapshot.counts).length, 1);

  fs.writeFileSync(ledgerPath, JSON.stringify({
    lastUpdated: "2026-04-21T00:01:00.000Z",
    entries: [
      {
        fingerprint: "a",
        route: "/shoes/add",
        message: "ReferenceError",
        severity: "error",
        kind: "window.error",
        count: 3,
        lastSeen: "2026-04-21T00:01:00.000Z",
      },
      {
        fingerprint: "c",
        route: "/shoes/add",
        message: "NewError",
        severity: "error",
        kind: "window.error",
        count: 1,
        lastSeen: "2026-04-21T00:01:00.000Z",
      },
    ],
  }, null, 2), "utf8");

  const afterSnapshot = createConsoleSnapshot({
    rootDir,
    routes: ["/shoes/add"],
  });
  const compared = compareConsoleSnapshots({ beforeSnapshot, afterSnapshot });
  assert.equal(compared.pass, false);
  assert.deepEqual(compared.newlyObserved.map((entry) => entry.fingerprint).sort(), ["a", "c"]);
}

{
  const plan = buildFrontendConsoleGatePlan("frontend/src/pages/AddShoes.jsx||frontend/src/pages/Runs.jsx");
  assert.equal(plan.enabled, true);
  assert.deepEqual(plan.routes, ["/shoes/add", "/runs"]);
  assert.equal(plan.smokeCommands.length, 3);
  assert.match(plan.summary, /Track console delta/);
}

console.log("PASS auto-hermes-console-gate");
