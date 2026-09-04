# Sleep-Compatible Railway Deployment

Activate `SPRING_PROFILES_ACTIVE=production,sleep` and enable Railway Serverless
for `hermes-web` only. PostgreSQL stays online; its volume and data are unchanged.
The default `production` profile retains the existing always-on behavior.

## Behavior

- The sleep profile binds Hikari `minimumIdle=0`, `idleTimeout=60000`, and
  `keepaliveTime=0`. Idle connections retire after about 60-90 seconds. Borrowed
  connections are not closed by the idle timeout, and new requests reconnect.
- Strava/Garmin scheduled polling returns before repositories, remote providers,
  or admin job records are accessed. Manual sync, OAuth, app-open sync, and
  webhook handlers remain enabled and preserve their existing protections.
- The nightly cron is disabled, but its coach audit runs once after cold-start
  readiness. A bounded asynchronous executor dispatches a single wake catch-up
  pass using the existing Strava and Garmin manual paths. Disabled integrations
  remain disabled. A failing dispatch does not suppress the other integrations.
- Strava continues from its persisted cursor. Garmin catches up from the last
  sync date, with the existing minimum 7-day and maximum 90-day bootstrap bound.
  Gaps beyond 90 days require an explicit longer manual import.
- Cache expiry, login-attempt cleanup, and stale tracker cleanup remain enabled;
  these are in-memory operations and do not intentionally create network traffic.
- Periodic automatic refresh is paused in this mode, even during a long-lived
  browser session. Use manual sync or existing Strava webhook/app-open paths.
  Nightly work is not guaranteed at its original wall-clock time while asleep.

## Verification

Run `SleepPollingTests`, `SleepProfileTests`, `SleepWakeCatchUpTests`, and
`SleepModeConfigurationTests`, plus the existing Strava/OAuth/webhook tests.
The real Hikari test waits for zero idle connections and then executes a query
through a newly established connection; allow up to 100 seconds for that test.

After deployment, confirm readiness, the sleep profile, and the wake dispatch
log. Then stop HTTP probes (including uptime monitors and open auto-refreshing
pages) and observe only Railway control-plane deployment status/metrics.
Expect an idle/sleep transition after the provider's inactivity window. Send
one HTTPS request, allow a bounded retry for a cold-start 502, confirm 200 and
readiness, then repeat the idle observation. A configured toggle alone is not
proof that the service actually slept. Active webhook traffic can wake it.

Serverless saves compute only while actually asleep; PostgreSQL and storage
still cost money. Do not promise a particular bill or erase already-used credit.

## Rollback

Disable Serverless for `hermes-web`, restore `SPRING_PROFILES_ACTIVE=production`,
and redeploy this source or the recorded previous deployment. Do not change
database credentials, volume, auth settings, or JVM heap caps. An existing
Redis connection, external monitor, or other network source can prevent sleep;
investigate traffic before changing unrelated integrations.
