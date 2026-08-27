# Hermes Mandatory Admin Passkey MFA Design

Date: 2026-08-26
Status: Approved and implemented
Scope: Password, Google, and Strava sign-in paths for accounts with role `ADMIN`

## Objective

An administrator must not receive a bearer token, an admin portal cookie, or access to any admin document/API after only a password or OAuth assertion. A second factor must be completed first. The primary factor remains on the public `/login` surface; `/admin` stays concealed from unauthenticated callers.

The preferred second factor is WebAuthn/passkey authentication with user verification. One-time recovery codes provide emergency recovery. Normal runner login behavior is unchanged.

## Security properties

- No admin session credential is issued before successful passkey or recovery-code verification.
- The server verifies WebAuthn origin, relying-party ID, challenge, credential ownership, user verification, and signature through a maintained library.
- Primary-authentication and WebAuthn challenges are random, short-lived, single-use, attempt-limited, and stored server-side.
- Challenge identifiers exist only in an `HttpOnly`, `SameSite=Strict` cookie. They are hashed before persistence.
- Admin login errors remain generic and do not reveal whether an email, password, passkey, or account exists.
- Password, Google, and Strava admin authentication all enter the same MFA gate.
- Admin API requests continue to require an explicit bearer token. The portal cookie never authorizes API mutations.
- A valid non-admin account can never enter the admin MFA flow or obtain an admin grant.
- Recovery codes are random, displayed once, stored only as hashes, and consumed atomically.
- The first passkey cannot be enrolled using a password alone.

## Approaches considered

### 1. Spring Security passkey/MFA configuration

Spring Security 7 supports passkeys and multi-factor authorization. Its standard flow is built around Spring authentication sessions, CSRF-backed WebAuthn option repositories, and Spring-managed user credentials. Hermes currently uses custom stateless bearer tokens and explicitly disables form login and server sessions. Adopting this path would require replacing or splitting the existing authentication architecture.

Result: rejected for this bounded change because it creates a larger authentication migration and increases regression risk.

### 2. Yubico WebAuthn verifier within the Hermes auth flow

Use `com.yubico:webauthn-server-core` for the WebAuthn relying-party operations while Hermes owns account lookup, challenge persistence, session issuance, role authorization, rate limiting, and recovery.

Result: selected. It preserves the current stateless application session while delegating WebAuthn cryptographic validation to a maintained implementation.

### 3. TOTP-only MFA

TOTP is easier to deploy but manually entered codes are relayable and not phishing-resistant. It also introduces a server-side shared secret that must be encrypted and rotated.

Result: rejected as the primary admin factor. One-time recovery codes are included instead of TOTP in this first release.

## Package and component boundaries

New backend code belongs under `com.hermes.backend.auth.mfa` rather than expanding the legacy root package.

- `AdminMfaController`: public challenge endpoints and authenticated credential-management endpoints.
- `AdminMfaService`: orchestration and the only component allowed to finalize admin login.
- `AdminWebAuthnService`: adapter around the Yubico relying-party API.
- `AdminMfaChallengeService`: creates, hashes, validates, attempts, consumes, and expires challenges.
- `AdminMfaCredentialRepositoryAdapter`: exposes stored credentials to the WebAuthn library.
- `AdminMfaProperties`: validates RP ID, allowed origins, expiry, and bootstrap configuration.
- JPA entities/repositories for profiles, passkeys, challenges, and recovery codes.

`LoginController` and `OAuthController` may verify the primary factor, but must call `AdminMfaService.beginPrimaryAuthenticatedFlow(...)` for an admin and return/redirect without issuing a session token.

## Persistence model

### `AdminMfaProfile`

- One row per admin runner; runner ID is unique.
- Stable random WebAuthn user handle.
- `bootstrapCompletedAt`, `recoveryCodesIssuedAt`, and timestamps.
- Bootstrap completion remains recorded even if every credential is later removed, preventing reuse of the initial bootstrap secret.

### `AdminPasskeyCredential`

- Runner/profile relationship.
- Unique credential ID, COSE public key, stable user handle, signature counter, transports, credential label, backup eligibility/state, created time, and last-used time.
- Binary credential material uses database-safe binary columns compatible with H2 and PostgreSQL.

### `AdminMfaChallenge`

