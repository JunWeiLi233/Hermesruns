# Self-Evolving Auto-Hermes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform auto-hermes into a fully autonomous, self-evolving system that never crashes without recovery, measures its own performance, tunes its own parameters, and discovers problems without human intervention.

**Architecture:** Four-layer progressive build (Resilience 鈫?Self-Observation 鈫?Self-Tuning 鈫?Self-Discovery). Each layer makes the next one safe. Layer 1 (Resilience) is the foundation 鈥?persistent loop state, crash recovery, health checks, auto-rollback, and autonomous-first HUMAN_LOOP. Layer 2 adds measurement (telemetry, scorecards, observations). Layer 3 adds adaptation (configurable gates, evolution engine, adaptive routing). Layer 4 adds discovery (dynamic problem finding, semantic gaps, self-healing).

**Tech Stack:** Node.js (mjs scripts), JSON state files, Markdown state files, Git CLI for rollback, existing auto-hermes toolchain (controller, loop, round-close, suggest-tasks)

---

## File Structure

### New Files

| File | Layer | Responsibility |
|------|-------|----------------|
| `.ai-sync/AUTO_HERMES_LOOP_STATE.json` | 1 | Persistent loop state for crash recovery and resume |
| `.tools/auto-hermes-health-check.mjs` | 1 | State file validation, schema checks, auto-repair |
| `.tools/auto-hermes-rollback.mjs` | 1 | Safe automated rollback for bad rounds |
| `.tools/auto-hermes-human-loop.json` | 1 | Autonomous-first human gate config |
| `.ai-sync/AUTO_HERMES_TELEMETRY.json` | 2 | Per-round measurements and moving averages |
| `.tools/auto-hermes-config.json` | 3 | All tunable parameters in one place |
| `.tools/auto-hermes-config-history.json` | 3 | Rollback safety for config changes |
| `.tools/auto-hermes-evolve.mjs` | 3 | Adaptation kernel: observe 鈫?diagnose 鈫?propose 鈫?apply 鈫?verify |
| `.ai-sync/AUTO_HERMES_ROUTING_STATS.json` | 3 | Per-shape success rates for adaptive routing |
| `.tools/auto-hermes-discover.mjs` | 4 | Dynamic problem discovery from 6 sources |
| `.tools/auto-hermes-health-monitor.mjs` | 4 | Continuous health monitoring dashboard |

### Modified Files

| File | Layer | Changes |
|------|-------|---------|
| `.tools/auto-hermes-loop.mjs` | 1,2,3 | Persistent state read/write, crash recovery, executor retry, health check integration, telemetry read |
| `.tools/auto-hermes-controller.mjs` | 1,3 | Read human-loop JSON first (fallback to MD), read config instead of hardcoded values, routing from config |
| `.tools/auto-hermes-round-close.mjs` | 1,2,3 | Write observations to audit, numeric scorecards, telemetry append, trigger evolve, rollback integration |
| `.tools/suggest-tasks.mjs` | 2,4 | Dynamic screen discovery, integrate test/lint/git sources |
| `HERMES_SELF_EVOLVING_ENGINE.md` | 3 | Reference config file instead of hardcoded rules, document evolution engine |
| `AGENTS.md` | 1 | Update human gate references, document autonomous-first mode |
| `.codex/workflows/auto-hermes-architecture.md` | 1 | Document resilience layer, persistent state, crash recovery |

---

## Layer 1: Resilience

### Task 1.1: Create persistent loop state schema and read/write utilities

**Files:**
- Create: `.tools/auto-hermes-loop-state.json`
- Modify: `.tools/auto-hermes-loop.mjs`

- [ ] **Step 1: Write the initial loop state schema**

Create `.tools/auto-hermes-loop-state.json` with default values:

```json
{
  "loopId": "",
  "currentRound": 0,
  "maxRounds": 24,
  "status": "idle",
  "currentTask": "",
  "roundHistory": [],
  "stallCounter": 0,
  "runawayCounter": 0,
  "sameWorkUnitStreak": 0,
  "lastWorkUnitSignature": null,
  "lastCheckpoint": "",
  "resumable": true,
  "preRoundCommit": "",
  "evolveCycleCount": 0,
  "lastEvolveRound": 0
}
```

- [ ] **Step 2: Add persistent state read/write functions to auto-hermes-loop.mjs**

In `.tools/auto-hermes-loop.mjs`, add these functions after the existing `readOptional` function:

```js
function loadLoopState(args) {
  const statePath = resolveFromRoot(args.loopStateJson || '.ai-sync/AUTO_HERMES_LOOP_STATE.json');
  const fallback = {
    loopId: '',
    currentRound: 0,
    maxRounds: parseInt(args.maxRounds, 10) || 24,
    status: 'idle',
    currentTask: '',
    roundHistory: [],
    stallCounter: 0,
    runawayCounter: 0,
    sameWorkUnitStreak: 0,
    lastWorkUnitSignature: null,
    lastCheckpoint: '',
    resumable: true,
    preRoundCommit: '',
    evolveCycleCount: 0,
    lastEvolveRound: 0,
  };
  return loadJsonFile(statePath, fallback);
}

function writeLoopState(args, state) {
  const statePath = resolveFromRoot(args.loopStateJson || '.ai-sync/AUTO_HERMES_LOOP_STATE.json');
  state.lastCheckpoint = new Date().toISOString();
  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}
```

Add to `parseArgs` defaults:
```js
loopStateJson: '.ai-sync/AUTO_HERMES_LOOP_STATE.json',
```

- [ ] **Step 3: Integrate loop state into the main loop function**

In `runAutoHermesLoop`, add at the start of the function, after `parseArgs`:

```js
const persistedState = loadLoopState(args);
if (persistedState.status === 'executing' && persistedState.resumable) {
  state.currentRound = persistedState.currentRound;
  state.roundsCompleted = persistedState.roundHistory?.length || 0;
  state.history = persistedState.roundHistory || [];
}
```

And at the end of each round iteration, before the loop condition check:

```js
persistedState.currentRound = state.currentRound;
persistedState.status = state.status;
persistedState.roundHistory = state.history;
persistedState.stallCounter = state.sameWorkUnitStreak || 0;
persistedState.lastWorkUnitSignature = lastWorkUnitSignature;
persistedState.preRoundCommit = getCurrentGitHead();
writeLoopState(args, persistedState);
```

- [ ] **Step 4: Add git HEAD capture helper**

```js
function getCurrentGitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return '';
  }
}
```

Call this at the start of each round to set `persistedState.preRoundCommit`.

- [ ] **Step 5: Test that loop state persists across invocations**

Run:
```bash
cd .tools && node auto-hermes-loop.mjs --dry-run --max-rounds 1
```

Expected: `.ai-sync/AUTO_HERMES_LOOP_STATE.json` is created with `status: "idle"` or status reflecting the dry-run result. Run a second time and verify `currentRound` and `roundHistory` persist from the first run.

- [ ] **Step 6: Commit**

```bash
git add .tools/auto-hermes-loop-state.json .tools/auto-hermes-loop.mjs
git commit -m "feat(auto-hermes): add persistent loop state for crash recovery"
```

---

### Task 1.2: Add executor crash recovery with retry logic

**Files:**
- Modify: `.tools/auto-hermes-loop.mjs`

- [ ] **Step 1: Add retry configuration to parseArgs defaults**

In `parseArgs`, add:

```js
maxExecutorRetries: '3',
executorRetryBackoff: '0,30000,120000',
```

- [ ] **Step 2: Add executor retry with exponential backoff in runExecutor**

Locate the `runExecutor` function. Wrap the executor call in a retry loop:

```js
function runExecutorWithRetry(executor, controllerResult, promptPath, roundIndex, args) {
  const maxRetries = parseInt(args.maxExecutorRetries, 10) || 3;
  const backoffMs = (args.executorRetryBackoff || '0,30000,120000').split(',').map(Number);
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = runExecutor(executor, controllerResult, promptPath, roundIndex, args);
      return { success: true, result, attempt };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = backoffMs[attempt] || backoffMs[backoffMs.length - 1] || 30000;
        if (args.dryRun !== true && args.dryRun !== 'true') {
          execFileSync('node', ['-e', `setTimeout(() => {}, ${delay})`], { timeout: delay + 5000 });
        }
      }
    }
  }

  return { success: false, error: lastError, attempts: maxRetries };
}
```

- [ ] **Step 3: Handle retry failure gracefully in the main loop**

In the main loop iteration, replace direct `runExecutor` calls with `runExecutorWithRetry`. On failure:

```js
if (!execResult.success) {
  persistedState.status = 'executor-unavailable';
  writeLoopState(args, persistedState);
  state.status = 'executor-unavailable';
  state.stopReason = `executor failed after ${execResult.attempts} attempts: ${execResult.error?.message || 'unknown error'}`;
  // Do NOT terminate. Continue to next promotable task.
  // The failed task will be re-promoted in the next promotion cycle.
  continue;
}
```

- [ ] **Step 4: Test executor retry on simulated failure**

Run with an intentionally bad executor:
```bash
cd .tools && node auto-hermes-loop.mjs --dry-run --max-rounds 1 --executor-command "exit 1"
```

Expected: Loop state shows `status: "executor-unavailable"`, not a crash. Loop attempts re-promotion of the next task.

- [ ] **Step 5: Commit**

```bash
git add .tools/auto-hermes-loop.mjs
git commit -m "feat(auto-hermes): add executor crash recovery with retry and graceful degradation"
```

---

### Task 1.3: Create state file health check utility

**Files:**
- Create: `.tools/auto-hermes-health-check.mjs`

- [ ] **Step 1: Write the health check script**

Create `.tools/auto-hermes-health-check.mjs`:

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const AI_SYNC = join(ROOT, '.ai-sync');
const BACKUP_DIR = join(AI_SYNC, 'backups');

function resolve(relPath) {
  return join(ROOT, relPath);
}

