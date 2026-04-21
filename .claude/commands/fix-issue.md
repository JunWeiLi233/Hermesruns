---
name: fix-issue
argument-hint: [issue-number]
---

Fix GitHub issue #$ARGUMENTS for Hermes:
1. Run `gh issue view $ARGUMENTS` and summarize the bug in one sentence.
2. Identify the affected frontend and backend files.
3. Implement the smallest complete fix.
4. Add a regression test when practical, otherwise write a manual verification checklist.
5. Run the relevant verification commands:
   - `cd frontend && npm run lint`
   - `cd backend && ./mvnw test` or `./mvnw -DskipTests compile`
6. Prepare a commit message in the format `fix: short description (closes #$ARGUMENTS)`.
