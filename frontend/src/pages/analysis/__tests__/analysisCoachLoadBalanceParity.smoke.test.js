import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, '../../..', relativePath), 'utf8');
const source = read('pages/analysis/AnalysisInsightDetail.jsx');
const styleSource = read('styles/analysis-coach-bento.css');
const branchStart = source.indexOf("insightKey === 'coach-insight' && coachSystem ? (");
const branchEnd = source.indexOf(") : insightKey === 'injury-risk' ? (", branchStart);
const coachBranch = source.slice(branchStart, branchEnd);

assert.ok(branchStart >= 0 && branchEnd > branchStart, 'Coach Insight branch should remain addressable.');
assert.ok(coachBranch.includes('analysis-coach-bento__verdict'), 'Coach Insight should expose its decision verdict tile.');
assert.match(coachBranch, /analysis-coach-bento__verdict[\s\S]*?<h1>\{coachSystem\.title\}<\/h1>[\s\S]*?<p>\{coachSystem\.subtitle\}<\/p>/, 'The verdict must retain the coach decision and explanation.');
assert.ok(!coachBranch.includes('analysis-coach-profile-metrics'), 'Coach Insight should omit the removed forecast metric strip.');
assert.ok(!coachBranch.includes('analysis-coach-command-hero-metric'), 'Coach Insight should omit the removed forecast metric cards.');
assert.ok(coachBranch.includes('analysis-coach-bento__today'), 'Coach Insight should retain the primary training tile.');
assert.ok(coachBranch.indexOf('analysis-coach-bento__verdict') < coachBranch.indexOf('analysis-coach-bento__today'));
assert.match(coachBranch, /analysis-coach-bento__readiness-note">\{coachSystem\.readinessDescription\}/, 'The training tile should retain the readiness explanation.');
assert.match(coachBranch, /analysis-coach-bento__toggle" role="group"[\s\S]*?setCoachPerformanceWindow\(7\)[\s\S]*?setCoachPerformanceWindow\(28\)/, 'The load tile should retain both training-window actions.');
assert.ok(coachBranch.includes('CoachIdentityBadge'), 'Coach identity should remain in the decision hero.');
assert.ok(coachBranch.includes("navigate('/today-run')"), 'Coach primary action should remain wired to Today Run.');
assert.ok(coachBranch.includes('buildRunDetailPath(row.id)'), 'Recent sessions should remain wired to run detail.');
assert.match(
  styleSource,
  /#root \.analysis-insight-detail-page\.is-coach-insight \.analysis-coach-bento\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\);/,
  'Coach parity styling must be route-scoped.',
);
assert.doesNotMatch(styleSource, /^\.analysis-coach-bento__toggle\s*\{/m, 'The training-window control must not become a bare global selector.');

console.log('[PASS] Coach Insight Load Balance parity guardrails passed.');
