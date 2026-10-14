# Hermes training-plan website deployment

Date: 2026-10-13. User authorization: “focus on deploy a website” and “Integrate into Hermes.” Current release scope: [web delivery](runna/web-delivery.md).

## Preflight

| Check | Evidence |
| --- | --- |
| Release isolation | Exact previously deployed commit 9bc2e6ad26efd54aba7e5691e06d1d44c789f182; managed runna-web worktree |
| Production build | React/Vite build passed; Spring package prepared for deployment |
| Targeted checks | 48 backend and 8 new frontend checks passed before packaging |
| Account lifecycle | Export/deletion/lifecycle checks passed; manual receipts redacted or purged through existing hooks |
| Auth | Existing runner sign-in; new write endpoint requires runner session; owner taken from session; rate limited |
| Feature scope | Initial web slice delivered; broader mobile matrix deferred, not full parity |
| Brand | Hermes naming, existing Hermes logo and original copy; no Runna assets shipped |
| Visual evidence | Desktop, mobile and goal-dialog fixture screenshots inspected |
| Privacy / terms | Existing Hermes pages; added manual declarations to existing account export |
| Payments / store / DNS | Existing website infrastructure; no new payments, store listing or DNS changes |

## Production target

- URL: https://hermesruns.com/training-plan (runner sign-in required).
- Railway project: Hermesruns (`2f94465e-8f9d-4f55-8fa0-bdd439934b20`).
- Environment: production (`f9ac3b1b-6837-4635-876f-e0119dd4e157`).
- Service: hermes-web (`e68edfbc-39e9-4b60-99d9-dedb3923058d`).
- Database: existing production PostgreSQL; additive manual-run receipt table via current Hibernate update setting. SQL equivalent saved for validate-mode deployments.
- Previous successful deployment: `58e3f26e-b939-4664-9a81-56e9a2a4e15d`.
- Deployment: `f31103f4-643b-4888-b145-52bea1b65a11`, Railway status **SUCCESS**.
- Deployed source: `e9ea0ed1e5c165a73633eed6d8442141bb31df0c` on `codex/runna-web`; draft PR https://github.com/JunWeiLi233/Hermesruns/pull/168 retains the source for review.
- Host startup: 2026-10-14 03:13 UTC (October 13 in the user's time zone); Spring started normally with PostgreSQL and the existing schema-update setting.
- Public route: HTTP 200 with `noindex, nofollow, noarchive`.
- New deployed module: `TrainingPlan-CorRaG0p.js`, HTTP 200; contains the coach goal and manual-run endpoints.
- Unauthenticated manual-run POST: HTTP 401, rejected by the existing session filter. No production activity created.

## Operation and rollback

Use existing Railway health checks/logging. Watch application startup, schema creation, coach endpoints and manual-save errors. No new scheduled monitors, messages or paid services were created. Roll back to the previous deployment if startup fails; the new additive table can remain without affecting the old build. Never drop production run data to roll back.

No real production account was created for deployment checks. Public route/assets and unauthenticated write rejection were confirmed after host success; a real signed-in end-to-end production save remains unverified. The production release is live, while PR #168 is draft and has not been merged into master.
