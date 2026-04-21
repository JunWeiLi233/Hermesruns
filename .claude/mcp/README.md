# Claude MCP Servers

`mcp/` is the Claude-side registry for external tools and data sources.

Use this layer to document:
- which MCP servers the team relies on
- what each server is for
- any required environment variables
- any local-vs-shared setup differences

## Good Contents

- server manifests
- example config files
- README notes per server
- team usage conventions

## Suggested Layout

```text
mcp/
  README.md
  servers.example.json
  my-server/
    README.md
```

## Rule

Do not hide server assumptions inside command prose if they matter operationally.
Document them here, then reference them from `commands/` or `skills/`.