function readFile(relPath) {
  const abs = resolve(relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf-8');
}

function loadJson(relPath) {
  const text = readFile(relPath);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
}

functionbackupState(relPath) {
  ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const name = relPath.replace(/[/\\]/g, '_');
  const src = resolve(relPath);
  const dst = join(BACKUP_DIR, `${name}.${ts}.bak`);
  if (existsSync(src)) {
    writeFileSync(dst, readFileSync(src, 'utf-8'), 'utf-8');
  }
}

const STATE_FILES = {
  TASKS_MD: {
    path: 'TASKS.md',
    type: 'markdown',
    requiredSections: ['## Active Tasks', '## Suggested Next Tasks'],
    description: 'Task queue',
  },
  AGENT_SYNC_MD: {
    path: '.ai-sync/AGENT_SYNC.md',
    type: 'markdown',
    requiredSections: ['## Active Claims', '## Recently Completed'],
    description: 'Agent coordination board',
  },
  CONTEXT_LEDGER_MD: {
    path: '.ai-sync/CONTEXT_LEDGER.md',
    type: 'markdown',
    requiredSections: ['## Goal Stack', '## Surface Capsules'],
    description: 'Context ledger',
  },
  LOOP_STATE_MD: {
    path: '.ai-sync/LOOP_STATE.md',
    type: 'markdown',
    requiredSections: [],
    description: 'Loop state',
  },
  LOOP_STATE_JSON: {
    path: '.ai-sync/AUTO_HERMES_LOOP_STATE.json',
    type: 'json',
    schema: {
      loopId: 'string',
      currentRound: 'number',
      status: 'string',
      resumable: 'boolean',
    },
    description: 'Loop state (JSON)',
  },
  HUMAN_LOOP_MD: {
    path: '.ai-sync/HUMAN_LOOP.md',
    type: 'markdown',
    requiredSections: [],
    description: 'Human gate',
  },
};

function checkMarkdownFile(entry) {
  const issues = [];
  const text = readFile(entry.path);
  if (text === null) {
    if (entry.requiredSections.length > 0) {
      issues.push({ severity: 'critical', file: entry.path, issue: 'file missing', action: 'create-template' });
    }
    return issues;
  }
  for (const section of entry.requiredSections) {
    if (!text.includes(section)) {
      issues.push({ severity: 'minor', file: entry.path, issue: `missing section: ${section}`, action: 'add-section' });
    }
  }
  return issues;
}

function checkJsonFile(entry) {
  const issues = [];
  const data = loadJson(entry.path);
  if (data === null) {
    issues.push({ severity: 'critical', file: entry.path, issue: 'file missing or invalid JSON', action: 'create-default' });
    return issues;
  }
  if (entry.schema) {
    for (const [key, type] of Object.entries(entry.schema)) {
      if (!(key in data)) {
        issues.push({ severity: 'minor', file: entry.path, issue: `missing key: ${key}`, action: 'add-default' });
      } else if (typeof data[key] !== type) {
        issues.push({ severity: 'minor', file: entry.path, issue: `wrong type for ${key}: expected ${type}, got ${typeof data[key]}`, action: 'fix-type' });
      }
    }
  }
  return issues;
}

function checkReferentialIntegrity() {
  const issues = [];
  const tasksText = readFile('TASKS.md');
  const agentSyncText = readFile('.ai-sync/AGENT_SYNC.md');
  if (!tasksText || !agentSyncText) return issues;

  const activeTaskMatches = tasksText.match(/- \[ \] .+/g) || [];
  const activeClaimMatches = agentSyncText.match(/- \*\*Task:\*\* .+/g) || [];

  for (const claimLine of activeClaimMatches) {
    const claimTask = claimLine.replace(/- \*\*Task:\*\* /, '').trim();
    const found = activeTaskMatches.some(t => t.includes(claimTask.substring(0, 30)));
    if (!found) {
      issues.push({
        severity: 'warning',
        file: '.ai-sync/AGENT_SYNC.md',
        issue: `active claim references task not in Active Tasks: "${claimTask.substring(0, 50)}"`,
        action: 'review',
      });
    }
  }
  return issues;
}

function repairMarkdown(entry, issues) {
  const filePath = resolve(entry.path);
  let text = readFile(entry.path) || '';

  for (const issue of issues) {
    if (issue.action === 'add-section' && !text.includes(issue.issue.replace('missing section: ', ''))) {
      const section = issue.issue.replace('missing section: ', '');
      text += `\n\n${section}\n\n`;
    }
  }

  try {
    backupState(entry.path);
    writeFileSync(filePath, text, 'utf-8');
  } catch (e) {
    return { repaired: false, error: e.message };
  }
  return { repaired: true, repairedIssues: issues.length };
}

function repairJson(entry, issues) {
  const filePath = resolve(entry.path);
  const defaults = {
    loopId: '',
    currentRound: 0,
    maxRounds: 24,
    status: 'idle',
    currentTask: '',
    roundHistory: [],
    stallCounter: 0,
    runawayCounter: 0,
    sameWorkUnitStreak: 0,
    lastWorkUnitSignature: null,
    lastCheckpoint: '',
    resumable: true,
    preRoundCommit: '',
    evolveCycleCount: 0,
    lastEvolveRound: 0,
  };

  let data = loadJson(entry.path) || { ...defaults };

  for (const issue of issues) {
    if (issue.action === 'add-default' || issue.action === 'fix-type') {
      const key = issue.issue.includes(':') ? issue.issue.split(':')[0].replace('missing key: ', '').replace('wrong type for ', '').split(':')[0].trim() : '';
      if (key && key in defaults) {
        data[key] = defaults[key];
      }
    }
  }

  try {
    backupState(entry.path);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    return { repaired: false, error: e.message };
  }
  return { repaired: true, repairedIssues: issues.length };
}

export function runHealthCheck({ repair = false, write = false } = {}) {
  const results = { healthy: true, checks: {}, repairs: [], criticalIssues: [] };

  for (const [key, entry] of Object.entries(STATE_FILES)) {
    const issues = entry.type === 'json' ? checkJsonFile(entry) : checkMarkdownFile(entry);
    results.checks[key] = { path: entry.path, issues, severity: issues.length === 0 ? 'healthy' : issues.some(i => i.severity === 'critical') ? 'critical' : 'degraded' };
    if (issues.some(i => i.severity === 'critical')) {
      results.healthy = false;
      results.criticalIssues.push({ key, path: entry.path, issues });
    }
    if (repair && issues.length > 0) {
      const result = entry.type === 'json' ? repairJson(entry, issues) : repairMarkdown(entry, issues);
      results.repairs.push({ key, ...result });
    }
  }

  const refIssues = checkReferentialIntegrity();
  if (refIssues.length > 0) {
    results.checks.REFERENTIAL_INTEGRITY = { path: 'cross-file', issues: refIssues, severity: 'warning' };
  }

  if (write) {
    const outputPath = resolve('.ai-sync/AUTO_HERMES_HEALTH_CHECK.json');
    writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  }

  return results;
}

// CLI entry
const args = process.argv.slice(2);
const repair = args.includes('--repair');
const write = args.includes('--write');
const results = runHealthCheck({ repair, write });
if (!args.includes('--quiet')) {
  console.log(JSON.stringify(results, null, 2));
}
process.exit(results.healthy ? 0 : 1);
```

- [ ] **Step 3: Write the corresponding markdown helper**

Create `.tools/auto-hermes-health-check.mjs` also exports a markdown renderer (add to the file):

```js
export function renderHealthCheckMarkdown(results) {
  let md = '# Auto-Hermes Health Check\n\n';
  md += `**Overall:** ${results.healthy ? '鉁?Healthy' : '鉂?Degraded'}\n\n`;
  md += `**Checked:** ${new Date().toISOString()}\n\n`;
  for (const [key, check] of Object.entries(results.checks)) {
    const icon = check.severity === 'healthy' ? '鉁? : check.severity === 'critical' ? '鉂? : '鈿狅笍';
    md += `## ${icon} ${key}\n\n`;
    md += `- File: \`${check.path}\`\n`;
    md += `- Severity: ${check.severity}\n`;
    if (check.issues.length > 0) {
      md += `- Issues:\n`;
      for (const issue of check.issues) {
        md += `  - [${issue.severity}] ${issue.issue} (${issue.action})\n`;
      }
    }
    md += '\n';
  }
  if (results.repairs.length > 0) {
    md += '## Repairs\n\n';
    for (const repair of results.repairs) {
      md += `- ${repair.key}: repaired=${repair.repaired}\n`;
    }
  }
  return md;
}
```

- [ ] **Step 3: Integrate health check into auto-hermes-loop.mjs startup**

In `auto-hermes-loop.mjs`, add at the top of `runAutoHermesLoop`, after parsing args:

```js
const { runHealthCheck } = await import('./auto-hermes-health-check.mjs');
const healthResult = runHealthCheck({ repair: true });
if (!healthResult.healthy) {
  console.warn('[health-check] State files degraded, auto-repair attempted:', healthResult.repairs);
  if (healthResult.criticalIssues.length > 0) {
    state.status = 'health-check-failed';
    state.stopReason = `critical state file issues: ${healthResult.criticalIssues.map(i => i.path).join(', ')}`;
  }
}
```

- [ ] **Step 4: Test health check on current repo state**

Run:
```bash
node .tools/auto-hermes-health-check.mjs --write
cat .ai-sync/AUTO_HERMES_HEALTH_CHECK.json
```

Expected: JSON health check output listing all state files and their status. Verify missing sections get flagged.

- [ ] **Step 5: Test health check with repair**

Run:
```bash
node .tools/auto-hermes-health-check.mjs --repair --write
```

Expected: Minor issues are auto-repaired, backups created in `.ai-sync/backups/`.

- [ ] **Step 6: Commit**

```bash
git add .tools/auto-hermes-health-check.mjs .tools/auto-hermes-loop.mjs
git commit -m "feat(auto-hermes): add state file health check with auto-repair"
```

---

### Task 1.4: Create automatic rollback utility

**Files:**
- Create: `.tools/auto-hermes-rollback.mjs`

- [ ] **Step 1: Write the rollback script**

Create `.tools/auto-hermes-rollback.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function resolve(relPath) { return join(ROOT, relPath); }

function getCurrentHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8', cwd: ROOT, timeout: 5000 }).trim();
  } catch { return ''; }
}

function getChangedFiles(fromCommit) {
  try {
    const output = execFileSync('git', ['diff', '--name-only', fromCommit + '..HEAD'], { encoding: 'utf-8', cwd: ROOT, timeout: 10000 }).trim();
    return output ? output.split('\n').filter(Boolean) : [];
  } catch { return []; }
}

function isProductFile(filePath) {
  return filePath.startsWith('frontend/src/') ||
         filePath.startsWith('backend/src/') ||
         filePath.startsWith('frontend/public/') ||
         filePath.startsWith('backend/src/main/resources/');
}

const SHARED_CONTRACT_FILES = [
  'frontend/src/i18n/translations.js',
  'frontend/src/App.jsx',
  'backend/src/main/resources/application.properties',
  'backend/pom.xml',
  'frontend/package.json',
];

function isSharedContract(filePath) {
  return SHARED_CONTRACT_FILES.some(cf => filePath === cf);
}

export function evaluateRollback(fromCommit, { maxFiles = 5, productOnly = true } = {}) {
  const current = getCurrentHead();
  if (!fromCommit || fromCommit === current) {
    return { canAutoRevert: false, reason: 'no changes to revert', changedFiles: [] };
  }

  const changedFiles = getChangedFiles(fromCommit);
  if (changedFiles.length === 0) {
    return { canAutoRevert: false, reason: 'no changes found', changedFiles: [] };
  }

  const isAutoSafe = changedFiles.every(f => isProductFile(f) && !isSharedContract(f));

  if (changedFiles.length > maxFiles) {
    return {
      canAutoRevert: false,
      reason: `too many files changed (${changedFiles.length} > ${maxFiles})`,
      changedFiles,
      suggestion: 'manual-review',
    };
  }

  if (!isAutoSafe && productOnly) {
    const nonProduct = changedFiles.filter(f => !isProductFile(f));
    const contracts = changedFiles.filter(f => isSharedContract(f));
    return {
      canAutoRevert: false,
      reason: `non-product or shared-contract files changed: ${[...nonProduct, ...contracts].join(', ')}`,
      changedFiles,
      suggestion: 'manual-review',
    };
  }

  return {
    canAutoRevert: true,
    reason: 'safe auto-revert: product-only files, within limit',
    changedFiles,
    fromCommit,
    currentHead: current,
  };
}

export function executeRollback(fromCommit, changedFiles = []) {
  if (!fromCommit) return { success: false, error: 'no from commit' };

  try {
    execFileSync('git', ['checkout', fromCommit, '--', ...changedFiles], { encoding: 'utf-8', cwd: ROOT, timeout: 30000 });
    return { success: true, revertedFiles: changedFiles, fromCommit };
  } catch (e) {
    return { success: false, error: e.message, fromCommit };
  }
}

// CLI entry
const args = process.argv.slice(2);
const fromCommit = args.find(a => a.startsWith('--from='))?.replace('--from=', '');
const dryRun = args.includes('--dry-run');
const write = args.includes('--write');

if (!fromCommit) {
  console.error('Usage: node auto-hermes-rollback.mjs --from=<commit-hash> [--dry-run] [--write]');
  process.exit(1);
}

