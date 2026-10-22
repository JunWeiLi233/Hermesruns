-- Apply to PostgreSQL before deploying the billing/API hardening with ddl-auto=validate.
-- These additions do not change existing runner balances or Stripe receipts.
BEGIN;

CREATE TABLE IF NOT EXISTS billing_checkout_attempt (
    runner_id bigint PRIMARY KEY,
    idempotency_key varchar(64) NOT NULL,
    months integer NOT NULL,
    expires_at bigint NOT NULL,
    email varchar(320) NOT NULL,
    price_id varchar(255) NOT NULL,
    base_url varchar(2048) NOT NULL,
    session_id varchar(255),
    completed boolean NOT NULL DEFAULT false,
    session_url varchar(4096)
);

CREATE TABLE IF NOT EXISTS ai_budget_window (
    id varchar(64) PRIMARY KEY,
    reserved_requests bigint NOT NULL,
    reserved_usd numeric(19,6) NOT NULL
);

COMMIT;
