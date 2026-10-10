import { describe, expect, it } from 'vitest';
import {
  PAGE_WEEKS,
  clockText,
  dayBefore,
  dayOfMonth,
  formatDayHeading,
  formatWeekRange,
  formatWeekday,
  isCurrentWeek,
  listWeeks,
  logUrl,
  longestDayKm,
  mergeWeeks,
  nextPageTo,
  paceText,
  readFilters,
  weekStrip,
  weekTimeParts,
  writeFilters,
} from './trainingLog';

const params = (query) => new URLSearchParams(query);

describe('the filters in the address', () => {
  it('reads a run type and tags', () => {
    expect(readFilters(params('runType=RACE&tag=hills&tag=Track'))).toEqual({ runType: 'RACE', tags: ['hills', 'Track'] });
    expect(readFilters(params(''))).toEqual({ runType: '', tags: [] });
  });

  it('ignores a run type that is not one of the three, whatever the case', () => {
    expect(readFilters(params('runType=ULTRA')).runType).toBe('');
    expect(readFilters(params('runType=race')).runType).toBe('');
    expect(readFilters(params('runType=LONG_RUN')).runType).toBe('LONG_RUN');
    expect(readFilters(params('runType=')).runType).toBe('');
  });

  it('tidies the tags, drops blanks and repeats in another case, keeps the order and stops at six', () => {
    const query = 'tag=%20Hill%20%20repeats&tag=&tag=%20&tag=hill%20repeats&tag=b&tag=c&tag=d&tag=e&tag=f&tag=g&tag=h';
    expect(readFilters(params(query)).tags).toEqual(['Hill repeats', 'b', 'c', 'd', 'e', 'f']);
  });

  it('writes the filters back, nothing for one that is not set', () => {
    expect(writeFilters({ runType: '', tags: [] }).toString()).toBe('');
    expect(writeFilters({ runType: 'RACE', tags: ['with the dog', '🏃'] }).toString()).toBe('runType=RACE&tag=with+the+dog&tag=%F0%9F%8F%83');
    expect(readFilters(writeFilters({ runType: 'WORKOUT', tags: ['a&b', 'c=d'] }))).toEqual({ runType: 'WORKOUT', tags: ['a&b', 'c=d'] });
  });
});

describe('the request for weeks', () => {
  it('asks for twelve weeks ending today unless it says otherwise', () => {
    expect(PAGE_WEEKS).toBe(12);
    expect(logUrl()).toBe('/api/training/log?weeks=12');
  });

  it('adds the day, the type and every tag, each tag as its own parameter and encoded', () => {
    expect(logUrl({ to: '2026-09-20', weeks: 6, runType: 'RACE', tags: ['hills', 'with the dog', 'a&b'] }))
      .toBe('/api/training/log?weeks=6&to=2026-09-20&runType=RACE&tag=hills&tag=with+the+dog&tag=a%26b');
  });

  it('asks for the weeks before the oldest one it has, by the day before it', () => {
    expect(nextPageTo([{ start: '2026-10-05' }, { start: '2026-09-28' }])).toBe('2026-09-27');
    expect(nextPageTo([{ start: '2026-03-02' }])).toBe('2026-03-01');
    expect(nextPageTo([{ start: '2026-01-05' }, { start: '2026-01-01' }])).toBe('2025-12-31');
    expect(nextPageTo([{ start: '2024-03-01' }])).toBe('2024-02-29');
    expect(nextPageTo([])).toBeNull();
    expect(nextPageTo(null)).toBeNull();
  });

  it('goes back one day across months, years and a leap day, and refuses what is not a day', () => {
    expect(dayBefore('2026-10-01')).toBe('2026-09-30');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    expect(dayBefore('2028-03-01')).toBe('2028-02-29');
    expect(dayBefore('2026-02-30')).toBeNull();
    expect(dayBefore('yesterday')).toBeNull();
    expect(dayBefore(null)).toBeNull();
  });

  it('adds weeks to the end and leaves out ones it already has', () => {
    const loaded = [{ start: '2026-10-05' }, { start: '2026-09-28' }];
    expect(mergeWeeks(loaded, [{ start: '2026-09-28' }, { start: '2026-09-21' }]).map((week) => week.start))
      .toEqual(['2026-10-05', '2026-09-28', '2026-09-21']);
    expect(mergeWeeks(loaded, [])).toEqual(loaded);
  });

  it('knows the week the runner\'s today is in, edges included', () => {
    const week = { start: '2026-10-05', end: '2026-10-11' };
    expect(isCurrentWeek(week, '2026-10-05')).toBe(true);
    expect(isCurrentWeek(week, '2026-10-11')).toBe(true);
    expect(isCurrentWeek(week, '2026-10-04')).toBe(false);
    expect(isCurrentWeek(week, '2026-10-12')).toBe(false);
    expect(isCurrentWeek(week, undefined)).toBe(false);
  });
});

