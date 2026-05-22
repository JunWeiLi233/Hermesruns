import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const controllerModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-controller.mjs")).href;
const loopModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-loop.mjs")).href;
const roundCloseModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-round-close.mjs")).href;

const { runAutoHermesController } = await import(controllerModuleUrl);
const { runAutoHermesLoop } = await import(loopModuleUrl);
const { runAutoHermesRoundClose } = await import(roundCloseModuleUrl);

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
  Files: \`frontend/src/pages/AddShoes.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: The route must keep the brand deck stable and console-clean.
  Done when: The Add Shoes page renders without browser crashes and keeps the logo deck stable.
  Verify: \`cd frontend && npm run build\`

## Tech Debt Tasks

## Suggested Next Tasks
`),
      humanLoop: write(".ai-sync/HUMAN_LOOP.md", `# Human Loop

## Current Status
- Status: active

## Agent Mode
- Mode: autonomous-loop

## Agent Writeback Format
- Last round verdict: pass
- Current owned surface: AddShoes
- Next intended round: Add Shoes page throws in the browser before the brand deck finishes loading
`),
      agentSync: write(".ai-sync/AGENT_SYNC.md", `# Cross-Agent Sync

## Active Claims
- none

## Recently Completed
- none

## Must-Fix Queue
- none
`),
      contextLedger: write(".ai-sync/CONTEXT_LEDGER.md", `# Context Ledger

## Surface Capsules
### AddShoes
- Goal: Keep /shoes/add stable.
`),
      loopState: write(".ai-sync/LOOP_STATE.md", "# Loop State\n"),
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
    outputJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
  });

  assert.equal(result.frontendGuard.enabled, true);
  assert.deepEqual(result.frontendGuard.routes, ["/shoes/add"]);
  assert.deepEqual(result.frontendGuard.smokeTests, [
    "frontend/src/pages/addShoesKineticEditorial.smoke.test.js",
    "frontend/src/pages/addShoesBrowserBrandInit.smoke.test.js",
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
    controllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    controllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "prompt.md"),
  });

  assert.equal(state.status, "dry-run-complete");
  const prompt = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "prompt.md"), "utf8");
  assert.match(prompt, /Frontend console guard:/);
  assert.match(prompt, /\/shoes\/add/);
  assert.match(prompt, /--console-clean pass/);
  assert.match(prompt, /addShoesKineticEditorial\.smoke\.test\.js/);
}

{
  const fixture = makeFixture();
  const roundResultJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_ROUND_RESULT.json");
  const roundResultMd = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_ROUND_RESULT.md");

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
    controllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    controllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
    loopJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
    loopMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "prompt.md"),
    roundResultJson,
    roundResultMd,
    task: "Add Shoes page throws in the browser before the brand deck finishes loading",
    surface: "AddShoes",
    owner: "frontend",
    files: "frontend/src/pages/AddShoes.jsx",
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
