import { describe, expect, it } from 'vitest';
import {
  DEFAULT_METRIC,
  JUMP_FLOOR,
  METRICS,
  PAGE_WEEKS,
  addDays,
  clockText,
  dayBefore,
  dayMetric,
  dayOfMonth,
  formatDayHeading,
  formatWeekRange,
  formatWeekday,
  isCurrentWeek,
  jumpDay,
  listWeeks,
  logUrl,
  longestDay,
  mergeWeeks,
  metricText,
  newerPageTo,
  nextPageTo,
  paceText,
  prependWeeks,
  readFilters,
  runMetric,
  showsLatestWeek,
  weekStartOf,
  weekStrip,
  weekTimeParts,
  writeFilters,
} from './trainingLog';

const params = (query) => new URLSearchParams(query);

describe('the filters in the address', () => {
  it('reads a run type and tags', () => {
    expect(readFilters(params('runType=RACE&tag=hills&tag=Track'))).toEqual({ runType: 'RACE', tags: ['hills', 'Track'], metric: 'distance', to: '' });
    expect(readFilters(params(''))).toEqual({ runType: '', tags: [], metric: 'distance', to: '' });
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
    expect(readFilters(writeFilters({ runType: 'WORKOUT', tags: ['a&b', 'c=d'] }))).toEqual({ runType: 'WORKOUT', tags: ['a&b', 'c=d'], metric: 'distance', to: '' });
  });
});

describe('the view in the address', () => {
  it('reads the metric the log looks at: distance when it is missing or not one of the four', () => {
    expect(METRICS).toEqual(['distance', 'time', 'climb', 'effort']);
    expect(DEFAULT_METRIC).toBe('distance');
    for (const metric of METRICS) expect(readFilters(params(`metric=${metric}`)).metric).toBe(metric);
    for (const query of ['', 'metric=', 'metric=pace', 'metric=TIME', 'metric=time%20']) {
      expect(readFilters(params(query)).metric).toBe('distance');
    }
  });

  it('reads a day to jump to when it is a whole, real day from 1970 on, and nothing else', () => {
    expect(readFilters(params('to=2024-03-31')).to).toBe('2024-03-31');
    expect(readFilters(params('to=2024-02-29')).to).toBe('2024-02-29');
    expect(readFilters(params(`to=${JUMP_FLOOR}`)).to).toBe('1970-01-01');
    for (const bad of ['2023-02-29', '2024-13-01', '2024-3-1', '2024-03-31T10:00:00', '1969-12-31', '0002-03-31', 'yesterday', '']) {
      expect(readFilters(params(`to=${bad}`)).to).toBe('');
    }
    expect(readFilters(params('')).to).toBe('');
  });

  it('writes the metric only when it is not distance and the day only when there is one, after the filters', () => {
    expect(writeFilters({ metric: 'distance', to: '' }).toString()).toBe('');
    expect(writeFilters({ metric: 'climb' }).toString()).toBe('metric=climb');
    expect(writeFilters({ to: '2024-03-31' }).toString()).toBe('to=2024-03-31');
    expect(writeFilters({ runType: 'RACE', tags: ['a'], metric: 'time', to: '2024-03-31' }).toString()).toBe('runType=RACE&tag=a&metric=time&to=2024-03-31');
    const view = { runType: 'WORKOUT', tags: ['x'], metric: 'effort', to: '2025-01-05' };
    expect(readFilters(writeFilters(view))).toEqual(view);
  });

  it('leaves the view out of the request, which is about the runs only', () => {
    expect(logUrl({ runType: 'RACE', tags: ['a'], metric: 'time' })).toBe('/api/training/log?weeks=12&runType=RACE&tag=a');
  });
});

