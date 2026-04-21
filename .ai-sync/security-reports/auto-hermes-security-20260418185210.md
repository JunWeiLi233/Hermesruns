# auto-hermes-security

Run Id: auto-hermes-security-20260418185210
Mode: audit
Status: completed
Generated: 2026-04-18T18:52:10.043Z

## Summary
Repo-aware security review completed in static/code-config mode because no runtime target was provided.

## Runtime
Base URL: not-provided
Local/Dev Eligible: no

## Inventory
Tables: 22
Endpoints: 137
Forms: 12

## Findings
- [HIGH] config-checker :: Possible hard-coded secret-like configuration value detected.
  Target: backend/src/main/resources/application.properties
  File: backend/src/main/resources/application.properties
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/.tools/H2ToPostgresMigrator.java
  File: .claude/worktrees/agent-a09e90d2/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/PredictionDetail-DpI9mirt.js
  File: .claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/PredictionDetail-DpI9mirt.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/index-DOGkdeVs.js
  File: .claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/index-DOGkdeVs.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/PredictionDetail-DpI9mirt.js
  File: .claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/PredictionDetail-DpI9mirt.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/index-DOGkdeVs.js
  File: .claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/index-DOGkdeVs.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  File: .claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a1fc2752/.tools/H2ToPostgresMigrator.java
  File: .claude/worktrees/agent-a1fc2752/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/PredictionDetail-DpI9mirt.js
  File: .claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/PredictionDetail-DpI9mirt.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/index-DOGkdeVs.js
  File: .claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/index-DOGkdeVs.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a2500f40/.tools/H2ToPostgresMigrator.java
  File: .claude/worktrees/agent-a2500f40/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/PredictionDetail-Bllk5kdY.js
  File: .claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/PredictionDetail-Bllk5kdY.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/index-qNXBQ0XW.js
  File: .claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/index-qNXBQ0XW.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/.tools/H2ToPostgresMigrator.java
  File: .claude/worktrees/agent-a8ba3b51/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/PredictionDetail-D_bKZQ_Y.js
  File: .claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/PredictionDetail-D_bKZQ_Y.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/index-CmVrDVRL.js
  File: .claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/index-CmVrDVRL.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/PredictionDetail-D_bKZQ_Y.js
  File: .claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/PredictionDetail-D_bKZQ_Y.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/index-CmVrDVRL.js
  File: .claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/index-CmVrDVRL.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  File: .claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .codex/.tmp/plugins/plugins/figma/skills/figma-use/references/plugin-api-standalone.d.ts
  File: .codex/.tmp/plugins/plugins/figma/skills/figma-use/references/plugin-api-standalone.d.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .codex/.tmp/plugins/plugins/superpowers/skills/brainstorming/scripts/helper.js
  File: .codex/.tmp/plugins/plugins/superpowers/skills/brainstorming/scripts/helper.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/plugin/ui/viewer-bundle.js
  File: .tmp/claude-mem/plugin/ui/viewer-bundle.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/scripts/cleanup-duplicates.ts
  File: .tmp/claude-mem/scripts/cleanup-duplicates.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/src/bin/cleanup-duplicates.ts
  File: .tmp/claude-mem/src/bin/cleanup-duplicates.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/src/services/integrations/McpIntegrations.ts
  File: .tmp/claude-mem/src/services/integrations/McpIntegrations.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/src/services/sqlite/SessionStore.ts
  File: .tmp/claude-mem/src/services/sqlite/SessionStore.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/src/services/sync/ChromaSync.ts
  File: .tmp/claude-mem/src/services/sync/ChromaSync.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/src/services/worker/http/routes/CorpusRoutes.ts
  File: .tmp/claude-mem/src/services/worker/http/routes/CorpusRoutes.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/src/utils/cursor-utils.ts
  File: .tmp/claude-mem/src/utils/cursor-utils.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/claude-mem/tests/services/sqlite/schema-repair.test.ts
  File: .tmp/claude-mem/tests/services/sqlite/schema-repair.test.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tmp/codex-home/.tmp/plugins/plugins/figma/skills/figma-use/references/plugin-api-standalone.d.ts
  File: .tmp/codex-home/.tmp/plugins/plugins/figma/skills/figma-use/references/plugin-api-standalone.d.ts
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tools/H2ToPostgresMigrator.java
  File: .tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/.tools/H2ToPostgresMigrator.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/PredictionDetail-DpI9mirt.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/PredictionDetail-DpI9mirt.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/index-DOGkdeVs.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/index-DOGkdeVs.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/PredictionDetail-DpI9mirt.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/PredictionDetail-DpI9mirt.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/index-DOGkdeVs.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/index-DOGkdeVs.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a09e90d2/backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/.tools/H2ToPostgresMigrator.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/PredictionDetail-DpI9mirt.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/PredictionDetail-DpI9mirt.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/index-DOGkdeVs.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/index-DOGkdeVs.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a1fc2752/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/.tools/H2ToPostgresMigrator.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/PredictionDetail-Bllk5kdY.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/PredictionDetail-Bllk5kdY.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/index-qNXBQ0XW.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/index-qNXBQ0XW.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a2500f40/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/.tools/H2ToPostgresMigrator.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/PredictionDetail-D_bKZQ_Y.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/PredictionDetail-D_bKZQ_Y.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/index-CmVrDVRL.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/index-CmVrDVRL.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/PredictionDetail-D_bKZQ_Y.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/PredictionDetail-D_bKZQ_Y.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/index-CmVrDVRL.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/index-CmVrDVRL.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  File: .worktrees/continuous-website-audit-loop/.claude/worktrees/agent-a8ba3b51/backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.tools/.tools/H2ToPostgresMigrator.java
  File: .worktrees/continuous-website-audit-loop/.tools/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/.tools/H2ToPostgresMigrator.java
  File: .worktrees/continuous-website-audit-loop/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: .worktrees/continuous-website-audit-loop/backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/backend/src/main/java/com/hermes/backend/ImportResult.java
  File: .worktrees/continuous-website-audit-loop/backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: .worktrees/continuous-website-audit-loop/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/backend/src/main/resources/static/assets/PredictionDetail-BGWwFP8Z.js
  File: .worktrees/continuous-website-audit-loop/backend/src/main/resources/static/assets/PredictionDetail-BGWwFP8Z.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/backend/src/main/resources/static/assets/WorkflowBuilder-BSmdNGRB.js
  File: .worktrees/continuous-website-audit-loop/backend/src/main/resources/static/assets/WorkflowBuilder-BSmdNGRB.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/backend/src/main/resources/static/assets/index-BSEx0M7c.js
  File: .worktrees/continuous-website-audit-loop/backend/src/main/resources/static/assets/index-BSEx0M7c.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .worktrees/continuous-website-audit-loop/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: .worktrees/continuous-website-audit-loop/backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/.tools/H2ToPostgresMigrator.java
  File: Hermes/.tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/java/com/hermes/backend/OAuthController.java
  File: Hermes/backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-BKznpyLY.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-BKznpyLY.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-BW99I1ta.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-BW99I1ta.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-BrS-eqs6.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-BrS-eqs6.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-C0iPdYF0.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-C0iPdYF0.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-CNpSFDBU.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-CNpSFDBU.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-CPqFtYop.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-CPqFtYop.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-CQqQRjHl.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-CQqQRjHl.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-CU2heeRy.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-CU2heeRy.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-C_augJ6E.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-C_augJ6E.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-CmgcWatR.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-CmgcWatR.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-DEMLzWjF.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-DEMLzWjF.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-DGmBnVyS.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-DGmBnVyS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-DKlnzxyl.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-DKlnzxyl.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-DePx-M1F.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-DePx-M1F.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-DvaMe7le.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-DvaMe7le.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-DxiYIau4.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-DxiYIau4.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-OFjbX1_d.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-OFjbX1_d.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-rJsFuVSH.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-rJsFuVSH.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/Analysis-x4CL7hnB.js
  File: Hermes/backend/src/main/resources/static/assets/Analysis-x4CL7hnB.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-7-p9q18y.js
  File: Hermes/backend/src/main/resources/static/assets/dist-7-p9q18y.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-B3jGINXS.js
  File: Hermes/backend/src/main/resources/static/assets/dist-B3jGINXS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-BePIILHe.js
  File: Hermes/backend/src/main/resources/static/assets/dist-BePIILHe.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-BjgCuNZ-.js
  File: Hermes/backend/src/main/resources/static/assets/dist-BjgCuNZ-.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-CJJSFn9l.js
  File: Hermes/backend/src/main/resources/static/assets/dist-CJJSFn9l.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-CNQhkjo0.js
  File: Hermes/backend/src/main/resources/static/assets/dist-CNQhkjo0.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-D_MU8-n0.js
  File: Hermes/backend/src/main/resources/static/assets/dist-D_MU8-n0.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-Di9YxTDI.js
  File: Hermes/backend/src/main/resources/static/assets/dist-Di9YxTDI.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-DlJEV0P9.js
  File: Hermes/backend/src/main/resources/static/assets/dist-DlJEV0P9.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-DqzbN9cE.js
  File: Hermes/backend/src/main/resources/static/assets/dist-DqzbN9cE.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-EgjQgee4.js
  File: Hermes/backend/src/main/resources/static/assets/dist-EgjQgee4.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/dist-owvO14_g.js
  File: Hermes/backend/src/main/resources/static/assets/dist-owvO14_g.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-1GQpTpxM.js
  File: Hermes/backend/src/main/resources/static/assets/index-1GQpTpxM.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-APFEWjV6.js
  File: Hermes/backend/src/main/resources/static/assets/index-APFEWjV6.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-BEO-NHYW.js
  File: Hermes/backend/src/main/resources/static/assets/index-BEO-NHYW.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-BUrQOrGo.js
  File: Hermes/backend/src/main/resources/static/assets/index-BUrQOrGo.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-Bag4gKQX.js
  File: Hermes/backend/src/main/resources/static/assets/index-Bag4gKQX.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-Bd88vTl5.js
  File: Hermes/backend/src/main/resources/static/assets/index-Bd88vTl5.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-Bg0Ku2fs.js
  File: Hermes/backend/src/main/resources/static/assets/index-Bg0Ku2fs.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-BwI5YjwC.js
  File: Hermes/backend/src/main/resources/static/assets/index-BwI5YjwC.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-C3KTM1Np.js
  File: Hermes/backend/src/main/resources/static/assets/index-C3KTM1Np.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-C7ZOw_gY.js
  File: Hermes/backend/src/main/resources/static/assets/index-C7ZOw_gY.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-CSMUUE3s.js
  File: Hermes/backend/src/main/resources/static/assets/index-CSMUUE3s.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-CW0He72b.js
  File: Hermes/backend/src/main/resources/static/assets/index-CW0He72b.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-CphRXQ_v.js
  File: Hermes/backend/src/main/resources/static/assets/index-CphRXQ_v.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-CzpG7y_v.js
  File: Hermes/backend/src/main/resources/static/assets/index-CzpG7y_v.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-D3OP8tlN.js
  File: Hermes/backend/src/main/resources/static/assets/index-D3OP8tlN.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-D7yld92C.js
  File: Hermes/backend/src/main/resources/static/assets/index-D7yld92C.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DHWl4PIM.js
  File: Hermes/backend/src/main/resources/static/assets/index-DHWl4PIM.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DHcFaUae.js
  File: Hermes/backend/src/main/resources/static/assets/index-DHcFaUae.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DIAxubhf.js
  File: Hermes/backend/src/main/resources/static/assets/index-DIAxubhf.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DOhmfHGU.js
  File: Hermes/backend/src/main/resources/static/assets/index-DOhmfHGU.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DU2UaKGf.js
  File: Hermes/backend/src/main/resources/static/assets/index-DU2UaKGf.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-Da4c9Goh.js
  File: Hermes/backend/src/main/resources/static/assets/index-Da4c9Goh.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DaaJsAeX.js
  File: Hermes/backend/src/main/resources/static/assets/index-DaaJsAeX.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DawwRGOf.js
  File: Hermes/backend/src/main/resources/static/assets/index-DawwRGOf.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DeuV-7dh.js
  File: Hermes/backend/src/main/resources/static/assets/index-DeuV-7dh.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DfPPvlOq.js
  File: Hermes/backend/src/main/resources/static/assets/index-DfPPvlOq.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DoilLPIn.js
  File: Hermes/backend/src/main/resources/static/assets/index-DoilLPIn.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DpRtBcFv.js
  File: Hermes/backend/src/main/resources/static/assets/index-DpRtBcFv.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DuoW905I.js
  File: Hermes/backend/src/main/resources/static/assets/index-DuoW905I.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DvZoN56X.js
  File: Hermes/backend/src/main/resources/static/assets/index-DvZoN56X.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-DvbaVDcT.js
  File: Hermes/backend/src/main/resources/static/assets/index-DvbaVDcT.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-EhQuBjOY.js
  File: Hermes/backend/src/main/resources/static/assets/index-EhQuBjOY.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-FIyQhMG9.js
  File: Hermes/backend/src/main/resources/static/assets/index-FIyQhMG9.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-ZT8n7c7V.js
  File: Hermes/backend/src/main/resources/static/assets/index-ZT8n7c7V.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/index-mcU-YvNr.js
  File: Hermes/backend/src/main/resources/static/assets/index-mcU-YvNr.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/src/main/resources/static/assets/leaflet-src-DWk_SuGo.js
  File: Hermes/backend/src/main/resources/static/assets/leaflet-src-DWk_SuGo.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-BKznpyLY.js
  File: Hermes/backend/target/classes/static/assets/Analysis-BKznpyLY.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-BW99I1ta.js
  File: Hermes/backend/target/classes/static/assets/Analysis-BW99I1ta.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-BrS-eqs6.js
  File: Hermes/backend/target/classes/static/assets/Analysis-BrS-eqs6.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-C0iPdYF0.js
  File: Hermes/backend/target/classes/static/assets/Analysis-C0iPdYF0.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-CNpSFDBU.js
  File: Hermes/backend/target/classes/static/assets/Analysis-CNpSFDBU.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-CPqFtYop.js
  File: Hermes/backend/target/classes/static/assets/Analysis-CPqFtYop.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-CQqQRjHl.js
  File: Hermes/backend/target/classes/static/assets/Analysis-CQqQRjHl.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-CU2heeRy.js
  File: Hermes/backend/target/classes/static/assets/Analysis-CU2heeRy.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-C_augJ6E.js
  File: Hermes/backend/target/classes/static/assets/Analysis-C_augJ6E.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-CmgcWatR.js
  File: Hermes/backend/target/classes/static/assets/Analysis-CmgcWatR.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-DEMLzWjF.js
  File: Hermes/backend/target/classes/static/assets/Analysis-DEMLzWjF.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-DGmBnVyS.js
  File: Hermes/backend/target/classes/static/assets/Analysis-DGmBnVyS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-DKlnzxyl.js
  File: Hermes/backend/target/classes/static/assets/Analysis-DKlnzxyl.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-DePx-M1F.js
  File: Hermes/backend/target/classes/static/assets/Analysis-DePx-M1F.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-DvaMe7le.js
  File: Hermes/backend/target/classes/static/assets/Analysis-DvaMe7le.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-DxiYIau4.js
  File: Hermes/backend/target/classes/static/assets/Analysis-DxiYIau4.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-OFjbX1_d.js
  File: Hermes/backend/target/classes/static/assets/Analysis-OFjbX1_d.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-rJsFuVSH.js
  File: Hermes/backend/target/classes/static/assets/Analysis-rJsFuVSH.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/Analysis-x4CL7hnB.js
  File: Hermes/backend/target/classes/static/assets/Analysis-x4CL7hnB.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-7-p9q18y.js
  File: Hermes/backend/target/classes/static/assets/dist-7-p9q18y.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-B3jGINXS.js
  File: Hermes/backend/target/classes/static/assets/dist-B3jGINXS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-BePIILHe.js
  File: Hermes/backend/target/classes/static/assets/dist-BePIILHe.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-BjgCuNZ-.js
  File: Hermes/backend/target/classes/static/assets/dist-BjgCuNZ-.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-CJJSFn9l.js
  File: Hermes/backend/target/classes/static/assets/dist-CJJSFn9l.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-CNQhkjo0.js
  File: Hermes/backend/target/classes/static/assets/dist-CNQhkjo0.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-D_MU8-n0.js
  File: Hermes/backend/target/classes/static/assets/dist-D_MU8-n0.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-Di9YxTDI.js
  File: Hermes/backend/target/classes/static/assets/dist-Di9YxTDI.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-DlJEV0P9.js
  File: Hermes/backend/target/classes/static/assets/dist-DlJEV0P9.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-DqzbN9cE.js
  File: Hermes/backend/target/classes/static/assets/dist-DqzbN9cE.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-EgjQgee4.js
  File: Hermes/backend/target/classes/static/assets/dist-EgjQgee4.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/dist-owvO14_g.js
  File: Hermes/backend/target/classes/static/assets/dist-owvO14_g.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-1GQpTpxM.js
  File: Hermes/backend/target/classes/static/assets/index-1GQpTpxM.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-APFEWjV6.js
  File: Hermes/backend/target/classes/static/assets/index-APFEWjV6.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-BEO-NHYW.js
  File: Hermes/backend/target/classes/static/assets/index-BEO-NHYW.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-BUrQOrGo.js
  File: Hermes/backend/target/classes/static/assets/index-BUrQOrGo.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-Bag4gKQX.js
  File: Hermes/backend/target/classes/static/assets/index-Bag4gKQX.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-Bd88vTl5.js
  File: Hermes/backend/target/classes/static/assets/index-Bd88vTl5.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-Bg0Ku2fs.js
  File: Hermes/backend/target/classes/static/assets/index-Bg0Ku2fs.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-BwI5YjwC.js
  File: Hermes/backend/target/classes/static/assets/index-BwI5YjwC.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-C3KTM1Np.js
  File: Hermes/backend/target/classes/static/assets/index-C3KTM1Np.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-C7ZOw_gY.js
  File: Hermes/backend/target/classes/static/assets/index-C7ZOw_gY.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-CSMUUE3s.js
  File: Hermes/backend/target/classes/static/assets/index-CSMUUE3s.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-CW0He72b.js
  File: Hermes/backend/target/classes/static/assets/index-CW0He72b.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-CphRXQ_v.js
  File: Hermes/backend/target/classes/static/assets/index-CphRXQ_v.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-CzpG7y_v.js
  File: Hermes/backend/target/classes/static/assets/index-CzpG7y_v.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-D3OP8tlN.js
  File: Hermes/backend/target/classes/static/assets/index-D3OP8tlN.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-D7yld92C.js
  File: Hermes/backend/target/classes/static/assets/index-D7yld92C.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DHWl4PIM.js
  File: Hermes/backend/target/classes/static/assets/index-DHWl4PIM.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DHcFaUae.js
  File: Hermes/backend/target/classes/static/assets/index-DHcFaUae.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DIAxubhf.js
  File: Hermes/backend/target/classes/static/assets/index-DIAxubhf.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DOhmfHGU.js
  File: Hermes/backend/target/classes/static/assets/index-DOhmfHGU.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DU2UaKGf.js
  File: Hermes/backend/target/classes/static/assets/index-DU2UaKGf.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-Da4c9Goh.js
  File: Hermes/backend/target/classes/static/assets/index-Da4c9Goh.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DaaJsAeX.js
  File: Hermes/backend/target/classes/static/assets/index-DaaJsAeX.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DawwRGOf.js
  File: Hermes/backend/target/classes/static/assets/index-DawwRGOf.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DeuV-7dh.js
  File: Hermes/backend/target/classes/static/assets/index-DeuV-7dh.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DfPPvlOq.js
  File: Hermes/backend/target/classes/static/assets/index-DfPPvlOq.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DoilLPIn.js
  File: Hermes/backend/target/classes/static/assets/index-DoilLPIn.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DpRtBcFv.js
  File: Hermes/backend/target/classes/static/assets/index-DpRtBcFv.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DuoW905I.js
  File: Hermes/backend/target/classes/static/assets/index-DuoW905I.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DvZoN56X.js
  File: Hermes/backend/target/classes/static/assets/index-DvZoN56X.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-DvbaVDcT.js
  File: Hermes/backend/target/classes/static/assets/index-DvbaVDcT.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-EhQuBjOY.js
  File: Hermes/backend/target/classes/static/assets/index-EhQuBjOY.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-FIyQhMG9.js
  File: Hermes/backend/target/classes/static/assets/index-FIyQhMG9.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-ZT8n7c7V.js
  File: Hermes/backend/target/classes/static/assets/index-ZT8n7c7V.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/index-mcU-YvNr.js
  File: Hermes/backend/target/classes/static/assets/index-mcU-YvNr.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/backend/target/classes/static/assets/leaflet-src-DWk_SuGo.js
  File: Hermes/backend/target/classes/static/assets/leaflet-src-DWk_SuGo.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: Hermes/frontend/src/pages/Dashboard.jsx
  File: Hermes/frontend/src/pages/Dashboard.jsx
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/src/main/java/com/hermes/backend/ImportResult.java
  File: backend/src/main/java/com/hermes/backend/ImportResult.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/src/main/java/com/hermes/backend/OAuthController.java
  File: backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/src/main/resources/static/assets/PredictionDetail-zWYnFf18.js
  File: backend/src/main/resources/static/assets/PredictionDetail-zWYnFf18.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/src/main/resources/static/assets/WorkflowBuilder-DP1hxMwa.js
  File: backend/src/main/resources/static/assets/WorkflowBuilder-DP1hxMwa.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/src/main/resources/static/assets/index-Dq02S5OA.js
  File: backend/src/main/resources/static/assets/index-Dq02S5OA.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  File: backend/src/main/resources/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/target/classes/static/assets/PredictionDetail-zWYnFf18.js
  File: backend/target/classes/static/assets/PredictionDetail-zWYnFf18.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/target/classes/static/assets/WorkflowBuilder-DP1hxMwa.js
  File: backend/target/classes/static/assets/WorkflowBuilder-DP1hxMwa.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/target/classes/static/assets/index-Dq02S5OA.js
  File: backend/target/classes/static/assets/index-Dq02S5OA.js
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  File: backend/target/classes/static/assets/leaflet-src-XsPM7PQS.js
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: activity_points
  File: backend/src/main/java/com/hermes/backend/ActivityPoint.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: admin_audit_log
  File: backend/src/main/java/com/hermes/backend/AdminAuditLog.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: admin_background_job
  File: backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: admin_saved_filter
  File: backend/src/main/java/com/hermes/backend/AdminSavedFilter.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: generated_race_gpx_asset
  File: backend/src/main/java/com/hermes/backend/GeneratedRaceGpxAsset.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: processed_stripe_event
  File: backend/src/main/java/com/hermes/backend/ProcessedStripeEvent.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: race_course_map_asset
  File: backend/src/main/java/com/hermes/backend/RaceCourseMapAsset.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: shoe_catalog_brands
  File: backend/src/main/java/com/hermes/backend/ShoeCatalogBrand.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: shoe_catalog_models
  File: backend/src/main/java/com/hermes/backend/ShoeCatalogModel.java
  Verification: static-only
- [MEDIUM] rls-auditor :: No obvious row-level ownership signal detected in entity definition.
  Target: shoe_image_asset
  File: backend/src/main/java/com/hermes/backend/ShoeImageAsset.java
  Verification: static-only
- [LOW] auth-tester :: Runtime auth probes skipped because no local/dev runtime target was provided.
  Target: runtime
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/activities/{id}/elevation/status
  File: backend/src/main/java/com/hermes/backend/ActivityController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/admin/users/export
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/admin/shoes/export
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/billing/config
  File: backend/src/main/java/com/hermes/backend/BillingController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/config/status
  File: backend/src/main/java/com/hermes/backend/ConfigStatusController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/garmin/connect/import/status
  File: backend/src/main/java/com/hermes/backend/GarminConnectController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/auth/strava/status
  File: backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
