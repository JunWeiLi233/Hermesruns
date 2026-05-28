---
name: deepseek
description: Commander-executor orchestration — Claude Opus plans + verifies, DeepSeek implements. Invoke with: /deepseek <task description>
---

# DeepSeek Orchestrated Command

**Commander:** Claude Opus 4.7 (`claude-opus-4-7`)
**Executor:** DeepSeek (`deepseek-v4-flash` or `deepseek-v4-pro` via `.tools/deepseek-executor.mjs`)

Call with a concrete task: `/deepseek <what to build or fix>`

---

## Protocol (follow exactly, in order)

### Phase 1 — Commander: Read & Plan

You are now acting as the **Commander (Opus)**. Your role is to understand the task, gather context, and produce a tight implementation plan for DeepSeek to execute.

1. Parse the task from the command argument (`$ARGUMENTS`).
2. Read `CLAUDE.md` for project conventions and stack.
3. Read `.ai-sync/CONTEXT_LEDGER.md` for recent surface decisions.
4. Identify the 1–4 files most relevant to the task. Read them fully.
5. Produce a brief in **`.ai-sync/deepseek-brief.md`** using the template below.

#### Brief template (write verbatim with content filled in):

```
# DeepSeek Implementation Brief
Generated: <ISO timestamp>
Commander: claude-opus-4-7

## Task
<exact task description from $ARGUMENTS>

## Stack Constraints
- React 19 + Vite (frontend), Spring Boot 4 + Java 17 (backend)
- Plain CSS with design tokens (--accent-coral, --surface-1, --text-strong)
- No new libraries unless task explicitly requires one
- Translations: update both en and zh-CN in same task

## Current File Contents

### <filepath>
```<lang>
<full current content>
```

(repeat for each relevant file)

## Implementation Plan
Step 1: <specific action on specific file>
Step 2: <specific action>
...

## Done-When Criteria
- <concrete verifiable criterion>
- <lint passes / build passes / endpoint returns X>

## Output Format Required
For each changed file output: ```<lang>:<filepath>
<full content>
```
End with: <!-- CHANGED_FILES: file1, file2 -->
```

6. After writing the brief, echo the plan to the user in 3–5 bullet points.

---

### Phase 2 — Execute via DeepSeek

Run the executor script:

```bash
node .tools/deepseek-executor.mjs \
  --brief .ai-sync/deepseek-brief.md \
  --out .ai-sync/deepseek-output.md \
  --model deepseek-v4-flash
```

The executor's failure modes (in order from most-common to rare):

- **`ERROR: DEEPSEEK_API_KEY env var is not set.`** — exit code 1. Tell the user to set it: `$env:DEEPSEEK_API_KEY="sk-..."` (PowerShell) or `export DEEPSEEK_API_KEY="sk-..."` (bash). Real keys come from https://platform.deepseek.com/api_keys.
- **`ERROR: DEEPSEEK_API_KEY looks like a placeholder: YOUR…HERE (22 chars)`** — exit code 1. The env var is still the `YOUR_DEEPSEEK_KEY_HERE` template string from `Hermes.local.env.ps1`. The user must replace it with a real `sk-...` key before retrying.
- **`API error 401: Authentication Fails`** — exit code 2. Real key shape but DeepSeek rejected it. Either the key was rotated, typed wrong, or hit a billing/quota wall. Hint printed: "Check for typos or rotate the key".
- **`Network error`** — exit code 2. DNS / offline / corporate proxy blocking api.deepseek.com.

Sanity-check before paying for a real API round trip:

```bash
node .tools/deepseek-executor.mjs --brief .ai-sync/deepseek-brief.md --dry-run
```

`--dry-run` validates env + brief, prints the masked key + model + brief length, and exits 0 without calling DeepSeek. Use this once after any key-rotation to confirm setup.

Stop conditions:

- If the script exits non-zero, report the printed error verbatim to the user and stop.
- If `--dry-run` shows the key is a placeholder, surface the friendly message and stop.
- Print: "DeepSeek executor finished — reviewing output..." on success.

---

### Phase 3 — Commander: Apply & Verify

You (Commander/Opus) now own the verification gate.

1. Read `.ai-sync/deepseek-output.md` fully.
2. For each fenced code block with a file path (`\`\`\`lang:path`):
   - Compare against the current file.
   - Confirm the change implements the plan.
   - Apply the change using the Edit or Write tool.
3. If DeepSeek's output is missing a required file or has a logic error, fix it yourself (do not re-call DeepSeek for minor gaps).
4. Run verification:
   - Frontend change: `node frontend/scripts/run-vite-build.mjs` then `node .tools/verify-frontend-runtime-sync.mjs --files "<changed files>"`
   - Backend change: `cd backend && ./mvnw -q -DskipTests compile`
   - Translation change: `node .tools/check-translations.mjs`
5. If verification passes: report ✓ Commander approved.
6. If verification fails: fix the specific error yourself, then re-run verification.

---

### Phase 4 — Commander: Close

After verification passes:

1. Update TASKS.md if the task was in `## Active Tasks`.
2. Run agent-sync finish:
   ```bash
   node .tools/agent-sync.mjs finish --agent deepseek --owner frontend --task "<task title>" --surface "<surface>" --files "<f1>||<f2>" --verify "deepseek-executor + commander verify"
   ```
3. Report in this format:
   ```
   ✓ DeepSeek round complete
   Task: <task>
   Files changed: <list>
   Verification: PASS
   ```

---

## Notes

- Commander (you, Opus) is responsible for quality. DeepSeek is the implementer.
- If DeepSeek's output looks hallucinated or incorrect, apply your own fix and note it.
- Never ship DeepSeek's output unreviewed.
- For `deepseek-v4-pro` (R1 model), use `--model deepseek-v4-pro` — better for complex logic, slower.
- Set `DEEPSEEK_MAX_TOKENS=16384` in env for large files.
