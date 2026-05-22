# Claude Agents

`agents/` is for subagent prompts used in parallel or role-based work.

## Current Agent Families

- planning
  - `planning-agent.md`
  - `PM_AGENT.md`

- implementation
  - `frontend-agent.md`
  - `backend-agent.md`
  - `DEV_AGENT.md`

- review and QA
  - `reviewer-agent.md`
  - `code-reviewer.md`
  - `QA_AGENT.md`
  - `security-auditor.md`

- repair / evolution
  - `debugger.md`
  - `refactorer.md`
  - `evolver.md`
  - `test-writer.md`
  - `doc-writer.md`

## What Belongs Here

- Role prompts for bounded work
- Ownership rules
- Parallel-work personas
- Specialist coordination prompts

## Naming

- Prefer lowercase kebab-case for new agents.
- Use one role per file.
- Keep ownership explicit in the file itself.

## Important

If a role is only a review lens or checklist and not a true subagent, keep it in `skills/` instead of inventing another agent.
