import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = fs.readFileSync(path.join(here, "../Analysis.jsx"), 'utf8');
const analysisStyles = fs.readFileSync(path.join(here, "../../../styles/_split/analysis.css"), 'utf8');

const loadOverview = analysisSource.match(
  /className="analysis-overview-card analysis-overview-card--load[\s\S]*?<\/button>/,
);

assert.ok(loadOverview, 'The analysis overview should keep its ACWR load-balance card.');
assert.match(loadOverview[0], /<Gauge\s+value=/, 'The ACWR overview card should keep its gauge.');
assert.match(loadOverview[0], /analysis-overview-gauge-value/, 'The ACWR overview card should keep its score.');
assert.match(loadOverview[0], /analysis\.stitch_acwr_copy/, 'The ACWR overview card should keep its explanatory copy.');
assert.doesNotMatch(
  loadOverview[0],
  /analysis-overview-status-pill/,
  'The ACWR overview card should not render the removed decorative status capsule.',
);

assert.match(
  analysisStyles,
  /\.analysis-page-shell \.analysis-profile-reference-card\.is-load\s*\{[\s\S]*?grid-template-areas:\s*\n\s*"label gauge value"\s*\n\s*"copy gauge \.";/,
  'The desktop ACWR card should leave the removed status area empty without changing the card alignment.',
);

assert.doesNotMatch(
  analysisStyles,
  /\.analysis-page-shell \.analysis-profile-reference-card\.is-load\s*\{[\s\S]*?grid-template-areas:[\s\S]*?"status"/,
  'The ACWR responsive layouts should not reserve a row for the removed status capsule.',
);

console.log('[PASS] Analysis load-balance overview status removal guardrails passed.');
