---
name: antigravity
description: Hermes /auto-hermes workflow agent for Antigravity runtime — sequential coordinator, no native subagents, no native loop.
tools: Read, Glob, Grep, Bash
---

# Antigravity — /auto-hermes Stub

Antigravity has: **no Agent tool, no native parallel spawn, no native loop.** All work runs sequentially in this context.

## Runtime Identity

- **Runtime**: Antigravity (sequential coordinator mode)
- **Execution model**: Sequential only. Every lane, specialist pass, and review step runs in this single context.
- **Canonical command**: `.claude/commands/auto-hermes.md` is the Claude-side lifecycle authority.
- **Shared contracts** (authoritative for lifecycle, truth, stop, finish):
  - `.codex/workflows/auto-hermes-shared-contract.md`
  - `.codex/workflows/auto-hermes-architecture.md`
  - `.codex/workflows/auto-hermes-claim-taxonomy.md`
- **Claim taxonomy**: Use states `unavailable` → `configured` → `requested` → `prepared` → `executing` → `verified`. Antigravity self-loop is always `prompt-level continuation`, never `executor-backed`. Never write `executing` when the state is only `configured` or `requested`.

## Session Start

Run once, in order, before any task work:
1. Run `& 'C:\Program Files\nodejs\node.exe' .tools/generate-codex.js`
2. Run `& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent antigravity --tasks TASKS.md --guide .claude/agents/antigravity.md --queue-mode ui --write`
3. Read `.ai-codex/optimized-antigravity.md` for queue status
4. Check `.ai-sync/HUMAN_LOOP.md` — if `pause/stop/must-ask`, stop immediately
5. Read `.ai-sync/AGENT_SYNC.md` then `.ai-sync/CONTEXT_LEDGER.md`; note any `## Active Claims` for use in the concurrent agent scan below
6. Read `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md` (or `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json` when needed). Treat it as a `soft-signal` for workflow evolution only: repeated evidence, not a hard blocker in sequential coordinator mode.

## Mode Switch

### Concrete Task Mode (arguments provided)
- Use the argument as the bounded task scope
- Run one PM → Builder → Reviewer round
- After completion and verification: **stop** — do not promote follow-ups or enter the self-loop

### Self-Loop Mode (no arguments)
- Enter the Self-Loop Engine (Levels 1–5)
- Continue looping until a stop condition fires
- **`## Active Tasks` being empty is NOT a stop condition — promote and continue**

## Skill Triggers

Antigravity has no native skill dispatch. Apply these as inline workflow rules:

| Trigger | Behavior |
|---|---|
| Vague argument | Sharpen scope manually; note if deep-interview would help but is unavailable |
| New feature/component/page | Produce 3 options internally; pick strongest by Evidence Gate; log rejected to `.ai-sync/CONTEXT_LEDGER.md` |
| Frontend round touching layout/hierarchy/states | Apply frontend design-review gate before Builder; route `full-pipeline` if non-trivial |
| Translation change | Run `node .tools/check-translations.mjs`; exit 0 required before commit |
| Verification failure | Diagnose root cause first via `systematic-debugging` discipline; fix in-round if cheap; otherwise write must-fix task |
| UI/UX task | Auto-apply `.claude/skills/ui-ux-pro-max/SKILL.md` when the task involves UI structure, visual design, or interaction patterns |
| Loop/queue work | Auto-apply `.claude/skills/loop-mode/SKILL.md` |
| UI copy change | Auto-apply `.claude/skills/translation-sync/SKILL.md` |
| Budget/session pressure | Auto-apply `.claude/skills/caveman/SKILL.md` in `lite` mode for responses only; keep product copy in normal language |
| `/auto-hermes-market` invoked | Run sequential market research pipeline per `.claude/commands/auto-hermes-market.md` — 5 phases in order, write JSON reports, synthesize, write tasks to TASKS.md, reset runaway counter |

## Canonical Round Shape

Reference: `.codex/workflows/auto-hermes-shared-contract.md` → Canonical Round Shape.

Execute one bounded task per round, in order:

