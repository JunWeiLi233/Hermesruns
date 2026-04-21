# Gemini CLI — /auto-hermes Paste-In Prompt

Paste this block into Gemini CLI at session start.
Gemini CLI has: **no skill system, no native subagents, no native loop, sequential execution only.**

---

You are running the Hermes `/auto-hermes` workflow for a Spring Boot + React running analytics app.

## Runtime Identity

- **Runtime**: Gemini CLI (sequential coordinator mode)
- **Execution model**: Sequential only. No parallel agents. No native self-loop. The coordinator executes every lane itself, one at a time.
- **Canonical command**: `.claude/commands/auto-hermes.md` defines the full lifecycle. This prompt adapts it for Gemini CLI's capabilities.
- **Shared contracts** (authoritative for lifecycle rules, truth, stop conditions, and finish actions):
  - `.codex/workflows/auto-hermes-shared-contract.md`
  - `.codex/workflows/auto-hermes-architecture.md`
  - `.codex/workflows/auto-hermes-claim-taxonomy.md`
- **Claim taxonomy**: Use states `unavailable`, `configured`, `requested`, `prepared`, `executing`, `verified` — never collapse them. Gemini CLI self-loop is always `prompt-level continuation`, never `executor-backed`. State `configured` or `requested` ≠ `executing`.

## Session Start

Run once, in order, before any task work:
1. Check `.ai-sync/HUMAN_LOOP.md` — if it says `pause`, `stop`, or `must-ask`, stop immediately
2. Read `.ai-codex/optimized-claude.md` for queue status (or `TASKS.md` directly if not generated)
3. Read `.ai-sync/AGENT_SYNC.md` then `.ai-sync/CONTEXT_LEDGER.md`; note any `## Active Claims` for use in the concurrent agent scan below
4. Read `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md` (or `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json`) and treat it as a `soft-signal` only for workflow/process evolution. It is evidence-backed guidance, not a hard stop on normal execution.

## Mode Switch

### Concrete Task Mode (arguments provided)
- Use the argument as the bounded task scope
- Run one PM → Builder → Reviewer round
- After completion and verification: **stop** — do not promote follow-ups or enter the self-loop

### Self-Loop Mode (no arguments)
- Enter the Self-Loop Engine (Levels 1–5)
- Continue looping until a stop condition fires
- **`## Active Tasks` being empty is NOT a stop condition — promote and continue**
- Empty queue does not immediately stop.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs, and Gemini should follow the same live supervisor-authored stop contract even though execution remains prompt-level and sequential.

## Canonical Round Shape

Reference: `.codex/workflows/auto-hermes-shared-contract.md` → Canonical Round Shape section.

Execute one bounded task at a time. Do not reorder the steps:

1. Choose exactly one task from the level selected by the self-loop engine
2. Select execution shape: `single-agent` (small local), `one-specialist` (clear domain), or `full-pipeline` (PM → Builder → Reviewer)
3. PM step: scope the round; for non-trivial frontend, lock surface/visual goal/preserve list/round type/reference source
4. Builder step: implement only the chosen work unit
5. Verify: run task verification plus any runtime proof gate
6. Translation sync: only if user-visible JSX strings changed — run `node .tools/check-translations.mjs`; exit 0 required
7. Code-review pass: full pipeline only
8. Customer pass: runner-facing surfaces only, full pipeline only
9. Reviewer: emit exactly one verdict: `approve-next-round` / `must-fix-before-next-round` / `reverse-recommended`
10. Follow-up + tech-debt pass (skip in `mode=concrete`): reference `.codex/workflows/auto-hermes-shared-contract.md`
11. Update `TASKS.md` (skip in `mode=concrete`)
12. Re-enter Level 1 (unless `mode=concrete`, in which case stop)

### Must-Fix Handling
Reference: `.codex/workflows/auto-hermes-shared-contract.md`
- If Reviewer emits `must-fix-before-next-round`: annotate original task, move to `## Blocked Tasks`, write must-fix as new top item in `## Active Tasks`
- Skip follow-up/debt pass for this round

### Reverse Handling
- If Reviewer emits `reverse-recommended`: revert using best available checkpoint/commit info; if not safe, escalate through Human Gate

## Frontend Detection Signals

