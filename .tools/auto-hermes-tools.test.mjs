import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runAutoHermesController } from "./auto-hermes-controller.mjs";
import { runAutoHermesFinish } from "./auto-hermes-finish.mjs";
import { runAutoHermesLoop } from "./auto-hermes-loop.mjs";
import { runAutoHermesMax } from "./auto-hermes-max.mjs";
import { runAutoHermesMaxLoop } from "./auto-hermes-max-loop.mjs";
import { runAutoHermesSelfLoop } from "./auto-hermes-self-loop.mjs";
import { createAutoHermesSupervisorState, evaluateAutoHermesSupervisorRound } from "./auto-hermes-supervisor.mjs";
import { acquireTaskClaim, taskClaimKey } from "./auto-hermes-task-claims.mjs";
import { runAutoHermesRoundClose, shouldExecuteFinishCommit, shouldExecuteFinishPush, syncQueueWithController } from "./auto-hermes-round-close.mjs";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-"));
  const write = (name, content) => {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    return target;
  };

  const files = {
    tasks: write("TASKS.md", `# Hermes Tasks

## Active Tasks
- [ ] GarminConnectController has no unit test file — auth and validation edge cases are untested
  Context: Auto-suggested from codebase analysis (missing_test)
  Done when: the issue described above is resolved and verified
  Verify: \`cd backend && ./mvnw test\`

## Tech Debt Tasks

## Suggested Next Tasks
`),
    humanLoop: write(".ai-sync/HUMAN_LOOP.md", `# Human Loop

## Current Status
- Status: active

## Agent Mode
- Mode: autonomous-loop

## Agent Writeback Format
- Last round verdict: pass - previous frontend round
- Current owned surface: Analysis
- Next intended round: Analysis page has no visible empty state (active-task) on Analysis
- Self-loop state: continue-self-loop - promoted next bounded round: Analysis page has no visible empty state
`),
    agentSync: write(".ai-sync/AGENT_SYNC.md", `# Cross-Agent Sync

## Active Claims
- none

## Recently Completed
- none

## Must-Fix Queue
- none

## Human Inbox
- none
`),
    contextLedger: write(".ai-sync/CONTEXT_LEDGER.md", `# Context Ledger

## Surface Capsules
### Analysis
- Goal: Keep analysis useful.
`),
    loopState: write(".ai-sync/LOOP_STATE.md", "# Loop State\n"),
  };

  return { dir, files };
}

function writeFixtureFile(baseDir, name, content) {
  const target = path.join(baseDir, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return target;
}

function makeControllerFixture(taskBlock) {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks
${taskBlock}

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");
  return fixture;
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

check("catalog helper reports repo-local VoltAgent installs and safe fallback when manifest is missing", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-subagent-catalog.mjs")).href;
  const { loadVoltAgentCatalog } = await import(moduleUrl);

  const fixture = makeFixture();
  const emptyCatalog = loadVoltAgentCatalog({
    rootDir: fixture.dir,
    manifestPath: ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json",
    agentsDir: ".codex/agents",
  });

  assert.equal(emptyCatalog.available, false);
  assert.equal(emptyCatalog.mode, "repo-local-codex-only");
  assert.deepEqual(emptyCatalog.installedNames, []);

  writeFixtureFile(fixture.dir, ".codex/agents/voltagent-spring-boot-engineer.toml", `name = "voltagent-spring-boot-engineer"
description = "Spring specialist"
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"

[instructions]
text = """
Spring helper
"""
`);
  writeFixtureFile(fixture.dir, ".codex/agents/voltagent-react-specialist.toml", `name = "voltagent-react-specialist"
description = "React specialist"
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"

[instructions]
text = """
React helper
"""
`);
  writeFixtureFile(fixture.dir, ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json", JSON.stringify({
    sourceRepo: "https://github.com/VoltAgent/awesome-codex-subagents",
    mode: "repo-local-codex-only",
    installedAgents: [
      {
        repoName: "spring-boot-engineer",
        installedName: "voltagent-spring-boot-engineer",
        category: "02-language-specialists",
        file: ".codex/agents/voltagent-spring-boot-engineer.toml",
      },
      {
        repoName: "react-specialist",
        installedName: "voltagent-react-specialist",
        category: "02-language-specialists",
        file: ".codex/agents/voltagent-react-specialist.toml",
      },
    ],
  }, null, 2));

  const populatedCatalog = loadVoltAgentCatalog({
    rootDir: fixture.dir,
    manifestPath: ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json",
    agentsDir: ".codex/agents",
  });

  assert.equal(populatedCatalog.available, true);
  assert.equal(populatedCatalog.installedCount, 2);
  assert.deepEqual(populatedCatalog.installedNames.sort(), [
    "voltagent-react-specialist",
    "voltagent-spring-boot-engineer",
  ]);
});

check("installer helper writes repo-local codex-only manifest and prefixes installed names", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/install-voltagent-codex-subagents.mjs")).href;
  const { syncVoltAgentCodexAgents } = await import(moduleUrl);

  const fixture = makeFixture();
  writeFixtureFile(fixture.dir, ".ai-sync/voltagent-codex-subagents/categories/02-language-specialists/spring-boot-engineer.toml", `name = "spring-boot-engineer"
description = "Spring Boot 3+ microservices expert"
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"

[instructions]
text = """
Spring helper
"""
`);
  writeFixtureFile(fixture.dir, ".ai-sync/voltagent-codex-subagents/categories/02-language-specialists/react-specialist.toml", `name = "react-specialist"
description = "React 18+ modern patterns expert"
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"

[instructions]
text = """
React helper
"""
`);

  const result = syncVoltAgentCodexAgents({
    rootDir: fixture.dir,
    refreshRepo: false,
    cacheDir: ".ai-sync/voltagent-codex-subagents",
    agentsDir: ".codex/agents",
    manifestPath: ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json",
  });

  assert.equal(result.installedAgents.length, 2);
  assert.equal(result.mode, "repo-local-codex-only");
  assert.equal(fs.existsSync(path.join(fixture.dir, ".codex/agents/voltagent-spring-boot-engineer.toml")), true);

  const installedToml = fs.readFileSync(path.join(fixture.dir, ".codex/agents/voltagent-spring-boot-engineer.toml"), "utf8");
  assert.match(installedToml, /name = "voltagent-spring-boot-engineer"/);

  const manifest = JSON.parse(fs.readFileSync(path.join(fixture.dir, ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json"), "utf8"));
  assert.equal(manifest.mode, "repo-local-codex-only");
  assert.equal(manifest.installedAgents[0].installedName.startsWith("voltagent-"), true);
});

check("workflow composition helper maps bounded local work to routing plus sequential processing", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-composition-patterns.mjs")).href;
  const { inferWorkflowComposition } = await import(moduleUrl);

  const composition = inferWorkflowComposition({
    classification: {
      tiny: true,
      crossStack: false,
      reviewSensitive: false,
      frontendDesignGateRequired: false,
      backendLogicGateRequired: false,
      backendLogicReviewRequired: false,
      touchesFrontend: true,
      touchesBackend: false,
      broad: false,
    },
    route: {
      shape: "single-agent",
      visibleMultiAgent: false,
      recommendedAgents: [],
    },
    subagentPlan: {
      useCodexSubagents: false,
      useGeminiParallelAgents: false,
    },
  });

  assert.equal(composition.primary, "sequential-processing");
  assert.deepEqual(composition.applied, ["routing", "sequential-processing"]);
  assert.equal(composition.qualityPattern, "single-pass");
});

check("workflow composition helper maps reviewer-backed backend work to evaluation-feedback loops", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-composition-patterns.mjs")).href;
  const { inferWorkflowComposition } = await import(moduleUrl);

  const composition = inferWorkflowComposition({
    classification: {
      tiny: false,
      crossStack: false,
      reviewSensitive: true,
      frontendDesignGateRequired: false,
      backendLogicGateRequired: true,
      backendLogicReviewRequired: true,
      touchesFrontend: false,
      touchesBackend: true,
      broad: false,
    },
    route: {
      shape: "pm-builder-reviewer",
      visibleMultiAgent: true,
      recommendedAgents: ["reviewer-agent", "backend-agent"],
    },
    subagentPlan: {
      useCodexSubagents: true,
      useGeminiParallelAgents: false,
    },
  });

  assert.equal(composition.primary, "evaluation-feedback-loops");
  assert.deepEqual(composition.applied, [
    "routing",
    "sequential-processing",
    "orchestrator-worker",
    "evaluation-feedback-loops",
    "subagents",
  ]);
  assert.equal(composition.delegationPattern, "subagents");
});

check("controller infers backend ownership and avoids stale human-loop surface bleed", () => {
  const fixture = makeControllerFixture(`- [ ] GarminConnectController backend logic has no focused test file — auth, validation, and response-contract behavior can drift unnoticed
  Files: \`backend/src/main/java/com/hermes/backend/GarminConnectController.java, backend/src/test/java/com/hermes/backend/GarminConnectControllerTests.java\`
  Problem: backend-logic
  Owner: backend-agent
  Context: Auto-suggested from codebase analysis (backend_logic_guard)
  Done when: the issue described above is resolved and verified
  Verify: \`cd backend && ./mvnw test -Dtest=GarminConnectControllerTests && ./mvnw -q -DskipTests compile\``);
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

  assert.equal(result.surface, "Garmin Connect");
  assert.equal(result.classification.touchesBackend, true);
  assert.equal(result.classification.touchesFrontend, false);
  assert.equal(result.classification.problemClass, "backend-logic");
  assert.equal(result.classification.backendLogicGateRequired, true);
  assert.equal(result.route.shape, "pm-builder-reviewer");
  assert.deepEqual(result.route.recommendedAgents, ["reviewer-agent", "backend-agent"]);
  assert.equal(result.humanLoop.effectiveCurrentOwnedSurface, "Garmin Connect");
  assert.equal(result.humanLoop.staleAgentWriteback, true);
  assert.equal(result.workflowComposition.primary, "evaluation-feedback-loops");
  assert.deepEqual(result.workflowComposition.applied, [
    "routing",
    "sequential-processing",
    "orchestrator-worker",
    "evaluation-feedback-loops",
    "subagents",
  ]);
});

check("controller routes explicit frontend-design problems through reviewer-backed frontend execution", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state — runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Auto-suggested from codebase analysis (missing_empty_state)
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\``);

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

  assert.equal(result.classification.problemClass, "frontend-design");
  assert.equal(result.classification.frontendDesignGateRequired, true);
  assert.equal(result.route.shape, "pm-builder-reviewer");
  assert.deepEqual(result.route.recommendedAgents, ["reviewer-agent", "frontend-agent"]);
  assert.equal(result.route.autoDecisionGate.decision, "design-review");
  assert.equal(result.designContext.authorityFile, "design.md");
  assert.equal(result.designContext.referenceSource, "design.md");
  assert.equal(result.designContext.surface, "Analysis");
});

check("controller does not treat drag-and-drop accessibility work as destructive", () => {
  const fixture = makeControllerFixture(`- [ ] [code-review] Add loading, error, and empty states to Workflow Builder + a11y for canvas controls (MEDIUM)
  Files: \`frontend/src/pages/WorkflowBuilder.jsx\`, \`frontend/src/components/workflow/WorkflowCanvas.jsx\`, \`frontend/src/components/workflow/InputNode.jsx\`, \`frontend/src/components/workflow/OutputNode.jsx\`, \`frontend/src/components/workflow/TransformNode.jsx\`, \`frontend/src/components/workflow/AgentNode.jsx\`
  Context: WorkflowBuilder.jsx has zero loading/error/empty state feedback - if WorkflowCanvas fails or has no data, user sees a blank page. Workflow nodes and canvas have zero aria-* attributes - drag-and-drop canvas operations are completely inaccessible to keyboard/screen reader users. Inline ternary \`lang === 'zh-CN' ? '天气' : 'Weather'\` bypasses the t() i18n system.
  Done when: WorkflowBuilder shows loading spinner, error message with retry, and empty state with CTA. WorkflowCanvas and all node types have aria-labels for their interactive regions. Bilingual labels use t() keys consistently.
  Verify: \`cd frontend && npm run build\``);

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

  assert.equal(result.classification.destructive, false);
  assert.equal(result.classification.irreversible, false);
  assert.notEqual(result.route.shape, "paused");
  assert.equal(result.stop, false);
});

check("controller adds installed VoltAgent Spring specialist for backend-heavy rounds", () => {
  const fixture = makeControllerFixture(`- [ ] GarminConnectController backend logic has no focused test file - auth, validation, and response-contract behavior can drift unnoticed
  Files: \`backend/src/main/java/com/hermes/backend/GarminConnectController.java, backend/src/test/java/com/hermes/backend/GarminConnectControllerTests.java\`
  Problem: backend-logic
  Owner: backend-agent
  Context: Auto-suggested from codebase analysis (backend_logic_guard)
  Done when: the issue described above is resolved and verified
  Verify: \`cd backend && ./mvnw test -Dtest=GarminConnectControllerTests && ./mvnw -q -DskipTests compile\``);
  writeFixtureFile(fixture.dir, ".codex/agents/voltagent-spring-boot-engineer.toml", `name = "voltagent-spring-boot-engineer"
description = "Spring specialist"
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"

[instructions]
text = """
Spring helper
"""
`);
  writeFixtureFile(fixture.dir, ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json", JSON.stringify({
    sourceRepo: "https://github.com/VoltAgent/awesome-codex-subagents",
    mode: "repo-local-codex-only",
    installedAgents: [
      {
        repoName: "spring-boot-engineer",
        installedName: "voltagent-spring-boot-engineer",
        category: "02-language-specialists",
        file: ".codex/agents/voltagent-spring-boot-engineer.toml",
      },
    ],
  }, null, 2));

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

  assert.deepEqual(result.route.recommendedAgents, ["reviewer-agent", "backend-agent"]);
  assert.deepEqual(result.route.optionalExternalAgents, ["voltagent-spring-boot-engineer"]);
  assert.equal(result.externalCatalog.installedCount, 1);
});

