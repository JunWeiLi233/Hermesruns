# auto-hermes-push-main

Run Id: auto-hermes-push-main-20260612174723
Mode: audit
Status: completed
Generated: 2026-06-12T17:47:23.665Z

## Summary
Repo-aware security review completed in static/code-config mode because no runtime target was provided.

## Runtime
Base URL: not-provided
Local/Dev Eligible: no

## External Skill Sources
- mukul975/Anthropic-Cybersecurity-Skills: https://github.com/mukul975/Anthropic-Cybersecurity-Skills
  Policy: external-reference-only
  Frameworks: MITRE ATT&CK, NIST CSF 2.0, MITRE ATLAS, MITRE D3FEND, NIST AI RMF
  Install hint: npx skills add mukul975/Anthropic-Cybersecurity-Skills

## Active Probes
Attempted: no
Skipped: no
Reason: n/a
Coverage: n/a

## Cleanup
Required: yes
Attempted: no
Status: not-needed
Notes: n/a

## Inventory
Tables: 30
Endpoints: 176
Forms: 15

## Findings
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/admin/filters/{id}
  File: backend/src/main/java/com/hermes/backend/AdminAuditPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/shoes/{id}/pending-image
  File: backend/src/main/java/com/hermes/backend/AdminShoePortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/shoes/{id}/pending/upload
  File: backend/src/main/java/com/hermes/backend/AdminShoePortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/shoes/{id}/accept-image
  File: backend/src/main/java/com/hermes/backend/AdminShoePortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/shoes/{id}/accept-live
  File: backend/src/main/java/com/hermes/backend/AdminShoePortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/admin/shoes/{id}/pending-image
  File: backend/src/main/java/com/hermes/backend/AdminShoePortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/admin/shoes/{id}/pending
  File: backend/src/main/java/com/hermes/backend/AdminShoePortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/admin/shoes/{id}
  File: backend/src/main/java/com/hermes/backend/AdminShoePortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: GET /api/admin/users/{id}/notes
  File: backend/src/main/java/com/hermes/backend/AdminUserPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/users/{id}/notes
  File: backend/src/main/java/com/hermes/backend/AdminUserPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/users/{id}/impersonate
  File: backend/src/main/java/com/hermes/backend/AdminUserPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/auth/runners/{id}
  File: backend/src/main/java/com/hermes/backend/LoginController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/auth/runners/{id}/subscription
  File: backend/src/main/java/com/hermes/backend/LoginController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/shoe-catalog/admin/brands/{id}
  File: backend/src/main/java/com/hermes/backend/ShoeCatalogController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: PUT /api/shoe-catalog/admin/models/{id}
  File: backend/src/main/java/com/hermes/backend/ShoeCatalogController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/shoe-catalog/admin/models/{id}
  File: backend/src/main/java/com/hermes/backend/ShoeCatalogController.java
  Verification: static-only
- [HIGH] rls-auditor :: Missing Row-Level Ownership: Potential for unauthorized data access.
  Target: admin_background_job
  File: backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java
  Verification: static-only
- [HIGH] rls-auditor :: Missing Row-Level Ownership: Potential for unauthorized data access.
  Target: admin_saved_filter
  File: backend/src/main/java/com/hermes/backend/AdminSavedFilter.java
  Verification: static-only
- [HIGH] rls-auditor :: Missing Row-Level Ownership: Potential for unauthorized data access.
  Target: processed_stripe_event
  File: backend/src/main/java/com/hermes/backend/ProcessedStripeEvent.java
  Verification: static-only
- [MEDIUM] injection-hunter :: Possible SQL Injection: Dynamic query construction with unescaped input.
  Target: .tools/H2ToPostgresMigrator.java
  File: .tools/H2ToPostgresMigrator.java
  Verification: static-only
- [MEDIUM] injection-hunter :: Possible SQL Injection: Dynamic query construction with unescaped input.
  Target: .tools/auto-hermes-controller.mjs
  File: .tools/auto-hermes-controller.mjs
  Verification: static-only
- [MEDIUM] injection-hunter :: Possible SQL Injection: Dynamic query construction with unescaped input.
  Target: .tools/auto-hermes-playwright.mjs
  File: .tools/auto-hermes-playwright.mjs
  Verification: static-only
- [MEDIUM] pii-leak-hunter :: Sensitive Data Exposure: Entity/DTO might leak PII in JSON responses.
  Target: backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapConfiguration.java
  File: backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapConfiguration.java
  Verification: static-only
- [MEDIUM] pii-leak-hunter :: Sensitive Data Exposure: Entity/DTO might leak PII in JSON responses.
  Target: backend/src/main/java/com/hermes/backend/Runner.java
  File: backend/src/main/java/com/hermes/backend/Runner.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/activities/{id}/elevation/status
  File: backend/src/main/java/com/hermes/backend/ActivityController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/admin/shoes/export
  File: backend/src/main/java/com/hermes/backend/AdminShoePortalController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/admin/users/export
  File: backend/src/main/java/com/hermes/backend/AdminUserPortalController.java
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
  Target: GET /api/config/admin/status
  File: backend/src/main/java/com/hermes/backend/ConfigStatusController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/garmin/connect/import/status
  File: backend/src/main/java/com/hermes/backend/GarminConnectController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/garmin/connect/wellness/status
  File: backend/src/main/java/com/hermes/backend/GarminConnectController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/injury-risk/status
  File: backend/src/main/java/com/hermes/backend/InjuryRiskController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/auth/strava/status
  File: backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/wellness/apple-health/status
  File: backend/src/main/java/com/hermes/backend/WellnessController.java
  Verification: static-only
- [LOW] leak-detector :: Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.
  Target: GET /api/wellness/google-health/status
  File: backend/src/main/java/com/hermes/backend/WellnessController.java
  Verification: static-only
