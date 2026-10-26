import { describe, expect, it } from 'vitest';
import { BEFORE_WINDOW_DAYS, RACE_TYPE, SHORTEST_RACE_KM, buildRaceEvidence } from './raceEvidence';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** The day of the main race, 8 in the morning. */
const T0 = Date.UTC(2026, 8, 20, 8, 0, 0);

const iso = (daysBefore, hours = 0) => new Date(T0 - daysBefore * DAY + hours * HOUR).toISOString();
const run = (id, daysBefore, km, minutes, extra = {}) => ({
  id, name: `Run ${id}`, startTime: iso(daysBefore, extra.hours ?? 0), distanceKm: km, movingTimeSeconds: Math.round(minutes * 60), ...extra,
});
const race = (id, daysBefore, km, minutes, extra = {}) => run(id, daysBefore, km, minutes, { runType: 'RACE', ...extra });

// Daniels and Gilbert's equations, written out again here so the module is checked against the formula and not against itself.
const cost = (velocity) => -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
const fraction = (minutes) => 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
const vdotOf = (meters, minutes) => cost(meters / minutes) / fraction(minutes);
const round1 = (value) => Math.round(value * 10) / 10;

describe('the rule', () => {
  it('looks at runs flagged Race, 90 days back, and rates a time from 1.5 km', () => {
    expect(RACE_TYPE).toBe('RACE');
    expect(BEFORE_WINDOW_DAYS).toBe(90);
    expect(SHORTEST_RACE_KM).toBe(1.5);
  });
});

