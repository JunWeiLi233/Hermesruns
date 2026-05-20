---
description: Ralph-style indefinite self-loop variant of auto-hermes for Claude Code.
---

# Auto-Hermes Self

Active execution loop. Claude Code initializes, **assembles a coding team**, dispatches the team, executes, verifies, closes, and re-enters. Never stops after one round.

The team coordinates through a shared bulletin at `.ai-sync/TEAMWORK.md` so every member knows what siblings are doing and what's next.

## 0. Session Start
Before the first round of any session, run the inline session checklist:
1. Read `.ai-sync/HUMAN_LOOP.md`. If it says `pause`, `stop`, or `must-ask`, stop and report.
2. `node .tools/auto-hermes-self-loop.mjs --write --runtime claude` to refresh loop state.
3. Confirm browser proof is reachable (`node .tools/auto-hermes-browser.mjs status` or `.tools/auto-hermes-playwright.mjs doctor`) only if the round will touch browser-visible code.
4. `node .tools/auto-hermes-issues.mjs --list` to scan open GitHub issues for must-fix overlap.
5. Re-read `.claude/skills/_TRIGGERS.md` so skill triggers are fresh.

## Loop Entry
1. **Refresh state:** `node .tools/auto-hermes-self-loop.mjs --write --runtime claude`
2. Read `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md`. `Next Action: stop` means finish actions if product files changed, then stop. `claude-execute-round` means run the integrity gate, then execute the round.

## Pre-Round Ralph Integrity Gate

Verify the loop ability is intact before each round. If a previous task broke loop-critical files, fix before executing the current round.

| Check | Action | Block on |
|---|---|---|
| Last round touched loop-critical files | Read `.ai-sync/AUTO_HERMES_SELF_ROUND_RESULT.json`. Loop-critical: `.codex/commands/auto-hermes-self.md`, `.claude/commands/auto-hermes-self.md`, `.tools/auto-hermes-self-loop.mjs`, `.tools/auto-hermes-loop.mjs`, `.tools/auto-hermes-teamwork.mjs`, `.tools/auto-hermes-browser.mjs`. None touched means skip remaining checks. | - |
| Scripts parse | `node --check .tools/auto-hermes-self-loop.mjs && node --check .tools/auto-hermes-loop.mjs && node --check .tools/auto-hermes-teamwork.mjs && node --check .tools/auto-hermes-browser.mjs` | syntax error |
| Contract intact | `node .tools/auto-hermes-self-loop.mjs --write --runtime claude --dry-run`, then verify `.ai-sync/AUTO_HERMES_SELF_LOOP.json` has `selfExecutionContract == "claude-self-executing"` | not claude-self-executing |
| Protocol present | `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md` contains `## Claude Self-Loop Protocol (Active Execution)`, `claude-execute-round`, and `Browser Harness Skill` | missing |

**On failure:** apply the minimal targeted fix to restore the previous working state. This gate authorizes self-repair of the Ralph mechanism. Record as `ralph-integrity-fix: <what>` in round-close evidence.

## Round Execution

### Step 1 — Read the task

Read `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md` plus `.ai-sync/AUTO_HERMES_CONTROLLER.json` for subagent plan, route, and knowledge pack. Note the surface (frontend / backend / cross-stack / docs-only), the owned files, and the verification command.

### Step 2 — Assemble the team

Pick the team roster from the task surface using this decision table. The coordinator never picks an "all roles" team — only the roles that match the work.

| Surface signal | Required roles | Optional roles |
|---|---|---|
| Frontend-only UI/CSS/i18n change | `frontend` (frontend-agent), `reviewer` (reviewer-agent) | `tests` (test-writer), `code-reviewer` (code-reviewer) |
| Backend-only Spring/JPA change | `backend` (backend-agent), `reviewer` (reviewer-agent) | `tests` (test-writer), `security` (security-auditor) |
| Cross-stack feature | `frontend` (frontend-agent), `backend` (backend-agent), `reviewer` (reviewer-agent) | `tests` (test-writer), `code-reviewer`, `security` |
| Bug with unknown cause | `debugger` (debugger), then surface-specific implementer, then `reviewer` | `tests` |
| Docs / runbook only | `doc-writer` (doc-writer), `reviewer` | — |
| Refactor without behaviour change | surface implementer, `refactorer`, `reviewer`, `tests` | — |
| Browser-visible quality work | surface implementer, `customer` (customer-agent), `reviewer` | `tests` |
| Security-sensitive surface (auth, OAuth, billing, webhooks, admin) | surface implementer, `security` (security-auditor) is mandatory, `reviewer` | `tests`, `code-reviewer` |

