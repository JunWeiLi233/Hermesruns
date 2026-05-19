import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rewardsSource = readFileSync(path.join(here, 'Rewards.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN.js'), 'utf8');

assert.match(
  rewardsSource,
  /const\s+nextReward\s*=\s*upcomingRewards\[0\]\s*\|\|\s*null/,
  'Rewards should promote the first live upcoming reward into the awards next-unlock surface.',
);

assert.match(
  rewardsSource,
  /rewards-award-page/,
  'Rewards should render the fully redesigned awards page shell.',
);

assert.match(
  rewardsSource,
  /earnedPreview\s*=\s*earnedRewards\.slice\(0,\s*5\)/,
  'Rewards should keep a live earned-badge preview strip instead of flattening the page into static cards.',
);

assert.match(
  rewardsSource,
  /rewards-award-next-card/,
  'Rewards should expose a dedicated next-unlock card instead of only a generic upcoming grid.',
);

assert.match(
  rewardsSource,
  /runner-shell-topbar-profile-actions\s+analysis-stitch-topbar-profile-actions/,
  'Rewards should preserve the shared runner-shell topbar profile-actions marker.',
);

assert.match(
  styleSource,
  /\.rewards-award-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.12fr\)/,
  'Rewards styles should define an asymmetric awards hero grid.',
);

assert.match(
  styleSource,
  /\.rewards-award-ring\s*\{[\s\S]*conic-gradient/,
  'Rewards styles should define a conic awards completion ring.',
);

assert.match(
  styleSource,
  /\.rewards-award-next-card\s*\{/,
  'Rewards styles should define the next-unlock awards card surface.',
);

assert.match(
  styleSource,
  /Awards page light mode: warm gallery/,
  'Rewards styles should include the light awards-gallery mode.',
);

assert.match(
  styleSource,
  /body\s+\.rewards-award-page\s*\{[\s\S]*linear-gradient\(135deg,\s*#fbf6ec/,
  'Rewards awards page should use a warm light background instead of the dark vault as the active mode.',
);

for (const localeSource of [enSource, zhSource]) {
  assert.match(localeSource, /"locked_badges_label"/, 'Rewards locale should include the locked badge metric label.');
  assert.match(localeSource, /"runs_logged_label"/, 'Rewards locale should include the logged-runs metric label.');
}

console.log('[PASS] Rewards awards redesign guardrails passed.');
