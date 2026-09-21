# Ownership map — where to change X

Human-readable map of Hermes surfaces → source files. Prefer this over archaeology in `git log`.

RFC-014. Keep sections short: **Change this → edit these files** + one-line why.

---

## Frontend

Paths are relative to the repo root. Feature pages live under `frontend/src/pages/<feature>/` (see also `frontend/src/pages/README.md` and `docs/architecture/frontend-route-structure.md`).

### App entry / router

| Change this | Edit these files | Why |
|---|---|---|
| Route table / lazy page mounts | `frontend/src/App.jsx`, `frontend/src/utils/routePreload.js` | `App.jsx` owns `<Routes>`; `routePreload.js` is the shared lazy/preload map so hover prefetch hits the same chunk loaders. |
| Boot / providers | `frontend/src/main.jsx`, `frontend/src/contexts/{Auth,I18n,Theme,Unit}Context.jsx` | Providers wrap the tree; keep auth/i18n/theme/units out of page components. |
| Route-loading skeleton gate | `frontend/src/App.jsx` (`RouteLoading`, `RouteStyleGate`), `frontend/src/components/PageSkeleton.jsx` | Suspense + style-gate show `PageSkeleton` before lazy CSS/JS settle. |

### Profile dashboard + wake fan-out / AbortController / cachedApiJson

| Change this | Edit these files | Why |
|---|---|---|
| Profile first-paint data fan-out | `frontend/src/pages/profile/ProfileDashboard.jsx` (re-exported by `Profile.jsx`) | Happy-path first paint goes through `/api/profile/dashboard` (+ TTL/`cachedApiJson`); idle hooks defer weekly-digest / full-history. |
| Shared AbortController on Profile batch | `frontend/src/pages/profile/ProfileDashboard.jsx` | Abort + timeout race is scoped to Profile dashboard first-paint — do not expand abort-sharing to other pages without an explicit RFC. |
| Cross-page GET dedupe / TTL | `frontend/src/api/resourceCache.ts` | `cachedApiJson` + prefix TTLs collapse remount stampedes for profile/activities hot reads. |
| Profile wake-fan-out smoke | `frontend/src/pages/profile/__tests__/profileWakeFanout.smoke.test.js` (+ `feWakeFanout2.smoke.test.js` when present) | Guards batch-first, idle deferrals, and `cachedApiJson` wiring. |

### Analysis page + deferred enrichment

| Change this | Edit these files | Why |
|---|---|---|
| Analysis first paint (profile + activities) | `frontend/src/pages/analysis/Analysis.jsx` | Hot path uses `cachedApiJson` for `/api/profile/me` + `/api/activities/analysis`. |
| Deferred coach / injury enrichment | `frontend/src/pages/analysis/Analysis.jsx` (`requestIdleCallback` / idle schedule) | Coach + injury-risk are wake-amplifying; idle them so first paint stays light. |
| Insight sub-routes | `frontend/src/pages/analysis/AnalysisInsightDetail.jsx`, route entries in `App.jsx` / `routePreload.js` | Per-insight deep links stay in the analysis feature folder. |

### Runs list + route-previews idle

| Change this | Edit these files | Why |
|---|---|---|
| Runs list fetch / sort / cards | `frontend/src/pages/runs/Runs.jsx` | List paint uses `cachedApiJson('/api/activities')` then normalizes to an array before sort/render. |
| Route-preview batch (idle) | `frontend/src/pages/runs/Runs.jsx` (`requestRoutePreviews` + idle effect) | `/api/activities/route-previews` is scheduled post-paint via `requestIdleCallback` so it does not contend with cold-wake list paint. |
| Runs helpers / cache helpers | `frontend/src/pages/runs/runsCache.ts`, `runsRequestCoordinator.ts`, `runsLoadMore.ts` | Keep list pagination/cache coordination out of the JSX monolith when possible. |
| Run detail | `frontend/src/pages/runs/RunDetail.jsx` | Per-activity surface (incl. Strava sync UX). |

