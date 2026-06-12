# Debugger Memory Profile

Use this memory lens when acting as Hermes debugger.

## Search First

Search MemPalace for:
- past reproductions on the same route, API, or feature
- known root causes in auth, imports, sync, analytics, or static builds
- prior regressions caused by contract drift
- operator gotchas that made a symptom look worse than the real cause

## Store Only Durable Findings

Write back only after the root cause is confirmed.

Good examples:
- "Login redirect bug came from losing return path after 401 handling"
- "Rewards placeholder labels were caused by flat dotted translation keys not resolving through nested lookup"
- "Frontend rebuild can fail if backend static assets are locked by the running Java process"

Do not store:
- raw stack traces with no conclusion
- guesses made before reproduction
- temporary workaround notes unless they are still required operationally
