---
name: auto-hermes-attack
---

# Auto-Hermes Attack

Repo-local Hermes active attack-simulation command.

## Purpose

Run controlled local/dev-only attack simulation that:

- reuses the shared security inventory from `.tools/auto-hermes-security.mjs`
- exercises auth, input, leak, and config attack paths against local/dev Hermes
- supports a stronger `--aggressive` mode without changing the local/dev-only rule
- writes a Markdown report and JSON summary under `.ai-sync/security-reports/`

## Command Notes

- Preferred engine: `node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --write --runtime-base-url http://localhost:8080`
- Aggressive mode: add `--aggressive`
- This command must block non-local/non-dev runtime targets.
- Controlled mutation only: tagged test state is allowed in local/dev, but cleanup must remain part of the command contract.

## Attack Probes

| Probe | What It Tests |
|---|---|
| Auth Bypass | Hits 11 protected endpoints with no auth, fake Bearer, forged JWT |
| Data Leak | Probes `/api/config/status`, `/api/billing/config` without auth |
| IDOR | Accesses runner data at various IDs without auth |
| Injection | SQL injection + XSS payloads on login and console-errors |
| Mass Assignment | Tests signup with `role=ADMIN`, `subscriptionTier=PRO` |
| Webhook Abuse | Strava webhook with wrong verify_token; Stripe webhook with fake signature |
| CORS | Sends Origin headers from evil.com to check reflection |
| Rate Limit | 25 rapid login attempts |
| Security Headers | Checks for CSP, HSTS, X-Frame-Options, etc. |
| URL Enumeration | Scans for exposed actuator, swagger, .env, .git |
| User Enumeration | Tests password-reset and login differential responses |

## Safety

- Never target production with this command.
- If runtime is unavailable locally, keep the run static and report the skipped active probes honestly.