const evaluation = evaluateRollback(fromCommit);

if (write && evaluation.canAutoRevert && !dryRun) {
  const result = executeRollback(fromCommit, evaluation.changedFiles);
  console.log(JSON.stringify({ evaluation, execution: result }, null, 2));
} else {
  console.log(JSON.stringify({ evaluation, dryRun }, null, 2));
}
```

- [ ] **Step 2: Integrate rollback into round-close**

In `.tools/auto-hermes-round-close.mjs`, add rollback evaluation after verdict processing:

```js
import { evaluateRollback, executeRollback } from './auto-hermes-rollback.mjs';

// After verdict is determined, before queue updates:
if ((verdict === 'must-fix' || verdict === 'reverse-recommended') && args.rollback !== 'false') {
  const loopState = loadJsonFile(args.loopStateJson || '.ai-sync/AUTO_HERMES_LOOP_STATE.json', {});
  const preRoundCommit = loopState.preRoundCommit || args.preRoundCommit;
  if (preRoundCommit) {
    const evaluation = evaluateRollback(preRoundCommit, {
      maxFiles: parseInt(args.rollbackMaxFiles || '5', 10),
      productOnly: args.rollbackProductOnly !== 'false',
    });
    if (evaluation.canAutoRevert && args.autoRollback !== 'false') {
      const result = executeRollback(preRoundCommit, evaluation.changedFiles);
      promotion.rollback = result;
    } else {
      promotion.rollbackBrief = evaluation;
    }
  }
}
```

Add to `parseArgs`:
```js
rollback: 'true',
autoRollback: 'true',
rollbackMaxFiles: '5',
rollbackProductOnly: 'true',
preRoundCommit: '',
```

- [ ] **Step 3: Test rollback evaluation on current repo**

```bash
node .tools/auto-hermes-rollback.mjs --from=HEAD~1 --dry-run
```

Expected: JSON output showing evaluation of changes between HEAD~1 and HEAD. If changes are within limits, `canAutoRevert: true`.

- [ ] **Step 4: Commit**

```bash
git add .tools/auto-hermes-rollback.mjs .tools/auto-hermes-round-close.mjs
git commit -m "feat(auto-hermes): add automatic rollback for must-fix and reverse-recommended rounds"
```

---

### Task 1.5: Create autonomous-first HUMAN_LOOP configuration

**Files:**
- Create: `.tools/auto-hermes-human-loop.json`
- Modify: `.tools/auto-hermes-controller.mjs`

- [ ] **Step 1: Write the default autonomous human loop config**

Create `.tools/auto-hermes-human-loop.json`:

```json
{
  "mode": "autonomous",
  "safety_brakes": {
    "destructive_actions": "require_human",
    "irreversible_changes": "require_human",
    "everything_else": "auto_proceed"
  },
  "human_requests": [],
  "priority_overrides": [],
  "reversal_requests": [],
  "agent_writeback": {
    "last_action": "",
    "next_action": "",
    "risk_level": "low"
  }
}
```

- [ ] **Step 2: Add JSON human loop reader to auto-hermes-controller.mjs**

In `.tools/auto-hermes-controller.mjs`, modify the `parseHumanLoop` function to read the JSON config first:

```js
function parseHumanLoopJson(text) {
  if (!text || text.trim() === '') return null;
  try {
    const data = JSON.parse(text);
    return {
      source: 'json',
      mode: data.mode || 'autonomous',
      status: data.mode === 'pause' ? 'paused' : data.mode === 'stop' ? 'stopped' : 'autonomous',
      pause: data.mode === 'pause',
      stop: data.mode === 'stop',
      mustAsk: false,
      safety_brakes: data.safety_brakes || {
        destructive_actions: 'require_human',
        irreversible_changes: 'require_human',
        everything_else: 'auto_proceed',
      },
      human_requests: data.human_requests || [],
      priority_overrides: data.priority_overrides || [],
      reversal_requests: data.reversal_requests || [],
      currentOwnedSurface: data.agent_writeback?.last_action || '',
      nextIntendedRound: data.agent_writeback?.next_action || '',
      risk_level: data.agent_writeback?.risk_level || 'low',
    };
  } catch {
    return null;
  }
}
```

Update the `chooseWorkUnit` function to check JSON first:

```js
// Replace the existing human loop reading logic:
const humanLoopJsonPath = resolveFromRoot(args.humanLoopJson || '.tools/auto-hermes-human-loop.json');
const humanLoopJsonText = readOptional(humanLoopJsonPath);
let humanLoop;

if (humanLoopJsonText) {
  humanLoop = parseHumanLoopJson(humanLoopJsonText);
  if (humanLoop) {
    // JSON config takes precedence 鈥?merge with MD if both exist
    const mdText = readOptional(args.humanLoop);
    if (mdText) {
      const mdLoop = parseHumanLoop(mdText);
      // MD pause/stop always wins as a safety override
      if (mdLoop.pause) humanLoop.pause = true;
      if (mdLoop.stop) humanLoop.stop = true;
      if (mdLoop.mustAsk) humanLoop.mustAsk = true;
      humanLoop.status = mdLoop.status || humanLoop.status;
    }
  }
}
if (!humanLoop) {
  const humanLoopText = readOptional(args.humanLoop);
  humanLoop = parseHumanLoop(humanLoopText);
}
```

- [ ] **Step 3: Modify routeRound to use autonomous-first safety brakes**

In `routeRound`, after computing the initial shape, add safety brake logic:

```js
if (humanLoop && humanLoop.safety_brakes) {
  const sb = humanLoop.safety_brakes;
  // Destructive and irreversible actions always require human
  const isDestructive = classification.destructive || false; // new field in classifyRound
  const isIrreversible = classification.irreversible || false; // new field in classifyRound

  if (isDestructive && sb.destructive_actions === 'require_human') {
    return { shape: 'paused', visibleMultiAgent: false, recommendedAgents: [], autoDecisionGate: { name: 'safety-brake', decision: 'pause', reason: 'destructive action requires human' }, reasons: ['destructive action blocked by safety brake'] };
  }
  if (isIrreversible && sb.irreversible_changes === 'require_human') {
    return { shape: 'paused', visibleMultiAgent: false, recommendedAgents: [], autoDecisionGate: { name: 'safety-brake', decision: 'pause', reason: 'irreversible change requires human' }, reasons: ['irreversible change blocked by safety brake'] };
  }
}

// Risk-level gating
if (humanLoop && humanLoop.risk_level === 'high') {
  // High risk pauses automatically, even in autonomous mode
  // But the round can still proceed if the action is not destructive/irreversible
  // Just flag it for review
  route.autoDecisionGate = { name: 'risk-flag', decision: 'proceed-with-note', reason: 'high risk level, proceeding autonomously' };
}
```

- [ ] **Step 4: Add autonomous mode awareness to classifyRound**

In `classifyRound`, add destructive/irreversible detection:

```js
// After computing complexity:
const destructiveKeywords = ['drop', 'delete', 'remove table', 'truncate', 'force push', 'migration', 'drop column'];
const irreversibleKeywords = ['drop', 'force push', 'delete user', 'truncate table', 'irreversible'];

const taskTextLower = (task.title + ' ' + (task.helpers?.join(' ') || '')).toLowerCase();
result.destructive = destructiveKeywords.some(kw => taskTextLower.includes(kw));
result.irreversible = irreversibleKeywords.some(kw => taskTextLower.includes(kw));
```

- [ ] **Step 5: Add parseArgs entry for humanLoopJson**

```js
humanLoopJson: '.tools/auto-hermes-human-loop.json',
```

- [ ] **Step 6: Test autonomous mode**

Create a test HUMAN_LOOP.json with `"mode": "pause"` and verify the controller still pauses:

```bash
node .tools/auto-hermes-controller.mjs --dry-run --human-loop-json .tools/auto-hermes-human-loop.json
```

Expected: Controller respects the JSON config. With `mode: "autonomous"`, no pause. With `mode: "pause"`, shape returns "paused".

- [ ] **Step 7: Commit**

```bash
git add .tools/auto-hermes-human-loop.json .tools/auto-hermes-controller.mjs
git commit -m "feat(auto-hermes): add autonomous-first HUMAN_LOOP with safety brakes"
```

---

### Task 1.6: Update documentation for Layer 1

**Files:**
- Modify: `HERMES_SELF_EVOLVING_ENGINE.md`
- Modify: `.codex/workflows/auto-hermes-architecture.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update HERMES_SELF_EVOLVING_ENGINE.md**

Add reference to the new resilience tools and persistent state:

```markdown
## Resilience Layer

Auto-hermes now includes a resilience layer that ensures the loop never dies without recovery:

- **Persistent Loop State** (`.ai-sync/AUTO_HERMES_LOOP_STATE.json`): Loop state checkpoints after every round. On crash, the next run resumes from the last checkpoint.
- **Executor Crash Recovery**: On executor failure, retry with exponential backoff (0s, 30s, 120s, max 3 attempts). If all retries fail, mark round as `executor-unavailable` and continue with the next promotable task.
- **State File Health Checks** (`.tools/auto-hermes-health-check.mjs`): Validates all state files at loop startup. Auto-repairs minor corruption, backs up before repair, and pauses on major corruption.
- **Automatic Rollback** (`.tools/auto-hermes-rollback.mjs`): On `must-fix` or `reverse-recommended` verdicts, evaluates whether safe auto-revert is possible. Reverts product-only changes 鈮? files automatically; emits rollback brief for larger changes.
- **Autonomous-First HUMAN_LOOP** (`.tools/auto-hermes-human-loop.json`): Default mode is autonomous. Only destructive/irreversible actions require human confirmation. `must-ask` is no longer a default loop-stopper.
```

- [ ] **Step 2: Update auto-hermes-architecture.md**

Add to the "Canonical Round Lifecycle" section:

```markdown
0a. Health check: Run `.tools/auto-hermes-health-check.mjs --repair` to validate state files.
0b. Resume check: If `.ai-sync/AUTO_HERMES_LOOP_STATE.json` has `status: executing` and `resumable: true`, resume from checkpoint.
0c. Rollback evaluation: If the previous round had a `must-fix` or `reverse-recommended` verdict, evaluate rollback using `.tools/auto-hermes-rollback.mjs`.
```

Add to "Non-Negotiable Invariants":

```markdown
- The loop state checkpoint is written after every round. On crash, the next run resumes from checkpoint, not from scratch.
- Executor failure does not terminate the loop. The round is marked `executor-unavailable` and the loop continues with the next promotable task.
- Automatic rollback is limited to product-only files with 鈮? changes. Larger rollbacks require human review via rollback brief.
- HUMAN_LOOP default mode is `autonomous`. Only destructive/irreversible actions pause the loop for human input.
```

- [ ] **Step 3: Update AGENTS.md**

Add a new section:

```markdown
## Resilience Layer

Auto-hermes includes built-in resilience:

- Persistent loop state ensures the loop survives process crashes and resumes from the last checkpoint.
- Executor crash recovery retries with exponential backoff before marking a round as `executor-unavailable`.
- State file health checks run at every loop startup, auto-repairing minor corruption and flagging major issues.
- Automatic rollback evaluates and executes safe reverts for `must-fix` and `reverse-recommended` verdicts.
- HUMAN_LOOP defaults to `autonomous` mode with explicit safety brakes for destructive and irreversible actions. Use `.tools/auto-hermes-human-loop.json` for configuration. The existing `.ai-sync/HUMAN_LOOP.md` markdown format remains available as a fallback; JSON takes precedence when present.
```

- [ ] **Step 4: Verify documentation changes**

