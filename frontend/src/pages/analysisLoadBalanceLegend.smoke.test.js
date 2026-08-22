import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const styles = readFileSync(path.join(here, '..', 'styles', 'analysis-load-balance-profile-alignment.css'), 'utf8');

assert.match(
  source,
  /<div className="analysis-load-command-legend">\s*<span><i className="is-acute" \/>\{loadDashboard\.chartLegendAcute\}<\/span>\s*<span><i className="is-chronic" \/>\{loadDashboard\.chartLegendChronic\}<\/span>/,
  'Load-balance legend should keep the acute and chronic labels paired with their marker dots.',
);
assert.match(
  styles,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-legend i\.is-acute\s*\{[\s\S]*?background:\s*#f07561;/,
  'The 负荷分数 marker should match the solid coral load-score line.',
);
assert.match(
  styles,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-legend i\.is-chronic\s*\{[\s\S]*?background:\s*#78b4ff;/,
  'The 步频基线 marker should match the dashed blue baseline line.',
);

console.log('[PASS] Load-balance legend color guard passed.');
