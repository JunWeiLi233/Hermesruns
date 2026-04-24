# Auto-Hermes VoltAgent Subagents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repo-local Codex-only VoltAgent subagent bridge so Hermes `/auto-hermes` can discover and recommend installed external specialists while keeping Hermes-owned workflow aliases authoritative.

**Architecture:** Build one small catalog helper that knows what external agents are installed, one installer/sync helper that refreshes the repo-local catalog, then extend the controller and loop to consume that manifest and emit truthful external specialist recommendations. Keep Hermes-first routing and add focused tests around discovery and recommendation.

**Tech Stack:** Node.js `.mjs` scripts, local JSON manifest files, repo-local `.codex/agents/*.toml`, focused node-based tests in `.tools/auto-hermes-tools.test.mjs`

---

### Task 1: Add repo-local catalog discovery

**Files:**
- Create: `.tools/auto-hermes-subagent-catalog.mjs`
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test proving the catalog helper returns Hermes-safe defaults when no manifest exists, and returns installed VoltAgent agent names when the manifest and `.toml` files exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`
Expected: FAIL because the catalog helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `.tools/auto-hermes-subagent-catalog.mjs` with helpers to:
- read `.ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json`
- scan `.codex/agents/*.toml`
- expose installed external agent names
- expose small category helpers like backend/frontend/review/research/orchestration

- [ ] **Step 4: Run test to verify it passes**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`
Expected: PASS for the new catalog discovery tests.

### Task 2: Add repo-local installer/sync helper

**Files:**
- Create: `.tools/install-voltagent-codex-subagents.mjs`
- Modify: `.tools/auto-hermes-subagent-catalog.mjs`
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test proving the installer writes a manifest in repo-local `.ai-sync`, uses repo-local `.codex/agents`, and records `repo-local-codex-only` mode.

- [ ] **Step 2: Run test to verify it fails**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`
Expected: FAIL because the installer helper and manifest write path do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `.tools/install-voltagent-codex-subagents.mjs` to:
- clone or refresh the VoltAgent repo into `.ai-sync/voltagent-codex-subagents/`
- install selected `.toml` files into `.codex/agents/`
- write `.ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json`

- [ ] **Step 4: Run test to verify it passes**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`
Expected: PASS for manifest/install-mode assertions.

### Task 3: Extend controller routing with optional external specialists

**Files:**
- Modify: `.tools/auto-hermes-controller.mjs`
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Write the failing test**

Add tests that classify Hermes rounds and expect:
- Spring/backend tasks add `spring-boot-engineer` when installed
- React/frontend tasks add `react-specialist` or `ui-fixer` when installed
- Review-sensitive tasks add `code-reviewer` when installed
- Research/doc tasks add `docs-researcher` or `search-specialist` when installed
- Missing external installs do not change Hermes core routing

- [ ] **Step 2: Run test to verify it fails**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`
Expected: FAIL because controller routing is still fixed to Hermes-only agents.

- [ ] **Step 3: Write minimal implementation**

Patch `.tools/auto-hermes-controller.mjs` to:
- load the external catalog helper
- derive optional external specialists from current task classification
- keep Hermes aliases in `recommendedAgents`
- add external specialists in a separate truthful field such as `optionalExternalAgents` and mirror them into `subagentPlan` notes/lanes only when installed

- [ ] **Step 4: Run test to verify it passes**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`
Expected: PASS for external specialist routing tests.

### Task 4: Extend loop/coordinator brief rendering

**Files:**
- Modify: `.tools/auto-hermes-loop.mjs`
- Test: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test proving the worker prompt/coordinator brief renders installed external specialists explicitly and omits unavailable ones.

- [ ] **Step 2: Run test to verify it fails**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`
Expected: FAIL because loop prompts do not yet mention external specialist availability.

- [ ] **Step 3: Write minimal implementation**

Patch `.tools/auto-hermes-loop.mjs` to render:
- installed external specialists
- optional external recommendations for the round
- truthful wording that these are repo-local installed Codex agents, not guaranteed native auto-spawn behavior

- [ ] **Step 4: Run test to verify it passes**

Run: `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs`
Expected: PASS for prompt rendering assertions.

### Task 5: Verify end to end

**Files:**
- Modify as needed from prior tasks

- [ ] **Step 1: Run focused verification**

Run:
```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-controller.mjs --json
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-loop.mjs --dry-run --max-rounds 1 --json
```

Expected:
- tests pass
- controller JSON includes truthful external catalog fields
- dry-run loop completes and renders the new external-agent guidance without claiming unavailable agents

- [ ] **Step 2: Record any needed follow-up**

If the catalog install requires network approval or cannot complete in this environment, leave the installer in place, report that limitation precisely, and keep discovery/routing stable when no catalog is installed.