Run:
```bash
node .tools/auto-hermes-health-check.mjs --dry-run
node .tools/auto-hermes-rollback.mjs --from=HEAD --dry-run
```

Expected: Both commands execute without errors and produce expected output.

- [ ] **Step 5: Commit**

```bash
git add HERMES_SELF_EVOLVING_ENGINE.md .codex/workflows/auto-hermes-architecture.md AGENTS.md
git commit -m "docs(auto-hermes): document Layer 1 resilience features"
```

---

### Task 1.7: Layer 1 integration test

**Files:**
- None new (integration testing)

- [ ] **Step 1: Run full loop with resilience features**

```bash
node .tools/auto-hermes-loop.mjs --dry-run --max-rounds 2 --write
```

Expected: Loop state file created, health check passes, no errors in output.

- [ ] **Step 2: Simulate crash recovery**

```bash
node .tools/auto-hermes-loop.mjs --dry-run --max-rounds 1 --write
# Manually set status to "executing" in loop state
node -e "const fs=require('fs'); const s=JSON.parse(fs.readFileSync('.ai-sync/AUTO_HERMES_LOOP_STATE.json','utf-8')); s.status='executing'; s.currentRound=1; s.resumable=true; fs.writeFileSync('.ai-sync/AUTO_HERMES_LOOP_STATE.json',JSON.stringify(s,null,2))"
# Re-run, should resume from round 2
node .tools/auto-hermes-loop.mjs --dry-run --max-rounds 3 --write
```

Expected: Loop detects existing state with `status: executing` and `resumable: true`, resumes from round 2.

- [ ] **Step 3: Run rollback evaluation**

```bash
node .tools/auto-hermes-rollback.mjs --from=HEAD --dry-run
```

Expected: JSON output showing `canAutoRevert: false` (since HEAD has no changes from HEAD) or `changedFiles: []`.

- [ ] **Step 4: Run health check with repair**

```bash
node .tools/auto-hermes-health-check.mjs --repair --write
cat .ai-sync/AUTO_HERMES_HEALTH_CHECK.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log('Healthy:', d.healthy); console.log('Checks:', Object.keys(d.checks).length)"
```

Expected: Health check runs, reports status for all state files. Output shows `Healthy: true` or `Healthy: false` with specific issues listed.

- [ ] **Step 5: Verify autonomous human loop**

```bash
node -e "process.argv=['','']"
node .tools/auto-hermes-controller.mjs --dry-run
```

Expected: Controller runs in autonomous mode by default, not pausing on non-destructive tasks.

---

## Layer 2: Self-Observation

### Task 2.1: Activate SELF_EVOLVING_AUDIT and write per-round observations

**Files:**
- Modify: `.tools/auto-hermes-round-close.mjs`
- Modify: `.ai-sync/SELF_EVOLVING_AUDIT.md`

- [ ] **Step 1: Add observation writing to round-close**

In `.tools/auto-hermes-round-close.mjs`, after the scorecard building, add observation writing:

```js
function writeObservation(args, scorecard, promotion, classification) {
  const auditPath = resolveFromRoot(args.selfEvolvingAudit || '.ai-sync/SELF_EVOLVING_AUDIT.md');
  const timestamp = new Date().toISOString().split('T')[0];
  const taskTitle = promotion.title || args.title || 'unknown';

  let obs = `## Round ${args.round || '?'} 鈥?${timestamp}\n\n`;
  obs += `- Task: ${taskTitle}\n`;
  obs += `- Verdict: ${args.verdict || 'unknown'}\n`;
  obs += `- Duration: ${args.duration || '?'}s\n`;
  obs += `- Promotion path: ${promotion.source || 'unknown'}\n`;
  obs += `- Gate package: ${classification?.gatePackage || 'unknown'}\n`;
  obs += `- Complexity score: ${classification?.complexity || '?'}\n`;
  obs += `- Problem class: ${classification?.problemClass || 'unknown'}\n`;
  obs += `- Execution shape: ${classification?.route?.shape || 'unknown'}\n`;
  obs += `- Self-check: ${args.selfCheck ? 'pass' : 'skip'}\n`;
  obs += `\n### Observation\n鈥?recorded by round-close\n\n`;
  obs += `### Candidate Workflow Fix\n鈥?none this round\n\n`;

  let existing = '';
  if (existsSync(auditPath)) {
    existing = readFileSync(auditPath, 'utf-8');
  }
  writeFileSync(auditPath, obs + existing, 'utf-8');
}
```

- [ ] **Step 2: Verify audit file gets written**

Run round-close in dry-run mode:
```bash
node .tools/auto-hermes-round-close.mjs --dry-run --verdict pass --title "test-task" --round 1
cat .ai-sync/SELF_EVOLVING_AUDIT.md
```

Expected: Audit file contains a new round observation with task title, verdict, and timestamp.

- [ ] **Step 3: Commit**

```bash
git add .tools/auto-hermes-round-close.mjs .ai-sync/SELF_EVOLVING_AUDIT.md
git commit -m "feat(auto-hermes): activate SELF_EVOLVING_AUDIT with per-round observations"
```

---

### Task 2.2: Replace keyword scorecards with numeric measurements

**Files:**
- Modify: `.tools/auto-hermes-round-close.mjs`

- [ ] **Step 1: Replace buildRoundScorecard with numeric scores**

Replace the existing `buildRoundScorecard` function with numeric measurement logic:

```js
function buildRoundScorecard(args, promotion, selfCheck) {
  const capabilities = detectRoundCapabilities(args, selfCheck);
  const files = capabilities.files || [];
  const semanticText = capabilities.semanticText || '';
  const hasFiles = files.length > 0;
  const hasVerify = !!(args.verify && args.verify.length > 0);
  const hasSurface = !!(args.surface && args.surface.length > 0) || hasFiles;

  return {
    hallucination_control: {
      score: hasSurface ? (hasVerify ? 90 : 50) : 20,
      reason: hasSurface
        ? (hasVerify ? 'explicit surface + verification evidence' : 'explicit surface, no verification evidence')
        : 'no explicit surface claimed',
    },
    self_looping: {
      score: promotion.recommended ? 80 : 50,
      reason: promotion.recommended ? 'promotion recommended, loop continues' : 'no promotion recommended, loop may stop',
    },
    self_evolving: {
      score: 70,
      reason: 'observation recorded, no parameter adjustment this round',
    },
    task_achievability: {
      score: hasVerify ? (args.verdict === 'pass' ? 100 : 40) : 30,
      reason: hasVerify ? (args.verdict === 'pass' ? 'pass verdict with verify step' : 'verify step present but verdict not pass') : 'no verify step specified',
    },
    task_completeness: {
      score: args.verdict === 'pass' ? 90 : (args.verdict === 'must-fix' ? 30 : 50),
      reason: args.verdict === 'pass' ? 'all done-when conditions satisfied' : `verdict: ${args.verdict}`,
    },
    verification_reliability: {
      score: hasVerify ? (args.verdict === 'pass' ? 95 : 60) : 10,
      reason: hasVerify ? 'verify step present and run' : 'no verify step',
    },
    frontend_design_skill: {
      score: capabilities.touchesFrontend ? (selfCheck ? (selfCheck.issues ? 40 : 90) : 70) : 0,
      reason: capabilities.touchesFrontend ? (selfCheck ? (selfCheck.issues ? 'self-check found issues' : 'self-check clean') : 'no self-check') : 'n/a 鈥?round does not touch frontend',
    },
    backend_engineering_skill: {
      score: capabilities.touchesBackend ? (args.verdict === 'pass' ? 85 : 40) : 0,
      reason: capabilities.touchesBackend ? (args.verdict === 'pass' ? 'pass verdict on backend changes' : 'backend changes with non-pass verdict') : 'n/a 鈥?round does not touch backend',
    },
  };
}
```

Also update `makeGrade` to return score-based grades:

```js
function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

function makeGrade(score, reason) {
  return { grade: scoreToGrade(score), score, reason };
}
```

- [ ] **Step 2: Add score detection to detectRoundCapabilities**

The existing `detectRoundCapabilities` should remain but the scorecard now uses numeric values. Verify that `buildRoundScorecard` is called in the main flow and produces numeric scores.

- [ ] **Step 3: Verify numeric scorecards render correctly**

Run round-close in dry-run:
```bash
node .tools/auto-hermes-round-close.mjs --dry-run --verdict pass --title "score-test" --round 2
```

Expected: Quality audit entry contains numeric scores (0-100) alongside letter grades.

- [ ] **Step 4: Commit**

```bash
git add .tools/auto-hermes-round-close.mjs
git commit -m "feat(auto-hermes): replace keyword scorecards with numeric measurements"
```

---

### Task 2.3: Create per-round telemetry

**Files:**
- Create: `.tools/auto-hermes-telemetry.json`
- Modify: `.tools/auto-hermes-round-close.mjs`

- [ ] **Step 1: Create initial telemetry schema**

Create `.tools/auto-hermes-telemetry.json`:

```json
{
  "rounds": [],
  "moving_averages": {},
  "lastUpdated": ""
}
```

- [ ] **Step 2: Add telemetry writing to round-close**

In `.tools/auto-hermes-round-close.mjs`, add telemetry collection:

```js
function appendTelemetry(args, promotion, classification, route, startTime) {
  const telPath = resolveFromRoot(args.telemetryJson || '.ai-sync/AUTO_HERMES_TELEMETRY.json');
  let telemetry = { rounds: [], moving_averages: {}, lastUpdated: '' };
  try {
    const existing = readFileSync(telPath, 'utf-8');
    telemetry = JSON.parse(existing);
  } catch {}

  const roundEntry = {
    round: parseInt(args.round, 10) || 0,
    task: args.title || 'unknown',
    problemClass: classification?.problemClass || 'unknown',
    executionShape: route?.shape || 'unknown',
    verdict: args.verdict || 'unknown',
    duration_s: startTime ? Math.round((Date.now() - startTime) / 1000) : 0,
    files_changed: (args.files || []).length,
    must_fix_count: args.verdict === 'must-fix' ? 1 : 0,
    gate_package: classification?.gatePackage || 'unknown',
    complexity_score: classification?.complexity || 0,
    promotion_type: promotion?.source || 'none',
    timestamp: new Date().toISOString(),
  };

  telemetry.rounds.push(roundEntry);
  // Keep last 100 rounds
  if (telemetry.rounds.length > 100) {
    telemetry.rounds = telemetry.rounds.slice(-100);
  }

  // Recalculate moving averages per problem class
  const classGroups = {};
  for (const r of telemetry.rounds) {
    if (!classGroups[r.problemClass]) classGroups[r.problemClass] = [];
    classGroups[r.problemClass].push(r);
  }
  telemetry.moving_averages = {};
  for (const [cls, rounds] of Object.entries(classGroups)) {
    const passCount = rounds.filter(r => r.verdict === 'pass').length;
    telemetry.moving_averages[cls] = {
      avg_duration_s: Math.round(rounds.reduce((s, r) => s + r.duration_s, 0) / rounds.length),
      avg_verdict_pass_rate: +(passCount / rounds.length).toFixed(2),
      avg_promotion_accuracy: 0.5, // placeholder - tracked over time
    };
  }

  telemetry.lastUpdated = new Date().toISOString();
  writeFileSync(telPath, JSON.stringify(telemetry, null, 2), 'utf-8');
}
```

Add to `parseArgs` defaults:
```js
telemetryJson: '.ai-sync/AUTO_HERMES_TELEMETRY.json',
```

Call `appendTelemetry` at the end of the main flow, after all other state updates.

- [ ] **Step 3: Verify telemetry accumulates**

Run two rounds:
```bash
node .tools/auto-hermes-round-close.mjs --dry-run --verdict pass --title "tel-test-1" --round 1 --files "frontend/src/test.jsx" --write
node .tools/auto-hermes-round-close.mjs --dry-run --verdict pass --title "tel-test-2" --round 2 --files "backend/src/test.java" --write
cat .ai-sync/AUTO_HERMES_TELEMETRY.json
```

Expected: Telemetry file contains 2 round entries and moving averages by problem class.

- [ ] **Step 4: Commit**

```bash
git add .ai-sync/AUTO_HERMES_TELEMETRY.json .tools/auto-hermes-round-close.mjs
git commit -m "feat(auto-hermes): add per-round telemetry with moving averages"
```

---

### Task 2.4: Add dynamic screen discovery seed to suggest-tasks

**Files:**
- Modify: `.tools/suggest-tasks.mjs`

- [ ] **Step 1: Add route-based screen discovery**

In `.tools/suggest-tasks.mjs`, add a function that parses `App.jsx` to discover routes:

```js
function discoverScreensDynamically() {
  const appPath = resolveFromRoot('frontend/src/App.jsx');
  if (!existsSync(appPath)) return [];

  const appContent = readFileSync(appPath, 'utf-8');
  const routePattern = /path=["']([^"']+)["'][^}]*element\s*=\s*\{<(?:React\.)?lazy\([^)]*\)|<(\w+)/g;
  const dynamicScreens = [];
  let match;

  while ((match = routePattern.exec(appContent)) !== null) {
    const routePath = match[1];
    const componentName = match[2] || routeToComponentName(routePath);
    const expectedFile = `frontend/src/pages/${componentName}.jsx`;
    dynamicScreens.push({
      screen: componentName,
      route: routePath,
      expectedFile,
      dynamic: true,
    });
  }

  return dynamicScreens;
}

