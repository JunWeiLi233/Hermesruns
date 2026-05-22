# Hermes Continuous Website Audit Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/auto-hermes` and `/auto-hermes-max` keep going after the queue exhausts by auditing the website, promoting exactly one bounded add/improve/revise/fix/test task, and only stopping after repeated true exhaustion.

**Architecture:** Add a durable run-state helper and a website-audit helper under `.tools/`, then teach the existing controller/loop/max helpers to use those helpers before returning `stop-exhausted`. Keep proof gates, TASKS.md ownership, and trace packet writeback in place; add a supervisor last so continuity can survive restarts.

**Tech Stack:** Node `.mjs` helpers in `.tools/`, existing `.ai-sync` artifacts, `.tools/auto-hermes-tools.test.mjs`, existing runtime-proof helpers, existing queue/controller/loop helpers

---

### Task 1: Add Red Tests For Run State And Website Audit Helpers

**Files:**
- Modify: `.tools/auto-hermes-tools.test.mjs`
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Write the failing run-state test**

Add this test near the other `.tools` helper tests:

```js
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
```

- [ ] **Step 2: Write the failing website-audit test**

Add this test:

```js
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
  assert.match(report.candidate.title, /add|improve|revise|fix|test/i);
  assert.ok(report.candidate.verify.length > 0);
});
```

- [ ] **Step 3: Run the test file and verify RED**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`

Expected: FAIL because `.tools/auto-hermes-run-state.mjs` and `.tools/auto-hermes-website-audit.mjs` do not exist yet.

### Task 2: Implement Durable Run State

**Files:**
- Create: `.tools/auto-hermes-run-state.mjs`
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Create the helper with stable exported functions**

Create `.tools/auto-hermes-run-state.mjs` with this baseline structure:

```js
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_RUNS_DIR = ".ai-sync/auto-hermes-runs";

function nowIso() {
  return new Date().toISOString();
}

