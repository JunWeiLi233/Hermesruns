import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, '../../..', relativePath), 'utf8');
const source = read('pages/analysis/AnalysisInsightDetail.jsx');
const styleSource = read('styles/analysis-profile-visual-alignment.css');
const branchStart = source.indexOf("insightKey === 'coach-insight' && coachSystem ? (");
const branchEnd = source.indexOf(") : insightKey === 'injury-risk' ? (", branchStart);
const coachBranch = source.slice(branchStart, branchEnd);

assert.ok(branchStart >= 0 && branchEnd > branchStart, 'Coach Insight branch should remain addressable.');
assert.ok(coachBranch.includes('analysis-coach-profile-decision'), 'Coach Insight should expose a Load Balance-shaped decision hero.');
assert.ok(coachBranch.indexOf('analysis-profile-v2-header') < coachBranch.indexOf('analysis-coach-profile-decision'));
assert.ok(!coachBranch.includes('analysis-coach-profile-metrics'), 'Coach Insight should omit the removed forecast metric strip.');
assert.ok(!coachBranch.includes('analysis-coach-command-hero-metric'), 'Coach Insight should omit the removed forecast metric cards.');
assert.ok(coachBranch.indexOf('analysis-coach-profile-decision') < coachBranch.indexOf('analysis-coach-profile-workbench'));
assert.ok(coachBranch.includes('analysis-coach-profile-window'), 'The decision hero should keep a right-side training-window summary.');
assert.ok(coachBranch.includes('CoachIdentityBadge'), 'Coach identity should remain in the decision hero.');
assert.ok(coachBranch.includes("navigate('/today-run')"), 'Coach primary action should remain wired to Today Run.');
assert.ok(coachBranch.includes('buildRunDetailPath(row.id)'), 'Recent sessions should remain wired to run detail.');
assert.match(
  styleSource,
  /body #root \.analysis-insight-detail-page\.is-coach-insight[\s\S]*?\.analysis-coach-profile-decision\s*\{/,
  'Coach parity styling must be route-scoped.',
);
assert.doesNotMatch(styleSource, /^\.analysis-coach-profile-window\s*\{/m, 'The new window must not become a bare global selector.');

console.log('[PASS] Coach Insight Load Balance parity guardrails passed.');
