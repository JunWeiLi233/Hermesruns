---
name: deploy
argument-hint: [environment or notes]
---

Prepare Hermes for deployment:
1. Confirm whether `$ARGUMENTS` changes prod behavior, config, or migrations.
2. Run `cd frontend && npm run build`.
3. Run `cd backend && ./mvnw package`.
4. Summarize any required env vars, DB changes, and post-deploy smoke checks.
5. Stop and report blockers before suggesting a release is ready.