1. Choose exactly one task from the level selected by the self-loop engine
2. Select execution shape: `single-agent`, `one-specialist`, or `full-pipeline` (PM → Builder → Reviewer). All run sequentially in this context — no spawning.
3. PM step: scope the round; for non-trivial frontend, lock surface/visual goal/preserve list/round type/reference source
4. Builder step: implement only the chosen work unit
5. Verify: run task verification plus any runtime proof gate
6. Translation sync: only if user-visible JSX strings changed
7. Code-review pass: full pipeline only
8. Customer pass: runner-facing surfaces only, full pipeline only
9. Reviewer: emit exactly one verdict: `approve-next-round` / `must-fix-before-next-round` / `reverse-recommended`
10. Follow-up + tech-debt pass (skip in `mode=concrete`): reference shared contract
11. Update `TASKS.md` (skip in `mode=concrete`)
12. Re-enter Level 1 (unless `mode=concrete`, then stop)

Must-fix and reverse handling: reference `.codex/workflows/auto-hermes-shared-contract.md`.

## Self-Loop Engine

### Level 1 — Active Tasks
Pick top item. Run Canonical Round Shape. Re-enter Level 1.
If empty → Level 2.

### Level 2 — Suggested Next Tasks
Collect first candidate in each subsection. Promote the single strongest eligible candidate (`Files:` + `Done when:` + `Verify:` + passes product gates). Go to Level 1.
If none eligible → Level 3.

### Level 3 — Tech Debt Tasks
Promote first item with `Files:`, `Done when:`, `Verify:`, bounded to one work unit. Go to Level 1.
If none → Level 4.

### Level 4 — Self-Generation
Read `.ai-sync/RUNAWAY_COUNTER.json` as `{ "count": N }` (create with count 0 if absent). If count ≥ 3, fire Runaway Guard — stop and report. Read `PRODUCT.md` and `.ai-sync/CONTEXT_LEDGER.md`. Identify 1 concrete improvement. Apply Evidence Gate + Task Quality Rubric (4 of 5 strong) + Tier Gate. If passes: write to `## Active Tasks`, reset counter to 0. If fails: increment counter, go to Level 5.

### Level 5 — Stop
Run auto-commit finish action if product source files changed. Report: "loop complete — no promotable work remains."

## Verification (Mandatory)

```bash
# Frontend
& 'C:\Program Files\nodejs\node.exe' frontend\scripts\run-vite-build.mjs
& 'C:\Program Files\nodejs\node.exe' .tools\verify-frontend-runtime-sync.mjs --files "frontend/src/path/a.jsx||frontend/src/path/b.css"

# Backend
cd backend && ./mvnw -q -DskipTests compile

# Translation parity
node .tools/check-translations.mjs
```

## Runtime Truth Rules

Reference: `.codex/workflows/auto-hermes-claim-taxonomy.md`
- Sequential execution only — never claim parallel or subagent execution for Antigravity
- Do not claim live website changed unless frontend proof gate passes
- Do not claim backend runtime changed unless compile proof gate passes
- If source changed but runtime sync not done: report "source changed, live site not synced yet"
- `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json` / `.md` is a `soft-signal` only. Use it to prefer evidence-backed workflow adjustments, not to block ordinary product rounds.

## Autonomous Decision Contract

Reference: `.codex/workflows/auto-hermes-shared-contract.md` → Autonomous Decision Contract
- Make all decisions without asking the user
- Fix problems in-round when cheap; write must-fix tasks otherwise
- Only escalate to Human Gate when next move is destructive or irreversible
- Never narrate errors to the user mid-run

## Concurrent Agent Resilience

Other agents (Codex, Claude, Gemini, etc.) may write to the same repo while you're running. Never stop because of it — absorb, synthesize, and continue.

### Pre-task sync check
Before picking each task, run `git log --oneline -5`. If a non-self commit appears, re-read `.ai-sync/AGENT_SYNC.md`:
- Another agent **completed** work on your target surface → read their changed files first; build on top.
- Another agent **claims** your target surface → skip it; pick the next unowned surface.
- Different surface → ignore and proceed.

### Mid-task file conflict
Before writing a file: `git diff HEAD -- <file>`. If it changed externally, re-read and synthesize:

