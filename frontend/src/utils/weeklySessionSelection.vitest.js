import { expect, it } from 'vitest';
import { selectNextSessionForWeek } from './scheduleCoachSummary';

const schedule = [
  { scheduledDate: '2026-10-16', workoutType: 'REST' },
  { scheduledDate: '2026-10-17', workoutType: 'REST' },
  { scheduledDate: '2026-10-18', workoutType: 'REST' },
  { scheduledDate: '2026-10-20', workoutType: 'RECOVERY', plannedDistanceKm: 3.4 },
];
it('does not promote a run from next week when this week has no remaining runs', () => {
  expect(selectNextSessionForWeek(schedule, '2026-10-16', '2026-10-12')).toBeNull();
});
it('still finds next weeks own recommendation when that week is selected', () => {
  expect(selectNextSessionForWeek(schedule, '2026-10-16', '2026-10-19')).toEqual(schedule[3]);
});
