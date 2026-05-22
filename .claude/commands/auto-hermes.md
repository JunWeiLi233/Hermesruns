---
name: auto-hermes
description: Hermes adaptive workflow — picks a task from TASKS.md (or runs the concrete scope you pass), implements with verification gates, and stops cleanly after one bounded round.
---

# Hermes Adaptive Workflow

Canonical Hermes repo shortcut. If `TASKS.md` exists, `/auto-hermes` alone is enough to start queue execution.

## 0. Session start
Before the first round of any session, run the inline session checklist:
1. Read `.ai-sync/HUMAN_LOOP.md`. If it says `pause`, `stop`, or `must-ask`, stop and report.
2. `node .tools/auto-hermes-loop.mjs --write --runtime claude` to refresh loop state.
3. Confirm browser proof is reachable (`node .tools/auto-hermes-browser.mjs status` or `.tools/auto-hermes-playwright.mjs doctor`) only if the round will touch browser-visible code.
4. `node .tools/auto-hermes-issues.mjs --list` to scan open GitHub issues for must-fix overlap.
5. Re-read `.claude/skills/_TRIGGERS.md` so skill triggers are fresh.

Then proceed to Mode Switch.

## Mode Switch (check arguments first)

**Concrete Task Mode (arguments provided)** — proceed to Canonical Round Shape with `mode=concrete`.
- Vague argument (no file/symbol/Done-when): trigger `deep-interview --quick`. If OMX unavailable, append `deep-interview: skipped (OMX unavailable)` to CONTEXT_LEDGER and continue.
- New feature/component/page: trigger `brainstorming` (3 options scored against design.md + approved surface, choose strongest).
- After complete + verified: **stop**. Skip steps 10/11; step 12 stops rather than re-entering. No follow-ups, no self-loop.

**Self-Loop Mode (no arguments)** — enter the Self-Loop Engine. Continue through promotion levels until a stop fires.

## Skill Triggers
See [`.claude/skills/_TRIGGERS.md`](../skills/_TRIGGERS.md). Authority order: Hermes gates > superpowers > user instructions override both.

## External Skill Packs: Context Engineering And Superpowers

`/auto-hermes` is wired to external skill sources for delegation, evaluation, prompt, brainstorming, web quality, and agent quality architecture decisions:

- Multi-agent source: `https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/tree/main/skills/multi-agent-patterns`
- Evaluation source: `https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/tree/main/skills/evaluation`
- Prompt-engineering source: `https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/customaize-agent/skills/prompt-engineering`
- Brainstorming source: `https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md`
- Web-quality audit source: `https://officialskills.sh/addyosmani/skills/web-quality-audit` (GitHub: `https://github.com/addyosmani/web-quality-skills/tree/main/skills/web-quality-audit`)
- Impeccable frontend-design audit source: `https://github.com/pbakaus/impeccable` — 7 design domains (typography / color / spacing / motion / interaction / responsive / UX writing), 23 design commands, 27 anti-pattern detectors. CLI: `npx impeccable detect <dir|file|url>`. Slash commands when the bundle is installed: `/impeccable audit <area>`, `/impeccable critique <area>`, `/impeccable polish <area>`, `/impeccable harden <area>`. Optional local install: `cp -r dist/claude-code/.claude .claude/` after cloning.
- UI/UX Pro Max design-system source: `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` — industry-tailored design systems, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, 25 chart types, 10 stacks. Already installed locally as the `ui-ux-pro-max` skill. CLI alternative: `npm install -g uipro-cli && uipro init --ai claude`.
- Hermes manifest: `.tools/auto-hermes-skills.mjs`
- Local install targets when vendored or manually installed: `.codex/skills/multi-agent-patterns/`, `.codex/skills/evaluation/`, `.codex/skills/prompt-engineering/`, `.codex/superpowers/skills/brainstorming/`, and `.codex/skills/web-quality-audit/`
- Loader error ledger: `.ai-sync/error.md`, maintained by `.tools/auto-hermes-error-ledger.mjs`. Record skill/plugin/local loader failures there; round-close scans it and promotes open `blocker` or `error` entries into repair work before normal continuation.