check("controller exposes Vercel-style composition for bounded cross-stack rounds", () => {
  const fixture = makeControllerFixture(`- [ ] Keep backend route metadata and frontend planner card in sync
  Files: \`frontend/src/pages/Schedule.jsx, backend/src/main/java/com/hermes/backend/RoutePlannerController.java\`
  Problem: cross-stack-contract
  Context: Route planner behavior spans backend payload shaping and frontend rendering.
  Done when: the contract is aligned and verified
  Verify: \`cd frontend && npm run build && cd ../backend && ./mvnw -q -DskipTests compile\``);

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

  assert.equal(result.route.shape, "parallel-builders");
  assert.equal(result.workflowComposition.primary, "parallel-processing");
  assert.deepEqual(result.workflowComposition.applied, [
    "routing",
    "parallel-processing",
    "orchestrator-worker",
    "evaluation-feedback-loops",
    "subagents",
  ]);
  assert.equal(result.workflowComposition.executionPattern, "parallel-processing");
});

check("controller keeps Hermes-only routing when no VoltAgent catalog is installed", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Auto-suggested from codebase analysis (missing_empty_state)
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\``);

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

  assert.deepEqual(result.route.recommendedAgents, ["reviewer-agent", "frontend-agent"]);
  assert.deepEqual(result.route.optionalExternalAgents, []);
  assert.equal(result.externalCatalog.installedCount, 0);
});

check("controller skips a same-task claim held by another owner and falls through to the next promotable task", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks
- [ ] Fix Garmin controller trust gap
  Files: \`backend/src/main/java/com/hermes/backend/GarminConnectController.java\`
  Problem: backend-logic
  Context: Existing active task already claimed elsewhere
  Done when: Garmin controller trust gap is resolved
  Verify: \`cd backend && ./mvnw -q -DskipTests compile\`

## Tech Debt Tasks

## Suggested Next Tasks
### TIER 1 - Daily Coach Value
- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Context: Auto-suggested from codebase analysis (missing_empty_state)
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\`
`, "utf8");

  const claimDir = path.join(fixture.dir, ".ai-sync", "claims");
  acquireTaskClaim({
    claimDir,
    key: taskClaimKey({
      source: "active-task",
      surface: "Garmin Connect",
      title: "Fix Garmin controller trust gap",
    }),
    ownerId: "owner-a",
    ownerLabel: "thread-a",
    source: "active-task",
    surface: "Garmin Connect",
    title: "Fix Garmin controller trust gap",
  });

  const { result } = runAutoHermesController({
    json: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    claimDir,
    claimOwner: "owner-b",
    outputJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
  });

  assert.equal(result.title, "Analysis page has no visible empty state - runners with no data see a blank screen");
  assert.equal(result.classification.problemClass, "frontend-design");
});

check("controller stops cleanly when the same task is already claimed by another owner", () => {
  const fixture = makeControllerFixture(`- [ ] Fix Garmin controller trust gap
  Files: \`backend/src/main/java/com/hermes/backend/GarminConnectController.java\`
  Problem: backend-logic
  Owner: backend-agent
  Context: Existing active task already claimed elsewhere
  Done when: Garmin controller trust gap is resolved
  Verify: \`cd backend && ./mvnw -q -DskipTests compile\``);
  const claimDir = path.join(fixture.dir, ".ai-sync", "claims");

  const claim = acquireTaskClaim({
    claimDir,
    key: taskClaimKey({
      source: "active-task",
      surface: "Garmin Connect",
      title: "Fix Garmin controller trust gap",
    }),
    claimOwner: "owner-a",
    ownerId: "owner-a",
    ownerLabel: "thread-a",
    source: "active-task",
    surface: "Garmin Connect",
    title: "Fix Garmin controller trust gap",
  });
  assert.equal(claim.acquired, true);

  const { result } = runAutoHermesController({
    json: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    claimDir,
    claimOwner: "owner-b",
    outputJson: path.join(fixture.dir, ".ai-sync", "controller-b.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "controller-b.md"),
  });

  assert.equal(result.stop, true);
  assert.match(result.reason, /claimed by other auto-hermes threads/i);
});

check("loop worker prompt carries design.md authority for frontend-design rounds", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state 鈥?runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Auto-suggested from codebase analysis (missing_empty_state)
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\``);

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
  assert.match(prompt, /Authority file: design\.md/);
  assert.match(prompt, /Read the authority file before editing UI/);
});

check("loop dry-run writes Ralph grounding artifacts for the selected work unit", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Ralph grounding should persist snapshot and ledger state before execution
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\``);

  const contextSnapshotDir = path.join(fixture.dir, ".ai-sync", "context-snapshots");
  const progressDir = path.join(fixture.dir, ".ai-sync", "auto-hermes-state");
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
    loopStateJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json"),
  });

  assert.equal(state.status, "dry-run-complete");
  assert.equal(fs.existsSync(contextSnapshotDir), true);
  assert.equal(fs.existsSync(progressDir), true);

  const snapshotFiles = fs.readdirSync(contextSnapshotDir);
  const progressFiles = fs.readdirSync(progressDir);
  assert.equal(snapshotFiles.length > 0, true);
  assert.equal(progressFiles.some((name) => /-progress\.json$/i.test(name)), true);
  assert.equal(progressFiles.some((name) => /-state\.json$/i.test(name)), true);

  const prompt = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "prompt.md"), "utf8");
  assert.match(prompt, /Context Snapshot:/i);
  assert.match(prompt, /Progress ledger:/i);
  assert.match(prompt, /Required gates before pass:/i);
  assert.match(prompt, /verify-result pass with fresh command evidence/i);

  const coordinator = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "coordinator.md"), "utf8");
  assert.match(coordinator, /Ralph Grounding/i);
  assert.match(coordinator, /Supervisor Continuity/i);
});

check("self-loop dry-run exposes unbounded Ralph semantics and dedicated self-loop artifacts", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: auto-hermes-self should keep looping until a real stop gate fires
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\``);

  const { state } = runAutoHermesSelfLoop({
    json: true,
    dryRun: true,
    write: true,
    runtime: "codex-live",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    controllerJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_CONTROLLER.json"),
    controllerMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_CONTROLLER.md"),
    promotionJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_PROMOTION.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_PROMOTION.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_COORDINATOR.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_COORDINATOR.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_NEXT_PROMPT.md"),
    loopStateJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP_STATE.json"),
    roundResultJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_ROUND_RESULT.json"),
    roundResultMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_ROUND_RESULT.md"),
  });

  assert.equal(state.status, "dry-run-complete");
  assert.equal(state.mode, "self-ralph");
  assert.equal(state.unbounded, true);
  assert.equal(state.maxRounds, null);

  const prompt = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_NEXT_PROMPT.md"), "utf8");
  assert.match(prompt, /keep iterating until a real stop gate fires/i);
  assert.match(prompt, /website-audit fallback/i);

  const coordinator = JSON.parse(fs.readFileSync(path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_COORDINATOR.json"), "utf8"));
  assert.equal(coordinator.unbounded, true);
  assert.match(coordinator.loopContract || "", /true Ralph self-loop/i);
});

check("self-loop resets same-task stall history when the repeated task shows new round-result progress", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Ralph should keep iterating when the same task returns with newer round-result evidence
  Done when: the analysis empty state round is completed
  Verify: \`cd frontend && npm run lint && npm run build\``);

  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP_STATE.json");
  const roundResultJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_ROUND_RESULT.json");
  const sharedArgs = {
    json: true,
    write: true,
    runtime: "codex-live",
    executorCommand: "Write-Output 'noop'",
    maxRounds: 1,
    maxSameWorkUnitRepeats: 2,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    controllerJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_CONTROLLER.json"),
    controllerMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_CONTROLLER.md"),
    promotionJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_PROMOTION.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_PROMOTION.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_COORDINATOR.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_COORDINATOR.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_NEXT_PROMPT.md"),
    loopStateJson,
    roundResultJson,
    roundResultMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_ROUND_RESULT.md"),
  };

  const first = runAutoHermesSelfLoop(sharedArgs).state;
  assert.equal(first.status, "max-rounds-reached");
  assert.equal(first.sameWorkUnitStreak, 1);

  const persisted = JSON.parse(fs.readFileSync(loopStateJson, "utf8"));
  persisted.lastRoundResultSignature = "analysis-empty-state-must-fix-v1";
  persisted.lastRoundResult = {
    verdict: "must-fix",
    review: "approve-next-round",
    blocker: "Missing empty state copy",
    ralphGate: {
      pass: false,
      summary: "Missing empty state copy",
    },
  };
  fs.writeFileSync(loopStateJson, JSON.stringify(persisted, null, 2), "utf8");

  fs.writeFileSync(roundResultJson, JSON.stringify({
    generatedAt: new Date().toISOString(),
    task: "Analysis page has no visible empty state - runners with no data see a blank screen",
    surface: "Analysis",
    verdict: "must-fix",
    review: "approve-next-round",
    blocker: "Empty state shell exists, but CTA hierarchy is still missing",
    verify: "cd frontend && npm run lint && npm run build",
    verifyResult: "pass",
    runtimeProof: "source changed, live website not synced yet",
    consoleSummary: "No new route errors",
    consoleObservedCount: 0,
    ralphGate: {
      pass: false,
      summary: "Need CTA hierarchy follow-up",
    },
  }, null, 2), "utf8");

  const second = runAutoHermesSelfLoop(sharedArgs).state;
  assert.equal(second.status, "max-rounds-reached");
  assert.equal(second.sameWorkUnitStreak, 0);
  assert.doesNotMatch(second.stopReason || "", /returned to the same selected task/i);
});

check("self-loop still stalls when the repeated task returns with unchanged round-result evidence", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Ralph should stop only when same-task rounds show no new progress evidence
  Done when: the analysis empty state round is completed
  Verify: \`cd frontend && npm run lint && npm run build\``);

  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP_STATE.json");
  const roundResultJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_ROUND_RESULT.json");
  const sharedArgs = {
    json: true,
    write: true,
    runtime: "codex-live",
    executorCommand: "Write-Output 'noop'",
    maxRounds: 1,
    maxSameWorkUnitRepeats: 2,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    controllerJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_CONTROLLER.json"),
    controllerMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_CONTROLLER.md"),
    promotionJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_PROMOTION.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_PROMOTION.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_LOOP.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_COORDINATOR.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_COORDINATOR.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_NEXT_PROMPT.md"),
    loopStateJson,
    roundResultJson,
    roundResultMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_SELF_ROUND_RESULT.md"),
  };

  const first = runAutoHermesSelfLoop(sharedArgs).state;
  assert.equal(first.sameWorkUnitStreak, 1);

  const repeatedRoundResult = {
    generatedAt: new Date().toISOString(),
    task: "Analysis page has no visible empty state - runners with no data see a blank screen",
    surface: "Analysis",
    verdict: "must-fix",
    review: "approve-next-round",
    blocker: "Missing empty state copy",
    verify: "cd frontend && npm run lint && npm run build",
    verifyResult: "pass",
    runtimeProof: "source changed, live website not synced yet",
    consoleSummary: "No new route errors",
    consoleObservedCount: 0,
    ralphGate: {
      pass: false,
      summary: "Missing empty state copy",
    },
  };

  const persisted = JSON.parse(fs.readFileSync(loopStateJson, "utf8"));
  persisted.lastRoundResult = repeatedRoundResult;
  fs.writeFileSync(loopStateJson, JSON.stringify(persisted, null, 2), "utf8");

  fs.writeFileSync(roundResultJson, JSON.stringify(repeatedRoundResult, null, 2), "utf8");

  const second = runAutoHermesSelfLoop(sharedArgs).state;
  assert.equal(second.status, "stalled-same-work-unit");
  assert.equal(second.sameWorkUnitStreak, 2);
});

check("loop worker prompt tells agents to ignore stale human-loop narrative for task selection", () => {
  const fixture = makeControllerFixture(`- [ ] GarminConnectController backend logic has no focused test file 鈥?auth, validation, and response-contract behavior can drift unnoticed
  Files: \`backend/src/main/java/com/hermes/backend/GarminConnectController.java, backend/src/test/java/com/hermes/backend/GarminConnectControllerTests.java\`
  Problem: backend-logic
  Owner: backend-agent
  Context: Auto-suggested from codebase analysis (backend_logic_guard)
  Done when: the issue described above is resolved and verified
  Verify: \`cd backend && ./mvnw test -Dtest=GarminConnectControllerTests && ./mvnw -q -DskipTests compile\``);

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
  assert.match(prompt, /HUMAN_LOOP only gates pause\/stop\/must-ask; task selection comes from controller JSON/i);
  assert.match(prompt, /Selected work unit:/i);
});

check("loop worker prompt renders installed repo-local external codex specialists truthfully", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Auto-suggested from codebase analysis (missing_empty_state)
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\``);
  writeFixtureFile(fixture.dir, ".codex/agents/voltagent-react-specialist.toml", `name = "voltagent-react-specialist"
description = "React specialist"
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"

[instructions]
text = """
React helper
"""
`);
  writeFixtureFile(fixture.dir, ".ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json", JSON.stringify({
    sourceRepo: "https://github.com/VoltAgent/awesome-codex-subagents",
    mode: "repo-local-codex-only",
    installedAgents: [
      {
        repoName: "react-specialist",
        installedName: "voltagent-react-specialist",
        category: "02-language-specialists",
        file: ".codex/agents/voltagent-react-specialist.toml",
      },
    ],
  }, null, 2));

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
  assert.match(prompt, /Subagent dispatch:/);
  assert.match(prompt, /voltagent-react-specialist/);
  assert.match(prompt, /catalog installed=1/i);
  assert.match(prompt, /Full role text and catalog details stay in controller JSON/i);
  assert.doesNotMatch(prompt, /Repo-local external Codex agents:/);
});

check("dry-run loop refresh does not fabricate completed rounds or stall state", () => {
  const fixture = makeFixture();
  const { state: result } = runAutoHermesLoop({
    json: true,
    dryRun: true,
    maxRounds: 3,
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

  assert.equal(result.status, "dry-run-complete");
  assert.equal(result.roundsCompleted, 0);
  assert.equal(result.sameWorkUnitStreak, 0);
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].action, "dry-run");
});

