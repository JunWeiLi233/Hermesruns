import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const helperPath = path.join(repoRoot, '.tools', 'customer-playtest-gate.mjs');
const designRulesPath = path.join(repoRoot, 'docs', 'repo-rules', 'design-and-ui.md');
const smokeOutputPath = path.join(repoRoot, '.ai-sync', 'CUSTOMER_PLAYTEST_GATE.smoke.md');

rmSync(smokeOutputPath, { force: true });

assert.ok(existsSync(helperPath), 'Customer playtest gate helper should exist.');

const result = spawnSync(
  process.execPath,
  [
    helperPath,
    '--surface',
    'Workflow Builder',
    '--routes',
    '/workflows',
    '--round',
    'smoke-customer-gate',
    '--out',
    smokeOutputPath,
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  },
);

assert.equal(result.status, 0, `Customer gate helper should pass. stderr:\n${result.stderr}`);
assert.ok(existsSync(smokeOutputPath), 'Customer gate helper should write the requested markdown artifact.');

const output = readFileSync(smokeOutputPath, 'utf8');
for (const requiredText of [
  'Customer Playtest Gate',
  'Workflow Builder',
  '/workflows',
  'Amateur runner',
  'Elite runner',
  'Browser evidence',
  'Navigation clarity',
  'Daily-use enjoyment',
  'Customer feedback',
  'Round verdict',
]) {
  assert.match(output, new RegExp(requiredText), `Gate output should include ${requiredText}.`);
}

const designRules = readFileSync(designRulesPath, 'utf8');
assert.match(
  designRules,
  /Customer Playtest Gate[\s\S]*amateur runner[\s\S]*elite runner[\s\S]*Browser/,
  'Design rules should require a browser-backed customer playtest gate for meaningful UI rounds.',
);

rmSync(smokeOutputPath, { force: true });

console.log('[PASS] Customer playtest gate guardrails passed.');
