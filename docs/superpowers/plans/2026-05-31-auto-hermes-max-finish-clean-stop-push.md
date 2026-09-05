# Auto-Hermes Max Finish Clean-Stop Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live `/auto-hermes` and `/auto-hermes-max` finish helper honor the documented clean-stop auto-push case when the tree is clean but the current branch still has unpublished local commits.

**Architecture:** Keep the fix centered in `tools/auto-hermes-finish.mjs` so round-close and max-loop callers inherit the behavior automatically. Separate `commit-needed` from `push-needed` evaluation, then allow a push-only execution path when repo/remote/docker gates pass and the branch is ahead of its published origin state.

**Tech Stack:** Node.js ESM tooling, PowerShell/git helpers, existing `tools` test harness.

---

### Task 1: Capture the regression in finish-helper tests

**Files:**
- Modify: `tools/auto-hermes-tools.test.mjs`
- Test: `tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Add a failing regression test for clean-tree unpublished commits**

Add a test that calls `runAutoHermesFinish()` with:
- `push: true`
- `autoPushWhenNeeded: true`
- no explicit changed files
- injected git state showing current branch ahead of `origin`
- injected fresh docker-gate state

Expected before the fix: finish result is not eligible or does not emit a push-only command.

- [ ] **Step 2: Run the focused test and confirm the RED failure**

Run: `node tools/auto-hermes-tools.test.mjs`
Expected: FAIL on the new clean-tree unpublished-commit auto-push assertion.

### Task 2: Implement push-only clean-stop eligibility

**Files:**
- Modify: `tools/auto-hermes-finish.mjs`
- Test: `tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Add branch publication detection helpers**

Teach the finish helper to determine:
- current branch name
- whether the branch has unpublished local commits relative to `origin`
- whether the branch is in a safe pushable state for the documented clean-stop rule

- [ ] **Step 2: Split commit-needed from push-needed logic**

Keep commit eligibility based on publishable changed files, but add push-only eligibility for:
- true clean stop intent
- current branch has unpublished commits
- `origin` matches `https://github.com/520HXC/run.git`
- Docker gate is fresh/passing

- [ ] **Step 3: Emit and execute the correct command**

When commit is not needed but push is needed:
- render a direct `git push origin <branch>` command in the finish artifact
- execute that push path instead of calling `tools/auto-commit.ps1`

- [ ] **Step 4: Re-run the focused test and confirm GREEN**

Run: `node tools/auto-hermes-tools.test.mjs`
Expected: PASS for the new regression case and all existing `tools` helper assertions.

### Task 3: Refresh ownership docs only if implementation wording still drifts

**Files:**
- Modify if needed: `.codex/workflows/auto-hermes-shared-contract.md`
- Modify if needed: `docs/repo-rules/git-and-publish.md`

- [ ] **Step 1: Compare the final behavior to the existing wording**

If the updated helper exactly matches the documented rule, leave docs unchanged.

- [ ] **Step 2: Only patch the smallest owner if wording is still ambiguous**

Clarify that the finish helper may push an already-committed current branch on a true clean stop even when no new working-tree files remain.

### Task 4: Final verification

**Files:**
- Test: `tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Run the focused verification command**

Run: `node tools/auto-hermes-tools.test.mjs`
Expected: PASS

- [ ] **Step 2: Inspect the changed finish-helper behavior**

Confirm the result artifact fields distinguish:
- no publishable working-tree files
- unpublished current-branch commits
- push-only eligibility/result when applicable
