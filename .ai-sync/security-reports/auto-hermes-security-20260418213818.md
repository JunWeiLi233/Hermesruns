# auto-hermes-security

Run Id: auto-hermes-security-20260418213818
Mode: audit
Status: completed
Generated: 2026-04-18T21:38:18.765Z

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
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: backend/src/main/java/com/hermes/backend/OAuthController.java
  File: backend/src/main/java/com/hermes/backend/OAuthController.java
  Verification: static-only
- [HIGH] injection-hunter :: Dynamic query construction looks injection-prone.
  Target: .tools/H2ToPostgresMigrator.java
  File: .tools/H2ToPostgresMigrator.java
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