### API client (`api.ts` / wake retry / resourceCache)

| Change this | Edit these files | Why |
|---|---|---|
| HTTP client, wake retry, `apiJson` / `apiFetch` | `frontend/src/api.ts` | Railway cold-start wake: safe-method retries, `subscribeWakeRetry`, `withWakeRetry` — never blindly retry POST/PUT/PATCH/DELETE. |
| TTL + inflight dedupe | `frontend/src/api/resourceCache.ts` | Layer on top of `apiJson`; prefix TTLs + inflight map. |
| Activity-specific API helpers | `frontend/src/api/activityApi.ts` | Typed activity helpers kept separate from the generic client. |
| Wake-retry unit tests | `frontend/src/apiWakeRetry.vitest.ts` | Covers status/network classification and retry delays. |

### PageSkeleton / waking note i18n

| Change this | Edit these files | Why |
|---|---|---|
| Skeleton variants / layout | `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css` | Route-shaped placeholders; CSS must load before lazy page styles. |
| “Waking the server…” note | `PageSkeleton.jsx` (`WakeRetryNote` + `subscribeWakeRetry`), `frontend/src/i18n/locales/en/common.js`, `frontend/src/i18n/locales/zh-CN/common.js` (`common.waking_server`) | Note tracks wake-retry depth from `api.ts`; copy is locale-keyed. |

### i18n locales (en / zh-CN)

| Change this | Edit these files | Why |
|---|---|---|
| User-visible copy | `frontend/src/i18n/locales/en/*.js` **and** `frontend/src/i18n/locales/zh-CN/*.js` (same key) | Edit both locales together; `en.js` / `zh-CN.js` are re-export shims. |
| Locale registry / runtime | `frontend/src/i18n/localeRegistry.js`, `frontend/src/i18n/translationRuntime.js`, `frontend/src/contexts/I18nContext.jsx` | Supported locales, lazy message loading, `t()`. |
| Translation check | `tools/check-translations.mjs` (repo root) | CI/full parity gate for en ↔ zh-CN. |

### Auth / shell chrome

| Change this | Edit these files | Why |
|---|---|---|
| Auth session / Strava sync poll | `frontend/src/contexts/AuthContext.jsx` | Token hydration, role, Strava sync completion events. |
| Login / signup / forgot-password | `frontend/src/pages/auth/{Login,Signup,ForgotPassword}.jsx`, `frontend/src/components/AuthPageLayout.jsx` | Auth-route pages + shared layout. |
| Runner shell chrome (sidebar / top nav / footer) | `frontend/src/components/AuthenticatedPageChrome.jsx`, `RunnerShellTopNav.jsx`, `MobileRunnerNavigation.jsx`, `FooterNavLinks.jsx` | Authenticated frame around runner pages; chrome may `cachedApiJson('/api/profile/me')`. |

### Key smokes

| Smoke | Path | Guards |
|---|---|---|
| `profileWakeFanout` | `frontend/src/pages/profile/__tests__/profileWakeFanout.smoke.test.js` | Profile batch-first + `cachedApiJson` / idle fan-out contracts. |
| `apiWakeRetry` | `frontend/src/apiWakeRetry.vitest.ts` | Wake retry helpers + safe-method / status classification. |
| `loadingSkeleton` | `frontend/src/test/contracts/loadingSkeleton.smoke.test.js` | `PageSkeleton` CSS import + route→variant mapping used by `App.jsx`. |

### Quick “I need to…” cheat sheet

- **Add a route** → page under `frontend/src/pages/<feature>/`, register in `App.jsx` + `utils/routePreload.js`.
- **Cut wake/first-paint API fan-out** → prefer `cachedApiJson` + idle deferral in the page; keep AbortController sharing on Profile dashboard unless a new RFC expands it.
- **Change a label** → `i18n/locales/en/` + `zh-CN/` same key.
- **Fix cold-start spinner copy** → `common.waking_server` + `PageSkeleton` `WakeRetryNote`.
