import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../../..");
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const pageSource = read('./pages/analysis/AnalysisInsightDetail.jsx');
const indexSource = read('./index.css');
const styleSource = read('./styles/analysis-intensity-profile-alignment.css');
const profileStyleSource = read('./styles/analysis-profile-visual-alignment.css');
const intensityStart = pageSource.indexOf("insightKey === 'intensity' && intensityDashboard ? (");
const intensityEnd = pageSource.indexOf(') : (', intensityStart);
assert.ok(intensityStart >= 0 && intensityEnd > intensityStart, 'The intensity detail branch should remain identifiable.');
const intensityBranch = pageSource.slice(intensityStart, intensityEnd);

assert.doesNotMatch(
  intensityBranch,
  /analysis-vo2-page-back|navigate\('\/analysis'\)/,
  'The intensity detail hero should not render the removed back-to-analysis control or handler.',
);

assert.match(
  pageSource,
  /insightKey === 'intensity'[\s\S]*?<div className="analysis-intensity-profile-content">/,
  'The intensity route should own a Profile-scoped content wrapper.',
);

const glassImport = indexSource.indexOf("@import './styles/all-pages-liquid-glass.css';");
const intensityImport = indexSource.indexOf("@import './styles/analysis-intensity-profile-alignment.css';");
assert.ok(intensityImport > glassImport, 'The intensity Profile alignment must load after the shared glass cascade.');

assert.match(styleSource, /--intensity-radius-xl:\s*20px/);
assert.match(styleSource, /grid-template-columns:minmax\(0,1.83fr\) minmax\(290px,1fr\)/);
assert.match(styleSource, /\.intensity-zone-readings[^}]*repeat\(5,minmax\(0,1fr\)\)/);
assert.match(styleSource, /font:italic 800 clamp\(28px,3vw,38px\)/);
assert.match(styleSource, /body:is\([^)]*\.theme-midnight[^)]*\)[\s\S]*\.analysis-intensity-profile-content/);
assert.match(styleSource, /@media \(max-width:960px\)/);
assert.match(styleSource, /@media \(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(intensityBranch, /analysis-intensity-command-hero-stats|analysis-intensity-command-sample-visual/);
assert.ok(intensityBranch.indexOf('intensity-hero') < intensityBranch.indexOf('MeasuredHrZoneBlock'));
assert.match(intensityBranch, /<QualitySessions[^>]*compact/);

const injuryMediumInsetStart = profileStyleSource.indexOf('@media (max-width: 960px)');
const injurySmallInsetStart = profileStyleSource.indexOf('@media (max-width: 760px)', injuryMediumInsetStart);
const injuryCanvasRule = profileStyleSource.match(
  /body #root \.analysis-insight-detail-page\.is-injury-risk \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{[^}]*\}/s,
);
assert.ok(injuryCanvasRule, 'The Injury Risk canvas parity rule should remain identifiable.');
assert.match(injuryCanvasRule[0], /width:\s*100%\s*!important/);
assert.match(injuryCanvasRule[0], /max-width:\s*none\s*!important/);
assert.ok(
  injuryMediumInsetStart >= 0 && injurySmallInsetStart > injuryMediumInsetStart,
  'The Injury Risk responsive alignment rules should remain grouped by breakpoint.',
);
assert.match(
  profileStyleSource.slice(injuryMediumInsetStart, injurySmallInsetStart),
  /body #root \.analysis-insight-detail-page\.is-injury-risk \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{[\s\S]*padding-inline:\s*16px\s*!important;/,
  'Injury Risk should use the same 16px left inset as Intensity through the medium breakpoint.',
);
assert.match(
  profileStyleSource.slice(injurySmallInsetStart),
  /body #root \.analysis-insight-detail-page\.is-injury-risk \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{[\s\S]*padding-inline:\s*16px\s*!important;/,
  'Injury Risk should retain the same 16px left inset as Intensity on small screens.',
);
console.log('[PASS] Analysis intensity uses the compact Profile design hierarchy.');
