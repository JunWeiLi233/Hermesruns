# Hermes Customer Email System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Railway-incompatible SMTP path with a secure Resend HTTPS transactional-email adapter, keep human support mail in Google Workspace at `support@hermesruns.com`, and deploy the complete mail/DNS configuration without weakening existing signup or password-reset protections.

**Architecture:** The Spring backend sends verification and password-reset messages through a small provider-neutral `TransactionalMailSender` contract. A Resend adapter owns HTTPS request construction, timeout/retry behavior, sanitized errors, and provider receipts. Google Workspace owns the root-domain support mailbox; Resend owns only the `mail.hermesruns.com` sending subdomain. Production startup fails closed when the selected provider or required mail settings are missing or unsafe.

**Tech Stack:** Java 17, Spring Boot 4.1, Java `HttpClient`, Jackson, JUnit 5, Mockito, Railway, Resend, Google Workspace, Cloudflare DNS, PowerShell DNS/HTTP probes.

---

## Guardrails before implementation

- Work from `C:/Users/<local-user>\Downloads\Hermesruns\Hermesruns-main` on the current branch.
- Preserve every unrelated modified or untracked file. Stage and commit only the exact files listed by each task.
- Never print or commit `RESEND_API_KEY`, Google Workspace credentials, provider-generated verification tokens, password-reset links, or email bodies.
- Do not change the existing signup rollback rule: a newly inserted runner row is deleted when verification delivery fails, while a recycled soft-deleted account is retained.
- Do not change password-reset enumeration protection, rate limits, token hashing, or expiration durations.
- Do not purchase Google Workspace or submit any paid checkout without fresh action-time confirmation from the user.
- Provider-generated DNS values must be copied exactly from the authenticated provider screen during execution; do not guess them or substitute example values.

## Task 1: Add the provider-neutral transactional mail contract

**Files:**

- Create: `backend/src/main/java/com/hermes/backend/infrastructure/mail/TransactionalMailMessage.java`
- Create: `backend/src/main/java/com/hermes/backend/infrastructure/mail/MailDeliveryReceipt.java`
- Create: `backend/src/main/java/com/hermes/backend/infrastructure/mail/MailDeliveryException.java`
- Create: `backend/src/main/java/com/hermes/backend/infrastructure/mail/TransactionalMailSender.java`
- Create: `backend/src/main/java/com/hermes/backend/infrastructure/mail/DisabledTransactionalMailSender.java`
- Create: `backend/src/main/java/com/hermes/backend/infrastructure/mail/TransactionalMailConfiguration.java`
- Create: `backend/src/test/java/com/hermes/backend/infrastructure/mail/TransactionalMailConfigurationTests.java`

- [ ] **Step 1: Write a failing configuration test**

Use `ApplicationContextRunner` to prove that no provider setting produces one disabled sender and that the disabled sender rejects delivery without leaking message content:

```java
class TransactionalMailConfigurationTests {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TransactionalMailConfiguration.class)
            .withBean(ObjectMapper.class, ObjectMapper::new);

    @Test
    void disabledProviderExposesAnUnconfiguredSender() {
        contextRunner.run(context -> {
            TransactionalMailSender sender = context.getBean(TransactionalMailSender.class);
            assertThat(sender.isConfigured()).isFalse();
            assertThatThrownBy(() -> sender.send(new TransactionalMailMessage(
                    "runner@example.test", "Subject", "Text", "<p>Text</p>", "event-1")))
                    .isInstanceOf(MailDeliveryException.class)
                    .hasMessage("Transactional mail is not configured");
        });
    }
}
```

- [ ] **Step 2: Run the test and confirm the expected compile failure**

Run:

```powershell
./mvnw -q -f backend/pom.xml -Dtest=TransactionalMailConfigurationTests test
```

Expected: compilation fails because the contract and configuration classes do not exist.

- [ ] **Step 3: Implement immutable mail value objects and the sender contract**

Use these exact public shapes:

