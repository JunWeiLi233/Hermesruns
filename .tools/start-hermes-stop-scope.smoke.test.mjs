import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const launcherPath = path.join(root, "start_hermes.bat");
const source = fs.readFileSync(launcherPath, "utf8");

assert.ok(
  !source.includes('Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force'),
  "start_hermes.bat should not try to kill every java process on the machine",
);

assert.match(
  source,
  /netstat -ano/i,
  "start_hermes.bat should scope stale-backend cleanup to the port it owns",
);

console.log("[PASS] start_hermes.bat scopes backend shutdown safely.");
