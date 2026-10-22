import { describe, expect, it } from 'vitest';
import {
  RACE_PRESETS,
  STALE_RACE_DAYS,
  customDistanceMeters,
  distanceInUnit,
  formatRaceTime,
  isRealDay,
  parseRaceTime,
  presetFor,
  raceAgeDays,
  raceProblems,
  raceVdot,
} from './paceZoneRace';

const LIMITS = {
  minDistanceMeters: 1500,
  maxDistanceMeters: 100000,
  minSeconds: 240,
  maxSeconds: 86400,
  minPaceSecondsPerKm: 120,
  maxPaceSecondsPerKm: 1200,
  maxAgeDays: 1825,
};

describe('presets', () => {
  it('are the four standard distances, in metres', () => {
    expect(RACE_PRESETS.map((preset) => [preset.key, preset.meters])).toEqual([
      ['5k', 5000], ['10k', 10000], ['half', 21097.5], ['marathon', 42195],
    ]);
  });

  it('recognises a distance to the metre, and nothing else', () => {
    expect(presetFor(21097.5).key).toBe('half');
    expect(presetFor(21097).key).toBe('half');
    expect(presetFor(10000.4).key).toBe('10k');
    expect(presetFor(10002)).toBeNull();
    expect(presetFor(12500)).toBeNull();
    expect(presetFor(null)).toBeNull();
    expect(presetFor('nope')).toBeNull();
  });
});

describe('parseRaceTime', () => {
  it.each([
    ['45:00', 2700],
    ['5:07', 307],
    ['05:07', 307],
    ['1:45:30', 6330],
    ['01:45:30', 6330],
    ['  45:00  ', 2700],
    ['0:04:00', 240],
    ['12:00:00', 43200],
  ])('reads %s as %i seconds', (text, seconds) => {
    expect(parseRaceTime(text)).toBe(seconds);
  });

  it.each([
    [''], ['45'], ['4500'], ['45:0'], ['45:60'], ['1:60:00'], ['1:75:00'], ['-5:00'], ['4:5:00:00'], ['45:00.5'], ['45m'], ['00:00'], ['abc'],
    [null], [undefined], [2700],
  ])('does not guess at %j', (text) => {
    expect(parseRaceTime(text)).toBeNull();
  });
});

describe('formatRaceTime', () => {
  it('writes a time the way the rest of the app writes a duration', () => {
    expect(formatRaceTime(2700)).toBe('45:00');
    expect(formatRaceTime(307)).toBe('5:07');
    expect(formatRaceTime(6330)).toBe('1:45:30');
    expect(formatRaceTime(3599.6)).toBe('1:00:00');
  });

  it('is read back as the same seconds', () => {
    for (const seconds of [240, 307, 2700, 3599, 3600, 6330, 43200, 86399]) {
      expect(parseRaceTime(formatRaceTime(seconds))).toBe(seconds);
    }
  });
});

describe('customDistanceMeters', () => {
  it('turns a distance in the runner\'s unit into metres', () => {
    expect(customDistanceMeters('12.5', 'km')).toBe(12500);
    expect(customDistanceMeters('12,5', 'km')).toBe(12500);
    expect(customDistanceMeters(' 8 ', 'km')).toBe(8000);
    expect(customDistanceMeters('8', 'mile')).toBe(12874.8);
    expect(customDistanceMeters('13.1', 'mile')).toBe(21082.4);
    expect(customDistanceMeters('12.5')).toBe(12500);
  });

  it.each([[''], ['abc'], ['0'], ['-3'], ['1e999'], ['12.5.1'], [null], [undefined]])('gives nothing for %j', (text) => {
    expect(customDistanceMeters(text, 'km')).toBeNull();
  });
});

describe('distanceInUnit', () => {
  it('writes metres in the runner\'s unit with at most two decimals and no trailing zeros', () => {
    expect(distanceInUnit(12500, 'km')).toBe(12.5);
    expect(distanceInUnit(10000)).toBe(10);
    expect(distanceInUnit(21097.5, 'km')).toBe(21.1);
    expect(distanceInUnit(12874.8, 'mile')).toBe(8);
    expect(distanceInUnit(21082.4, 'mile')).toBe(13.1);
  });

  it('is read back as the same distance', () => {
    for (const unit of ['km', 'mile']) {
      for (const text of ['12.5', '8', '3.1', '13.1']) {
        const meters = customDistanceMeters(text, unit);
        expect(customDistanceMeters(String(distanceInUnit(meters, unit)), unit)).toBe(meters);
      }
    }
  });
});

describe('raceVdot', () => {
  it('is the fitness the race stands for, to one decimal', () => {
    expect(raceVdot({ distanceMeters: 5000, seconds: 1200 })).toBe(49.8);
    expect(raceVdot({ distanceMeters: 10000, seconds: 2700 })).toBe(45.3);
    expect(raceVdot({ distanceMeters: 21097.5, seconds: 6330 })).toBe(42.4);
    expect(raceVdot({ distanceMeters: 42195, seconds: 12600 })).toBe(44.6);
    expect(raceVdot({ distanceMeters: 12500, seconds: 3550 })).toBe(43.4);
  });

  it('is higher for a faster time over the same distance', () => {
    expect(raceVdot({ distanceMeters: 10000, seconds: 2400 })).toBeGreaterThan(raceVdot({ distanceMeters: 10000, seconds: 2700 }));
  });

  it('is nothing for a race that gives no fitness', () => {
    expect(raceVdot(null)).toBeNull();
    expect(raceVdot(undefined)).toBeNull();
    expect(raceVdot({})).toBeNull();
    expect(raceVdot({ distanceMeters: 0, seconds: 2700 })).toBeNull();
    expect(raceVdot({ distanceMeters: 10000, seconds: 0 })).toBeNull();
    expect(raceVdot({ distanceMeters: -10000, seconds: 2700 })).toBeNull();
    expect(raceVdot({ distanceMeters: 'far', seconds: 'long' })).toBeNull();
  });
});