```java
public record TransactionalMailMessage(
        String to,
        String subject,
        String text,
        String html,
        String idempotencyKey) {
}
```

```java
public record MailDeliveryReceipt(String providerMessageId) {
}
```

```java
public interface TransactionalMailSender {
    boolean isConfigured();
    MailDeliveryReceipt send(TransactionalMailMessage message);
}
```

`MailDeliveryException` must extend `RuntimeException` and expose only `Integer statusCode` and `boolean retryable`. Its exception message must be a fixed sanitized description, never a provider response body, recipient, API key, message content, or reset URL.

- [ ] **Step 4: Implement the disabled fallback bean**

`DisabledTransactionalMailSender.isConfigured()` returns `false`; `send(...)` throws `new MailDeliveryException("Transactional mail is not configured", null, false, null)`.

Register it in `TransactionalMailConfiguration` with `@ConditionalOnMissingBean(TransactionalMailSender.class)`. Do not make the class itself a `@Service`, because the Resend bean must replace it cleanly.

- [ ] **Step 5: Run the focused test**

Run:

```powershell
./mvnw -q -f backend/pom.xml -Dtest=TransactionalMailConfigurationTests test
```

Expected: exit code 0 and one configured `TransactionalMailSender` bean in the test context.

- [ ] **Step 6: Commit only the contract files**

```powershell
git add -- backend/src/main/java/com/hermes/backend/infrastructure/mail/TransactionalMailMessage.java backend/src/main/java/com/hermes/backend/infrastructure/mail/MailDeliveryReceipt.java backend/src/main/java/com/hermes/backend/infrastructure/mail/MailDeliveryException.java backend/src/main/java/com/hermes/backend/infrastructure/mail/TransactionalMailSender.java backend/src/main/java/com/hermes/backend/infrastructure/mail/DisabledTransactionalMailSender.java backend/src/main/java/com/hermes/backend/infrastructure/mail/TransactionalMailConfiguration.java backend/src/test/java/com/hermes/backend/infrastructure/mail/TransactionalMailConfigurationTests.java
git diff --cached --name-only
git commit -m "feat: add transactional mail contract"
```

Expected staged-name output: exactly the seven files above.

## Task 2: Implement the Resend HTTPS adapter

**Files:**

- Create: `backend/src/main/java/com/hermes/backend/infrastructure/mail/ResendTransactionalMailSender.java`
- Modify: `backend/src/main/java/com/hermes/backend/infrastructure/mail/TransactionalMailConfiguration.java`
- Create: `backend/src/test/java/com/hermes/backend/infrastructure/mail/ResendTransactionalMailSenderTests.java`

- [ ] **Step 1: Write adapter tests against a local HTTP server**

Use JDK `com.sun.net.httpserver.HttpServer` bound to `127.0.0.1` and queue response codes so tests can verify behavior without reaching Resend. Cover all of these cases:

1. A 200 response returns the JSON `id` as `providerMessageId`.
2. The request has `Authorization: Bearer test-key`, `Content-Type: application/json`, and the exact `Idempotency-Key` from the message.
3. The JSON body contains `from`, a one-element `to` array, `subject`, `text`, `html`, and `reply_to`.
4. A 429 followed by 200 retries once with the same idempotency key.
5. A 500 followed by 200 retries once.
6. A 400 does not retry.
7. Two 500 responses throw a retryable `MailDeliveryException` after exactly two attempts.
8. Exception text does not contain the test API key, recipient, body text, or server response body.

Construct the adapter with an injectable endpoint so production uses `https://api.resend.com/emails` and tests use the local server.

- [ ] **Step 2: Run the test and confirm it fails**

```powershell
./mvnw -q -f backend/pom.xml -Dtest=ResendTransactionalMailSenderTests test
```

Expected: compilation fails because `ResendTransactionalMailSender` does not exist.

- [ ] **Step 3: Implement request validation and JSON serialization**

