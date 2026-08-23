import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');

const sliceBetween = (startMarker, endMarker) => {
  const start = pageSource.indexOf(startMarker);
  const end = pageSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Unable to isolate ${startMarker}.`);
  return pageSource.slice(start, end).trim();
};

const failures = [];
const checkMapping = (label, actual, expected) => {
  try {
    assert.deepEqual(actual, expected);
  } catch {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const coachSelectionSource = sliceBetween(
  'const coachPrimarySession',
  'const coachReadinessScore',
);
const selectCoachSessions = new Function(
  'coachSystem',
  `${coachSelectionSource}\nreturn { coachPrimarySession };`,
);
const coachSessions = [
  { key: 'today' },
  { key: 'quality' },
  { key: 'long-run' },
  { key: 'support' },
];
const selectedCoachSessions = selectCoachSessions({ sessions: coachSessions });

checkMapping(
  'Coach Insight plan order',
  {
    primary: selectedCoachSessions.coachPrimarySession?.key,
  },
  {
    primary: 'today',
  },
);

const coachBranch = sliceBetween(
  "insightKey === 'coach-insight' && coachSystem ? (",
  ") : insightKey === 'injury-risk' ? (",
);
const injuryBranch = sliceBetween(
  ") : insightKey === 'injury-risk' ? (",
  ") : insightKey === 'load-balance' && loadDashboard ? (",
);
const loadBranch = sliceBetween(
  ") : insightKey === 'load-balance' && loadDashboard ? (",
  ") : insightKey === 'intensity' && intensityDashboard ? (",
);
const requireSource = (condition, message) => {
  if (!condition) failures.push(message);
};

requireSource(
  /\{coachPrimarySession \? \([\s\S]*?coachPrimarySession\.slot[\s\S]*?coachPrimarySession\.title[\s\S]*?coachPrimarySession\.target[\s\S]*?coachPrimarySession\.why/.test(coachBranch),
  'Coach primary plan must render slot, title, target, and rationale',
);
requireSource(
  !/coachSecondarySessions\.map|analysis-coach-command-secondary-plan/.test(coachBranch),
  'Coach route should render only the primary today plan',
);

const requireAccessibleHistory = (branch, route, collection, valueMarkers) => {
  const historyMarker = `data-analysis-history="${route}"`;
  const markerIndex = branch.indexOf(historyMarker);
  if (markerIndex < 0) {
    failures.push(`${route} route must render a route-local accessible history structure`);
    return;
  }

  const historyStart = branch.lastIndexOf('<', markerIndex);
  const historySource = branch.slice(historyStart, markerIndex + 2200);
  requireSource(
    historySource.includes('className="sr-only analysis-profile-v2-history"'),
    `${route} accessible history must use the shared visually-hidden utility`,
  );
  requireSource(
    historySource.includes(`${collection}.map`),
    `${route} accessible history must render every mapped chart point`,
  );
  for (const valueMarker of valueMarkers) {
    requireSource(
      historySource.includes(valueMarker),
      `${route} accessible history must expose ${valueMarker}`,
    );
  }
};

requireAccessibleHistory(
  coachBranch,
  'coach',
  'coachLoadDashboard.chartWindow',
  ['entry.label', 'entry.acute', 'entry.chronic'],
);
requireAccessibleHistory(
  injuryBranch,
  'injury',
  'injuryTrend.points',
  ['point.label', 'point.title', 'point.loadScore', 'point.cadence'],
);
requireAccessibleHistory(
  loadBranch,
  'load',
  'loadDashboard.chartWindow',
  ['entry.label', 'entry.acute', 'entry.chronic'],
);

const loadModelSource = sliceBetween(
  'function buildLoadBalanceDashboardModel',
  'export default function AnalysisInsightDetail',
);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const resolveLoadTrendDirection = (currentValue, previousValue) => {
  const currentNumber = Number(currentValue);
  const previousNumber = Number(previousValue);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)) return 'flat';
  return currentNumber === previousNumber ? 'flat' : currentNumber > previousNumber ? 'up' : 'down';
};
const resolveLoadTrendIcon = (direction) => (
  direction === 'up' ? 'trending_up' : direction === 'down' ? 'trending_down' : 'horizontal_rule'
);
const buildLoadBalanceDashboardModel = new Function(
  'clamp',
  'resolveLoadTrendDirection',
  'resolveLoadTrendIcon',
  `return (${loadModelSource});`,
)(clamp, resolveLoadTrendDirection, resolveLoadTrendIcon);
const t = (key) => key;

for (const historyLength of [7, 13, 19, 24]) {
  const days = Array.from(
    { length: historyLength },
    (_, index) => new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  );
  const acuteSeries = Array.from({ length: historyLength }, (_, index) => 100 + index);
  const chronicSeries = Array.from({ length: historyLength }, (_, index) => 200 + index);
  const pointCount = Math.min(20, historyLength);
  const expectedStart = historyLength - pointCount;
  const snapshot = {
    trainingLoad: {
      days,
      acuteSeries,
      chronicSeries,
      lastAcwr: 1,
      lastAcute: acuteSeries.at(-1),
      lastChronic: chronicSeries.at(-1),
    },
    injury: { score: 12, level: 'low' },
    loadZone: { key: 'optimal' },
  };
  const model = buildLoadBalanceDashboardModel(snapshot, [], null, t, 'en');

  checkMapping(
    `Load Balance ${historyLength}-day chart tail`,
    model.chartWindow.map(({ day, acute, chronic }) => ({ day, acute, chronic })),
    Array.from({ length: pointCount }, (_, index) => ({
      day: days[expectedStart + index],
      acute: acuteSeries[expectedStart + index],
      chronic: chronicSeries[expectedStart + index],
    })),
  );
}

assert.equal(
  failures.length,
  0,
  `Analysis Insight data-preservation regressions:\n${failures.join('\n')}`,
);

console.log('[PASS] Analysis Insight preserves today\'s coach plan and aligns load-history tails.');
