---
paths:
  - "backend/src/main/java/com/hermes/backend/*Controller.java"
  - "backend/src/main/java/com/hermes/backend/*Service.java"
  - "backend/src/main/java/com/hermes/backend/*Filter.java"
  - "backend/src/main/java/com/hermes/backend/*Advice.java"
---

# API Rules
- Validate inputs at the edge and return stable JSON responses.
- Protect admin, billing, OAuth, and webhook endpoints carefully.
- Preserve SPA routing expectations: UI from `/`, APIs under `/api`.
- If an endpoint contract changes, update the corresponding frontend call sites in the same task.