describe('the day a date field has been set to', () => {
  it('takes a whole, real day from 1970 up to today, today included', () => {
    expect(jumpDay('2026-03-31', '2026-10-10')).toBe('2026-03-31');
    expect(jumpDay('2026-10-10', '2026-10-10')).toBe('2026-10-10');
    expect(jumpDay('1970-01-01', '2026-10-10')).toBe('1970-01-01');
    expect(jumpDay('2024-02-29', '2026-10-10')).toBe('2024-02-29');
  });

  it('waits while the field holds something that is not a day yet, such as a year still being typed', () => {
    const waiting = ['', null, undefined, '2026-03', '2026-3-31', '0002-03-31', '0020-03-31', '0202-03-31', '1969-12-31', '2026-02-30', 'soon', '2026-03-31T10:00'];
    for (const value of waiting) expect(jumpDay(value, '2026-10-10')).toBeNull();
  });

  it('does not take a day after today', () => {
    expect(jumpDay('2026-10-11', '2026-10-10')).toBeNull();
    expect(jumpDay('2099-01-01', '2026-10-10')).toBeNull();
  });

  it('takes any real day when it is not told today', () => {
    expect(jumpDay('2099-01-01', undefined)).toBe('2099-01-01');
  });
});

describe('days and weeks', () => {
  it('adds days across months, years and a leap day, backwards too, and refuses what is not a day', () => {
    expect(addDays('2026-10-05', 6)).toBe('2026-10-11');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
    expect(addDays('2026-03-08', 84)).toBe('2026-05-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-02-30', 1)).toBeNull();
    expect(addDays(null, 1)).toBeNull();
  });

  it('finds the Monday of the week a day is in, Sunday included', () => {
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-10')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
    expect(weekStartOf('2026-01-01')).toBe('2025-12-29');
    expect(weekStartOf('nope')).toBeNull();
  });

  it('knows whether the weeks on screen reach the runner\'s today', () => {
    const weeks = [{ start: '2026-10-05', end: '2026-10-11' }, { start: '2026-09-28', end: '2026-10-04' }];
    expect(showsLatestWeek(weeks, '2026-10-10')).toBe(true);
    expect(showsLatestWeek(weeks, '2026-10-11')).toBe(true);
    expect(showsLatestWeek(weeks, '2026-10-12')).toBe(false);
    expect(showsLatestWeek([], '2026-10-10')).toBe(false);
    expect(showsLatestWeek(weeks, undefined)).toBe(false);
    expect(showsLatestWeek(null, '2026-10-10')).toBe(false);
  });

  it('asks for the weeks after the newest one by the day a page of weeks further on, or today when that comes sooner', () => {
    const weeks = [{ start: '2026-03-02', end: '2026-03-08' }, { start: '2026-02-23', end: '2026-03-01' }];
    expect(newerPageTo(weeks, '2026-10-10')).toBe('2026-05-31');
    expect(newerPageTo(weeks, '2026-10-10', 4)).toBe('2026-04-05');
    expect(newerPageTo([{ start: '2026-08-31', end: '2026-09-06' }], '2026-10-10')).toBe('2026-10-10');
    expect(newerPageTo([{ start: '2026-10-05', end: '2026-10-11' }], '2026-10-10')).toBeNull();
    expect(newerPageTo([], '2026-10-10')).toBeNull();
    expect(newerPageTo(null, '2026-10-10')).toBeNull();
    expect(newerPageTo(weeks, undefined)).toBeNull();
  });

  it('adds weeks to the start of the list, newest first as they come, leaving out ones it already has', () => {
    const loaded = [{ start: '2026-03-02' }, { start: '2026-02-23' }];
    expect(prependWeeks(loaded, [{ start: '2026-03-16' }, { start: '2026-03-09' }]).map((week) => week.start))
      .toEqual(['2026-03-16', '2026-03-09', '2026-03-02', '2026-02-23']);
    expect(prependWeeks(loaded, [{ start: '2026-03-09' }, { start: '2026-03-02' }, { start: '2026-02-23' }]).map((week) => week.start))
      .toEqual(['2026-03-09', '2026-03-02', '2026-02-23']);
    expect(prependWeeks(loaded, [])).toEqual(loaded);
    expect(prependWeeks([], [{ start: '2026-03-09' }])).toEqual([{ start: '2026-03-09' }]);
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
    expect(strip[1]).toMatchObject({ value: 8, runs: 2, height: 0.5 });
    expect(strip[5]).toMatchObject({ value: 16, runs: 1, height: 1 });
    expect(strip[0]).toMatchObject({ value: 0, runs: 0, height: 0 });
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
    expect(longestDay([week, { start: '2026-09-21', days: [{ date: '2026-09-22', runs: [{ distanceKm: 9 }, { distanceKm: 9 }] }] }])).toBe(18);
    expect(longestDay([])).toBe(0);
    expect(longestDay([{ start: '2026-09-21' }])).toBe(0);
  });
});

