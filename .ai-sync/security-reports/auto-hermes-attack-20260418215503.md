# auto-hermes-attack

Run Id: auto-hermes-attack-20260418215503
Mode: attack (aggressive)
Status: completed
Generated: 2026-04-18T21:55:03.165Z

## Summary
Repo-aware security review completed with local/dev runtime eligibility.

## Runtime
Base URL: http://localhost:8080
Local/Dev Eligible: yes

## Inventory
Tables: 22
Endpoints: 137
Forms: 13

## Findings
- [CRITICAL] auth-bypass-prober :: Potential Auth Bypass: Endpoint under /api/ appears to lack authentication guards.
  Target: GET /api/config/status
  File: backend/src/main/java/com/hermes/backend/ConfigStatusController.java
  Verification: static-only
- [CRITICAL] auth-bypass-prober :: Potential Auth Bypass: Endpoint under /api/ appears to lack authentication guards.
  Target: POST /api/dev/console-errors
  File: backend/src/main/java/com/hermes/backend/LocalConsoleErrorController.java
  Verification: static-only
- [CRITICAL] auth-bypass-prober :: Potential Auth Bypass: Endpoint under /api/ appears to lack authentication guards.
  Target: GET /api/maps/tiles/{z}/{x}/{y}.png
  File: backend/src/main/java/com/hermes/backend/MapTileController.java
  Verification: static-only
- [CRITICAL] auth-bypass-prober :: Potential Auth Bypass: Endpoint under /api/ appears to lack authentication guards.
  Target: GET /
  File: backend/src/main/java/com/hermes/backend/SpaForwardingController.java
  Verification: static-only
- [CRITICAL] auth-bypass-prober :: Potential Auth Bypass: Endpoint under /api/ appears to lack authentication guards.
  Target: GET /api/strava/webhook
  File: backend/src/main/java/com/hermes/backend/StravaWebhookController.java
  Verification: static-only
- [CRITICAL] auth-bypass-prober :: Potential Auth Bypass: Endpoint under /api/ appears to lack authentication guards.
  Target: POST /api/strava/webhook
  File: backend/src/main/java/com/hermes/backend/StravaWebhookController.java
  Verification: static-only
- [CRITICAL] injection-hunter :: Possible SQL Injection: Dynamic query construction with unescaped input.
  Target: backend/src/main/java/com/hermes/backend/OAuthController.java
  File: backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [CRITICAL] injection-hunter :: Possible SQL Injection: Dynamic query construction with unescaped input.
  Target: .tools/H2ToPostgresMigrator.java
  File: .tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: GET /api/admin/users/{id}/notes
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/users/{id}/notes
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/users/{id}/impersonate
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/shoes/{id}/pending-image
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/shoes/{id}/pending/upload
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/shoes/{id}/accept-image
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: POST /api/admin/shoes/{id}/accept-live
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/admin/shoes/{id}/pending-image
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/admin/shoes/{id}/pending
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/admin/shoes/{id}
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
  Verification: static-only
- [HIGH] idor-hunter :: Potential IDOR: Endpoint accesses resource by ID without verifying ownership.
  Target: DELETE /api/admin/filters/{id}
  File: backend/src/main/java/com/hermes/backend/AdminPortalController.java
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
  Target: activity_points
  File: backend/src/main/java/com/hermes/backend/ActivityPoint.java
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
- [MEDIUM] pii-leak-hunter :: Sensitive Data Exposure: Entity/DTO might leak PII in JSON responses.
  Target: backend/src/main/java/com/hermes/backend/Runner.java
  File: backend/src/main/java/com/hermes/backend/Runner.java
  Verification: static-only
- [LOW] auth-tester :: Admin routes were discovered; runtime bypass probes are allowed in local/dev but not executed by the static engine alone.
  Target: /api/admin/stats
  File: backend/src/main/java/com/hermes/backend/AdminController.java
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