The adapter constructor receives `HttpClient`, `ObjectMapper`, endpoint `URI`, API key, from address, and reply-to address. Validate nonblank message fields before any network call.

Build this payload shape:

```java
Map<String, Object> payload = Map.of(
        "from", from,
        "to", List.of(message.to()),
        "subject", message.subject(),
        "text", message.text(),
        "html", message.html(),
        "reply_to", replyTo);
```

Build a POST request with a 10-second request timeout. Create the production client with a 5-second connect timeout.

- [ ] **Step 4: Implement bounded retry behavior**

Attempt at most twice. Retry only HTTP 429 and 5xx. Keep the same `Idempotency-Key` on both attempts. Do not retry other 4xx responses. For interrupted calls, restore the thread interrupt flag before throwing a sanitized retryable exception.

Do not log response bodies. A success log may include only a fixed event name and Resend provider message ID. A failure log may include only status code, retryability, and attempt number.

- [ ] **Step 5: Register the Resend bean conditionally**

In `TransactionalMailConfiguration`, create the adapter only when:

```java
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "resend")
```

Read these properties:

```text
app.mail.resend.api-key
app.mail.from
app.mail.reply-to
app.mail.resend.endpoint
```

The endpoint default is exactly `https://api.resend.com/emails`.

- [ ] **Step 6: Run focused tests**

```powershell
./mvnw -q -f backend/pom.xml -Dtest=TransactionalMailConfigurationTests,ResendTransactionalMailSenderTests test
```

Expected: exit code 0; retry tests report exactly two captured requests, while 400 reports one.

- [ ] **Step 7: Commit only the adapter slice**

```powershell
git add -- backend/src/main/java/com/hermes/backend/infrastructure/mail/ResendTransactionalMailSender.java backend/src/main/java/com/hermes/backend/infrastructure/mail/TransactionalMailConfiguration.java backend/src/test/java/com/hermes/backend/infrastructure/mail/ResendTransactionalMailSenderTests.java
git diff --cached --name-only
git commit -m "feat: send transactional email through resend"
```

## Task 3: Refactor verification and password-reset flows onto the new contract

**Files:**

- Modify: `backend/src/main/java/com/hermes/backend/auth/EmailVerificationService.java`
- Modify: `backend/src/main/java/com/hermes/backend/auth/PasswordResetService.java`
- Create: `backend/src/test/java/com/hermes/backend/auth/EmailVerificationServiceTests.java`
- Create: `backend/src/test/java/com/hermes/backend/auth/PasswordResetServiceTests.java`
- Verify: `backend/src/test/java/com/hermes/backend/auth/EmailValidationServiceTests.java`
- Verify: `backend/src/test/java/com/hermes/backend/auth/LoginControllerSecurityTests.java`
- Verify: `backend/src/test/java/com/hermes/backend/auth/LoginControllerTests.java`
- Verify: `backend/src/test/java/com/hermes/backend/auth/PasswordResetEnumerationTests.java`

- [ ] **Step 1: Write verification-service regression tests**

Use Mockito for `AuthService`, `RunnerRepository`, and `TransactionalMailSender`. Assert:

- the token stored on `Runner` is the mocked hash and is not the plaintext token from the link;
- expiry is approximately 48 hours in the future;
- the message subject is `Verify your Hermes account`;
- text and HTML both contain `https://hermesruns.com/api/auth/verify-email?token=`;
- the idempotency key contains no recipient and no plaintext token;
- a delivery failure deletes a brand-new runner only when `deleteRunnerRowOnMailFailure` is true;
- a resend failure never deletes the existing runner;
- `isMailConfigured()` delegates to the sender.

- [ ] **Step 2: Write password-reset-service regression tests**

Assert:

- the reset token is hashed before save;
- expiry is approximately 60 minutes in the future;
- text and HTML both contain `https://hermesruns.com/reset-password?token=`;
- the idempotency key contains no recipient and no plaintext token;
- delivery failure is propagated without logging or exposing the reset URL;
- `isMailConfigured()` delegates to the sender.