describe('a week\'s strip', () => {
  const week = {
    start: '2026-09-28',
    end: '2026-10-04',
    days: [
      { date: '2026-09-29', runs: [{ distanceKm: 5 }, { distanceKm: 3 }] },
      { date: '2026-10-03', runs: [{ distanceKm: 16 }] },
    ],
  };

  it('has seven days from Monday, across the end of a month', () => {
    const strip = weekStrip(week, 16);
    expect(strip.map((day) => day.date)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  });

  it('adds the runs of a day together and draws each against the longest day', () => {
    const strip = weekStrip(week, 16);
    expect(strip[1]).toMatchObject({ km: 8, runs: 2, height: 0.5 });
    expect(strip[5]).toMatchObject({ km: 16, runs: 1, height: 1 });
    expect(strip[0]).toMatchObject({ km: 0, runs: 0, height: 0 });
  });

  it('never draws a day shorter than a sliver or taller than the scale', () => {
    expect(weekStrip({ ...week, days: [{ date: '2026-09-28', runs: [{ distanceKm: 0.1 }] }] }, 40)[0].height).toBe(0.08);
    expect(weekStrip(week, 4)[5].height).toBe(1);
  });

  it('copes with a week of nothing and a scale of nothing', () => {
    const empty = weekStrip({ start: '2026-10-05', end: '2026-10-11', days: [] }, 0);
    expect(empty).toHaveLength(7);
    expect(empty.every((day) => day.height === 0)).toBe(true);
    expect(weekStrip({ start: '2026-10-05', end: '2026-10-11' }, 10)).toHaveLength(7);
  });

  it('finds the longest day among all the weeks', () => {
    expect(longestDayKm([week, { start: '2026-09-21', days: [{ date: '2026-09-22', runs: [{ distanceKm: 9 }, { distanceKm: 9 }] }] }])).toBe(18);
    expect(longestDayKm([])).toBe(0);
    expect(longestDayKm([{ start: '2026-09-21' }])).toBe(0);
  });
});

describe('the weeks as listed', () => {
  const week = (start, end, runs) => ({ start, end, runs });
  const weeks = [
    week('2026-10-05', '2026-10-11', 3),
    week('2026-09-28', '2026-10-04', 0),
    week('2026-09-21', '2026-09-27', 0),
    week('2026-09-14', '2026-09-20', 0),
    week('2026-09-07', '2026-09-13', 2),
    week('2026-08-31', '2026-09-06', 0),
    week('2026-08-24', '2026-08-30', 1),
    week('2026-08-17', '2026-08-23', 0),
    week('2026-08-10', '2026-08-16', 0),
  ];

  it('gives every week its own line when nothing is filtered, empty ones too', () => {
    const items = listWeeks(weeks);
    expect(items).toHaveLength(9);
    expect(items.every((item) => item.week && !item.gap)).toBe(true);
    expect(items.map((item) => item.week.start)).toEqual(weeks.map((one) => one.start));
  });

  it('folds two or more empty weeks in a row into one line when filtered, naming the dates they cover', () => {
    const items = listWeeks(weeks, { foldEmpty: true });
    expect(items.map((item) => (item.gap ? `gap:${item.count}:${item.start}:${item.end}` : item.week.start))).toEqual([
      '2026-10-05',
      'gap:3:2026-09-14:2026-10-04',
      '2026-09-07',
      '2026-08-31',
      '2026-08-24',
      'gap:2:2026-08-10:2026-08-23',
    ]);
  });

  it('keeps a single empty week as a week of its own, since a fold of one saves nothing', () => {
    const items = listWeeks(weeks, { foldEmpty: true });
    expect(items[3].week).toMatchObject({ start: '2026-08-31', runs: 0 });
  });

  it('copes with no weeks, all weeks empty and no empty weeks', () => {
    expect(listWeeks([], { foldEmpty: true })).toEqual([]);
    expect(listWeeks([week('2026-10-05', '2026-10-11', 0), week('2026-09-28', '2026-10-04', 0)], { foldEmpty: true }))
      .toEqual([{ gap: true, count: 2, start: '2026-09-28', end: '2026-10-11' }]);
    expect(listWeeks([week('2026-10-05', '2026-10-11', 1)], { foldEmpty: true })).toHaveLength(1);
  });
});

describe('writing dates, paces and times', () => {
  it('writes a week as a range, once the month when it is the same', () => {
    expect(formatWeekRange('2026-10-05', '2026-10-11', 'en')).toMatch(/^Oct\s5\s*[–-]\s*11$/u);
    expect(formatWeekRange('2026-09-28', '2026-10-04', 'en')).toMatch(/^Sep\s28\s*[–-]\s*Oct\s4$/u);
    expect(formatWeekRange('2026-10-05', '2026-10-11', 'zh-CN')).toMatch(/^10\/5\s*[–-]\s*10\/11$/u);
    expect(formatWeekRange('nonsense', '2026-10-11', 'en')).toBe('--');
  });

  it('writes a day with its weekday', () => {
    expect(formatDayHeading('2026-10-05', 'en')).toBe('Mon, Oct 5');
    expect(formatDayHeading('2026-10-05', 'zh-CN')).toContain('周一');
    expect(formatDayHeading('2026-13-05', 'en')).toBe('--');
  });

  it('writes a weekday short or narrow, and the day of the month', () => {
    expect(formatWeekday('2026-10-05', 'en')).toBe('Mon');
    expect(formatWeekday('2026-10-05', 'en', 'narrow')).toBe('M');
    expect(formatWeekday('nope', 'en')).toBe('');
    expect(dayOfMonth('2026-10-05')).toBe(5);
    expect(dayOfMonth('nope')).toBe('');
  });

  it('writes a pace per kilometre or per mile', () => {
    expect(paceText(300, 'km')).toBe('5:00');
    expect(paceText(300, 'mile')).toBe('8:03');
    expect(paceText(359.6, 'km')).toBe('6:00');
    expect(paceText(0, 'km')).toBe('–');
    expect(paceText(null, 'km')).toBe('–');
    expect(paceText(NaN, 'mile')).toBe('–');
  });

  it('writes a time as m:ss under an hour and h:mm:ss over it, and a dash for none', () => {
    expect(clockText(59)).toBe('0:59');
    expect(clockText(1500)).toBe('25:00');
    expect(clockText(3600)).toBe('1:00:00');
    expect(clockText(4900)).toBe('1:21:40');
    expect(clockText(0)).toBe('–');
    expect(clockText(null)).toBe('–');
  });

  it('splits a week\'s time into hours and minutes', () => {
    expect(weekTimeParts(4900)).toEqual({ hours: 1, minutes: 22 });
    expect(weekTimeParts(2700)).toEqual({ hours: 0, minutes: 45 });
    expect(weekTimeParts(0)).toEqual({ hours: 0, minutes: 0 });
    expect(weekTimeParts(undefined)).toEqual({ hours: 0, minutes: 0 });
  });
});