check("loop resume carries same-work-unit stall history forward for the same persisted work unit", () => {
  const fixture = makeControllerFixture(`- [ ] Improve Analysis page
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Resume should preserve repeated-task stall history for the same work unit
  Done when: the analysis page round is completed
  Verify: \`cd frontend && npm run lint && npm run build\``);
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");
  const sharedArgs = {
    json: true,
    write: true,
    runtime: "codex-live",
    executorCommand: "Write-Output 'noop'",
    maxRounds: 1,
    maxSameWorkUnitRepeats: 2,
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
    loopStateJson,
  };

  const first = runAutoHermesLoop(sharedArgs).state;
  assert.equal(first.status, "max-rounds-reached");
  assert.equal(first.sameWorkUnitStreak, 1);
  const persistedAfterFirst = JSON.parse(fs.readFileSync(loopStateJson, "utf8"));
  assert.equal(persistedAfterFirst.sameWorkUnitStreak, 1);
  assert.equal(typeof persistedAfterFirst.lastWorkUnitSignature, "string");
  assert.notEqual(persistedAfterFirst.lastWorkUnitSignature, "none");

  const second = runAutoHermesLoop(sharedArgs).state;
  assert.equal(second.status, "stalled-same-work-unit");
  assert.equal(second.sameWorkUnitStreak, 2);
  assert.match(second.stopReason, /returned to the same selected task 2 time\(s\)/i);
});

check("loop resume resets same-work-unit stall history when the persisted work unit changes", () => {
  const fixture = makeControllerFixture(`- [ ] Improve Analysis page
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: First loop pass records a repeated analysis task
  Done when: the analysis page round is completed
  Verify: \`cd frontend && npm run lint && npm run build\``);
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");
  const sharedArgs = {
    json: true,
    write: true,
    runtime: "codex-live",
    executorCommand: "Write-Output 'noop'",
    maxRounds: 1,
    maxSameWorkUnitRepeats: 2,
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
    loopStateJson,
  };

  const first = runAutoHermesLoop(sharedArgs).state;
  assert.equal(first.sameWorkUnitStreak, 1);

  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks
- [ ] Fix Profile empty state
  Files: \`frontend/src/pages/Profile.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Second loop pass should not inherit the analysis-task streak
  Done when: the profile page empty state is fixed
  Verify: \`cd frontend && npm run lint && npm run build\`

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  const second = runAutoHermesLoop(sharedArgs).state;
  assert.equal(second.status, "max-rounds-reached");
  assert.equal(second.sameWorkUnitStreak, 1);
  assert.doesNotMatch(second.stopReason, /returned to the same selected task/i);
});

check("codex-live loop uses executor-owned self-loop path when an executor is configured", () => {
  const fixture = makeFixture();
  const command = [
    `$p='${fixture.files.tasks.replace(/'/g, "''")}'`,
    "$c=[IO.File]::ReadAllText($p)",
    "$c=[regex]::Replace($c,'- \\[ \\]','- [x]',1)",
    "[IO.File]::WriteAllText($p,$c,[Text.Encoding]::UTF8)",
  ].join("; ");

  const { state: result } = runAutoHermesLoop({
    json: true,
    write: true,
    mode: "single-round",
    runtime: "codex-live",
    executorCommand: command,
    maxRounds: 2,
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

  assert.equal(result.status, "single-round-complete");
  assert.equal(result.roundsCompleted, 1);

  const coordinator = JSON.parse(fs.readFileSync(path.join(fixture.dir, ".ai-sync", "coordinator.json"), "utf8"));
  assert.equal(coordinator.nextAction, "stop");
  assert.equal(coordinator.claimStates.loopOwner.state, "verified");
});

check("loop prefers the OMX Ralph executor when the bridge maps loop ownership to $ralph", () => {
  const fixture = makeFixture();
  const bridgePath = path.join(fixture.dir, ".ai-sync", "OMX_AUTO_HERMES_BRIDGE.json");
  fs.mkdirSync(path.dirname(bridgePath), { recursive: true });
  fs.writeFileSync(bridgePath, JSON.stringify({
    autoReady: true,
    mapping: {
      loop: "$ralph",
    },
    availableSkills: ["deep-interview", "ralplan", "ralph", "team"],
  }, null, 2), "utf8");

  const { state: result } = runAutoHermesLoop({
    json: true,
    dryRun: true,
    write: true,
    mode: "self-loop",
    runtime: "codex-live",
    maxRounds: 1,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    omxBridgeJson: bridgePath,
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

  assert.equal(result.status, "dry-run-complete");
  assert.equal(result.executorLabel, "omx-ralph");

  const coordinator = JSON.parse(fs.readFileSync(path.join(fixture.dir, ".ai-sync", "coordinator.json"), "utf8"));
  assert.equal(coordinator.executorLabel, "omx-ralph");
  assert.equal(coordinator.nextAction, "loop-owner-execute-round");
});

check("explicit executorCommand still overrides the OMX Ralph loop preference", () => {
  const fixture = makeFixture();
  const bridgePath = path.join(fixture.dir, ".ai-sync", "OMX_AUTO_HERMES_BRIDGE.json");
  fs.mkdirSync(path.dirname(bridgePath), { recursive: true });
  fs.writeFileSync(bridgePath, JSON.stringify({
    autoReady: true,
    mapping: {
      loop: "$ralph",
    },
    availableSkills: ["deep-interview", "ralplan", "ralph", "team"],
  }, null, 2), "utf8");

  const { state: result } = runAutoHermesLoop({
    json: true,
    dryRun: true,
    write: true,
    mode: "self-loop",
    runtime: "codex-live",
    maxRounds: 1,
    executorCommand: "Write-Output 'inline executor'",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    omxBridgeJson: bridgePath,
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

  assert.equal(result.status, "dry-run-complete");
  assert.equal(result.executorLabel, "inline-arg");
});

check("controller falls back to website audit work when the standard auto-hermes queue is empty", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");

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

  assert.equal(result.stop, false);
  assert.equal(result.loopDecision, "continue-self-loop");
  assert.equal(result.source, "website-audit");
  assert.equal(result.title, "Improve Analysis page");
  assert.equal(result.surface, "Analysis");
  assert.deepEqual(result.files, ["frontend/src/pages/Analysis.jsx"]);
  assert.equal(result.websiteAudit?.mode, "website-audit");
  assert.equal(result.websiteAudit?.usedFallback, true);
  assert.equal(result.websiteAudit?.status, "fallback-selected");
  assert.match(result.websiteAudit?.summary || "", /controller reported no promotable work/i);
});

check("standard auto-hermes loop stays alive on an empty queue when website audit finds a bounded fallback candidate", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");

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
    promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
    promptFile,
  });

  assert.equal(state.status, "dry-run-complete");
  const controller = JSON.parse(fs.readFileSync(controllerJson, "utf8"));
  assert.equal(controller.stop, false);
  assert.equal(controller.source, "website-audit");
  assert.equal(controller.websiteAudit?.usedFallback, true);
  assert.equal(controller.loopDecision, "continue-self-loop");

  const prompt = fs.readFileSync(promptFile, "utf8");
  assert.match(prompt, /website audit summary:/i);
  assert.match(prompt, /website-audit fallback/i);
  assert.match(prompt, /frontend\/src\/pages\/Analysis\.jsx/);
});

check("round-close queue rehydration preserves website-audit fallback metadata for the next standard controller pass", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");

  const firstPass = runAutoHermesController({
    json: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    outputJson: path.join(fixture.dir, ".ai-sync", "controller-1.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "controller-1.md"),
  }).result;

  const taskText = fs.readFileSync(fixture.files.tasks, "utf8");
  fs.writeFileSync(fixture.files.tasks, syncQueueWithController(taskText, firstPass), "utf8");

  const secondPass = runAutoHermesController({
    json: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    outputJson: path.join(fixture.dir, ".ai-sync", "controller-2.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "controller-2.md"),
  }).result;

  assert.equal(secondPass.title, "Improve Analysis page");
  assert.equal(secondPass.loopDecision, "continue-self-loop");
  assert.equal(secondPass.source, "website-audit");
  assert.equal(secondPass.websiteAudit?.mode, "website-audit");
  assert.equal(secondPass.websiteAudit?.usedFallback, true);
  assert.equal(secondPass.websiteAudit?.status, "fallback-selected");
  assert.equal(secondPass.websiteAudit?.candidate?.surface, "Analysis");
});

check("round-close persists website-audit outcomes into the active auto-hermes run-state instead of the latest run", async () => {
  const runStateModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-run-state.mjs")).href;
  const { createAutoHermesRun, loadAutoHermesRun } = await import(runStateModuleUrl);
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");

  const controllerJson = path.join(fixture.dir, ".ai-sync", "controller.json");
  const controllerMd = path.join(fixture.dir, ".ai-sync", "controller.md");
  runAutoHermesController({
    json: true,
    write: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    outputJson: controllerJson,
    outputMd: controllerMd,
  });

  const activeRun = createAutoHermesRun({
    rootDir: fixture.dir,
    mode: "auto-hermes",
    goal: "Improve Analysis page on Analysis",
  });
  const unrelatedLatestRun = createAutoHermesRun({
    rootDir: fixture.dir,
    mode: "auto-hermes",
    goal: "Unrelated newer run",
  });
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");
  fs.writeFileSync(loopStateJson, JSON.stringify({
    auditRunId: activeRun.state.runId,
  }, null, 2), "utf8");

  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks
- [ ] Existing next round already promoted
  Files: \`frontend/src/pages/Profile.jsx\`
  Problem: frontend-design
  Context: Next-state queue should not erase the closing round's website-audit context
  Done when: the next round is handled separately
  Verify: \`cd frontend && npm run lint && npm run build\`

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  runAutoHermesRoundClose({
    write: true,
    json: true,
    refreshLoopBriefs: false,
    refreshFinish: false,
    selfCheck: false,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    loopStateJson,
    agentSyncMd: fixture.files.agentSync,
    controllerJson,
    controllerMd,
    promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
    loopJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
    loopMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "prompt.md"),
    task: "Improve Analysis page",
    surface: "Analysis",
    files: "frontend/src/pages/Analysis.jsx",
    summary: "Queue rehydrated from website audit fallback",
    goal: "Improve Analysis page on Analysis",
    verify: "cd frontend && npm run lint && npm run build",
    verifyResult: "pass",
    runtimeProof: "source changed, live website not synced yet",
    review: "approve-next-round",
    verdict: "pass",
  });

  const persistedActiveRun = loadAutoHermesRun({
    rootDir: fixture.dir,
    runId: activeRun.state.runId,
  });
  assert.equal(persistedActiveRun.websiteAudit.emptyAuditCount, 0);
  assert.equal(/website audit/i.test(persistedActiveRun.websiteAudit.lastFoundCandidateSummary), true);
  assert.equal(Array.isArray(persistedActiveRun.websiteAudit.attempts), true);
  assert.equal(persistedActiveRun.websiteAudit.attempts.at(-1)?.foundCandidate, true);

  const untouchedLatestRun = loadAutoHermesRun({
    rootDir: fixture.dir,
    runId: unrelatedLatestRun.state.runId,
  });
  assert.equal(untouchedLatestRun.websiteAudit.attempts.length, 0);
  assert.equal(untouchedLatestRun.websiteAudit.lastFoundCandidateSummary, "");
});

check("round-close does not persist website-audit outcomes for rehydrated queue states", async () => {
  const runStateModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-run-state.mjs")).href;
  const { createAutoHermesRun, loadAutoHermesRun } = await import(runStateModuleUrl);
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");

  const firstPass = runAutoHermesController({
    json: true,
    write: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    outputJson: path.join(fixture.dir, ".ai-sync", "controller-1.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "controller-1.md"),
  }).result;
  fs.writeFileSync(fixture.files.tasks, syncQueueWithController(fs.readFileSync(fixture.files.tasks, "utf8"), firstPass), "utf8");

  const controllerJson = path.join(fixture.dir, ".ai-sync", "controller.json");
  const controllerMd = path.join(fixture.dir, ".ai-sync", "controller.md");
  const secondPass = runAutoHermesController({
    json: true,
    write: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    outputJson: controllerJson,
    outputMd: controllerMd,
  }).result;
  assert.equal(secondPass.websiteAudit?.queueState?.status, "rehydrated-from-round-close");

  const activeRun = createAutoHermesRun({
    rootDir: fixture.dir,
    mode: "auto-hermes",
    goal: "Improve Analysis page on Analysis",
  });
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");
  fs.writeFileSync(loopStateJson, JSON.stringify({
    auditRunId: activeRun.state.runId,
    websiteAudit: secondPass.websiteAudit,
  }, null, 2), "utf8");

  runAutoHermesRoundClose({
    write: true,
    json: true,
    refreshController: false,
    refreshLoopBriefs: false,
    refreshFinish: false,
    selfCheck: false,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    loopStateJson,
    agentSyncMd: fixture.files.agentSync,
    controllerJson,
    controllerMd,
    promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
    loopJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
    loopMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "prompt.md"),
    task: "Improve Analysis page",
    surface: "Analysis",
    files: "frontend/src/pages/Analysis.jsx",
    summary: "Closing a rehydrated website-audit task",
    goal: "Improve Analysis page on Analysis",
    verify: "cd frontend && npm run lint && npm run build",
    verifyResult: "pass",
    runtimeProof: "source changed, live website not synced yet",
    review: "approve-next-round",
    verdict: "pass",
  });

  const persistedRun = loadAutoHermesRun({
    rootDir: fixture.dir,
    runId: activeRun.state.runId,
  });
  assert.equal(persistedRun.websiteAudit.attempts.length, 0);
  assert.equal(persistedRun.websiteAudit.lastFoundCandidateSummary, "");
});

check("round-close keeps a confirmed-empty website-audit fallback at a single persisted attempt", async () => {
  const runStateModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-run-state.mjs")).href;
  const { createAutoHermesRun, loadAutoHermesRun, recordWebsiteAuditAttempt } = await import(runStateModuleUrl);
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");

  const controllerJson = path.join(fixture.dir, ".ai-sync", "controller.json");
  const controllerMd = path.join(fixture.dir, ".ai-sync", "controller.md");
  const controllerResult = runAutoHermesController({
    json: true,
    write: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    outputJson: controllerJson,
    outputMd: controllerMd,
  }).result;

  assert.equal(controllerResult.source, "website-audit");
  assert.equal(controllerResult.websiteAudit?.queueState?.status, "confirmed-empty");

  const activeRun = createAutoHermesRun({
    rootDir: fixture.dir,
    mode: "auto-hermes",
    goal: "Improve Analysis page on Analysis",
  });
  const recordedRun = recordWebsiteAuditAttempt({
    rootDir: fixture.dir,
    runId: activeRun.state.runId,
    foundCandidate: controllerResult.websiteAudit?.usedFallback === true,
    auditSummary: controllerResult.websiteAudit?.summary || controllerResult.reason || "",
  });

  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");
  fs.writeFileSync(loopStateJson, JSON.stringify({
    auditRunId: activeRun.state.runId,
    websiteAudit: recordedRun.websiteAudit,
  }, null, 2), "utf8");

  const runAfterLoop = loadAutoHermesRun({
    rootDir: fixture.dir,
    runId: activeRun.state.runId,
  });
  assert.equal(runAfterLoop.websiteAudit.attempts.length, 1);
  assert.equal(runAfterLoop.websiteAudit.emptyAuditCount, 0);

  runAutoHermesRoundClose({
    write: true,
    json: true,
    refreshController: false,
    refreshLoopBriefs: false,
    refreshFinish: false,
    refreshSuggestions: false,
    selfCheck: false,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    loopStateJson,
    agentSyncMd: fixture.files.agentSync,
    controllerJson,
    controllerMd,
    promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
    loopJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
    loopMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "prompt.md"),
    task: controllerResult.title,
    surface: controllerResult.surface,
    files: controllerResult.files.join("||"),
    summary: "Closed a confirmed-empty website-audit fallback round",
    goal: `Improve ${controllerResult.title} on ${controllerResult.surface}`,
    verify: controllerResult.verify,
    verifyResult: "pass",
    runtimeProof: "source changed, live website not synced yet",
    review: "approve-next-round",
    verdict: "pass",
  });

  const runAfterRoundClose = loadAutoHermesRun({
    rootDir: fixture.dir,
    runId: activeRun.state.runId,
  });
  assert.equal(runAfterRoundClose.websiteAudit.attempts.length, 1);
  assert.equal(runAfterRoundClose.websiteAudit.emptyAuditCount, 0);
});

check("round-close ignores stale confirmed-empty website-audit state when closing a normal queue round", async () => {
  const runStateModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-run-state.mjs")).href;
  const { createAutoHermesRun, loadAutoHermesRun } = await import(runStateModuleUrl);
  const fixture = makeControllerFixture(`- [ ] Fix Profile empty state
  Files: \`frontend/src/pages/Profile.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Normal queue work should not inherit stale website-audit exhaustion state
  Done when: the profile page empty state is fixed
  Verify: \`cd frontend && npm run lint && npm run build\``);
  const controllerJson = path.join(fixture.dir, ".ai-sync", "controller.json");
  const controllerMd = path.join(fixture.dir, ".ai-sync", "controller.md");
  const controllerResult = runAutoHermesController({
    json: true,
    write: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    outputJson: controllerJson,
    outputMd: controllerMd,
  }).result;
  assert.notEqual(controllerResult.source, "website-audit");

  const activeRun = createAutoHermesRun({
    rootDir: fixture.dir,
    mode: "auto-hermes",
    goal: "Fix Profile empty state on Profile",
  });
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");
  fs.writeFileSync(loopStateJson, JSON.stringify({
    auditRunId: activeRun.state.runId,
    websiteAudit: {
      attempted: true,
      mode: "website-audit",
      status: "fallback-selected",
      usedFallback: true,
      summary: "Stale confirmed-empty website audit from an earlier round",
      queueState: {
        status: "confirmed-empty",
        path: "TASKS.md",
        source: "website-audit-empty-queue",
      },
      candidate: {
        mode: "website-audit",
        surface: "Analysis",
        title: "Improve Analysis page",
        files: ["frontend/src/pages/Analysis.jsx"],
        problemClass: "frontend-design",
        owner: "frontend-agent",
        verify: "cd frontend && npm run lint && npm run build",
        reason: "Earlier audit fallback candidate",
      },
      metadata: {
        signals: {
          productScreens: ["Analysis"],
          pagesIndexed: ["Analysis"],
          contextLedgerPresent: true,
        },
      },
    },
  }, null, 2), "utf8");

  runAutoHermesRoundClose({
    write: true,
    json: true,
    refreshController: false,
    refreshLoopBriefs: false,
    refreshFinish: false,
    selfCheck: false,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    loopStateJson,
    agentSyncMd: fixture.files.agentSync,
    controllerJson,
    controllerMd,
    promotionJson: path.join(fixture.dir, ".ai-sync", "promotion.json"),
    promotionMd: path.join(fixture.dir, ".ai-sync", "promotion.md"),
    loopJson: path.join(fixture.dir, ".ai-sync", "loop.json"),
    loopMd: path.join(fixture.dir, ".ai-sync", "loop.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "coordinator.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "prompt.md"),
    task: controllerResult.title,
    surface: controllerResult.surface,
    files: controllerResult.files.join("||"),
    summary: "Closed a standard queue round",
    goal: "Fix Profile empty state on Profile",
    verify: controllerResult.verify,
    verifyResult: "pass",
    runtimeProof: "source changed, live website not synced yet",
    review: "approve-next-round",
    verdict: "pass",
  });

  const persistedRun = loadAutoHermesRun({
    rootDir: fixture.dir,
    runId: activeRun.state.runId,
  });
  assert.equal(persistedRun.websiteAudit.attempts.length, 0);
  assert.equal(persistedRun.websiteAudit.lastFoundCandidateSummary, "");
  assert.equal(persistedRun.websiteAudit.lastAuditSummary, "");
});