At command start, run:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-skills.mjs --json
```

Also read `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md` or `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json` as a `soft-signal` only. Use it for evidence-backed workflow/process adjustments, not as a hard blocker on normal product work.

Use `multi-agent-patterns` when a round mentions multi-agent design, supervisor/orchestrator control, peer-to-peer/swarm handoffs, hierarchical delegation, sub-agents, agent handoffs, context isolation, or parallel agent execution.

Apply this advisory checklist before PM delegation or Builder parallelization:

- Prefer context isolation as the reason to split work; do not add agents for role theater.
- Choose supervisor/orchestrator when centralized control, human oversight, and bounded decomposition matter.
- Choose peer-to-peer/swarm only when flexible exploration and explicit handoff protocols beat rigid planning.
- Choose hierarchical only for layered strategy/planning/execution work with clear abstraction boundaries.
- Use weighted voting or debate instead of naive majority consensus when agents disagree.
- Add validation checkpoints before downstream agents consume upstream outputs.
- Set time-to-live limits for delegated work to prevent runaway agent loops.
- Avoid agent sprawl and over-decomposition when coordination overhead exceeds context-isolation benefit.

Use `evaluation` when a round mentions agent performance, agent testing, LLM-as-judge, multi-dimensional evaluation, evaluation rubrics, quality gates, regression gates, baselines, production monitoring, or quality measurement for agent pipelines.

Apply this advisory checklist before changing agent quality gates, verification flows, or eval frameworks:

- Prefer outcome-based evaluation over brittle execution-path checks.
- Use multi-dimensional rubrics instead of single aggregate scores.
- Track factual accuracy, completeness, citation/source quality, process quality, and tool efficiency separately when relevant.
- Use LLM-as-judge for scale, but supplement with human review for edge cases, hallucinations, subtle bias, and trust-sensitive results.
- Evaluate end state for file/database/configuration-mutating agents.
- Stratify test sets by complexity so simple cases do not hide complex-case failures.
- Establish baselines before claiming context-engineering or agent-architecture improvement.
- Use continuous regression quality gates with clear pass/fail thresholds and per-dimension failure floors.

Use `prompt-engineering` when a round writes or changes Auto-Hermes commands, hooks, skills, agent prompts, sub-agent prompts, prompt contracts, production prompt templates, system prompt guidance, or other LLM interaction surfaces.

Apply this advisory checklist before changing prompt surfaces:

- Keep prompt templates concise; add context only when it changes model behavior.
- Follow the instruction hierarchy: stable system/command context, task instruction, optional examples, input data, output format.
- Use few-shot examples only when consistent format, reasoning pattern, or edge-case handling matters.
- Use progressive disclosure: direct instruction first, then constraints, then reasoning, then examples only as needed.
- Set appropriate degrees of freedom: exact scripts for fragile flows, flexible guidance for judgment-heavy work.
- Include fallback behavior, confidence/uncertainty handling, and self-verification criteria when the prompt controls a quality gate.
- version prompts as code and test edge cases before claiming a command, hook, skill, or sub-agent prompt is improved.

Use `brainstorming` when a round starts a new feature, component, page, creative behavior change, or scope with no concrete implementation approach.

Apply this advisory checklist before locking the PM plan:

- Explore project context before choosing a design direction.
- Propose 2-3 approaches with trade-offs and choose the strongest one against `design.md`, the approved Hermes surface, user references, and the design-review gate.
- Require design approval before implementation when the scope is broad, ambiguous, or a genuine product fork.
- For larger scopes, write and self-review a spec before transitioning to an implementation plan.
- Keep the `/auto-hermes` bounded-round rule: when the task is already concrete, apply brainstorming as a scope-quality check rather than an open-ended interview.

Use `web-quality-audit` when a round touches a browser-visible frontend route, website-audit fallback, frontend runtime proof, Lighthouse-style quality checks, accessibility, performance, SEO, best practices, mobile responsiveness, console errors, or Core Web Vitals.

Apply this advisory checklist before accepting frontend or website-audit quality work:

- Check performance, accessibility, SEO, and best practices together instead of treating visual polish as the whole quality gate.
- Capture browser proof before claim: runtime URL, console state, screenshot or DOM evidence, and any Lighthouse-style observations.
- Prioritize user-impact issues over score chasing.
- Treat runtime proof, `run-vite-build.mjs`, translation parity, design-token checks, and Hermes source-truth rules as higher authority.

### Frontend design skill stack (apply in this order, every UI round)

A frontend round in Hermes touches **multiple** frontend-design skills. The order below is the authority hierarchy — earlier skills override later skills when they disagree.

**1 — `frontend-design` (Hermes-specific, always fires first for any UI change).** Apply at the PM lock step before the Builder writes any UI. This is the canonical Hermes UI baseline: design tokens (`--accent-coral`, `--surface-1`, `--text-strong`, radius/spacing tokens), coach-voice copy rules, mobile-first conventions at ≤390px, and the page-structure conventions already shipped on `Today Run`, `Profile`, `Analysis`. Source: `.claude/skills/frontend-design/SKILL.md`. Authority: HIGHEST after the live approved surface — this is the Hermes design system itself; do not contradict it.

**2 — `taste-skill` (senior UI/UX engineer baseline).** Apply when the round needs a quality floor — strict component architecture, CSS hardware acceleration, metric-based layout rules. Treat as default Taste skill. Don't conflict with `frontend-design` tokens; `taste-skill` shapes structure, `frontend-design` shapes tokens + voice.

**3 — `ui-ux-pro-max` (design intelligence library).** Apply at the PM lock when the round (1) starts a new surface/component/page, (2) refactors visual structure, (3) chooses or revisits a color/typography system, or (4) needs an industry-tailored design baseline. Pull only the surface-relevant slices (palette, type pair, interaction patterns) — never import a generic dashboard template wholesale. Authority: current live Hermes surface → explicit user reference → `design.md` → `frontend-design` → `taste-skill` → `ui-ux-pro-max`. If the skill suggests a stack switch (Tailwind, shadcn), discard — Hermes stack is React 19 + plain CSS, fixed.

**4 — `vercel-react-best-practices` (React 19 perf guidance).** Apply when the round writes or reviews `frontend/src/**` React code — rerender bugs, hydration issues, bundle-shape decisions, memoization. Translate any Next.js-only advice to the existing Vite stack. Use during the Builder phase, not at PM lock.

**5 — `accesslint` (a11y review).** Apply when the round adds or changes any interactive surface: form, modal, menu, keyboard-driven control, icon-only button, image, focusable canvas region. Run on the changed JSX before the reviewer lane. WCAG-style defects = must-fix; missing labels and broken keyboard traps are not soft-signals.

**6 — `impeccable` (polish + anti-pattern audit).** Apply *after* the Builder reports done and *before* the reviewer lane.

Apply this advisory checklist before locking a frontend visual round and after the implementation:

- Run `npx impeccable detect frontend/src/<surface-glob>` as a pre-flight scan, or `/impeccable audit <surface>` / `/impeccable critique <surface>` when the local skill bundle is installed.
- Treat Impeccable findings as a `soft-signal` lane verdict, not a blocker: cherry-pick anti-pattern hits (purple gradient, nested card, gray-on-color, default font stack) that match the touched surface and fix those first.
- Map Impeccable domains to existing Hermes gates — color/spacing land in design-token check; typography lands in CSS reads + translation parity; motion lands in `prefers-reduced-motion` guards; UX writing lands in coach-voice + translation-sync.
- Do not let Impeccable override `design.md`, the approved live Hermes surface, or an explicit user reference. Hermes authority order still applies.
- For polish-only rounds, prefer `/impeccable polish <surface>` after the Builder step and before the reviewer pass.

### Explicit-call-only Taste sub-skills

The following skills do NOT auto-fire. Apply ONLY when the user directly names the skill or asks for that visual style:

- `taste-soft` — high-end agency look (premium fonts, generous spacing, gentle shadows, subtle motion). Trigger phrase: "make it look expensive", "soft / agency style".
- `taste-minimalist` — clean editorial (warm monochrome, flat bento grids, no gradients, no heavy shadows). Trigger phrase: "minimalist", "editorial", "clean".
- `taste-brutalist` — Swiss-typographic + military terminal (rigid grids, extreme type contrast). Trigger phrase: "brutalist", "dashboard / data-heavy".
- `taste-redesign` — premium upgrade of existing surface without breaking it (audits → identifies AI-generic patterns → fixes). Trigger phrase: "redesign", "make this premium", "upgrade this page".
- `taste-image-to-code` — image-first design-to-code. Trigger phrase: "make it look like this image", "match this reference".
- `taste-stitch` — generates DESIGN.md spec files. Trigger phrase: "DESIGN.md", "design spec".
- `taste-output` — enforces complete unabridged code (bans placeholder patterns). Trigger phrase: "full file", "no truncation".
- `taste-gpt` — heavy GSAP motion + AIDA-structured premium web. Trigger phrase: "GSAP", "motion-heavy hero".

If the user doesn't name one of these, the default Taste skill is `taste-skill`. Never auto-stack multiple Taste sub-skills on the same round.

Skill guidance is advisory. Hermes queue ownership, human gate, runtime proof, verification-before-completion, source-truth, stop rules, and finish behavior remain authoritative.

## Self-Loop Engine (Self-Loop Mode only)

`/auto-hermes` is continuous — never stops on empty `## Active Tasks`. Loop helper `auto-hermes-loop.mjs` is the task-selection authority. Claude is the executor.

**Loop cycle:**
1. **Refresh:** `node .tools/auto-hermes-loop.mjs --write --runtime claude` → writes `.ai-sync/AUTO_HERMES_COORDINATOR.md`.
2. **Read brief:** `.ai-sync/AUTO_HERMES_COORDINATOR.md` `Next Action`. `claude-execute-round` → execute. `stop` → Stop. Other → treat as `stop`.
3. **Execute round:** Canonical Round Shape on the brief's Current Work Unit. `Surface`/`Files`/`Done when`/`Verify` are authoritative — do not re-pick from TASKS.md. Frontend → full FE pipeline (lint, translation, vite build). Backend → mvnw compile + targeted tests. Cross-stack → both sequential.
4. **Round-close (mandatory):**
   ```
   node .tools/auto-hermes-round-close.mjs --write --agent claude \
     --task "<title>" --surface "<surface>" --owner "<owner>" \
     --files "<f1>||<f2>" --verify "<verify>" --verdict pass
   ```
   On failure: `--verdict fail --blocker "<reason>"` (writes must-fix to TASKS.md).
5. **Loop back to step 1.**

**Promotion levels (driven by helper, reference only):** L1 Active Tasks → L2 Suggested → L3 Tech Debt → L4 Self-Generation (`suggest-tasks.mjs`, applies Evidence/Feature-Invention/Quality-Rubric/Tier gates). `loopDecision: continue-self-loop` = proceed.

**Runaway Guard:** `.ai-sync/RUNAWAY_COUNTER.json`. Helper manages. Count ≥ 3 → `loopDecision: stop-runaway-guard` → write `handoff-state` checkpoint, halt.

**Stop:** run finish action (below) if product files changed, report "loop complete — no promotable work remains", stop.

## Canonical Round Shape (PM → Builder → code-reviewer → Customer Pass → Reviewer → Tech-Debt Reviewer)

**PM** — read active task + minimal context. Choose ONE work unit, owner (frontend/backend/cross-stack). Use TICKET.md for broad rounds. Triggers: `deep-interview`, `brainstorming` (skip if `[brainstorming: complete]`), `ralplan`. Frontend non-trivial: lock surface/visual goal/preserve list/round type/reference source; trigger `ui-ux-pro-max` (authority order strict).

**Builder** — implement only the chosen work unit. Triggers: `team` (cross-stack), `ralph` (mustFixCount 2+), `subagent-driven-development` (genuinely parallelizable, disjoint ownership), `systematic-debugging` (any error; first on must-fix). Frontend: coach-voice copy; design-quality review when layout/hierarchy/states change.

**Browser Visual Gate** (frontend, silent + single-tab): the runtime preview must use `.tools/auto-hermes-browser.mjs`, never `browser-harness -c '...'` directly. The wrapper consolidates duplicate Hermes tabs, reuses the single survivor, and never calls `Target.activateTarget` / `Page.bringToFront`, so it cannot pop the browser to the foreground or pile up tabs across rounds.
```bash
cd frontend && npm run dev         # background, only if not already serving
node .tools/auto-hermes-browser.mjs cleanup
node .tools/auto-hermes-browser.mjs goto --url http://localhost:5173/<route> --wait-ms 10000
node .tools/auto-hermes-browser.mjs screenshot --out task-images/<round>-<route>.jpg
```
Skip if the wrapper or the underlying Browser Harness is unavailable, note `browser-visual-gate: skipped` in the round packet, and capture the nearest verified fallback (build artifact, runtime sync proof). Raw `browser-harness -c '...'` is permitted only when the wrapper cannot express the action and the caller manually honors the single-tab + no-focus-stealing rules.

**Alternative — Playwright wrapper.** When the page is auth-walled, the user is using Chrome for other work, or the round runs unattended, swap `auto-hermes-browser.mjs` for [`.tools/auto-hermes-playwright.mjs`](.tools/auto-hermes-playwright.mjs) — same subcommand surface (`goto` / `eval` / `screenshot` / `status` / `reset` / `doctor`), but runs a managed headless Chromium via [Microsoft Playwright](https://github.com/microsoft/playwright) with cookies + localStorage persisted at `.ai-sync/playwright-state/<state>/`. Sign in once with `--headed`, every later round inherits the storage. One-time install: `npm i -D @playwright/test && npx playwright install chromium`.

**Customer Pass (step 8, runner-facing surfaces)** — three personas (Competitor, Builder, Enthusiast) check UI hierarchy, feature gaps, data correctness, coach-voice. Verdicts: `customer-approved` / `customer-must-fix` / `customer-flagged`.

**Reviewer (step 9)** — reads code-reviewer + Customer Pass output. Checks regression, trust, missing states/tests, shallow value. Frontend non-trivial: hierarchy, spacing, fidelity, mobile/desktop. Output: `approve-next-round` / `must-fix-before-next-round` / `reverse-recommended`. `must-fix` required when Customer or code-reviewer emitted must-fix. `customer-flagged`: block if runner-trust impact, else log follow-up.

**Tech-Debt Reviewer** — mandatory bounded check after Reviewer. Inspect just-changed files + ≤2 related. Output: 1 strict debt task (`Files:`/`Context:`/`Done when:`/`Verify:`) or `none`. No vague cleanup, speculative architecture, or weaker-than-top duplicates.

## Reverse-Recommended Revert
Uses `commitSha` from `.claude/CLAUDE_CHECKPOINT.md` (written by `handoff-state` at step 3).
- HEAD == `commitSha` (no in-round commit): `git checkout <commitSha> -- <file1> <file2>` — never repo-wide reset.
- Round committed `R` on top: `git revert --no-edit R`. No force-push.
- No checkpoint or missing `commitSha`: escalate via Human Gate.
- After revert: re-run runtime proof gate; write `## Active Tasks` entry `reverse: <title>` with verify `git diff <commitSha> -- <files>`. Never auto-revert across rounds.

## Frontend Design-Review Routing
- Tiny visual fix, no hierarchy risk → single-agent.
- Non-trivial frontend → one-specialist `frontend-agent → reviewer-agent` (step 9). Runner-facing surface adds Customer Pass (step 8) before Reviewer.
- Broad/ambiguous visual target → full pipeline `PM → frontend-agent → reviewer-agent`.

Code building ≠ round passing. Weak design review → strongest issue becomes next must-fix.

## TASKS.md Section Order
```
## Active Tasks
## Blocked Tasks
## Suggested Next Tasks
## Tech Debt Tasks
## Daily Log
```
`## Blocked Tasks` (created between Active and Suggested when first needed) holds tasks blocked by must-fix verdicts, original task verbatim + appended line: `Blocked by: <must-fix title> | Original: ## Suggested Next Tasks`.

## Runtime Truth + Autonomous Decision Contract

**Runtime claims** — never claim live website/backend changed without the proof gate. If source changed but runtime did not sync, report `source changed, live site not synced yet`. Use shared claim taxonomy (`prepared`/`requested`/`executing`/`verified`) — never collapse. Trace-to-skill artifacts are `soft-signal` only.

**Loop ownership** — `auto-hermes-loop.mjs` is the preferred outer-loop owner. Helper claim states are authority for prepared/executing/verified. Prompt-level continuation is fallback only.

**Forbidden mid-run patterns:**
| Forbidden | Replace with |
|---|---|
| "If you want, I can do one more round…" | Just do the next round. |
| "Here's what each error means…" | Diagnose internally; fix or write must-fix. |
| "The fastest cleanup is: hard refresh…" | Do the cleanup in code. |
| "Would you like me to…" / "Should I…" | Make the decision and act. |
| "I noticed X error. Let me know if…" | Fix it now or write must-fix and continue. |
| Mid-run status narration | Internal only. Only the final stop message is user-facing. |

**On verification failure mid-run:** `systematic-debugging` first. Cheap+bounded → fix in same round. Needs new round → write `[must-fix]` to Active Tasks, re-enter L1. Escalate Human Gate only when destructive/irreversible.

## Concurrent Agent Resilience

Other agents (Codex, Gemini, Cursor) may write the same repo. Loop never stops/pauses/waits — absorb, synthesize, continue.

**Pre-task sync** — `git log --oneline -5`. If most recent commit isn't yours: re-read `.ai-sync/AGENT_SYNC.md`. Same surface completed by another → read their files first. Same surface claimed → skip, pick next unowned. Different surface → ignore.

**Mid-task file conflict** — before writing, `git diff HEAD -- <file>`. If changed: re-read, identify regions, apply synthesis rule, never silently overwrite.

**Synthesis rules:**
| Situation | Action |
|---|---|
| Different regions | Merge both |
| Same region, compatible additions | Synthesize |
| Conflict (same lines, different intent) | Keep version that better serves runner outcome; write `[concurrent-conflict]` tech-debt; continue |
| Their change subsumes yours | Skip file, mark deliverable done |

**Absorption** — keep external valuable additions; compose plan on top, don't replace. Credit in verification notes.

**Commit attribution** — never amend/rewrite another agent's commits.

**Override rule** — never stop, pause, or ask the user because another agent is active. Worst case: write `[concurrent-conflict]` task, continue.

## Human Gate
Ask only when: HUMAN_LOOP says `pause`/`stop`/`must-ask`; verification failed and next move is risky/irreversible; `reverse-recommended` revert can't auto; product fork has non-obvious consequences. Do NOT ask between rounds for normal continuation.

## Stop Rules
Stop only when: L5 reached (all promotion exhausted); verification failure with unresolvable blocker (write checkpoint); `reverse-recommended` needs human input (write checkpoint); HUMAN_LOOP says pause/stop/must-ask (write checkpoint); Runaway Guard fires.

**Empty `## Active Tasks` is NOT a stop condition.** Promote and continue.

## Finish Action
On L5 stop, run auto-commit if **product source files** changed (`frontend/src/`, `backend/src/`, `frontend/public/`, migrations, `translations.js`, `pom.xml`). Commit gates per `CLAUDE.md`.

NOT product source (never trigger commit): `.ai-sync/`, `.claude/`, `.ai-codex/`, `TASKS.md`, `CLAUDE.md`, `AGENTS.md`, `PRODUCT.md`, task images, loop guides.

- Local commit when gates pass.
- Push only on real publish need + push gates pass + fresh Docker gate (`node .tools/auto-hermes-docker-gate.mjs --write`). Push or submit to main repository requires this Docker gate; it blocks publish paths only and does not block normal local auto-commit.
- `finishing-a-development-branch` skill only on explicit user request.

## Shared Lifecycle
Authoritative for follow-up/tech-debt pass, canonical round shape, runtime-truth wording, autonomous contract, human gate, stop, finish:
- [`.codex/workflows/auto-hermes-shared-contract.md`](../../.codex/workflows/auto-hermes-shared-contract.md)
- [`.codex/workflows/auto-hermes-architecture.md`](../../.codex/workflows/auto-hermes-architecture.md)
- [`.codex/workflows/auto-hermes-claim-taxonomy.md`](../../.codex/workflows/auto-hermes-claim-taxonomy.md)

## Notes
- One bounded task per round — never 1–3 at once.
- Source edits ≠ live change.
- No forced feature branches, PR rituals, or discard-the-diff circuit breakers by default.
