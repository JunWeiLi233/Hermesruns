import assert from 'node:assert/strict';
import { buildRunActivityCalendar } from './runActivityContribution.js';

const now = new Date(2025, 4, 15, 12, 0, 0);
const calendar = buildRunActivityCalendar([
  { id: 'one', startTime: '2025-05-12T07:00:00', distanceKm: 5.25 },
  { id: 'two', startDate: '2025-05-12T18:00:00', distanceMeters: 4250 },
  { id: 'future', startTime: '2025-05-16T07:00:00' },
  { id: 'invalid', startTime: 'not-a-date' },
], { now });

assert.equal(calendar.weeks.length, 53, 'The graph should cover a full 53-week activity window.');
assert.equal(calendar.weeks.every((week) => week.days.length === 7), true, 'Every week should have seven day cells.');
assert.equal(calendar.weeks[0].days[0].date.getDay(), 1, 'The graph should begin each week on Monday.');
assert.equal(calendar.weeks.at(-1).days.at(-1).date.getDay(), 0, 'The graph should end each week on Sunday.');

const mayTwelfth = calendar.weeks.flatMap((week) => week.days).find((day) => day.key === '2025-05-12');
assert.equal(mayTwelfth?.count, 2, 'Runs completed on the same date should be accumulated in one contribution cell.');
assert.equal(mayTwelfth?.level, 2, 'A 9.5 km day should receive the middle distance intensity level.');
assert.equal(mayTwelfth?.distanceKm, 9.5, 'Runs completed on the same date should expose their total distance in km.');

const distanceCalendar = buildRunActivityCalendar([
  { id: 'short', startTime: '2025-05-12T07:00:00', distanceKm: 4 },
  { id: 'medium', startTime: '2025-05-13T07:00:00', distanceKm: 8 },
  { id: 'long', startTime: '2025-05-14T07:00:00', distanceKm: 14 },
  { id: 'longest', startTime: '2025-05-15T07:00:00', distanceKm: 22 },
], { now });
const distanceLevels = distanceCalendar.weeks
  .flatMap((week) => week.days)
  .filter((day) => day.count > 0)
  .map((day) => day.level);
assert.deepEqual(distanceLevels, [1, 2, 3, 4], 'Longer daily distances should progress from lighter to darker green levels.');

const futureDay = calendar.weeks.flatMap((week) => week.days).find((day) => day.key === '2025-05-16');
assert.equal(futureDay?.count, 0, 'Future activities must not be rendered as completed run activity.');
assert.equal(calendar.totalRuns, 2, 'Only valid, completed run activities in the displayed window should be counted.');
assert.equal(calendar.monthLabels.some((label) => label), true, 'The graph should expose month labels for its columns.');

const muscleCalendar = buildRunActivityCalendar([
  { trainingDate: '2025-05-12', entryState: 'ACTUAL' },
  { trainingDate: '2025-05-14', entryState: 'ACTUAL' },
], {
  now,
  resolveDate: (checkIn) => new Date(`${checkIn.trainingDate}T12:00:00`),
  resolveDistanceKm: () => 1,
  resolveLevel: (distanceKm, count) => (count > 0 ? 4 : 0),
});
const mayFourteenth = muscleCalendar.weeks.flatMap((week) => week.days).find((day) => day.key === '2025-05-14');
assert.equal(mayFourteenth?.count, 1, 'Muscle check-ins should render on their persisted training date.');
assert.equal(mayFourteenth?.level, 4, 'Muscle check-ins should use the completed activity intensity.');
assert.equal(muscleCalendar.totalRuns, 2, 'The shared calendar should count muscle check-ins without reading run fields.');

console.log('[PASS] Run activity contribution calendar guardrails passed.');
