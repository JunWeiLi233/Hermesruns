# Codex MCP Servers

`mcp/` is the Codex-side registry for external tools and data sources.

Use it to document:
- which MCP servers Hermes expects
- what each server is for
- environment/setup notes
- shared team conventions

## Good Contents

- server manifests
- example config files
- per-server README notes
- setup scripts or references

## Suggested Layout

```text
mcp/
  README.md
  servers.example.json
  my-server/
    README.md
```

## Rule

If an external tool materially affects agent behavior, document it here instead of only mentioning it in workflow prose.