describe('a metric', () => {
  const runs = {
    jog: { distanceKm: 5, movingSeconds: 1500, elevationGainM: 20, effort: 40 },
    strides: { distanceKm: 3, movingSeconds: 900, elevationGainM: null, effort: null },
    race: { distanceKm: 16, movingSeconds: 5400, elevationGainM: 100, effort: 120 },
  };
  const week = {
    start: '2026-09-28',
    end: '2026-10-04',
    days: [
      { date: '2026-09-29', runs: [runs.jog, runs.strides] },
      { date: '2026-10-03', runs: [runs.race] },
    ],
  };

  it('is what a run adds: kilometres, moving seconds, metres climbed or its Effort score', () => {
    expect(runMetric(runs.jog, 'distance')).toBe(5);
    expect(runMetric(runs.jog, 'time')).toBe(1500);
    expect(runMetric(runs.jog, 'climb')).toBe(20);
    expect(runMetric(runs.jog, 'effort')).toBe(40);
    expect(runMetric(runs.jog, 'something else')).toBe(5);
  });

  it('is nothing for a run that has no such figure', () => {
    expect(runMetric(runs.strides, 'climb')).toBe(0);
    expect(runMetric(runs.strides, 'effort')).toBe(0);
    expect(runMetric({}, 'distance')).toBe(0);
    expect(runMetric({ distanceKm: null, movingSeconds: undefined }, 'time')).toBe(0);
  });

  it('adds the runs of a day up', () => {
    const day = week.days[0];
    expect(dayMetric(day, 'distance')).toBe(8);
    expect(dayMetric(day, 'time')).toBe(2400);
    expect(dayMetric(day, 'climb')).toBe(20);
    expect(dayMetric(day, 'effort')).toBe(40);
  });

  it.each([
    ['time', 5400, [2400 / 5400, 1]],
    ['climb', 100, [0.2, 1]],
    ['effort', 120, [40 / 120, 1]],
  ])('draws the strip in %s against the biggest day of it', (metric, scale, [first, second]) => {
    const strip = weekStrip(week, scale, metric);
    expect(strip[1].height).toBeCloseTo(first, 10);
    expect(strip[5].height).toBe(second);
    expect(strip[0].height).toBe(0);
  });

  it('draws the strip in distance when no metric is given', () => {
    expect(weekStrip(week, 16)[1].height).toBe(0.5);
  });

  it('finds the biggest day in each metric', () => {
    expect(longestDay([week], 'distance')).toBe(16);
    expect(longestDay([week], 'time')).toBe(5400);
    expect(longestDay([week], 'climb')).toBe(100);
    expect(longestDay([week], 'effort')).toBe(120);
    expect(longestDay([week])).toBe(16);
  });

  it('is written the way the log writes it', () => {
    const plain = { lang: 'en', unit: 'km', formatNumber: (value) => String(value) };
    expect(metricText(12.34, 'distance', plain)).toBe('12.3 km');
    expect(metricText(12.34, 'distance', { ...plain, unit: 'mile' })).toBe('7.7 mi');
    expect(metricText(2400, 'time', plain)).toBe('40:00');
    expect(metricText(4900, 'time', plain)).toBe('1:21:40');
    expect(metricText(80.4, 'climb', plain)).toBe('80 m');
    expect(metricText(62.4, 'effort', plain)).toBe('62');
    expect(metricText(1234.6, 'effort', { ...plain, formatNumber: (value) => `#${value}` })).toBe('#1235');
  });

  it('is a dash for nothing', () => {
    const plain = { lang: 'en', unit: 'km', formatNumber: (value) => String(value) };
    for (const metric of METRICS) expect(metricText(0, metric, plain)).toBe('–');
    expect(metricText(undefined, 'time', plain)).toBe('–');
    expect(metricText(NaN, 'climb', plain)).toBe('–');
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