- SHA-256 hash of a random opaque cookie value; the plaintext selector is never persisted.
- Runner ID, purpose (`AUTHENTICATION` or `REGISTRATION`), primary method, serialized WebAuthn request, expiry, attempts, consumed time, and bootstrap-verification time.
- Five-minute expiry, maximum five failed verification attempts, and atomic single-use consumption.
- Scheduled/bounded cleanup removes expired or consumed rows.

### `AdminRecoveryCode`

- Runner/profile relationship, code hash, creation time, and atomic used time.
- Ten 128-bit random codes are generated after initial passkey enrollment and shown exactly once.

### Admin session proof

The runner session record gains `adminMfaVerifiedAt` and `adminMfaMethod`. `AuthService.invalidateSession` clears both. Admin filters require both a fresh token and fresh MFA proof; a token issued through any path without MFA cannot authorize an admin document or API.

## Configuration

Add environment-driven properties:

- `HERMES_WEBAUTHN_RP_ID` / `app.security.admin-mfa.rp-id`, default `localhost` in development.
- `HERMES_WEBAUTHN_ALLOWED_ORIGINS` / `app.security.admin-mfa.allowed-origins`, default `http://localhost:8080` in development.
- `HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN` / `app.security.admin-mfa.bootstrap-token`, with no committed default.
- RP display name defaults to `Hermes Admin`.

Production validation rejects non-HTTPS origins, loopback RP IDs, wildcard origins, and bootstrap secrets shorter than 32 characters. Localhost remains valid for local WebAuthn development. No secrets are logged or returned.

## Login and enrollment flows

### Existing admin with a passkey

1. Admin submits password on `/login`, or completes Google/Strava primary authentication.
2. The backend verifies the primary factor and role.
3. The backend invalidates any old session, creates a five-minute MFA challenge, and sets the challenge cookie.
4. Password login returns `202` with `code=ADMIN_MFA_REQUIRED`; OAuth redirects to `/login?adminMfa=required`.
5. The frontend requests WebAuthn assertion options and invokes `navigator.credentials.get()`.
6. The browser response is posted to the verification endpoint.
7. After successful library verification, the challenge is consumed, `lastUsedAt` and signature state are updated, recovery/risk signals are audited, and only then is the bearer token plus admin portal cookie issued.
8. The frontend commits the token and navigates to `/dashboard`.

### First passkey enrollment

1. Primary admin authentication succeeds, but no passkey exists.
2. The backend returns `202` with `code=ADMIN_MFA_SETUP_REQUIRED` and sets the same short-lived challenge cookie.
3. The login card asks for the separately configured bootstrap token.
4. Registration options require a valid primary challenge, an unused MFA profile, no existing credential, and a constant-time match against the configured bootstrap token.
5. The frontend invokes `navigator.credentials.create()` with user verification required and discoverable-credential preference.
6. Successful registration stores the credential, permanently marks bootstrap complete, generates recovery codes, consumes the challenge, and issues the first MFA-backed admin session.
7. Recovery codes are displayed once before dashboard navigation and can be copied/downloaded by the administrator.

If the bootstrap token is absent or invalid, enrollment fails closed. Once bootstrap is marked complete it cannot be reused, even if credentials are later removed. Recovery after losing every passkey requires an existing recovery code or an explicit operator/database reset outside the public web flow.

### Recovery-code login

After primary authentication, the administrator may choose recovery. A valid unused code is atomically consumed, audited, and may issue an MFA-backed session. The UI warns the administrator to add a replacement passkey. Recovery never bypasses the primary factor.

### Normal runner login

Normal users retain the existing response and token flow. They never receive an admin MFA challenge or admin cookie.

## HTTP contract

- `POST /api/auth/login`
  - Normal runner: existing `200` token response.
  - Admin: `202` with `ADMIN_MFA_REQUIRED` or `ADMIN_MFA_SETUP_REQUIRED`; no token.
- `POST /api/auth/admin-login`
  - Kept temporarily for compatibility but follows exactly the same MFA contract and never issues a password-only token.
- `POST /api/auth/admin-mfa/authentication/options`
- `POST /api/auth/admin-mfa/authentication/verify`
- `POST /api/auth/admin-mfa/registration/options`
- `POST /api/auth/admin-mfa/registration/verify`
- `POST /api/auth/admin-mfa/recovery/verify`
- `DELETE /api/auth/admin-mfa/challenge` cancels and clears the current challenge.
- Authenticated management endpoints under `/api/admin/mfa/**` list, add, rename, and revoke credentials/recovery codes. Removing the final passkey requires recent passkey verification and is prohibited unless another passkey exists.

