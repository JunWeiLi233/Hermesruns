import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rewardsSource = readFileSync(path.join(here, 'Rewards.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const alignmentSource = readFileSync(path.join(here, '../styles/rewards-profile-alignment.css'), 'utf8');
const indexSource = readFileSync(path.join(here, '../index.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');

assert.match(
  rewardsSource,
  /const\s+nextMilestone\s*=\s*upcomingRewards\[0\]\s*\|\|\s*null/,
  'Rewards should promote the first live upcoming reward into the next milestone surface.',
);

for (const className of [
  'rewards-ledger-page',
  'rewards-ledger-canvas',
  'rewards-ledger-hero',
  'rewards-ledger-hero-card--next',
  'rewards-ledger-metrics',
  'rewards-ledger-section',
]) {
  assert.match(rewardsSource, new RegExp(className), `Rewards should keep ${className}.`);
}

assert.match(
  rewardsSource,
  /priorityPipeline\s*=\s*useMemo/,
  'Rewards should keep the live upcoming reward priority pipeline.',
);

assert.match(
  rewardsSource,
  /runner-shell-topbar-profile-actions\s+analysis-stitch-topbar-profile-actions/,
  'Rewards should preserve the shared runner-shell topbar profile-actions marker.',
);

assert.match(
  rewardsSource,
  /runner-shell-canvas\s+hd-content\s+rewards-ledger-canvas\s+rewards-profile-canvas/,
  'Rewards should inherit the Profile dashboard canvas and its scoped design tokens.',
);

for (const marker of [
  /\.rewards-profile-canvas/,
  /var\(--hd-bg-card\)/,
  /var\(--hd-bg-today\)/,
  /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
  /@media\s*\(max-width:\s*768px\)/,
]) {
  assert.match(alignmentSource, marker, 'Rewards should preserve its Profile-aligned responsive presentation layer.');
}

assert.match(
  indexSource,
  /@import '\.\/styles\/rewards-profile-alignment\.css';/,
  'The live frontend cascade should import the Rewards profile-alignment layer.',
);

assert.match(
  styleSource,
  /\.rewards-ledger-hero\s*\{/,
  'Rewards styles should define the ledger hero surface.',
);

assert.match(
  styleSource,
  /\.rewards-ledger-hero-progress\s*\{/,
  'Rewards styles should define the progress bar surface.',
);

for (const localeSource of [enSource, zhSource]) {
  assert.match(localeSource, /"locked_badges_label"/, 'Rewards locale should include the locked badge metric label.');
  assert.match(localeSource, /"runs_logged_label"/, 'Rewards locale should include the logged-runs metric label.');
}

console.log('[PASS] Rewards awards redesign guardrails passed.');
