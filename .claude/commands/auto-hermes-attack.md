---
name: auto-hermes-attack
description: Synthetic resilience probe — non-destructive failure-mode tests against high-risk surfaces (auth expired, weather outage, malformed file, partial sync). Records findings as bounded tech-debt tasks.
---

# Hermes Attack Simulation

Run controlled local/dev attack simulation against Hermes.

## Runtime Identity

- **Runtime**: Claude Code
- **Execution model**: one-shot attack simulation
- **Shared engine**: `.tools/auto-hermes-security.mjs`
- **Writeback target**: `.ai-sync/security-reports/`

## Purpose

`/auto-hermes-attack` sends controlled payloads to local/dev Hermes targets to verify exploitability of potential vulnerabilities found by `/auto-hermes-security`.

It does **NOT** auto-fix code. It only probes, records, and reports.

## What It Does

1. Verify target is local/dev eligible (Safety Gate)
2. Discover attack surfaces from repo code (tables, endpoints, forms, config)
3. Send controlled HTTP probes: auth bypass, data leak, IDOR, SQL injection, XSS, mass assignment, webhook abuse, CORS, rate limit, security headers, hidden URLs
4. Record which probes succeeded vs were blocked
5. Generate findings with `verification: runtime-verified` vs `static-only`
6. Write Markdown + JSON reports to `.ai-sync/security-reports/`
7. Optionally write HIGH/CRITICAL findings to `TASKS.md`

## Preferred Invocation

```bash
node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --write --runtime-base-url http://localhost:8080
```

### With task writeback:

```bash
node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --write --write-tasks --runtime-base-url http://localhost:8080
```

### Aggressive mode (stronger payloads, dev-only):

```bash
node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --write --aggressive --runtime-base-url http://localhost:8080
```

### JSON output for CI:

```bash
node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --write --json --runtime-base-url http://localhost:8080
```

## Arguments

| Argument | Description | Default |
|---|---|---|
| `--mode attack` | Required: enables attack mode | — |
| `--runtime-base-url <url>` | Required: target URL for active probing | — |
| `--write` | Write report files to `.ai-sync/security-reports/` | false |
| `--write-tasks` | Write HIGH/CRITICAL findings to `TASKS.md` | false |
| `--aggressive` | Enable stronger attack payloads (dev-only) | false |
| `--json` | Output JSON instead of Markdown | false |

## Safety

- **NEVER target production** — the tool blocks non-local/non-dev URLs
- Controlled mutation only: tagged test state, no persistent damage
- Cleanup is part of the command contract

## Attack Probes

| Probe | What It Tests |
|---|---|
| Auth Bypass | Hits 11 protected endpoints with no auth, fake Bearer, forged JWT |
| Data Leak | Probes `/api/config/status`, `/api/billing/config` without auth |
| IDOR | Accesses runner data at various IDs without auth |
| Injection | SQL injection + XSS payloads on login and console-errors |
| Mass Assignment | Tests signup with `role=ADMIN`, `subscriptionTier=PRO` |
| Webhook Abuse | Strava webhook with wrong verify_token + forged events; Stripe webhook with fake signature |
| CORS | Sends Origin headers from evil.com to check reflection |
| Rate Limit | 25 rapid login attempts |
| Security Headers | Checks for CSP, HSTS, X-Frame-Options, etc. |
| URL Enumeration | Scans for exposed actuator, swagger, .env, .git endpoints |
| User Enumeration | Tests password-reset and login differential responses |

## Truth Rules

- `runtime-verified` means "probe confirmed at runtime" — not "exploited in production"
- Do not claim a vulnerability is exploitable beyond tested payloads
- Always disclose cleanup status honestly
- This command is NOT a self-loop or fix engine