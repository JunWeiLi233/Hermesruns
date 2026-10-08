import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = fs.readFileSync(path.join(here, "../Analysis.jsx"), 'utf8');
const analysisStyles = fs.readFileSync(path.join(here, "../../../styles/analysis-v2.css"), 'utf8');

const loadOverview = analysisSource.match(
  /className="analysis-v2-check" onClick=\{\(\) => navigate\('\/analysis\/load-balance'\)\}[\s\S]*?<\/button>/,
);

assert.ok(loadOverview, 'The analysis overview should keep its ACWR load-balance card.');
assert.match(loadOverview[0], /analysis-v2-acwr-scale/, 'The ACWR overview card should keep its load scale.');
assert.match(loadOverview[0], /trainingLoad\.lastAcwr\.toFixed\(2\)/, 'The ACWR overview card should keep its score.');
assert.match(loadOverview[0], /analysis\.stitch_acwr_copy/, 'The ACWR overview card should keep its explanatory copy.');
assert.doesNotMatch(
  loadOverview[0],
  /analysis-overview-status-pill/,
  'The ACWR overview card should not render the removed decorative status capsule.',
);

assert.match(
  analysisStyles,
  /\.analysis-v2-acwr-scale\s*\{[\s\S]*?background:\s*linear-gradient/,
  'The load scale should retain its colored load ranges.',
);

assert.doesNotMatch(
  analysisStyles,
  /analysis-overview-status-pill/,
  'The ACWR responsive layouts should not reserve a row for the removed status capsule.',
);

console.log('[PASS] Analysis load-balance overview status removal guardrails passed.');
