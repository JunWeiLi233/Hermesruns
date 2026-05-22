Use `TASKS.md` and the shared git policy in `CLAUDE.md`.

Workflow:
1. Run `& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent claude --tasks TASKS.md --guide CLAUDE.md --queue-mode first --write` and read `.ai-codex/optimized-claude.md`.
2. Read `TASKS.md` and enter loop mode.
3. Complete every unchecked task in order using `Files:`, `Context:`, `Done when:`, `Verify:`, `Note:`, and `Blocker:` as hard rules.
4. After each task, run the listed verification when feasible and update `TASKS.md`.
5. When the loop stops, run:
   - `git status --short`
   - the privacy and `.gitignore` review from `CLAUDE.md`
   - `cd frontend && npm run lint`
   - `cd backend && ./mvnw -q -DskipTests compile`
6. If the checks pass and the changed files form one meaningful unit:
   - stage only the intended product files plus `.gitignore` when needed
   - create a concise commit with `powershell -File .tools/auto-commit.ps1 -Message "<short description>"`
   - verify the commit author with `git log -1 --format="%an <%ae>"` and confirm it uses the project-approved publish identity
7. Push only if the strict push gates in `CLAUDE.md` pass.
8. If any gate fails, do not force the push. Report the blocker clearly.
