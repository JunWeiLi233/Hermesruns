# Repository Tools

This directory contains maintenance and development tooling, not application
features. Run commands from the repository root.

| Task | Entry point |
| --- | --- |
| Check frontend code | `npm run lint:frontend`, `npm run typecheck:frontend` |
| Test frontend | `npm run test:frontend:unit`, `npm run test:frontend:contracts` |
| Build frontend | `npm run build:frontend` |
| Test backend | `npm run test:backend` |
| Test repository tooling | `npm run test:tooling` |
| Check application boundaries | `npm run check:architecture` |
| Check human navigation | `node tools/repository-layout.test.mjs` |
| Validate feature owners | `node tools/check-functionality-direction-tree.mjs` |
| Check compact agent context | `node tools/check-ai-context-budget.mjs` |
| Generate tool command adapters | `node tools/generate-runtime-commands.mjs` |
| Generate the test CSS compatibility bundle | `node tools/generate-legacy-style-bundle.mjs` |
| Inspect an existing browser session | `node tools/auto-hermes-browser.mjs` |
| Inspect a dedicated persistent QA browser | `node tools/auto-hermes-playwright.mjs` |
| Audit course-map data explicitly | `node tools/audit-marathon-coursemaps.mjs` |

`auto-hermes-*` files own the existing bounded automation workflow.
`mempalace/` owns the optional local memory integration; `test-support/` supports
tooling tests. Import helpers include `garmin_*_download.py`,
`H2ToPostgresMigrator.java` and `import-shoe-catalog.mjs`.

Runtime coordination and scratch output belong under `../.workspace/`, not here.
Integration discovery files remain in their root dotfolders. Start with
`../docs/auto-hermes/index.md` before changing workflow behavior.

## Cleanup Boundaries

The deprecated `split-styles.mjs` forwarding alias and the one-off muscle/shoe
browser probes were removed. Use the canonical CSS generator and shared browser
helpers above. The empty `auto-hermes-config-history.json` proposal placeholder
was also removed; no current tool reads or writes it.

`auto-hermes-config.json` and `auto-hermes-human-loop.json` are live controller
inputs for routing/gates and human-approval behavior. Keep them. The browser and
Playwright helpers use different browser backends, and claim-state descriptions
are different from task-lock ownership; similar names do not make them duplicates.
Manual audit/import tools, test-support helpers and the optional MemPalace setup tools
have distinct uses even when they have no automatic caller.

The audit found no byte-identical duplicates. Do not delete test files based on
literal reference counts: the test runner discovers them by filename patterns.
For future audits, use explicit file reads or `rg --no-ignore` inside this folder;
some tracked tooling paths still match machine-local ignore patterns.

Cleanup verification: all 330 frontend contracts pass; lint has no errors and two
existing warnings. Tooling passes 26 of 27 files, with the same three pre-existing
adapter-documentation assertions in the remaining file. Neither live controller
configuration file changed, and no browser session or application runtime was used
to perform this cleanup.

## Catalog Import Configuration

The sample HTML fixtures and their fixture-only manifest have been removed.
The importer accepts a user-supplied JSON array or an object with an `entries`
array. Each entry needs `url` (an actual local HTML file or verified HTTP(S)
product-page URL); optional fields are `brand`, `model`, `officialName`,
`modelZh`, `modelEn` and `type`. Missing brand/model values are inferred from the
page title when possible.

Run `node tools/import-shoe-catalog.mjs --config path/to/sources.json --dry-run`
with your real configuration to inspect payloads without posting catalog changes.
Non-dry-run imports require an authorized admin token. There are no bundled
sample source files to import by default.