check("normal queue rounds clear stale confirmed-empty website-audit loop state", () => {
  const fixture = makeControllerFixture(`- [ ] Fix Profile empty state
  Files: \`frontend/src/pages/Profile.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Normal queue work should not inherit stale website-audit exhaustion state
  Done when: the profile page empty state is fixed
  Verify: \`cd frontend && npm run lint && npm run build\``);
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");
  fs.writeFileSync(loopStateJson, JSON.stringify({
    auditRunId: "ahr-test-run",
    websiteAudit: {
      attempted: true,
      mode: "website-audit",
      status: "fallback-selected",
      usedFallback: true,
      summary: "Stale confirmed-empty website audit from an earlier round",
      queueState: {
        status: "confirmed-empty",
        path: "TASKS.md",
        source: "website-audit-empty-queue",
      },
      candidate: {
        mode: "website-audit",
        surface: "Analysis",
        title: "Improve Analysis page",
        files: ["frontend/src/pages/Analysis.jsx"],
        problemClass: "frontend-design",
        owner: "frontend-agent",
        verify: "cd frontend && npm run lint && npm run build",
        reason: "Earlier audit fallback candidate",
      },
    },
  }, null, 2), "utf8");

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
    loopStateJson,
  });

  assert.equal(state.websiteAudit, null);
  const persistedLoopState = JSON.parse(fs.readFileSync(loopStateJson, "utf8"));
  assert.equal(persistedLoopState.websiteAudit, null);
});

check("executed normal queue rounds refresh post-round work units and clear stale website-audit state", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");
  fs.writeFileSync(loopStateJson, JSON.stringify({
    auditRunId: "ahr-test-run",
    websiteAudit: {
      attempted: true,
      mode: "website-audit",
      status: "fallback-selected",
      usedFallback: true,
      summary: "Stale confirmed-empty website audit from an earlier round",
      queueState: {
        status: "confirmed-empty",
        path: "TASKS.md",
        source: "website-audit-empty-queue",
      },
      candidate: {
        mode: "website-audit",
        surface: "Analysis",
        title: "Improve Analysis page",
        files: ["frontend/src/pages/Analysis.jsx"],
        problemClass: "frontend-design",
        owner: "frontend-agent",
        verify: "cd frontend && npm run lint && npm run build",
        reason: "Earlier audit fallback candidate",
      },
    },
  }, null, 2), "utf8");

  const executorCommand = [
    `$p='${fixture.files.tasks.replace(/'/g, "''")}'`,
    `$lines = @('# Hermes Tasks', '', '## Active Tasks', '- [ ] Fix Profile empty state', '  Files: \`frontend/src/pages/Profile.jsx\`', '  Problem: frontend-design', '  Context: Promoted from executor round', '  Done when: the profile page empty state is fixed', '  Verify: \`cd frontend && npm run lint && npm run build\`', '', '## Tech Debt Tasks', '', '## Suggested Next Tasks')`,
    'Set-Content -LiteralPath $p -Value $lines -Encoding UTF8',
  ].join("; ");

  const { state } = runAutoHermesLoop({
    json: true,
    write: true,
    runtime: "codex-live",
    executorCommand,
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
    loopStateJson,
  });

  assert.equal(state.status, "max-rounds-reached");
  assert.equal(state.lastWorkUnit?.title, "Fix Profile empty state");
  assert.equal(state.websiteAudit, null);

  const persistedLoopState = JSON.parse(fs.readFileSync(loopStateJson, "utf8"));
  assert.equal(persistedLoopState.currentTask, "Fix Profile empty state");
  assert.equal(persistedLoopState.websiteAudit, null);
});

check("standard auto-hermes loop waits for repeated website-audit exhaustion only for confirmed-empty queues", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");

  const { state } = runAutoHermesLoop({
    json: true,
    dryRun: true,
    write: true,
    maxRounds: 3,
    maxSameWorkUnitRepeats: 2,
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
    loopStateJson,
  });

  assert.equal(state.status, "stop-exhausted");
  assert.equal(
    state.stopReason,
    "Controller reported no promotable work; website audit found no bounded fallback candidate (queue state: confirmed-empty).",
  );
  assert.equal(state.history.filter((entry) => entry.action === "audit-empty").length, 2);
  const persistedLoopState = JSON.parse(fs.readFileSync(loopStateJson, "utf8"));
  assert.equal(persistedLoopState.status, "stop-exhausted");
  assert.equal(persistedLoopState.currentRound, 2);
  assert.equal(persistedLoopState.resumable, false);
  assert.equal(persistedLoopState.websiteAudit.emptyAuditCount, 2);
});

check("claim-contention and other non-empty queue states do not count as website-audit exhaustion", () => {
  const fixture = makeControllerFixture(`- [ ] Fix Garmin controller trust gap
  Files: \`backend/src/main/java/com/hermes/backend/GarminConnectController.java\`
  Problem: backend-logic
  Owner: backend-agent
  Context: Existing active task already claimed elsewhere
  Done when: Garmin controller trust gap is resolved
  Verify: \`cd backend && ./mvnw -q -DskipTests compile\``);
  const claimDir = path.join(fixture.dir, ".ai-sync", "claims");

  const claim = acquireTaskClaim({
    claimDir,
    key: taskClaimKey({
      source: "active-task",
      surface: "Garmin Connect",
      title: "Fix Garmin controller trust gap",
    }),
    ownerId: "owner-a",
    ownerLabel: "thread-a",
    source: "active-task",
    surface: "Garmin Connect",
    title: "Fix Garmin controller trust gap",
  });
  assert.equal(claim.acquired, true);
  const loopStateJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_LOOP_STATE.json");

  const { state } = runAutoHermesLoop({
    json: true,
    dryRun: true,
    write: true,
    maxRounds: 2,
    claimDir,
    claimOwner: "owner-b",
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
    loopStateJson,
  });

  assert.equal(state.status, "stop-exhausted");
  assert.match(state.stopReason, /claimed by other auto-hermes threads/i);
  assert.equal(state.history.some((entry) => entry.action === "audit-empty"), false);
  const persistedLoopState = JSON.parse(fs.readFileSync(loopStateJson, "utf8"));
  assert.equal(persistedLoopState.websiteAudit?.emptyAuditCount || 0, 0);
});

check("finish helper blocks workflow-only files and accepts publishable product files", () => {
  const blocked = runAutoHermesFinish({
    json: true,
    task: "meta check",
    surface: "Auto-Hermes Workflow",
    summary: "workflow-only diff",
    files: ".tools/auto-hermes-loop.mjs||.tools/auto-hermes-round-close.mjs",
    strictFiles: true,
  }).result;

  assert.equal(blocked.eligible, false);
  assert.ok(blocked.reason.includes("blocked"));
  assert.equal(blocked.policies.every((item) => item.bucket !== "publishable"), true);

  const allowed = runAutoHermesFinish({
    json: true,
    task: "backend compile guard",
    surface: "Backend Runtime Proof Gate",
    summary: "shared helper update",
    files: ".tools/verify-backend-runtime-sync.mjs",
  }).result;

  assert.equal(allowed.eligible, true);
  assert.equal(allowed.policies[0].bucket, "publishable");
});

check("finish helper includes push intent in the generated auto-commit command when requested", () => {
  const fixture = makeFixture();
  fs.writeFileSync(path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    passed: true,
    gitHead: "",
    statusSnapshot: "",
    command: "mock-pass",
    reason: "mock pass",
    output: "ok",
  }, null, 2));
  const finish = runAutoHermesFinish({
    json: true,
    task: "publishable round",
    surface: "Runner Profile",
    summary: "ready to publish",
    files: "frontend/src/pages/ProfileDashboard.jsx",
    push: true,
    dockerGateJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.json"),
    dockerGateMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.md"),
    dockerGateSkipRepoCheck: true,
  }).result;

  assert.equal(finish.eligible, true);
  assert.equal(finish.attemptedPush, true);
  assert.match(finish.command, /-Push/);
  assert.equal(finish.dockerGate.fresh, true);
});

check("finish helper blocks push when the Docker gate fails", () => {
  const fixture = makeFixture();
  fs.writeFileSync(path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    passed: false,
    gitHead: "",
    statusSnapshot: "",
    command: "mock-fail",
    reason: "mock fail",
    output: "fail",
  }, null, 2));
  const finish = runAutoHermesFinish({
    json: true,
    task: "publishable round",
    surface: "Runner Profile",
    summary: "ready to publish",
    files: "frontend/src/pages/ProfileDashboard.jsx",
    push: true,
    dockerGateJson: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.json"),
    dockerGateMd: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.md"),
    dockerGateSkipRepoCheck: true,
  }).result;

  assert.equal(finish.eligible, false);
  assert.equal(finish.attemptedPush, true);
  assert.equal(finish.dockerGate.fresh, false);
  assert.match(finish.reason, /Docker publish gate/i);
});

check("finish helper skips email notification when the finish path is not a true clean stop", () => {
  const finish = runAutoHermesFinish({
    json: true,
    task: "continue loop",
    surface: "Analysis",
    summary: "promotion still pending",
    files: ".tools/auto-hermes-loop.mjs",
    notifyEnv: {
      SPRING_MAIL_HOST: "smtp.example.com",
      AUTO_HERMES_NOTIFY_TO: "runner@example.com",
    },
    notifyTransport: () => {
      throw new Error("notify transport should not run");
    },
  }).result;

  assert.equal(finish.notification.status, "skipped");
  assert.match(finish.notification.reason, /true clean stop/i);
});