function routeToComponentName(routePath) {
  return routePath
    .replace(/^\//, '')
    .split('/')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}
```

- [ ] **Step 2: Merge dynamic screens with SCREEN_INTENTS**

In `collectSuggestedTasks`, before calling individual check functions, merge discovered screens:

```js
const dynamicScreens = discoverScreensDynamically();
for (const ds of dynamicScreens) {
  const existsInIntents = SCREEN_INTENTS.some(si => si.screen === ds.screen);
  if (!existsInIntents && existsSync(resolveFromRoot(ds.expectedFile))) {
    // Auto-register discovered screen with default tier
    SCREEN_INTENTS.push({
      screen: ds.screen,
      tier: 3, // default to mid-tier for auto-discovered
      intent: `Auto-discovered route: ${ds.route}`,
      file: ds.expectedFile,
      dynamic: true,
    });
  } else if (!existsInIntents && !existsSync(resolveFromRoot(ds.expectedFile))) {
    // Route defined but page file missing 鈥?this is a gap
    allIssues.push(screenIssue(ds.screen, 'missing_screen', `Route ${ds.route} has no page component`, [ds.expectedFile], 3));
  }
}
```

- [ ] **Step 3: Add test failure discovery**

```js
function discoverTestFailures() {
  const issues = [];
  const surefireDir = resolveFromRoot('backend/target/surefire-reports');
  if (existsSync(surefireDir)) {
    const xmlFiles = glob(surefireDir, /\.xml$/);
    for (const xmlFile of xmlFiles) {
      const content = readFileSync(xmlFile, 'utf-8');
      if (content.includes('errors="') && !content.match(/errors="0"/)) {
        const testName = xmlFile.replace(/\.xml$/, '').replace(/^TEST-/, '');
        issues.push({
          screen: 'backend',
          tier: 2,
          type: 'backend_logic_guard',
          desc: `Failing test: ${testName}`,
          files: [`backend/src/test/java/${testName.replace(/\./g, '/')}.java`],
        });
      }
    }
  }
  return issues;
}
```

- [ ] **Step 4: Add lint/compile warning discovery**

```js
function discoverLintWarnings() {
  const issues = [];
  const eslintOutput = resolveFromRoot('frontend/.eslint-results.json');
  if (existsSync(eslintOutput)) {
    try {
      const results = JSON.parse(readFileSync(eslintOutput, 'utf-8'));
      for (const file of results) {
        if (file.errorCount > 0 || file.warningCount > 3) {
          issues.push({
            screen: 'frontend',
            tier: 3,
            type: 'frontend_logic',
            desc: `${file.errorCount} errors, ${file.warningCount} warnings in ${file.filePath}`,
            files: [file.filePath],
          });
        }
      }
    } catch {}
  }
  return issues;
}
```

- [ ] **Step 5: Integrate discovery sources into collection**

In `collectSuggestedTasks`, add the new discovery calls:

```js
const dynamicScreenIssues = discoverScreensDynamically();
const testFailureIssues = discoverTestFailures();
const lintWarningIssues = discoverLintWarnings();
allIssues.push(...dynamicScreenIssues, ...testFailureIssues, ...lintWarningIssues);
```

- [ ] **Step 6: Verify dynamic discovery works**

```bash
node .tools/suggest-tasks.mjs --max 3
```

Expected: Output includes dynamically discovered screens from `App.jsx`, plus any test failures or lint warnings.

- [ ] **Step 7: Commit**

```bash
git add .tools/suggest-tasks.mjs
git commit -m "feat(auto-hermes): add dynamic screen discovery and test/lint gap detection"
```

---

## Layer 3: Self-Tuning

### Task 3.1: Create configurable gate parameters

**Files:**
- Create: `.tools/auto-hermes-config.json`
- Create: `.tools/auto-hermes-config-history.json`
- Modify: `.tools/auto-hermes-controller.mjs`

- [ ] **Step 1: Create config file with sensible defaults**

Create `.tools/auto-hermes-config.json` (initial values matching current hardcoded behavior):

```json
{
  "gates": {
    "minor_fix": { "required": ["EG", "SP", "tiny_QA"], "complexity_threshold": 2 },
    "milestone": { "required": ["SIG", "FIG", "SE7"], "complexity_threshold": 4 },
    "epic": { "required": ["SIG", "CPG", "FIG", "SE7"], "complexity_threshold": 7 }
  },
  "complexity": {
    "files_touched_weight": 1,
    "duplication_weight": 1,
    "state_complexity_weight": 1,
    "translation_drift_weight": 1,
    "verification_complexity_weight": 1,
    "fragility_weight": 1,
    "tech_debt_threshold": 4
  },
  "promotion": {
    "must_fix_priority": 100,
    "trust_resilience_priority": 80,
    "product_depth_priority": 60,
    "motivation_delight_priority": 40,
    "tech_debt_priority": 20
  },
  "loop": {
    "max_rounds": 24,
    "max_same_work_unit_repeats": 3,
    "runaway_threshold": 3,
    "stall_recovery_retries": 2,
    "evolve_interval": 5
  },
  "routing": {
    "single_agent_threshold": 0.3,
    "specialist_threshold": 0.6,
    "parallel_builders_threshold": 0.8
  },
  "rollback": {
    "auto_revert_max_files": 5,
    "auto_revert_product_only": true
  },
  "human_gate": {
    "default_mode": "autonomous",
    "destructive_require_human": true,
    "irreversible_require_human": true,
    "high_risk_pause": true,
    "medium_risk_auto_proceed": true
  }
}
```

Create `.tools/auto-hermes-config-history.json`:

```json
{
  "history": []
}
```

- [ ] **Step 2: Add config reader to auto-hermes-controller.mjs**

```js
function loadConfig(args) {
  const configPath = resolveFromRoot(args.configJson || '.tools/auto-hermes-config.json');
  const defaults = {
    gates: {
      minor_fix: { required: ['EG', 'SP', 'tiny_QA'], complexity_threshold: 2 },
      milestone: { required: ['SIG', 'FIG', 'SE7'], complexity_threshold: 4 },
      epic: { required: ['SIG', 'CPG', 'FIG', 'SE7'], complexity_threshold: 7 },
    },
    complexity: {
      files_touched_weight: 1, duplication_weight: 1, state_complexity_weight: 1,
      translation_drift_weight: 1, verification_complexity_weight: 1, fragility_weight: 1,
      tech_debt_threshold: 4,
    },
    promotion: {
      must_fix_priority: 100, trust_resilience_priority: 80, product_depth_priority: 60,
      motivation_delight_priority: 40, tech_debt_priority: 20,
    },
    loop: { max_rounds: 24, max_same_work_unit_repeats: 3, runaway_threshold: 3, stall_recovery_retries: 2, evolve_interval: 5 },
    routing: { single_agent_threshold: 0.3, specialist_threshold: 0.6, parallel_builders_threshold: 0.8 },
    rollback: { auto_revert_max_files: 5, auto_revert_product_only: true },
    human_gate: { default_mode: 'autonomous', destructive_require_human: true, irreversible_require_human: true, high_risk_pause: true, medium_risk_auto_proceed: true },
  };
  try {
    const text = readFileSync(configPath, 'utf-8');
    return { ...defaults, ...JSON.parse(text) };
  } catch {
    return defaults;
  }
}
```

Add to `parseArgs`:
```js
configJson: '.tools/auto-hermes-config.json',
```

- [ ] **Step 3: Replace hardcoded values in classifyRound and routeRound**

Replace hardcoded complexity weights with config values:

```js
const config = loadConfig(args);
// In classifyRound:
const complexity = (filesTouched > 3 ? config.complexity.files_touched_weight : 0)
  + (hasDuplication ? config.complexity.duplication_weight : 0)
  + (hasStateComplexity ? config.complexity.state_complexity_weight : 0)
  + (hasTranslationDrift ? config.complexity.translation_drift_weight : 0)
  + (hasVerificationComplexity ? config.complexity.verification_complexity_weight : 0)
  + (hasFragility ? config.complexity.fragility_weight : 0);
```

Replace hardcoded routing thresholds:
```js
// In routeRound:
if (classification.tiny || classification.complexity <= config.routing.single_agent_threshold * 10) {
  // single-agent
}
```

- [ ] **Step 4: Verify config loading works**

```bash
node .tools/auto-hermes-controller.mjs --dry-run
```

Expected: Controller runs using values from `auto-hermes-config.json`. No errors.

- [ ] **Step 5: Commit**

```bash
git add .tools/auto-hermes-config.json .tools/auto-hermes-config-history.json .tools/auto-hermes-controller.mjs
git commit -m "feat(auto-hermes): add configurable gate parameters replacing hardcoded values"
```

---

### Task 3.2: Create evolution engine

**Files:**
- Create: `.tools/auto-hermes-evolve.mjs`
- Modify: `.tools/auto-hermes-round-close.mjs`

- [ ] **Step 1: Write the evolution engine**

Create `.tools/auto-hermes-evolve.mjs` 鈥?the full observe 鈫?diagnose 鈫?propose 鈫?apply 鈫?verify 鈫?record cycle:

```js
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function resolve(relPath) { return join(ROOT, relPath); }
function loadJson(relPath) { try { return JSON.parse(readFileSync(resolve(relPath), 'utf-8')); } catch { return null; } }
function saveJson(relPath, data) { writeFileSync(resolve(relPath), JSON.stringify(data, null, 2), 'utf-8'); }

const SAFETY_LIMITS = {
  maxRounds: { min: 12, max: 48, step: 4 },
  maxSameWorkUnitRepeats: { min: 2, max: 6, step: 1 },
  runawayThreshold: { min: 2, max: 5, step: 1 },
  complexity_tech_debt_threshold: { min: 3, max: 7, step: 1 },
  promotion_priority_step: { min: 10, max: 100, step: 10 },
  routing_threshold_step: { min: 0.1, max: 0.9, step: 0.05 },
  rollback_auto_revert_max_files: { min: 3, max: 10, step: 1 },
  maxChangesPerCycle: 3,
  regressionThreshold: 0.25,
  improvementThreshold: 0.10,
};

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function observe(telemetry) {
  if (!telemetry || !telemetry.rounds || telemetry.rounds.length < 5) {
    return { observations: [], trend: 'insufficient-data' };
  }
  const recent = telemetry.rounds.slice(-10);
  const classes = {};
  for (const r of recent) {
    if (!classes[r.problemClass]) classes[r.problemClass] = { passes: 0, total: 0, durations: [], mustFixes: 0 };
    classes[r.problemClass].total++;
    if (r.verdict === 'pass') classes[r.problemClass].passes++;
    classes[r.problemClass].durations.push(r.duration_s);
    if (r.must_fix_count) classes[r.problemClass].mustFixes++;
  }
  return { observations: classes, trend: 'stable', recent };
}

function diagnose(observations, config) {
  const proposals = [];
  for (const [cls, data] of Object.entries(observations.observations || {})) {
    const passRate = data.passes / data.total;
    const avgDuration = data.durations.reduce((s, d) => s + d, 0) / data.durations.length;

    if (passRate < 0.5 && data.total >= 3) {
      proposals.push({ path: `gates.minor_fix.complexity_threshold`, from: config.gates?.minor_fix?.complexity_threshold || 2, to: (config.gates?.minor_fix?.complexity_threshold || 2) + 1, reason: `${cls} pass rate ${passRate.toFixed(2)} < 50% over ${data.total} rounds` });
    }
    if (passRate > 0.9 && data.total >= 3 && (config.gates?.minor_fix?.complexity_threshold || 2) > 1) {
      proposals.push({ path: `gates.minor_fix.complexity_threshold`, from: config.gates?.minor_fix?.complexity_threshold || 2, to: Math.max(1, (config.gates?.minor_fix?.complexity_threshold || 2) - 1), reason: `${cls} pass rate ${passRate.toFixed(2)} > 90%, can relax gates` });
    }
  }

  if (proposals.length === 0 && observations.trend === 'stable') {
    return { proposals: [], confidence: 0, diagnosis: 'no-adjustment-needed' };
  }

  return { proposals: proposals.slice(0, SAFETY_LIMITS.maxChangesPerCycle), confidence: Math.min(0.95, 0.5 + 0.1 * (observations.recent?.length || 0)), diagnosis: 'adjustment-proposed' };
}

function propose(diagnosis, config, telemetry) {
  if (diagnosis.proposals.length === 0) {
    return null;
  }
  return {
    proposal_id: `evolve-${new Date().toISOString().split('T')[0]}-${Date.now().toString(36)}`,
    based_on_rounds: telemetry.rounds.slice(-5).map(r => r.round),
    changes: diagnosis.proposals,
    confidence: diagnosis.confidence,
    rollback_to: JSON.parse(JSON.stringify(config)),
    timestamp: new Date().toISOString(),
  };
}

function applyProposal(proposal, configPath, historyPath) {
  const config = JSON.parse(JSON.stringify(proposal.rollback_to));
  for (const change of proposal.changes) {
    const keys = change.path.split('.');
    let target = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in target)) target[keys[i]] = {};
      target = target[keys[i]];
    }
    const finalKey = keys[keys.length - 1];
    const limit = SAFETY_LIMITS[keys.join('_')] || SAFETY_LIMITS.promotion_priority_step;
    target[finalKey] = clamp(change.to, limit.min, limit.max);
  }
  saveJson(configPath, config);

  const history = loadJson(historyPath) || { history: [] };
  history.history.push(proposal);
  if (history.history.length > 20) history.history = history.history.slice(-20);
  saveJson(historyPath, history);

  return config;
}

