import assert from 'node:assert/strict';
import { buildLoadBalanceBudget, getLoadBalanceWeekStats, getLoadBalanceRecentRuns, getLoadBalanceHeadroom, getLoadBalanceZoneKey, getLoadContribution } from '../loadBalancePresentation.js';

assert.deepEqual(getLoadBalanceHeadroom({ acute: 110, chronic: 100 }), { value: 140, percent: 40 });
assert.deepEqual(getLoadBalanceHeadroom({ acute: 140, chronic: 100 }), { value: 0, percent: 0 });
assert.deepEqual(getLoadBalanceHeadroom({ acute: 30, chronic: 100 }), { value: 700, percent: 100 });
for (const entry of [null, {}, { acute: 0, chronic: 0 }, { acute: 1 }, { acute: null, chronic: 10 }, { acute: Infinity, chronic: 10 }, { acute: 10, chronic: NaN }, { acute: -1, chronic: 10 }]) {
  assert.equal(getLoadBalanceHeadroom(entry), null, 'Missing or invalid baseline data must not imply available load.');
}
assert.equal(getLoadContribution(25, 100), 25);
assert.equal(getLoadContribution(100, 100), 100);
assert.equal(getLoadContribution(null, 100), 0);
assert.equal(getLoadContribution(Infinity, 100), 0);
assert.equal(getLoadContribution(20, 0), 0);
assert.equal(getLoadContribution(-20, 100), 0);
for (const [key, expected] of [['under', 'low'], ['warning', 'moderate'], ['danger', 'high'], ['optimal', 'optimal'], ['unknown', 'unknown'], [null, 'unknown']]) {
  assert.equal(getLoadBalanceZoneKey(key), expected);
}
console.log('[PASS] Load balance headroom and run contribution calculations.');

const trainingLoad = { days: ['2026-10-07'], lastAcute: 89, lastChronic: 82, lastAcwr: 1.08, dailyLoads: [0, 100, 50, 0, 150, 75, 0], chronicSeries: [75, 76, 77, 78, 79, 80, 81, 82] };
const budget = buildLoadBalanceBudget(trainingLoad);
assert.equal(budget.length, 7);
assert.equal(budget[0].date, '2026-10-08');
assert.equal(budget.at(-1).date, '2026-10-14');
budget.forEach((day, index) => {
  const acute = 89 * 0.75 ** (index + 1);
  const chronic = 82 * (27 / 29) ** (index + 1);
  assert.ok((acute + 0.25 * day.value) / (chronic + (2 / 29) * day.value) <= 1.3);
  assert.ok((acute + 0.25 * (day.value + 1)) / (chronic + (2 / 29) * (day.value + 1)) > 1.3);
});
assert.ok(buildLoadBalanceBudget({ ...trainingLoad, lastAcute: 500 }).some((day) => day.value === 0));
for (const invalid of [null, {}, { ...trainingLoad, lastChronic: 0 }, { ...trainingLoad, lastAcwr: null }, { ...trainingLoad, days: ['2026-02-30'] }]) assert.deepEqual(buildLoadBalanceBudget(invalid), []);

const run = (date, distanceKm, movingTimeSeconds = 1800) => ({ startTime: `${date}T12:00:00Z`, distanceKm, movingTimeSeconds });
const stats = getLoadBalanceWeekStats(trainingLoad, [run('2026-09-30', 20), run('2026-10-01', 8), run('2026-10-07', 12), run('2026-10-08', 99), run('2026-10-06', 99, 0)]);
assert.equal(stats.volumeKm, 20, 'The volume must include the current seven days and exclude future or invalid sessions.');
assert.equal(stats.volumeDelta, 0);
assert.equal(stats.baseDelta, 9);
assert.equal(stats.chronicTrend, 'rising');
assert.ok(stats.monotony > 0.9 && stats.monotony < 1.1);
assert.equal(getLoadBalanceWeekStats({ ...trainingLoad, dailyLoads: Array(7).fill(10) }, []).monotony, Infinity);
assert.equal(getLoadBalanceWeekStats({ ...trainingLoad, dailyLoads: Array(7).fill(0) }, []).monotony, null);
assert.equal(getLoadBalanceWeekStats(null, []).volumeKm, null);
assert.deepEqual(getLoadBalanceRecentRuns([
  { trainingDate: '2026-09-30', loadScore: 999 }, { trainingDate: '2026-10-01', loadScore: 40 },
  { trainingDate: '2026-10-07', loadScore: 100 }, { trainingDate: '2026-10-08', loadScore: 999 },
], '2026-10-07').map((row) => row.loadScore), [100, 40]);
console.log('[PASS] Seven independent EWMA load budgets, weekly volume, monotony, and current-week contributors.');
