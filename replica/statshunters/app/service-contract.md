# Explorer frontend service boundary

All screens use the methods on `core/api.js`; none reads IndexedDB, Hermes tables or provider APIs directly. `ExplorerProvider` accepts a `service` implementing this interface. The interface was initially implemented by a local browser adapter. The integrated HTTP adapter is now the default, as detailed below. The existing Hermes login, canonical importer, Runner/activity IDs and account lifecycle must remain authoritative when this app is integrated.

## Integrated R0/R1 adapter (replica-backend)

The app now defaults to `core/http-api.js`. `VITE_EXPLORER_MODE=local` explicitly selects the original browser adapter; unit tests retain that default in test mode. The table and local DTO description below document the original handoff as well as the compatible interface. The Spring implementation lives under `com.hermes.backend.explorer`, reuses the existing identity/import/mail/purge services and is enabled only after its additive PostgreSQL migration.

- `/api/explorer/session` bootstraps an HttpOnly cookie session and in-memory CSRF proof. `/session/login`, `/session/signup`, `/session/resend-verification` and `/session/password-reset/{request,confirm}` reuse Hermes account services. `/session/logout` revokes the shared session everywhere. JavaScript never stores a login token.
- Activities, summary, statistics, filter options, preferences, jobs and connections use the planned `/api/explorer` namespace. `PUT /filter` commits the whitelisted UI-to-SI FilterSpec; preference/filter mutations send the displayed revision in `If-Match`. `getView()` composes matching revisions and retries conflicts. A polling bootstrap never advances a mutation precondition beyond the displayed data.
- `POST /activities/query` carries an alternate filter in a body for calendar/paging; names and other private criteria are not placed in URLs. Sort, page size, offset and numeric revision remain bounded query parameters. The history table/cards page on the server; the calendar explicitly labels its 1,000-per-month display cap.
- `POST /map/query` carries numeric viewport bounds in a body instead of introducing a fake raster endpoint. It returns at most 5,000 full-selection cells and 50 bounded display tracks per viewport. Leaflet reloads on pan/zoom/revision, including split dateline viewports. `/activities/{numericId}/track` labels display reduction and retains full source counts. Source points always feed coverage before display reduction.
- Server imports accept FIT/GPX/TCX and continue while the browser is closed. The durable private PostgreSQL source tier is limited to 1 GiB and 2 million points per account; each activity is limited to 200,000 points. R2 private-object storage and large-history scale validation remain follow-ups. The earlier browser limits apply only in local mode.
- Account preferences use the Runner calendar zone. Report verification and opt-out use one-time/unguessable capabilities submitted in bodies; email-link tokens are removed from the hash URL after capture. Separate report/club controls retain a pending state, then confirm/revert after the service response. Display saves never resubmit their stale privacy draft.
- `deleteWorkspace({confirmation:'DELETE',password})` in server mode requests actual account deletion. It immediately removes access, stores only a receipt capability in this tab's session storage, and opens `/deletion`. `/public/deletion-receipt` reports cleanup state; only a successful purge yields `complete`.

The following additional interface methods support account screens: `signup`, `resendVerification`, `confirmPasswordReset`, `getAccountConfiguration`, `getPasswordRules`, `requestReportVerification`, `confirmReportEmail` and `getOverlay`. Local-only `openWorkspace`/`loadExamples` controls are hidden in server mode. Public help/privacy copy is mode-specific. Provider sync/write and public sharing remain disabled, and report generation remains R4. See `../backend.md` for deployment prerequisites and `../test-plan.md` for tested scope.