- [ ] **Step 3: Run the new tests and confirm failure**

```powershell
./mvnw -q -f backend/pom.xml -Dtest=EmailVerificationServiceTests,PasswordResetServiceTests test
```

Expected: compilation or assertion failures while the services still depend on `JavaMailSender`.

- [ ] **Step 4: Replace SMTP field injection with constructor injection**

Both services receive `TransactionalMailSender` through their constructors. Remove `JavaMailSender`, `SimpleMailMessage`, `MailException`, `spring.mail.host`, and `APP_BASE_URL` usage.

Use the same property for both public links:

```java
@Value("${app.public-base-url:http://localhost:8080}")
private String publicBaseUrl;
```

Build safe basic HTML using a small private `escapeHtml` helper for any interpolated non-URL display text. The reset and verification links contain only the random URL-safe token generated by the service.

Generate an opaque idempotency key independently from recipient and token:

```java
String eventId = UUID.randomUUID().toString();
String idempotencyKey = "hermes-email-verification-" + eventId;
```

Use `hermes-password-reset-` for reset messages.

- [ ] **Step 5: Preserve rollback and enumeration semantics**

Catch `MailDeliveryException` in `EmailVerificationService` only to perform the existing conditional delete, then rethrow. Log only the fixed event name and runner database ID; remove the recipient and stack fields that could expose personal information.

In `PasswordResetService`, rethrow the sanitized provider exception. Do not change `LoginController` generic responses or its rate-limit behavior.

- [ ] **Step 6: Run mail and controller regression tests**

```powershell
./mvnw -q -f backend/pom.xml -Dtest=EmailVerificationServiceTests,PasswordResetServiceTests,EmailValidationServiceTests,LoginControllerSecurityTests,LoginControllerTests,PasswordResetEnumerationTests test
```

Expected: exit code 0. Existing enumeration tests still return identical responses for known and unknown accounts.

- [ ] **Step 7: Commit only the service refactor**

```powershell
git add -- backend/src/main/java/com/hermes/backend/auth/EmailVerificationService.java backend/src/main/java/com/hermes/backend/auth/PasswordResetService.java backend/src/test/java/com/hermes/backend/auth/EmailVerificationServiceTests.java backend/src/test/java/com/hermes/backend/auth/PasswordResetServiceTests.java
git diff --cached --name-only
git commit -m "refactor: route account email through transactional sender"
```

## Task 4: Fail closed in production and remove SMTP dependencies

**Files:**

- Modify: `backend/src/main/resources/application.properties`
- Modify: `backend/src/main/java/com/hermes/backend/auth/ProductionSecurityValidator.java`
- Modify: `backend/src/test/java/com/hermes/backend/auth/ProductionSecurityValidatorTests.java`
- Modify: `backend/src/main/java/com/hermes/backend/infrastructure/diagnostics/SecurityDiagnosticsInitializer.java`
- Modify: `backend/pom.xml`

- [ ] **Step 1: Add failing production validation tests**

Extend `secureProductionValidator()` with valid mail fields, then add one test for each invalid production configuration:

- provider is blank or not `resend`;
- Resend API key is blank;
- from address is not under `mail.hermesruns.com`;
- reply-to is not exactly `support@hermesruns.com`;
- public base URL is blank, loopback, or non-HTTPS.

Each assertion must check the precise environment-variable name in the sanitized exception message.

- [ ] **Step 2: Run the validator tests and confirm failure**

```powershell
./mvnw -q -f backend/pom.xml -Dtest=ProductionSecurityValidatorTests test
```

Expected: new mail-validation tests fail because the fields and validation method do not exist.

- [ ] **Step 3: Replace SMTP properties with HTTPS provider properties**

Replace the SMTP section in `application.properties` with:

