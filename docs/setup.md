# Hermes Setup Guide

Deployer-facing reference for getting Hermes running locally and in production.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Java | 17+ | Required for the Spring Boot backend |
| Node.js | 18+ | Required for the Vite frontend build |
| Maven wrapper | bundled | Use `./mvnw` in `backend/` -- no Maven install needed |
| PostgreSQL | 14+ | Production only. Dev uses H2 by default |
| Python | 3.10+ | Optional. Required only for the local Qwen course-map pipeline |

## Local Dev Quickstart

```bash
# 1. Clone
git clone https://github.com/your-org/hermes.git && cd hermes

# 2. Copy env template and fill in REQUIRED values
cp .env.example .env
# Edit .env -- at minimum set APP_DATA_ENCRYPTION_KEY, APP_GOOGLE_CLIENT_ID,
# APP_GOOGLE_CLIENT_SECRET, and STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET.

# 3. Export env vars (or use your preferred .env loader)
set -a && source .env && set +a

# 4. Start the backend (H2 database, auto-creates schema)
cd backend && ./mvnw spring-boot:run

# 5. In a second terminal: start the Vite dev server
cd frontend && npm install && npm run dev
```

The backend serves the React SPA from `/` and all API routes under `/api`.

- Backend: http://localhost:8080
- Vite dev server: http://localhost:5173 (proxies `/api` to 8080)

## Environment Variable Reference

All variables are documented in [`.env.example`](../.env.example) at the repo root.
Copy that file to `.env` and fill in real values before starting Hermes.

### Quick summary by group

| Group | Key variables | Required? |
|---|---|---|
| Core app | `HERMES_ENV`, `APP_PUBLIC_BASE_URL`, `APP_FORCE_HTTPS` | HERMES_ENV optional; PUBLIC_BASE_URL required in prod |
| Database | `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` | Required in production; H2 default in dev |
| Security | `APP_DATA_ENCRYPTION_KEY` | REQUIRED -- all installs |
| Google OAuth | `APP_GOOGLE_CLIENT_ID`, `APP_GOOGLE_CLIENT_SECRET` | REQUIRED for Google sign-in |
| Strava OAuth | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | REQUIRED for Strava sync |
| Garmin sync | `GARMIN_WELLNESS_SYNC_ENABLED` + interval/days vars | OPTIONAL; scheduler only |
| AI -- Gemini | `APP_AI_API_KEY`, `APP_AI_MODEL` | REQUIRED for AI shoe scan |
| AI -- Qwen | `APP_ROUTE_EXTRACTION_QWEN_*` | OPTIONAL; local GPU pipeline only |
| Geocoding | `APP_GOOGLE_GEOCODING_API_KEY` | OPTIONAL |
| OSRM | `APP_ROUTE_MATCHING_OSRM_BASE_URL` | OPTIONAL; public server default |
| AI agent (Letta) | `APP_AI_AGENT_LETTA_*` | OPTIONAL; experimental |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY` | REQUIRED for payments |
| Email / SMTP | `SPRING_MAIL_HOST`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD` | REQUIRED for email verification |
| reCAPTCHA | `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | OPTIONAL |
| Redis | `APP_REDIS_ENABLED`, `APP_REDIS_KEY_PREFIX` | OPTIONAL |
| Admin bootstrap | `APP_BOOTSTRAP_ADMIN_EMAIL`, `APP_BOOTSTRAP_ADMIN_PASSWORD` | DEV-ONLY; clear after use |

## Production Deployment

### Switch to PostgreSQL

Set these vars in your production environment (do not commit them):

```bash
APP_DB_URL=jdbc:postgresql://your-db-host:5432/hermes
APP_DB_DRIVER=org.postgresql.Driver
APP_DB_USERNAME=hermes_user
APP_DB_PASSWORD=your-secure-password
APP_JPA_DDL_AUTO=validate
```

The Spring `production` profile is activated by `HERMES_ENV=production`
and defaults `APP_FORCE_HTTPS=true` and `APP_JPA_DDL_AUTO=validate`.

### OAuth Callback URLs

Register these redirect URIs in the respective OAuth consoles:

| Provider | Callback URL |
|---|---|
| Google | `https://your-domain/api/auth/google/callback` |
| Strava | `https://your-domain/api/auth/strava/callback` |

Set `APP_GOOGLE_REDIRECT_URI` and `STRAVA_REDIRECT_URI` to match.

### Strava Webhook

Register a push subscription to receive real-time activity events:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID \
  -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://your-domain/api/strava/webhook \
  -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
```

### Stripe Webhook

In the Stripe Dashboard, add a webhook endpoint at `https://your-domain/api/billing/webhook`
listening for `checkout.session.completed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### Nginx Reverse Proxy

Hermes expects to be behind a reverse proxy that terminates TLS. Minimal nginx snippet:

```nginx
server {
    listen 443 ssl;
    server_name hermes.example.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
    }
}
```

## Build Commands

```bash
# Backend -- produces target/*.jar
cd backend && ./mvnw package -DskipTests
java -jar backend/target/backend-*.jar

# Frontend -- builds into backend/src/main/resources/static/
cd frontend && npm install && npm run build
```

## Troubleshooting

**App starts but OAuth login fails**
Check that `APP_GOOGLE_REDIRECT_URI` / `STRAVA_REDIRECT_URI` exactly match what is
registered in the provider console, including the scheme (`https://` in production).

**Strava tokens not persisting / decryption errors**
`APP_DATA_ENCRYPTION_KEY` is missing or changed since tokens were last written.
Generate a fresh key (`openssl rand -hex 32`) and keep it stable across restarts.

**Database migration fails on startup**
In production, `APP_JPA_DDL_AUTO=validate` rejects schema drift. Run a manual migration
or temporarily set `APP_JPA_DDL_AUTO=update` for a controlled upgrade, then revert.

**Email verification links not arriving**
Confirm `SPRING_MAIL_HOST` is set and `APP_PUBLIC_BASE_URL` matches your domain.
Without a mail host set, new password accounts skip verification (dev only).

**Frontend shows a blank page after backend restart**
The Spring-served bundle lives at `backend/target/classes/static/`.
Run `cd frontend && npm run build` to regenerate it, then restart the backend.