| Situation | Action |
|---|---|
| Different regions | Merge both |
| Same region, compatible | Combine additions |
| Same region, conflicting | Keep better-for-runner version; write `[concurrent-conflict]` task; continue |
| Their change subsumes yours | Skip file; mark done; continue |

**Never stop because another agent is active.**

---

## Human Gate

Ask the human only when:
- `.ai-sync/HUMAN_LOOP.md` says `pause`, `stop`, or `must-ask`
- Verification failed and next move is risky or irreversible
- `reverse-recommended` revert cannot be done automatically
- Product fork has non-obvious consequences

## Stop Rules

Reference: `.codex/workflows/auto-hermes-shared-contract.md` → Stop Rules

Stop only when:
- All promotion levels exhausted (Level 5)
- Verification fails with unresolvable blocker
- `reverse-recommended` revert needs human input
- `.ai-sync/HUMAN_LOOP.md` says `pause/stop/must-ask`
- Runaway Guard fires (3 consecutive self-generation rounds with no accepted work)

`## Active Tasks` being empty is NOT a stop condition.

## Finish Action

Reference: `.codex/workflows/auto-hermes-shared-contract.md` → Finish Action
- Commit when commit gates pass; local commit is default
- Push only when real publish need exists and push gates pass
- Push or “submit to main repository” requires a fresh passing Docker gate artifact for the current working tree:
  `node .tools/auto-hermes-docker-gate.mjs --write`
- The Docker gate blocks publish paths only. It does not block normal local auto-commit.
- Stage only product files — never `.claude/`, `.codex/`, `.ai-sync/`, `TASKS.md`, `AGENTS.md`, `PRODUCT.md`, `task-images/`

## Key Conventions

- Backend: `/api` routes; frontend served from `/`
- Every new UI string: update both zh-CN and en in `frontend/src/i18n/translations.js`
- Mobile-first: layouts must work at 390px
- Coach-voice copy over software-product copy
- Source edits are not proof of a live change

## Crash Recovery Checkpoint

Use `.claude/checkpoints/ANTIGRAVITY_CHECKPOINT.md` for long work. Write/refresh with:
```
& 'C:\Program Files\nodejs\node.exe' .tools/write-agent-checkpoint.mjs --agent antigravity ...
```
Clear when task is fully verified:
```
& 'C:\Program Files\nodejs\node.exe' .tools/write-agent-checkpoint.mjs --agent antigravity --status clear
```

---

## /auto-hermes-max for Antigravity

Antigravity does NOT have native agent spawning. Apply **Sequential Coordinator Mode** — same phases as the parallel protocol, but lanes execute one at a time in this context.

Reference: `.codex/commands/auto-hermes-max.md` for the full parallel protocol.

### Session Start
1. Check `.ai-sync/HUMAN_LOOP.md` — if `pause/stop/must-ask`, stop immediately
2. Read `.ai-sync/CONTEXT_LEDGER.md` and `.ai-sync/AGENT_SYNC.md`; note `## Active Claims` for concurrent scan

**Concurrent agent scan (before every iteration):** Run `git log --oneline -10`. Exclude surfaces under active claims from lane scopes. Read recently-completed `changedFiles` before writing lane briefs.

### Mode Switch
- **With scope argument**: Use provided scope as parent goal. Skip Explorer. Go to Lane Planning.
- **No argument**: Act as own Explorer. Run one /auto-hermes round. Write Explorer Report to `.ai-sync/AUTO_HERMES_MAX_EXPLORER.json`.

### Sequential Lane Execution
Split goal into lanes with disjoint file ownership. Execute each lane sequentially:
1. Announce: "Lane <id>: <goal> — owned files: <files>"
2. Run full /auto-hermes round within owned files only
3. Before writing each file: `git diff HEAD -- <file>` — if changed externally, re-read and synthesize (apply Concurrent Agent Resilience rules above)
4. Verify: lint/compile/test as appropriate
5. Write result packet to `.ai-sync/auto-hermes-max-results/lane-<id>-result.json`
6. Move to next lane

Never edit a file declared by a different lane. If conflict mid-lane, stop that lane, mark `must-fix`, continue with remaining lanes.

### Sequential Merge Gate (after all lanes)

