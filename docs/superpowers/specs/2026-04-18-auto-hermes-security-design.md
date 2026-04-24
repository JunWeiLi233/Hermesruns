# Auto-Hermes Security Command Design

## Goal

Add repo-local Hermes slash commands for security review and local attack simulation:

- `/auto-hermes-security`
- `/auto-hermes-attack`

These commands should fit the existing Hermes workflow surface, reuse one shared discovery core, and produce durable reports without pretending to be a production pentest framework.

## Approved Decisions

### Command split

- Use separate slash commands instead of one command with mode flags.
- `/auto-hermes-security` is the safe audit command.
- `/auto-hermes-attack` is the active attack-simulation command.
- `/auto-hermes-attack --aggressive` is allowed as a stronger local/dev-only variant of the attack command.

### Environment policy

- `audit` may run against code/config only, even when the local runtime is unavailable.
- Runtime probes should activate only when Hermes local/dev runtime is reachable.
- `attack` and `attack --aggressive` must be blocked outside local/dev.

### Discovery policy

- Default to repo-aware auto-discovery.
- The commands should infer tables, endpoints, auth surfaces, forms, and response shapes from the real Hermes repo.

### Findings and writeback

- Every run writes a Markdown report and a JSON summary.
- Only verified `HIGH` and `CRITICAL` findings are eligible for `TASKS.md` writeback.
- Lower-severity findings stay in the report.

### Runtime fallback

- If Hermes is not running locally, the commands degrade gracefully to code/config analysis.
- They must not fail just because runtime probing is unavailable.

### Attack mutation policy

- Local/dev attack mode may use controlled mutation only.
- Temporary test payloads, tagged test identities, and disposable records are allowed.
- The command must clean up tagged test state before exit whenever cleanup hooks are available.

## Architecture

Use one shared security engine with two thin command entrypoints.

### Command files

- `.codex/commands/auto-hermes-security.md`
- `.codex/commands/auto-hermes-attack.md`
- mirrored plugin command wrappers under `.codex/plugins/hermes-workflows/commands/`

### Shared engine

- `.tools/auto-hermes-security.mjs`

This script should own:

- repo-aware inventory discovery
- mode gating
- runtime reachability checks
- checker execution
- report generation
- optional task writeback

## Shared Discovery Inventory

The inventory builder should discover:

- backend entities/tables
- backend controllers and routes
- auth-relevant controllers and filters
- request DTO / input-binding surfaces
- frontend forms and likely input fields
- response surfaces and config files

This inventory is shared by both commands so severity, target naming, and reporting remain consistent.

## Checker Modules

Each checker should emit a normalized finding packet with:

- `checker`
- `target`
- `severity`
- `confidence`
- `summary`
- `evidence`
- `repro`
- `writebackEligible`

### RLS Auditor

Purpose:

- check every discovered database table or entity for row-level access boundaries

Expected heuristics:

- native policy signals when present
- application-layer ownership checks
- tenant/user filtering
- admin-only table exceptions

Flags:

- tables with no visible row-scope protection
- direct repository exposure without actor scoping
- ownership-sensitive tables missing user/runner identity gating

### Injection Hunter

Purpose:

- inspect and probe input surfaces for injection risk

Audit mode:

- search for unsafe query construction
- search for shell/path/file interpolation
- identify weak validation or missing sanitization

Attack mode:

- send controlled payloads only against local/dev targets
- test representative input fields and request parameters
- record whether validation, rejection, or escaping occurs

### Auth Tester

Purpose:

- challenge authentication and authorization boundaries

Checks:

- public vs protected endpoint mismatches
- unauthenticated access attempts
- role drift / admin-only route access
- IDOR-style path tampering
- simple login-flow bypass probes

Constraints:

- no credential brute force
- local/dev only for active route probing

### Leak Detector

Purpose:

- scan API responses and config/status surfaces for data leakage

Checks:

- tokens, secrets, stack traces, internal ids, overly large payloads
- debug-only fields exposed in normal API flows
- sensitive field names in response bodies

### Config Checker

Purpose:

- verify basic security configuration and runtime posture

Checks:

- security headers
- cookie flags
- CORS posture
- obvious key/config mistakes
- production-safety config signals where detectable

## Reporting

Every run should write:

- a Markdown report in `.ai-sync/security-reports/`
- a JSON summary in `.ai-sync/security-reports/`

Suggested naming:

- `<timestamp>-auto-hermes-security.md`
- `<timestamp>-auto-hermes-security.json`
- `<timestamp>-auto-hermes-attack.md`
- `<timestamp>-auto-hermes-attack.json`

Reports should clearly distinguish:

- static-only evidence
- runtime-verified evidence
- blocked runtime checks
- out-of-scope production-only claims

## Task Writeback Rules

Write to `TASKS.md` only when all are true:

- severity is `HIGH` or `CRITICAL`
- evidence is concrete
- reproduction is stable
- the issue is not a weaker duplicate of an existing active item

If writeback happens, the task should include:

- `Files:`
- `Context:`
- `Done when:`
- `Verify:`

## Safety Rules

- Never claim production exploitability from repo heuristics alone.
- Never run active attack probes against non-local/non-dev targets.
- Never leave attack-mode test artifacts behind when cleanup is available.
- Never treat missing runtime as a blocker for audit-mode static findings.

## Verification Plan

Implement focused Node-based tests for:

- audit-mode discovery and report generation
- attack-mode environment blocking
- local/dev aggressive-mode allowance
- finding normalization and writeback gating
- plugin/install command surface wiring
