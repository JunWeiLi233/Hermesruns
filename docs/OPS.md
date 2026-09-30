# Ops runbook (Hermesruns)

Human-facing Railway / CI notes for fixing production without bot-only tribal knowledge.
**Docs only** - this file does not change product behavior. Related ownership tables: [`OWNERSHIP.md`](./OWNERSHIP.md).

Snapshot facts below were verified **2026-09-21** via Railway CLI (`railway status` / `usage` / `metrics`). Re-check before acting if anything looks stale.

## Project layout (Railway)

| Item | Value |
|---|---|
| Project | `Hermesruns` |
| Environment | `production` |
| App service | `hermes-web` (Dockerfile build, repo `JunWeiLi233/Hermesruns`) |
| Database | `Postgres` (managed image + volume; **does not sleep**) |
| Public hosts | `hermesruns.com`, `admin.hermesruns.com`, `hermes-web-production-*.up.railway.app` |

Link a laptop directory once:

```bash
railway link -p Hermesruns -e production -s hermes-web
railway status --json
```

## Sleep / wake (hermes-web only)

| Knob | Where |
|---|---|
| Railway Serverless | Service setting `sleepApplication=true` on **hermes-web** only |
| Spring sleep profile | `SPRING_PROFILES_ACTIVE=production,sleep` |
| Hikari idle (sleep) | `backend/src/main/resources/application-sleep.properties` (`minimumIdle=0`, `idleTimeout=30000`, `keepaliveTime=0`) |
| Wake catch-up code | See Backend map in `OWNERSHIP.md` (`SleepWakeCatchUp`, `SleepModeConfiguration`) |
| Narrative | `docs/deployment/railway-sleep.md` |

**Postgres stays awake** (volume). Do not enable Railway sleep on Postgres.

**Cold-start UX** is frontend (#113 wake retry / skeleton) - see Frontend map in `OWNERSHIP.md` (`api.ts`, PageSkeleton). Ops does not change that path here.

Telemetry: `RAILWAY_TELEMETRY_DISABLED=true` is set on hermes-web (reduces noise; leave unless debugging Railway).

## Redeploy / rollback

| Action | How |
|---|---|
| Ship from GitHub | Push/merge to the branch Railway tracks; Dockerfile build runs on Railway |
| Redeploy latest image | `railway redeploy -s hermes-web` (no rebuild) or dashboard Redeploy |
| Restart running instance | `railway restart -s hermes-web` |
| Logs | `railway logs -s hermes-web -n 200` · HTTP: `railway logs -s hermes-web --http -n 200` |
| Rollback | Redeploy a prior successful deployment from the Railway dashboard (keep the previous deployment id), or revert the git commit and let CI/Railway rebuild |

Healthcheck (live): path `/`, timeout 180s on hermes-web.

## Metrics & bill (GB·h)

Billing is **usage-based memory/CPU time** (not a fixed instance SKU). Both services report `limit_mb=8192`; there is **no** “downsize instance” lever - only less awake GB·h or lower RSS while awake.

```bash
railway usage --json
railway usage projects --project Hermesruns --json
railway metrics -s hermes-web --memory --since 1d --json
railway metrics -s hermes-web --memory --since 7d --json
```

2026-09-21 snapshot (period ~2026-08-27 → 2026-09-27): workspace est ~**$8.45**; hermes-web Memory ~**$3.88**; Postgres Memory ~**$2.37**. When sleeping, short windows can show ~0 MB average (expected).

## Edge / WAF (do not enable casually)

- Railway WAF CLI only exposes **Under Attack** mode (browser challenge). It is **not** recommended: can break **Strava webhooks** and non-browser OAuth clients.
- Putting **Cloudflare (or similar) in front was considered and cancelled** by the project owner - do **not** change DNS for edge deny without a new explicit go-ahead.
- Scanner/crawler traffic can still wake a sleeping hermes-web; that is an awareness note, not an instruction to add WAF.

## CI (GitHub Actions)

Workflows live under `.github/workflows/` (e.g. `ci.yml`, `maven.yml`, `node.js.yml`, `codeql.yml`, ...). Prefer green required checks on the PR before merge; do not invent extra Memory/Go-Rust gates in this docs PR.

## Quick “I need to...”

- **Confirm sleep is on** → Railway hermes-web `sleepApplication` + env `SPRING_PROFILES_ACTIVE` includes `sleep`
- **See if the app is asleep** → `railway status` / recent deploy status `SLEEPING`, or 1h memory metrics near 0
- **Redeploy after a docs-only merge** → optional; docs do not require redeploy
- **Debug a wake storm** → `railway logs -s hermes-web --http --since 24h` and look for bots/scanners
- **Tune Hikari/JVM** → Backend ownership table + `docs/deployment/memory-budget.md` (no speculative cuts without evidence)
