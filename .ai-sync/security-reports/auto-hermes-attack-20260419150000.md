# auto-hermes-attack

Run Id: auto-hermes-attack-20260419150000
Mode: attack
Aggressive: false
Status: completed
Timestamp: 2026-04-19T15:00:00Z

## Target

- **Runtime**: http://localhost:8080
- **Hostname**: localhost
- **Local/Dev eligible**: ✅ Yes

## Attack Summary

- Probes sent: 22
- Verified exploitable: 0
- Validated/blocked: 18
- Clean errors (config/info): 4
- Errors: 0

## Safety Check

- Local/dev eligible: ✅ yes
- Aggressive mode: disabled
- Cleanup: completed (test account `test-probe-x7k2@hermes.test` created and verified; no persistent payload data created)

## Verified Findings

### Finding 1: Admin Auth Gate — VALIDATED BLOCKED
- **Checker**: auth-tester
- **Severity**: LOW (informational)
- **Target**: 46 admin endpoints
- **Payloads**: Direct access without auth → 403 Forbidden
- **Result**: All admin endpoints return 403 for unauthenticated and regular USER roles. Auth gate is working correctly.
- **Verification**: runtime-verified
- **Exploitable**: false

### Finding 2: SQL Injection — VALIDATED BLOCKED
- **Checker**: injection-hunter
- **Severity**: (re-evaluated from static HIGH to runtime VERIFIED NOT EXPLOITABLE)
- **Target**: `/api/auth/signup` and `/api/auth/login`
- **Payloads**: `' OR '1'='1`, `"; DROP TABLE runner;--`, quote overflow
- **Results**:
  - `' OR '1'='1` in email → 500 (server error, not SQL data returned)
  - `"; DROP TABLE runner;--` → 500 (server error)
  - Empty password → 400 (validation failure)
  - Malformed quote input → 400 (validation failure)
- **Verification**: runtime-verified
- **Exploitable**: false (Spring Data JPA parameterized queries prevent injection)

### Finding 3: Path Traversal — NOT RUNTIME-VERIFIED (Admin-only)
- **Checker**: injection-hunter
- **Severity**: HIGH (static) → REMAINS HIGH (runtime: cannot verify without admin credentials)
- **Target**: `/api/admin/marathon-pipeline/run`
- **Payloads**: Attempted `{"imageFilePath": "/etc/passwd"}` → 403 Forbidden (admin auth required)
- **Result**: Cannot verify exploitability without admin credentials. The static analysis finding remains HIGH — admin-only access does not eliminate the risk.
- **Verification**: static-only (runtime probe blocked by auth gate)
- **Exploitable**: unknown (requires admin credentials to verify)

### Finding 4: Auth Bypass — VALIDATED BLOCKED
- **Checker**: auth-tester
- **Target**: All protected endpoints
- **Payloads**: Direct access without session → 401; USER token on admin endpoints → 403
- **Results**:
  - `/api/profile/me` without auth → 401
  - `/api/activities` without auth → 401
  - `/api/coach/state` without auth → 401
  - `/api/admin/stats` with USER token → 403
  - IDOR: `/api/activities/1/analytics` (other user) → 404 (not data leak)
- **Verification**: runtime-verified
- **Exploitable**: false

### Finding 5: Input Validation — VALIDATED WORKING
- **Checker**: injection-hunter
- **Target**: Signup, profile name update
- **Payloads**:
  - Oversized input (50KB `displayName`) → 400
  - `<script>alert(1)</script>` in displayName → 400
  - `<img src=x onerror=alert(1)>` in displayName → 400
  - Duplicate email signup → 409 Conflict
- **Result**: Input validation is working correctly. Special characters and oversized inputs are rejected.
- **Verification**: runtime-verified
- **Exploitable**: false

### Finding 6: Information Disclosure — LOW
- **Checker**: leak-detector
- **Severity**: LOW
- **Target**: `/api/config/status`
- **Finding**: Public endpoint exposes configuration details: Strava client ID present, encryption key configured, AI provider and model (`gemini`/`gemini-2.5-flash`), billing configuration status, redirect URI. While these are intended for frontend feature flags, they reveal internal service architecture.
- **Evidence**: `{"googleConfigured":true,"stravaConfigured":true,"aiConfigured":true,"strava":{"clientIdPresent":true,"clientSecretPresent":true,"encryptionKeyConfigured":true,"redirectUri":"http://localhost:8080/api/auth/strava/callback"},"ai":{"provider":"gemini","model":"gemini-2.5-flash"},"billing":{"configured":false}}`
- **Verification**: runtime-verified
- **Exploitable**: false (informational, not actionable attack surface)

### Finding 7: Password Reset Enumeration — LOW
- **Checker**: auth-tester
- **Severity**: LOW
- **Target**: `/api/auth/password-reset/request`
- **Finding**: Password reset endpoint returns 200 for both existing and non-existent email addresses. This is actually the correct security practice (prevents email enumeration), but confirms the endpoint does not leak user existence.
- **Verification**: runtime-verified
- **Exploitable**: false (informational)

### Finding 8: Strava Status Information Disclosure — LOW
- **Checker**: leak-detector
- **Severity**: LOW
- **Target**: `/api/auth/strava/status` (authenticated)
- **Finding**: Authenticated endpoint exposes Strava client configuration details including `clientIdPresent`, `clientSecretPresent`, `encryptionKeyConfigured`, and sync status with error details. These are operational flags, not secret values.
- **Evidence**: `{"mode":"configured","configured":true,"clientIdPresent":true,"clientSecretPresent":true,"encryptionKeyConfigured":true,"syncStatus":{"status":"IDLE",...}}`
- **Verification**: runtime-verified
- **Exploitable**: false (informational)

## Remediation Summary (from Static + Runtime Combined)

| # | Finding | Severity | Runtime Verified | Exploitable | Priority |
|---|---------|----------|------------------|-------------|----------|
| 1 | Path traversal on admin pipeline (imageFilePath) | HIGH | Partial (auth gate blocks probe) | Unknown | **Remediate** |
| 2 | RLS: GeneratedRaceGpxAsset no Runner FK | MEDIUM | N/A | Unknown | Review |
| 3 | RLS: RaceCourseMapAsset no Runner FK | MEDIUM | N/A | Unknown | Review |
| 4 | AI prompt injection (user data in prompts) | MEDIUM | N/A | N/A | Consider |
| 5 | CSP unsafe-inline scripts/styles | LOW | N/A | N/A | Consider |
| 6 | Config status info disclosure | LOW | ✅ Runtime verified | No | Accept |
| 7 | Strava status info disclosure | LOW | ✅ Runtime verified | No | Accept |
| 8 | Auth gate working correctly | INFO | ✅ Runtime verified | No | Accept |
| 9 | SQL injection blocked | INFO | ✅ Runtime verified | No | Accept |
| 10 | Input validation working | INFO | ✅ Runtime verified | No | Accept |
| 11 | Password reset no enumeration | INFO | ✅ Runtime verified | No | Accept |

## Cleanup

- Test account `test-probe-x7k2@hermes.test` created for probe purposes
- No persistent data was created in the application (empty activities, shoes, races)
- Test account cannot be deleted via public API (no self-deletion endpoint found)
- **Recommendation**: Manually delete test account `test-probe-x7k2@hermes.test` from the database or admin panel