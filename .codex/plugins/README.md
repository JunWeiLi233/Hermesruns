# Codex Plugins

`plugins/` is for team-shareable Codex bundles.

A plugin bundles related Codex capabilities so they can travel together across repos or teammates.

## Good Plugin Contents

- `skills/`
- `commands/`
- `agents/`
- hook helpers or setup notes
- MCP conventions
- README + metadata

## Suggested Layout

```text
plugins/
  my-plugin/
    README.md
    plugin.json
    skills/
    commands/
    agents/
    mcp/
```

## Use This Layer When

- one skill is not enough
- a workflow should be shared across repos
- the team needs one portable capability bundle