check("finish helper sends email notification on true-stop finish paths when SMTP and recipient config are present", () => {
  const fixture = makeFixture();
  const notifyJson = path.join(fixture.dir, ".ai-sync", "notify.json");
  const notifyMd = path.join(fixture.dir, ".ai-sync", "notify.md");
  let captured = null;

  const finish = runAutoHermesFinish({
    json: true,
    write: true,
    commit: true,
    task: "workflow stop",
    surface: "auto-hermes-self",
    summary: "bounded loop stopped cleanly",
    files: ".tools/auto-hermes-loop.mjs",
    outputJson: path.join(fixture.dir, ".ai-sync", "finish.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "finish.md"),
    notifyJson,
    notifyMd,
    notifyEnv: {
      SPRING_MAIL_HOST: "smtp.example.com",
      SPRING_MAIL_PORT: "587",
      SPRING_MAIL_USERNAME: "mailer",
      SPRING_MAIL_PASSWORD: "secret",
      APP_MAIL_FROM: "noreply@example.com",
      AUTO_HERMES_NOTIFY_TO: "runner@example.com",
    },
    notifyTransport: (payload) => {
      captured = payload;
      return {
        transport: "test",
        deliveryId: "mock-delivery",
      };
    },
  }).result;

  assert.equal(finish.notification.status, "sent");
  assert.equal(captured.to, "runner@example.com");
  assert.equal(captured.from, "noreply@example.com");
  assert.match(captured.subject, /auto-hermes/i);
  assert.match(captured.body, /bounded loop stopped cleanly/i);
  assert.equal(fs.existsSync(notifyJson), true);
  assert.equal(fs.existsSync(notifyMd), true);
  assert.equal(JSON.parse(fs.readFileSync(notifyJson, "utf8")).status, "sent");
});

check("finish helper skips email notification when SMTP or recipient config is missing", () => {
  const finish = runAutoHermesFinish({
    json: true,
    commit: true,
    task: "workflow stop",
    surface: "auto-hermes-language",
    summary: "language pass finished",
    files: ".tools/auto-hermes-language.mjs",
    notifyEnv: {
      SPRING_MAIL_HOST: "",
      AUTO_HERMES_NOTIFY_TO: "",
    },
    notifyTransport: () => {
      throw new Error("notify transport should not run");
    },
  }).result;

  assert.equal(finish.notification.status, "skipped");
  assert.match(finish.notification.reason, /not configured/i);
});

check("finish helper records a warning when email notification fails without blocking finish completion", () => {
  const fixture = makeFixture();
  const notifyJson = path.join(fixture.dir, ".ai-sync", "notify-warning.json");

  const finish = runAutoHermesFinish({
    json: true,
    write: true,
    commit: true,
    task: "workflow stop",
    surface: "auto-hermes-max",
    summary: "parent loop stopped cleanly",
    files: ".tools/auto-hermes-max-loop.mjs",
    outputJson: path.join(fixture.dir, ".ai-sync", "finish-warning.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "finish-warning.md"),
    notifyJson,
    notifyMd: path.join(fixture.dir, ".ai-sync", "notify-warning.md"),
    notifyEnv: {
      SPRING_MAIL_HOST: "smtp.example.com",
      AUTO_HERMES_NOTIFY_TO: "runner@example.com",
    },
    notifyTransport: () => {
      throw new Error("smtp timeout");
    },
  }).result;

  assert.equal(finish.notification.status, "warning");
  assert.match(finish.notification.reason, /smtp timeout/i);
  assert.equal(fs.existsSync(notifyJson), true);
  assert.equal(JSON.parse(fs.readFileSync(notifyJson, "utf8")).status, "warning");
});

check("auto-hermes-max stops immediately when the live controller reports no promotable work", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
### TIER 2 — Data Trust
- [ ] Weak suggested item
  Context: missing required promotion fields

## Daily Log
`, "utf8");

  const { state: result } = runAutoHermesMax({
    json: true,
    write: true,
    runtime: "codex-live",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    controllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    controllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "max.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "max.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "max-coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "max-coordinator.md"),
    lanesDir: path.join(fixture.dir, ".ai-sync", "lanes"),
    resultsDir: path.join(fixture.dir, ".ai-sync", "results"),
    mergeJson: path.join(fixture.dir, ".ai-sync", "merge.json"),
    mergeMd: path.join(fixture.dir, ".ai-sync", "merge.md"),
  });

  assert.equal(result.status, "stop-exhausted");
  assert.equal(result.selectedLaneCount, 0);
  assert.equal(result.nextAction, "stop");
  assert.match(result.selectionRationale, /no promotable work/i);

  const coordinatorMd = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "max-coordinator.md"), "utf8");
  assert.match(coordinatorMd, /Status: stop-exhausted/);
  assert.match(coordinatorMd, /Selected Lane Count: 0/);
});

check("auto-hermes-max falls back to website audit work and carries audit metadata into the max loop", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");
  fs.writeFileSync(fixture.files.humanLoop, `# Human Loop

## Current Status
- Status: active

## Agent Mode
- Mode: autonomous

## Agent Writeback Format
- Last round verdict: pass - previous frontend round
- Current owned surface: Analysis
- Next intended round: Analysis page has no visible empty state (active-task) on Analysis
- Self-loop state: continue-self-loop - promoted next bounded round: Analysis page has no visible empty state
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");
  const explicitPlanPath = path.join(fixture.dir, ".ai-sync", "preexisting-plan.json");
  fs.writeFileSync(explicitPlanPath, JSON.stringify({
    parentGoal: "Stale explicit plan should not win when controller is exhausted",
    preserve: [],
    lanes: [
      {
        laneId: "lane-plan",
        goal: "Stale plan lane",
        ownedFiles: ["frontend/src/pages/StalePlan.jsx"],
      },
    ],
  }, null, 2), "utf8");

  const maxOutputJson = path.join(fixture.dir, ".ai-sync", "max.json");
  const maxOutputMd = path.join(fixture.dir, ".ai-sync", "max.md");
  const maxCoordinatorJson = path.join(fixture.dir, ".ai-sync", "max-coordinator.json");
  const maxCoordinatorMd = path.join(fixture.dir, ".ai-sync", "max-coordinator.md");
  const maxLanesDir = path.join(fixture.dir, ".ai-sync", "lanes");
  const loopOutputJson = path.join(fixture.dir, ".ai-sync", "max-loop.json");
  const loopOutputMd = path.join(fixture.dir, ".ai-sync", "max-loop.md");
  const loopCoordinatorJson = path.join(fixture.dir, ".ai-sync", "loop-coordinator.json");
  const loopCoordinatorMd = path.join(fixture.dir, ".ai-sync", "loop-coordinator.md");
  const loopLanesDir = path.join(fixture.dir, ".ai-sync", "loop-lanes");
  const loopBriefJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_MAX_LOOP_BRIEF.json");
  const loopBriefMd = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_MAX_LOOP_BRIEF.md");
  const loopPromptFile = path.join(fixture.dir, ".ai-sync", "loop-prompt.md");

  const { state: result } = runAutoHermesMax({
    json: true,
    write: true,
    runtime: "codex-live",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    planFile: explicitPlanPath,
    liveControllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    liveControllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    outputJson: maxOutputJson,
    outputMd: maxOutputMd,
    coordinatorJson: maxCoordinatorJson,
    coordinatorMd: maxCoordinatorMd,
    lanesDir: maxLanesDir,
    resultsDir: path.join(fixture.dir, ".ai-sync", "results"),
    mergeJson: path.join(fixture.dir, ".ai-sync", "merge.json"),
    mergeMd: path.join(fixture.dir, ".ai-sync", "merge.md"),
  });

  assert.equal(result.status, "ready-to-launch");
  assert.equal(result.selectedLaneCount, 1);
  assert.equal(result.nextAction, "codex-live-launch-single-lane");
  assert.equal(result.planSource, "website-audit-fallback");
  assert.equal(result.websiteAudit?.mode, "website-audit");
  assert.match(result.websiteAudit?.summary || "", /controller reported no promotable work/i);
  assert.equal(result.websiteAudit?.usedFallback, true);
  assert.deepEqual(result.websiteAudit?.queueState, {
    status: "confirmed-empty",
    path: "TASKS.md",
    source: "explicit-or-inferred",
  });
  assert.equal(result.websiteAudit?.candidate?.surface, "Analysis");
  assert.deepEqual(result.websiteAudit?.candidate?.files, ["frontend/src/pages/Analysis.jsx"]);
  assert.equal(result.websiteAudit?.metadata?.signals?.contextLedgerPresent, true);
  assert.equal(result.parentGoal, "Improve Analysis page on Analysis");

  const persistedPlanner = JSON.parse(fs.readFileSync(maxCoordinatorJson, "utf8"));
  assert.equal(persistedPlanner.planSource, "website-audit-fallback");
  assert.equal(persistedPlanner.websiteAudit?.mode, "website-audit");
  assert.equal(persistedPlanner.websiteAudit?.usedFallback, true);

  const plannerCoordinatorMd = fs.readFileSync(maxCoordinatorMd, "utf8");
  assert.match(plannerCoordinatorMd, /Plan Source: website-audit-fallback/);
  assert.match(plannerCoordinatorMd, /Website Audit: fallback-selected/);

  const plannerLane = JSON.parse(fs.readFileSync(path.join(maxLanesDir, "lane-1.json"), "utf8"));
  assert.deepEqual(plannerLane.ownedFiles, ["frontend/src/pages/Analysis.jsx"]);

  const { state: loopState } = runAutoHermesMaxLoop({
    json: true,
    write: true,
    dryRun: true,
    runtime: "codex-live",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    planFile: explicitPlanPath,
    liveControllerJson: path.join(fixture.dir, ".ai-sync", "controller-loop.json"),
    liveControllerMd: path.join(fixture.dir, ".ai-sync", "controller-loop.md"),
    outputJson: loopOutputJson,
    outputMd: loopOutputMd,
    coordinatorJson: loopCoordinatorJson,
    coordinatorMd: loopCoordinatorMd,
    lanesDir: loopLanesDir,
    resultsDir: path.join(fixture.dir, ".ai-sync", "loop-results"),
    mergeJson: path.join(fixture.dir, ".ai-sync", "loop-merge.json"),
    mergeMd: path.join(fixture.dir, ".ai-sync", "loop-merge.md"),
    promptFile: loopPromptFile,
    briefJson: loopBriefJson,
    briefMd: loopBriefMd,
  });

  assert.equal(loopState.status, "dry-run-complete");
  assert.equal(loopState.lastParentGoal, "Improve Analysis page on Analysis");

  const loopBrief = JSON.parse(fs.readFileSync(loopBriefJson, "utf8"));
  assert.equal(loopBrief.parentGoal, "Improve Analysis page on Analysis");
  assert.equal(loopBrief.planSource, "website-audit-fallback");
  assert.equal(loopBrief.websiteAudit?.mode, "website-audit");
  assert.equal(loopBrief.websiteAudit?.usedFallback, true);

  const loopLane = JSON.parse(fs.readFileSync(path.join(loopLanesDir, "lane-1.json"), "utf8"));
  assert.deepEqual(loopLane.ownedFiles, ["frontend/src/pages/Analysis.jsx"]);

  const loopPrompt = fs.readFileSync(loopPromptFile, "utf8");
  assert.match(loopPrompt, /website audit summary: controller reported no promotable work/i);
  assert.match(loopPrompt, /audit-generated fallback work exactly like a normal first parent goal/i);
  assert.match(loopPrompt, /came from the website-audit fallback because the controller reported no promotable work/i);
  assert.match(loopPrompt, /frontend\/src\/pages\/Analysis\.jsx/);
});

check("auto-hermes-max ignores a stale default no-lane plan file and still falls back to website audit", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");
  fs.writeFileSync(fixture.files.humanLoop, `# Human Loop

## Current Status
- Status: active

## Agent Mode
- Mode: autonomous

## Agent Writeback Format
- Last round verdict: pass - previous frontend round
- Current owned surface: Analysis
- Next intended round: Analysis page has no visible empty state (active-task) on Analysis
- Self-loop state: continue-self-loop - promoted next bounded round: Analysis page has no visible empty state
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");

  const staleDefaultPlanPath = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_MAX_PLAN.json");
  fs.writeFileSync(staleDefaultPlanPath, JSON.stringify({
    parentGoal: "No promotable work found",
    preserve: [],
    laneSelection: {
      strategy: "auto",
      minLaneCount: 1,
      maxLaneCount: 5,
    },
    lanes: [],
  }, null, 2), "utf8");

  const { state: result } = runAutoHermesMax({
    json: true,
    write: true,
    runtime: "codex-live",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    planFile: staleDefaultPlanPath,
    liveControllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    liveControllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "max.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "max.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "max-coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "max-coordinator.md"),
    lanesDir: path.join(fixture.dir, ".ai-sync", "lanes"),
    resultsDir: path.join(fixture.dir, ".ai-sync", "results"),
    mergeJson: path.join(fixture.dir, ".ai-sync", "merge.json"),
    mergeMd: path.join(fixture.dir, ".ai-sync", "merge.md"),
  });

  assert.equal(result.planSource, "website-audit-fallback");
  assert.equal(result.status, "ready-to-launch");
  assert.equal(result.selectedLaneCount, 1);
  assert.equal(result.websiteAudit?.mode, "website-audit");
  assert.equal(result.websiteAudit?.candidate?.files?.[0], "frontend/src/pages/Analysis.jsx");
});

check("auto-hermes-max ignores a stale default no-lane plan file when the controller already has promotable work", () => {
  const fixture = makeControllerFixture(`- [ ] Fix Admin backend regression
  Files: \`backend/src/main/java/com/hermes/backend/AdminController.java\`
  Problem: backend-logic
  Owner: backend-agent
  Context: Existing active task should beat stale no-lane max plan file
  Done when: Admin backend regression is resolved and verified
  Verify: \`cd backend && ./mvnw -q -DskipTests compile\``);

  const staleDefaultPlanPath = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_MAX_PLAN.json");
  fs.writeFileSync(staleDefaultPlanPath, JSON.stringify({
    parentGoal: "No promotable work found",
    preserve: [],
    laneSelection: {
      strategy: "auto",
      minLaneCount: 1,
      maxLaneCount: 5,
    },
    lanes: [],
  }, null, 2), "utf8");

  const { state: result } = runAutoHermesMax({
    json: true,
    write: true,
    runtime: "codex-live",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    planFile: staleDefaultPlanPath,
    liveControllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    liveControllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "max.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "max.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "max-coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "max-coordinator.md"),
    lanesDir: path.join(fixture.dir, ".ai-sync", "lanes"),
    resultsDir: path.join(fixture.dir, ".ai-sync", "results"),
    mergeJson: path.join(fixture.dir, ".ai-sync", "merge.json"),
    mergeMd: path.join(fixture.dir, ".ai-sync", "merge.md"),
  });

  assert.equal(result.planSource, "controller-derived");
  assert.equal(result.status, "ready-to-launch");
  assert.equal(result.selectedLaneCount, 1);
  assert.equal(result.parentGoal, "Fix Admin backend regression on Admin");
  assert.equal(result.websiteAudit?.usedFallback, false);
});

