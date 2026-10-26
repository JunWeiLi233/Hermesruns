# Hermes Explorer application

The production implementation now lives in `frontend/src/features/heatmap-explorer/`
and is integrated into HermesRuns at `/heatmap/*`. This directory re-exports that
source for the standalone preview and regression harness. Native use shares the
Hermes session, navigation, language, appearance and units; the previous GPS map
remains at `/heatmap/recorded`. See [native integration and activation](../heatmap-integration.md).

Independently authored React/Vite application built from the StatsHunters recon, architecture and design. Runtime dependencies reuse the existing Hermes installation. Its default HTTP adapter connects to the opt-in Hermes Explorer backend; the original IndexedDB demonstration is explicitly selected with `VITE_EXPLORER_MODE=local`.

Run from this directory: `npm run dev` (127.0.0.1:4326), `npm run build`, `npm test`, `npm run lint`. Vite proxies `/api/explorer` to `EXPLORER_API_TARGET` (default loopback port 8080). The intended backend must use PostgreSQL, have the additive migration applied and enable the Explorer module. Building this directory alone writes `dist/`. The explicit `../build-backend.ps1` packages it under `/explorer/` in a separate Maven artifact; it does not replace or restart the serving artifact.

All 37 inventory surfaces have stable hash routes. The implemented slice is R0/R1: cookie account access, independent FIT/GPX/TCX imports, durable jobs, private maps, common filters, server-paged history, activity inspection, period statistics, preferences, verified report-address controls and reauthenticated account deletion. R2–R5 surfaces are explicitly scheduled. Grid visit density counts activities per cell; it is not a continuous heat kernel.

The independent local demonstration still supports actual GPX/TCX parsing, IndexedDB checkpoints, invented examples and browser-only removal. Local-only controls are hidden in server mode; account/private-server behavior never falls back to local history after an auth failure.

Verification and setup: [backend](../backend.md), [service contract](service-contract.md), [test plan](../test-plan.md), [bugs](../bugs.md). Run `../test-product.ps1` for packaged real-service browser tests with disposable PostgreSQL, invented accounts and captured mail. `e2e/` owns its Playwright/axe test dependencies; no Hermes root lockfile is changed. Runtime React/Leaflet/font/icon licenses remain in `public/licenses/`.

Live provider integration, monthly report generation, public sharing, large-history object storage and later analytics remain staged. Live mail deliverability, actual host backups and production TLS configuration require deployment verification. Passing the synthetic local tests does not establish full StatsHunters parity.

On this managed Windows environment Vitest uses the ordinary host runtime because sandbox temporary-file isolation can break transformed-module caching. Build/test scripts create separate output and disposable databases; they do not deploy or restart Hermes.