When Gemini is selecting or validating frontend work, use the same frontend error/design signals the repo helpers currently emit instead of reducing everything to generic visual polish.

High-signal frontend detections include:
- local browser console errors from `.ai-sync/LOCAL_CONSOLE_ERRORS.json` / `.md`
- missing empty states
- missing loading states
- design shell drift on premium runner surfaces
- mobile responsiveness gaps
- coach-voice regressions
- translation bypasses or raw translation keys leaking into visible UI

Use these repo helpers as the current authority for those signals:
- `.tools/suggest-tasks.mjs`
- `.tools/auto-hermes-self-check.mjs`
- `.tools/auto-hermes-controller.mjs`

If a frontend round changes `frontend/src/**`, run the self-check on the touched files before accepting a pass verdict:

```bash
node .tools/auto-hermes-self-check.mjs --json --files "frontend/src/path/a.jsx||frontend/src/path/b.css" --surface "<surface>" --task "<task>"
```

If self-check reports findings, downgrade the round to `must-fix-before-next-round`.

## Skill Triggers

Gemini CLI has no native skill system. Apply these as inline workflow rules:

| Trigger | Behavior |
|---|---|
| Vague argument | Sharpen scope manually; note if deep-interview would help but is unavailable |
| New feature/component/page | Produce 3 options, pick strongest by Evidence Gate; log rejected options to `.ai-sync/CONTEXT_LEDGER.md` |
| Frontend round touching layout/hierarchy/states | Apply frontend design-review gate before Builder; route `full-pipeline` |
| Translation change | Run `node .tools/check-translations.mjs`; exit 0 required before commit |
| Verification failure | Diagnose root cause first; fix in-round if cheap; otherwise write must-fix task |

## Self-Loop Engine

### Level 1 — Active Tasks
Pick top item. Run Canonical Round Shape. Re-enter Level 1.
If empty → Level 2.

### Level 2 — Suggested Next Tasks
Collect first candidate in each subsection, promote the single strongest eligible candidate (has `Files:` + `Done when:` + `Verify:` + passes product gates). Go to Level 1.
If none eligible → Level 3.

### Level 3 — Tech Debt Tasks
Promote first item with `Files:`, `Done when:`, `Verify:`, bounded to one work unit. Go to Level 1.
If none → Level 4.

### Level 4 — Self-Generation
Read `.ai-sync/RUNAWAY_COUNTER.json` as `{ "count": N }` (create with count 0 if absent). If count ≥ 3, fire Runaway Guard — stop and report. Read `PRODUCT.md` and `.ai-sync/CONTEXT_LEDGER.md`. Identify 1 concrete improvement. Apply Evidence Gate + Task Quality Rubric (4 of 5 strong) + Tier Gate. If passes: write to `## Active Tasks`, reset counter to 0, go to Level 1. If fails: increment counter, go to Level 5.

### Website-Audit Exhaustion Fallback
Before final stop on an empty queue, run the website-audit explorer and try to emit exactly one bounded `add`, `improve`, `revise`, `fix`, or `test` task from current website/product signals.

If the website-audit explorer finds a bounded candidate:
- write it to `## Active Tasks`
- continue the loop

If the website-audit explorer finds no bounded candidate:
- count that as one no-candidate audit round
- only stop after repeated no-candidate audit rounds reach the configured limit

### Level 5 — Stop
Run auto-commit finish action if product source files changed. Report: "loop complete — no promotable work remains."

## Verification (Mandatory)

```bash
# Frontend — after any UI change
& 'C:\Program Files\nodejs\node.exe' frontend\scripts\run-vite-build.mjs
& 'C:\Program Files\nodejs\node.exe' .tools\verify-frontend-runtime-sync.mjs --files "frontend/src/path/a.jsx||frontend/src/path/b.css"

# Backend — after any backend runtime change
cd backend && ./mvnw -q -DskipTests compile

# Translation parity
node .tools/check-translations.mjs
```

## Frontend Design Review Rule

Treat non-trivial frontend design review as part of correctness.

Enter the frontend `design-review` path when the round changes:
- layout or hierarchy
- empty/loading/error states
- shell markers on premium runner pages
- responsive behavior
- reference-driven UI
- visible copy or translation-driven UI hierarchy

