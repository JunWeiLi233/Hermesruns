# HermesRuns heatmap workspace

This is the production source for the R0/R1 activity workspace. The main app
mounts it at `/heatmap/*` through `pages/heatmap/HeatmapPage.jsx`. The standalone
`replica/statshunters/app/` now contains re-exports for its existing test harness;
edit shared behavior here rather than maintaining a separate application copy.

- `router.jsx` adapts internal workspace links to `/heatmap`; standalone use
  retains its original routes. No nested browser router or iframe is mounted.
- `context.jsx` accepts an injected service and native language/theme/units.
- `pages/heatmap/nativeExplorerApi.js` binds requests to the existing Hermes
  credential, omits cookies, coordinates preferences, and safely retires callbacks.
- Native public capabilities/help/privacy use an anonymous transport. A capability
  token is never an OAuth/session credential. Logout after deletion retains the
  public completion receipt; late private responses cannot replace a newer session.
- `HeatmapDatasetSync` refreshes the existing activity/profile and GPS caches when
  a committed workspace revision changes. The existing GPS renderer remains at
  `/heatmap/recorded`, including its existing authorized history.

The native page follows Hermes language, appearance and unit controls. Internal
calculations and filters retain SI values and the authoritative Runner calendar.
Only independently authorized full-source records enter the workspace projection;
existing provider/sampled/unclassified history is not silently promoted.

Backend services remain opt-in after the additive PostgreSQL migration. The
authenticated capability probe reports whether the module and eight tables are
ready. Disabled/older servers retain the existing GPS map with an availability
message. Normal frontend and Maven builds include the native page; the separate
`explorer` packaging profile additionally builds the standalone regression entry.

See `replica/statshunters/heatmap-integration.md` for exact verification, source
hashes, activation requirements and the distinction from the running release.