describe('raceAgeDays', () => {
  it('counts the days between the race and today', () => {
    expect(raceAgeDays('2026-09-20', '2026-10-10')).toBe(20);
    expect(raceAgeDays('2026-10-10', '2026-10-10')).toBe(0);
    expect(raceAgeDays('2025-10-10', '2026-10-10')).toBe(365);
  });

  it('is not thrown by a daylight-saving change or a leap day', () => {
    expect(raceAgeDays('2026-03-07', '2026-03-09')).toBe(2);
    expect(raceAgeDays('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('is nothing for a date that is not one', () => {
    expect(raceAgeDays('soon', '2026-10-10')).toBeNull();
    expect(raceAgeDays('2026-09-20', '')).toBeNull();
    expect(raceAgeDays(undefined, undefined)).toBeNull();
  });

  it('says a race has gone stale after about six months', () => {
    expect(STALE_RACE_DAYS).toBe(183);
  });
});

describe('isRealDay', () => {
  it.each([['2026-10-10'], ['2024-02-29'], ['2026-12-31'], ['2000-01-01']])('accepts %s', (text) => {
    expect(isRealDay(text)).toBe(true);
  });

  it.each([['2026-02-30'], ['2026-02-29'], ['2026-13-01'], ['2026-00-10'], ['2026-04-31'], ['2026-10-1'], ['26-10-10'], ['10/10/2026'], [''], [null], [undefined]])(
    'refuses %j',
    (text) => {
      expect(isRealDay(text)).toBe(false);
    },
  );
});

describe('raceProblems', () => {
  const today = '2026-10-10';
  const fine = { meters: 10000, seconds: 2700, date: '2026-09-20' };
  const keys = (typed, limits = LIMITS) => raceProblems(typed, limits, today).map((problem) => `${problem.field}:${problem.key}`);

  it('finds nothing wrong with a race that can be saved', () => {
    expect(keys(fine)).toEqual([]);
    expect(keys({ ...fine, date: today })).toEqual([]);
  });

  it('accepts the edges of every limit', () => {
    expect(keys({ meters: 1500, seconds: 240, date: today })).toEqual([]); // 2:40 a kilometre
    expect(keys({ meters: 100000, seconds: 86400, date: today })).toEqual([]); // 14:24 a kilometre
    expect(keys({ meters: 5000, seconds: 600, date: today })).toEqual([]); // exactly 2:00 a kilometre
    expect(keys({ meters: 5000, seconds: 6000, date: today })).toEqual([]); // exactly 20:00 a kilometre
    expect(keys({ ...fine, date: '2021-10-11' })).toEqual([]); // 1825 days back
  });

  it('says a distance that is missing or out of range', () => {
    expect(keys({ ...fine, meters: null })).toEqual(['distance:distance']);
    expect(keys({ ...fine, meters: 1499 })).toEqual(['distance:distance_range']);
    expect(keys({ ...fine, meters: 100001 })).toEqual(['distance:distance_range']);
  });

  it('says a time that is missing or out of range', () => {
    expect(keys({ ...fine, seconds: null })).toEqual(['time:time']);
    expect(keys({ ...fine, seconds: 239 })).toEqual(['time:time_range']);
    expect(keys({ ...fine, seconds: 86401 })).toEqual(['time:time_range']);
  });

  it('says a time that no runner could hold over that distance, and only when both are otherwise fine', () => {
    expect(keys({ meters: 10000, seconds: 1100, date: today })).toEqual(['time:pace']); // 1:50 a kilometre
    expect(keys({ meters: 5000, seconds: 6001, date: today })).toEqual(['time:pace']); // just over 20:00 a kilometre
    expect(keys({ meters: 100000, seconds: 240, date: today })).toEqual(['time:pace']); // a pace of 2.4 seconds a kilometre
    expect(keys({ meters: 10000, seconds: 100, date: today })).toEqual(['time:time_range']); // out of range already: no pace to judge
    expect(keys({ meters: null, seconds: 1100, date: today })).toEqual(['distance:distance']);
    expect(keys({ meters: 10000, seconds: null, date: today })).toEqual(['time:time']);
  });

  it('says a date that is missing, not a day, in the future or too long ago', () => {
    expect(keys({ ...fine, date: '' })).toEqual(['date:date']);
    expect(keys({ ...fine, date: '2026-02-30' })).toEqual(['date:date']);
    expect(keys({ ...fine, date: '2026-10-11' })).toEqual(['date:date_future']);
    expect(keys({ ...fine, date: '2021-10-10' })).toEqual(['date:date_old']);
  });

  it('says everything wrong at once, each under the field it belongs to', () => {
    expect(keys({ meters: null, seconds: 10, date: '' })).toEqual(['distance:distance', 'time:time_range', 'date:date']);
  });

  it('uses the limits the server sent, not numbers of its own', () => {
    const tight = { ...LIMITS, minDistanceMeters: 5000, maxAgeDays: 30 };
    expect(keys({ ...fine, meters: 3000 }, tight)).toEqual(['distance:distance_range']);
    expect(keys({ ...fine, date: '2026-08-01' }, tight)).toEqual(['date:date_old']);
  });
});
