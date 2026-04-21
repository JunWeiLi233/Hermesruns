# Auto-Hermes Controller

Decision: continue-self-loop
Work Unit Source: active-task
Claim Key: active-task-security-billing-config-endpoint-leaks-sensitive-configuration-data-without-authentication-security-billing-
Title: [security] Billing config endpoint leaks sensitive configuration data without authentication.
Surface: [security] Billing config endpoint leaks sensitive configuration data without authentication.
Round Shape: pm-builder-reviewer
Visible Multi-Agent: yes
Recommended Agents: reviewer-agent, backend-agent
Optional External Agents: voltagent-spring-boot-engineer, voltagent-java-architect, voltagent-sql-pro
Use Codex Subagents: yes
External Catalog Installed Count: 136

## Claim States
- self-loop continuation: prepared
  detail: controller selected a next bounded round
  rationale: the controller prepared another round but has not started executing it yet
  evidence: loopDecision=continue-self-loop
  evidence: title=[security] Billing config endpoint leaks sensitive configuration data without authentication.
- codex subagent dispatch: prepared
  detail: planned agents: reviewer-agent, backend-agent
  rationale: a dispatch plan exists, but the plan itself is not proof that any lane is executing
  evidence: useCodexSubagents=true
  evidence: shape=pm-builder-reviewer
  evidence: optionalExternalAgents=voltagent-spring-boot-engineer, voltagent-java-architect, voltagent-sql-pro
- human loop gate: configured
  detail: active
  rationale: the controller reads HUMAN_LOOP before deciding whether continuation is allowed
  evidence: status=active
  evidence: mustAsk=false

## Why
- problem classification marked this round as a backend-logic issue
- backend logic touching auth, validation, contracts, or persistence uses reviewer-backed backend execution

## Subagent Plan
- coordinator mode: coordinator-with-subagents
- spawn order: reviewer-agent -> backend-agent
- parallel groups: none
- reviewer-agent: sequential, analysis/review/planning only
- backend-agent: sequential, backend files only
- optional support: voltagent-spring-boot-engineer
- optional support: voltagent-java-architect
- optional support: voltagent-sql-pro
- note: review-sensitive work should use a real reviewer lane before or alongside the owning builder
- note: backend specialist owns implementation; coordinator keeps final verification local
- note: repo-local external Codex agents available for this round: voltagent-spring-boot-engineer, voltagent-java-architect, voltagent-sql-pro
- note: these are repo-local installed agents, not proof of live execution; use them only as bounded support specialists

## Knowledge Pack
- strategy: progressive-disclosure
- record-system map: docs/auto-hermes/index.md
- read 1: AGENTS.md (Truth, runtime-proof, safety, and repo rules.)
- read 2: docs/auto-hermes/index.md (Start from the stable `/auto-hermes` map before drilling into deeper owners.)
- read 3: .ai-codex/optimized-codex.md (Use the compact queue/context brief instead of broad repo scans.)
- read 4: .ai-sync/CONTEXT_LEDGER.md (Preserve the latest durable surface intent before editing.)
- read 5: .ai-sync/AGENT_SYNC.md (Avoid reclaiming conflicting or stale work.)
- read 6: .codex/workflows/auto-hermes-shared-contract.md (Owns lifecycle and runtime wording shared across runtimes.)
- read 7: .codex/workflows/auto-hermes-architecture.md (Owns control-plane boundaries and writeback expectations.)
- read 8: .codex/workflows/hermes-multi-agent.md (Owns delegation and visible multi-agent routing.)
- rule: Start from the map and the selected owner files instead of broad repo scans.
- rule: Treat AGENTS.md as policy/top-level routing, not as the storage layer for every workflow detail.
- rule: When durable workflow behavior changes, update the smallest owning doc or helper rather than copying rules into multiple files.
- doc-gardening: required
- owner: docs/auto-hermes/index.md
- owner: .codex/workflows/auto-hermes-shared-contract.md
- owner: .codex/workflows/auto-hermes-architecture.md
- trigger: If the round changes lasting `/auto-hermes` behavior, update the owning doc/helper in the same round when bounded.
- trigger: If docs drift from helper behavior and the fix is too large, write a concrete doc-gardening follow-up instead of leaving silent drift.

## Tech-Debt Reviewer
- required every round: yes
- scope: changed-files-plus-2-related
- max items: 1
- primary files: /api/billing/config
- related files: backend/src/test/java | backend/src/main/resources
- task format: Files:
- task format: Context:
- task format: Done when:
- task format: Verify:
- rule: Inspect only the just-changed files plus at most 2 directly related files.
- rule: Produce at most 1 implementation-ready debt item or none.
- rule: Do not write vague cleanup, speculative architecture, or weaker duplicates.
- concrete mode: In concrete mode, still run the debt review but do not treat it as permission to extend into autonomous self-loop continuation unless the round owns queue writeback.

## Trace To Skill
- mode: none
- summary: No trace-to-skill evidence loaded.
- candidate: none

## Repo-Local External Codex Agents
- installed count: 136
- recommended this round: voltagent-spring-boot-engineer, voltagent-java-architect, voltagent-sql-pro
- note: voltagent-spring-boot-engineer: backend-heavy round matches Spring/Java/data specialist coverage
- note: voltagent-java-architect: backend-heavy round matches Spring/Java/data specialist coverage
- note: voltagent-sql-pro: backend-heavy round matches Spring/Java/data specialist coverage
- note: voltagent-code-reviewer: review-sensitive round can use extra correctness and QA pressure
- note: voltagent-security-auditor: security-sensitive round can use an additional security specialist
- note: voltagent-docs-researcher: research or documentation-heavy round matches docs/search specialist coverage

## Inputs
- Files: /api/billing/config
- Context: active-data-leak flagged /api/billing/config. Evidence: HTTP 200 returned without any Authorization header. Exposed sensitive fields: provider=stripe An attacker can enumerate integration config, OAuth redirect URIs, and service provider details.
- Done when: the security finding is resolved and the verification command shows the issue no longer reproduces.
- Verify: `node .tools/auto-hermes-security.mjs --mode audit --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --json`

## Signals
- problemClass: backend-logic
- tiny: false
- broad: false
- reviewSensitive: true
- crossStack: false
- touchesFrontend: false
- touchesBackend: true
- frontendDesignGateRequired: false
- backendLogicGateRequired: true
- complexity: 1

## Human Loop
- status: active
- mode: autonomous-loop
- current owned surface: [security] Billing config endpoint leaks sensitive configuration data without authentication.
- next intended round: [security] Billing config endpoint leaks sensitive configuration data without authentication. (active-task) on [security] Billing config endpoint leaks sensitive configuration data without authentication.
- note: stale HUMAN_LOOP agent-writeback fields were ignored for currentOwnedSurface, nextIntendedRound

## Active Claims
- Profile :: Add VDOT Fitness + Race Predictions strip to Profile page with prominent VDOT number, 30-day trend arrow, and calibrated race time predictions for 5K/10K/half/marathon
- Today's Run :: Add 4-column Coaching Intelligence Strip to TodayRun page answering Daily Opening Test within 10 seconds