check("run-state helper creates, loads, and increments website-audit exhaustion safely", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-run-state.mjs")).href;
  const {
    createAutoHermesRun,
    loadAutoHermesRun,
    recordWebsiteAuditAttempt,
  } = await import(moduleUrl);

  const fixture = makeFixture();
  const created = createAutoHermesRun({
    rootDir: fixture.dir,
    mode: "auto-hermes-max",
    goal: "Continuous website audit",
  });

  assert.equal(created.state.mode, "auto-hermes-max");
  assert.equal(created.state.websiteAudit.emptyAuditCount, 0);

  const firstAttempt = recordWebsiteAuditAttempt({
    rootDir: fixture.dir,
    runId: created.state.runId,
    foundCandidate: false,
    auditSummary: "No bounded candidate found",
  });
  assert.equal(firstAttempt.websiteAudit.emptyAuditCount, 1);

  const loaded = loadAutoHermesRun({
    rootDir: fixture.dir,
    runId: created.state.runId,
  });
  assert.equal(loaded.websiteAudit.emptyAuditCount, 1);
});

check("supervisor skeleton keeps empty queue alive until repeated no-candidate audits reach the limit", () => {
  const initial = createAutoHermesSupervisorState({
    mode: "auto-hermes-max",
    noCandidateAuditLimit: 3,
  });

  assert.equal(initial.preferredContinuityLayer, "supervisor");
  assert.equal(initial.firstExhaustionFallback, "website-audit-explorer");
  assert.equal(initial.trueStopCondition, "repeated-no-candidate-audit-rounds");

  const awaitingAudit = evaluateAutoHermesSupervisorRound({
    state: initial,
    queueState: "empty",
    websiteAuditStatus: "pending",
    summary: "Queue exhausted; website audit should run next",
  });
  assert.equal(awaitingAudit.stop, false);
  assert.equal(awaitingAudit.decision, "continue");
  assert.equal(awaitingAudit.repeatedNoCandidateAuditRounds, 0);
  assert.match(awaitingAudit.rationale, /does not immediately stop/i);
  assert.match(awaitingAudit.rationale, /website-audit explorer is the first exhaustion fallback/i);

  const firstMiss = evaluateAutoHermesSupervisorRound({
    state: awaitingAudit,
    queueState: "empty",
    websiteAuditStatus: "no-candidate",
    summary: "No bounded candidate found",
  });
  assert.equal(firstMiss.stop, false);
  assert.equal(firstMiss.repeatedNoCandidateAuditRounds, 1);

  const secondMiss = evaluateAutoHermesSupervisorRound({
    state: firstMiss,
    queueState: "empty",
    websiteAuditStatus: "no-candidate",
    summary: "Still no bounded candidate found",
  });
  assert.equal(secondMiss.stop, false);
  assert.equal(secondMiss.repeatedNoCandidateAuditRounds, 2);

  const stopState = evaluateAutoHermesSupervisorRound({
    state: secondMiss,
    queueState: "empty",
    websiteAuditStatus: "no-candidate",
    summary: "Third consecutive no-candidate audit round",
  });
  assert.equal(stopState.stop, true);
  assert.equal(stopState.decision, "stop");
  assert.equal(stopState.repeatedNoCandidateAuditRounds, 3);
  assert.match(stopState.rationale, /true stop condition/i);

  const recovered = evaluateAutoHermesSupervisorRound({
    state: stopState,
    queueState: "empty",
    websiteAuditStatus: "candidate",
    summary: "Website audit produced a bounded Analysis candidate",
  });
  assert.equal(recovered.stop, false);
  assert.equal(recovered.repeatedNoCandidateAuditRounds, 0);
});

check("auto-hermes-max loop consults supervisor continuity before true stop on repeated no-candidate audits", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");
  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "");

  const { state: loopState } = runAutoHermesMaxLoop({
    json: true,
    write: true,
    dryRun: true,
    runtime: "codex-live",
    maxIterations: 3,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    liveControllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    liveControllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    planFile: path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_MAX_PLAN.json"),
    outputJson: path.join(fixture.dir, ".ai-sync", "max-loop.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "max-loop.md"),
    briefJson: path.join(fixture.dir, ".ai-sync", "max-loop-brief.json"),
    briefMd: path.join(fixture.dir, ".ai-sync", "max-loop-brief.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "max-coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "max-coordinator.md"),
    lanesDir: path.join(fixture.dir, ".ai-sync", "lanes"),
    resultsDir: path.join(fixture.dir, ".ai-sync", "results"),
    mergeJson: path.join(fixture.dir, ".ai-sync", "merge.json"),
    mergeMd: path.join(fixture.dir, ".ai-sync", "merge.md"),
    promptFile: path.join(fixture.dir, ".ai-sync", "max-loop-prompt.md"),
  });

  assert.equal(loopState.status, "stop-exhausted");
  assert.equal(loopState.history.filter((entry) => entry.action === "audit-empty").length, 3);
  assert.match(loopState.stopReason, /controller reported repeated website-audit exhaustion/i);
  assert.equal(loopState.supervisorState?.stop, true);
  assert.equal(loopState.supervisorState?.repeatedNoCandidateAuditRounds, 3);
});

check("auto-hermes-max loop refreshes merge state at the configured custom paths after a real iteration", () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks
- [ ] Real max-loop sandbox task
  Files: \`.tmp/real-ahmax/work/target.txt\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Safe sandbox task for live /auto-hermes-max parent-loop verification.
  Done when: the target file is updated through the sandbox lane and merge completes.
  Verify: \`Get-Content .tmp/real-ahmax/work/target.txt\`

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");

  const sandboxRoot = path.join(fixture.dir, ".tmp", "real-ahmax");
  fs.mkdirSync(path.join(sandboxRoot, ".ai-sync"), { recursive: true });
  fs.mkdirSync(path.join(sandboxRoot, "work"), { recursive: true });
  fs.writeFileSync(path.join(sandboxRoot, "work", "target.txt"), "pending", "utf8");
  fs.writeFileSync(path.join(sandboxRoot, ".ai-sync", "HUMAN_LOOP.md"), "# Human Loop\n\n## Current Status\n- Status: active\n", "utf8");
  fs.writeFileSync(path.join(sandboxRoot, ".ai-sync", "AGENT_SYNC.md"), "# Cross-Agent Sync\n\n## Active Claims\n- none\n", "utf8");
  fs.writeFileSync(path.join(sandboxRoot, ".ai-sync", "CONTEXT_LEDGER.md"), "# Context Ledger\n\n## Surface Capsules\n### Sandbox\n- Goal: Validate the real /auto-hermes-max parent loop on an isolated harness.\n", "utf8");
  fs.writeFileSync(path.join(sandboxRoot, ".ai-sync", "LOOP_STATE.md"), "# Loop State\n", "utf8");

  const planPath = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_PLAN.json");
  fs.writeFileSync(planPath, JSON.stringify({
    parentGoal: "Real max-loop sandbox run",
    preserve: [],
    laneSelection: {
      strategy: "fixed",
      requestedLaneCount: 1,
      minLaneCount: 1,
      maxLaneCount: 5,
    },
    lanes: [
      {
        laneId: "sandbox-lane",
        goal: "Write a verified sandbox completion marker.",
        ownedFiles: [".tmp/real-ahmax/work/target.txt"],
        mustPreserve: [],
        verify: "Get-Content .tmp/real-ahmax/work/target.txt",
        mergeNotes: "sandbox harness lane",
        priority: 1,
        effort: "small",
        parallelSafe: true,
        dependsOn: [],
        dependencyMode: "parallel-ready",
      },
    ],
  }, null, 2), "utf8");

  const loopOutputJson = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_LOOP.json");
  const loopOutputMd = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_LOOP.md");
  const loopBriefJson = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_LOOP_BRIEF.json");
  const loopBriefMd = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_LOOP_BRIEF.md");
  const coordinatorJson = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_COORDINATOR.json");
  const coordinatorMd = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_COORDINATOR.md");
  const mergeJson = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_MERGE.json");
  const mergeMd = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_MERGE.md");
  const resultsDir = path.join(sandboxRoot, ".ai-sync", "auto-hermes-max-results");
  const promptFile = path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_MAX_NEXT_PROMPT.md");

  const executorCommand = [
    `$coord = Get-Content -Raw '${coordinatorJson.replace(/'/g, "''")}' | ConvertFrom-Json`,
    "$lane = $coord.lanes[0]",
    `Set-Content -LiteralPath '${path.join(sandboxRoot, "work", "target.txt").replace(/'/g, "''")}' -Value 'sandbox-lane-complete'`,
    "$payload = @{ laneId = $lane.laneId; parentRunId = $lane.parentRunId; correlationId = $lane.correlationId; goal = $lane.goal; ownedFiles = $lane.ownedFiles; changedFiles = @('.tmp/real-ahmax/work/target.txt'); completedRounds = @(@{ surface = 'Sandbox'; task = 'Write a verified sandbox completion marker.' }); verification = 'Get-Content .tmp/real-ahmax/work/target.txt => sandbox-lane-complete'; runtimeProof = 'not-needed'; architectVerdict = 'APPROVED'; deslopPass = 'pass'; regressionPass = 'pass'; risks = ''; mustPreserve = @(); mergeNotes = 'sandbox harness lane complete'; status = 'approved' }",
    "$payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $lane.resultFile",
  ].join("; ");

  const { state } = runAutoHermesMaxLoop({
    json: true,
    write: true,
    runtime: "codex-live",
    maxIterations: 1,
    tasks: fixture.files.tasks,
    humanLoop: path.join(sandboxRoot, ".ai-sync", "HUMAN_LOOP.md"),
    agentSync: path.join(sandboxRoot, ".ai-sync", "AGENT_SYNC.md"),
    contextLedger: path.join(sandboxRoot, ".ai-sync", "CONTEXT_LEDGER.md"),
    loopState: path.join(sandboxRoot, ".ai-sync", "LOOP_STATE.md"),
    planFile: planPath,
    liveControllerJson: path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_CONTROLLER.json"),
    liveControllerMd: path.join(sandboxRoot, ".ai-sync", "AUTO_HERMES_CONTROLLER.md"),
    outputJson: loopOutputJson,
    outputMd: loopOutputMd,
    briefJson: loopBriefJson,
    briefMd: loopBriefMd,
    coordinatorJson,
    coordinatorMd,
    lanesDir: path.join(sandboxRoot, ".ai-sync", "auto-hermes-max-lanes"),
    resultsDir,
    mergeJson,
    mergeMd,
    promptFile,
    executorCommand,
  });

  assert.equal(state.iterationsCompleted, 1);
  const mergeState = JSON.parse(fs.readFileSync(mergeJson, "utf8"));
  assert.equal(mergeState.verdict, "approve-merge");
  assert.equal(mergeState.lanes[0].status, "approved");
});

