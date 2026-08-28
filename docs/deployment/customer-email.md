# Customer email deployment runbook

Hermes separates human support mail from automated transactional mail. This document is a configuration and verification guide only; it does not provision accounts, change DNS, or send mail.

## Ownership boundaries

| System | Owns | Required boundary |
| --- | --- | --- |
| Google Workspace | The root-domain human support mailbox `support@hermesruns.com` | Use it for human support and recipient replies. |
| Resend | Automated transactional sending on `mail.hermesruns.com` only | Send as `Hermes <no-reply@mail.hermesruns.com>` with `Reply-To: support@hermesruns.com`. |
| Railway | Runtime environment variables and the application process | The application uses Resend's outbound HTTPS API only, never SMTP. |
| Cloudflare | Authoritative DNS hosting | Preserve existing apex, `www`, and `admin` web records while adding only provider-required mail records. |

Google Workspace is not the automated sender, and Resend is not the human inbox host. Keep those roles separate.

## Railway variable checklist

Set these values in the authenticated Railway project/service configuration. Do not commit a real secret, paste one into a terminal history, or include one in screenshots or logs.

| Variable | Production value or safe sentinel |
| --- | --- |
| `HERMES_ENV` | `production` |
| `APP_MAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | `<set-in-railway-dashboard>` |
| `APP_MAIL_FROM` | `Hermes <no-reply@mail.hermesruns.com>` |
| `APP_MAIL_REPLY_TO` | `support@hermesruns.com` |
| `APP_PUBLIC_BASE_URL` | `https://hermesruns.com` |

For local development, use `APP_MAIL_PROVIDER=disabled`, leave `RESEND_API_KEY` empty, and use `APP_PUBLIC_BASE_URL=http://localhost:8080`. Disabled local mail must remain unable to send.

## Provisioning sequence

1. Obtain user action-time confirmation before starting a paid Google Workspace checkout. That purchase/configuration is a separate external step and is not implied by this runbook.
2. In the authenticated Google Workspace Admin console, create and verify the root-domain support mailbox `support@hermesruns.com`.
3. In the authenticated Resend dashboard, add and verify only the `mail.hermesruns.com` sending domain. Create a least-privilege API key for the Railway runtime.
4. In Cloudflare DNS, copy the exact Google Workspace and Resend provider-generated records. Do not invent, approximate, merge, or reuse record values from examples. Preserve the apex, `www`, and `admin` web records.
5. After both providers show their domains as verified, enter the Railway variables from the checklist and deploy the application.
6. Complete the focused local checks and the production smoke checks below before treating email delivery as ready.

## DNS and authentication verification

Retrieve Workspace and Resend DNS values from their authenticated dashboards at the time of configuration and copy them exactly. This includes any provider-generated verification, MX, SPF, DKIM, or related records. Do not put provider-generated values in this repository.

- Google Workspace: verify the root domain's mailbox activation and the exact inbound mail records in the Workspace Admin console. Confirm that the support mailbox can receive a message after DNS propagation.
- Resend: verify the `mail.hermesruns.com` sending domain in the Resend dashboard before enabling Railway delivery. Confirm the dashboard reports the expected domain/authentication status.
- SPF and DKIM: publish the exact provider-generated records and check each provider's verification result. Do not guess record names, selectors, includes, or key material.
- DMARC: review the existing root-domain DMARC policy before adding mail services. Coordinate any policy change with the domain owner, keep it aligned with the verified sender domains, and do not replace it with a fabricated example record.
- Cloudflare: leave unrelated web records intact. Mail records must coexist with the apex, `www`, and `admin` records rather than replacing them.

## Local and focused verification

From the repository root, validate the mail integration without contacting a provider:

