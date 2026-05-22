import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const scriptPath = path.resolve(".tools/mempalace/auto-session-sync.ps1");
const script = fs.readFileSync(scriptPath, "utf8");

assert.match(
  script,
  /\$AutoSyncTimeoutSeconds\s*=\s*\d+/,
  "auto-session-sync.ps1 should define a bounded timeout for MemPalace mining",
);

assert.match(
  script,
  /Wait-Process\s+-Id\s+\$mineProcess\.Id\s+-Timeout\s+\$AutoSyncTimeoutSeconds/,
  "auto-session-sync.ps1 should stop waiting after the configured timeout",
);

assert.match(
  script,
  /\$autoSyncSourceDir\s*=\s*Join-Path\s+\$workspaceMemPalaceDir\s+'auto-sync-source'/,
  "auto-session-sync.ps1 should mine a small generated source snapshot",
);

assert.doesNotMatch(
  script,
  /mempalace\s+mine\s+\$repoRoot/,
  "auto-session-sync.ps1 should not mine the full repo root during startup",
);

console.log("PASS mempalace auto-session-sync guard");