check("website audit emits one bounded candidate from website signals when queue is empty", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-website-audit.mjs")).href;
  const { runAutoHermesWebsiteAudit } = await import(moduleUrl);

  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks
### Frontend Debt

## Suggested Next Tasks
`, "utf8");

  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");
  writeFixtureFile(fixture.dir, "frontend/src/styles/style.css", ".analysis-shell{}\n");

  const { report } = runAutoHermesWebsiteAudit({
    rootDir: fixture.dir,
    tasks: "TASKS.md",
    product: "PRODUCT.md",
    contextLedger: ".ai-sync/CONTEXT_LEDGER.md",
    pagesIndex: ".ai-codex/pages.md",
  });

  assert.equal(report.mode, "website-audit");
  assert.equal(Boolean(report.candidate), true);
  assert.equal(report.candidate.files[0], "frontend/src/pages/Analysis.jsx");
  assert.deepEqual(report.candidate.files, ["frontend/src/pages/Analysis.jsx"]);
  assert.match(report.candidate.verify, /^cd frontend && npm run lint && npm run build$/);
  if (Array.isArray(report.candidates)) {
    assert.equal(report.candidates.length, 1);
  }
});

check("auto-hermes-max writes explorer markdown and parallel lanes declare parent-owned writeback with worktree isolation", () => {
  const fixture = makeFixture();
  const planPath = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_MAX_PLAN.json");
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks
- [ ] Cross-stack race trust fix
  Files: \`frontend/src/pages/RacesDetail.jsx, backend/src/main/java/com/hermes/backend/RaceCourseMapService.java\`
  Problem: cross-stack-contract
  Context: Parallel-safe cross-stack lane planning check
  Done when: the race trust fix is scoped into bounded frontend/backend lanes and verified
  Verify: \`cd frontend && npm run lint && npm run build | cd backend && ./mvnw -q -DskipTests compile\`

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");
  fs.writeFileSync(planPath, JSON.stringify({
    parentGoal: "Cross-stack race trust fix",
    preserve: [],
    laneSelection: { strategy: "fixed", requestedLaneCount: 2, minLaneCount: 1, maxLaneCount: 5 },
    lanes: [
      {
        laneId: "lane-frontend",
        goal: "Frontend slice: Cross-stack race trust fix",
        ownedFiles: ["frontend/src/pages/RacesDetail.jsx"],
        effort: "medium",
        parallelSafe: true,
        dependsOn: [],
        dependencyMode: "parallel-ready",
      },
      {
        laneId: "lane-backend",
        goal: "Backend slice: Cross-stack race trust fix",
        ownedFiles: ["backend/src/main/java/com/hermes/backend/RaceCourseMapService.java"],
        effort: "medium",
        parallelSafe: true,
        dependsOn: [],
        dependencyMode: "parallel-ready",
      },
    ],
  }, null, 2), "utf8");

  const lanesDir = path.join(fixture.dir, ".ai-sync", "lanes");
  const resultsDir = path.join(fixture.dir, ".ai-sync", "results");
  const explorerJsonPath = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_MAX_EXPLORER.json");
  const explorerMdPath = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_MAX_EXPLORER.md");
  const { state: result } = runAutoHermesMax({
    json: true,
    write: true,
    runtime: "codex-live",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    planFile: planPath,
    explorerJson: explorerJsonPath,
    explorerMd: explorerMdPath,
    liveControllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    liveControllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "max.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "max.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "max-coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "max-coordinator.md"),
    lanesDir,
    resultsDir,
    mergeJson: path.join(fixture.dir, ".ai-sync", "merge.json"),
    mergeMd: path.join(fixture.dir, ".ai-sync", "merge.md"),
  });

  assert.equal(result.selectedLaneCount, 2);
  assert.equal(fs.existsSync(explorerMdPath), true);
  const explorerMd = fs.readFileSync(explorerMdPath, "utf8");
  assert.match(explorerMd, /Completed Task:/);
  assert.match(explorerMd, /Parallelism Recommendation:/);

  const laneFrontendJson = JSON.parse(fs.readFileSync(path.join(lanesDir, "lane-frontend.json"), "utf8"));
  assert.equal(laneFrontendJson.isolation, "worktree");
  assert.equal(laneFrontendJson.queueWritebackMode, "deferred-to-parent");
  assert.equal(laneFrontendJson.contextLedgerWritebackMode, "deferred-to-parent");

  const laneFrontendMd = fs.readFileSync(path.join(lanesDir, "lane-frontend.md"), "utf8");
  assert.match(laneFrontendMd, /## Gates/);
  assert.match(laneFrontendMd, /## Result Contract/);
  assert.match(laneFrontendMd, /Parent owns TASKS\.md and CONTEXT_LEDGER\.md writeback/i);
  assert.match(laneFrontendMd, /Isolation: worktree/i);
  assert.doesNotMatch(laneFrontendMd, /Final Checklist Before Writing Result/);
});

check("merge gate treats non-canonical lane statuses as blocked instead of silently accepting legacy aliases", async () => {
  const fixture = makeFixture();
  const resultFile = path.join(fixture.dir, ".ai-sync", "auto-hermes-max-results", "lane-1.json");
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(resultFile, JSON.stringify({
    laneId: "lane-1",
    status: "passed",
    changedFiles: ["frontend/src/pages/Analysis.jsx"],
    completedRounds: [{ surface: "Analysis", task: "Fix analysis empty state" }],
    verification: "cd frontend && npm run lint",
    runtimeProof: "source changed, live site not synced yet",
  }, null, 2), "utf8");

  const coordinatorState = {
    generatedAt: new Date().toISOString(),
    parentGoal: "Parity merge check",
    parentRunId: "ahm-test",
    correlationId: "ahm-test:parent",
    candidateLaneCount: 1,
    selectedLaneCount: 1,
    lanes: [
      {
        laneId: "lane-1",
        correlationId: "ahm-test:lane-1",
        ownedFiles: ["frontend/src/pages/Analysis.jsx"],
        dependencyState: "parallel-ready",
        isolation: "direct",
        resultFile,
        activityLogFile: path.join(fixture.dir, ".ai-sync", "auto-hermes-max-results", "lane-1-activity.json"),
      },
    ],
  };
  const { computeMergeState } = await import(pathToFileURL(path.resolve(".tools/auto-hermes-max-merge.mjs")).href);
  const mergeState = computeMergeState(coordinatorState);
  assert.equal(mergeState.verdict, "blocked");
  assert.equal(mergeState.lanes[0].status, "blocked");
  assert.equal(mergeState.gates.verification, "blocked");
  assert.match(mergeState.summary, /blocked/i);
});

check("round-close rehydrates the queue from controller-selected work when the local queue is empty", () => {
  const taskText = `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
### TIER 2 — Data Trust
`;

  const nextTask = syncQueueWithController(taskText, {
    source: "active-task",
    title: "ShoeCatalogController backend logic has no focused test file - auth, validation, and response-contract behavior can drift unnoticed",
    surface: "Shoe Catalog",
    files: [
      "backend/src/main/java/com/hermes/backend/ShoeCatalogController.java",
      "backend/src/test/java/com/hermes/backend/ShoeCatalogControllerTests.java",
    ],
    context: "Auto-suggested from codebase analysis (backend_logic_guard)",
    doneWhen: "the issue described above is resolved and verified",
    verify: "`cd backend && ./mvnw test -Dtest=ShoeCatalogControllerTests && ./mvnw -q -DskipTests compile`",
  });

  assert.match(nextTask, /## Active Tasks\s+- \[ \] ShoeCatalogController backend logic has no focused test file/i);
  assert.match(nextTask, /Files: `backend\/src\/main\/java\/com\/hermes\/backend\/ShoeCatalogController\.java, backend\/src\/test\/java\/com\/hermes\/backend\/ShoeCatalogControllerTests\.java`/i);
  assert.match(nextTask, /Context: Auto-suggested from codebase analysis \(backend_logic_guard\)/i);
  assert.match(nextTask, /Verify: `cd backend && \.\/mvnw test -Dtest=ShoeCatalogControllerTests && \.\/mvnw -q -DskipTests compile`/i);
});

check("round-close only executes auto-commit on real stop boundaries", () => {
  assert.equal(
    shouldExecuteFinishCommit(
      { verdict: "pass", promoteNext: true },
      { recommended: { title: "Next bounded round" } },
    ),
    false,
  );

  assert.equal(
    shouldExecuteFinishCommit(
      { verdict: "pass", promoteNext: true },
      { recommended: null },
    ),
    true,
  );

  assert.equal(
    shouldExecuteFinishCommit(
      { verdict: "pass", promoteNext: false },
      { recommended: { title: "Ignored because concrete stop" } },
    ),
    true,
  );

  assert.equal(
    shouldExecuteFinishCommit(
      { verdict: "must-fix", promoteNext: true },
      { recommended: null },
    ),
    false,
  );
});

check("round-close downgrades pass verdicts that lack required Ralph verification gates", () => {
  const fixture = makeFixture();
  const roundResultJson = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_ROUND_RESULT.json");
  const roundResultMd = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_ROUND_RESULT.md");

  const { result } = runAutoHermesRoundClose({
    write: true,
    json: true,
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
    task: "GarminConnectController has no unit test file - auth and validation edge cases are untested",
    surface: "Garmin Connect",
    owner: "backend",
    files: "backend/src/main/java/com/hermes/backend/GarminConnectController.java||backend/src/test/java/com/hermes/backend/GarminConnectControllerTests.java",
    summary: "Attempted to close the round without architect/deslop/regression evidence",
    goal: "Protect the Garmin controller round with a real Ralph completion gate",
    preserve: "Existing API contract",
    risk: "Missing evidence would let partial work be marked complete",
    verify: "cd backend && ./mvnw test -Dtest=GarminConnectControllerTests",
    verifyResult: "pass",
    runtimeProof: "not-needed",
    review: "approve-next-round",
    verdict: "pass",
  });

  assert.equal(result.verdict, "must-fix");
  assert.equal(result.review, "ralph-gate-must-fix");
  assert.equal(fs.existsSync(roundResultJson), true);
  assert.equal(fs.existsSync(roundResultMd), true);

  const roundResult = JSON.parse(fs.readFileSync(roundResultJson, "utf8"));
  assert.equal(roundResult.ralphGate.pass, false);
  assert.equal(roundResult.ralphGate.gates.architectReview, "missing");
  assert.equal(roundResult.ralphGate.gates.deslop, "missing");
  assert.equal(roundResult.ralphGate.gates.regression, "missing");
  assert.match(roundResult.ralphGate.summary, /architect|deslop|regression/i);
});

check("merge gate requires architect, deslop, and regression proof for approved Ralph lanes", async () => {
  const fixture = makeFixture();
  const resultFile = path.join(fixture.dir, ".ai-sync", "auto-hermes-max-results", "lane-1.json");
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(resultFile, JSON.stringify({
    laneId: "lane-1",
    status: "approved",
    changedFiles: ["frontend/src/pages/Analysis.jsx"],
    completedRounds: [{ surface: "Analysis", task: "Fix analysis empty state" }],
    verification: "cd frontend && npm run lint && npm run build",
    runtimeProof: "source changed, live site not synced yet",
    architectVerdict: "",
    deslopPass: "",
    regressionPass: "",
  }, null, 2), "utf8");

  const coordinatorState = {
    generatedAt: new Date().toISOString(),
    parentGoal: "Parity merge check",
    parentRunId: "ahm-test",
    correlationId: "ahm-test:parent",
    candidateLaneCount: 1,
    selectedLaneCount: 1,
    lanes: [
      {
        laneId: "lane-1",
        correlationId: "ahm-test:lane-1",
        ownedFiles: ["frontend/src/pages/Analysis.jsx"],
        dependencyState: "parallel-ready",
        isolation: "direct",
        resultFile,
        activityLogFile: path.join(fixture.dir, ".ai-sync", "auto-hermes-max-results", "lane-1-activity.json"),
      },
    ],
  };
  const { computeMergeState } = await import(pathToFileURL(path.resolve(".tools/auto-hermes-max-merge.mjs")).href);
  const mergeState = computeMergeState(coordinatorState);
  assert.equal(mergeState.verdict, "must-fix-before-merge-complete");
  assert.equal(mergeState.gates.review, "blocked");
  assert.equal(mergeState.gates.deslop, "blocked");
  assert.equal(mergeState.gates.regressionReverification, "blocked");
  assert.match(mergeState.summary, /architect|deslop|regression/i);
});

check("round-close only executes push when explicitly requested on a real stop boundary", () => {
  assert.equal(
    shouldExecuteFinishPush(
      { verdict: "pass", promoteNext: true, push: true },
      { recommended: { title: "Next bounded round" } },
    ),
    false,
  );

  assert.equal(
    shouldExecuteFinishPush(
      { verdict: "pass", promoteNext: true, push: true },
      { recommended: null },
    ),
    true,
  );

  assert.equal(
    shouldExecuteFinishPush(
      { verdict: "pass", promoteNext: false, push: true },
      { recommended: { title: "Ignored because concrete stop" } },
    ),
    true,
  );

  assert.equal(
    shouldExecuteFinishPush(
      { verdict: "pass", promoteNext: true, push: false },
      { recommended: null },
    ),
    false,
  );
});

check("trace-to-skill merges repeated trace packets into analyst sections and soft workflow candidates", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-trace-to-skill.mjs")).href;
  const { runAutoHermesTraceToSkill } = await import(moduleUrl);

  const fixture = makeFixture();
  const roundsDir = path.join(fixture.dir, ".ai-sync", "trace-to-skill", "rounds");
  fs.mkdirSync(roundsDir, { recursive: true });

  fs.writeFileSync(path.join(roundsDir, "round-1.json"), JSON.stringify({
    roundId: "round-1",
    task: "Fix analysis empty state",
    surface: "Analysis",
    verdict: "pass",
    review: "approve-next-round",
    problemClass: "frontend-design",
    routeShape: "pm-builder-reviewer",
    verify: "cd frontend && npm run lint && npm run build",
    runtimeProof: "source changed, live site not synced yet",
    selfCheck: { requiresFix: false },
    evidence: {
      successTags: ["design-review", "explicit-verify"],
      failureTags: [],
      edgeTags: [],
      structureTags: ["pm-builder-reviewer", "verify-before-claim"],
    },
  }, null, 2), "utf8");

  fs.writeFileSync(path.join(roundsDir, "round-2.json"), JSON.stringify({
    roundId: "round-2",
    task: "Fix races empty state",
    surface: "Races",
    verdict: "pass",
    review: "approve-next-round",
    problemClass: "frontend-design",
    routeShape: "pm-builder-reviewer",
    verify: "cd frontend && npm run lint && npm run build",
    runtimeProof: "source changed, live site not synced yet",
    selfCheck: { requiresFix: false },
    evidence: {
      successTags: ["design-review", "explicit-verify"],
      failureTags: [],
      edgeTags: [],
      structureTags: ["pm-builder-reviewer", "verify-before-claim"],
    },
  }, null, 2), "utf8");

  fs.writeFileSync(path.join(roundsDir, "round-3.json"), JSON.stringify({
    roundId: "round-3",
    task: "Fix profile shell drift",
    surface: "Profile",
    verdict: "must-fix",
    review: "must-fix-before-next-round",
    problemClass: "frontend-design",
    routeShape: "frontend-agent-reviewer-agent",
    verify: "cd frontend && npm run lint",
    runtimeProof: "",
    selfCheck: { requiresFix: true, highestSeverity: "high" },
    blocker: "self-check finding",
    evidence: {
      successTags: [],
      failureTags: ["self-check-missed", "missing-runtime-proof"],
      edgeTags: ["must-fix"],
      structureTags: ["frontend-agent-reviewer-agent"],
    },
  }, null, 2), "utf8");

  fs.writeFileSync(path.join(roundsDir, "round-4.json"), JSON.stringify({
    roundId: "round-4",
    task: "Fix schedule shell drift",
    surface: "Schedule",
    verdict: "must-fix",
    review: "must-fix-before-next-round",
    problemClass: "frontend-design",
    routeShape: "frontend-agent-reviewer-agent",
    verify: "cd frontend && npm run lint",
    runtimeProof: "",
    selfCheck: { requiresFix: true, highestSeverity: "high" },
    blocker: "self-check finding",
    evidence: {
      successTags: [],
      failureTags: ["self-check-missed", "missing-runtime-proof"],
      edgeTags: ["must-fix"],
      structureTags: ["frontend-agent-reviewer-agent"],
    },
  }, null, 2), "utf8");

  const { report } = runAutoHermesTraceToSkill({
    rootDir: fixture.dir,
    roundsDir: ".ai-sync/trace-to-skill/rounds",
    outputJson: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json",
    outputMd: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md",
  });

  assert.equal(report.totalRounds, 4);
  assert.ok(report.errorAnalyst.rules.length > 0);
  assert.ok(report.successAnalyst.rules.length > 0);
  assert.ok(report.structureAnalyst.rules.length > 0);
  assert.ok(report.edgeAnalyst.rules.length > 0);
  assert.ok(report.mergedRules.some((rule) => /self-check/i.test(rule.rule)));
  assert.ok(report.mergedRules.some((rule) => /design-review/i.test(rule.rule) || /verify/i.test(rule.rule)));
});

check("trace-to-skill packet writer persists round evidence and refreshes merged outputs", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-trace-to-skill.mjs")).href;
  const { writeTracePacketArtifacts } = await import(moduleUrl);

  const fixture = makeFixture();
  const result = writeTracePacketArtifacts({
    rootDir: fixture.dir,
    packet: {
      roundId: "trace-round-1",
      task: "Fix analysis empty state",
      surface: "Analysis",
      verdict: "pass",
      review: "approve-next-round",
      problemClass: "frontend-design",
      routeShape: "pm-builder-reviewer",
      verify: "cd frontend && npm run lint && npm run build",
      runtimeProof: "source changed, live site not synced yet",
      selfCheck: { requiresFix: false },
      evidence: {
        successTags: ["design-review"],
        failureTags: [],
        edgeTags: [],
        structureTags: ["verify-before-claim"],
      },
    },
    roundsDir: ".ai-sync/trace-to-skill/rounds",
    outputJson: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json",
    outputMd: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md",
  });

  assert.equal(fs.existsSync(result.packetPath), true);
  assert.equal(fs.existsSync(path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_TRACE_TO_SKILL.json")), true);
  assert.equal(fs.existsSync(path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_TRACE_TO_SKILL.md")), true);
});

check("trace-to-skill emits an evolved skill package from repeated evidence-backed rules", async () => {
  const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-trace-to-skill.mjs")).href;
  const { writeTracePacketArtifacts } = await import(moduleUrl);

  const fixture = makeFixture();
  const result = writeTracePacketArtifacts({
    rootDir: fixture.dir,
    packet: {
      roundId: "trace-round-1",
      task: "Fix analysis empty state",
      surface: "Analysis",
      verdict: "pass",
      review: "approve-next-round",
      problemClass: "frontend-design",
      routeShape: "pm-builder-reviewer",
      verify: "cd frontend && npm run lint && npm run build",
      runtimeProof: "source changed, live site not synced yet",
      selfCheck: { requiresFix: false },
      evidence: {
        successTags: ["design-review", "explicit-verify"],
        failureTags: [],
        edgeTags: [],
        structureTags: ["pm-builder-reviewer", "verify-before-claim"],
      },
    },
    roundsDir: ".ai-sync/trace-to-skill/rounds",
    outputJson: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json",
    outputMd: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md",
  });

  const secondResult = writeTracePacketArtifacts({
    rootDir: fixture.dir,
    packet: {
      roundId: "trace-round-2",
      task: "Fix races empty state",
      surface: "Races",
      verdict: "pass",
      review: "approve-next-round",
      problemClass: "frontend-design",
      routeShape: "pm-builder-reviewer",
      verify: "cd frontend && npm run lint && npm run build",
      runtimeProof: "source changed, live site not synced yet",
      selfCheck: { requiresFix: false },
      evidence: {
        successTags: ["design-review", "explicit-verify"],
        failureTags: [],
        edgeTags: [],
        structureTags: ["pm-builder-reviewer", "verify-before-claim"],
      },
    },
    roundsDir: ".ai-sync/trace-to-skill/rounds",
    outputJson: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json",
    outputMd: ".ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md",
  });

  assert.equal(fs.existsSync(path.join(fixture.dir, ".codex", "skills", "auto-hermes-evolved", "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(fixture.dir, ".codex", "skills", "auto-hermes-evolved", "references", "edge-cases.md")), true);
  assert.equal(secondResult.report.evolvedSkill.slug, "auto-hermes-evolved");
  assert.equal(secondResult.report.evolvedSkill.mode, "repo-local-auto");
  assert.ok(secondResult.report.evolvedSkill.coreRules.length > 0);
  assert.ok(secondResult.report.evolvedSkill.patterns.length > 0);
});

check("controller surfaces soft trace-to-skill evidence when merged workflow signals exist", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Auto-suggested from codebase analysis (missing_empty_state)
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\``);

  const tracePath = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_TRACE_TO_SKILL.json");
  fs.mkdirSync(path.dirname(tracePath), { recursive: true });
  fs.writeFileSync(tracePath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalRounds: 4,
    mergedRules: [
      {
        rule: "Before approving a frontend design round, run the self-check and treat repeated findings as must-fix.",
        evidenceCount: 2,
        supportingRounds: ["round-3", "round-4"],
        status: "soft-signal",
      },
      {
        rule: "Prefer pm-builder-reviewer with explicit verify output on frontend design rounds.",
        evidenceCount: 2,
        supportingRounds: ["round-1", "round-2"],
        status: "soft-signal",
      },
    ],
    evolvedSkill: {
      mode: "repo-local-auto",
      slug: "auto-hermes-evolved",
      path: ".codex/skills/auto-hermes-evolved/SKILL.md",
      summary: "Auto-synthesized from 4 trace-backed auto-hermes rounds.",
      coreRules: [
        {
          rule: "Prefer pm-builder-reviewer with explicit verify output on frontend design rounds.",
          evidenceCount: 2,
          supportingRounds: ["round-1", "round-2"],
        },
      ],
      guidanceRules: [
        {
          rule: "Before approving a frontend design round, run the self-check and treat repeated findings as must-fix.",
          evidenceCount: 2,
          supportingRounds: ["round-3", "round-4"],
        },
      ],
      edgeRules: [],
      patterns: [
        "Prefer pm-builder-reviewer when frontend-design evidence is strong.",
      ],
      failureModes: [
        "If self-check findings repeat, treat the round as must-fix before promotion.",
      ],
    },
    summary: "2 evidence-backed workflow candidates available as a soft signal.",
  }, null, 2), "utf8");

  const { result } = runAutoHermesController({
    json: true,
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    traceToSkillJson: tracePath,
    outputJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
  });

  assert.equal(result.traceToSkill.mode, "soft-signal");
  assert.match(result.traceToSkill.summary, /evidence-backed/i);
  assert.equal(result.traceToSkill.candidates.length, 2);
  assert.equal(result.traceToSkill.evolvedSkill.slug, "auto-hermes-evolved");
  assert.match(result.traceToSkill.evolvedSkill.summary, /auto-synthesized/i);
});