function verify(proposal, telemetry) {
  const recentRounds = telemetry.rounds.slice(-5);
  const beforeRounds = telemetry.rounds.slice(-10, -5);
  if (beforeRounds.length < 3 || recentRounds.length < 3) return { verdict: 'insufficient-data' };

  const beforePassRate = beforeRounds.filter(r => r.verdict === 'pass').length / beforeRounds.length;
  const recentPassRate = recentRounds.filter(r => r.verdict === 'pass').length / recentRounds.length;

  const improvement = recentPassRate - beforePassRate;
  if (improvement >= SAFETY_LIMITS.improvementThreshold) return { verdict: 'improved', improvement };
  if (improvement <= -SAFETY_LIMITS.regressionThreshold) return { verdict: 'regressed', improvement };
  return { verdict: 'neutral', improvement };
}

export function runEvolve({ configPath = '.tools/auto-hermes-config.json', historyPath = '.tools/auto-hermes-config-history.json', telemetryPath = '.ai-sync/AUTO_HERMES_TELEMETRY.json', auditPath = '.ai-sync/SELF_EVOLVING_AUDIT.md', dryRun = false } = {}) {
  const config = loadJson(configPath) || {};
  const telemetry = loadJson(telemetryPath) || { rounds: [], moving_averages: {} };

  const cfg = loadJson(configPath) || {};
  const loopConfig = cfg.loop || {};
  const evolveInterval = loopConfig.evolve_interval || 5;

  if (telemetry.rounds.length < evolveInterval) {
    return { status: 'skipped', reason: `need ${evolveInterval} rounds, have ${telemetry.rounds.length}` };
  }

  const observations = observe(telemetry);
  const diagnosis = diagnose(observations, cfg);
  const proposal = propose(diagnosis, cfg, telemetry);

  if (!proposal) {
    return { status: 'no-proposal', observations, diagnosis };
  }

  if (dryRun) {
    return { status: 'dry-run', proposal, observations, diagnosis };
  }

  const newConfig = applyProposal(proposal, configPath, historyPath);
  const verification = verify(proposal, telemetry);

  // Write to SELF_EVOLVING_AUDIT.md
  let audit = '';
  if (existsSync(resolve(auditPath))) {
    audit = readFileSync(resolve(auditPath), 'utf-8');
  }
  const auditEntry = `\n## Evolution ${proposal.proposal_id}\n\n- Changes: ${proposal.changes.map(c => `${c.path}: ${c.from} 鈫?${c.to}`).join(', ')}\n- Confidence: ${proposal.confidence.toFixed(2)}\n- Verification: ${verification.verdict}\n- Improvement: ${((verification.improvement || 0) * 100).toFixed(1)}%\n\n`;
  writeFileSync(resolve(auditPath), auditEntry + audit, 'utf-8');

  return { status: 'applied', proposal, verification, newConfig };
}

// CLI entry
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const result = runEvolve({ dryRun });
console.log(JSON.stringify(result, null, 2));
```

- [ ] **Step 2: Trigger evolve every 5 rounds in round-close**

In `.tools/auto-hermes-round-close.mjs`, add at the end of the main flow:

```js
// Trigger evolve every N rounds (default: 5)
const config = loadConfig(args);
const evolveInterval = config.loop?.evolve_interval || 5;
const telemetry = loadJsonFile(args.telemetryJson || '.ai-sync/AUTO_HERMES_TELEMETRY.json', { rounds: [] });
const completedRounds = (telemetry.rounds || []).length;

if (completedRounds > 0 && completedRounds % evolveInterval === 0 && args.evolve !== 'false') {
  const { runEvolve } = await import('./auto-hermes-evolve.mjs');
  const evolveResult = runEvolve({
    configPath: args.configJson || '.tools/auto-hermes-config.json',
    telemetryPath: args.telemetryJson || '.ai-sync/AUTO_HERMES_TELEMETRY.json',
  });
  if (evolveResult.status === 'applied') {
    console.log('[evolve] Configuration adjusted:', evolveResult.proposal?.changes?.map(c => `${c.path}: ${c.from} 鈫?${c.to}`).join(', '));
  }
}
```

Add to `parseArgs`:
```js
evolve: 'true',
configJson: '.tools/auto-hermes-config.json',
```

- [ ] **Step 3: Test evolution engine in dry-run**

```bash
node .tools/auto-hermes-evolve.mjs --dry-run
```

Expected: Output showing `skipped` (not enough rounds yet) or `dry-run` with proposal details.

- [ ] **Step 4: Commit**

```bash
git add .tools/auto-hermes-evolve.mjs .tools/auto-hermes-round-close.mjs
git commit -m "feat(auto-hermes): add evolution engine with observe-diagnose-propose-apply-verify cycle"
```

---

## Layer 4: Self-Discovery

### Task 4.1: Create dynamic problem discovery

**Files:**
- Create: `.tools/auto-hermes-discover.mjs`

- [ ] **Step 1: Write the discovery engine**

Create `.tools/auto-hermes-discover.mjs` with the 6 discovery sources (route-based, test failure, lint/compile, git-blotch, dead-code, dependency drift). Full implementation follows the same pattern as the suggest-tasks check functions, but scanning dynamically rather than from a hardcoded list.

This is implemented by extending the `discoverScreensDynamically`, `discoverTestFailures`, and `discoverLintWarnings` functions already added to `suggest-tasks.mjs` in Task 2.4, plus adding:

```js
// Additional discovery sources:
function discoverGitHotspots() { /* files changed in >50% of recent commits */ }
function discoverDeadCode() { /* exports not imported anywhere */ }
function discoverDependencyDrift() { /* npm audit + mvnw dependency:tree vulnerabilities */ }
```

The full implementation mirrors the pattern established in Tasks 2.4 and extends the existing `collectSuggestedTasks` function.

- [ ] **Step 2: Integrate discovery engine with suggest-tasks**

Import and run all discovery sources in the main `collectSuggestedTasks` flow:

```js
const discoveries = [
  ...discoverScreensDynamically(),
  ...discoverTestFailures(),
  ...discoverLintWarnings(),
  ...discoverGitHotspots(),
  ...discoverDeadCode(),
  ...discoverDependencyDrift(),
];
allIssues.push(...discoveries);
```

- [ ] **Step 3: Test discovery on current repo**

```bash
node .tools/suggest-tasks.mjs --max 5
```

Expected: Output includes dynamically discovered screens, plus any test failures, lint warnings, git hotspots, dead code, or dependency drift issues found in the current repo.

- [ ] **Step 4: Commit**

```bash
git add .tools/auto-hermes-discover.mjs .tools/suggest-tasks.mjs
git commit -m "feat(auto-hermes): add dynamic problem discovery engine with 6 sources"
```

---

### Task 4.2: Create continuous health monitor

**Files:**
- Create: `.tools/auto-hermes-health-monitor.mjs`

- [ ] **Step 1: Write the health monitor**

Create `.tools/auto-hermes-health-monitor.mjs` 鈥?runs alongside the loop, checks state files, git repo, test suite, lint, loop state, and config drift:

```js
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
function resolve(relPath) { return join(ROOT, relPath); }
function readFile(relPath) { try { return readFileSync(resolve(relPath), 'utf-8'); } catch { return null; } }
function loadJson(relPath) { try { return JSON.parse(readFileSync(resolve(relPath), 'utf-8')); } catch { return null; } }

