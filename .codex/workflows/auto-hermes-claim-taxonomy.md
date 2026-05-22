# Auto-Hermes Claim Taxonomy

This file is the single source of truth for hallucination-sensitive Auto-Hermes claims across Codex and Claude.

Use it whenever `/auto-hermes` or `/auto-hermes-max` needs to describe:
- self-loop status
- subagent or lane dispatch
- runtime layer capability
- native-vs-compatibility integration
- runtime/live proof state

## Claim States

Every claim must use exactly one of these states:

- `unavailable`
  - the capability is absent, blocked, or not selected
- `configured`
  - the capability or integration is detected/configured, but no run has been requested yet
- `requested`
  - a later runtime or coordinator is being asked to perform the action, but execution has not started
- `prepared`
  - Auto-Hermes has emitted the next actionable brief/plan, but execution has not started
- `executing`
  - the action is currently in-flight in the live runtime
- `verified`
  - the action or outcome has completed and the required proof gate passed

## Hard Wording Rules

Never collapse these states.

Examples:
- `configured` is not `executing`
- `requested` is not `prepared`
- `prepared` is not `executing`
- `executing` is not `verified`

If a surface is only `configured`, `requested`, or `prepared`, the prose must say so explicitly.

## Hallucination-Sensitive Surfaces

These surfaces must always use the claim taxonomy:
- `/auto-hermes` self-loop continuation
- Codex subagent dispatch
- Claude-side agent/reviewer dispatch
- Antigravity browser subagent dispatch
- live coordinator execution (any runtime)
- unattended executor availability
- ECC native integration vs repo compatibility fallback
- RTK availability
- frontend runtime sync/live website claim
- backend runtime sync/live local runtime claim
- Gemini CLI parallel execution (must say sequential, not parallel)
- Cursor background agent availability
- OpenCode agent dispatch

