---
paths:
  - "backend/src/main/java/com/hermes/backend/*Repository.java"
  - "backend/src/main/java/com/hermes/backend/*Entity.java"
  - "backend/src/main/resources/**"
---

# Database Rules
- Favor additive schema/data changes over destructive ones.
- Keep H2 dev compatibility unless the task explicitly targets Postgres-only behavior.
- Review query and entity changes for null handling, enum safety, and migration impact.
- Call out when seed data, backfills, or manual migration steps are required.
