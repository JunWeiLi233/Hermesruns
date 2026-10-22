import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_RANGE, DEFAULT_SESSION_TYPES, SESSION_TYPES, buildQualitySessions } from './qualitySessions';

const TODAY = '2026-10-15';

describe('automatic detection', () => {
  const history = () => [1, 2, 3, 4, 5].map(id => run(id, `2026-10-0${id}`, 8, 8 * 360));

  it('excludes explicitly identified demo activities from sessions, totals and the pace baseline', () => {
    const demos = history().map(row => ({ ...row, stravaId: `local-shared-140971747-${row.id}` }));
    const real = run(10, '2026-10-10', 8, 2400);
    const namedDemo = run(11, '2026-10-11', 16, 5400, { name: 'Tempo', sourceFileName: 'local-shared-runner-bootstrap' });
    const model = buildQualitySessions([...demos, namedDemo, real], { types: ['workout', 'race', 'long'], today: TODAY });
    expect(model.count).toBe(0);
    expect(model.otherCount).toBe(1);
    expect(model.otherMedianPace).toBe(300);
    expect(buildQualitySessions([{ ...namedDemo, sourceFileName: 'my-strava-export.fit' }], { today: TODAY }).count).toBe(1);
  });

  it('finds a faster unlabelled session against earlier comparable runs without changing stored labels', () => {
    const workout = run(10, '2026-10-10', 8, 8 * 300);
    const model = buildQualitySessions([...history(), workout], { today: TODAY });
    expect(model.sessions).toHaveLength(1);
    expect(model.sessions[0]).toMatchObject({ id: 10, runType: 'WORKOUT', autoReason: 'pace' });
    expect(workout.runType).toBeUndefined();
  });

  it('recognizes interval and tempo names in English and Chinese without needing prior labels', () => {
    const model = buildQualitySessions([
      run(1, '2026-10-10', 8, 3000, { name: '6 × 800 m' }),
      run(2, '2026-10-09', 8, 3000, { name: 'Tempo run' }),
      run(3, '2026-10-08', 8, 3000, { name: '周三间歇训练' }),
    ], { today: TODAY });
    expect(model.sessions.map(row => [row.id, row.runType, row.autoReason])).toEqual([
      [1, 'WORKOUT', 'name'], [2, 'WORKOUT', 'name'], [3, 'WORKOUT', 'name'],
    ]);
  });

  it('detects long runs when selected, including without a pace history', () => {
    const model = buildQualitySessions([
      run(1, '2026-10-10', 16, 4800),
      run(2, '2026-10-09', 12, 5400),
    ], { types: ['long'], today: TODAY });
    expect(model.sessions.map(row => [row.id, row.runType])).toEqual([[1, 'LONG_RUN'], [2, 'LONG_RUN']]);
    expect(buildQualitySessions([run(1, '2026-10-10', 16, 6000)], { today: TODAY }).count).toBe(0);
  });

  it('keeps manual types ahead of automatic evidence and does not guess a race from pace', () => {
    const model = buildQualitySessions([...history(),
      run(10, '2026-10-10', 8, 2400, { name: 'Intervals', runType: 'LONG_RUN' }),
      run(11, '2026-10-11', 8, 2300),
    ], { types: ['race'], today: TODAY });
    expect(model.count).toBe(0);
    const selected = buildQualitySessions([run(1, '2026-10-10', 8, 2400, { name: 'Intervals', runType: 'RACE' })], { today: TODAY });
    expect(selected.sessions[0].runType).toBe('RACE');
    expect(selected.sessions[0].autoReason).toBeUndefined();
  });

  it('requires meaningful pace improvement and enough history, rather than selecting the fastest fraction of every list', () => {
    expect(buildQualitySessions([...history(), run(10, '2026-10-10', 8, 8 * 350)], { today: TODAY }).count).toBe(0);
    expect(buildQualitySessions([run(10, '2026-10-10', 8, 2400)], { today: TODAY }).count).toBe(0);
    expect(buildQualitySessions([...history(), run(10, '2026-10-10', 1, 200)], { today: TODAY }).count).toBe(0);
  });

  it('does not use later runs or remote historical runs to label an earlier session', () => {
    expect(buildQualitySessions([run(1, '2026-10-01', 8, 2400), ...history().map(row => ({ ...row, startTime: '2026-10-12T07:00:00' }))], { today: TODAY }).count).toBe(0);
    expect(buildQualitySessions([...history().map(row => ({ ...row, startTime: '2026-01-01T07:00:00' })), run(10, '2026-10-10', 8, 2400)], { today: TODAY }).count).toBe(0);
  });

  it('does not turn race-pace training or a race warmup into a race', () => {
    const model = buildQualitySessions([
      run(1, '2026-10-10', 8, 2400, { name: 'Race pace intervals' }),
      run(2, '2026-10-09', 3, 1200, { name: 'Race warm-up' }),
      run(3, '2026-10-08', 5, 1500, { name: 'Saturday race' }),
    ], { types: ['race'], today: TODAY });
    expect(model.sessions.map(row => row.id)).toEqual([3]);
  });

  it('ignores non-finite numbers and leaves clearly named easy runs out of pace detection', () => {
    const model = buildQualitySessions([...history(),
      run(10, '2026-10-10', 8, 2400, { name: 'Easy run' }),
      run(11, '2026-10-11', Infinity, 2400, { name: 'Intervals' }),
      run(12, '2026-10-12', 8, Infinity, { name: 'Tempo' }),
    ], { types: ['workout', 'race', 'long'], today: TODAY });
    expect(model.count).toBe(0);
  });
});

