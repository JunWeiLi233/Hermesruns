---
name: translation-sync
description: Keep Hermes UI copy synchronized in zh-CN and en with low token cost.
user-invocable: true
---

Use this skill whenever Hermes user-visible copy changes.

Rules
- Update both `zh-CN` and `en` in `frontend/src/i18n/translations.js` in the same task.
- Prefer translation-key reuse over near-duplicate strings.
- Do not leave new hardcoded user-visible strings in JSX when a translation key should exist.
- All copy must be coach-voice, not app-voice (see PRODUCT.md Design Voice).

Verification (mandatory before marking task done)
```bash
node tools/check-translations.mjs
```
- Exit 0: clean. Safe to commit.
- Exit 1: key parity gap. Fix missing keys before committing — do NOT leave as follow-up.
- Exit 2: bypass ternaries found. Add a Tech Debt task in TASKS.md, then continue.

Low-token workflow
- Touch only the relevant translation block and the owning page/component.
- Reuse nearby naming patterns.
- Avoid rereading the full translations file when only one section is needed.
