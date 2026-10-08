import assert from 'node:assert/strict';
import { buildStrengthWeekCoverage, summarizeStrengthActivity } from '../strengthWeek.js';

const actual = (trainingDate) => ({ trainingDate, entryState: 'ACTUAL' });
const summary = summarizeStrengthActivity([
  actual('2026-09-23'), actual('2026-09-29'), actual('2026-10-06'), actual('2026-10-06'),
  actual('2026-10-08'), actual('2026-02-30'), { trainingDate: '2026-10-07', entryState: 'PLANNED' },
], '2026-10-07');
assert.equal(summary.streakWeeks, 3);
assert.equal(summary.completedThisWeek, 1);
assert.equal(summary.completedDates.size, 3);
assert.equal(summarizeStrengthActivity([actual('2026-09-29')], '2026-10-07').streakWeeks, 1);
assert.equal(summarizeStrengthActivity([actual('2026-09-23')], '2026-10-07').streakWeeks, 0);
assert.equal(summarizeStrengthActivity([], '2026-10-07').completedThisWeek, 0);

const item = (name, muscles) => ({ exercise: { name, muscles } });
const coverage = buildStrengthWeekCoverage([
  { items: [item('Split squat', ['Legs', 'Glutes']), item('Single-leg deadlift', ['Hamstrings', 'Glutes'])] },
  { items: [item('Standing calf raise', ['Calves']), item('Dead bug', ['Core'])] },
  { items: [item('Push-up', ['Chest', 'Arms']), item('Side plank', ['Core'])] },
], (entry) => entry.exercise.muscles);
assert.deepEqual(coverage.map(({ key, sessions }) => [key, sessions]), [
  ['legs', 1], ['hips', 1], ['calves', 1], ['core', 2], ['upper', 1],
]);
assert.ok(buildStrengthWeekCoverage([], () => []).every((area) => area.sessions === 0));
console.log('[PASS] Strength week coverage and persisted activity summary passed.');
