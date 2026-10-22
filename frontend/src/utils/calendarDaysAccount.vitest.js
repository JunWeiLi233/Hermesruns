import { describe, expect, it } from 'vitest';
import { runDayFraction, runDayKey, runnersToday } from './calendarDays';
import { prepareAnalysisRuns } from './analysisInsights';

describe('analysis on the account calendar', () => {
  it('places a UTC import on its account day, including the year boundary', () => {
    const run = { startTime: '2027-01-01T01:15:00', activityInstant: '2027-01-01T01:15:00Z',
      accountLocalDate: '2026-12-31', accountLocalTime: '20:15:00', accountTimeZone: 'America/New_York' };
    expect(runDayKey(run)).toBe('2026-12-31');
    expect(runDayFraction(run)).toBe(20.25 / 24);
  });

  it('uses the known account zone for today even when no run has happened today', () => {
    expect(runnersToday([{ accountTimeZone: 'Pacific/Kiritimati', startTime: '2026-09-01' }], new Date('2026-10-15T12:30:00Z')))
      .toBe('2026-10-16');
  });

  it('excludes a known future instant while retaining a legacy run already on tomorrow’s wall calendar', () => {
    const runs = [
      { id: 1, activityInstant: '2026-10-17T01:00:00Z', startTime: '2026-10-17T01:00:00' },
      { id: 2, startTime: '2026-10-16T00:10:00' },
    ];
    expect(prepareAnalysisRuns(runs, Date.parse('2026-10-15T23:30:00Z')).map(run => run.id)).toEqual([2]);
  });
});
