# Backend Package Migration

Hermes is moving from one flat `com.hermes.backend` package to product-domain packages. This is an incremental refactor: endpoint paths, persistence names, Spring bean behavior, and frontend contracts must remain unchanged in each move.

## Current Boundary

Two complete vertical slices establish the migration pattern:

- `com.hermes.backend.billing` owns the billing controller, processed Stripe event entity, and repository.
- `com.hermes.backend.rewards` owns digital cosmetics delivery, minting/anti-spoof behavior, reward entities, and repositories.

Shared legacy services remain imported from the root package until their own domains move.

## Target Domains

- `activity`: activity entities, import/normalization, analytics, telemetry, and route previews.
- `auth`: login, OAuth, credentials, tokens, and auth rate limits.
- `coaching`: readiness, today plan, injury risk, training blocks, and wellness interpretation.
- `weather`: forecast, acclimatization, and weather-adjusted performance.
- `shoes`: shoe inventory, catalog, image scan, and rotation.
- `races`: races, course maps, elevation, and route extraction.
- `imports`: Garmin, Apple Health, Google Health, FIT, GPX, and TCX adapters.
- `billing`: Stripe checkout/webhook and idempotency persistence.
- `admin`: admin HTTP surfaces, jobs, audit, and portal projections.
- `shared`: infrastructure-only code with multiple domain consumers; product behavior must not accumulate here.

## Move Rule

Move one vertical slice at a time. Move its controller, service, repository, entity, DTO, and focused tests together when practical. Compile the full backend and run the slice tests before starting another domain. Spring scans subpackages beneath `com.hermes.backend`, so no component-scan expansion is required.
