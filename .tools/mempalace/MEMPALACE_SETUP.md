# Hermes MemPalace Setup

Use this guide to make MemPalace part of the Hermes coding workflow.

## Goal

MemPalace should act as the long-term memory layer for Hermes agents:
- recall past decisions without pasting huge prompts
- remember previous bugs and root causes
- help reviewer/debugger/frontend/backend agents resume with context

## Install

MemPalace repo:
- [milla-jovovich/mempalace](https://github.com/milla-jovovich/mempalace)

Basic local install:

```bash
pip install mempalace
```

## Initialize A Palace

Create a Hermes memory store and index your project conversations or notes:

```bash
mempalace init <path-to-your-Hermes-checkout>
```

After setup, ingest the sources you want MemPalace to remember:

```bash
mempalace mine <path-to-your-Hermes-checkout>
```

Use your own preferred data sources for mining if you keep logs or exported chats elsewhere.

## Connect To AI Through MCP

Manual MCP setup from the MemPalace README:

```bash
claude mcp add mempalace -- python -m mempalace.mcp_server
```

If your Codex environment supports MCP server registration, point it at:

```bash
python -m mempalace.mcp_server
```

Expected Hermes-relevant tools include:
- `mempalace_status`
- `mempalace_diary_read`
- `mempalace_search`
- `mempalace_kg_query`

## Hermes Usage Rule

Once connected, Hermes agents should use MemPalace like this:

1. Search before answering past-context questions.
2. Read the relevant specialist diary before broad repo scans when resuming older work.
3. Write back only durable findings after a bug, decision, or workflow lesson is confirmed.

Hermes now also includes automatic session refresh:

```bash
powershell -ExecutionPolicy Bypass -File .tools/mempalace/auto-session-sync.ps1 -Quiet
```

This script is referenced by `AGENTS.md` and `hermes-auto`, so future Hermes sessions can quietly refresh the palace without a manual MemPalace command.

## Suggested Specialist Mapping

These repo-local memory profiles mirror Hermes's existing delegated agents:
- reviewer -> review findings, repeated failure patterns, trust issues
- debugger -> reproductions, root causes, regression traps
- frontend -> UI decisions, translation pitfalls, design continuity
- backend -> API contracts, validation rules, persistence edge cases

See:
- `.tools/mempalace/reviewer-memory.md`
- `.tools/mempalace/debugger-memory.md`
- `.tools/mempalace/frontend-memory.md`
- `.tools/mempalace/backend-memory.md`

## Good Write-Back Examples

Store:
- "Profile rewards page showed placeholder labels because `t('rewards.heading')` expected nested keys but translations only had flat dotted keys; fallback lookup was added in I18nContext."
- "Frontend rebuild may fail if backend static assets are locked by the running Java process."
- "Official shoe catalog import is exposed in admin dashboard and backed by `/api/shoe-catalog/admin/import-page`."

Do not store:
- "Changed button padding today"
- "Need to remember to run lint"
- generic TODO lists
- temporary debugging guesses

## Prompt Patterns

Good prompts once MemPalace is connected:

```text
Before answering, search MemPalace for prior Hermes auth decisions.
```

```text
Use MemPalace to recall the last debugger notes for this surface, then fix the bug.
```

```text
Review this flow, write durable findings to MemPalace only if the issue is real and confirmed.
```

## Automatic Startup

If your Codex config contains:

```toml
[mcp_servers.mempalace]
command = "python"
args = ["-m", "mempalace.mcp_server"]
```

then restarting Codex should auto-start the MemPalace MCP server for future sessions.
