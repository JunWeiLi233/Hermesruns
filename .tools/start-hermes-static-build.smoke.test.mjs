import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(import.meta.dirname, '..');
const startScript = fs.readFileSync(path.join(workspace, 'start_hermes.bat'), 'utf8');

const frontendBuildIndex = startScript.indexOf('node scripts\\run-vite-build.mjs');
const backendCheckIndex = startScript.indexOf('call .tools\\run-backend.cmd --check-only');
const backendLaunchIndex = startScript.indexOf('call .tools\\run-backend.cmd>> "%BOOT_SCRIPT%"');

assert.notEqual(
  frontendBuildIndex,
  -1,
  'start_hermes.bat should run the frontend static build before launching Spring Boot.',
);
assert.ok(
  frontendBuildIndex < backendCheckIndex,
  'start_hermes.bat should build frontend static assets before backend preflight checks.',
);
assert.ok(
  frontendBuildIndex < backendLaunchIndex,
  'start_hermes.bat should build frontend static assets before writing the backend launch command.',
);
assert.match(
  startScript,
  /pushd "%ROOT%frontend"[\s\S]*node scripts\\run-vite-build\.mjs[\s\S]*popd/,
  'start_hermes.bat should run the frontend build from the frontend directory and return to the repo root.',
);
assert.match(
  startScript,
  /if errorlevel 1 \([\s\S]*Frontend build failed[\s\S]*goto :startup_failed[\s\S]*\)/,
  'start_hermes.bat should stop startup when the frontend build fails.',
);

console.log('[PASS] start_hermes frontend static build guardrails passed.');
