# /auto-hermes-structure-update

Run the Hermes structure-governance pass.

Use:

```powershell
node .tools/auto-hermes-structure-update.mjs --write
```

This command audits runtime adapters, repository steering files, and owner-map coverage, then writes the structure-update brief under `.ai-sync/`.
