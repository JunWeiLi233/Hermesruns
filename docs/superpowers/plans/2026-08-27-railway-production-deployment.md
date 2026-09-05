# Hermes Railway Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the current Hermes working tree to Railway Hobby with managed PostgreSQL, preserve the existing Cloudflare Access protection for the admin hostname, migrate the local production-shaped data without loss, and cut DNS over only after runtime verification succeeds.

**Architecture:** Build the React frontend and Spring Boot backend in one multi-stage Docker image, run the Java service as an unprivileged user on Railway's injected port, and connect it to a Railway PostgreSQL service over the private network. Cloudflare remains the public DNS, TLS/CDN, and admin identity perimeter. The existing local Cloudflare Tunnel remains available as rollback until both hostnames pass end-to-end checks.

**Tech Stack:** React 19, Vite, Node.js, Java 17, Spring Boot, Maven, PostgreSQL, Docker, Railway CLI, Cloudflare DNS and Access.

---

## Constraints and safety gates

- Deploy the exact dirty working tree in `C:/Users/<local-user>\Downloads\Hermesruns\Hermesruns-main`; do not rebase, reset, or replace the user's uncommitted work.
- Never print, commit, or upload values from `Hermes.local.env.ps1`, `.env`, database URLs, OAuth credentials, Cloudflare tokens, recovery codes, or bootstrap secrets.
- Keep `.git`, local environment files, local database artifacts, logs, task images, caches, and development tools outside the Railway upload context.
- Keep the current local origin and Cloudflare Tunnel intact until Railway, PostgreSQL, public auth, and admin Access checks pass.
- Do not change Cloudflare DNS before a Railway-provided domain returns healthy responses.
- Export the local PostgreSQL database to a temporary ignored path, import it into an empty Railway database, verify row counts, and remove the temporary dump after successful verification.

### Task 1: Lock the deployment contract

**Files:**
- Create: `tools/railway-deployment-contract.smoke.test.mjs`
- Modify: `Dockerfile`
- Modify: `.dockerignore`
- Modify: `backend/src/main/resources/application.properties`
- Create: `.railway/railway.ts`

- [ ] Add a failing source-contract test that requires Java 17 build/runtime images, a non-root runtime user, production source maps disabled, Railway `PORT` binding, a root health check, and exclusion of local secret/data paths.
- [ ] Change the backend bind configuration to `server.address=${APP_SERVER_ADDRESS:127.0.0.1}` and `server.port=${PORT:8080}`, setting `APP_SERVER_ADDRESS=0.0.0.0` only in Railway.
- [ ] Build the frontend with `VITE_SOURCEMAP=false` and package the backend with Java 17.
- [ ] Run the application as a dedicated unprivileged runtime user.
- [ ] Add current Railway Infrastructure-as-Code health-check metadata and retain Railway's `ON_FAILURE` restart policy.
- [ ] Run `node tools/railway-deployment-contract.smoke.test.mjs` and expect `PASS`.

### Task 2: Prove the deployable image locally

**Files:**
- Verify: `Dockerfile`
- Verify: `frontend/scripts/run-vite-build.mjs`
- Verify: `backend/src/main/resources/static/**`

- [ ] Run `cd frontend; node scripts/run-vite-build.mjs` and expect a successful production build with no `.map` files.
- [ ] Run focused backend security tests, then `cd backend; .\mvnw.cmd -q -DskipTests package`.
- [ ] Build the Docker image from the repository root.
- [ ] Start the image with non-secret test configuration and verify `/` returns `200`, the process user is non-root, and the listening port follows `PORT`.

### Task 3: Create Railway infrastructure

**External state:** Railway project, application service, PostgreSQL service.

- [ ] Complete `railway login --browserless` authorization and verify with `railway whoami` without displaying tokens.
- [ ] Create one production project named `Hermesruns`, one application service named `hermes-web`, and one PostgreSQL service.
- [ ] Link the working directory to `hermes-web` and confirm project/environment/service with `railway status`.
- [ ] Configure only the required production variables using Railway references for PostgreSQL credentials and local secret values loaded in-process from `Hermes.local.env.ps1`.
- [ ] Generate a strong random Strava webhook verification token because the local configuration does not currently contain one.
- [ ] Keep optional integrations disabled when their complete credential set is absent; never deploy partial credentials.

### Task 4: Migrate and verify PostgreSQL

**Temporary artifact:** `.tmp/railway-migration/hermes-production.dump` (ignored and removed after verification).

- [ ] Record schema table names, row counts, and database size from the local PostgreSQL database without printing personal row contents.
- [ ] Create a custom-format `pg_dump` with `--no-owner --no-acl`.
- [ ] Restore into the empty Railway PostgreSQL database through its temporary public connection endpoint.
- [ ] Compare schema/table and row counts; fail closed on any mismatch.
- [ ] Remove the temporary dump after the Railway database is verified.

### Task 5: Deploy and verify Railway runtime

**External state:** Railway deployment and generated domain.

- [ ] Run `railway up --service hermes-web --ci` and require terminal status `SUCCESS`.
- [ ] Generate a Railway public domain and verify HTTPS `/` returns `200`.
- [ ] Verify current static entrypoints are served, JavaScript source maps return `404`, security headers are present, and the app reaches PostgreSQL.
- [ ] Verify anonymous `/api/admin/**` access is denied and ordinary user auth cannot produce an admin session.
- [ ] Verify public login configuration exposes Google/Strava options only when complete server-side credential pairs are present.

### Task 6: Cut Cloudflare over with rollback preserved

**External state:** Railway custom domains, Cloudflare DNS records, Cloudflare Access policy.

- [ ] Add `hermesruns.com` and `admin.hermesruns.com` as Railway custom domains and capture the Railway-provided CNAME/TXT records.
- [ ] Add or update Cloudflare DNS records with proxying enabled, preserving the existing Access application for `admin.hermesruns.com/*`.
- [ ] Set Cloudflare SSL/TLS mode required by Railway's proxied-domain guidance and wait for Railway domain verification.
- [ ] Verify `https://hermesruns.com/` is public, `https://admin.hermesruns.com/login` triggers Cloudflare Access, and direct admin API access still fails without a valid signed Access assertion plus Hermes MFA.
- [ ] Update OAuth provider callback URLs only where required and verify callback behavior.
- [ ] Leave the old tunnel configuration present but no longer authoritative until a stable verification window has passed.

### Task 7: Final evidence and operations handoff

- [ ] Record Railway project/service names, generated domain, custom-domain state, deployment ID/status, database count comparison, and runtime checks without secrets.
- [ ] Document the update command (`railway up --service hermes-web --ci`) and Railway usage monitoring.
- [ ] Report any remaining provider-console action that cannot be completed without the user's interactive identity approval.
