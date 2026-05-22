Generate the smallest useful working brief before broad execution:

Codex-style task brief:
`& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent codex --tasks TASKS.md --guide AGENTS.md --queue-mode first --write`

Claude-style task brief:
`& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent claude --tasks TASKS.md --guide CLAUDE.md --queue-mode first --write`

Antigravity UI brief:
`& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent antigravity --tasks TASKS.md --guide CLAUDE.md --guide .claude/agents/antigravity.md --queue-mode ui --write`

Read the generated file in `.ai-codex/` before falling back to the larger source instructions.
