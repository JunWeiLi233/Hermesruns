import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-structure-update-"));
  const write = (relPath, content) => {
    const target = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    return target;
  };

  write("TASKS.md", `# Hermes Tasks

## Active Tasks

## Blocked Tasks

## Suggested Next Tasks
- [ ] Existing suggested task
  Files: \`frontend/src/pages/ProfileDashboard.jsx\`
  Context: Existing queue item.
  Done when: Existing queue item still exists.
  Verify: \`cd frontend && npm run build\`

## Tech Debt Tasks

## Daily Log
`);

  write(".ai-sync/HUMAN_LOOP.md", `## Current Status
- Status: autonomous

## Agent Mode
- Mode: autonomous-loop

## Agent Writeback Format
- Current owned surface: none
- Next intended round: none
`);

  write(".ai-sync/AGENT_SYNC.md", `# Cross-Agent Sync

## Active Claims
- none
`);

  write(".ai-sync/CONTEXT_LEDGER.md", "# Context Ledger\n");
  write(".tools/auto-hermes-controller.mjs", "export function runAutoHermesController() { return null; }\n");
  write("docs/auto-hermes/index.md", "# Auto-Hermes Record System\n");
  write(".codex/workflows/auto-hermes-architecture.md", "# Auto-Hermes Architecture\n");
  write("frontend/src/utils/copilotPromptFiles.smoke.test.js", "console.log('stub');\n");

  return { dir, write };
}