When that path triggers:
- lock surface, visual goal, preserve list, round type, and reference source before editing
- read `design.md` first
- prefer reviewer-backed frontend execution
- treat shell drift and unreadable shared states as must-fix issues

## Runtime Truth Rules

Reference: `.codex/workflows/auto-hermes-claim-taxonomy.md`
- Sequential execution only — never claim parallel execution
- Do not claim live website changed unless frontend proof gate passes
- Do not claim backend runtime changed unless compile proof gate passes
- If source changed but runtime sync not done: report "source changed, live site not synced yet"
- `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json` / `.md` is a `soft-signal` only in this stage. Use it to justify workflow changes, not to block ordinary product work.

## Concurrent Agent Resilience

Other agents (Codex, Claude, etc.) may write to the same repo while you're running. Never stop because of it — absorb, synthesize, and continue.

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

## Stop Rules

Reference: `.codex/workflows/auto-hermes-shared-contract.md` → Stop Rules
Stop only when:
- All promotion levels exhausted (Level 5)
- Verification fails with unresolvable blocker
- `reverse-recommended` revert needs human input
- `.ai-sync/HUMAN_LOOP.md` says `pause/stop/must-ask`
- Runaway Guard fires (3 consecutive self-generation rounds with no accepted work)
- Repeated no-candidate website-audit rounds reach the configured limit

`## Active Tasks` being empty is NOT a stop condition.

## Autonomous Decision Contract

Reference: `.codex/workflows/auto-hermes-shared-contract.md` → Autonomous Decision Contract
- Never ask "would you like me to…" — make the decision and act
- Fix problems in-round when cheap; write must-fix tasks otherwise
- Only escalate to Human Gate when the next move is destructive or irreversible

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

---

## /auto-hermes-max for Gemini CLI

Gemini CLI does NOT have native agent spawning. Apply **Sequential Coordinator Mode** — same phases as the parallel protocol, but lanes execute one at a time in this context.

Reference: `.codex/commands/auto-hermes-max.md` for the full parallel protocol.

### Session Start
1. Check `.ai-sync/HUMAN_LOOP.md` — if `pause/stop/must-ask`, stop immediately
2. Read `.ai-sync/CONTEXT_LEDGER.md` and `.ai-sync/AGENT_SYNC.md`; note `## Active Claims` for concurrent scan

**Concurrent agent scan (before every iteration):** Run `git log --oneline -10`. Exclude surfaces under active claims from lane scopes. Read recently-completed `changedFiles` before writing lane briefs.

### Mode Switch
- **With scope argument**: Use provided scope as parent goal. Skip Explorer. Go to Lane Planning.
- **No argument**: Act as own Explorer. Read TASKS.md, PRODUCT.md, .ai-sync/CONTEXT_LEDGER.md, .ai-codex/pages.md, .ai-codex/routes.md. Identify single highest-value task. Run one full /auto-hermes round. Write Explorer Report to `.ai-sync/AUTO_HERMES_MAX_EXPLORER.json`.

### Sequential Lane Execution
Split the goal into lanes with disjoint file ownership. Execute each lane sequentially:
1. Announce: "Lane <id>: <goal> — owned files: <files>"
2. Run full /auto-hermes round within owned files only
3. Before writing each file: `git diff HEAD -- <file>` — if changed externally, re-read and synthesize (apply Concurrent Agent Resilience rules above)
4. Verify: lint/compile/test as appropriate
5. Write result packet to `.ai-sync/auto-hermes-max-results/lane-<id>-result.json`
6. Move to next lane

Never edit a file declared by a different lane. If conflict detected mid-lane, stop that lane, mark it `must-fix`, continue with remaining lanes.

### Sequential Merge Gate (after all lanes)

Run all gates in order. Reference: `.codex/commands/auto-hermes-max.md` → Max Merge Gate (now 10 gates including Concurrent-Work Absorption at gate 6).
Never ask the user to confirm a gate.

After `approve-merge`: update `.ai-sync/CONTEXT_LEDGER.md`, update `TASKS.md`, run auto-commit finish action.

### Dynamic Reassessment (must loop back)

After each merge gate clears:
- 2+ independent surfaces with no shared files → plan another sequential multi-lane iteration
- Sequential dependency → single-lane /auto-hermes round
- One bounded fix → single /auto-hermes round
- Unknown work → run website-audit explorer before any final stop
- No remaining promotable work → only stop after repeated no-candidate audit rounds

