# GitHub Copilot Instructions

This repository exposes Hermes workflow prompt files in `.github/prompts/`.

## Prompt file slash commands

When prompt files are enabled in your IDE, GitHub Copilot Chat can invoke these repository workflows with slash commands:

- `/auto-hermes`
- `/auto-hermes-self`
- `/auto-hermes-max`
- `/auto-hermes-market`
- `/auto-hermes-attack`
- `/auto-hermes-security`
- `/auto-hermes-tech-debt`
- `/auto-hermes-structure-update`
- `/auto-hermes-submit-main`

## Repo rules for Copilot

- Read [AGENTS.md](../AGENTS.md) before executing a Hermes workflow.
- Treat `/auto-hermes*` as repo-local workflow names, not built-in Copilot capabilities.
- Prefer the canonical workflow docs linked from each prompt file instead of inventing behavior.
- Use `rtk`-wrapped shell commands when available, but never treat `rtk` as proof of success on its own.
- Follow the repo's verification rules before claiming success on frontend, backend, security, or tooling work.
