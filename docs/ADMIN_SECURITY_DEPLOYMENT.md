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

`HERMES_ADMIN_ACCESS_ALLOWED_EMAILS` must match the email in Cloudflare's signed
identity token. This may differ from the Hermes password-login account email.
Copy the exact authorized identity from the Access policy; using a local Hermes
login identifier here can reject a valid password after primary authentication.

For Cloudflare native MFA, enable the approved passkey/security-key or authenticator
methods and enforce MFA on the Hermes Admin application itself. Merely enabling
methods globally does not require them during login. Use a 30-minute authentication
and application session. If an owner has no enrolled method, give the App Launcher
the same exact-owner allow policy so its setup portal is reachable. Keep enrollment
available without requiring a method that the owner has not yet registered; the
Hermes Admin application must still require MFA. Test the resulting owner login.

## 3. Configure Hermes

Set these values in the server's secret/environment manager. Never commit them:

```text
HERMES_ENV=production
SPRING_PROFILES_ACTIVE=production
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
APP_FORCE_HTTPS=true
APP_JPA_DDL_AUTO=validate
HERMES_OFFICIAL_COURSE_STARTUP_SEED_ENABLED=false
APP_TRAININGWORKSPACE_MIGRATE=false
APP_TRAININGWORKSPACE_COOKIESECURE=true
```

The container enables the production profile by default. Selecting that profile
also enables the production validator independently of `HERMES_ENV`. Startup fails
closed when HTTPS, admin MFA, or Cloudflare Access is disabled; origins or the RP
domain are malformed or mismatched; Access settings are missing; schema mutation
or course reseeding is enabled; or an enrollment token is too short.

Apply reviewed schema migrations before deploying. Production uses Hibernate
`validate`; an incompatible schema stops startup instead of changing live data.
Leave official-course startup seeding and automatic workspace migration disabled.
Course review and publication remain deliberate administrator actions. Snapshot
and compare the existing live route fields before and after a release; do not
restore an old map snapshot over an administrator's newer publication.

Do not leave `APP_BOOTSTRAP_ADMIN_EMAIL` or `APP_BOOTSTRAP_ADMIN_PASSWORD` configured
in production. These development account-creation credentials are separate from
the temporary MFA enrollment token and are never needed for routine login.

On Railway, `railway variable set --skip-deploys` stages these values without
starting a release. Confirm the schema, backup, and owner MFA before deploying
the reviewed artifact. The working checkout may contain unrelated changes; do
not release the entire checkout merely to apply a security fix.

### Persistent map storage and recovery

Attach a persistent volume to `hermes-web`, for example at `/data`, and use
`HERMES_COURSE_MAP_UPLOAD_DIR=/data/course-map-images`. Railway supplies
`RAILWAY_VOLUME_MOUNT_PATH` at runtime. The production validator requires the
course directory to be an absolute path within that mount when running on Railway.
The guard checks configuration; release verification must also confirm the mount
exists and is writable by the application's non-root user. Initialize the volume's
ownership for that user before starting Hermes; do not run the application as root
to work around permissions.

Before attaching storage or replacing a container, export any existing course
source files and local route artifacts from the running instance. A new volume
does not copy the old container's files. Restore these files to the new volume,
retain the database's artifact references, and check a source download and route
render after release. Do not publish pending routes during this check.

Create an encrypted PostgreSQL backup and a separate backup of map files before
release. Configure retention and automated backups in the chosen backup service,
then verify restoration into an isolated database and storage location. Keep the
live-route fingerprint before and after release. An empty backup history or a
volume without a tested restore leaves deployment recovery unverified.

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

## Local Windows enrollment for an existing administrator

Start Hermes normally, then run this from the serving checkout in a PowerShell terminal:

```powershell
.\tools\enroll-local-admin.ps1
```

The helper checks the runtime marker, serving process, loopback listener, and local
database configuration. It compiles the bootstrap safeguard separately from the
running backend, then briefly restarts that backend. It keeps existing account
passwords and roles and passes a random enrollment token through the server's
process environment. The token is displayed only in your local terminal; it is
not written to a config file, command line, or batch script.

Open `http://localhost:8080/login` in your browser, sign in with the existing admin
account, and use the displayed token if first-time passkey setup is requested.
Complete your device's biometric/PIN prompt and save your password and recovery
codes in a password manager. An already enrolled account still requires its
existing passkey or recovery code; a bootstrap token cannot reopen enrollment.

Keep the terminal open. Once you have completed sign-in and saved your
credentials, press Enter there. The helper removes the bootstrap assignments
from `Hermes.local.env.ps1` and restarts Hermes without the enrollment token.
Cancellation also attempts the restart without the token. If the terminal is
forcibly closed, restart Hermes normally to end the temporary enrollment process.

Use `-CheckOnly` to check prerequisites without restarting anything. This helper
requires an existing local admin and `Hermes.local.env.ps1`; it does not create or
promote accounts, reset passwords, or support production enrollment.

## References

- Cloudflare Access application-token validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Cloudflare Access application tokens: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
- Yubico Java WebAuthn server: https://github.com/Yubico/java-webauthn-server
