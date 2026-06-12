import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const splitRunsStyle = readFileSync(path.join(here, '../styles/_split/runs.css'), 'utf8');
const contrastFixes = readFileSync(path.join(here, '../styles/contrast-fixes.css'), 'utf8');

assert.match(
  runsSource,
  /<section className="runs-profile-cockpit" aria-labelledby="runs-profile-title">/,
  'Runs should render the profile-aligned cockpit as the current top surface.',
);

assert.match(
  runsSource,
  /className="runs-profile-cockpit"/,
  'Runs should use the profile-aligned cockpit instead of the retired generated-photo hero.',
);

assert.match(
  runsSource,
  /className="recent-runs-chip-stack runs-profile-workbench"/,
  'Runs filters should sit in the profile-aligned workbench rail.',
);

assert.match(
  runsSource,
  /<button type="button" className="recent-runs-card"[^>]*onClick=\{\(\) => onOpen\(run\)\}>/,
  'Run cards should be real buttons so the whole card click target is keyboard-accessible.',
);

assert.doesNotMatch(
  runsSource,
  /recent-runs-card-menu|recent-runs-hero-overlay|recent-runs-hero recent-runs-hero--dashboard/,
  'Runs should not reintroduce the inert three-dot card menu or the old image hero overlay.',
);

for (const [label, source] of [
  ['legacy style bundle', styleSource],
  ['split runtime style', splitRunsStyle],
]) {
  assert.match(
    source,
    /\.runs-dashboard-page\s+\.runs-profile-cockpit\s*\{/,
    `${label} should include the profile-aligned cockpit styles.`,
  );

  assert.match(
    source,
    /\.runs-dashboard-page\s+\.runner-shell-canvas\s*\{[\s\S]*background:\s*transparent;/,
    `${label} should keep the Runs page canvas background removed.`,
  );

  assert.match(
    source,
    /\.runs-dashboard-page\s+\.runs-profile-cockpit\s*\{[\s\S]*background:\s*var\(--runs-profile-card-strong\);/,
    `${label} should keep the Runs cockpit as a plain separate panel, not a decorative background field.`,
  );

  assert.match(
    source,
    /\.runs-dashboard-page\s+\.runs-profile-signal--count\s+:is\(span,\s*strong,\s*p\)\s*\{[\s\S]*color:\s*#ffffff\s*!important;[\s\S]*opacity:\s*1;/,
    `${label} should keep the Full History count-card text white and fully visible.`,
  );

  assert.match(
    source,
    /\.runs-dashboard-page\s+\.runs-profile-history\s+button\.recent-runs-card\s*\{/,
    `${label} should reset the semantic run-card button styling.`,
  );

  assert.doesNotMatch(
    source,
    /photo-1552674605-db6ffd4facb5|recent-runs-card-menu|\.runs-profile-cockpit::before/,
    `${label} should not keep the retired Runs photo hero URL, card menu selectors, or cockpit background grid layer.`,
  );
}

assert.match(
  splitRunsStyle,
  /\.runs-dashboard-page\s+\.runs-profile-signal--count\s*\{[\s\S]*background:\s*#191512;[\s\S]*color:\s*#fff7ee;/,
  'Runs full-history signal text should remain light on its dark cockpit card.',
);

assert.match(
  contrastFixes,
  /#root\s+\.runs-dashboard-page\s+\.runs-profile-signal--count\s+:is\(span,\s*strong,\s*p\)\s*\{[\s\S]*color:\s*#ffffff\s*!important;[\s\S]*opacity:\s*1\s*!important;/,
  'Runs contrast fixes should override the light-mode dashboard strong blanket so the Full History count card stays white.',
);

console.log('[PASS] Runs profile-aligned cockpit guardrails passed.');