function makeRunId() {
  return `ahr-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function resolveWithin(rootDir, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function getRunPaths({ rootDir, runId, runsDir = DEFAULT_RUNS_DIR }) {
  const runDir = resolveWithin(rootDir, path.join(runsDir, runId));
  return {
    runDir,
    statePath: path.join(runDir, "state.json"),
    memoryPath: path.join(runDir, "memory.md"),
    roundsDir: path.join(runDir, "rounds"),
    auditsDir: path.join(runDir, "website-audits"),
  };
}

export function createAutoHermesRun({ rootDir, mode, goal, runsDir = DEFAULT_RUNS_DIR }) {
  const runId = makeRunId();
  const paths = getRunPaths({ rootDir, runId, runsDir });
  fs.mkdirSync(paths.roundsDir, { recursive: true });
  fs.mkdirSync(paths.auditsDir, { recursive: true });
  const state = {
    runId,
    mode,
    goal,
    status: "running",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    currentRoundId: "",
    websiteAudit: {
      emptyAuditCount: 0,
      lastAuditAt: "",
      lastAuditSummary: "",
      lastCandidateTitle: "",
    },
  };
  ensureParent(paths.statePath);
  fs.writeFileSync(paths.statePath, JSON.stringify(state, null, 2), "utf8");
  return { runId, paths, state };
}

export function loadAutoHermesRun({ rootDir, runId, runsDir = DEFAULT_RUNS_DIR }) {
  const paths = getRunPaths({ rootDir, runId, runsDir });
  return JSON.parse(fs.readFileSync(paths.statePath, "utf8"));
}

export function writeAutoHermesRunState({ rootDir, runId, state, runsDir = DEFAULT_RUNS_DIR }) {
  const paths = getRunPaths({ rootDir, runId, runsDir });
  const nextState = { ...state, updatedAt: nowIso() };
  ensureParent(paths.statePath);
  fs.writeFileSync(paths.statePath, JSON.stringify(nextState, null, 2), "utf8");
  return nextState;
}

export function recordWebsiteAuditAttempt({ rootDir, runId, foundCandidate, auditSummary, candidateTitle = "", runsDir = DEFAULT_RUNS_DIR }) {
  const state = loadAutoHermesRun({ rootDir, runId, runsDir });
  const nextCount = foundCandidate ? 0 : (state.websiteAudit?.emptyAuditCount || 0) + 1;
  return writeAutoHermesRunState({
    rootDir,
    runId,
    runsDir,
    state: {
      ...state,
      websiteAudit: {
        emptyAuditCount: nextCount,
        lastAuditAt: nowIso(),
        lastAuditSummary: auditSummary,
        lastCandidateTitle: candidateTitle,
      },
    },
  });
}
```

- [ ] **Step 2: Re-run the test file and verify partial GREEN**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`

Expected: the run-state test passes; website-audit and max fallback tests still fail.

### Task 3: Implement Website Audit Helper

**Files:**
- Create: `.tools/auto-hermes-website-audit.mjs`
- Modify: `.tools/suggest-tasks.mjs` (only if a small helper extraction is needed)
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Implement a one-candidate audit helper**

Create `.tools/auto-hermes-website-audit.mjs` with this baseline:

```js
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { collectSuggestedTasks } from "./suggest-tasks.mjs";

function nowIso() {
  return new Date().toISOString();
}

function resolveWithin(rootDir, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
}

function readOptional(rootDir, relPath) {
  const fullPath = resolveWithin(rootDir, relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function classifyCandidate(rawTask) {
  const desc = String(rawTask?.desc || "");
  let action = "improve";
  if (/\bfix|broken|error|regress/i.test(desc)) action = "fix";
  else if (/\btest|coverage|contract/i.test(desc)) action = "test";
  else if (/\badd|new\b/i.test(desc)) action = "add";
  else if (/\brevise|redesign|rework/i.test(desc)) action = "revise";

  return {
    title: `${action}: ${desc}`,
    action,
    files: Array.isArray(rawTask?.files) ? rawTask.files : [],
    context: `Website audit selected this bounded candidate from live repo signals (${rawTask?.type || "unknown"}).`,
    doneWhen: "the selected website issue is resolved and verified in one bounded round",
    verify: rawTask?.problemClass === "backend-logic"
      ? "cd backend && ./mvnw -q -DskipTests compile"
      : "cd frontend && npm run lint && npm run build",
  };
}

export function runAutoHermesWebsiteAudit({
  rootDir,
  tasks = "TASKS.md",
  product = "PRODUCT.md",
  contextLedger = ".ai-sync/CONTEXT_LEDGER.md",
  pagesIndex = ".ai-codex/pages.md",
  outputJson = ".ai-sync/AUTO_HERMES_WEBSITE_AUDIT.json",
  outputMd = ".ai-sync/AUTO_HERMES_WEBSITE_AUDIT.md",
  write = false,
} = {}) {
  const suggested = collectSuggestedTasks({ max: 5 });
  const best = suggested.rawTasks?.[0] || null;
  const candidate = best ? classifyCandidate(best) : null;
  const report = {
    generatedAt: nowIso(),
    mode: "website-audit",
    inputs: {
      tasks,
      product,
      contextLedger,
      pagesIndex,
    },
    candidate,
    summary: candidate
      ? `Promote one bounded ${candidate.action} candidate: ${candidate.title}`
      : "No acceptable website-audit candidate found.",
  };

  if (write) {
    fs.writeFileSync(resolveWithin(rootDir, outputJson), JSON.stringify(report, null, 2), "utf8");
    fs.writeFileSync(resolveWithin(rootDir, outputMd), `# Auto-Hermes Website Audit\n\n${report.summary}\n`, "utf8");
  }

  return { report };
}
```

- [ ] **Step 2: Re-run the test file and verify partial GREEN**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`

Expected: website-audit test passes; `/auto-hermes-max` fallback test still fails.

### Task 4: Integrate `/auto-hermes-max` Empty-Queue Bootstrap

**Files:**
- Modify: `.tools/auto-hermes-max.mjs`
- Modify: `.tools/auto-hermes-max-loop.mjs`
- Modify: `.tools/auto-hermes-tools.test.mjs`
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Write the failing `/auto-hermes-max` audited-fallback integration test**

Add this test:

```js
check("auto-hermes-max audits the website before stop-exhausted on an empty queue", async () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.files.tasks, `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`, "utf8");
  writeFixtureFile(fixture.dir, "PRODUCT.md", "# Product\n\n## Screen table\n- Analysis: trust and insight\n");
  writeFixtureFile(fixture.dir, ".ai-codex/pages.md", "Analysis -> frontend/src/pages/Analysis.jsx\n");
  writeFixtureFile(fixture.dir, "frontend/src/pages/Analysis.jsx", "export default function Analysis(){ return null; }\n");
  writeFixtureFile(fixture.dir, "frontend/src/styles/style.css", ".analysis-shell{}\n");

  const { state } = runAutoHermesMax({
    json: true,
    write: true,
    runtime: "codex-live",
    tasks: fixture.files.tasks,
    humanLoop: fixture.files.humanLoop,
    agentSync: fixture.files.agentSync,
    contextLedger: fixture.files.contextLedger,
    loopState: fixture.files.loopState,
    liveControllerJson: path.join(fixture.dir, ".ai-sync", "controller.json"),
    liveControllerMd: path.join(fixture.dir, ".ai-sync", "controller.md"),
    outputJson: path.join(fixture.dir, ".ai-sync", "max.json"),
    outputMd: path.join(fixture.dir, ".ai-sync", "max.md"),
    coordinatorJson: path.join(fixture.dir, ".ai-sync", "max-coordinator.json"),
    coordinatorMd: path.join(fixture.dir, ".ai-sync", "max-coordinator.md"),
  });

  assert.equal(state.websiteAudit?.mode, "website-audit");
  assert.equal(state.websiteAudit?.candidate?.files?.includes("frontend/src/pages/Analysis.jsx"), true);
  assert.equal(state.status, "ready-to-launch");
});
```

- [ ] **Step 2: Run the test file and verify RED**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`

Expected: FAIL because `/auto-hermes-max` still stops before audited-fallback state is attached.

- [ ] **Step 3: Add website-audit fallback to the stop path**

At the top of `.tools/auto-hermes-max.mjs`, import the new helpers:

```js
import { createAutoHermesRun, recordWebsiteAuditAttempt } from "./auto-hermes-run-state.mjs";
import { runAutoHermesWebsiteAudit } from "./auto-hermes-website-audit.mjs";
```

Then replace the immediate stop branch in `runAutoHermesMax(...)` with this shape:

```js
  if (controllerResult?.loopDecision !== "continue-self-loop") {
    const websiteAudit = runAutoHermesWebsiteAudit({
      rootDir: ROOT,
      tasks: args.tasks,
      product: "PRODUCT.md",
      contextLedger: args.contextLedger,
      pagesIndex: ".ai-codex/pages.md",
      write: args.write,
    }).report;

    if (websiteAudit?.candidate) {
      const run = createAutoHermesRun({
        rootDir: ROOT,
        mode: "auto-hermes-max",
        goal: websiteAudit.candidate.title,
      });
      recordWebsiteAuditAttempt({
        rootDir: ROOT,
        runId: run.runId,
        foundCandidate: true,
        auditSummary: websiteAudit.summary,
        candidateTitle: websiteAudit.candidate.title,
      });

      const syntheticPlan = {
        parentGoal: websiteAudit.candidate.title,
        preserve: [],
        laneSelection: { strategy: "auto", minLaneCount: 1, maxLaneCount: 5 },
        lanes: [
          {
            laneId: "lane-1",
            goal: websiteAudit.candidate.title,
            ownedFiles: websiteAudit.candidate.files,
            verify: websiteAudit.candidate.verify,
            effort: websiteAudit.candidate.files.length > 2 ? "medium" : "small",
          },
        ],
      };

      // Continue through the normal planner path using syntheticPlan.
    }
```

- [ ] **Step 4: Surface audit metadata in coordinator state**

When the audit path is used, ensure the returned state includes:

```js
    websiteAudit: {
      mode: "website-audit",
      summary: websiteAudit.summary,
      candidate: websiteAudit.candidate,
    },
```

and set:

```js
    status: "ready-to-launch",
    nextAction: `${args.runtime}-launch-single-lane`,
    mustNotReplyYet: true,
```

- [ ] **Step 5: Teach the max loop to treat audit-generated work as normal**

In `.tools/auto-hermes-max-loop.mjs`, keep the current planner contract, but add one new expectation to the worker brief:

```txt
- If the planner state includes websiteAudit.candidate, treat it as the authoritative first parent goal for this iteration.
```

- [ ] **Step 6: Run the test file and verify GREEN for max bootstrap**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`

Expected: the `/auto-hermes-max` empty-queue fallback test passes.

### Task 5: Integrate Standard `/auto-hermes` Exhaustion Logic

**Files:**
- Modify: `.tools/auto-hermes-controller.mjs`
- Modify: `.tools/auto-hermes-loop.mjs`
- Modify: `.tools/auto-hermes-round-close.mjs`
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Add controller audit fallback**

In `.tools/auto-hermes-controller.mjs`, when `chooseWorkUnit(...)` returns a stop with no title, add:

```js
  const auditReport = runAutoHermesWebsiteAudit({
    rootDir: workspaceRoot,
    tasks: args.tasks,
    product: "PRODUCT.md",
    contextLedger: args.contextLedger,
    pagesIndex: ".ai-codex/pages.md",
    write: args.write,
  }).report;

  if (auditReport?.candidate) {
    result = {
      stop: false,
      source: "website-audit",
      title: auditReport.candidate.title,
      surface: auditReport.candidate.files[0]?.includes("backend/") ? "Backend" : "Website Audit",
      files: auditReport.candidate.files,
      context: auditReport.candidate.context,
      doneWhen: auditReport.candidate.doneWhen,
      verify: auditReport.candidate.verify,
      websiteAudit: auditReport,
      classification: classifyRound({
        title: auditReport.candidate.title,
        helpers: [
          `Files: ${auditReport.candidate.files.join(", ")}`,
          `Context: ${auditReport.candidate.context}`,
          `Done when: ${auditReport.candidate.doneWhen}`,
          `Verify: ${auditReport.candidate.verify}`,
        ],
      }, "Website Audit", config),
    };
  }
```

- [ ] **Step 2: Persist website-audit outcomes from round-close**

In `.tools/auto-hermes-round-close.mjs`, after `writeTracePacketArtifacts(...)`, add run-state updates using the existing `inferWorkspaceRoot(args)`:

```js
    try {
      const run = createAutoHermesRun({
        rootDir: workspaceRoot,
        mode: "auto-hermes",
        goal: args.task || args.surface || "auto-hermes round",
      });
      recordWebsiteAuditAttempt({
        rootDir: workspaceRoot,
        runId: run.runId,
        foundCandidate: true,
        auditSummary: `Completed round: ${args.task || "unknown task"}`,
        candidateTitle: args.task || "",
      });
    } catch {
      // Run-state writeback is advisory and must not block round-close.
    }
```

- [ ] **Step 3: Keep the main loop alive until repeated audit exhaustion**

In `.tools/auto-hermes-loop.mjs`, update the stop branch after `runController(args)` so that the final stop reason prefers:

```js
      state.stopReason = controllerResult.reason || "controller reported repeated website-audit exhaustion";
```

and only stops after the controller says the exhaustion threshold was reached, not merely because the queue was empty once.

- [ ] **Step 4: Run the test file and verify no regressions**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`

Expected: all helper tests pass.

### Task 6: Add Supervisor And Owner Docs

**Files:**
- Create: `.tools/auto-hermes-supervisor.mjs`
- Modify: `HERMES_SELF_EVOLVING_ENGINE.md`
- Modify: `.codex/workflows/auto-hermes-architecture.md`
- Modify: `.codex/commands/auto-hermes.md`
- Modify: `.codex/commands/auto-hermes-max.md`

- [ ] **Step 1: Create the supervisor skeleton**

Create `.tools/auto-hermes-supervisor.mjs`:

```js
#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const MAX_RESTARTS = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let restarts = 0;
  while (restarts < MAX_RESTARTS) {
    const result = spawnSync("C:\\Program Files\\nodejs\\node.exe", [".tools/auto-hermes-max-loop.mjs", "--write"], {
      stdio: "inherit",
      shell: false,
    });

    if (result.status === 0) break;
    restarts += 1;
    await sleep(Math.min(30000, restarts * 5000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Update owner docs**

Add explicit statements to the owning docs:
- empty queue does not immediately stop
- website-audit explorer is the first exhaustion fallback
- repeated no-candidate audit rounds are the true stop condition
- supervisor is the preferred continuity layer for long-running runs

- [ ] **Step 3: Run final verification**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add .tools/auto-hermes-run-state.mjs .tools/auto-hermes-website-audit.mjs .tools/auto-hermes-max.mjs .tools/auto-hermes-max-loop.mjs .tools/auto-hermes-controller.mjs .tools/auto-hermes-loop.mjs .tools/auto-hermes-round-close.mjs .tools/auto-hermes-supervisor.mjs .tools/auto-hermes-tools.test.mjs HERMES_SELF_EVOLVING_ENGINE.md .codex/workflows/auto-hermes-architecture.md .codex/commands/auto-hermes.md .codex/commands/auto-hermes-max.md
git commit -m "Add continuous website-audit fallback for auto-hermes"
```