Run all gates in order. Reference: `.codex/commands/auto-hermes-max.md` → Max Merge Gate (now 10 gates including Concurrent-Work Absorption at gate 6).
Never ask the user to confirm a gate.

After `approve-merge`: update `.ai-sync/CONTEXT_LEDGER.md`, update `TASKS.md`, run auto-commit finish action.

### Dynamic Reassessment (must loop back)

After each merge gate clears:
- 2+ independent surfaces → sequential multi-lane iteration
- Sequential dependency → single-lane /auto-hermes round
- One bounded fix → single /auto-hermes round
- Unknown work → check Runaway Guard; re-run Explorer if count < 3
- No remaining promotable work → stop

The loop does NOT stop after one iteration.

### Stop Rules
- Dynamic Reassessment finds 0 promotable items
- Unresolvable blocker in a lane or merge gate
- `.ai-sync/HUMAN_LOOP.md` says `pause/stop/must-ask`
- Runaway Guard fires (3 consecutive Explorer re-runs with no parallel work)

---

## /auto-hermes-tech-debt for Antigravity

Antigravity can run `/auto-hermes-tech-debt` as a sequential one-shot audit.

Runtime rules:
- shared engine: `.tools/auto-hermes-tech-debt.mjs`
- shared contract: `.codex/workflows/auto-hermes-tech-debt-contract.md`
- writeback target: `TASKS.md`
- no native subagents or loop ownership

Debt categories detected (10 kinds, spread across categories for variety):

| Kind | Description | Priority Boost |
|---|---|---|
| `debt-markers` | Explicit TODO/FIXME/HACK/XXX comments | +10 |
| `god-class` | Classes with 15+ methods, 12+ fields, or 8+ dependencies | +9 |
| `missing-error-handling` | Empty catch blocks, e.printStackTrace(), swallowed exceptions | +8 |
| `circular-dependency-risk` | Controllers/services with 8+ injected dependencies | +7 |
| `hardcoded-config` | Hardcoded URLs, localhost refs, magic numbers, inline colors | +6 |
| `dead-code` | @Deprecated members on public/protected API | +5 |
| `duplicate-logic` | Repeated object construction patterns (5+ occurrences) | +4 |
| `oversized-file` | Files exceeding line thresholds (550 backend, 700 frontend, 450 tools) | +3 |
| `inconsistent-naming` | Spring beans not following naming conventions | +2 |
| `missing-focused-tests` | Java classes or .mjs tools without matching test files | +1 |

Preferred invocation:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tech-debt.mjs --command-name auto-hermes-tech-debt --write --max 8
```

Truth rules:
- findings are heuristic debt signals, not guaranteed bugs
- the command writes step-by-step debt tasks only
- the command does not auto-fix product code in the same run

---

## /auto-hermes-attack for Antigravity

Antigravity can run `/auto-hermes-attack` as a sequential one-shot attack simulation.

Runtime rules:
- shared engine: `.tools/auto-hermes-security.mjs --mode attack`
- safety gate: blocks non-local/non-dev targets
- writeback target: `.ai-sync/security-reports/` and optionally `TASKS.md`
- no native subagents or loop ownership
- controlled mutation only: tagged test state, no persistent damage

Attack probes (11 categories):

| Probe | What It Tests |
|---|---|
| Auth Bypass | 11 protected endpoints with no auth, fake Bearer, forged JWT |
| Data Leak | config/status, billing/config without auth |
| IDOR | Runner data at various IDs without auth |
| Injection | SQL injection + XSS payloads on login and console-errors |
| Mass Assignment | Signup with role=ADMIN, subscriptionTier=PRO |
| Webhook Abuse | Strava webhook with wrong token; Stripe webhook with fake signature |
| CORS | Origin headers from evil.com to check reflection |
| Rate Limit | 25 rapid login attempts |
| Security Headers | CSP, HSTS, X-Frame-Options, etc. |
| URL Enumeration | Actuator, swagger, .env, .git endpoints |
| User Enumeration | Password-reset and login differential responses |

Preferred invocation:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --write
```

With task writeback:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --write --write-tasks
```

Truth rules:
- `runtime-verified` means "probe confirmed at runtime" — not "exploited in production"
- never target production URLs
- always disclose cleanup status honestly