check("loop dry-run injects the evolved trace skill into worker and coordinator briefs as advisory guidance", () => {
  const fixture = makeControllerFixture(`- [ ] Analysis page has no visible empty state - runners with no data see a blank screen
  Files: \`frontend/src/pages/Analysis.jsx\`
  Problem: frontend-design
  Owner: frontend-agent
  Context: The evolved trace skill should appear in the bounded worker brief as advisory execution guidance
  Done when: the issue described above is resolved and verified
  Verify: \`cd frontend && npm run lint && npm run build\``);

  const tracePath = path.join(fixture.dir, ".ai-sync", "AUTO_HERMES_TRACE_TO_SKILL.json");
  fs.mkdirSync(path.dirname(tracePath), { recursive: true });
  fs.writeFileSync(tracePath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalRounds: 4,
    mergedRules: [
      {
        rule: "Prefer pm-builder-reviewer with explicit verify output on frontend design rounds.",
        evidenceCount: 2,
        supportingRounds: ["round-1", "round-2"],
        status: "soft-signal",
      },
    ],
    evolvedSkill: {
      mode: "repo-local-auto",
      slug: "auto-hermes-evolved",
      path: ".codex/skills/auto-hermes-evolved/SKILL.md",
      summary: "Auto-synthesized from 4 trace-backed auto-hermes rounds.",
      coreRules: [
        {
          rule: "Prefer pm-builder-reviewer with explicit verify output on frontend design rounds.",
          evidenceCount: 2,
          supportingRounds: ["round-1", "round-2"],
        },
      ],
      guidanceRules: [],
      edgeRules: [],
      patterns: [
        "Prefer pm-builder-reviewer when frontend-design evidence is strong.",
      ],
      failureModes: [
        "If verification is missing, do not claim the frontend round live.",
      ],
    },
    summary: "1 evidence-backed workflow candidate available as a soft signal.",
  }, null, 2), "utf8");

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
    traceToSkillJson: tracePath,
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
  assert.match(prompt, /Evolved Trace Skill/i);
  assert.match(prompt, /auto-hermes-evolved/i);
  assert.match(prompt, /advisory only/i);

  const coordinator = fs.readFileSync(path.join(fixture.dir, ".ai-sync", "coordinator.md"), "utf8");
  assert.match(coordinator, /Evolved Trace Skill/i);
  assert.match(coordinator, /auto-hermes-evolved/i);
});

check("runtime adapter surfaces all point at the shared trace-to-skill artifacts with soft-signal semantics", () => {
  const runtimeFiles = [
    ".claude/commands/auto-hermes.md",
    ".claude/commands/auto-hermes-max.md",
    ".claude/agents/antigravity.md",
    ".claude/agents/gemini-auto-hermes.md",
    ".opencode/commands/auto-hermes.md",
    ".opencode/commands/auto-hermes-max.md",
  ];

  for (const relPath of runtimeFiles) {
    const content = fs.readFileSync(path.resolve(relPath), "utf8");
    assert.match(content, /AUTO_HERMES_TRACE_TO_SKILL\.(json|md)/i, `${relPath} should reference the shared trace-to-skill artifact`);
    assert.match(content, /soft-signal/i, `${relPath} should describe the trace signal as advisory`);
  }
});

check("gemini and opencode runtime docs describe website-audit fallback and supervisor continuity semantics", () => {
  const runtimeFiles = [
    ".claude/agents/gemini-auto-hermes.md",
    ".opencode/commands/auto-hermes.md",
    ".opencode/commands/auto-hermes-max.md",
  ];

  for (const relPath of runtimeFiles) {
    const content = fs.readFileSync(path.resolve(relPath), "utf8");
    assert.match(content, /website-audit/i, `${relPath} should mention website-audit fallback`);
    assert.match(content, /empty queue does not immediately stop|## Active Tasks[` ]being empty is NOT a stop condition/i, `${relPath} should describe non-immediate exhaustion`);
    assert.match(content, /repeated no-candidate audit rounds|website-audit explorer is the first exhaustion fallback/i, `${relPath} should describe repeated audit exhaustion semantics`);
  }

  const opencodeMax = fs.readFileSync(path.resolve(".opencode/commands/auto-hermes-max.md"), "utf8");
  assert.match(opencodeMax, /supervisor is the preferred continuity layer for long-running runs/i);
  assert.match(opencodeMax, /fully routed through the supervisor|supervisor now owns live continuity/i);

  const gemini = fs.readFileSync(path.resolve(".claude/agents/gemini-auto-hermes.md"), "utf8");
  assert.match(gemini, /supervisor is the preferred continuity layer for long-running runs/i);
});

check("codex owner docs describe supervisor continuity and exhaustion semantics", () => {
  const requiredFiles = [
    ".codex/workflows/auto-hermes-architecture.md",
    ".codex/commands/auto-hermes.md",
    ".codex/commands/auto-hermes-max.md",
    "HERMES_SELF_EVOLVING_ENGINE.md",
  ];

  for (const relPath of requiredFiles) {
    const content = fs.readFileSync(path.resolve(relPath), "utf8");
    assert.match(content, /empty queue does not immediately stop/i, `${relPath} should preserve the non-stop empty queue rule`);
    assert.match(content, /website-audit explorer is the first exhaustion fallback/i, `${relPath} should document website-audit as the first fallback`);
    assert.match(content, /repeated no-candidate audit rounds are the true stop condition/i, `${relPath} should document the true stop condition`);
    assert.match(content, /supervisor is the preferred continuity layer for long-running runs/i, `${relPath} should document the supervisor continuity preference`);
  }

  const maxCommand = fs.readFileSync(path.resolve(".codex/commands/auto-hermes-max.md"), "utf8");
  assert.match(maxCommand, /supervisor now owns live continuity|fully routed through the supervisor/i, "auto-hermes-max should describe the supervisor as the live continuity owner");

  const architecture = fs.readFileSync(path.resolve(".codex/workflows/auto-hermes-architecture.md"), "utf8");
  assert.match(architecture, /active continuity owner|fully routed through the supervisor/i, "architecture doc should describe the live supervisor routing");
});

check("opencode self command routes through the Ralph self-loop owner", () => {
  const opencodeSelf = fs.readFileSync(path.resolve(".opencode/commands/auto-hermes-self.md"), "utf8");
  const opencodePlugin = fs.readFileSync(path.resolve(".opencode/hermes-plugin.ts"), "utf8");

  assert.match(opencodeSelf, /\.tools\/auto-hermes-self-loop\.mjs|\.tools\\auto-hermes-self-loop\.mjs/i);
  assert.match(opencodeSelf, /--runtime opencode/i);
  assert.match(opencodeSelf, /same-work-unit no-progress limit/i);
  assert.match(opencodeSelf, /executor retries/i);
  assert.match(opencodeSelf, /architect approval/i);
  assert.match(opencodeSelf, /deslop/i);
  assert.match(opencodeSelf, /round-close writeback/i);
  assert.doesNotMatch(opencodeSelf, /prompt-level continuation is the available path/i);

  assert.match(opencodePlugin, /auto-hermes-self-loop\.mjs/i);
  assert.match(opencodePlugin, /--runtime["'],\s*["']opencode/i);
  assert.match(opencodePlugin, /--write/i);
});

check("runtime docs describe the push-only Docker gate for main-repository submission", () => {
  const runtimeFiles = [
    ".claude/commands/auto-hermes.md",
    ".claude/agents/antigravity.md",
    ".opencode/commands/auto-hermes.md",
    ".opencode/commands/auto-hermes-max.md",
    ".claude/agents/gemini-auto-hermes.md",
  ];

  for (const relPath of runtimeFiles) {
    const content = fs.readFileSync(path.resolve(relPath), "utf8");
    assert.match(content, /auto-hermes-docker-gate\.mjs/i, `${relPath} should mention the Docker gate helper`);
    assert.match(content, /submit to main repository|main-repository submission/i, `${relPath} should describe the main-repository publish gate`);
    assert.match(content, /does not block normal local auto-commit|blocks publish paths only/i, `${relPath} should preserve local commit behavior`);
  }
});
