import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAutoHermesSelfLoop } from "./auto-hermes-self-loop.mjs";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-self-loop-"));
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
- [ ] Keep Codex self-loop delegation native
  Files: \`.codex/commands/auto-hermes-self.md\`, \`.tools/auto-hermes-self-loop.mjs\`
  Problem: Codex self-loop must not call repo agent generators.
  Done when: Codex rounds use native subagents or local execution only.
  Verify: \`node .tools/auto-hermes-self-loop.test.mjs\`

## Tech Debt Tasks

## Suggested Next Tasks
`),
      humanLoop: write(".ai-sync/HUMAN_LOOP.md", "# Human Loop\n\n## Current Status\n- Status: active\n"),
      agentSync: write(".ai-sync/AGENT_SYNC.md", "# Cross-Agent Sync\n\n## Active Claims\n- none\n"),
      contextLedger: write(".ai-sync/CONTEXT_LEDGER.md", "# Context Ledger\n"),
      loopState: write(".ai-sync/LOOP_STATE.md", "# Loop State\n"),
    },
  };
}

const commandText = fs.readFileSync(".codex/commands/auto-hermes-self.md", "utf8");
const skillText = fs.readFileSync(".codex/skills/auto-hermes-self/SKILL.md", "utf8");
const hermesSkillText = fs.readFileSync(".codex/skills/hermes-dev/SKILL.md", "utf8");
const agentsText = fs.readFileSync("AGENTS.md", "utf8");
const runtimeRulesText = fs.readFileSync("docs/repo-rules/runtime-and-workflow.md", "utf8");
const dailyGuideText = fs.readFileSync("docs/auto-hermes/daily-operator-guide.md", "utf8");
const architectureText = fs.readFileSync(".codex/workflows/auto-hermes-architecture.md", "utf8");
const sharedContractText = fs.readFileSync(".codex/workflows/auto-hermes-shared-contract.md", "utf8");
const selfLoopHelperText = fs.readFileSync(".tools/auto-hermes-self-loop.mjs", "utf8");
const autoHermesLoopText = fs.readFileSync(".tools/auto-hermes-loop.mjs", "utf8");
const opencodePluginText = fs.readFileSync(".opencode/hermes-plugin.ts", "utf8");
const opencodeSelfSection = opencodePluginText.slice(opencodePluginText.indexOf(`"auto-hermes-self"`));

assert.match(commandText, /Codex-native subagents/);
assert.match(commandText, /multi_agent_v1\.spawn_agent/);
assert.match(commandText, /do not run repo agent-generation helpers such as `\.tools\/generate-codex\.js`/);
assert.match(commandText, /Do not run `\.tools\/generate-codex\.js`, external agent generators, or helper-generated agent execution paths/);
assert.match(commandText, /AUTO_HERMES_SELF_CONTROLLER\.json/);
assert.doesNotMatch(commandText, /child-agent delegation/);
assert.doesNotMatch(commandText, /generated self-loop artifact/);
assert.match(skillText, /Codex-native subagents/);
assert.match(skillText, /do not run repo agent-generation helpers such as `\.tools\/generate-codex\.js`/);
assert.match(skillText, /spawn native Codex subagents with `multi_agent_v1\.spawn_agent`/);
assert.match(hermesSkillText, /Exception for `\/auto-hermes-self`: do not run `\.tools\/generate-codex\.js`/);
assert.match(hermesSkillText, /multi_agent_v1\.spawn_agent/);
assert.match(agentsText, /Exception: for `\/auto-hermes-self`, skip `\.tools\/generate-codex\.js`/);
assert.match(runtimeRulesText, /`\/auto-hermes-self` is the exception:[\s\S]*multi_agent_v1\.spawn_agent/);
assert.match(dailyGuideText, /For `\/auto-hermes-self`, do not run `\.tools\/generate-codex\.js`/);
assert.match(architectureText, /`\/auto-hermes-self` is the exception:[\s\S]*multi_agent_v1\.spawn_agent/);
assert.match(sharedContractText, /`\/auto-hermes-self` is the exception:[\s\S]*multi_agent_v1\.spawn_agent/);
assert.match(opencodeSelfSection, /\/auto-hermes-self must not run generate-codex\.js/);
assert.doesNotMatch(opencodeSelfSection, /node \.tools\/generate-codex\.js/);

const fixture = makeFixture();
const result = runAutoHermesSelfLoop({
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
  outputJson: path.join(fixture.dir, ".ai-sync", "self-loop.json"),
  outputMd: path.join(fixture.dir, ".ai-sync", "self-loop.md"),
  coordinatorJson: path.join(fixture.dir, ".ai-sync", "self-coordinator.json"),
  coordinatorMd: path.join(fixture.dir, ".ai-sync", "self-coordinator.md"),
  promptFile: path.join(fixture.dir, ".ai-sync", "self-prompt.md"),
  loopStateJson: path.join(fixture.dir, ".ai-sync", "self-loop-state.json"),
  controllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
  controllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
  promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
  promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
  roundResultJson: path.join(fixture.dir, ".ai-sync", "round-result.json"),
});

assert.equal(result.state.selfExecutionContract, "parent-codex-native-subagents");
assert.equal(result.state.codexNativeSubagentPolicy?.executorPolicy, "parent-codex-native-subagents-only");
assert.deepEqual(result.state.codexNativeSubagentPolicy?.forbiddenGenerators, [
  ".tools/generate-codex.js",
  ".tools/auto-hermes-loop.mjs helper-generated agents",
  "external repo agent-generation helpers",
]);

const coordinator = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "self-coordinator.md"), "utf8");
const prompt = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "self-prompt.md"), "utf8");
assert.match(coordinator, /## Codex Native Subagent Policy/);
assert.match(coordinator, /Agent surface: Codex-native subagents/);
assert.match(coordinator, /never run \.tools\/generate-codex\.js, external repo agent generators, or helper-generated agent execution paths/);
assert.match(prompt, /## Codex Native Subagent Policy/);
assert.match(prompt, /Executor policy: parent-codex-native-subagents-only/);
assert.match(prompt, /multi_agent_v1\.spawn_agent/);
assert.doesNotMatch(selfLoopHelperText, /dispatch specialist agents per team model/);
assert.match(autoHermesLoopText, /parentCodexCoordinatorOnly: Boolean\(args\.parentCodexCoordinatorOnly && args\.runtime === "codex"\)/);
assert.match(autoHermesLoopText, /--parent-codex-coordinator-only[\s\S]*args\.parentCodexCoordinatorOnly = true/);
assert.match(autoHermesLoopText, /Repo-Local \/ Generated Agents Disabled/);
assert.match(autoHermesLoopText, /parent Codex session executes the round directly[\s\S]*multi_agent_v1\.spawn_agent/);

console.log("PASS auto-hermes-self-loop");
