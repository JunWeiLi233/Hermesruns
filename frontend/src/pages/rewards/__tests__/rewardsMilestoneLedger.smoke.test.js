import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const page = read('../Rewards.jsx');
const css = read('../../../styles/rewards-v2.css');
const appStyles = read('../../../styles/app.css');
const skeletonStyles = read('../../../styles/loading-skeleton.css');
assert.match(page, /apiJson\('\/api\/profile\/me'\)/);
assert.match(page, /apiJson\('\/api\/activities'\)/);
assert.match(page, /buildRewardShowcase\(runs, lang\)/);
assert.match(page, /allRewards\.filter\(\(reward\) => !reward\.earned\)/,
  'The hero must use the entire catalog, not the capped upcoming subset.');
for (const marker of ['rewards-ledger-page', 'rewards-ledger-canvas', 'rewards-profile-canvas',
  'rewards-v2-hero', 'rewards-v2-ring', 'rewards-v2-closest', 'rewards-v2-track', 'rewards-v2-ladder']) {
  assert.ok(page.includes(marker), `Rewards must render ${marker}.`);
}
assert.match(page, /runner-shell-topbar-profile-actions\s+analysis-stitch-topbar-profile-actions/);
assert.match(page, /<PageSkeleton variant="rewards"/);
assert.match(page, /navigate\('\/today-run'\)/);
assert.match(page, /<summary>/, 'Badge details must be accessible to keyboard and touch users.');
assert.ok(appStyles.includes("@import './rewards-v2.css';"));
assert.ok(appStyles.indexOf("@import './rewards-v2.css';") > appStyles.indexOf("@import './_split/profile-dashboard-redesign.css';"),
  'The page-specific Rewards stylesheet must follow the shared dashboard styles.');
assert.match(page, /<RewardIllustration reward=\{nextMilestone\}/);
assert.match(page, /<RewardIllustration reward=\{reward\}/);
assert.doesNotMatch(page, /RewardGlyph/);
assert.match(css, /rewards-v2-step-medal[^}]*width: 72px; height: 72px/);
assert.match(skeletonStyles, /page-skeleton__rewards-v2-medal[^}]*width: 72px; height: 72px/,
  'Loading placeholders must match the larger illustrated badges.');
assert.match(css, /rewards-v2-track-scroll[^}]*overflow-x: auto/);
assert.match(css, /minmax\(112px, 1fr\)/, 'Large catalogs must not compress medals into unreadable columns.');
assert.match(css, /@media \(max-width: 720px\)/);
assert.match(css, /theme-midnight, \.theme-high-contrast/);
assert.match(css, /:focus-visible/);
for (const locale of ['en', 'zh-CN']) {
  const source = read(`../../../i18n/locales/${locale}/components.js`);
  for (const key of ['v2_of_total', 'v2_within_reach', 'v2_track_help', 'v2_track_distance', 'v2_track_volume',
    'v2_track_consistency', 'v2_track_explore', 'v2_track_moments']) assert.ok(source.includes(`"${key}"`));
}
console.log('[PASS] Rewards season-ring layout retains live data, shell, translations and responsive badge tracks.');
