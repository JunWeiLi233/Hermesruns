import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runFixtureRoundClose as runAutoHermesRoundClose } from "./test-support/round-close-fixture.mjs";

const controllerModuleUrl = pathToFileURL(path.resolve("tools/auto-hermes-controller.mjs")).href;
const loopModuleUrl = pathToFileURL(path.resolve("tools/auto-hermes-loop.mjs")).href;

const { runAutoHermesController } = await import(controllerModuleUrl);
const { runAutoHermesLoop } = await import(loopModuleUrl);

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-console-aware-"));
  const write = (name, content) => {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    return target;
  };

  return {
    dir,
    files: {
      tasks: write("TASKS.md", `# Hermes Tasks

## Active Tasks
- [ ] Add Shoes page throws in the browser before the brand deck finishes loading
  Files: \`frontend/src/pages/shoes/AddShoes.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: The route must keep the brand deck stable and console-clean.
  Done when: The Add Shoes page renders without browser crashes and keeps the logo deck stable.
  Verify: \`cd frontend && npm run build\`

## Tech Debt Tasks

## Suggested Next Tasks
`),
      humanLoop: write(".workspace/state/HUMAN_LOOP.md", `# Human Loop

## Current Status
- Status: active

## Agent Mode
- Mode: autonomous-loop

## Agent Writeback Format
- Last round verdict: pass
- Current owned surface: AddShoes
- Next intended round: Add Shoes page throws in the browser before the brand deck finishes loading
`),
      agentSync: write(".workspace/state/AGENT_SYNC.md", `# Cross-Agent Sync

## Active Claims
- none

## Recently Completed
- none

## Must-Fix Queue
- none
`),
      contextLedger: write(".workspace/state/CONTEXT_LEDGER.md", `# Context Ledger

## Surface Capsules
### AddShoes
- Goal: Keep /shoes/add stable.
`),
      loopState: write(".workspace/state/LOOP_STATE.md", "# Loop State\n"),
    },
  };
}

{
  const fixture = makeFixture();
  const { result } = runAutoHermesController({
    json: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    outputJson: path.join(fixture.dir, ".workspace/state", "controller.json"),
    outputMd: path.join(fixture.dir, ".workspace/state", "controller.md"),
  });

  assert.equal(result.frontendGuard.enabled, true);
  assert.deepEqual(result.frontendGuard.routes, ["/shoes/add"]);
  assert.deepEqual(result.frontendGuard.smokeTests, [
    "frontend/src/pages/shoes/__tests__/addShoesKineticEditorial.smoke.test.js",
    "frontend/src/pages/shoes/__tests__/addShoesBrowserBrandInit.smoke.test.js",
  ]);
}

{
  const fixture = makeFixture();
  const { state } = runAutoHermesLoop({
    json: true,
    dryRun: true,
    write: true,
    maxRounds: 1,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    controllerJson: path.join(fixture.dir, ".workspace/state", "controller.json"),
    controllerMd: path.join(fixture.dir, ".workspace/state", "controller.md"),
    promotionJson: path.join(fixture.dir, ".workspace/state", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".workspace/state", "promotion.md"),
    outputJson: path.join(fixture.dir, ".workspace/state", "loop.json"),
    outputMd: path.join(fixture.dir, ".workspace/state", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".workspace/state", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".workspace/state", "coordinator.md"),
    promptFile: path.join(fixture.dir, ".workspace/state", "prompt.md"),
  });

  assert.equal(state.status, "dry-run-complete");
  const prompt = fs.readFileSync(path.join(fixture.dir, ".workspace/state", "prompt.md"), "utf8");
  assert.match(prompt, /Frontend console guard:/);
  assert.match(prompt, /\/shoes\/add/);
  assert.match(prompt, /--console-clean pass/);
  assert.match(prompt, /addShoesKineticEditorial\.smoke\.test\.js/);
}

{
  const fixture = makeFixture();
  const roundResultJson = path.join(fixture.dir, ".workspace/state", "AUTO_HERMES_ROUND_RESULT.json");
  const roundResultMd = path.join(fixture.dir, ".workspace/state", "AUTO_HERMES_ROUND_RESULT.md");

  const { result } = runAutoHermesRoundClose({
    write: true,
    refreshController: false,
    refreshLoopBriefs: false,
    refreshFinish: false,
    selfCheck: false,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    agentSyncMd: fixture.files.agentSync,
    controllerJson: path.join(fixture.dir, ".workspace/state", "controller.json"),
    controllerMd: path.join(fixture.dir, ".workspace/state", "controller.md"),
    promotionJson: path.join(fixture.dir, ".workspace/state", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".workspace/state", "promotion.md"),
    loopJson: path.join(fixture.dir, ".workspace/state", "loop.json"),
    loopMd: path.join(fixture.dir, ".workspace/state", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".workspace/state", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".workspace/state", "coordinator.md"),
    promptFile: path.join(fixture.dir, ".workspace/state", "prompt.md"),
    roundResultJson,
    roundResultMd,
    task: "Add Shoes page throws in the browser before the brand deck finishes loading",
    surface: "AddShoes",
    owner: "frontend",
    files: "frontend/src/pages/shoes/AddShoes.jsx",
    summary: "Attempted to close a frontend round while new console errors still existed on /shoes/add.",
    goal: "Keep AddShoes stable and console-clean.",
    preserve: "Existing Add Shoes workflow.",
    risk: "New browser console errors would ship unnoticed.",
    verify: "cd frontend && npm run build",
    verifyResult: "pass",
    runtimeProof: "pass",
    consoleClean: "fail",
    consoleSummary: "1 newly observed console error on /shoes/add",
    consoleObservedCount: "1",
    architectVerdict: "approved",
    deslopPass: "pass",
    regressionPass: "pass",
    review: "approve-next-round",
    verdict: "pass",
  });

  assert.equal(result.ralphGate.gates.consoleClean, "fail");
  assert.equal(result.verdict, "must-fix");
  assert.equal(result.review, "ralph-gate-must-fix");
  const roundResult = JSON.parse(fs.readFileSync(roundResultJson, "utf8"));
  assert.equal(roundResult.verdict, "must-fix");
  assert.equal(roundResult.ralphGate.gates.consoleClean, "fail");
  const markdown = fs.readFileSync(roundResultMd, "utf8");
  assert.match(markdown, /Console Clean: fail/);
  assert.match(markdown, /New Console Errors: 1/);
}

console.log("PASS auto-hermes-console-aware-flow");
