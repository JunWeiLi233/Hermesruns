# Auto-Hermes VoltAgent Subagents Design

**Date:** 2026-04-17
**Status:** Approved
**Approach:** Repo-local Codex-only catalog bridge with Hermes-first routing

## Problem

Hermes `/auto-hermes` already emits a deterministic `subagentPlan`, but it only routes a small fixed set of Hermes-owned roles such as `planning-agent`, `reviewer-agent`, `frontend-agent`, `backend-agent`, and `debugger-agent`.

The user wants Hermes to use the broader VoltAgent Codex subagent catalog from `https://github.com/VoltAgent/awesome-codex-subagents` when useful, while keeping the integration local to this repository and only for Codex.

## Goal

Make `/auto-hermes` able to discover and use repo-local VoltAgent Codex agents as needed without replacing Hermes-owned workflow authority.

Success means:
- the VoltAgent catalog can be installed and refreshed into repo-local Codex paths only
- Hermes continues to prefer its own aliases for core workflow roles
- the controller can recommend extra specialists when a round would benefit from them
- the loop/coordinator brief only claims external agents that are actually installed
- missing catalog files never break `/auto-hermes`

## Constraints

- Scope is repo-local only: `.codex/agents/` inside Hermes
- Scope is Codex-only: no Claude/Cursor/OpenCode wiring in this round
- Hermes policy, control plane, and routing remain authoritative
- VoltAgent agents are an optional capability layer, not a replacement for Hermes aliases
- Installation must not rely on magical auto-spawn claims; the coordinator still delegates explicitly

## Design

### 1. Catalog bridge

Add a small repo-local helper under `.tools/` that can sync the VoltAgent repository into a local cache directory and install selected `.toml` files into `.codex/agents/`.

The helper should also write a small manifest describing:
- source repo
- last sync time
- installed agent names
- cache path
- install mode (`repo-local-codex-only`)

### 2. Hermes-first routing

Hermes keeps these core workflow aliases as the primary execution surface:
- `planning-agent`
- `reviewer-agent`
- `debugger-agent`
- `frontend-agent`
- `backend-agent`

External VoltAgent agents are additive. They are used to sharpen a round, not to replace Hermes workflow ownership.

Examples:
- backend-heavy Spring task: keep `backend-agent`, optionally expose `spring-boot-engineer`
- React-heavy UI task: keep `frontend-agent`, optionally expose `react-specialist` or `ui-fixer`
- review-sensitive task: keep `reviewer-agent`, optionally expose `code-reviewer`
- repo or API research task: optionally expose `docs-researcher`, `search-specialist`, or `code-mapper`
- orchestration/meta task: optionally expose `agent-organizer` or `pied-piper`

### 3. Discovery + capability manifest

The controller and loop should read a repo-local manifest of installed external agents and only recommend agents that are actually present.

This prevents false claims such as “spawn `spring-boot-engineer`” when that file is not installed.

### 4. Deterministic recommendation rules

Add a compact mapping layer from Hermes round classification to optional VoltAgent specialists.

The rules should:
- prefer Hermes aliases first
- add zero or more external specialists based on task signals
- keep recommendations bounded and truthful
- avoid exploding one round into an unreviewable swarm

### 5. Verification

Add focused tests proving:
- catalog discovery works when a manifest and local `.toml` files exist
- missing manifest or missing agent files gracefully fall back to Hermes-only routing
- backend/frontend/review/research/orchestration task signals add the right optional external agents
- loop/coordinator briefs render only installed external agents

## Files

Primary implementation targets:
- `.tools/auto-hermes-controller.mjs`
- `.tools/auto-hermes-loop.mjs`
- `.tools/auto-hermes-tools.test.mjs`
- new `.tools/auto-hermes-subagent-catalog.mjs`
- new `.tools/install-voltagent-codex-subagents.mjs`

Repo-local install target:
- `.codex/agents/`

Manifest/cache targets:
- `.ai-sync/AUTO_HERMES_SUBAGENT_CATALOG.json`
- `.ai-sync/voltagent-codex-subagents/`

## Non-Goals

- Replacing Hermes role cards with VoltAgent definitions
- Installing every VoltAgent agent unconditionally on every run
- Global install in `~/.codex/agents`
- Wiring non-Codex runtimes in this round
- Claiming native automatic Codex spawning for external agents

## Risks

- Naming collisions inside `.codex/agents/`
- Installing too many agents and making routing noisy
- Drift between installed files and what the controller thinks exists

Mitigations:
- use a manifest
- keep Hermes aliases authoritative
- gate recommendations on actual installed files
- keep external agent suggestions optional and bounded
