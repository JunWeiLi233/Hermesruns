# Hermes Security Baseline

Durable owner doc for the enforced security baseline. This maps the standing
security checklist to the code that enforces it, so agents can verify claims
instead of re-auditing from scratch. Paths are relative to `backend/src/main/java/com/hermes/backend/`
unless stated otherwise.

## Checklist Enforcement Map

| Requirement | Enforcement (file) |
| --- | --- |
| Hide API keys | Frontend has no keys or `.env` files; all secrets are backend env vars (`backend/src/main/resources/application.properties`). API base is same-origin in production (`frontend/src/api.ts`). |
| Purge git secrets | No real credentials tracked; `.gitignore` excludes `.env*` and `Hermes.local.env.ps1`. Dev-only defaults (mock password, Strava webhook dev token) are disclosed in `SECURITY.md` and rejected in production by `ProductionSecurityValidator` + `StravaWebhookController`. |
| Use public db keys / no local db in prod | Datasource comes from `APP_DB_URL`/`APP_DB_USER`/`APP_DB_PASSWORD` env vars; `ProductionSecurityValidator.validateDatasource()` blocks H2 in production. |
| Row-level security | H2 dev cannot use PostgreSQL RLS, so row isolation is enforced at the repository layer: `findByIdAndRunner` ownership scoping (`ActivityRepository`, `ShoeRepository`, `RaceEventRepository`) used by every user-facing controller. Unguarded `findById` is only allowed on admin-gated paths or the shared shoe catalog. |
| Encrypt sensitive data | `SecretEncryptionService` (AES-256-GCM, PBKDF2-derived key from `APP_DATA_ENCRYPTION_KEY`) encrypts Strava access/refresh tokens and Garmin credentials at every write; fails closed without the key. |
| Enforce server-side auth | `SecurityConfig` stateless filter chain: `/api/**` authenticated, `/api/admin/**` requires `ROLE_ADMIN`, plus the independent `AdminSecurityFilter`. `JwtAuthenticationFilter` validates DB-backed opaque tokens via `AuthService`. |
| Lock record access | Same ownership scoping as row-level security above; `ShoeController`, `RaceController`, `ShoeImageController` resolve records with `findByIdAndRunner`. |
| Block field tampering | `RequestBodyValidator.rejectUnexpectedFields` runs on every JSON-map endpoint (mass-assignment guard); verified: no controller accepts `@RequestBody Map` without it. |
| Secure session cookies | No cookies by design: bearer tokens are UUIDs stored server-side as SHA-256 hashes and returned only in the login response body (see `SecurityConfig` Javadoc for the CSRF trade-off). |
| Hash passwords | `PasswordHasher`: PBKDF2WithHmacSHA256, 120k iterations, per-user salt, constant-time compare; legacy plaintext rows auto-migrate on login. |
| Rate limit login | `LoginRateLimiter` (10 attempts / 15 min, lockout store) on user and admin login; `PasswordResetLimiter` and `VerificationResendLimiter` for adjacent endpoints. |
| Bot protection | Google reCAPTCHA v3 on signup (`Signup.jsx` + backend verify); `ProductionSecurityValidator` fails production startup without reCAPTCHA keys. |
| Parameterize queries | All native SQL uses bound parameters (`ActivityPointRepository`, `ActivityDataAccess`); no user-reachable string concatenation into SQL. |
| Validate all input | `RequestBodyValidator` (required fields, length caps, type checks) plus `InputSanitizer` (control/HTML char rejection) at every JSON edge; upload endpoints add size/extension/magic-byte checks. |
| Escape user content | React default escaping only; zero `dangerouslySetInnerHTML` in `frontend/src`; server-side `InputSanitizer` strips HTML from stored text. |
| Restrict file uploads | `ImportController` (20MB, 50 files, gpx/tcx/fit/zip allowlist, path-component stripping), `ShoeScanImageValidator` magic bytes, global multipart caps, path-containment checks in `RaceCourseMapImageService`. |
| Trim API responses | `Runner` marks password, session token, Strava/Garmin secrets `@JsonProperty(WRITE_ONLY)` and avatars/token hashes `@JsonIgnore`; admin listing uses `UserAdminDto` with no secrets. |
| Add security headers | `SecurityHeadersFilter`: HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, full CSP. `script-src` has no `'unsafe-inline'` (built SPA loads one external module script). |
| Force https | `HttpsEnforcementFilter` (production): 301 for GET/HEAD, 400 for non-idempotent methods, proxy-safe redirect authority; `server.forward-headers-strategy=framework`; HSTS required by `ProductionSecurityValidator`. |
| Scan dependencies | CodeQL (`.github/workflows/codeql.yml`), Trivy CRITICAL/HIGH gate (`.github/workflows/ci.yml`), Dependabot (`.github/dependabot.yml`). |

## Additional Layers Not In The Checklist

- SSRF: `SafeUrlValidator`/`SafeUrlExecutor` block private/link-local/CGNAT targets at DNS-resolution time and re-validate each redirect hop.
- General API and webhook flood control: `ApiRateLimitFilter`, `WebhookRateLimitFilter`.
- Strava webhook POST callbacks: HMAC-SHA256 signature required in production; unknown `owner_id` rejected before async processing; the development-default verify token is rejected in production.

## Change Rules

- Any new JSON endpoint must use `RequestBodyValidator` with an explicit allowed-field set.
- Any new user-owned record lookup must scope by the authenticated runner, not bare `findById`.
- Any new outbound URL fetch must go through `SafeUrlExecutor`.
- Weakening a header, CSP directive, or production validator check requires updating this file in the same task.
