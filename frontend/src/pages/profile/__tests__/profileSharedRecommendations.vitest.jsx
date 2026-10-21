import { expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import { buildWeekBars, loadProfileDashboardFallbackEnrichmentData } from '../ProfileDashboard';
vi.mock('../../../api', () => ({ apiJson: vi.fn() }));

it('uses prescribed weekly bars instead of inventing a projection from earlier weeks', () => {
  const runs = [{ startTime:'2026-10-05T12:00:00Z', distanceKm:40 }];
  const coach = { today:{ scheduledDate:'2026-10-16', workoutType:'REST' },
    schedule:[{scheduledDate:'2026-10-17',workoutType:'RECOVERY',plannedDistanceKm:4.5}] };
  const bars = buildWeekBars(runs,'en','UTC','2026-10-16',coach);
  expect(bars[0].projected).toBe(0);
  expect(bars[0].projectedKnown).toBe(false);
  expect(bars[4].projected).toBe(0);
  expect(bars[4].projectedKnown).toBe(true);
  expect(bars[5].projected).toBe(4.5);
});
it('retains past targets while today and future days use the current prescription', () => {
  const coach = {
    today: { scheduledDate: '2026-10-16', workoutType: 'REST', reasonCode: 'run_completed' },
    schedule: [{ scheduledDate: '2026-10-17', workoutType: 'REST' }],
    weekSchedule: [
      { scheduledDate: '2026-10-12', workoutType: 'EASY', plannedDistanceKm: 6 },
      { scheduledDate: '2026-10-16', workoutType: 'EASY', plannedDistanceKm: 4.5 },
      { scheduledDate: '2026-10-17', workoutType: 'EASY', plannedDistanceKm: 10.4 },
    ],
  };
  const bars = buildWeekBars([], 'en', 'UTC', '2026-10-16', coach);
  expect(bars[0]).toMatchObject({ projected: 6, projectedKnown: true });
  expect(bars[4]).toMatchObject({ projected: 0, projectedKnown: true });
  expect(bars[5]).toMatchObject({ projected: 0, projectedKnown: true });
  expect(bars[1].projectedKnown).toBe(false);
});
it('uses a reduced future prescription instead of the original weekly target', () => {
  const bars = buildWeekBars([], 'en', 'UTC', '2026-10-16', {
    weekSchedule: [{ scheduledDate: '2026-10-17', workoutType: 'EASY', plannedDistanceKm: 10.4 }],
    schedule: [{ scheduledDate: '2026-10-17', workoutType: 'RECOVERY', plannedDistanceKm: 3.1, originalDistanceKm: 10.4 }],
  });
  expect(bars[5]).toMatchObject({ projected: 3.1, projectedKnown: true, originalProjected: 10.4, workoutType: 'RECOVERY' });
});
it('publishes the shared prescription before unrelated dashboard enrichments finish', async () => {
  const coach = {today:{scheduledDate:'2026-10-16',workoutType:'REST'},plan:{targetWeeklyKm:24.9}};
  apiJson.mockImplementation(url => url === '/api/coach/today' ? Promise.resolve(coach) : new Promise(() => {}));
  const publish = vi.fn();
  void loadProfileDashboardFallbackEnrichmentData(publish);
  await vi.waitFor(() => expect(publish).toHaveBeenCalledWith(coach));
});
