# Claude Plugins

`plugins/` is for team-shareable bundles.

A plugin bundles related Claude capabilities so they can be copied, versioned, and reused together.

## Good Plugin Contents

- one or more `skills/`
- optional `hooks/`
- optional `commands/`
- optional `agents/`
- README + install notes

## Use This Layer When

- the capability is bigger than one skill
- multiple repos or teammates should reuse it
- you want one portable bundle instead of scattered files

## Suggested Layout

```text
plugins/
  my-plugin/
    README.md
    plugin.json
    skills/
    hooks/
    commands/
    agents/
```

## Team Sharing

Keep plugin metadata lightweight and explicit.
Use `plugin.json` for:
- name
- purpose
- version
- included folders
- install notes
