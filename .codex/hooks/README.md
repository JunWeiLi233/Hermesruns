# Codex Hooks

Codex hook behavior in this repo is primarily configured through `.codex/hooks.json`.

Use this folder as the documentation and helper surface for hook-driven automation.

## What Belongs Here

- notes about hook events and expectations
- helper scripts invoked by hooks
- setup and troubleshooting notes

## Current Runtime Anchor

- `.codex/hooks.json`
  - declarative hook registration

## Rule

Do not bury hook assumptions only inside command docs.
If a hook materially changes runtime behavior, document it here too.
