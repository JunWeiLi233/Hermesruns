# Stack And Commands

This file owns stack facts, commands, env vars, coding conventions, and terminal strategy.

## Stack

- Backend: Spring Boot 4.0.3, Java 17, Maven, JPA/Hibernate
- Frontend: React 19, Vite, React Router v7, Chart.js, Leaflet
- Database: H2 in dev, PostgreSQL in prod
- Auth: Google OAuth 2.0, Strava OAuth 2.0, password + email verification
- Payments: Stripe Checkout
- AI: Gemini 2.5 Flash for shoe image scanning / mileage extraction

## Core Commands

```bash
# Backend
cd backend && ./mvnw spring-boot:run
cd backend && ./mvnw package
cd backend && ./mvnw test
cd backend && ./mvnw -DskipTests compile

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run lint
```

## Terminal Strategy

- Prefer workspace-local commands and already-approved command patterns before asking for escalation.
- Prefer targeted lint/test/build commands over broad ones.
- Use RTK when available for noisy shell output, but never treat RTK as proof of success.
- On native Windows Codex, prefer normal shell commands by default; RTK hook auto-rewrite is not available there, so direct `rtk ...` use should be manual and selective.

## Conventions

- Backend serves the React SPA from `/`; APIs live under `/api`.
- Keep frontend and backend contracts aligned in the same task.
- Never hardcode secrets; rely on env-var-driven configuration.
- Prefer small end-to-end fixes over broad rewrites.
- Keep H2 dev compatibility unless the task explicitly targets Postgres-only behavior.

## Key Env Vars

- `APP_GOOGLE_CLIENT_ID/SECRET`
- `STRAVA_CLIENT_ID/SECRET`
- `APP_AI_API_KEY`
- `STRIPE_SECRET_KEY`
- `APP_DB_URL/USERNAME/PASSWORD`
- `HERMES_ENV=production`

## Coding Rules

### Backend

- Validate inputs at the edge and return stable JSON responses.
- Protect admin, billing, OAuth, webhook, upload, and auth-sensitive endpoints carefully.
- Preserve SPA routing expectations.
- If an endpoint contract changes, update the frontend call sites in the same task.

### Database

- Favor additive changes over destructive ones.
- Review query/entity changes for null handling, enum safety, and migration impact.
- Call out backfills or manual migration steps when needed.

### Frontend

- Follow existing React 19 + Vite patterns in this repo.
- Prefer shared components before creating one-off wrappers.
- Keep charts and maps readable on mobile and desktop.
- For runner activity feeds, prefer the shared source in `frontend/src/data/runnerActivities.js`.
- Do not introduce a new design system unless the task explicitly asks for it.