**Sequencing rules:**
- `frontend` and `backend` run in parallel only when their owned-file sets are disjoint.
- `tests` runs alongside the implementer when test files don't collide; otherwise after.
- `code-reviewer`, `QA Agent`, `security`, `reviewer` are **sequential-only** — they read finished code. `reviewer` always runs last.
- `debugger` runs first when the cause is unknown; once it pins the cause, hand off to the implementer.
- `customer` runs after implementation, before `reviewer`, for runner-facing changes.

**Codex prohibition:** never call Codex, codex-local, or Codex subagents from inside this loop.

**Frontend design skill stack** (mandatory when the surface is `Frontend-only UI/CSS/i18n change`, `Cross-stack feature` with UI delta, or `Browser-visible quality work`).

Apply the skills below in authority order — earlier skills override later skills when they disagree.

1. **`frontend-design` (Hermes baseline; always fires first for any UI change).** Apply at the PM lock step before the `frontend` lane writes any UI. This is the Hermes design-system source-of-truth: design tokens (`--accent-coral`, `--surface-1`, `--text-strong`, radius / spacing tokens), coach-voice copy rules, mobile-first at ≤390px, and the page-structure conventions already shipped on `Today Run`, `Profile`, `Analysis`. Source: `.claude/skills/frontend-design/SKILL.md`. Authority: highest after the live approved surface — never contradict its tokens or coach-voice rules.

2. **`taste-skill` (senior UI/UX engineer baseline).** Apply when the round needs a quality floor — strict component architecture, CSS hardware acceleration, metric-based layout rules. Default Taste skill. Shapes structure where `frontend-design` shapes tokens + voice.

3. **`ui-ux-pro-max` (design intelligence library).** Apply at the PM lock when the round (1) starts a new surface, component, or page, (2) refactors visual structure, (3) chooses or revisits a color/typography system for a runner-facing route, or (4) needs an industry-tailored design baseline. Pull only surface-relevant slices (palette, type pair, interaction patterns). Authority order is strict: current live Hermes surface → explicit user reference → `design.md` → `frontend-design` → `taste-skill` → `ui-ux-pro-max` recommendations. The skill never overrides an approved layout. If the skill suggests a stack switch (Tailwind, shadcn), discard — Hermes stack is React 19 + plain CSS, fixed.

4. **`vercel-react-best-practices` (React 19 perf).** Apply during the Builder phase when the round writes or reviews `frontend/src/**` React code — rerender bugs, hydration issues, bundle-shape, memoization. Translate any Next.js-only advice to the Vite stack.

5. **`accesslint` (a11y review).** Apply when the round adds or changes any interactive surface (form, modal, menu, keyboard control, icon-only button, image, focusable region). Run on changed JSX before the reviewer lane. WCAG defects = must-fix; missing labels and keyboard traps are not soft-signals.

6. **`impeccable` (polish / anti-pattern audit).** Apply *after* the implementer reports done and *before* the reviewer lane. Run `npx impeccable detect frontend/src/<surface-glob>` or `/impeccable audit <surface>` (when the local bundle is installed). Treat output as `soft-signal`: cherry-pick anti-pattern hits (purple gradient, nested card, gray-on-color, default font stack, hollow motion) that match the touched surface; route accessibility hits to `accesslint`, color/spacing hits to the design-token gate, UX-writing hits to `translation-sync` + coach-voice review. Do not let Impeccable findings block a round on their own — they feed the reviewer, not replace it.

**Explicit-call-only Taste sub-skills.** These never auto-fire. Apply ONLY when the user directly names the skill or asks for that visual style: `taste-soft` (agency look), `taste-minimalist` (clean editorial), `taste-brutalist` (Swiss + military terminal), `taste-redesign` (premium upgrade of existing surface), `taste-image-to-code` (match this reference), `taste-stitch` (DESIGN.md spec), `taste-output` (full file no truncation), `taste-gpt` (GSAP-heavy motion). Default Taste skill is `taste-skill`. Never auto-stack multiple Taste sub-skills on the same round.