| Methods | Architecture API references | Server handoff |
| --- | --- | --- |
| bootstrap, openWorkspace, closeWorkspace | A001–A005, A099–A101 | Replace browser opening with existing Hermes authentication, verification, recovery and session handling. Never send a local opening flag as authentication. |
| login({email, password, persistent}), requestPasswordReset({email}) | A002, A004 | Validated frontend forms; local adapter rejects with unavailable status and never claims a session or sent mail. Real adapter reuses Hermes auth/session storage. Recovery success remains generic and only follows accepted service response. |
| importActivities({files, attested, idempotencyKey}) | A010 | Send bounded multipart independent files and source attestation; use the key as `Idempotency-Key`. Reuse the canonical importer under lossless multisport policy. Local parser is a frontend fixture implementation, not a second canonical production importer. |
| getJobs, getJob(id), cancelJob(id) | A011–A013 | Owner-scoped durable jobs; no source blobs in public DTOs; acknowledged cancellation and completed work distinguished. |
| getActivities({filter, sort, descending, cursor, limit}), getActivity(id), getTrack(id) | A014–A016 | Numeric Hermes activity IDs; server must authorize every read. The local adapter returns full segments; the server should return bounded display derivatives. |
| getSummary(filter), getStatistics(section, filter), getView() | A017–A018, A032 | getView is a composition method, not an additional proposed HTTP endpoint. Fetch all eligible panels under one normalized filter and dataset revision. Retry or label updating on mismatch; never combine revisions. Map tile rendering remains a server adapter concern. |
| getFilterOptions(), setFilter(filter), resetFilters() | A019, A024–A025 | Translate UI criteria into the typed FilterSpec v1 whitelist. Convert kilometres/minutes to metres/seconds. Derive half-open UTC bounds from inclusive dates and the account IANA zone on the server. Singles currently use one sport/gear; advanced multi-select OR groups and presets are still pending. |
| getPreferences(), updatePreferences(prefs) | A024–A025 | Coordinate Runner zone and module profile in one service transaction. Bridge existing km/mile units to km/mi. Validate server-side. |
| getConnections() | A006, A009 | Local returns unavailable capabilities. Do not enable provider access without G-PROVIDER evidence and own approved credentials. |
| updateEmailPreferences(), unsubscribe() | A062–A064, A102–A103 | Local deliberately returns unavailable; do not show verification/delivery success. Implement verified address and signed public opt-out with backend mail. |
| deleteWorkspace({confirmation}), getDeletionReceipt() | A086–A087 | Local only clears its own IndexedDB workspace/assets, immediately removes local access and retains a minimal receipt. Production adapter must require reauthentication, revoke sessions/capabilities immediately and perform resumable object/derived/canonical cleanup before a completed receipt. Rename UI scope appropriately only after real service integration. |
| subscribe(listener), dispose() | transport concern | Replace local BroadcastChannel invalidations with query invalidation/job polling or an approved event transport. |

Errors have a safe `message` and optional HTTP-style `status` (401, 404, 409, 503). Screens render confirmed success only after the method resolves. The local mutation queue and `navigator.locks` serialize browser changes; this is not server authorization or a multi-user isolation guarantee. Sources and job checkpoints commit atomically with their local activity/coverage revision. Recovery reopens saved source blobs, and content digests deduplicate retries even when filename metadata is unchanged.

## Native HermesRuns integration

Production source is `frontend/src/features/heatmap-explorer/`; this harness uses
re-exports. `HeatmapPage` injects a credential-bound HTTP service under `/heatmap/*`.
It uses the existing Hermes bearer credential with cookies omitted. Explicit
invalid bearer credentials never fall back to a cookie owner. The standalone
entry retains its existing cookie/CSRF contract.

`GET /api/profile/heatmap/explorer` is an ordinary authenticated Hermes capability
probe. Disabled/older backends retain the existing GPS page with an availability
message. `/heatmap/recorded` opens that renderer directly. Neither route silently
adopts legacy sampled/provider history into the independently authorized dataset.

Native preference saves coordinate the existing global units, language and theme;
only the fields actually submitted can update those controls. A committed dataset
revision invalidates existing history/profile/GPS caches for the same owner.
Public capability links and help/privacy use an anonymous client. Capability query
tokens never enter OAuth login storage. Account deletion clears the Hermes session
and retains the public completion receipt at `/heatmap/deletion`.