function check(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`);
    })
    .catch((error) => {
      console.error(`FAIL ${name}`);
      console.error(error instanceof Error ? error.stack : error);
      process.exitCode = 1;
    });
}

const structureModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-structure-update.mjs")).href;
const controllerModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-controller.mjs")).href;

check("detects runtime parity, steering, owner-map, and coverage gaps", async () => {
  const { runAutoHermesStructureUpdate } = await import(structureModuleUrl);
  const fixture = makeFixture();

  const { report } = runAutoHermesStructureUpdate({
    rootDir: fixture.dir,
    write: false,
    maxTasks: 4,
  });

  assert.equal(report.status, "ready");
  assert.ok(report.shortlist.some((task) => task.structureClass === "runtime-parity-gap"));
  assert.ok(report.shortlist.some((task) => task.structureClass === "steering-gap"));
  assert.ok(report.shortlist.some((task) => task.structureClass === "owner-map-drift"));
  assert.ok(report.shortlist.some((task) => task.structureClass === "verification-gap"));
  assert.equal(report.steering.recommendedDefault.title, "Expose /auto-hermes-structure-update across Hermes runtimes");
});

check("writeback prepends a dedicated structure subsection and writes the steering brief", async () => {
  const { runAutoHermesStructureUpdate } = await import(structureModuleUrl);
  const fixture = makeFixture();

  const { report } = runAutoHermesStructureUpdate({
    rootDir: fixture.dir,
    write: true,
    maxTasks: 4,
  });

  const tasksContent = fs.readFileSync(path.join(fixture.dir, "TASKS.md"), "utf8");
  const briefJson = JSON.parse(fs.readFileSync(path.join(fixture.dir, ".ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.json"), "utf8"));

  assert.match(tasksContent, /## Suggested Next Tasks\s+### Structure Update Recommendations[\s\S]*Structure Update Default: yes/);
  assert.match(tasksContent, /Existing suggested task/);
  assert.equal(report.writeback.tasksUpdated, true);
  assert.equal(briefJson.steering.recommendedDefault.title, "Expose /auto-hermes-structure-update across Hermes runtimes");
});

check("controller prefers the structure-update default on the next eligible round when no active work exists", async () => {
  const { runAutoHermesController } = await import(controllerModuleUrl);
  const fixture = makeFixture();

  fixture.write(".tools/auto-hermes-controller.mjs", fs.readFileSync(path.resolve(".tools/auto-hermes-controller.mjs"), "utf8"));
  fixture.write(".tools/auto-hermes-task-meta.mjs", fs.readFileSync(path.resolve(".tools/auto-hermes-task-meta.mjs"), "utf8"));
  fixture.write(".tools/auto-hermes-claim-state.mjs", fs.readFileSync(path.resolve(".tools/auto-hermes-claim-state.mjs"), "utf8"));
  fixture.write(".tools/auto-hermes-task-claims.mjs", fs.readFileSync(path.resolve(".tools/auto-hermes-task-claims.mjs"), "utf8"));
  fixture.write(".tools/auto-hermes-subagent-catalog.mjs", fs.readFileSync(path.resolve(".tools/auto-hermes-subagent-catalog.mjs"), "utf8"));
  fixture.write(".tools/auto-hermes-website-audit.mjs", fs.readFileSync(path.resolve(".tools/auto-hermes-website-audit.mjs"), "utf8"));
  fixture.write(".tools/auto-hermes-config.json", fs.readFileSync(path.resolve(".tools/auto-hermes-config.json"), "utf8"));
  fixture.write(".ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.json", JSON.stringify({
    status: "ready",
    generatedAt: new Date().toISOString(),
    freshness: {
      staleAfterHours: 72,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    steering: {
      mode: "next-eligible-round",
      advisory: true,
      respectsActiveQueue: true,
      recommendedDefault: {
        title: "Teach auto-hermes to honor structure-update steering briefs",
        source: "suggested-task",
      },
    },
  }, null, 2));

  fixture.write("TASKS.md", `# Hermes Tasks

## Active Tasks

## Blocked Tasks

## Suggested Next Tasks
### Structure Update Recommendations
- [ ] Existing non-default structure task
  Files: \`docs/auto-hermes/index.md\`
  Context: Lower-priority task.
  Done when: Lower-priority task done.
  Verify: \`node .tools/auto-hermes-structure-update.test.mjs\`

- [ ] Teach auto-hermes to honor structure-update steering briefs
  Files: \`.tools/auto-hermes-controller.mjs\`, \`.ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.json\`
  Context: Preferred structure task.
  Done when: Controller uses the structure brief.
  Verify: \`node .tools/auto-hermes-structure-update.test.mjs\`

## Tech Debt Tasks

## Daily Log
`);

  const { result } = runAutoHermesController({
    rootDir: fixture.dir,
    tasks: path.join(fixture.dir, "TASKS.md"),
    humanLoop: path.join(fixture.dir, ".ai-sync/HUMAN_LOOP.md"),
    agentSync: path.join(fixture.dir, ".ai-sync/AGENT_SYNC.md"),
    contextLedger: path.join(fixture.dir, ".ai-sync/CONTEXT_LEDGER.md"),
    loopState: path.join(fixture.dir, ".ai-sync/LOOP_STATE.md"),
    structureUpdateJson: path.join(fixture.dir, ".ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.json"),
  });

  assert.equal(result.title, "Teach auto-hermes to honor structure-update steering briefs");
  assert.equal(result.structureUpdate.applied, true);
});

check("runtime adapters and repo-side registrations expose auto-hermes-structure-update", async () => {
  const requiredFiles = [
    ".codex/commands/auto-hermes-structure-update.md",
    ".codex/workflows/auto-hermes-structure-update-contract.md",
    ".claude/commands/auto-hermes-structure-update.md",
    ".opencode/commands/auto-hermes-structure-update.md",
    ".gemini/commands/auto-hermes-structure-update.toml",
    ".github/prompts/auto-hermes-structure-update.prompt.md",
  ];

  for (const relPath of requiredFiles) {
    assert.equal(fs.existsSync(path.resolve(relPath)), true, `${relPath} should exist`);
  }

  const opencodePlugin = fs.readFileSync(path.resolve(".opencode/hermes-plugin.ts"), "utf8");
  const installer = fs.readFileSync(path.resolve(".tools/install-hermes-codex-commands.ps1"), "utf8");
  const copilotInstructions = fs.readFileSync(path.resolve(".github/copilot-instructions.md"), "utf8");

  assert.match(opencodePlugin, /auto-hermes-structure-update/);
  assert.match(installer, /auto-hermes\*\.md/);
  assert.match(installer, /\.codex\\commands/);
  assert.doesNotMatch(installer, /sourcePluginDir/);
  assert.doesNotMatch(installer, /\.codex-plugin/);
  assert.match(copilotInstructions, /\/auto-hermes-structure-update/);
});