### Step 3 — Open the Teamwork Board

Initialize `.ai-sync/TEAMWORK.md` with the round metadata and the chosen roster:

```bash
node .tools/auto-hermes-teamwork.mjs init \
  --round "<round-id from AUTO_HERMES_SELF_LOOP.json>" \
  --goal "<one-line goal from coordinator brief>" \
  --team "frontend:frontend-agent,backend:backend-agent,reviewer:reviewer-agent" \
  --owned "frontend=frontend/src/X.jsx||frontend/src/style.css;backend=backend/src/main/java/Y.java"
```

The team list mirrors the surface decision table. The owned-files map declares which files each role may touch — overlap creates a parallel-safety violation.

### Step 4 — Dispatch the team

Spawn child agents via the `Agent` tool. Every dispatched lane prompt **must** include this teamwork preamble before its specific work brief:

> Before you start: read `.ai-sync/TEAMWORK.md` to see what siblings are doing and what's blocking them. As you work, run:
> - `node .tools/auto-hermes-teamwork.mjs status --role <your-role> --state running --now "<one-line current action>" --next "<one-line next step>" --blockers "<text or 'none'>"` when you start and whenever your state, current action, next step, or blockers change.
> - `node .tools/auto-hermes-teamwork.mjs append --role <your-role> --note "<short bulletin entry>"` for handoff notes other agents need to read (e.g. "API contract is `{waypoints:[{lat,lng}]}`", "blocked on backend payload shape", "done — packet at <path>").
> - When finished, run `status` once more with `--state done` (or `failed`/`blocked`) and `append` a final `done — <result summary>` note.
>
> Stay strictly inside your owned files (`<list>`). If you need a sibling's output, append a blocker note instead of touching their files.

Parallel-safe roles dispatch in a single message with multiple Agent blocks (`run_in_background: true` when independent). Sequential gates wait for the prior wave.

If the Agent tool is unavailable, the parent executes the same role cards sequentially in-process and the parent itself runs the `status` / `append` commands on each role's behalf.

### Step 5 — Collect and merge

Wait for each agent to complete. Read its result packet, then run a coordinator `append` describing the outcome:

```bash
node .tools/auto-hermes-teamwork.mjs append --role coordinator \
  --note "<role> finished — changed <N> files; verification: <pass|fail>"
```

Failures or reviewer must-fix items become a fresh implementation lane in the same round (dispatched with the same teamwork preamble). Do not patch failures from the coordinator directly.

### Step 6 — Verify

Run the task `Verify:` command. Frontend changes require frontend runtime proof gate (`run-vite-build.mjs` + `verify-frontend-runtime-sync.mjs`). Backend changes require backend runtime proof gate. Capture the output as evidence.

### Step 7 — Browser Harness proof (silent, single-tab)

For browser-visible frontend routes, console issues, or Leaflet/OpenStreetMap surfaces, **always use the Hermes wrapper `.tools/auto-hermes-browser.mjs`** instead of raw `browser-harness -c '...'` invocations. The wrapper enforces two invariants the raw CLI does not:

1. **Exactly one Hermes tab.** It scans `Target.getTargets`, closes every duplicate Hermes tab from prior rounds, and reuses the survivor. Round 50 does not leave 50 stale `localhost:8080` tabs.
2. **No focus stealing.** It never calls `Target.activateTarget` or `Page.bringToFront`. A new tab, when needed, is created with `Target.createTarget` `background:true`. Screenshots, JS evaluation, and navigation all flow through an attached CDP session, so the user's foreground work is not interrupted.

Required subcommands per round:

```bash
# 1. Consolidate stale tabs (run once at the start of a browser-proof step).
node .tools/auto-hermes-browser.mjs cleanup

# 2. Navigate the single Hermes tab.
node .tools/auto-hermes-browser.mjs goto --url http://localhost:8080/<route> --wait-ms 12000

# 3. Inspect — evaluate arbitrary JS to verify DOM, route, console state.
node .tools/auto-hermes-browser.mjs eval --js "JSON.stringify({url:location.href,h1:document.querySelector('h1')?.innerText,errors:window.__hermesConsoleErrors?.length||0})"

# 4. Screenshot (JPEG by default — payload small enough to clear CDP socket timeout).
node .tools/auto-hermes-browser.mjs screenshot --out task-images/<lane>-<route>.jpg
```

