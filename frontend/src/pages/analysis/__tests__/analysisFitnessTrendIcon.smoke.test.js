import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../../styles/_split/analysis.css'), 'utf8');

assert.match(
  pageSource,
  /import fitnessTrendIcon from ['"]\.\.\/assets\/fitness-trend-icon-green\.png['"];?/,
  'Analysis should import the generated green fitness-trend icon.',
);
assert.match(
  pageSource,
  /className="analysis-overview-card-kicker analysis-vdot-trend-kicker">[\s\S]*className="analysis-vdot-trend-icon"\s+src=\{fitnessTrendIcon\}[\s\S]*analysis\.vdot_trend_insight_title/,
  'The green fitness-trend icon should sit beside the 你的体能正在变化 label.',
);
assert.match(
  pageSource,
  /<h3 className="analysis-overview-vdot-trend-heading">\s*<AppIcon[\s\S]*name=\{vdotTrend\.direction === 'improving'/,
  'The original dynamic trend-direction icon should remain in the value heading.',
);
assert.match(
  styleSource,
  /\.analysis-page-shell\.analysis-page-shell \.analysis-profile-reference-card\.is-trend \.analysis-vdot-trend-kicker\s*\{[^}]*color:\s*#34c759\s*!important;/,
  'The 你的体能正在变化 label should use the matching green accent.',
);

console.log('[PASS] Analysis fitness-trend icon guard passed.');