function run(id, day, km, seconds, extra = {}) {
  return { id, name: `Run ${id}`, startTime: `${day}T07:00:00`, distanceKm: km, movingTimeSeconds: seconds, ...extra };
}

/**
 * The 3 months to 15 October start on 15 July and are 93 days (13.29 weeks). In them:
 *   three sessions of the default types: a workout of 8 km at 290 s/km (10 October), a workout of 6 km at 300 (20 September), a race of 10 km at 295 (30 August);
 *   a long run of 20 km at 310 (1 September), which counts only when the long runs are ticked;
 *   five ordinary runs of 5 km at 330 s/km;
 * and in the 3 months before (15 April to 14 July): a workout of 7 km on 1 June and an ordinary run on 10 May.
 */
function season() {
  return [
    run(1, '2026-10-10', 8, 8 * 290, { runType: 'WORKOUT', averageHeartRate: 165, maxHeartRate: 178 }),
    run(2, '2026-09-20', 6, 6 * 300, { runType: 'WORKOUT', averageHeartRate: 160, maxHeartRate: 175 }),
    run(3, '2026-08-30', 10, 10 * 295, { runType: 'RACE', averageHeartRate: 172, maxHeartRate: 186 }),
    run(4, '2026-09-01', 20, 20 * 310, { runType: 'LONG_RUN', averageHeartRate: 150, maxHeartRate: 165 }),
    ...['2026-10-12', '2026-10-02', '2026-09-10', '2026-08-15', '2026-07-25'].map((day, index) => run(10 + index, day, 5, 5 * 330, { averageHeartRate: 140 })),
    run(20, '2026-06-01', 7, 7 * 300, { runType: 'WORKOUT' }),
    run(21, '2026-05-10', 5, 5 * 330),
  ];
}

