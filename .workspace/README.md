# Local Workspace Files

Application code lives in `../frontend/` and `../backend/`; scripts live in
`../tools/`. This directory keeps non-application working state together.

- `state/`: automation coordination and existing shared records.
- `codex/`: active checkpoint and generated context for Codex.
- `cache/`: disposable build staging and fingerprints.
- `tmp/`: temporary work and retained verification logs.

Do not publish local state or secrets. Historical coordination records remain
on disk but are no longer tracked at their workspace location. See
`../docs/architecture/repository-layout.md` for the complete directory policy.
