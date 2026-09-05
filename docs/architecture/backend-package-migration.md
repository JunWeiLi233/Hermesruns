# Backend Packages

Hermes uses product-domain packages beneath `com.hermes.backend`. Only
`BackendApplication` and its startup-timeline diagnostic remain at the root.
Spring component, entity and repository scanning continues from that root.
The migration preserves HTTP paths, Java simple type names, table/column names,
queries, Spring bean names, configuration keys and integration behavior.

## Directory Responsibilities

```text
com/hermes/backend/
  BackendApplication.java
  StartupPhaseDiagnosticsLogger.java
  activity/       # activities, telemetry, analytics and activity data access
  admin/          # operator HTTP surfaces, audit, jobs and projections
  auth/           # sessions, passwords, OAuth, security filters and rate limits
    mfa/          # admin passkeys, challenges and recovery
  billing/        # Stripe, subscription status and AI quotas
  coaching/       # plans, readiness, wellness and injury-risk interpretation
  imports/        # Strava/Garmin/health integrations and FIT/GPX/TCX ingestion
  races/          # saved races, official courses, extraction and map acquisition
    model/        # shared course-map and race request/response data
  rewards/        # earned cosmetics and minting policy
  routing/        # route planning, map-tile delivery and route data
  runner/         # runner profile, dashboard, avatar, heatmap and digest
  shoes/          # inventory, catalog, scanning, identity and rotation
  strength/       # muscle-training plans, preferences and exercise definitions
  infrastructure/
    bootstrap/   # explicitly enabled local account/data initialization
    cache/       # cache storage, Redis keys and fixed-window storage
    config/      # shared serialization and configured-provider status
    diagnostics/ # startup and local error diagnostics
    mail/        # transactional mail transport, delivery and timeouts
    web/         # CORS, SPA/static delivery, request and outbound-URL validation
```

Tests mirror domain packages under `backend/src/test/java`. Application context,
whole-backend stress and runtime-footprint contract tests remain at the test root
because they span domains. A domain's package-private fixtures and tests stay
together; do not make internal fixtures public just to keep a test in the old root.

## Dependency Rules

1. Controllers own request parsing, edge validation, authentication and response
   status/headers. Delegate business operations and persistence to domain services.
2. Domain services use repositories/data-access components and provider clients.
   Preserve existing transaction boundaries when extracting an operation.
3. Repositories and entities own queries and persistence mappings. Keep ownership
   predicates in queries or in a verified service gate before accessing data.
4. Shared records/enums must not depend on their callers. Course-map models live
   in `races/model` so geometry, AI and acquisition do not depend cyclically on the
   orchestration service merely to exchange data.
5. External HTTP belongs to the owning integration/client. User-influenced URLs
   retain the DNS-pinned `infrastructure.web.SafeUrlExecutor` security boundary.
6. Infrastructure has named technical responsibilities. Do not create a generic
   `common` package for product behavior or duplicate clients/configuration.

Ordinary bidirectional JPA relationships are intentional persistence associations.
The architecture checker permits compiled cycles only when every participating
type is an entity or mapped superclass. Other class dependency cycles fail.

## Adding Code

Add an endpoint to its existing domain controller and put its operation in that
domain's service. Add queries to that domain's repository, or to a focused data-
access component when JDBC batching is necessary. Reuse current domain records;
extract a shared data type if keeping it inside an orchestrator creates a reverse
dependency. Keep authentication/session behavior in `auth`, mail transport in
`infrastructure/mail`, and provider-specific integrations with their owning domain.

Properties and environment-variable aliases remain in the existing Spring
configuration and domain bindings. A file move is not permission to change default
values, precedence, rate limits, authorization, formulas or serialized field names.

## Migration and Verification

The original move record is `backend-package-moves.json`; the broader audit and
implementation record is `repository-refactor.md`. Existing constructors used only
to build tests may be replaced by test composition helpers; preserve HTTP contracts
and test assertions rather than leaving compatibility classes throughout production.

Run focused tests after a migration, then the complete backend suite and package
build. Update imports, reflection/SpEL names, auto-configuration registrations,
source-contract readers and `docs/ai/functionality-direction-tree.json` together.

```bash
npm run check:architecture
cd backend
./mvnw test
./mvnw -DskipTests package
cd ..
npm run check:architecture -- --classes backend/target/classes
node tools/check-functionality-direction-tree.mjs
```

The compiled check rejects mismatched source/class locations. Supply the actual
fresh class directory when using `hermes.build.directory` for isolated verification.
Source/build checks do not prove a live website has been synchronized.
