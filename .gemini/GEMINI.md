# Hermes - Project Brain (Gemini CLI / Antigravity)

## Product Vision
Full detail in `PRODUCT.md` — read before every task. Key rules:
- **North Star**: Personal running coach
- **Personas**: The Competitor (elite, 50-100 mpw) | The Builder (amateur, goal race) | The Enthusiast (casual, streak-driven)
- **Daily Opening Test**: Open Hermes, within 10s answer: (1) should I run today and how hard, (2) am I improving, (3) which shoes
- **Better than Strava**: Feature earns its place only if smarter, more actionable, more trustworthy, or more personal
- **Tier order**: 1-Daily coach | 2-Data trust | 3-Longitudinal | 4-Retention | 5-Breadth
- **Voice**: Direct, specific, warm — never hollow. Coach-voice copy always.

## Stack
- Backend: Spring Boot 4.0.3, Java 17, Maven, JPA/Hibernate
- Frontend: React 19, Vite, React Router v7, Chart.js, Leaflet
- Database: H2 (dev, file-backed) → PostgreSQL (prod via env vars)
- Auth: Google OAuth 2.0, Strava OAuth 2.0, password + email verification
- AI: Gemini 2.5 Flash (shoe image scanning / mileage extraction)

## Codebase Index
Pre-built index in `.ai-codex/` — reference before scanning manually:
- `.ai-codex/routes.md` — 100+ Spring Boot REST endpoints
- `.ai-codex/pages.md` — React pages with feature tags
- `.ai-codex/lib.md` — frontend utility and API function exports
- `.ai-codex/schema.md` — JPA entities with key fields and relations
- `.ai-codex/components.md` — React components with prop hints

Regenerate after structural changes: `node .tools/generate-codex.js`

## Commands
```bash
# Backend
cd backend && ./mvnw spring-boot:run
cd backend && ./mvnw package
cd backend && ./mvnw test

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run lint

# Translation parity
node .tools/check-translations.mjs
```

## Hermes Workflow: /auto-hermes and /auto-hermes-max

### Recognizing the shortcut
- Treat `/auto-hermes` as the canonical Hermes repo shortcut
- If `TASKS.md` exists, `/auto-hermes` alone is enough to start queue execution
- Treat `/auto-hermes-max` as the parallel extension — same architecture, sequential execution in Gemini CLI

### Session Start
Run once in order:
1. Read `.ai-sync/HUMAN_LOOP.md` — if it says `pause`, `stop`, or `must-ask`, stop immediately
2. Read `.ai-codex/optimized-codex.md` for queue status
3. Read `AGENTS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`

### /auto-hermes Round Shape
Shared lifecycle rules in `.codex/workflows/auto-hermes-shared-contract.md`.
One bounded task per round:
1. Choose one task from active queue
2. Select lightest useful shape (single-agent / one-specialist / PM→Builder→Reviewer)
3. PM step: scope the round
4. Builder step: implement
5. Verify: run task verification + runtime proof gate when needed
6. Translation sync: if user-visible strings changed
7. Reviewer: emit `approve-next-round` / `must-fix-before-next-round` / `reverse-recommended`
8. Follow-up + tech-debt pass
9. Update TASKS.md
10. Re-enter self-loop or stop

### /auto-hermes-max (Full Protocol in `.gemini/commands/auto-hermes-max.toml`)
Same execution model as Codex and Claude Code — full Explorer, Dynamic Lane Reassessment, Lane Agent Contract, Merge Arbitration, Autonomous Decision Contract, and all 9 merge gates.
Lanes execute sequentially in Gemini CLI (no native parallel spawning), but the protocol, truth rules, and merge gates are identical.

Key differences from Codex/Claude:
- Lanes run one at a time instead of in parallel
- Coordinator and lane workers share the same agent session
- All other contracts (Explorer, Merge Gate, Arbitration, Reply Rules, Stop Rules) are identical

Invoke: `/auto-hermes-max` or `/auto-hermes-max scope="<goal>"`
Full protocol: `.gemini/commands/auto-hermes-max.toml`
Canonical reference: `.codex/commands/auto-hermes-max.md`


### Self-Loop Engine
Levels 1→5 promotion chain — see `.codex/commands/auto-hermes.md` for full details.
Active Tasks → Suggested → Tech Debt → Self-Generation → Stop.
`## Active Tasks` empty is NOT a stop condition — promote and continue.

## Conventions
- Backend serves React SPA from `/`; all API routes under `/api`
- Every new/changed user-visible UI copy: update both `zh-CN` and `en`
- Mobile first: layouts must work at 390px
- Coach-voice copy over software-product copy
- Source edits are NOT proof of a live change

## Runtime Proof Gates
- Frontend: `node frontend/scripts/run-vite-build.mjs` then `node .tools/verify-frontend-runtime-sync.mjs --files "..."`
- Backend: `node .tools/verify-backend-runtime-sync.mjs --files "..."`
- Do not claim the website or runtime changed unless the proof gate passes

## Truth Rules
- Treat `/auto-hermes` and `/auto-hermes-max` as repo conventions, not native Gemini features
- Do not claim live changes without proof gates
- Do not claim memory recall unless verified from files
- The coordinator does not implement work — it coordinates