export function runHealthMonitor({ write = false } = {}) {
  const result = {
    last_check: new Date().toISOString(),
    checks: {},
    alerts: [],
  };

  // State files check
  const loopState = loadJson('.ai-sync/AUTO_HERMES_LOOP_STATE.json');
  result.checks.state_files = loopState ? (loopState.status === 'executing' && loopState.resumable ? 'healthy' : 'idle') : 'missing';

  // Git repo check
  try {
    execFileSync('git', ['status', '--porcelain'], { encoding: 'utf-8', cwd: ROOT, timeout: 5000 });
    result.checks.git_repo = 'clean';
  } catch {
    result.checks.git_repo = 'error';
  }

  // Test suite check (lightweight 鈥?just check if test output exists)
  const testOutput = existsSync(resolve('backend/target/surefire-reports'));
  result.checks.test_suite = testOutput ? 'present' : 'no-reports';

  // Loop state check
  if (loopState) {
    result.checks.loop_state = loopState.status === 'executing' ? 'active' : 'idle';
  }

  // Config drift check
  const configCurrent = loadJson('.tools/auto-hermes-config.json');
  const configHistory = loadJson('.tools/auto-hermes-config-history.json');
  result.checks.config_drift = configHistory?.history?.length > 0 ? (configHistory.history[configHistory.history.length - 1].changes?.length > 0 ? 'adjusted' : 'default') : 'default';

  // Generate alerts
  if (result.checks.state_files === 'missing') {
    result.alerts.push({ type: 'state_corruption', severity: 'high', source: '.ai-sync/', auto_fixable: true });
  }

  if (write) {
    writeFileSync(resolve('.ai-sync/AUTO_HERMES_HEALTH_MONITOR.json'), JSON.stringify(result, null, 2), 'utf-8');
  }

  return result;
}

// CLI
const write = process.argv.includes('--write');
const result = runHealthMonitor({ write });
if (!process.argv.includes('--quiet')) {
  console.log(JSON.stringify(result, null, 2));
}
```

- [ ] **Step 2: Test health monitor**

```bash
node .tools/auto-hermes-health-monitor.mjs --write
cat .ai-sync/AUTO_HERMES_HEALTH_MONITOR.json
```

Expected: JSON output showing check status for state files, git repo, test suite, loop state, and config drift.

- [ ] **Step 3: Commit**

```bash
git add .tools/auto-hermes-health-monitor.mjs
git commit -m "feat(auto-hermes): add continuous health monitor"
```

---

## Verification Criteria

### Layer 1 Verification
- [ ] Loop survives executor crash, resumes from checkpoint
- [ ] State files are auto-repaired on startup
- [ ] Bad rounds are auto-reverted when safe (鈮? product files)
- [ ] HUMAN_LOOP defaults to autonomous mode
- [ ] Only destructive/irreversible actions pause for human

### Layer 2 Verification
- [ ] SELF_EVOLVING_AUDIT.md accumulates per-round observations
- [ ] Scorecards produce numeric 0-100 scores
- [ ] Telemetry file accumulates round data and moving averages
- [ ] Dynamic screen discovery finds pages from App.jsx routes

### Layer 3 Verification
- [ ] Config values are read from auto-hermes-config.json
- [ ] Evolution engine produces at least 1 verified config adjustment after 5 rounds
- [ ] Config history records all changes with rollback targets
- [ ] Safety limits are enforced (max 3 params per cycle, step sizes respected)

### Layer 4 Verification
- [ ] Discovery engine finds problems not in hardcoded SCREEN_INTENTS
- [ ] Health monitor reports status for all checks
- [ ] Auto-fix resolves at least 1 high-confidence low-severity issue

---

## Safety Boundaries (For All Layers)

These boundaries are never auto-adjusted:
- Human gate for destructive actions: `destructive_actions: require_human`
- Human gate for irreversible changes: `irreversible_changes: require_human`
- Evolution engine cannot modify safety constraint min/max values
- Evolution engine cannot change more than 3 parameters per cycle
- Evolution engine cannot change any parameter by more than 1 step size per cycle
- 25% regression triggers immediate full revert of the cycle's changes
- Auto-fix is limited to deterministic, single-file, low-risk fixes

---

## Supplementary Tasks (for spec sections missing from initial plan)

These tasks fill gaps identified in the plan self-review. They should be implemented after their respective layer's base tasks are complete.

### Task 3.3: Enforce safety constraints in config and evolution engine

**Files:**
- Modify: `.tools/auto-hermes-evolve.mjs`
- Modify: `.tools/auto-hermes-config.json`

- [ ] **Step 1: Add constraint validation to auto-hermes-evolve.mjs**

In the `applyProposal` function, before writing config changes, validate each change against `SAFETY_LIMITS`:

```js
function validateProposal(proposal) {
  const errors = [];
  if (proposal.changes.length > SAFETY_LIMITS.maxChangesPerCycle) {
    errors.push(`too many changes: ${proposal.changes.length} > ${SAFETY_LIMITS.maxChangesPerCycle}`);
  }
  for (const change of proposal.changes) {
    const key = change.path.replace(/\./g, '_');
    const limit = SAFETY_LIMITS[key];
    if (limit) {
      const step = Math.abs(change.to - change.from);
      if (step > limit.step) {
        errors.push(`${change.path}: step ${step} exceeds max step ${limit.step}`);
      }
      if (change.to < limit.min || change.to > limit.max) {
        errors.push(`${change.path}: ${change.to} out of range [${limit.min}, ${limit.max}]`);
      }
    }
    // Never allow changing human_gate safety brake thresholds
    if (change.path.startsWith('human_gate.')) {
      errors.push(`${change.path}: human gate thresholds cannot be auto-adjusted`);
    }
  }
  return errors;
}
```

Insert `const errors = validateProposal(proposal); if (errors.length > 0) return { status: 'rejected', errors };` before the `applyProposal` call in `runEvolve`.

- [ ] **Step 2: Add 25% regression revert logic**

In the `verify` function, add regression check:

```js
if (verification.verdict === 'regressed' && Math.abs(verification.improvement) >= SAFETY_LIMITS.regressionThreshold) {
  // Revert to rollback_to config
  saveJson(configPath, proposal.rollback_to);
  return { status: 'reverted', proposal, verification, reason: `regression ${(verification.improvement * 100).toFixed(1)}% exceeds ${(SAFETY_LIMITS.regressionThreshold * 100).toFixed(0)}% threshold` };
}
```

- [ ] **Step 3: Document safety constraints in HERMES_SELF_EVOLVING_ENGINE.md**

Add a `## Safety Constraints` section showing the full table from the spec:

```markdown
## Safety Constraints

| Parameter | Minimum | Maximum | Step Size |
|---|---|---|---|
| max_rounds | 12 | 48 | 4 |
| max_same_work_unit_repeats | 2 | 6 | 1 |
| runaway_threshold | 2 | 5 | 1 |
| complexity.tech_debt_threshold | 3 | 7 | 1 |
| promotion.*_priority | 10 | 100 | 10 |
| routing.*_threshold | 0.1 | 0.9 | 0.05 |
| rollback.auto_revert_max_files | 3 | 10 | 1 |

Hard rules:
- No single adjustment can change more than 3 parameters per cycle
- No parameter can change by more than 1 step size per evolution cycle
- 25% regression triggers immediate full revert
- Human gate thresholds (destructive/irreversible require human) are never auto-adjusted
```

- [ ] **Step 4: Test safety constraint validation**

```bash
# Edit auto-hermes-config.json to set max_rounds to 100 (above max of 48)
# Run evolve in dry-run mode
node .tools/auto-hermes-evolve.mjs --dry-run
# Verify that the proposal is rejected for exceeding max
```

- [ ] **Step 5: Commit**

```bash
git add .tools/auto-hermes-evolve.mjs .tools/auto-hermes-config.json HERMES_SELF_EVOLVING_ENGINE.md
git commit -m "feat(auto-hermes): enforce safety constraints in evolution engine"
```

---

### Task 3.4: Create adaptive routing statistics and threshold evolution

**Files:**
- Create: `.ai-sync/AUTO_HERMES_ROUTING_STATS.json`
- Modify: `.tools/auto-hermes-controller.mjs`
- Modify: `.tools/auto-hermes-evolve.mjs`

- [ ] **Step 1: Create routing stats schema**

Create `.ai-sync/AUTO_HERMES_ROUTING_STATS.json`:

```json
{
  "shapes": {
    "single-agent": {
      "frontend-logic": { "total": 0, "pass": 0, "must_fix": 0 },
      "backend-logic": { "total": 0, "pass": 0, "must_fix": 0 },
      "frontend-design": { "total": 0, "pass": 0, "must_fix": 0 },
      "cross-stack-contract": { "total": 0, "pass": 0, "must_fix": 0 }
    },
    "one-specialist": {
      "frontend-logic": { "total": 0, "pass": 0, "must_fix": 0 },
      "backend-logic": { "total": 0, "pass": 0, "must_fix": 0 },
      "frontend-design": { "total": 0, "pass": 0, "must_fix": 0 },
      "cross-stack-contract": { "total": 0, "pass": 0, "must_fix": 0 }
    },
    "parallel-builders": {
      "frontend-logic": { "total": 0, "pass": 0, "must_fix": 0 },
      "backend-logic": { "total": 0, "pass": 0, "must_fix": 0 },
      "frontend-design": { "total": 0, "pass": 0, "must_fix": 0 },
      "cross-stack-contract": { "total": 0, "pass": 0, "must_fix": 0 }
    }
  },
  "lastUpdated": ""
}
```

- [ ] **Step 2: Add routing stats collection to round-close**

In `.tools/auto-hermes-round-close.mjs`, after telemetry append, add routing stats update:

```js
function updateRoutingStats(args, classification, route, verdict) {
  const statsPath = resolveFromRoot(args.routingStatsJson || '.ai-sync/AUTO_HERMES_ROUTING_STATS.json');
  let stats; try { stats = JSON.parse(readFileSync(statsPath, 'utf-8')); } catch { stats = { shapes: {}, lastUpdated: '' }; }

  const shape = route?.shape || 'single-agent';
  const problemClass = classification?.problemClass || 'unknown';
  if (!stats.shapes[shape]) stats.shapes[shape] = {};
  if (!stats.shapes[shape][problemClass]) stats.shapes[shape][problemClass] = { total: 0, pass: 0, must_fix: 0 };

  stats.shapes[shape][problemClass].total++;
  if (verdict === 'pass') stats.shapes[shape][problemClass].pass++;
  if (verdict === 'must-fix') stats.shapes[shape][problemClass].must_fix++;

  stats.lastUpdated = new Date().toISOString();
  writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf-8');
}
```

Add to `parseArgs`: `routingStatsJson: '.ai-sync/AUTO_HERMES_ROUTING_STATS.json'`.

- [ ] **Step 3: Add routing adaptation to evolution engine**

In `.tools/auto-hermes-evolve.mjs`, add a `diagnoseRouting` function:

```js
function diagnoseRouting(stats, config) {
  const proposals = [];
  for (const [shape, classes] of Object.entries(stats.shapes || {})) {
    for (const [cls, data] of Object.entries(classes)) {
      if (data.total < 5) continue; // need at least 5 data points
      const passRate = data.pass / data.total;

      if (shape === 'single-agent' && passRate < 0.6 && cls === 'cross-stack-contract') {
        proposals.push({
          path: `routing.specialist_threshold`,
          from: config.routing?.specialist_threshold || 0.6,
          to: Math.max(0.1, (config.routing?.specialist_threshold || 0.6) - 0.05),
          reason: `single-agent pass rate for ${cls} is ${passRate.toFixed(2)} < 60%, lowering specialist threshold`,
        });
      }
      if (shape === 'single-agent' && passRate > 0.85 && cls === 'frontend-logic') {
        proposals.push({
          path: `routing.single_agent_threshold`,
          from: config.routing?.single_agent_threshold || 0.3,
          to: Math.min(0.9, (config.routing?.single_agent_threshold || 0.3) + 0.05),
          reason: `single-agent pass rate for ${cls} is ${passRate.toFixed(2)} > 85%, raising single-agent threshold`,
        });
      }
    }
  }
  return proposals;
}
```

