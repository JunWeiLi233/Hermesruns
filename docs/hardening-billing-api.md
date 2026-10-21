# Billing, AI budget, and API hardening — 2026-10-21

## Verified safeguards already present

- Billing requires an authenticated account and a configured Stripe price/key/webhook secret; purchase quantities are validated to 1–12 months. Purchases use one-time `payment` mode, not recurring subscriptions.
- Webhooks verify Stripe signatures and grant Pro only for paid Checkout Sessions. Existing receipts use `processed_stripe_event`.
- The API limiter already supports a Redis-backed store, with local-memory fallback, account/IP limits and `Retry-After` responses. Shoe scans also have a per-IP hourly limit and free daily/monthly user quotas. Upload validation runs before quota consumption.

## Gaps reproduced and fixes

- A repeated paid event granted Pro twice: JPA saves with assigned IDs merge rather than reliably raising duplicate-key errors. Fulfillment now locks and refreshes the runner, checks both event and Checkout-session receipt keys, and commits receipts together with the entitlement grant. Concurrent separate payments also preserve every extension. Async payment success is handled; unpaid events do not grant access. Provider error text is not returned to checkout clients.
- Checkout retries previously created a new Stripe Session each time. A database purchase attempt now commits its random idempotency key and all mutable request parameters before the provider call. Concurrent requests and network retries use that exact key/parameter snapshot. A pending purchase with different month quantity returns 409. Fulfillment marks the matching attempt complete, including the race where the webhook arrives before the HTTP response is persisted.
- A purchase attempt has a one-hour expiry. If an uncertain call still has no returned URL and fewer than 30 minutes remain, retries return 409 and retain the original attempt until expiry; they do not send an invalid short-expiry request or generate another payable session. Completed attempts return 409 until that original one-hour window expires instead of returning a completed URL. After expiry a new deliberate purchase is permitted. This conservative cooldown can temporarily prevent another purchase; external delayed settlement and pre-deployment sessions still require Stripe-side reconciliation if there is uncertainty.
- Daily/monthly user reservation checks now load current database state under a write lock. Explicit refresh also handles a preloaded managed account that waited for another transaction. Advisory status reads no longer save stale reset counters. Refunds lock current rows and check the original reservation window, preventing a slow failed request from refunding a newer day's/month's usage. Existing failed-call user quota refunds are preserved.
- The free-tier project's legacy `SUM(runner.aiDailyScansUsed)` check remains advisory across different runners/instances: it is not a global atomic reservation. The new durable provider budget below is the strict global request/reserved-USD safety boundary. Legacy `checkQuota`/`recordUsage` remains unsuitable for reservation; the production scan controller uses `tryConsumeQuota` and `tryConsumeFeature`.
- Rotating activity IDs previously bypassed write limits. Coarse bounded endpoint buckets, a global IP/account ceiling, a dedicated checkout limit (default 5/minute), and exact webhook exemptions now close that bypass. Redis is needed for a shared multi-replica API rate limit; local fallback remains per process. The database AI budget is shared independently of Redis.

## Durable provider safety budget

`AiSpendingBudget` uses transactional conditional SQL updates on daily and monthly rows. Both windows reserve together or neither increments; simultaneous first insertion is safe. It applies before shoe scan Gemini/Claude requests and normalization Gemini/Letta requests, including Pro/admin accounts. These are the direct Java paid-provider paths identified in this audit. Local course-map/Qwen subprocesses, other services/account consumers and future AI integrations are outside this claim.

Defaults are enabled, 200 requests/day, 2,000/month, $5/day, $50/month, reserving $0.10 for each attempted call. At those defaults the USD reservation boundary permits at most 50 attempts/day and 500/month. Zero request/USD limits stop calls. Blocked calls return 429 with `AI_BUDGET_EXCEEDED` and `Retry-After`. Failed and uncertain provider attempts retain their global reservation; user quota refunds cannot replenish it. Gemini output is bounded to 1,024 tokens, matching the existing Claude bound; normalization Gemini is also bounded.