Direct `browser-harness -c '...'` is permitted only when the wrapper cannot express the action (e.g. multi-step network interception). When falling back to the raw CLI, you must still observe the single-tab + no-`activateTarget` rules manually.

#### Alternative — Microsoft Playwright (`.tools/auto-hermes-playwright.mjs`)

A second wrapper, [`.tools/auto-hermes-playwright.mjs`](.tools/auto-hermes-playwright.mjs), drives a managed headless Chromium via [Microsoft Playwright](https://github.com/microsoft/playwright). It mirrors the browser-harness wrapper's subcommand surface (`goto` / `eval` / `screenshot` / `status` / `reset` / `doctor`) so callers can swap implementations without rewriting the proof step.

**Prefer Playwright over browser-harness when:**

- the user is actively using Chrome and the round should not steal their tab focus
- the page needs auth and the round should reuse a persisted login deterministically across rounds (cookies + localStorage are saved under `.ai-sync/playwright-state/<state>/`)
- the round runs unattended / in CI / over SSH without a foreground browser
- a previous round was blocked at a `/login` redirect — sign in once with `--headed`, then every later round inherits the storage

**Stay on browser-harness when:**

- the round needs the user's *existing* Chrome session (logged-in cookies they already have in their real browser)
- the user wants live visible debugging in their normal Chrome window

**One-time install (the wrapper exits with code 3 + instructions until this is done):**

```bash
npm i -D @playwright/test
npx playwright install chromium
node .tools/auto-hermes-playwright.mjs doctor
```

**Round usage (mirrors browser-harness subcommands):**

```bash
# First time on an auth-walled route: run --headed so you can sign in manually,
# state is persisted afterwards.
node .tools/auto-hermes-playwright.mjs goto --url http://localhost:8080/login --headed

# Subsequent calls reuse the persisted login state (headless by default).
node .tools/auto-hermes-playwright.mjs goto --url http://localhost:8080/muscle-training --wait-ms 12000
node .tools/auto-hermes-playwright.mjs eval --js "JSON.stringify({url:location.href,h1:document.querySelector('h1')?.innerText})"
node .tools/auto-hermes-playwright.mjs screenshot --out task-images/<lane>-<route>.jpg
```

Use a different `--state <name>` per role when two parallel lanes need disjoint sessions (e.g. one signed in as the local-shared-runner, one anonymous). State directories under `.ai-sync/playwright-state/` are gitignored and never push.

Both wrappers emit a single JSON line on stdout per call — parse the `ok`, `url`, `consoleErrorCount`, and `out` fields into the round result packet identically regardless of which wrapper produced them.

Capture route URL, console clean/error summary, and screenshot/DOM evidence into the round result packet. If the chosen wrapper is unavailable (browser-harness daemon down, Playwright not installed), try the other wrapper before recording a browser-proof blocker. Never claim browser proof you didn't actually capture. For browser-visible frontend quality work, also load `.tools/auto-hermes-skills.mjs --json` and apply `web-quality-audit` from `https://officialskills.sh/addyosmani/skills/web-quality-audit` (GitHub: `https://github.com/addyosmani/web-quality-skills/tree/main/skills/web-quality-audit`): performance, accessibility, SEO, best practices, browser proof, console state, and Lighthouse-style observations.

### Step 8 — Close the board

After verification passes (or fails), close the teamwork board:

```bash
node .tools/auto-hermes-teamwork.mjs close \
  --verdict <approved|must-fix|blocked> \
  --commits "<comma-separated short hashes if committed>" \
  --notes "<one-line summary of round outcome>"
```

### Step 9 — Round-close writeback

```bash
node .tools/auto-hermes-round-close.mjs --write --agent claude \
  --task "<title>" --surface "<surface>" --owner "<owner>" \
  --files "<f1>||<f2>" --verify "<verify>" \
  --verify-result pass --architect-verdict approved \
  --deslop-pass pass --regression-pass pass --verdict pass
```

Failure: `--verdict fail --blocker "<reason>"`. Run agent-sync finish to release the claim. GitHub issue source: `node .tools/auto-hermes-issues.mjs --close <N> --comment "Fixed by auto-hermes."` and `(closes #N)` in the commit message.

### Step 10 — Post-round integrity fix

Runs only if the pre-round gate failed. Re-verify scripts parse, contract remains `claude-self-executing`, and protocol remains present in the coordinator brief. Record as `ralph-integrity-fix: <files> - <what>`. Mandatory before re-entering.

### Step 11 — Re-enter or stop

Refresh with `node .tools/auto-hermes-self-loop.mjs --write --runtime claude`. Read `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md`. `claude-execute-round` means return to step 1 immediately with no user wait — and **init a fresh teamwork board** for the new round. `stop` means Auto-Publish.

## Auto-Publish On Stop

When the loop exhausts work, push and open a PR automatically.

1. On Windows local: `powershell -File .tools/auto-commit.ps1 -Message "auto-hermes: $(git log -1 --format=%s)"`. On Linux / macOS / CI: stage product files explicitly (per CLAUDE.md auto-commit checklist) and run `git commit -m "auto-hermes: $(git log -1 --format=%s)"`.
2. `node .tools/auto-hermes-push-main.mjs --execute --write --message "auto-hermes: round complete"`
3. Report: `Loop stopped - [reason]. PR open at <url>. Review and squash-merge on GitHub.`

Push-main blocked means report the blocker and stop. `gh` CLI missing means report `PR creation skipped - install and authenticate gh CLI.` No product changes means skip PR step and report `no product changes to publish.`

## CI Mode (GitHub Actions / `GITHUB_ACTIONS=true`)

`/auto-hermes-self` is runnable inside a GitHub Actions workflow via [`.github/workflows/auto-hermes-self.yml`](../../.github/workflows/auto-hermes-self.yml). When `process.env.GITHUB_ACTIONS === "true"` (or `process.env.CI === "true"`), the protocol changes in five places — every other rule above still applies.

- **Round cap is mandatory.** Honour `AHS_MAX_ROUNDS` (env var). Default `3` when unset. Treat `AHS_MAX_ROUNDS` as a hard ceiling — when the counter is reached, drop to Auto-Publish-on-Stop even if the queue is not empty.
- **Wall-clock cap is mandatory.** Honour `AHS_MAX_MINUTES` (env var). Default `30` when unset. When wall-clock exceeds the cap mid-round, finish the current round-close then stop.
- **Browser proof must be headless.** `browser-harness` and `.tools/auto-hermes-browser.mjs` require the user's running Chrome and are unavailable in CI. Use [`.tools/auto-hermes-playwright.mjs`](../../.tools/auto-hermes-playwright.mjs) exclusively. Persistent state goes under `.ai-sync/playwright-state/ci/` and is uploaded as a workflow artifact for inspection.
- **No `ScheduleWakeup` re-entry.** CI cannot resume in a fresh context — the job is a single invocation. When token pressure is high, finish the current round-close and stop with reason `ci-context-pressure-stop`. Re-trigger the workflow manually for the next batch.
- **HUMAN_LOOP is a hard stop, not a pause.** CI cannot ask for input. Treat `pause`, `stop`, and `must-ask` identically: round-close with `--verdict fail --blocker "human-gate-fired"` and stop without Auto-Publish.

### CI Auto-Publish steps (bash, no PowerShell required)

```bash
# 1. Stage only intended product files (the auto-commit checklist in CLAUDE.md applies).
git add <specific changed paths>

# 2. Commit with the round summary.
git commit -m "auto-hermes-self: round complete (ci)"

# 3. Push the branch and open a PR.
node .tools/auto-hermes-push-main.mjs --execute --write --message "auto-hermes: round complete"
```

The push step requires the workflow to have `permissions: { contents: write, pull-requests: write }` and to expose either `GITHUB_TOKEN` or a PAT in `GH_TOKEN` so `auto-hermes-push-main.mjs` can authenticate `gh` for the PR creation.

### CI inputs (read from `workflow_dispatch` inputs, mapped to env)

| Input | Env var | Default | Meaning |
|---|---|---|---|
| `scope` | `AHS_SCOPE` | _(empty)_ | Concrete task scope. Empty = self-loop on the existing queue. |
| `max_rounds` | `AHS_MAX_ROUNDS` | `3` | Hard ceiling on rounds per workflow invocation. |
| `max_minutes` | `AHS_MAX_MINUTES` | `30` | Hard ceiling on wall-clock minutes. |
| `target_branch` | `AHS_TARGET_BRANCH` | current branch | Branch to push to + open PR against. |
| `dry_run` | `AHS_DRY_RUN` | `false` | When `true`, skip Auto-Publish (no push, no PR) — useful for smoke-testing the workflow. |

If `AHS_SCOPE` is set, treat it exactly like a concrete-task argument to `/auto-hermes-self`. If empty, fall through to the existing queue-driven self-loop.

## Context-Pressure Self-Re-Entry

Approaching token limits mid-loop: after current round-close, call `ScheduleWakeup({ delaySeconds: 60, prompt: "/auto-hermes-self", reason: "Ralph loop re-entry after round N" })`. Preserves work, resumes in fresh context. Not an excuse to stop early, only for genuine pressure.

**In CI:** `ScheduleWakeup` is unavailable. See **CI Mode** above — finish the current round-close and stop with reason `ci-context-pressure-stop`. The next workflow invocation continues from the queue state on disk.

## Team Model

- **Coordinator:** parent Claude session assembles the team, opens + closes the teamwork board, dispatches, merges, runs gates, and round-closes. Never implements.
- **Specialists:** frontend-agent, backend-agent, Dev Agent, code-reviewer, QA Agent, debugger, planning-agent, reviewer-agent, test-writer, security-auditor, refactorer, doc-writer, customer-agent.
- **Parallel-ok:** frontend-agent, backend-agent, and test-writer when ownership is disjoint and no cross-dependencies exist.
- **Sequential-only:** code-reviewer, QA Agent, and security-auditor must see finished code. reviewer-agent always runs last.
- **Browser Harness:** frontend/browser-visible lanes must include Browser Harness proof when routes, console behavior, or map/Leaflet/OpenStreetMap surfaces change.
- **Fallback:** Agent tool unavailable means parent executes sequentially with specialist role cards in-process; parent still maintains the teamwork board on each role's behalf.
- **Codex prohibition:** never call Codex, codex-local, or Codex subagents.

## Teamwork Bulletin Contract

`.ai-sync/TEAMWORK.md` is the single source of truth for "what's happening and what's next" inside a round.

- **Coordinator obligations:** init at round start, append on every dispatch + collect, close at round end with the verdict.
- **Specialist obligations:** read on start, post `status running` immediately, append a bulletin note for any decision or blocker that another role needs to know, post `status done` (or `failed` / `blocked`) at the end with a one-line summary.
- **Conflict avoidance:** if two roles need the same file, the second role blocks via `append` instead of touching the file — coordinator decides whether to serialize them or rescope.
- **Atomicity:** `auto-hermes-teamwork.mjs` uses a `.lock` file with retries so concurrent calls from parallel agents are safe.
- **Lifecycle:** the board is rewritten at the start of every round (`init`) — it is not a long-running log. Long-running coordination lives in `.ai-sync/AGENT_SYNC.md`.

## Stop Gates
HUMAN_LOOP says pause/stop/must-ask; controller `Next Action: stop` after queue exhaustion plus website-audit no-candidate; same work unit repeats 3x without new evidence; executor unavailable after retries; unsafe or irreversible recovery requires human input.

## Round Completion Evidence
Required before round-close: `verify-result pass`, `runtime-proof pass` for live surfaces, Browser Harness proof for browser-visible frontend changes, `web-quality-audit` evidence when frontend/browser quality is in scope, `architect-verdict approved`, `deslop-pass pass` or explicit skip, `regression-pass pass`, **teamwork board closed with a non-empty `## Round Close` section**, and round-close writeback.

## Key Artifacts
- `.ai-sync/TEAMWORK.md` — round-scoped team bulletin; init/status/append/close via `.tools/auto-hermes-teamwork.mjs`.
- `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md` - coordinator brief; Next Action drives loop.
- `.ai-sync/AUTO_HERMES_SELF_NEXT_PROMPT.md` - worker prompt for current round.
- `.ai-sync/AUTO_HERMES_CONTROLLER.json` - full routing, subagent plan, and knowledge pack.
- `.ai-sync/AUTO_HERMES_SELF_LOOP.json` / `_LOOP_STATE.json` - loop state.

A single bounded round is never natural completion. Keep executing until a real stop fires.
