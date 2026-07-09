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

assert.equal(
  source.match(/@echo off/g)?.length,
  2,
  "start_hermes.bat should only contain the real script header and the generated boot-script header",
);

assert.ok(
  !source.includes('ForEach-Object { (@echo off'),
  "start_hermes.bat should keep the port-cleanup PowerShell pipeline intact",
);

assert.match(
  source,
  /netstat -ano/i,
  "start_hermes.bat should scope stale-backend cleanup to the port it owns",
);

assert.match(
  source,
  /netstat -ano[\s\S]*':8080\\s\+\.\*LISTENING'[\s\S]*Stop-Process/s,
  "start_hermes.bat should stop a stale backend whenever port 8080 is listening, even if HTTP root is unhealthy",
);

const stopBlockStart = source.indexOf('echo [Hermes] Stopping old backend on localhost:8080...');
const healthProbeStart = source.indexOf("Invoke-WebRequest -Uri '%HEALTH_URL%'");
assert.ok(
  stopBlockStart === -1 || healthProbeStart === -1 || healthProbeStart > stopBlockStart,
  "stale backend cleanup should not be gated by a successful HTTP response from the old process",
);

console.log("[PASS] start_hermes.bat scopes backend shutdown safely.");