The USD ledger is an operator-configured conservative estimate per attempt, **not actual provider charges or a verified provider-account dollar cap**. In particular a Letta agent can make multiple underlying model/tool calls. Operators must choose a conservative reservation for their model/image/input/agent workload and configure provider account/project budgets, billing alerts and hard stops where available. No provider account setting or real payment was changed or tested.

The parent workstream adds environment mappings for `APP_AI_BUDGET_ENABLED`, `APP_AI_BUDGET_DAILY_REQUEST_LIMIT`, `APP_AI_BUDGET_MONTHLY_REQUEST_LIMIT`, `APP_AI_BUDGET_DAILY_USD_LIMIT`, `APP_AI_BUDGET_MONTHLY_USD_LIMIT`, `APP_AI_BUDGET_RESERVATION_USD_PER_REQUEST`, and the API global/checkout per-minute limits.

## Deployment and privacy

Apply `docs/deployment/2026-10-21-billing-budget.sql` to PostgreSQL before deploying with `ddl-auto=validate`; it adds `billing_checkout_attempt` and `ai_budget_window`. The migration was not applied to a production database. H2 integration tests validate entity mappings, locking and queries; a production PostgreSQL migration/Stripe sandbox smoke check remains an operator step.

Checkout attempts contain account email and a hosted checkout URL. `BillingRunnerDataPurger` deletes only the account owner's attempt during account deletion. Global budget rows contain no runner identity. Existing historical event receipts cannot reconstruct previously paid Checkout-session IDs for a full session-level historical backfill; reconcile uncertain pre-deployment payments with Stripe before retrying a purchase.

## Verification

From `backend`, final focused command:

```powershell
.\mvnw.cmd '-Dhermes.build.directory=D:/Hermesruns/backend/target-hardening-billing' '-Dtest=BillingControllerTests,CheckoutSessionServiceTests,BillingConcurrencyTests,AiSpendingBudgetTests,AiUsageServiceTests,AiShoeScanServiceTests,ShoeImageControllerTests,ApiRateLimitFilterTests,ApiRateLimiterTests,ShoeQueryNormalizationServiceTests,ShoeQueryNormalizationControllerTests,BackendStressTests' test -q
```

Result: **71 tests passed, 0 failures, 0 errors, 0 skipped**. The seven real-H2 billing tests cover separate service instances with detached and preloaded managed accounts, concurrent different events for one payment, concurrent independent payments, receipt/grant rollback and retry, concurrent Checkout clicks, and account-scoped purchase-attempt deletion. Separate real-H2 budget tests enforce simultaneous request/USD caps and monthly rollback across independent instances/connections. Provider boundary tests verify budget exhaustion prevents HTTP/Letta calls and timeout attempts keep the safety reservation. The legacy stress test intentionally reports its unused check/record race as diagnostic output; the production atomic path has strict assertions and real-database coverage.

The parent owns full-backend verification and any unrelated existing failures.

Additional integration checks after full-suite feedback: `EntertainmentMvcTests` **25/25**, `DataLifecycleCoverageTests` **6/6**, and `StravaAliasConfigTests` **1/1** passed. The entertainment fixture assigns a distinct client network per test method while retaining the real API limiter and all production limits; concurrent calls within one test share that network. The configuration-only Strava alias fixture supplies a mock EntityManagerFactory because inline Mockito retains the mocked usage service's persistence injection annotation. The focused billing configuration is marked `@TestConfiguration` to keep it out of normal application scanning.

## Official references

- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests): reuse the same random key and parameters for uncertain POST retries.
- [Stripe Checkout Session creation](https://docs.stripe.com/api/checkout/sessions/create): explicit expiration window requirements.
- [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment): duplicate/concurrent fulfillment and asynchronous success handling.
- [Gemini generateContent / generation configuration](https://ai.google.dev/api/generate-content#generationconfig): output-token bound.