describe('buildRaceEvidence', () => {
  it('has nothing without runs, or without a run flagged as a race', () => {
    for (const runs of [null, undefined, [], [run(1, 5, 5, 25)], [run(1, 5, 5, 25, { runType: 'LONG_RUN' })]]) {
      const evidence = buildRaceEvidence(runs);
      expect(evidence.rows).toEqual([]);
      expect(evidence.count).toBe(0);
      expect(evidence.meanGap).toBeNull();
    }
  });

  it('sets a race against the number that stood the day before it, worked out from the runs before it', () => {
    const evidence = buildRaceEvidence([
      race(1, 0, 10, 45),
      run(2, 5, 5, 25), run(3, 12, 5, 25), run(4, 20, 5, 25), run(5, 33, 5, 25),
    ]);
    const [row] = evidence.rows;

    expect(evidence.count).toBe(1);
    expect(row).toMatchObject({ id: 1, name: 'Run 1', distanceKm: 10, timeSeconds: 2700, tooShort: false });
    expect(row.vdot).toBe(round1(vdotOf(10000, 45)));
    expect(row.before).toBe(round1(vdotOf(5000, 25)));
    expect(row.gap).toBe(round1(row.vdot - row.before));
    expect(row.gap).toBeGreaterThan(0);                       // 4:30 per km against 5:00 runs: the race was the better one
    expect(row.date.getTime()).toBe(T0);
  });

  it('leaves out the race itself and every run after it', () => {
    const quickLater = run(9, -3, 5, 17);                       // three days after the race, much quicker
    const withLater = buildRaceEvidence([race(1, 0, 10, 45), run(2, 5, 5, 25), run(3, 12, 5, 25), quickLater]);
    const without = buildRaceEvidence([race(1, 0, 10, 45), run(2, 5, 5, 25), run(3, 12, 5, 25)]);

    expect(withLater.rows[0].before).toBe(without.rows[0].before);
    expect(withLater.rows[0].before).toBe(round1(vdotOf(5000, 25)));
    // The race is not in its own number: with nothing else to go on, there is no number before it.
    expect(buildRaceEvidence([race(1, 0, 10, 45)]).rows[0].before).toBeNull();
  });

  it('looks 90 days back and no further', () => {
    const inside = buildRaceEvidence([race(1, 0, 10, 45), run(2, 89, 5, 25)]);
    const outside = buildRaceEvidence([race(1, 0, 10, 45), run(2, 91, 5, 25)]);

    expect(inside.rows[0].before).toBe(round1(vdotOf(5000, 25)));
    expect(outside.rows[0].before).toBeNull();
    expect(outside.rows[0].gap).toBeNull();
    expect(outside.comparedCount).toBe(0);
    expect(outside.meanGap).toBeNull();
  });

  it('takes the best three runs of the window for the number, as the number itself does', () => {
    const evidence = buildRaceEvidence([
      race(1, 0, 10, 45),
      run(2, 5, 5, 24), run(3, 12, 5, 25), run(4, 20, 5, 26), run(5, 27, 5, 27),
    ]);

    // 5 km in 24, 25 and 26 minutes are the best three of four; the fourth, 27, is not in it.
    expect(evidence.rows[0].before).toBe(round1((vdotOf(5000, 24) + vdotOf(5000, 25) + vdotOf(5000, 26)) / 3));
  });

  it('uses the heart rate for the number before the race, as the runner was shown it', () => {
    const easy = (id, days) => run(id, days, 5, 25, { averageHeartRate: 150, maxHeartRate: 190 });
    const evidence = buildRaceEvidence([race(1, 0, 10, 45), easy(2, 4), easy(3, 11), easy(4, 18)]);
    const heartRateEstimate = cost(5000 / 25) / (150 / 190);

    expect(evidence.rows[0].before).toBe(round1(heartRateEstimate));
    // The race's own number is from its time alone, never from a heart rate it might have.
    const withHeartRate = buildRaceEvidence([race(1, 0, 10, 45, { averageHeartRate: 170, maxHeartRate: 190 }), easy(2, 4), easy(3, 11), easy(4, 18)]);
    expect(withHeartRate.rows[0].vdot).toBe(round1(vdotOf(10000, 45)));
  });

  it('rates only races of 1.5 km or more, and still lists the shorter ones without a number', () => {
    const evidence = buildRaceEvidence([race(1, 0, 1.2, 5), run(2, 5, 5, 25), run(3, 12, 5, 25), run(4, 20, 5, 25)]);
    const [row] = evidence.rows;

    expect(evidence.count).toBe(1);
    expect(row.tooShort).toBe(true);
    expect(row.vdot).toBeNull();
    expect(row.before).toBeNull();
    expect(row.gap).toBeNull();
    expect(evidence.comparedCount).toBe(0);
    expect(buildRaceEvidence([race(1, 0, 1.5, 6.5), run(2, 5, 5, 25)]).rows[0].tooShort).toBe(false);
  });

  it('lists the newest race first, with a number for each, and the mean of the differences as printed', () => {
    const easy = [run(10, 5, 5, 25), run(11, 12, 5, 25), run(12, 20, 5, 25), run(13, 33, 5, 25), run(14, 45, 5, 25), run(15, 52, 5, 25), run(16, 60, 5, 25), run(17, 70, 5, 25)];
    const evidence = buildRaceEvidence([race(2, 40, 5, 22), ...easy, race(1, 0, 10, 45)]);
    const [latest, earlier] = evidence.rows;

    expect(evidence.rows.map((row) => row.id)).toEqual([1, 2]);
    expect(latest.date.getTime()).toBeGreaterThan(earlier.date.getTime());
    // The 5 km race of 40 days earlier is one of the best three for the later race.
    expect(latest.before).toBe(round1((vdotOf(5000, 22) + 2 * vdotOf(5000, 25)) / 3));
    expect(earlier.before).toBe(round1(vdotOf(5000, 25)));
    expect(latest.gap).toBe(round1(round1(vdotOf(10000, 45)) - latest.before));
    expect(earlier.gap).toBe(round1(round1(vdotOf(5000, 22)) - earlier.before));
    expect(evidence.comparedCount).toBe(2);
    expect(evidence.meanGap).toBe(round1((latest.gap + earlier.gap) / 2));
  });

  it('counts the races that came out above, below and level with the number', () => {
    const easy = [run(10, 5, 5, 25), run(11, 12, 5, 25), run(12, 20, 5, 25)];
    // Against 5 km in 25:00 (a VO2max of about 38.3): 10 km in 45:00 is above, 10 km in 60:00 is below.
    const evidence = buildRaceEvidence([...easy, race(1, 0, 10, 45), race(2, 1, 10, 60), race(3, 2, 5, 25)]);

    expect(evidence.count).toBe(3);
    expect(evidence.above).toBe(1);
    expect(evidence.below).toBe(1);
    expect(evidence.level).toBe(1);
    expect(evidence.above + evidence.below + evidence.level).toBe(evidence.comparedCount);
  });

  it('lets a second race on the same day see the first, which is a run before it', () => {
    const base = [run(10, 5, 5, 25), run(11, 12, 5, 25), run(12, 20, 5, 25)];
    const evidence = buildRaceEvidence([...base, race(1, 0, 10, 40), race(2, 0, 5, 19, { hours: 7 })]);
    const [second, first] = evidence.rows;

    expect(second.id).toBe(2);
    expect(first.before).toBe(round1(vdotOf(5000, 25)));
    expect(second.before).toBe(round1((vdotOf(10000, 40) + 2 * vdotOf(5000, 25)) / 3));
  });

  it('is not fooled by flags in another case, runs with no usable day, time or distance, or things that are not runs', () => {
    const evidence = buildRaceEvidence([
      run(1, 5, 5, 25, { runType: 'race' }),
      race(2, 6, 5, 25, { startTime: 'never' }),
      race(3, 7, 5, 25, { startTime: null, startDate: null }),
      race(4, 8, 0, 25),
      race(5, 9, 5, 0),
      null,
      undefined,
      4,
      'a run',
      race(6, 10, 5, 25),
    ]);

    expect(evidence.rows.map((row) => row.id)).toEqual([6]);
  });

  it('is a pure function of its input', () => {
    const runs = [race(1, 0, 10, 45), run(2, 5, 5, 25), run(3, 12, 5, 25)];
    expect(buildRaceEvidence(runs)).toEqual(buildRaceEvidence(runs));
  });
});
