# AI Editing Contract

This is the runtime-neutral editing contract for Hermes. It applies to every
AI-assisted change, whether the work begins from a direct request or a named
workflow. Codex is the canonical workflow source; Claude, Gemini, and OpenCode
receive generated adapters.

## Authority and scope

1. Follow user instructions first, then this contract, then the relevant
   application documentation and local conventions.
2. Preserve routes, API contracts, persistence behavior, authentication,
   styling, and user-visible behavior unless the task explicitly changes them.
3. Treat generated runtime commands as read-only. Change the canonical command
   under `.codex/commands/`, update the manifest when needed, then regenerate
   adapters.
4. Keep runtime-specific integrations and agent cards as thin adapters. They
   may choose different execution mechanisms, but must produce the same
   editing, verification, and safety outcomes.
5. Start with the bounded context declared in `context-manifest.json`. Search
   historical records for the task at hand; do not preload them.

## Editing standards

- Prefer the smallest coherent change and existing utilities over new layers.
- Keep frontend code in `frontend/src/` and backend code in
  `backend/src/main/java/` aligned with the project map and existing domain
  boundaries.
- Reuse established design tokens and responsive patterns. For meaningful UI
  work, treat `design.md` as the visual authority.
- Every new or changed user-visible string must be updated in both `en` and
  `zh-CN` in `frontend/src/i18n/translations.js`.
- Do not introduce secrets, generated build output, machine-specific settings,
  agent memory, checkpoints, caches, or local runtime state into Git.

## Formatting

Keep the existing style and limit formatting to the files in the change. This
checkout does not configure `format:write` or Spotless tasks. Verify whitespace
with `git diff --check`, JavaScript with the frontend lint command, and Java with
the backend compiler. These commands are checks, not automatic formatters.

A repository-wide formatting migration must be a deliberate cleanup change;
ordinary feature work should not reformat unrelated files.

## Verification

Run the smallest relevant checks, then expand only when the change requires
it:

- Frontend source: `cd frontend && npm run lint && npm test && npm run build`.
- Backend source: `cd backend && ./mvnw -q test`.
- User-facing copy: `node tools/check-translations.mjs`.
- Website-facing work: run the relevant runtime proof gate before claiming the
  local website changed.

Report what actually ran and any remaining verification gap. Source edits and
successful builds are not proof that a live runtime changed.

## Git and review safety

- Inspect the working tree before editing and preserve unrelated user changes.
- Never use destructive Git commands unless the user explicitly requested the
  exact operation.
- Stage only files belonging to the requested change.
- Do not commit or publish unless the user asked for it.
- Keep AI runtime assets in Git only when they are declarative, reviewable
  project configuration or documentation.