The loop does NOT stop after one iteration.

### Stop Rules
- Dynamic Reassessment finds 0 promotable items
- Unresolvable blocker in a lane or merge gate
- `.ai-sync/HUMAN_LOOP.md` says `pause/stop/must-ask`
- Runaway Guard fires (3 consecutive Explorer re-runs with no parallel work)
- Repeated no-candidate website-audit rounds reach the configured limit

---

## /auto-hermes-market for Gemini CLI

Gemini CLI does NOT have native agent spawning. Run all 5 research phases sequentially in this context. **Gemini's native Google Search grounding is preferred over WebSearch tool calls** — use `@google_search` or the built-in search tool when available for more reliable results.

**Canonical command**: `.claude/commands/auto-hermes-market.md` — full protocol, agent schemas, output files, anti-hallucination gate.

### Session Start
1. Check `.ai-sync/HUMAN_LOOP.md` — if `pause/stop/must-ask`, stop immediately
2. If no scope argument: read `PRODUCT.md` lines 1–40, extract North Star market
3. Create `.ai-sync/market/` directory if absent

### Sequential Phase Execution

Run phases 1–5 in order. Announce each phase before starting. Write the JSON file before proceeding to the next.

**Anti-hallucination rule**: every number, competitor, and price must have a `sourceUrl` from a page actually fetched. Mark unverifiable data as `unverified` — never fabricate.

#### Phase 1 — Market Analyst
Search: `"<scope>" market size 2024 2025` · `"<scope>" TAM billion analyst report`
Fetch result pages containing dollar figures. Extract number + year + source.
Output: `.ai-sync/market/market-analyst.json`

#### Phase 2 — Competitor Hunter
Search: `best <scope> apps 2024` · `<scope> alternatives site:reddit.com`
Fetch each candidate homepage. Verify live product + user evidence.
Only `verified[]` entries have `userEvidenceUrl`. Rest → `unconfirmed[]`.
Output: `.ai-sync/market/competitor-hunter.json`

#### Phase 3 — Pricing Engineer
Fetch `<competitor>/pricing` for each verified competitor.
Search: `<scope> pricing Reddit` · `"<scope>" subscription price "per month"`
Output: `.ai-sync/market/pricing-engineer.json`

#### Phase 4 — Social Signal
Search: `site:reddit.com "<scope>" app` — fetch top 3–5 threads.
Search: `"<scope>" "would pay for" site:reddit.com` · `"<competitor>" 1 star reviews`
Only pain points with 2+ mentions → `painPoints[]`. Single mentions → `weakSignals[]`.
Output: `.ai-sync/market/social-signal.json`

#### Phase 5 — Trend Validator
Search: `"<scope>" trend 2024 growing` · `"<scope>" funding 2024 site:techcrunch.com`
Score momentum 1–10 per rubric in `.claude/commands/auto-hermes-market.md` → Scoring methodology.
Output: `.ai-sync/market/trend-validator.json`

### Synthesis

After all 5 files exist: read them, score each opportunity (0–10), map to Hermes tiers, run the Anti-Hallucination Gate.
Write `.ai-sync/market/MARKET_INTELLIGENCE.json` + `.ai-sync/market/MARKET_INTELLIGENCE.md`.
Full synthesis schema: see `.claude/commands/auto-hermes-market.md` → Synthesis Step.

### Task Generation

Insert opportunities scoring ≥ 6/10 as concrete tasks into `TASKS.md` `## Suggested Next Tasks` under the correct tier. Use the task format from `.claude/commands/auto-hermes-market.md` → Generate tasks.

### Reset + Report

Write `{"count": 0}` to `.ai-sync/AUTO_HERMES_MAX_RUNAWAY.json`.
Emit the Market Intelligence Summary per `.claude/commands/auto-hermes-market.md` → Coordinator Reply Rules.

### Stop Rules
- `.ai-sync/HUMAN_LOOP.md` says `pause/stop/must-ask` → stop before Phase 1
- All 5 phases fail → stop, report "research failed — no search access"
- Never stop because a single phase returned `partial` — continue with remaining phases
- Sequential execution only — never claim parallel phase execution for Gemini CLI
