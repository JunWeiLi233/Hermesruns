import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAutoHermesLoop } from "./auto-hermes-loop.mjs";
import { runAutoHermesMax } from "./auto-hermes-max.mjs";

function makeFixture(taskBlock) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-prompt-compact-"));
  const write = (name, content) => {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    return target;
  };

  const files = {
    tasks: write("TASKS.md", `# Hermes Tasks

## Active Tasks
${taskBlock}

## Tech Debt Tasks

## Suggested Next Tasks
`),
    humanLoop: write(".ai-sync/HUMAN_LOOP.md", `# Human Loop

## Current Status
- Status: active

## Agent Mode
- Mode: autonomous-loop

## Agent Writeback Format
- Current owned surface: none
- Next intended round: none
`),
    agentSync: write(".ai-sync/AGENT_SYNC.md", `# Cross-Agent Sync

## Active Claims
- none
`),
    contextLedger: write(".ai-sync/CONTEXT_LEDGER.md", "# Context Ledger\n"),
    loopState: write(".ai-sync/LOOP_STATE.md", "# Loop State\n"),
  };

  return { dir, files };
}

{
  const fixture = makeFixture(`- [ ] Analysis page has no visible empty state
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Context: Compact prompt should keep the executable surface and reference detailed artifacts.
  Done when: The worker prompt stays concise without losing selected task details.
  Verify: \`cd frontend && npm run build\``);
  const controllerJson = path.join(fixture.dir, ".ai-sync", "controller.json");
  const promptFile = path.join(fixture.dir, ".ai-sync", "prompt.md");

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
    controllerJson,
    controllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
    promptFile,
  });

  assert.equal(state.status, "dry-run-complete");
  const prompt = fs.readFileSync(promptFile, "utf8");
  assert.ok(prompt.length < 9000, `worker prompt should stay compact, got ${prompt.length} chars`);
  assert.match(prompt, /Controller JSON:/);
  assert.match(prompt, new RegExp(controllerJson.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(prompt, /Selected work unit:/);
  assert.match(prompt, /Authority file: design\.md/);
  assert.match(prompt, /Required gates before pass:/);
  assert.doesNotMatch(prompt, /installed agents:/i);
  assert.doesNotMatch(prompt, /Repo-local external Codex agents:/);
}

{
  const fixture = makeFixture(`- [ ] Compact auto-hermes workflow prompts
  Files: \`.tools/auto-hermes-loop.mjs\`, \`.tools/auto-hermes-max.mjs\`
  Problem: workflow
  Context: Max lane prompts should carry ownership, gates, and result contract without repeating long policy text.
  Done when: The lane prompt references artifacts and stays compact.
  Verify: \`node .tools/auto-hermes-prompt-compact.test.mjs\``);
  const lanesDir = path.join(fixture.dir, ".ai-sync", "lanes");
  const planFile = path.join(fixture.dir, ".ai-sync", "max-plan.json");
  fs.mkdirSync(path.dirname(planFile), { recursive: true });
  fs.writeFileSync(planFile, JSON.stringify({
    parentGoal: "Compact auto-hermes prompt payloads",
    preserve: [],
    laneSelection: {
      strategy: "auto",
      minLaneCount: 1,
      maxLaneCount: 5,
    },
    lanes: [
      {
        laneId: "lane-1",
        goal: "Compact the max lane prompt",
        ownedFiles: [".tools/auto-hermes-max.mjs"],
        mustPreserve: ["result packet contract"],
        verify: "node .tools/auto-hermes-prompt-compact.test.mjs",
        effort: "small",
      },
    ],
  }, null, 2), "utf8");

  const { state } = runAutoHermesMax({
    json: true,
    write: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    planFile,
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "max-coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "max-coordinator.md"),
    explorerJson: path.join(fixture.dir, ".ai-sync", "max-explorer.json"),
    explorerMd: path.join(fixture.dir, ".ai-sync", "max-explorer.md"),
    mergeJson: path.join(fixture.dir, ".ai-sync", "max-merge.json"),
    mergeMd: path.join(fixture.dir, ".ai-sync", "max-merge.md"),
    lanesDir,
    resultsDir: path.join(fixture.dir, ".ai-sync", "results"),
  });

  assert.equal(state.status, "ready-to-launch");
  const lanePrompt = fs.readFileSync(path.join(lanesDir, "lane-1.md"), "utf8");
  assert.ok(lanePrompt.length < 3500, `lane prompt should stay compact, got ${lanePrompt.length} chars`);
  assert.match(lanePrompt, /## Contract/);
  assert.match(lanePrompt, /## Gates/);
  assert.match(lanePrompt, /## Result Contract/);
  assert.match(lanePrompt, /Result File:/);
  assert.doesNotMatch(lanePrompt, /Final Checklist Before Writing Result/);
  assert.doesNotMatch(lanePrompt, /NO 'should work' claims/);
}

console.log("PASS auto-hermes-prompt-compact");
