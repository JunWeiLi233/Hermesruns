# Hermes Admin Security Deployment

Hermes administrator access is designed as three independent gates:

1. Cloudflare Access verifies the approved operator identity before the origin serves any admin route.
2. Hermes verifies the account password, Google identity, or Strava identity as the primary factor.
3. Hermes requires a passkey with user verification, or a single-use recovery code, before issuing an admin bearer token or portal cookie.

An ordinary runner, a caller that only knows an admin password, and a caller that forges `Cf-Access-Authenticated-User-Email` must all be denied. Hermes validates the signed `Cf-Access-Jwt-Assertion` at the origin.

## 1. Put the admin hostname behind Cloudflare Tunnel

Use a dedicated hostname such as `admin.example.com`. Do not expose the origin port directly to the public internet. A minimal tunnel ingress is:

```yaml
ingress:
  - hostname: admin.example.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Restrict the host firewall so only the local tunnel process can reach Hermes. The public application hostname should not proxy `/admin`, `/dashboard`, `/workflows`, `/api/admin/**`, `/api/auth/admin-login`, or `/api/auth/admin-mfa/**` to an unprotected origin.

## 2. Create the Cloudflare Access application

Create a self-hosted Access application for `admin.example.com/*`.

- Include only the exact administrator identity or a dedicated administrator group.
- Require the identity provider's MFA or passkey policy.
- Use a short Access session duration.
- Copy the application's audience (`AUD`) value.
- Note the team domain, for example `https://team-name.cloudflareaccess.com`.

Do not authorize by an unsigned request header. Hermes ignores Cloudflare's convenience email header and validates the signed Access JWT, issuer, audience, expiry, and exact email allowlist.

## 3. Configure Hermes

Set these values in the server's secret/environment manager. Never commit them:

```text
HERMES_ENV=production
HERMES_ADMIN_MFA_ENABLED=true
HERMES_WEBAUTHN_RP_ID=admin.example.com
HERMES_WEBAUTHN_RP_NAME=Hermes Admin
HERMES_WEBAUTHN_ALLOWED_ORIGINS=https://admin.example.com
HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN=<at-least-32-random-characters>
HERMES_ADMIN_ACCESS_ENABLED=true
HERMES_ADMIN_ACCESS_TEAM_DOMAIN=https://team-name.cloudflareaccess.com
HERMES_ADMIN_ACCESS_AUDIENCE=<cloudflare-access-aud>
HERMES_ADMIN_ACCESS_ALLOWED_EMAILS=owner@example.com
APP_ENABLE_HSTS=true
```

Production startup fails closed when admin MFA or Cloudflare Access is disabled, the RP/origin is unsafe, the Access settings are missing, or a configured bootstrap token is too short.

If Google or Strava may authenticate the admin account, their callback URL must use the protected admin hostname. A callback delivered through an unprotected hostname cannot complete an admin login.

## 4. Enroll the first passkey

1. Start Hermes with the bootstrap token configured.
2. Open `https://admin.example.com/login` and complete Cloudflare Access.
3. Sign in with the administrator's existing primary factor.
4. Enter the separately stored bootstrap token when Hermes requests initial setup.
5. Register a device-bound security key or platform passkey and complete local biometric/PIN verification.
6. Store the ten recovery codes in an offline password manager or physical safe. Each code works once.
7. Remove `HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN` from the environment and restart Hermes.

The database permanently records that bootstrap enrollment completed, so restoring the old bootstrap secret does not reopen enrollment.

## 5. Routine operations and recovery

- Add a second passkey before relying on a single device.
- Credential management endpoints require a fresh MFA-backed admin bearer token.
- Passkey deletion and recovery-code regeneration require that the current session was verified by a passkey, not by a recovery code.
- Hermes refuses to delete the final passkey.
- Losing every passkey and every recovery code requires an explicit operator/database recovery; there is no public password-only reset path.
- Rotate recovery codes after using one and review the administrator audit feed for enrollment, recovery, and credential changes.

## 6. Verification checklist

- An anonymous request to `/admin` returns `404`.
- An anonymous or normal-runner request to `/api/admin/**` returns `403`.
- A forged `Cf-Access-Authenticated-User-Email` without a valid signed Access JWT is rejected.
- Correct admin password alone returns an MFA challenge and no bearer token or admin portal cookie.
- Correct Google/Strava identity alone does the same.
- An expired/reused challenge, wrong origin, wrong RP ID, wrong credential owner, failed signature, or consumed recovery code cannot issue a session.
- The admin dashboard opens only after successful passkey or recovery verification.

For local development, `localhost` and `http://localhost:8080` are supported by the WebAuthn secure-context exception. Do not reuse those values in production.

## References

- Cloudflare Access application-token validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Cloudflare Access application tokens: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
- Yubico Java WebAuthn server: https://github.com/Yubico/java-webauthn-server
