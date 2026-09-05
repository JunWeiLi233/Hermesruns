import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8');
const splitRunsStyle = readFileSync(path.join(here, "../../../styles/_split/runs.css"), 'utf8');
const analysisDetailStyle = readFileSync(path.join(here, "../../../styles/analysis-detail-redesigns.css"), 'utf8');
const bundledStyle = readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blocksFor(source, selector) {
  return [...source.matchAll(new RegExp(`(?:^|\\n)${escapeRegExp(selector)}\\s*\\{[\\s\\S]*?\\n\\}`, 'gm'))].map((match) => match[0]);
}

function blockFor(source, selector, label) {
  const blocks = blocksFor(source, selector);
  assert.ok(blocks.length > 0, `${label} should define ${selector}.`);
  return blocks[blocks.length - 1];
}

function blockForMatching(source, selector, matcher, label, message) {
  const blocks = blocksFor(source, selector);
  const block = blocks.find((candidate) => matcher.test(candidate));
  assert.ok(block, `${label} should define ${selector} with ${message}.`);
  return block;
}

assert.match(
  runsSource,
  /<article className="recent-runs-insight-card recent-runs-insight-card--primary">[\s\S]*runs\.insight_runs_count/,
  'Runs should keep the recent-runs primary insight card wired to the filtered run count.',
);

for (const [label, source] of [
  ['split runtime style', splitRunsStyle],
  ['generated runtime style', bundledStyle],
]) {
  blockForMatching(
    source,
    '.runs-dashboard-page .runs-profile-history .recent-runs-insight-strip',
    /grid-template-columns:\s*minmax\(1\.18fr,\s*1\.28fr\)\s+minmax\(0,\s*0\.9fr\)\s+minmax\(0,\s*0\.9fr\)\s*!important;/,
    label,
    'a deliberate editorial lead column',
  );

  const primary = blockFor(
    source,
    '.runs-dashboard-page .runs-profile-history .recent-runs-insight-card--primary',
    label,
  );
  assert.match(primary, /position:\s*relative;/, `${label} primary card should anchor its accent layers.`);
  assert.match(primary, /overflow:\s*hidden;/, `${label} primary card should clip its accent layers.`);
  assert.match(primary, /isolation:\s*isolate;/, `${label} primary card should isolate its layered composition.`);
  assert.match(primary, /linear-gradient\(135deg,\s*rgba\(255,\s*248,\s*240,\s*0\.98\)/, `${label} primary card should use a warm light-theme surface.`);
  assert.match(primary, /box-shadow:[\s\S]*0 26px 68px rgba\(85,\s*48,\s*24,\s*0\.14\)/, `${label} primary card should use warm depth instead of a dark slab.`);
  assert.doesNotMatch(primary, /rgba\(25,\s*21,\s*18,\s*0\.94\)/, `${label} primary card should not keep the old dark light-theme slab.`);

  const before = blockFor(
    source,
    '.runs-dashboard-page .runs-profile-history .recent-runs-insight-card--primary::before',
    label,
  );
  assert.match(before, /background:\s*linear-gradient\(180deg,\s*#ef6a52/, `${label} primary card should render a coral editorial rail.`);

  assert.doesNotMatch(
    source,
    /\.runs-dashboard-page\s+\.runs-profile-history\s+\.recent-runs-insight-card--primary::after/,
    `${label} primary card should not render the removed circular line-field pseudo-element.`,
  );

  const contentLayer = blockFor(
    source,
    '.runs-dashboard-page .runs-profile-history .recent-runs-insight-card--primary :is(span, strong, p)',
    label,
  );
  assert.match(contentLayer, /z-index:\s*1;/, `${label} primary card content should sit above decorative layers.`);

  const strong = blockFor(
    source,
    '.runs-dashboard-page .runs-profile-history .recent-runs-insight-card--primary strong',
    label,
  );
  assert.match(strong, /background:\s*transparent\s*!important;/, `${label} primary metric should not render as a translucent pill.`);
  assert.match(strong, /font-family:\s*"Manrope",\s*var\(--font-display\);/, `${label} primary metric should use the site's expressive display stack.`);
  assert.match(strong, /font-size:\s*clamp\(1rem,\s*1\.35vw,\s*1\.34rem\);/, `${label} primary metric should remain compact inside the scan-first glance rail.`);

  const darkPrimary = blockFor(
    source,
    'body:is(.theme-midnight, .theme-high-contrast) .runs-dashboard-page .runs-profile-history .recent-runs-insight-card--primary',
    label,
  );
  assert.match(darkPrimary, /linear-gradient\(135deg,\s*rgba\(39,\s*32,\s*27,\s*0\.96\)/, `${label} should include a dedicated dark-mode primary card surface.`);

  const darkStrong = blockFor(
    source,
    'body:is(.theme-midnight, .theme-high-contrast) .runs-dashboard-page .runs-profile-history .recent-runs-insight-card--primary strong',
    label,
  );
  assert.match(darkStrong, /color:\s*#fff7ee\s*!important;/, `${label} should keep the primary metric readable in dark mode.`);
}


const finalPrimary = blockFor(
  analysisDetailStyle,
  '#root .runs-dashboard-page .runs-profile-history .recent-runs-insight-card.recent-runs-insight-card--primary',
  'post-runs cascade override',
);
assert.match(
  finalPrimary,
  /linear-gradient\(135deg,\s*rgba\(255,\s*248,\s*240,\s*0\.98\)[\s\S]*!important;/,
  'The later analysis-detail stylesheet should preserve the warm profile card instead of the old coral hero slab.',
);
assert.doesNotMatch(
  analysisDetailStyle,
  /#root\s+\.runs-dashboard-page\s+\.recent-runs-insight-card\.recent-runs-insight-card--primary\s*\{[\s\S]*linear-gradient\(150deg,\s*#ffb4a7/,
  'The later imported stylesheet should not keep the old global coral Runs primary card override.',
);

const finalStrong = blockFor(
  analysisDetailStyle,
  '#root .runs-dashboard-page .runs-profile-history .recent-runs-insight-card.recent-runs-insight-card--primary strong',
  'post-runs cascade override',
);
assert.match(
  finalStrong,
  /color:\s*#3f261c\s*!important;/,
  'The later imported stylesheet should keep the primary metric dark on the light editorial surface.',
);
assert.match(
  finalStrong,
  /font-size:\s*clamp\(1rem,\s*1\.35vw,\s*1\.34rem\)\s*!important;/,
  'The later imported stylesheet should preserve the compact glance-rail metric size.',
);
console.log('[PASS] Runs primary insight card design guardrails passed.');