React subscription cleanup stops polling. Native callback retirement is reversible
during development StrictMode effect replay and prevents an old client's late
responses from affecting a newer owner. See [verification](../heatmap-integration.md)
for the tested boundaries and serving-release activation requirements.

## Local DTOs

The current simple `/heatmap` entry uses the recorded-workout adapter rather than
the older workspace's local parser. Its read-only coverage endpoint is
`GET /api/profile/heatmap/workouts/{id}/tiles?snapshot=...&cursor=...`.
It returns nullable z14 tile/first-visit counts, complete signed pages of new
cells and retained-source quality. Counts use unsimplified retained owner
history; filters and display zoom do not redefine novelty. Unknown GPS/chronology
is explicit. The optional highlight is off by default and clear restores the
previous map. See HM07 and its budgets in
[heat-layer-architecture.md](../heat-layer-architecture.md). The local parser
limits below describe the older standalone workspace, not this native adapter.

An activity contains numeric `id`, original `name`, UTC `startTime`, normalized `sport`, explicit/unknown `subtype`, nullable `commute`/`trainer`, nullable equipment, kilometres/seconds/metres metrics, full ordered `segments`, derived z14 `cells`, `pointCount`, `quality`, and independently classified `source` metadata. The parser retains original sport/subtype strings. Missing metrics remain null; known zero remains zero. Imported source attestation time and digest are retained.

UI filters use `name`, inclusive `start`/`end`, single `sport`/`subtype`/`gear`, tri-state `commute`/`trainer`, canonical-kilometre `min`/`max`, and `minMinutes`/`maxMinutes`. Blank means unbounded. Draft changes never affect committed selection until Apply. Local date matching converts each source instant into the account calendar, including DST transitions.

getView returns selected `items`, `summary`, `statistics`, `filter`, `preferences`, filter `options`, unfiltered `historyCount` and one dataset `revision`. No private IDs or account fields belong in public help/about/privacy surfaces.

## Geometry and limits

- GPX/TCX only here. FIT uses the future existing-backend importer integration.
- One activity per file, maximum 20 files, 50 MiB each and 100 MiB per batch. At most 200,000 accepted points per activity and 500,000 per local workspace. Accepted geometry above the old 100,000-point boundary is not sampled. Above-limit files fail explicitly.
- Complete ordered segments feed coverage before Leaflet display smoothing. Gaps above 10 km and invalid coordinate runs break segments. Unsupported polar geometry outside Mercator latitude ±85.05112878 is rejected explicitly. Dateline tracks unwrap over the short edge.
- z14 half-open cells; exact corner traversal enters the diagonal only. This is an independent declared convention, not verified numerical parity with StatsHunters. Global-history cluster, maximum square, new-cell chronology, Eddington and performance gates remain R2 work.
- Cell density is selected-activity frequency per visited cell. It is not a continuous kernel heat renderer. At most 5,000 viewport cells are drawn; the UI asks the user to zoom in when bounded. Totals retain the complete accepted selection.
- File parsing runs in the open browser tab; checkpoint recovery is durable but no worker continues while the tab is closed. A production worker/streaming parser and large-history scale validation are backend work.

## Local assets and network

No original code, logo, track, athlete data, screenshot, badge art or copy is imported into the application. Invented examples and two invented source files are in `core/seed.js` and `public/examples/`. The browser verification used only these records.

React/React DOM, Lucide, Leaflet and Manrope reuse installed Hermes dependencies; runtime licenses ship in `public/licenses/`. No new runtime dependency or root lockfile changes; Playwright/axe test dependencies live only in e2e/. The street map is off by default. Opt-in uses visible OSM tiles only, normal browser caching, correct HTTPS URL, switchable `VITE_BASEMAP_URL` and persistent attribution; there is no tile prefetch/export. See the official [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). A different configured provider needs its own attribution and usage agreement before enabling it.
