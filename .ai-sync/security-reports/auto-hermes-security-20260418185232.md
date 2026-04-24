# auto-hermes-security

Run Id: auto-hermes-security-20260418185232
Mode: audit
Status: completed
Generated: 2026-04-18T18:52:32.607Z

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
  Target: .tools/H2ToPostgresMigrator.java
  File: .tools/H2ToPostgresMigrator.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tools/auto-hermes-max.mjs
  File: .tools/auto-hermes-max.mjs
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tools/auto-hermes-security.test.mjs
  File: .tools/auto-hermes-security.test.mjs
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
