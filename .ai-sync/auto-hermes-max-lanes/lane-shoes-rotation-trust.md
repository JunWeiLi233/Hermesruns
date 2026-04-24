# Lane Brief: lane-shoes-rotation-trust

Parent Goal: Strengthen /shoes recommendation trust with concrete rotation evidence and a clear confident-fallback state.

Owned Files:
- `frontend/src/pages/Shoes.jsx`

Must Preserve:
- Keep the existing /shoes route structure, data wiring, and premium Hermes shell language intact.
- Use only already-available shoe and run data; do not invent backend fields.
- Avoid shared-file overlap unless the route-local implementation is genuinely blocked.

Task:
- Make the /shoes recommendation strip explain why Hermes picked the current pair, using concrete rotation evidence like last worn, recent usage, and mileage left.
- Show a trustworthy fallback when Hermes cannot confidently recommend a pair.

Verify:
- `cd frontend && npm run lint`
- `cd frontend && node scripts/run-vite-build.mjs`

Result File:
- `.ai-sync/auto-hermes-max-results/lane-shoes-rotation-trust.json`

Activity Log File:
- `.ai-sync/auto-hermes-max-results/lane-shoes-rotation-trust.activity.json`
