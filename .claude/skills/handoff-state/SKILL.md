---
name: handoff-state
description: Create compact Hermes checkpoints when another agent should resume later.
user-invocable: true
---

Use this skill when Hermes work should pause and another agent may continue.

Checkpoint contents
- current task or promoted task
- files already changed
- verification already run
- exact blocker or next step
- any pending README, translation, or git gate
- for general Claude retries, write or refresh `.claude/CLAUDE_CHECKPOINT.md`
- for Antigravity retries, write or refresh `.claude/checkpoints/ANTIGRAVITY_CHECKPOINT.md`
- prefer the shared helper: `& 'C:\Program Files\nodejs\node.exe' tools/write-agent-checkpoint.mjs --agent claude ...` or `--agent antigravity ...`

Low-token rules
- Write only durable next-step information.
- Do not duplicate long reasoning chains.
- Prefer `TASKS.md` updates plus one short handoff note over large summaries.
- Overwrite the checkpoint instead of appending history.
- Use `Status: clear` when the resumable state is no longer needed.
- Refresh the checkpoint when context pressure is high enough that the session may stop before the next major step.
