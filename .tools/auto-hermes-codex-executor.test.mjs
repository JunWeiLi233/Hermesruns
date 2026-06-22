import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAutoHermesLoop } from "./auto-hermes-loop.mjs";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-codex-executor-"));
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
- [ ] Repair auto-hermes self-loop executor prompt handling
  Files: \`.tools/auto-hermes-loop.mjs\`
  Problem: workflow
  Context: The Codex worker executor should run unattended.
  Done when: The dry-run coordinator records a non-interactive Codex executor.
  Verify: \`node .tools/auto-hermes-codex-executor.test.mjs\`

## Tech Debt Tasks

## Suggested Next Tasks
`),
      humanLoop: write(".ai-sync/HUMAN_LOOP.md", "# Human Loop\n\n## Current Status\n- Status: active\n"),
      agentSync: write(".ai-sync/AGENT_SYNC.md", "# Cross-Agent Sync\n\n## Active Claims\n- none\n"),
      contextLedger: write(".ai-sync/CONTEXT_LEDGER.md", "# Context Ledger\n"),
      loopState: write(".ai-sync/LOOP_STATE.md", "# Loop State\n"),
      omxBridge: write(".ai-sync/OMX_AUTO_HERMES_BRIDGE.json", JSON.stringify({ autoReady: false }, null, 2)),
    },
  };
}

const fixture = makeFixture();
const { state } = runAutoHermesLoop({
  json: true,
  dryRun: true,
  write: true,
  runtime: "codex",
  maxRounds: 1,
  tasks: fixture.files.tasks,
  humanLoop: fixture.files.humanLoop,
  agentSync: fixture.files.agentSync,
  contextLedger: fixture.files.contextLedger,
  loopState: fixture.files.loopState,
  omxBridgeJson: fixture.files.omxBridge,
  controllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
  controllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
  promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
  promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
  outputJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
  outputMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
  coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
  coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
  promptFile: path.join(fixture.dir, ".ai-sync", "prompt.md"),
  loopStateJson: path.join(fixture.dir, ".ai-sync", "loop-state.json"),
});

if (!state.executorLabel) {
  console.log("SKIP auto-hermes-codex-executor: Codex CLI is not installed");
  process.exit(0);
}

assert.match(state.executorLabel, /codex-yolo-noninteractive/);
assert.match(state.executorPermissionFlag, /--dangerously-bypass-approvals-and-sandbox/);

const coordinator = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "coordinator.md"), "utf8");
assert.match(coordinator, /Executor Permission: yolo/);
assert.match(coordinator, /--dangerously-bypass-approvals-and-sandbox/);

if (state.executorLabel.startsWith("global-")) {
  assert.match(state.executorPermissionFlag, /--dangerously-bypass-hook-trust/);
  assert.match(coordinator, /--dangerously-bypass-hook-trust/);
}

console.log("PASS auto-hermes-codex-executor");