```properties
app.mail.provider=${APP_MAIL_PROVIDER:disabled}
app.mail.resend.api-key=${RESEND_API_KEY:}
app.mail.resend.endpoint=${APP_MAIL_RESEND_ENDPOINT:https://api.resend.com/emails}
app.mail.from=${APP_MAIL_FROM:}
app.mail.reply-to=${APP_MAIL_REPLY_TO:}
app.public-base-url=${APP_PUBLIC_BASE_URL:http://localhost:8080}
```

Keep `app.billing.public-base-url` for billing compatibility, but email services must use `app.public-base-url`.

- [ ] **Step 4: Add production mail validation**

Inject the five mail properties into `ProductionSecurityValidator` and call `validateTransactionalMail()` from `validate()`.

In production, require:

```text
APP_MAIL_PROVIDER=resend
RESEND_API_KEY is nonblank
APP_MAIL_FROM parses as a single address whose domain is mail.hermesruns.com
APP_MAIL_REPLY_TO equals support@hermesruns.com, case-insensitively
APP_PUBLIC_BASE_URL is nonblank HTTPS and non-loopback
```

Do not log any configured value. Tighten the existing public-base-url validator so blank is an error in production rather than an accepted value.

- [ ] **Step 5: Add safe non-production diagnostics**

`SecurityDiagnosticsInitializer` may emit only these states: provider disabled, provider configured, or provider partially configured. Never print addresses, endpoints, or key contents.

- [ ] **Step 6: Remove JavaMail**

Delete the `spring-boot-starter-mail` dependency from `backend/pom.xml`. Confirm no source references remain:

```powershell
rg -n "JavaMailSender|SimpleMailMessage|MailException|spring\.mail|SPRING_MAIL" backend
```

Expected: no matches.

- [ ] **Step 7: Run focused validation and compile**

