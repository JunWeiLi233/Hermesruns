---
name: pr-review
argument-hint: [branch, PR number, or diff target]
---

Review the Hermes changes for `$ARGUMENTS`:
1. Gather the diff or PR context first.
2. Look for behavioral regressions, auth/payment risks, data migration issues, and missing verification.
3. Report findings first, ordered by severity, with file references.
4. End with open questions and a short test gap summary.