All public MFA endpoints use generic errors, `Cache-Control: no-store`, strict request schemas, origin checks, IP and account/challenge throttles, and bounded body sizes.

## Frontend behavior

`Login.jsx` remains the only public sign-in surface and becomes a three-state flow:

- primary email/password entry;
- passkey verification or recovery-code entry;
- first-time passkey enrollment plus one-time recovery-code display.

A small `webauthn.js` utility performs strict base64url conversion and wraps `navigator.credentials.create/get`. Browser cancellation is reported without exposing server details. Unsupported browsers offer recovery only; they do not fall back to password-only admin access.

All new user-visible strings are added in both `zh-CN` and `en` locale owners. `/admin` remains concealed and is not restored as a public page.

## Rate limiting and audit

- Keep the existing IP login limit.
- Add an account-keyed admin primary-auth limit using a non-reversible email fingerprint.
- Apply per-IP and per-challenge limits to MFA options and verification.
- Audit successful enrollment, authentication method, recovery use, credential addition/removal, challenge exhaustion, and attempted bootstrap reuse without recording secrets or raw credentials.
- Successful primary authentication does not reset the account limiter until MFA completes.

## Failure behavior

- Missing/expired/consumed challenge: `401` generic authentication failure and clear challenge cookie.
- Invalid WebAuthn response or origin/RP mismatch: `401`, increment challenge attempts, no session.
- Exhausted challenge: consume it and require the primary factor again.
- Missing bootstrap configuration: `503` setup unavailable, no password-only escape hatch.
- Credential counter regression: deny by default and audit, except library-recognized backup-capable multi-device credentials where the stored backup state is safely updated.
- Database race on recovery/challenge consumption: exactly one transaction succeeds.

## Testing strategy

Backend tests are written first and observed failing before implementation:

- Admin password and OAuth primary authentication never issue tokens/cookies before MFA.
- Normal runner behavior remains unchanged.
- Registration requires primary authentication plus the bootstrap secret and cannot be repeated.
- Authentication validates challenge, origin, RP ID, user verification, credential owner, signature, expiry, attempts, and single use.
- Recovery codes are hashed, one-time, and race-safe.
- Admin filters reject tokens lacking fresh MFA proof.
- Logout/password reset clears MFA proof.
- H2 repository tests and PostgreSQL-compatible mappings.
- Security route tests prove public MFA endpoints expose no admin data and all management endpoints require a fresh admin bearer token.

Frontend tests cover response-state transitions, binary encoding, browser cancellation, unsupported WebAuthn, recovery, bilingual copy, and the rule that `login(...)` is called only after MFA verification.

Final verification includes targeted backend tests, the broader authentication/security suite, frontend unit/contracts/typecheck/build, correct-backend restart, anonymous/normal-user/forged-challenge probes, and a browser virtual-authenticator registration/login ceremony on `http://localhost:8080`.

## Rollout and compatibility

- Schema creation uses existing Hibernate update behavior and remains H2/PostgreSQL compatible.
- Existing admin accounts are intentionally locked out until first enrollment is completed with the bootstrap secret.
- Existing normal-user sessions are unaffected.
- Existing admin tokens created before this feature fail the new MFA-proof requirement and must sign in again.
- Deployment documentation must instruct the operator to set RP/origin/bootstrap variables, enroll the first passkey, store recovery codes, and then remove the bootstrap token from the runtime environment.

## Non-goals

- Mandatory MFA for normal runners.
- SMS or email OTP.
- Passwordless admin login; password/OAuth remains the first factor.
- A general migration from Hermes bearer tokens to Spring HTTP sessions.

## References

- Spring Security passkeys: https://docs.spring.io/spring-security/reference/servlet/authentication/passkeys.html
- Spring Security MFA: https://docs.spring.io/spring-security/reference/servlet/authentication/mfa.html
- Yubico Java WebAuthn server: https://github.com/Yubico/java-webauthn-server
- NIST authenticator guidance: https://pages.nist.gov/800-63-4/sp800-63b/authenticators/
