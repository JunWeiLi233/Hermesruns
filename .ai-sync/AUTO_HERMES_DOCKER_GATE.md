# Auto-Hermes Docker Gate

Generated: 2026-05-20T23:06:20.225Z
Passed: no
Git Head: 3e233239b6efd51cf357b4d056f5b18cd58fd34b
Command: docker build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
Reason: Docker publish gate failed for the current working tree.

## Status Snapshot
```text
M .ai-sync/AGENT_SYNC.json
 M .ai-sync/AGENT_SYNC.md
 M .ai-sync/CONTEXT_LEDGER.md
 M .claude/commands/auto-hermes-attack.md
 M .claude/commands/auto-hermes-max.md
 M .claude/commands/auto-hermes-self.md
 M .claude/commands/auto-hermes.md
 M .codex/commands/auto-hermes-attack.md
 M .codex/commands/auto-hermes-security.md
 M .tools/auto-hermes-loop.mjs
 M .tools/auto-hermes-max-loop.mjs
 M .tools/auto-hermes-security.mjs
 M .tools/auto-hermes-security.test.mjs
 M DESIGN_VERSIONS.md
M  README.md
 M TASKS.md
 M backend/src/main/java/com/hermes/backend/ProfileController.java
 M docs/auto-hermes/daily-operator-guide.md
 M docs/auto-hermes/index.md
 M docs/repo-rules/truth-and-memory.md
 M frontend/src/data/shoeCatalog.js
 M frontend/src/i18n/locales/en/components.js
 M frontend/src/i18n/locales/zh-CN/components.js
 M frontend/src/index.css
 M frontend/src/pages/AddShoes.jsx
 M frontend/src/pages/RunDetail.jsx
 M frontend/src/pages/Runs.jsx
 M frontend/src/pages/workflowBuilderStatesA11y.smoke.test.js
 M frontend/src/styles/_split/admin.css
 M frontend/src/styles/_split/analysis.css
 M frontend/src/styles/_split/auth.css
 M frontend/src/styles/_split/heatmap.css
 M frontend/src/styles/_split/integrations.css
 M frontend/src/styles/_split/landing.css
 M frontend/src/styles/_split/legacy-frame.css
 M frontend/src/styles/_split/light-theme-overrides.css
 M frontend/src/styles/_split/misc.css
 M frontend/src/styles/_split/muscle-training.css
 M frontend/src/styles/_split/profile.css
 M frontend/src/styles/_split/races.css
 M frontend/src/styles/_split/rewards.css
 M frontend/src/styles/_split/runner-shell.css
 M frontend/src/styles/_split/runs.css
 M frontend/src/styles/_split/schedule.css
 M frontend/src/styles/_split/shared.css
 M frontend/src/styles/_split/shoes.css
 M frontend/src/styles/_split/subscription.css
 M frontend/src/styles/_split/territory.css
 M frontend/src/styles/_split/today-run.css
 M frontend/src/styles/_split/tokens.css
 M frontend/src/styles/_split/weather.css
 M frontend/src/styles/_split/workflow.css
 M frontend/src/styles/analysis-detail-redesigns.css
 M frontend/src/utils/addShoeCatalog.js
 M frontend/src/utils/addShoeCatalog.test.js
 M frontend/src/utils/copilotPromptFiles.smoke.test.js
 M frontend/src/utils/progressionAtlas.js
?? .claude/commands/_skill-stack.md
?? .claude/commands/auto-hermes-structure-update.md
?? .codex/commands/auto-hermes-language.md
?? .codex/commands/auto-hermes-structure-update.md
?? .codex/commands/auto-hermes-submit-main.md
?? .codex/workflows/auto-hermes-structure-update-contract.md
?? .opencode/commands/auto-hermes-attack.md
?? .opencode/commands/auto-hermes-find-shoe.md
?? .opencode/commands/auto-hermes-market.md
?? .opencode/commands/auto-hermes-pull-main.md
?? .opencode/commands/auto-hermes-push-main.md
?? .opencode/commands/auto-hermes-security.md
?? .opencode/commands/auto-hermes-structure-update.md
?? .opencode/commands/auto-hermes-tech-debt.md
?? .tools/_split-locales-once.mjs
?? .tools/auto-hermes-worktree-audit.mjs
?? .tools/one-shot-contrast-audit.mjs
?? .tools/untrack-volatile-ai-sync.sh
?? backend/test
?? docs/auto-hermes/attack.md
?? docs/auto-hermes/market.md
?? docs/auto-hermes/security.md
?? frontend/src/assets/generated/recent-runs-hero-overlay.jpg
?? frontend/src/pages/runsHeroOverlayContrast.smoke.test.js
?? frontend/src/styles/contrast-fixes.css
?? frontend/src/styles/muscle-training-hermes-redesign.css
?? frontend/src/styles/settings-fullwidth.css
?? opencode.json
```

## Output
```text
ERROR: failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
Command failed: C:\Program Files\Docker\Docker\resources\bin\docker.exe build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
ERROR: failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```
