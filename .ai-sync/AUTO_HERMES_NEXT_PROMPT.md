# Auto-Hermes Worker Round

Round: 1
Generated: 2026-04-18T05:28:43.380Z

Execute exactly one bounded Hermes worker round.

Shell command mode:
- RTK mode: auto-enabled
- Preferred shell wrapper: C:\Users\Junwei\.local\bin\rtk.exe (C:\Users\Junwei\.local\bin\rtk.exe)
- For shell-driven reads/searches/repo-state/build/test output, use RTK-wrapped commands by default.
- Prefer: `rtk read`, `rtk grep`, `rtk git status`, `rtk git diff`, `rtk test`, `rtk err`, `rtk lint`.
- RTK is a token/output compactor, not proof of success; still verify the underlying command result.

ECC compatibility mode:
- Mode: compatibility-fallback
- Source: repo-side compatibility layer inspired by affaan-m/everything-claude-code
- Enabled packs: code-review, verify
- code-review: ECC-style code review: require findings-first review plus concrete regression and contract checks before approval.
- verify: ECC-style verify pack: capture the exact verify command/result and keep runtime-proof gates separate from source-only success.

MemPalace plan:
- Mode: skip
- Owner: general
- Query target: hermes
- Reason: this round looks self-contained enough that MemPalace is optional if local repo context already answers the question
- 1. call `mempalace_status` to confirm the palace is live in this session
- 2. skip diary read unless the round clearly depends on prior incidents or decisions
- 3. run a narrow `mempalace_search` for `hermes`
- 4. only if durable facts change or a confirmed root cause is discovered, write back after verification

Knowledge pack:
- Strategy: progressive-disclosure
- Record-system map: none
- Read 1: AGENTS.md (Fallback read order because the controller did not emit a richer knowledge pack.)
- Rule: Start from the controller brief and the smallest owning files before broad workflow scans.
- Doc-gardening: conditional
- Trigger: If durable workflow behavior changes, update the smallest owning doc or helper instead of leaving chat-only context.

Tech-debt reviewer:
- Required every round: yes
- Scope: changed-files-plus-2-related
- Max items: 1
- Primary files: not specified
- Related files: none
- Task format: Files:
- Task format: Context:
- Task format: Done when:
- Task format: Verify:
- Rule: Inspect only the just-changed files plus at most 2 directly related files.
- Rule: Produce at most 1 implementation-ready debt item or none.
- Rule: Do not write vague cleanup, speculative architecture, or weaker duplicates.
- Concrete mode: In concrete mode, still run the debt review but do not treat it as permission to extend into autonomous self-loop continuation unless the round owns queue writeback.
- Prompt: Check whether this round exposed exactly one bounded reusable engineering cleanup. If not, emit none.

Specialist role frame:
You are a senior Hermes product engineer.
You are highly skilled at bounded end-to-end delivery across product reasoning, implementation, verification, and safe loop writeback.

Codex subagent dispatch plan:
- use Codex subagents: no
- coordinator mode: local-coordinator-only
- spawn order: none
- parallel groups: none

Repo-local external Codex agents:
- mode: repo-local-codex-only
- installed count: 0
- recommended this round: none
- installed agents: none
- These are repo-local installed agents, not proof of live execution. Delegate only when they materially help.

Rules:
- Treat this as a single worker round, not a self-loop.
- Start from the emitted knowledge pack and read those files in order before widening into broader workflow exploration.
- Read `.ai-sync/HUMAN_LOOP.md` before editing for human steering state.
- Use `.ai-sync/AUTO_HERMES_CONTROLLER.json` as the deterministic routing brief.
- For task selection, the controller-selected work unit below is authoritative. Do not treat stale narrative fields in `.ai-sync/HUMAN_LOOP.md` or `.ai-sync/LOOP_STATE.md` as the current task if they disagree with the controller brief.
- `HUMAN_LOOP.md` is authoritative only for human steering such as pause/stop/must-ask. Its `Agent Writeback Format` lines are advisory and may be stale between rounds.
- If the MemPalace plan says `required` or `recommended` and MemPalace MCP tools are available, perform the memory lookup before broad repo exploration.
- Treat the repo as the record system: if this round changes durable `/auto-hermes` behavior or finds stale workflow docs, update the smallest owning doc/helper or leave a concrete doc-gardening follow-up.
- Run the tech-debt-reviewer check on every round before stopping: inspect only the changed files plus at most 2 related files, and emit at most 1 implementation-ready debt item or none.
- If the dispatch plan says to use Codex subagents and they are available, prefer real spawned subagents over keeping those roles implicit.
- Apply the enabled ECC packs automatically: use detected native ECC only when real install markers exist and the active runtime can honor them; otherwise use the repo compatibility layer.
- Implement only the selected bounded task.
- Verify the round before any live claim.
- Run `.tools/auto-hermes-round-close.mjs --write ...` with the real round details before stopping.
- Do not start another worker round inside this child run.

Selected work unit:
- Source: none
- Title: none
- Surface: none
- Files: not specified
- Context: none
- Done when: none
- Verify: none
