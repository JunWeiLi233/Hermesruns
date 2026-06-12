# Runtime And Workflow

This file owns detailed runtime, queue, and workflow rules.

## Session Start

Before broad work or implementation, run:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/generate-codex.js
& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent codex --tasks TASKS.md --guide AGENTS.md --queue-mode first --write
powershell -ExecutionPolicy Bypass -File .tools/mempalace/auto-session-sync.ps1 -Quiet
& 'C:\Program Files\nodejs\node.exe' .tools/omx-auto-hermes-bridge.mjs
```

Then read:

- `.ai-codex/optimized-codex.md`
- `.ai-sync/OMX_AUTO_HERMES_BRIDGE.md`
- `.ai-sync/AGENT_SYNC.md`
- `.ai-sync/CONTEXT_LEDGER.md`

## Task Execution

- Read `TASKS.md` before implementation when it exists.
- Unless the user says otherwise, work on the first unchecked task only.
- Extract only the active task, nearby notes, and its verify line instead of rescanning the whole file repeatedly.
- Use this order: active task -> relevant files -> focused search -> edit -> targeted verification -> update `TASKS.md`.
- If blocked, leave the task unchecked and add a short `Blocker:` line directly under it.

## Shared Context Files

- `.ai-sync/CONTEXT_LEDGER.md`: durable surface intent and preservation rules
- `.ai-sync/AGENT_SYNC.md`: active claims, recently completed work, must-fix handoff state
- `.ai-codex/CODEX_CHECKPOINT.md`: Codex resume checkpoint for long work

Use them before reclaiming a surface or resuming interrupted work.

## Runtime Proof Gates

### Frontend / website-facing changes

- Build with `cd frontend && node scripts/run-vite-build.mjs`
- Verify with `.tools/verify-frontend-runtime-sync.mjs`
- Do not claim the website changed until the runtime proof passes

### Backend / local API changes

- Compile with `cd backend && ./mvnw -q -DskipTests compile`
- Verify with `.tools/verify-backend-runtime-sync.mjs`
- Do not claim the local Hermes backend changed until runtime proof passes and `http://localhost:8080` returns `200`

If source changed but sync did not run, report: `source changed, live website not synced yet`.

## `/auto-hermes`

Use `docs/auto-hermes/index.md` as the record-system entry for `/auto-hermes`.

Working boundaries:

- `AGENTS.md` = policy plane
- `.codex/workflows/auto-hermes-architecture.md` = control plane
- `.codex/workflows/hermes-multi-agent.md` = delegation plane
- `HERMES_SELF_EVOLVING_ENGINE.md` = promotion plane
- `TASKS.md` + `.ai-sync/*` = state plane

For deep `/auto-hermes` behavior, read the owning workflow/helper instead of inflating `AGENTS.md`.

Executor-backed Codex rounds default to YOLO/full-permission worker execution. The loop helper selects OMX Ralph with `--madmax` when OMX is auto-ready, otherwise the bundled Codex fallback uses `--dangerously-bypass-approvals-and-sandbox`. Generated briefs must show this as executor configuration, and child-agent lanes inherit that context unless an explicit executor override is configured.

## Loop And Batch Rules

- In batch/loop mode, continue only while promotable work remains and verification keeps passing.
- Reviewer must-fix items outrank fresh speculative ideas.
- Do not claim the repo is “perfect”; stop only when explicit work is done and no good promotable next step remains.
- Prefer one bounded work unit at a time.

## Multi-Agent Rules

- Stay local for tiny obvious work.
- Use Hermes subagents when delegation materially helps.
- Prefer explicit file ownership.
- Only parallelize frontend/backend when ownership is disjoint and the contract is explicit.

Detailed delegation behavior lives in `.codex/workflows/hermes-multi-agent.md`.
