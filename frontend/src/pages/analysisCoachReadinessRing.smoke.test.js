import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const styles = fs.readFileSync(path.join(here, '../styles/analysis-profile-visual-alignment.css'), 'utf8');

const branchStart = source.indexOf("{insightKey === 'coach-insight' && coachSystem ? (");
const branchEnd = source.indexOf(") : insightKey === 'injury-risk' ? (", branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart, 'coach insight branch should remain addressable');

const coachBranch = source.slice(branchStart, branchEnd);

assert.match(coachBranch, /analysis-coach-readiness-ring/, 'Coach Insight should render a dedicated readiness ring wrapper.');
assert.match(coachBranch, /<svg[^>]+viewBox="0 0 160 160"/, 'Coach Insight readiness should use a square SVG viewBox.');
assert.match(coachBranch, /strokeDash(?:array|offset)=\{/, 'Coach Insight readiness should render a real progress arc.');
assert.match(coachBranch, /aria-label=\{/, 'Coach Insight readiness ring should expose its score to assistive technology.');

assert.match(
  styles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-coach-readiness-ring\s*\{[\s\S]*flex:\s*0 0 var\(--coach-readiness-ring-size\);[\s\S]*aspect-ratio:\s*1;/,
  'Coach Insight readiness ring should lock a square, non-shrinking geometry.',
);
assert.match(
  styles,
  /\.analysis-coach-readiness-ring__progress\s*\{[\s\S]*stroke-linecap:\s*round;/,
  'Coach Insight readiness progress should use a rounded SVG stroke.',
);

console.log('analysis coach readiness ring smoke test passed');