```powershell
./mvnw -q -f backend/pom.xml -Dtest=ProductionSecurityValidatorTests,TransactionalMailConfigurationTests,ResendTransactionalMailSenderTests,EmailVerificationServiceTests,PasswordResetServiceTests test
./mvnw -q -f backend/pom.xml -DskipTests compile
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit only production configuration changes**

```powershell
git add -- backend/src/main/resources/application.properties backend/src/main/java/com/hermes/backend/auth/ProductionSecurityValidator.java backend/src/test/java/com/hermes/backend/auth/ProductionSecurityValidatorTests.java backend/src/main/java/com/hermes/backend/infrastructure/diagnostics/SecurityDiagnosticsInitializer.java backend/pom.xml
git diff --cached --name-only
git commit -m "security: require transactional mail in production"
```

## Task 5: Update secret-safe environment references and deployment runbook

**Files:**

- Modify: `.env.example`
- Modify: `Hermes.local.env.example.ps1`
- Create: `docs/deployment/customer-email.md`

- [ ] **Step 1: Replace SMTP examples with Resend variable names**

In `.env.example`, replace the SMTP section with descriptions for:

```text
APP_MAIL_PROVIDER=resend
RESEND_API_KEY=<secret supplied only in the deployment platform>
APP_MAIL_FROM=Hermes <no-reply@mail.hermesruns.com>
APP_MAIL_REPLY_TO=support@hermesruns.com
```

Because `.env.example` is public documentation, represent the secret with a descriptive sentinel and never a key-shaped value. In `Hermes.local.env.example.ps1`, default the provider to `disabled` and leave the key empty so local development does not accidentally send mail.

- [ ] **Step 2: Write the deployment runbook**

Document the following exact ownership boundaries:

- Google Workspace: root-domain human mailbox `support@hermesruns.com`.
- Resend: transactional sender on `mail.hermesruns.com` only.
- Railway: runtime variables and HTTPS API calls; no outbound SMTP.
- Cloudflare: DNS host; preserve apex, `www`, and `admin` web records.

Include a redacted variable checklist, failure rollback order, and verification commands. Explicitly state that Workspace/Resend-generated DNS values must be retrieved from their authenticated dashboards and copied exactly.

- [ ] **Step 3: Scan documentation for secret-shaped values and stale SMTP instructions**

```powershell
rg -n "SPRING_MAIL|smtp\.gmail|smtp\.example|your-smtp-password" .env.example Hermes.local.env.example.ps1 docs/deployment/customer-email.md
rg -n "re_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}" .env.example Hermes.local.env.example.ps1 docs/deployment/customer-email.md
```

Expected: both commands produce no output.

- [ ] **Step 4: Commit only the environment documentation**

```powershell
git add -- .env.example Hermes.local.env.example.ps1 docs/deployment/customer-email.md
git diff --cached --name-only
git commit -m "docs: add customer email deployment runbook"
```

## Task 6: Run the complete local verification gate

**Files:**

- Verify all files changed in Tasks 1–5.

- [ ] **Step 1: Run the focused mail/security suite**

```powershell
./mvnw -q -f backend/pom.xml -Dtest=TransactionalMailConfigurationTests,ResendTransactionalMailSenderTests,EmailVerificationServiceTests,PasswordResetServiceTests,EmailValidationServiceTests,LoginControllerSecurityTests,LoginControllerTests,PasswordResetEnumerationTests,ProductionSecurityValidatorTests test
```

Expected: exit code 0.

- [ ] **Step 2: Run the full backend test suite**

```powershell
./mvnw -q -f backend/pom.xml test
```

Expected: exit code 0. If an unrelated known baseline fails, record the exact failing test separately and do not claim the full suite is green.

- [ ] **Step 3: Compile the production artifact**

```powershell
./mvnw -q -f backend/pom.xml -DskipTests package
```

Expected: exit code 0 and a new backend JAR under `backend/target/`.

- [ ] **Step 4: Run static safety scans**

```powershell
rg -n "JavaMailSender|SimpleMailMessage|MailException|spring\.mail|SPRING_MAIL" backend .env.example Hermes.local.env.example.ps1 docs/deployment/customer-email.md
rg -n "RESEND_API_KEY\s*=\s*re_|Authorization:\s*Bearer\s+re_" . --glob '!backend/target/**' --glob '!.git/**'
git diff --check
git status --short
```

Expected: both secret/stale-SMTP scans are empty, `git diff --check` exits 0, and `git status` shows only pre-existing unrelated user changes plus intentional work not yet committed.

## Task 7: Provision Google Workspace, Resend, Cloudflare DNS, and Railway

**External systems:**

- Google Workspace Admin console
- Resend dashboard
- Cloudflare DNS dashboard
- Railway project variables and deployment logs

- [ ] **Step 1: Obtain action-time confirmation before paid checkout**

Show the selected Google Workspace edition, billing frequency, displayed total, account/domain, and cancellation terms. Stop and request confirmation immediately before submitting the purchase or trial checkout.

- [ ] **Step 2: Create the human support mailbox**

After confirmation, activate Google Workspace Business Starter for `hermesruns.com`, verify domain ownership, and create the licensed user `support@hermesruns.com`. Enable Google two-step verification and store recovery codes outside the repository.

- [ ] **Step 3: Cut root-domain mail to Google Workspace**

In Cloudflare DNS, copy the exact MX verification/routing values shown by Google Workspace. Add Google SPF and DKIM records. Add DMARC at `_dmarc.hermesruns.com` with monitoring policy `p=none` and an aggregate-report destination controlled by the site owner.

Do not modify the apex/`www`/`admin` web-routing records.

- [ ] **Step 4: Create and verify the Resend sending subdomain**

Add `mail.hermesruns.com` in Resend. In Cloudflare, copy the exact provider-generated DKIM, SPF, return-path, and verification records. Confirm the Resend dashboard marks the subdomain verified before creating a key.

- [ ] **Step 5: Create a least-privilege Resend key**

Create a sending-only key restricted to `mail.hermesruns.com`. Copy it once into Railway as `RESEND_API_KEY`; never paste it into chat, shell history, files, screenshots, logs, or Git.

- [ ] **Step 6: Configure Railway variables**

Set these variables in the Railway service:

```text
APP_MAIL_PROVIDER=resend
RESEND_API_KEY=(secret value entered only in Railway)
APP_MAIL_FROM=Hermes <no-reply@mail.hermesruns.com>
APP_MAIL_REPLY_TO=support@hermesruns.com
APP_PUBLIC_BASE_URL=https://hermesruns.com
```

Remove obsolete `SPRING_MAIL_*` variables after the new deployment is healthy.

- [ ] **Step 7: Deploy and inspect startup**

Deploy the committed branch/revision through the existing Railway pipeline. Confirm startup passes `ProductionSecurityValidator` and that logs show only the safe provider-configured state. If startup fails, restore the prior Railway deployment and leave DNS records intact while correcting configuration.

## Task 8: Verify the live end-to-end mail system

**Live surfaces:**

- `https://hermesruns.com`
- Google Workspace support inbox
- Resend delivery dashboard
- Railway logs

