import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const helperPath = path.join(repoRoot, '.tools', 'ui-redesign-coverage-audit.mjs');
const smokeOutputPath = path.join(repoRoot, '.ai-sync', 'UI_REDESIGN_COVERAGE.smoke.md');
const smokeGatePath = path.join(repoRoot, '.ai-sync', 'CUSTOMER_PLAYTEST_GATE.extra-smoke.md');
const fixtureRoot = path.join(repoRoot, '.ai-sync', 'ui-redesign-audit-fixture');
const fixtureGateDir = path.join(fixtureRoot, 'gates');
const fixtureAppPath = path.join(fixtureRoot, 'App.jsx');
const fixtureDesignPath = path.join(fixtureRoot, 'DESIGN_VERSIONS.md');
const fixtureContextPath = path.join(fixtureRoot, 'CONTEXT_LEDGER.md');
const fixtureOutputPath = path.join(fixtureRoot, 'UI_REDESIGN_COVERAGE.fixture.md');

rmSync(smokeOutputPath, { force: true });
rmSync(smokeGatePath, { force: true });
rmSync(fixtureRoot, { recursive: true, force: true });
writeFileSync(smokeGatePath, [
  '# Customer Playtest Gate',
  '',
  '| Route | Status | Evidence |',
  '| --- | --- | --- |',
  '| `/login` | Pass | Browser evidence captured for smoke route. |',
  '',
].join('\n'), 'utf8');

assert.ok(existsSync(helperPath), 'UI redesign coverage audit helper should exist.');

const result = spawnSync(
  process.execPath,
  [
    helperPath,
    '--out',
    smokeOutputPath,
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  },
);

assert.equal(result.status, 0, `Coverage audit helper should pass. stderr:\n${result.stderr}`);
assert.ok(existsSync(smokeOutputPath), 'Coverage audit helper should write the requested markdown artifact.');

const output = readFileSync(smokeOutputPath, 'utf8');

for (const requiredText of [
  'UI Redesign Coverage Audit',
  'Prompt-to-artifact checklist',
  'Route inventory',
  'Evidence gaps',
  'Next concrete route',
  'Customer gate',
  'imagegen-frontend-web',
  'browser:browser',
  '/profile',
  '/workflows',
]) {
  assert.match(output, new RegExp(requiredText), `Coverage audit output should include ${requiredText}.`);
}

assert.match(
  output,
  /\|\s*Route\s*\|\s*Component\s*\|\s*Design evidence\s*\|\s*Customer gate evidence\s*\|\s*Browser evidence\s*\|/,
  'Coverage audit should include a per-route evidence table.',
);

assert.match(
  output,
  /Status: (Not complete|Complete candidate)/,
  'Coverage audit should report an explicit completion status.',
);

if (/Status: Complete candidate/.test(output)) {
  assert.match(
    output,
    /## Evidence gaps\s+\n- none/,
    'Complete candidate output should only appear when no evidence gaps remain.',
  );
} else {
  assert.doesNotMatch(
    output,
    /## Evidence gaps\s+\n- none/,
    'Not complete output should list at least one evidence gap.',
  );
}

assert.match(
  output,
  /\|\s*`\/login`\s*\|\s*Login\s*\|\s*Yes\s*\|\s*Yes\s*\|\s*Yes\s*\|/,
  'Coverage audit should merge multiple customer gate artifacts, not only the canonical latest gate.',
);

mkdirSync(fixtureGateDir, { recursive: true });
writeFileSync(fixtureAppPath, [
  '<Route path="/alpha" element={<Alpha />} />',
  '<Route path="/beta" element={<Beta />} />',
  '<Route path="/run" element={<RunDetail />} />',
  '<Route path="/runs" element={<Runs />} />',
].join('\n'), 'utf8');
writeFileSync(fixtureDesignPath, [
  'Alpha',
  'Beta',
  'RunDetail',
  'Runs',
].join('\n'), 'utf8');
writeFileSync(fixtureContextPath, '', 'utf8');
writeFileSync(path.join(fixtureGateDir, 'CUSTOMER_PLAYTEST_GATE.fixture.md'), [
  '# Customer Playtest Gate',
  '',
  '| Route | Status | Evidence |',
  '| --- | --- | --- |',
  '| `/alpha` | Pass | Browser evidence captured. Beta is only mentioned as a neighboring navigation label. |',
  '| `/runs` | Pass | Browser evidence captured at `http://127.0.0.1:5174/runs`. |',
  '',
].join('\n'), 'utf8');

const fixtureResult = spawnSync(
  process.execPath,
  [
    helperPath,
    '--out',
    fixtureOutputPath,
    '--app',
    fixtureAppPath,
    '--design',
    fixtureDesignPath,
    '--context',
    fixtureContextPath,
    '--customer-gate-dir',
    fixtureGateDir,
    '--customer-gate-json-dir',
    fixtureGateDir,
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  },
);

assert.equal(fixtureResult.status, 0, `Fixture audit helper should pass. stderr:\n${fixtureResult.stderr}`);
const fixtureOutput = readFileSync(fixtureOutputPath, 'utf8');

assert.match(
  fixtureOutput,
  /\|\s*`\/alpha`\s*\|\s*Alpha\s*\|\s*Yes\s*\|\s*Yes\s*\|\s*Yes\s*\|/,
  'Fixture route with explicit route evidence should be covered.',
);

assert.match(
  fixtureOutput,
  /\|\s*`\/beta`\s*\|\s*Beta\s*\|\s*Yes\s*\|\s*No\s*\|\s*No\s*\|/,
  'Customer and browser evidence should require route-specific evidence, not just a component-name mention.',
);

assert.match(
  fixtureOutput,
  /\|\s*`\/runs`\s*\|\s*Runs\s*\|\s*Yes\s*\|\s*Yes\s*\|\s*Yes\s*\|/,
  'Plural /runs evidence should cover the plural route.',
);

assert.match(
  fixtureOutput,
  /\|\s*`\/run`\s*\|\s*RunDetail\s*\|\s*Yes\s*\|\s*No\s*\|\s*No\s*\|/,
  'Plural /runs evidence should not cover the singular /run route.',
);

assert.match(
  fixtureOutput,
  /Status: Not complete/,
  'Fixture audit should avoid marking the broad all-pages redesign goal complete while evidence gaps remain.',
);

rmSync(smokeOutputPath, { force: true });
rmSync(smokeGatePath, { force: true });
rmSync(fixtureRoot, { recursive: true, force: true });

console.log('[PASS] UI redesign coverage audit guardrails passed.');
