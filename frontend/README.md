# Hermes Frontend

**Start here: [Find a page by browser URL](src/pages/README.md).**

The application uses React and Vite. Route implementations are grouped under
`src/pages/<feature>/`, with private helpers next to the page and feature tests
under `__tests__/`. For example:

```text
src/pages/
  runs/
    Runs.jsx
    RunDetail.jsx
    runsCache.ts
    runsLoadMore.ts
    runsRequestCoordinator.ts
    __tests__/
  settings/
    Settings.jsx
    GarminImportSettings.jsx
    ImportDataSettings.jsx
    __tests__/
```

`src/App.jsx` owns routes/providers/access guards. `src/utils/routePreload.js`
owns lazy loaders and prefetching. Shared UI belongs in `src/components/`,
hooks in `src/hooks/`, transport in `src/api.ts`, and domain adapters in
`src/api/`. See the [project map](../docs/PROJECT_MAP.md) for backend ownership.

## Development

Run these from `frontend/`:

```bash
npm ci
npm run dev
npm run test:contracts -- runs
npm run test:unit -- src/pages/runs/
npm run lint
npm test
npm run build
```

The dev server proxies `/api` to the backend at localhost:8080. Contract tests
accept feature directory names; no arguments runs all contracts. `shared`
selects application-wide contracts. Unknown or empty selections fail.

The production build publishes assets under `backend/src/main/resources/static/`.
Those files are generated. Edit `src/` or `public/`, then rebuild.

## Styles and Copy

The route guide lists each feature's styles. `src/styles/app.css` loads the
application cascade; Landing loads its own stylesheet. Inspect later overrides
before changing a selector. Do not edit frozen `style.css` or generated
`style.generated.css`.

Update the same translation key in both `src/i18n/locales/en/` and `zh-CN/`.
`src/i18n/translations.js` is a tooling/test shim, not the runtime copy owner.

## Structure Check

From the repository root, run `npm run check:architecture`. It catches unresolved
imports, dependency cycles, shared code importing pages, and new flat page files.
See [the route-structure rules](../docs/architecture/frontend-route-structure.md).

## Cleanup Boundaries

The unused `SectionCard` wrapper and opaque Kiprun reference asset were removed.
Prediction heroes reuse their existing full-size fallback WebP files for the
largest responsive source; the duplicate 1200/1600-wide copies were byte-identical.
The broken `codex` npm shortcut was removed because its machine-local generator
is not shipped here. Codex's repository integration remains intact.

Keep `node_modules/` for the installed development toolchain and
`.asset-generations/` for retained-build metadata. Public favicon URLs are
compatibility aliases, not unused source assets. The frozen `style.css` still has
regression-test consumers; `style.generated.css` is needed by source-contract tests.
Do not delete either as disposable clutter without migrating those consumers.
The [Strava linking checklist](STRAVA_LINKING_QA.md) remains useful for auth changes.

This cleanup passes typecheck, 80 unit tests, 330 contracts, lint (two existing
warnings), architecture checks and a fresh production build. The active CSS bundle
is byte-for-byte unchanged. Build verification is not proof of a live-site update.
