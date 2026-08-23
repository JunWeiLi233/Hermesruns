import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const pageSource = read('pages/AnalysisInsightDetail.jsx');
const indexSource = read('index.css');
const styleSource = read('styles/analysis-intensity-profile-alignment.css');
const profileStyleSource = read('styles/analysis-profile-visual-alignment.css');
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
assert.match(styleSource, /\.analysis-intensity-command-zone-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(styleSource, /\.analysis-intensity-command-sample-visual\s*\{[\s\S]*min-height:\s*64px/);
const judgmentIndex = styleSource.indexOf('.analysis-insight-detail-page.is-intensity .analysis-intensity-command-judgment {');
assert.ok(judgmentIndex >= 0, 'The intensity insight should have a judgment card surface rule.');
assert.match(
  styleSource.slice(judgmentIndex, judgmentIndex + 520),
  /background:[\s\S]*#fffdf9/,
  'The intensity judgment card should use the white Profile surface instead of the dark grid.',
);
assert.match(
  styleSource,
  /#root\s+\.analysis-insight-detail-page\.is-intensity\s+\.analysis-intensity-command-judgment\s+\.coach-identity-copy\s+strong[\s\S]*color:\s*#1c1917\s*!important/,
  'The intensity judgment coach name should override the dark-card cream-text safeguard.',
);
assert.match(styleSource, /body:is\([^)]*\.theme-midnight[^)]*\)[\s\S]*\.analysis-intensity-profile-content/);
assert.match(styleSource, /@media \(max-width:\s*960px\)/);
assert.match(styleSource, /@media \(prefers-reduced-motion:\s*reduce\)/);

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
assert.match(
  styleSource,
  /#root\s+\.analysis-insight-detail-page\.is-intensity\s+\.runner-shell-side-link\.is-active\s*\{[\s\S]*border-color:\s*transparent\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'The active intensity navigation item should keep its label and marker without a pill background.',
);

console.log('[PASS] Analysis intensity uses the compact Profile design hierarchy.');