describe('what counts as a quality session', () => {
  it('has the workouts and the races ticked to begin with, the long runs as a third type, and 3 months as the period', () => {
    expect(SESSION_TYPES).toEqual(['workout', 'race', 'long']);
    expect(DEFAULT_SESSION_TYPES).toEqual(['workout', 'race']);
    expect(DEFAULT_SESSION_RANGE).toBe('3m');
  });

  it('is a run of one of the types ticked, newest first, with its numbers; a long run is not one until the long runs are ticked', () => {
    const found = buildQualitySessions(season(), { today: TODAY });
    expect(found.sessions.map((session) => session.id)).toEqual([1, 2, 3]);
    expect(found.sessions[0]).toEqual({
      key: 'run-1', id: 1, name: 'Run 1', runType: 'WORKOUT', day: '2026-10-10', km: 8, seconds: 2320, pace: 290, averageHeartRate: 165, maxHeartRate: 178,
    });
    expect(found.count).toBe(3);

    const withLong = buildQualitySessions(season(), { types: ['workout', 'race', 'long'], today: TODAY });
    expect(withLong.sessions.map((session) => session.id)).toEqual([1, 2, 4, 3]);
    expect(withLong.count).toBe(4);
    const raceOnly = buildQualitySessions(season(), { types: ['race'], today: TODAY });
    expect(raceOnly.sessions.map((session) => session.id)).toEqual([3]);
  });

  it('puts two sessions of one day in the order of their start, the later first, and two that began together with the higher id first', () => {
    const found = buildQualitySessions([
      run(1, '2026-10-10', 8, 2400, { runType: 'WORKOUT', startTime: '2026-10-10T06:00:00' }),
      run(2, '2026-10-10', 8, 2400, { runType: 'WORKOUT', startTime: '2026-10-10T18:00:00' }),
      run(3, '2026-10-10', 8, 2400, { runType: 'WORKOUT', startTime: '2026-10-10T12:00:00' }),
      run(4, '2026-10-10', 8, 2400, { runType: 'RACE', startTime: '2026-10-10T12:00:00' }),
    ], { today: TODAY });
    expect(found.sessions.map((session) => session.id)).toEqual([2, 4, 3, 1]);
  });

  it('is nothing when no type is ticked, and ignores a type it does not know', () => {
    expect(buildQualitySessions(season(), { types: [], today: TODAY }).count).toBe(0);
    expect(buildQualitySessions(season(), { types: ['sprint'], today: TODAY }).count).toBe(0);
    expect(buildQualitySessions(season(), { types: ['race', 'sprint'], today: TODAY }).kinds).toEqual(['race']);
  });
});

describe('the readings of a period', () => {
  it('counts the sessions and their distance, their share of all the distance run, and how many a week', () => {
    const found = buildQualitySessions(season(), { today: TODAY });
    expect(found.from).toBe('2026-07-15');
    expect(found.km).toBe(24);
    // 24 km of sessions out of 24 + 20 (the long run) + 25 (five ordinary runs) = 69 km.
    expect(found.share).toBeCloseTo(24 / 69, 10);
    expect(found.perWeek).toBeCloseTo(3 / (93 / 7), 10);
    const withLong = buildQualitySessions(season(), { types: ['workout', 'race', 'long'], today: TODAY });
    expect(withLong.km).toBe(44);
    expect(withLong.share).toBeCloseTo(44 / 69, 10);
  });

  it('gives the middle pace of the sessions and of the other runs, as they are in the period', () => {
    const found = buildQualitySessions(season(), { today: TODAY });
    expect(found.medianPace).toBe(295);
    // The other runs: the long run at 310 and five at 330, which is 330.
    expect(found.otherMedianPace).toBe(330);
    expect(found.otherCount).toBe(6);
    const withLong = buildQualitySessions(season(), { types: ['workout', 'race', 'long'], today: TODAY });
    expect(withLong.medianPace).toBe(297.5);
    expect(withLong.otherCount).toBe(5);
    expect(withLong.otherMedianPace).toBe(330);
  });

  it('says there is nothing to give the middle pace of when there is no session, or no other run', () => {
    const none = buildQualitySessions(season(), { types: [], today: TODAY });
    expect(none.medianPace).toBeNull();
    expect(none.share).toBe(0);
    expect(none.otherCount).toBe(9);
    const onlySessions = buildQualitySessions(season().filter((r) => r.runType === 'WORKOUT'), { today: TODAY });
    expect(onlySessions.otherMedianPace).toBeNull();
    expect(onlySessions.otherCount).toBe(0);
    expect(buildQualitySessions([], { today: TODAY })).toMatchObject({ count: 0, km: 0, share: null, medianPace: null, otherMedianPace: null });
  });

  it('puts the heart rate of a session in only when it is one a heart has', () => {
    const found = buildQualitySessions([
      run(1, '2026-10-10', 8, 2400, { runType: 'WORKOUT', averageHeartRate: 0, maxHeartRate: 260 }),
      run(2, '2026-10-09', 8, 2400, { runType: 'WORKOUT', averageHeartRate: null, maxHeartRate: 41 }),
      run(3, '2026-10-08', 8, 2400, { runType: 'WORKOUT', averageHeartRate: 'fast', maxHeartRate: 249 }),
    ], { today: TODAY });
    expect(found.sessions.map((session) => [session.averageHeartRate, session.maxHeartRate])).toEqual([[null, null], [null, 41], [null, 249]]);
  });
});