```powershell
Push-Location backend
try {
  .\mvnw.cmd -q "-Dtest=TransactionalMailConfigurationTests,ResendTransactionalMailConfigurationTests,ResendTransactionalMailSenderTests,EmailVerificationServiceTests,PasswordResetServiceTests,ProductionSecurityValidatorTests" test
  if ($LASTEXITCODE -ne 0) { throw "Focused mail tests failed with exit code $LASTEXITCODE." }

  .\mvnw.cmd -q -DskipTests compile
  if ($LASTEXITCODE -ne 0) { throw "Backend compile failed with exit code $LASTEXITCODE." }
}
finally {
  Pop-Location
}
```

Also load `Hermes.local.env.example.ps1` only through a copied local environment file and confirm its provider remains `disabled`. Do not add a delivery key merely to exercise local startup.

## Production verification

After a Railway deployment has completed, verify the exact project ID or name, production environment name, and backend service name in the authenticated Railway dashboard before running any CLI command. Do not rely on the current directory's Railway link metadata.

```powershell
$RailwayProject = "<verified-railway-project-id-or-name>"
$RailwayEnvironment = "<verified-production-environment-name>"
$RailwayBackendService = "<verified-backend-service-name>"

if ($RailwayProject -like "<*" -or $RailwayEnvironment -like "<*" -or $RailwayBackendService -like "<*") {
  throw "Replace the Railway placeholders with identifiers verified in the authenticated Railway dashboard."
}

railway status --project $RailwayProject --environment $RailwayEnvironment
railway logs --project $RailwayProject --environment $RailwayEnvironment --service $RailwayBackendService --latest --lines 100
Invoke-WebRequest -UseBasicParsing https://hermesruns.com/
```

Review logs only for the sanitized provider state and delivery outcome; never expose message contents, reset tokens, recipients, or credentials. Then perform these controlled smoke checks with a dedicated test account and inbox:

1. Sign up with the test account and confirm exactly one account-verification message arrives from `Hermes <no-reply@mail.hermesruns.com>` with `Reply-To: support@hermesruns.com`.
2. Complete the verification link in the test message and confirm the account becomes verified.
3. Request a password reset for the same account. Confirm one reset message arrives, use its link once, set a new test-only password, and confirm login succeeds.
4. Request a reset for an unknown address and confirm the public response does not reveal whether that account exists.
5. Check the Railway service logs and Resend dashboard for a successful, sanitized delivery result. Do not copy message bodies, links, or recipient addresses into tickets or this repository.

## Failure and rollback order

`APP_MAIL_PROVIDER=disabled` is for local development only; it cannot be used as a production kill switch because `HERMES_ENV=production` requires the Resend configuration and would fail startup.

1. To stop urgent delivery, have an authorized operator revoke or remove the active Resend API key in the authenticated Resend dashboard first and confirm that the credential is no longer active. This runbook does not perform that external action.
2. After delivery has stopped at the provider, roll Railway back to the last known-good deployment and configuration if the incident began with an application release or runtime configuration change.
3. Preserve provider verification records and the existing apex, `www`, and `admin` web records throughout incident response. Do not remove DNS records as a first response.
4. For a suspected key compromise, keep the compromised key revoked, create a replacement in Resend, update Railway with the replacement credential, deploy, and complete all production smoke checks before resuming delivery.
5. Production remains configured with `APP_MAIL_PROVIDER=resend`; if sending was paused in the Resend dashboard, re-enable it only after Resend domain verification, Workspace mailbox verification, Railway status, and all production smoke checks succeed.

## Secret rotation and revocation

Rotate the Resend API key from the authenticated Resend dashboard: create a replacement, update the Railway runtime variable, deploy, and verify account-verification and password-reset delivery with the dedicated test account. Revoke the old key only after the replacement succeeds. Revoke suspected exposed keys immediately, keep them revoked until a replacement is verified, and never record a key value in source control, shell history, logs, screenshots, or support tickets.

Workspace administrator credentials, Resend dashboard access, and Railway access are separate credentials. Apply each provider's account-recovery and access-review process independently; this runbook intentionally contains no account data or secrets.
