import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8');
const splitRunsStyle = readFileSync(path.join(here, "../../../styles/_split/runs.css"), 'utf8');
const contrastFixes = readFileSync(path.join(here, "../../../styles/contrast-fixes.css"), 'utf8');
const darkModeCohesion = readFileSync(path.join(here, "../../../styles/dark-mode-cohesion.css"), 'utf8');

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

assert.match(
  runsSource,
  /<div className="runs-profile-cockpit__heading">[\s\S]*?<p>\{t\('runs\.page_copy'\)\}<\/p>/,
  'The main Runs cockpit should retain its localized explanatory paragraph beneath the heading.',
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
    /\.runs-dashboard-page\s+\.runs-profile-signal\s+:is\(span,\s*strong,\s*p\)\s*\{[\s\S]*color:\s*currentColor\s*!important;[\s\S]*opacity:\s*1;/,
    `${label} should keep every cockpit signal-card text aligned with the white-card ink color.`,
  );

  assert.match(
    source,
    /\.runs-dashboard-page\s+\.runs-profile-workbench\s+\.recent-runs-search-input-wrap\s*\{[\s\S]*background:\s*#ffffff;[\s\S]*color:\s*var\(--runs-profile-ink\);/,
    `${label} should keep the Runs search surface white in the default/light cascade.`,
  );

  assert.match(
    source,
    /\.runs-dashboard-page\s+\.runs-profile-workbench\s+\.recent-runs-search-input\s*\{[\s\S]*color:\s*var\(--runs-profile-ink\);[\s\S]*caret-color:\s*var\(--runs-profile-ink\);/,
    `${label} should keep entered search text readable on the white search surface.`,
  );

  assert.match(
    source,
    /\.runs-dashboard-page\s+\.runs-profile-workbench\s+\.recent-runs-search-input::placeholder\s*\{[\s\S]*color:\s*var\(--runs-profile-muted\);/,
    `${label} should keep the search placeholder readable on the white search surface.`,
  );

  assert.match(
    source,
    /^\.runs-dashboard-page\s+\.runs-profile-workbench\s+\.recent-runs-search-input\s*\{[^}]*background:\s*transparent\s*!important;/m,
    `${label} should keep the search input transparent so the wrapper's white background stays uniform across the field.`,
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
  /\.runs-dashboard-page\s+\.runs-profile-signal\s*\{[\s\S]*background:\s*var\(--runs-profile-card-strong\);[\s\S]*color:\s*var\(--runs-profile-ink\);/,
  'Runs signal cards should use the white profile-card surface in the light theme.',
);

assert.match(
  splitRunsStyle,
  /\.runs-dashboard-page\s+\.runs-profile-signal--count\s*\{[\s\S]*background:\s*var\(--runs-profile-card-strong\);[\s\S]*color:\s*var\(--runs-profile-ink\);/,
  'Runs full-history signal should keep the same white profile-card surface as its siblings.',
);

for (const state of ['is-live', 'is-muted']) {
  assert.match(
    splitRunsStyle,
    new RegExp(`\\.runs-dashboard-page\\s+\\.runs-profile-signal--status\\.${state}\\s*\\{[\\s\\S]*background:\\s*var\\(--runs-profile-card-strong\\);[\\s\\S]*color:\\s*var\\(--runs-profile-ink\\);`),
    `Runs status signal (${state}) should retain the white profile-card surface instead of a colored state fill.`,
  );
}

assert.match(
  darkModeCohesion,
  /body\.theme-midnight\s+\.runs-dashboard-page\s+\.runs-profile-signal--status\s*\{[\s\S]*background:\s*var\(--runs-profile-card-strong\)\s*!important;/,
  'Midnight mode should preserve the profile-card surface on the status signal instead of restoring a colored fill.',
);

assert.match(
  darkModeCohesion,
  /body\.theme-midnight\s+\.runs-dashboard-page\s+\.runs-profile-workbench\s+\.recent-runs-search-input-wrap\s*\{[\s\S]*background:\s*var\(--brand-accent-gradient,\s*linear-gradient\(135deg,\s*#a0392a,\s*#fc7e69\)\)\s*!important;/,
  'Midnight mode should preserve the shared coral gradient on the search surface.',
);

assert.match(
  contrastFixes,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+#root\s+\.runs-dashboard-page\s+\.runs-profile-signal\s+span\s*\{[\s\S]*color:\s*var\(--runs-profile-muted\)\s*!important;[\s\S]*opacity:\s*1\s*!important;/,
  'Runs contrast fixes should keep signal-card labels grey on the white profile surface.',
);

assert.match(
  contrastFixes,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+#root\s+\.runs-dashboard-page\s+\.runs-profile-signal\s+:is\(strong,\s*p\)\s*\{[\s\S]*color:\s*var\(--runs-profile-ink\)\s*!important;[\s\S]*opacity:\s*1\s*!important;/,
  'Runs contrast fixes should keep signal-card values and notes black on the white profile surface.',
);

assert.match(
  contrastFixes,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+#root\s+\.runs-dashboard-page\s+\.runs-profile-workbench\s+\.recent-runs-chip\.is-active\s*\{[\s\S]*border-color:\s*transparent\s*!important;[\s\S]*background:\s*#f7d8d2\s*!important;[\s\S]*color:\s*#8f2f25\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'Runs active filter chips should use a red fill without an outer highlight ring on the light profile surface.',
);

console.log('[PASS] Runs profile-aligned cockpit guardrails passed.');
