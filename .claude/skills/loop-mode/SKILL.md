---
name: loop-mode
description: Low-token TASKS.md execution for Hermes queue work.
user-invocable: true
---

Follow CLAUDE.md. Read TASKS.md and execute loop mode:

1. Read `.ai-codex/optimized-claude.md` first (generated at session start) for queue status. Fall back to TASKS.md directly if missing.
1a. Read `.ai-sync/AGENT_SYNC.md` and `.ai-sync/HUMAN_LOOP.md` before self-generated rounds.
2. Work every unchecked `## Active Tasks` entry in order. Use `Files:`, `Done when:`, `Verify:`, `Blocker:` as hard rules.
3. After each task: add a short `Note:` line, remove the completed block from `## Active Tasks`, append one line to `## Daily Log` (delete older-date entries if this is the first entry for today).
4. When `## Active Tasks` is empty, inspect only the **first candidate** in each relevant `## Suggested Next Tasks` tier section. Shortlist ≤5. Promote the **single strongest** implementation-ready task per pass (not ≤2 — exactly 1).
5. When `## Suggested Next Tasks` is also empty, run `node .tools/suggest-tasks.mjs --max 5` (no `--write` flag) to capture suggestions in memory. Apply gates to each: Evidence Gate, Task Quality Rubric (4 of 5 strong), Tier Gate. Write only the single strongest passing candidate to `## Active Tasks` manually. If none pass, proceed to step 6.
6. When both suggested and auto-generated tasks are empty, promote the strongest bounded `## Tech Debt Tasks` item.
7. After each completed + verified task: extract the **single** strongest follow-up improvement and the **single** strongest tech-debt item (2 items max total). Compare each to the current section leader and keep only the stronger one per section. Do not stack near-identical follow-ups.
7a. For meaningful user-visible or cross-stack work, follow the self-evolving engine gates in `HERMES_SELF_EVOLVING_ENGINE.md` (regression → reversal → quality audit → improvement proof → evidence → shipping proof → task rubric).
7b. After each verified task, run the **evolver agent** to score the round and self-patch the mechanism when scores drop.
7c. If reviewer recommends reversal, stop expanding and reverse instead.
8. Stop only when no promotable task remains, verification fails, or a real blocker appears.
9. When all commit gates pass (Active Tasks empty, lint + compile clean), commit per CLAUDE.md Git policy. **Do not push automatically** — push only when a real publish need exists and push gates explicitly pass. Local commit is the default finish state.