describe('the stretch before', () => {
  it('counts the sessions of the stretch of the same length before the period, and gives the change', () => {
    const found = buildQualitySessions(season(), { today: TODAY });
    expect(found.comparison).toEqual({ from: '2026-04-15', to: '2026-07-14', runs: 2, sessions: 1, ok: true, change: 2 });
    const fewer = buildQualitySessions(season(), { types: ['race'], today: TODAY });
    expect(fewer.comparison).toMatchObject({ sessions: 0, ok: true, change: 1 });
  });

  it('has nothing to compare with when the runner did not run at all in that stretch, which is not the same as no sessions', () => {
    const found = buildQualitySessions(season().filter((r) => r.id < 20), { today: TODAY });
    expect(found.comparison).toEqual({ from: '2026-04-15', to: '2026-07-14', runs: 0, sessions: 0, ok: false, change: null });
  });

  it('has no stretch before for all time, which starts at the first run, and counts the sessions of the whole history', () => {
    const found = buildQualitySessions(season(), { range: 'all', today: TODAY });
    expect(found.comparison).toBeNull();
    expect(found.from).toBe('2026-05-10');
    expect(found.count).toBe(4);
    expect(found.sessions[3].id).toBe(20);
    // From 10 May to 15 October is 159 days.
    expect(found.perWeek).toBeCloseTo(4 / (159 / 7), 10);
  });

  it('follows the period asked for', () => {
    expect(buildQualitySessions(season(), { range: '6m', today: TODAY }).count).toBe(4);
    expect(buildQualitySessions(season(), { range: '6m', today: TODAY }).comparison.runs).toBe(0);
    expect(buildQualitySessions(season(), { range: '1y', today: TODAY }).from).toBe('2025-10-15');
  });
});

describe('what is left out', () => {
  it('leaves out a run after the runner\'s today, one with no date, no distance or no time', () => {
    const found = buildQualitySessions([
      run(1, '2026-10-16', 8, 2400, { runType: 'WORKOUT' }),
      { id: 2, runType: 'WORKOUT', distanceKm: 8, movingTimeSeconds: 2400 },
      run(3, '2026-10-10', 0, 2400, { runType: 'WORKOUT' }),
      run(4, '2026-10-09', 8, 0, { runType: 'WORKOUT' }),
      run(5, '2026-10-08', 8, 2400, { runType: 'WORKOUT' }),
    ], { today: TODAY });
    expect(found.sessions.map((session) => session.id)).toEqual([5]);
  });

  it('does not stumble over a list that is not a list', () => {
    for (const input of [null, undefined, 'runs', [null, 3]]) {
      expect(buildQualitySessions(input, { today: TODAY })).toMatchObject({ count: 0, sessions: [] });
    }
  });

  describe('the runner\'s today', () => {
    afterEach(() => vi.useRealTimers());

    it('is the device\'s date or the date of a run a day or two ahead of it, as everywhere else', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 15, 9, 0, 0));
      const found = buildQualitySessions([run(1, '2026-10-17', 8, 2400, { runType: 'WORKOUT' })]);
      expect(found.today).toBe('2026-10-17');
      expect(found.count).toBe(1);
    });
  });
});