Call `diagnoseRouting` alongside the existing `diagnose` function in `runEvolve`.

- [ ] **Step 4: Test routing stats collection and adaptation**

```bash
# Round-close should update routing stats
node .tools/auto-hermes-round-close.mjs --dry-run --verdict pass --title "routing-test" --round 3 --write
cat .ai-sync/AUTO_HERMES_ROUTING_STATS.json
```

Expected: Routing stats show updated counts for the shape and problem class used.

- [ ] **Step 5: Commit**

```bash
git add .ai-sync/AUTO_HERMES_ROUTING_STATS.json .tools/auto-hermes-round-close.mjs .tools/auto-hermes-evolve.mjs
git commit -m "feat(auto-hermes): add adaptive routing statistics and threshold evolution"
```

---

### Task 4.2: Implement semantic gap detection

**Files:**
- Modify: `.tools/suggest-tasks.mjs`

- [ ] **Step 1: Add API contract gap detection**

In `.tools/suggest-tasks.mjs`, add a new check function:

```js
function checkApiContractGaps() {
  const issues = [];
  // Parse @Controller endpoints from backend Java files
  const controllerFiles = glob(resolveFromRoot('backend/src/main/java'), /Controller\.java$/);
  for (const cf of controllerFiles) {
    const content = readFileSync(cf, 'utf-8');
    const endpointPattern = /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*["']([^"']*)["']/g;
    let match;
    while ((match = endpointPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      // Check if frontend has a corresponding API call
      const apiFiles = glob(resolveFromRoot('frontend/src/data'), /\.js$/);
      const hasFrontendConsumer = apiFiles.some(af => {
        const afContent = readFileSync(af, 'utf-8');
        return afContent.includes(path);
      });
      if (!hasFrontendConsumer) {
        issues.push(screenIssue('backend', 'api_orphan', `Endpoint ${method} ${path} has no frontend consumer`, [cf], 3));
      }
    }
  }

  // Check frontend API calls without backend error handling
  const apiFiles = glob(resolveFromRoot('frontend/src/data'), /\.js$/);
  for (const af of apiFiles) {
    const content = readFileSync(af, 'utf-8');
    const fetchPattern = /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g;
    let match;
    while ((match = fetchPattern.exec(content)) !== null) {
      const url = match[1];
      if (!content.includes('.catch') && !content.includes('catch(')) {
        issues.push(screenIssue('frontend', 'missing_error_handling', `API call to ${url} has no .catch() error handling`, [af], 3));
      }
    }
  }
  return issues;
}
```

- [ ] **Step 2: Add feature coverage gap detection**

```js
function checkFeatureCoverageGaps() {
  const issues = [];
  // Reuse discovered screens from discoverScreensDynamically
  const screens = discoverScreensDynamically();
  for (const screen of screens) {
    const expectedFile = screen.expectedFile || screen.file;
    if (!expectedFile || !existsSync(resolveFromRoot(expectedFile))) continue;
    const content = readFileSync(resolveFromRoot(expectedFile), 'utf-8');

    const hasEmptyState = content.includes('empty') || content.includes('Empty') || content.includes('no data') || content.includes('No data');
    const hasErrorState = content.includes('error') || content.includes('Error') || content.includes('try {') || content.includes('.catch');
    const hasLoadingState = content.includes('loading') || content.includes('Loading') || content.includes('spinner') || content.includes('skeleton');

    if (!hasEmptyState) {
      issues.push(screenIssue(screen.screen, 'missing_empty_state', `Missing empty state in ${screen.screen}`, [expectedFile], screen.tier || 3));
    }
    if (!hasErrorState) {
      issues.push(screenIssue(screen.screen, 'missing_error_state', `Missing error state in ${screen.screen}`, [expectedFile], screen.tier || 3));
    }
    if (!hasLoadingState) {
      issues.push(screenIssue(screen.screen, 'missing_loading_state', `Missing loading state in ${screen.screen}`, [expectedFile], screen.tier || 3));
    }
  }
  return issues;
}
```

- [ ] **Step 3: Integrate semantic checks into suggest-tasks collection**

In `collectSuggestedTasks`, add:

```js
const apiContractIssues = checkApiContractGaps();
const featureCoverageIssues = checkFeatureCoverageGaps();
allIssues.push(...apiContractIssues, ...featureCoverageIssues);
```

- [ ] **Step 4: Test semantic gap detection**

```bash
node .tools/suggest-tasks.mjs --max 5
```

Expected: Output includes API contract gaps (orphaned endpoints, missing error handling) and feature coverage gaps (missing states).

- [ ] **Step 5: Commit**

```bash
git add .tools/suggest-tasks.mjs
git commit -m "feat(auto-hermes): add semantic gap detection for API contracts and feature coverage"
```

---

### Task 4.3: Implement self-healing problem resolution

**Files:**
- Create: `.tools/auto-hermes-auto-fix.mjs`
- Modify: `.tools/auto-hermes-round-close.mjs`

- [ ] **Step 1: Create the auto-fix categorizer**

Create `.tools/auto-hermes-auto-fix.mjs`:

```js
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
function resolve(relPath) { return join(ROOT, relPath); }

const AUTO_FIXABLE_PATTERNS = [
  {
    type: 'missing_translation',
    test: (issue) => issue.type === 'translation_bypasses' && (issue.files?.length || 0) === 1,
    confidence: 'high',
    severity: 'low',
    fix: (issue) => {
      // Missing translations are deterministic, single-file, verifiable by lint
      const file = issue.files[0];
      return { action: 'create-translation-entry', file, description: `Add missing translation entry in ${file}` };
    },
    verify: () => 'cd frontend && npm run lint',
  },
  {
    type: 'unused_import',
    test: (issue) => issue.type === 'dead_code' && issue.desc?.includes('unused import') && (issue.files?.length || 0) === 1,
    confidence: 'high',
    severity: 'low',
    fix: (issue) => ({ action: 'remove-unused-import', file: issue.files[0], description: `Remove unused import in ${issue.files[0]}` }),
    verify: () => 'cd frontend && npm run lint',
  },
  {
    type: 'lint_auto_fix',
    test: (issue) => issue.type === 'app_voice' && (issue.files?.length || 0) === 1,
    confidence: 'high',
    severity: 'low',
    fix: (issue) => ({ action: 'coach-voice-fix', file: issue.files[0], description: `Fix coach voice in ${issue.files[0]}` }),
    verify: () => 'cd frontend && npm run lint',
  },
];

export function categorizeIssue(issue) {
  for (const pattern of AUTO_FIXABLE_PATTERNS) {
    if (pattern.test(issue)) {
      return {
        confidence: pattern.confidence,
        severity: pattern.severity,
        autoFixable: true,
        fix: pattern.fix(issue),
        verify: pattern.verify(),
      };
    }
  }
  return {
    confidence: issue.tier <= 2 ? 'medium' : 'low',
    severity: issue.tier <= 2 ? 'medium' : 'low',
    autoFixable: false,
    fix: null,
    verify: null,
  };
}

export function resolveIssue(issue) {
  const category = categorizeIssue(issue);

  if (category.confidence === 'high' && category.severity === 'low' && category.autoFixable) {
    // Auto-fix path: deterministic, single-file, verifiable
    return {
      action: 'auto-fix',
      fix: category.fix,
      verify: category.verify,
      confidence: category.confidence,
      severity: category.severity,
    };
  }

  if (category.confidence === 'high' && category.severity === 'medium') {
    // Auto-promote to Active Tasks
    return {
      action: 'auto-promote',
      fix: null,
      verify: null,
      confidence: category.confidence,
      severity: category.severity,
    };
  }

  if (category.confidence === 'medium') {
    // Add to Suggested, normal promotion
    return {
      action: 'suggest',
      fix: null,
      verify: null,
      confidence: category.confidence,
      severity: category.severity,
    };
  }

  // Low confidence 鈫?Suggested with low priority
  return {
    action: 'suggest-low-priority',
    fix: null,
    verify: null,
    confidence: category.confidence,
    severity: category.severity,
  };
}

// CLI entry
const args = process.argv.slice(2);
if (args.includes('--categorize')) {
  // Read issues from stdin or from suggest-tasks output
  // For now, just export the categorizer
  console.log('Auto-fix categorizer ready. Use programmatically or --categorize <issue-json>');
}
```

- [ ] **Step 2: Integrate auto-fix into suggest-tasks**

In `.tools/suggest-tasks.mjs`, after collecting all issues and before scoring, add:

```js
import { categorizeIssue } from './auto-hermes-auto-fix.mjs';

// After allIssues is built:
for (const issue of allIssues) {
  issue.resolution = categorizeIssue(issue);
}
```

In `writeToTasksFile`, add a `Resolution:` line for auto-fixable issues:

```js
// In formatTask function:
if (task.resolution && task.resolution.autoFixable) {
  taskBlock += `Resolution: auto-fix (${task.resolution.confidence}/${task.resolution.severity})\n`;
  if (task.resolution.fix) {
    taskBlock += `Auto-fix: ${task.resolution.fix.description}\n`;
    taskBlock += `Verify: ${task.resolution.verify}\n`;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .tools/auto-hermes-auto-fix.mjs .tools/suggest-tasks.mjs
git commit -m "feat(auto-hermes): add self-healing problem resolution with confidence/severity categorization"
```

---

## Self-Review Errata

### Known issues from plan self-review (addressed in supplementary tasks above)

1. **Missing spec sections** 鈥?Tasks 3.3, 3.4, 4.2, 4.3 added as supplementary tasks above
2. **`functionbackupState` typo in Task 1.3** 鈥?Should be `function backupState`
3. **`discoverGitHotspots`/`discoverDeadCode`/`discoverDependencyDrift` stubs in Task 4.1** 鈥?These need full implementations; the stubs describe the intent but need code
4. **`glob()` call in `discoverTestFailures`** 鈥?Should use `fs.readdirSync` + filter or import from `suggest-tasks.mjs`
5. **`frontend/.eslint-results.json`** 鈥?Not a standard artifact; should use `child_process.execSync('npx eslint --format json ...')` or check for CI output
6. **Task 1.5 Step 3 `route.autoDecisionGate`** 鈥?Variable should be the route object returned by `routeRound()`, not `route`
7. **Task 1.5 Step 4 `result.destructive`** 鈥?Should be integrated into the `classifyRound` return object, not assigned to a `result` variable
8. **Task 3.1 Step 3** 鈥?Unit conversion `complexity <= config.routing.single_agent_threshold * 10` is implicit; should be documented with a comment
9. **Task 2.2 `makeGrade` change** 鈥?Downstream consumers of the scorecard (quality audit, coordinator brief) also need updating for the new `{ grade, score, reason }` shape
10. **Telemetry `avg_promotion_accuracy: 0.5`** 鈥?Placeholder; needs tracking logic in round-close that checks if promoted tasks become completed within 3 rounds
11. **Duplicate Step 3 in Task 1.3** 鈥?The "Write the corresponding markdown helper" step should be Step 3 and "Integrate health check" should be Step 4
12. **Scorecard dimensions** 鈥?Plan adds `self_looping`, `self_evolving`; spec defines `promotion_accuracy`, `time_efficiency`. Both should be included.
13. **Loop state `roundHistory[].promoted_to`** 鈥?Should be tracked in the `appendTelemetry` function
14. **Health check `.ai-sync/LOOP_STATE.md`** 鈥?This file should be removed from `STATE_FILES` since the JSON version replaces it
15. **Health monitor `checks.lint`** 鈥?Should be added to match the spec