- [ ] **Step 1: Verify DNS without exposing secrets**

```powershell
Resolve-DnsName hermesruns.com -Type MX
Resolve-DnsName hermesruns.com -Type TXT
Resolve-DnsName _dmarc.hermesruns.com -Type TXT
Resolve-DnsName mail.hermesruns.com -Type TXT
```

Expected: Google owns root-domain MX; root SPF/DKIM/DMARC resolve; Resend verification records resolve only for the sending subdomain.

- [ ] **Step 2: Verify web routing was not disturbed**

```powershell
curl.exe -I https://hermesruns.com/
curl.exe -I https://www.hermesruns.com/
curl.exe -I https://admin.hermesruns.com/
```

Expected: apex is healthy, `www` keeps its intended redirect, and `admin` remains behind Cloudflare Access.

- [ ] **Step 3: Exercise signup verification**

Create a dedicated test account through the public signup flow. Confirm:

- the message arrives from `Hermes <no-reply@mail.hermesruns.com>`;
- Reply-To is `support@hermesruns.com`;
- the link targets `https://hermesruns.com/api/auth/verify-email`;
- the link verifies once and cannot be reused;
- Resend shows one accepted delivery with a provider ID;
- Railway logs contain no address, token, link, body, or key.

- [ ] **Step 4: Exercise password reset and enumeration protection**

Request a reset for the test account and for a nonexistent address. Confirm the public responses remain indistinguishable, the real account receives one reset message, the link expires/invalidates correctly, and logs contain no sensitive content.

- [ ] **Step 5: Exercise human support replies**

Reply to either transactional message. Confirm it arrives in the Google Workspace `support@hermesruns.com` mailbox. Reply from that mailbox and inspect the received headers to confirm the visible sender is `support@hermesruns.com` and the personal Gmail account is absent.

- [ ] **Step 6: Tighten DMARC after monitoring**

After at least seven days of clean aggregate reports covering Google Workspace and Resend, change DMARC from `p=none` to `p=quarantine`; move to `p=reject` only after another clean observation period. Record the date and evidence in the deployment runbook.

## Final acceptance checklist

- [ ] Railway performs no SMTP connection attempt.
- [ ] Verification and password-reset emails are sent through Resend HTTPS with bounded retry and idempotency.
- [ ] Production startup fails closed when transactional mail configuration is absent or unsafe.
- [ ] Existing signup rollback, token hashing/expiry, reset enumeration protection, and rate limits remain intact.
- [ ] `support@hermesruns.com` is a Google Workspace mailbox and personal Gmail is not exposed in outbound support replies.
- [ ] Resend is limited to `mail.hermesruns.com`; root-domain human mail stays with Google.
- [ ] No secret, recipient, token, reset link, or message body appears in source control or logs.
- [ ] Existing apex, `www`, and protected `admin` routes remain healthy.
- [ ] Focused tests, full backend tests, package build, DNS probes, and live email flows have recorded evidence.
