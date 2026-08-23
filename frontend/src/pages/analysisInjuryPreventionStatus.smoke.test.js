import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');

assert.match(
  analysisSource,
  /useEffect\(\(\) => \{\s*if \(!isAuthenticated\) return;\s*let cancelled = false;[\s\S]*?apiJson\('\/api\/injury-risk\/status'\)/,
  'Injury prevention should load for every authenticated runner, even without run history.',
);

assert.doesNotMatch(
  analysisSource,
  /if \(!hasRuns\) return;[\s\S]*?apiJson\('\/api\/injury-risk\/status'\)/,
  'Injury prevention status should not be gated by the analysis run list.',
);

assert.match(
  analysisSource,
  /const latestSorenessLevel = String\(\s*injuryStatus\?\.recentLogs\?\.\[0\]\?\.level \?\? injuryStatus\?\.sorenessLevel \?\? ''\s*\)\.toLowerCase\(\);/,
  'The active check-in button should handle both status history and the current soreness value.',
);

assert.match(
  analysisSource,
  /Card 1: Combined Risk Score[\s\S]*?<button[\s\S]*?analysis-overview-card--interactive[\s\S]*?onClick=\{\(\) => navigate\('\/analysis\/injury-risk'\)\}[\s\S]*?stitch_injury_prevention_risk_title[\s\S]*?<\/button>/,
  'The injury risk card should open the existing injury-risk detail page.',
);

assert.doesNotMatch(
  analysisSource,
  /<span className="analysis-overview-card-kicker">\{t\('analysis\.stitch_injury_prevention_risk_kicker'\)\}<\/span>/,
  'The combined-risk card should not render the removable risk kicker pill.',
);

assert.doesNotMatch(
  analysisSource,
  /<span className="analysis-overview-card-kicker">\{t\('analysis\.stitch_injury_prevention_soreness_kicker'\)\}<\/span>/,
  'The soreness card should not render the removable daily check-in kicker pill.',
);

assert.doesNotMatch(
  analysisSource,
  /<span className="analysis-overview-card-kicker">\{t\('analysis\.stitch_injury_prevention_acwr_kicker'\)\}<\/span>/,
  'The ACWR card should not render the removable load-balance kicker pill.',
);

assert.doesNotMatch(
  analysisSource,
  /<span className="analysis-overview-card-kicker" style=\{\{ marginTop: '14px' \}\}>\{t\('analysis\.stitch_injury_prevention_coach_kicker'\)\}<\/span>/,
  'The coach-advice card should not render the removable kicker pill.',
);

assert.match(
  analysisSource,
  /Card 2: ACWR Monitor[\s\S]*?<button[\s\S]*?analysis-overview-card--interactive[\s\S]*?onClick=\{\(\) => navigate\('\/analysis\/load-balance'\)\}[\s\S]*?stitch_injury_prevention_acwr_title[\s\S]*?<\/button>/,
  'The ACWR card should open the existing load-balance detail page.',
);

assert.match(
  analysisSource,
  /className=\{cx\('analysis-injury-prevention-soreness-btn', 'is-low'[\s\S]*?aria-pressed=\{latestSorenessLevel === 'low'\}/,
  'The daily check-in controls should expose their selected state.',
);

console.log('[PASS] Analysis injury prevention status guardrails passed.');
