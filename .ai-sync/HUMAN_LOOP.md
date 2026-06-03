# Human Loop

This is the single human interaction point for Hermes auto loops.

Agents should read this file before starting a new self-generated round.
Humans can steer, pause, approve, reject, or reverse the loop here without editing workflow files.

## Contract
- `/auto-hermes` should behave like an intelligent looping agent by default.
- The loop should keep running on its own while promotable work remains and all gates pass.
- Human interaction should stay centralized here instead of being scattered across workflow files.
- If this file says `pause`, `stop`, `must-ask`, or names a specific override, that instruction outranks autonomous continuation.

## Current Status
- Status: active

## Agent Mode
- Mode: autonomous-loop
- Human interaction point: this file only
- Ask human only when:
  - a real blocker appears
  - verification fails and the next move is risky
  - rollback target is unclear
  - a high-impact product fork has non-obvious consequences
  - this file explicitly requests `must-ask`

## Human Requests
- none

## Reversal Requests
- none

## Priority Overrides
- none

## Ideas To Consider
- none

## Notes For Reviewer
- If you ask for a rollback, name the target commit, design version, or surface.

## Agent Writeback Format
- Last round verdict: must-fix - 
- Current owned surface: runner shell sidebar
- Next intended round: [file-audit 2026-05-20] Prune historical auto-hermes tech-debt snapshots (active-task) on [file
- Self-loop state: continue-self-loop - promoted next bounded round: [file-audit 2026-05-20] Prune historical auto-hermes tech-debt snapshots
