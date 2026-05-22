---
name: auto-hermes-security
---

# Auto-Hermes Security

Repo-local Hermes security audit command.

## Purpose

Run a safe, repo-aware security audit that:

- discovers backend tables, routes, auth surfaces, config files, and frontend forms
- runs static/code-config checks even when Hermes runtime is unavailable
- writes a Markdown report and JSON summary under `.ai-sync/security-reports/`
- optionally writes verified `HIGH` and `CRITICAL` findings back to `TASKS.md`

## Command Notes

- Preferred engine: `node .tools/auto-hermes-security.mjs --mode audit --command-name auto-hermes-security --write`
- Runtime probing is optional. If local/dev Hermes is reachable, pass `--runtime-base-url http://localhost:8080`.
- Do not claim production exploitability from static heuristics alone.
- Task writeback is gated to verified `HIGH` and `CRITICAL` findings only.

## Safety

- This command is audit-first, not an offensive production scanner.
- If runtime is unavailable, degrade gracefully to static analysis instead of failing.
