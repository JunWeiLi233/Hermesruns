import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import { buildMetricTrend } from './metricTrend';
import { describeComparison, describeTrend, metricWords } from './metricTrendWords';

const TODAY = '2026-10-15';

function makeContext(lang = 'en', unit = 'km') {
  const dictionary = lang === 'zh-CN' ? zh : en;
  const t = (key, params = {}) => {
    const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) ?? key;
    return Object.entries(params).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), copy);
  };
  const formatNumber = (value, options) => new Intl.NumberFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value);
  return { lang, unit, t, formatNumber };
}

function run(id, day, km, seconds, extra = {}) {
  return { id, name: `Run ${id}`, startTime: `${day}T07:00:00`, distanceKm: km, movingTimeSeconds: seconds, ...extra };
}

/** Twelve runs 12 days apart from 1 May, 12 seconds a kilometre quicker each time (360 down to 228), and eight a long time before at 400. */
function season() {
  const now = Array.from({ length: 12 }, (_, index) => {
    const day = new Date(Date.UTC(2026, 4, 1 + index * 12)).toISOString().slice(0, 10);
    return run(100 + index, day, 8, 8 * (360 - index * 12));
  });
  const earlier = Array.from({ length: 8 }, (_, index) => {
    const day = new Date(Date.UTC(2025, 9, 20 + index * 15)).toISOString().slice(0, 10);
    return run(200 + index, day, 8, 8 * 400);
  });
  return [...now, ...earlier];
}

describe('a value in words', () => {
  const km = makeContext('en', 'km');
  const mile = makeContext('en', 'mile');

  it('writes a pace in the runner\'s unit, a distance in it, a time as minutes and seconds, and the rest with their own unit', () => {
    expect(metricWords('pace', km).value(348)).toBe('5:48 /km');
    expect(metricWords('pace', mile).value(348)).toBe('9:20 /mi');
    expect(metricWords('distance', km).value(8.2)).toBe('8.2 km');
    expect(metricWords('distance', mile).value(8.2)).toBe('5.1 mi');
    expect(metricWords('duration', km).value(1500)).toBe('25:00');
    expect(metricWords('heartRate', km).value(152.4)).toBe('152 bpm');
    expect(metricWords('efficiency', km).value(1.3333)).toBe('1.33 m/beat');
    expect(metricWords('cadence', km).value(169.6)).toBe('170 spm');
  });

  it('writes the number on an axis without its unit, in the runner\'s unit', () => {
    expect(metricWords('pace', km).axis(330)).toBe('5:30');
    expect(metricWords('pace', mile).axis(540)).toBe('9:00');
    expect(metricWords('distance', km).axis(12.5)).toBe('12.5');
    expect(metricWords('duration', km).axis(1800)).toBe('30:00');
    expect(metricWords('heartRate', km).axis(151.6)).toBe('152');
    expect(metricWords('efficiency', km).axis(1.1)).toBe('1.10');
  });

  it('writes how much a change is without its sign, and says which way it went', () => {
    const pace = metricWords('pace', km);
    expect(pace.amount(-7)).toBe('0:07 /km');
    expect(pace.way(-7)).toBe('quicker');
    expect(pace.way(7)).toBe('slower');
    expect(metricWords('pace', mile).amount(-10)).toBe('0:16 /mi');
    expect(metricWords('distance', km).amount(-1.25)).toBe('1.3 km');
    expect(metricWords('distance', km).way(1)).toBe('longer');
    expect(metricWords('duration', km).way(-60)).toBe('shorter');
    expect(metricWords('heartRate', km).amount(2.04)).toBe('2.0 bpm');
    expect(metricWords('heartRate', km).way(-2)).toBe('lower');
    expect(metricWords('efficiency', km).way(0.01)).toBe('higher');
    expect(metricWords('cadence', km).way(-1)).toBe('lower');
  });

  it('calls a change level when it is nothing at the precision it is written to', () => {
    expect(metricWords('pace', km).level(0.4)).toBe(true);
    expect(metricWords('pace', km).level(-0.6)).toBe(false);
    expect(metricWords('distance', km).level(0.04)).toBe(true);
    expect(metricWords('distance', km).level(0.06)).toBe(false);
    expect(metricWords('distance', mile).level(0.06)).toBe(true);
    expect(metricWords('duration', km).level(0.3)).toBe(true);
    expect(metricWords('heartRate', km).level(0.04)).toBe(true);
    expect(metricWords('efficiency', km).level(0.004)).toBe(true);
    expect(metricWords('efficiency', km).level(0.006)).toBe(false);
    expect(metricWords('cadence', km).level(0)).toBe(true);
  });
});

describe('what the trend line found, in words', () => {
  const context = makeContext();
  const words = metricWords('pace', context);
  const describe_ = (runs, options) => describeTrend(buildMetricTrend(runs, { metric: 'pace', range: '6m', today: TODAY, ...options }), words, context);

  it('says how far the straight line goes each month and over the period, and how much of the differences it accounts for', () => {
    // One second a kilometre quicker each day, along a perfect line, over the 132 days from the first run to the last.
    expect(describe_(season())).toEqual([
      'A straight line through the runs goes 0:30 /km quicker each month, 2:12 /km quicker over the period.',
      'It accounts for 100% of the differences between the runs: a clear trend.',
    ]);
  });

  it('calls a loose fit loose and a poor one hardly a trend, by the share it accounts for', () => {
    // Four runs on a rising line and one that is far off it: some of the differences accounted for, but loosely.
    const wobbly = [300, 330, 290, 340, 310, 335, 295, 320].map((pace, index) => run(index + 1, new Date(Date.UTC(2026, 6, 1 + index * 14)).toISOString().slice(0, 10), 5, 5 * pace));
    const sentences = describe_(wobbly);
    expect(sentences[1]).toMatch(/hardly a trend|a loose trend/);
    const flat = [300, 330, 290, 340, 300, 330, 290, 340].map((pace, index) => run(index + 1, new Date(Date.UTC(2026, 6, 1 + index * 14)).toISOString().slice(0, 10), 5, 5 * pace));
    expect(describe_(flat)[1]).toMatch(/hardly a trend/);
  });

  it('says a line is level when it moves nothing at the precision it is written to', () => {
    const level = Array.from({ length: 8 }, (_, index) => run(index + 1, new Date(Date.UTC(2026, 6, 1 + index * 14)).toISOString().slice(0, 10), 5, 1500));
    expect(describe_(level)).toEqual(['A straight line through the runs is level.']);
  });

  it('says what a straight line needs when it has too few runs or too few days', () => {
    expect(describe_(season().slice(0, 3))).toEqual(['A straight line needs at least 5 runs in the period, and the period has 3.']);
    const crowded = Array.from({ length: 6 }, (_, index) => run(index + 1, `2026-09-${String(1 + index).padStart(2, '0')}`, 5, 1500 - index * 10));
    expect(describe_(crowded)).toEqual(['A straight line needs the runs to be spread over at least 14 days.']);
  });

  it('says where the average of the latest runs went', () => {
    expect(describe_(season(), { line: 'average' })).toEqual(['The average of the latest 10 runs went from 5:36 /km to 4:42 /km: 0:54 /km quicker.']);
    expect(describe_(season().slice(0, 3), { line: 'average' })).toEqual(['The average of 10 runs starts once there are 5 runs, and the period has 3.']);
    const level = Array.from({ length: 8 }, (_, index) => run(index + 1, new Date(Date.UTC(2026, 6, 1 + index * 14)).toISOString().slice(0, 10), 5, 1500));
    expect(describe_(level, { line: 'average' })).toEqual(['The average of the latest 10 runs is level, at 5:00 /km.']);
  });

  it('has nothing to say with no run', () => {
    expect(describe_([])).toEqual([]);
  });
});

describe('the comparison with the stretch before, in words', () => {
  const context = makeContext();
  const words = metricWords('pace', context);
  const compare = (runs, options) => describeComparison(buildMetricTrend(runs, { metric: 'pace', range: '6m', today: TODAY, ...options }), words, context);

  it('sets the middle of the period against the middle of the stretch before', () => {
    expect(compare(season())).toBe('The middle of this period is 4:54 /km, 1:46 /km quicker than the middle of the 6 months before it (6:40 /km).');
  });

  it('says they are the same when the middles are the same', () => {
    const same = [...season().filter((r) => r.id < 200).map((r) => ({ ...r, movingTimeSeconds: 8 * 400 })), ...season().filter((r) => r.id >= 200)];
    expect(compare(same)).toBe('The middle of this period is the same as the middle of the 6 months before it (6:40 /km).');
  });

  it('says there are too few runs, and how many each stretch needs', () => {
    expect(compare(season().filter((r) => r.id < 202))).toBe('Too few runs to compare with the 6 months before: it needs 3 in each, and that stretch has 2.');
  });

  it('names the stretch by the period asked for, and has none for all time', () => {
    // Over a year the stretch before (15 October 2024 to 14 October 2025) has none of these runs.
    expect(compare(season(), { range: '1y' })).toBe('Too few runs to compare with the year before: it needs 3 in each, and that stretch has 0.');
    // Over 3 months (from 15 July) the runs are the last five, 276 down to 228 a kilometre, middle 252; the 3 months before hold the first seven, 360 down to 288, middle 324.
    expect(compare(season(), { range: '3m' })).toBe('The middle of this period is 4:12 /km, 1:12 /km quicker than the middle of the 3 months before it (5:24 /km).');
    expect(compare(season(), { range: 'all' })).toBeNull();
  });
});

describe('in Chinese', () => {
  const context = makeContext('zh-CN', 'km');
  const words = metricWords('pace', context);
  const model = (options) => buildMetricTrend(season(), { metric: 'pace', range: '6m', today: TODAY, ...options });

  /** Punctuation outside numbers such as 5:48: Chinese text has Chinese punctuation (BUG-052 was the English kind in a Chinese sentence). */
  const stray = (text) => text.replace(/\d+:\d+/g, '').match(/[,:;]|\.(?!\d)/g);

  it('uses Chinese punctuation in every sentence', () => {
    const sentences = [
      ...describeTrend(model(), words, context),
      ...describeTrend(model({ line: 'average' }), words, context),
      describeComparison(model(), words, context),
      describeComparison(buildMetricTrend(season().filter((r) => r.id < 202), { metric: 'pace', range: '6m', today: TODAY }), words, context),
    ];
    expect(sentences.length).toBe(5);
    for (const sentence of sentences) {
      expect(sentence).not.toBe('');
      expect(stray(sentence)).toBeNull();
      expect(sentence).not.toMatch(/trends\./);
    }
  });

  it('puts the amount after the direction, and says what the stretch before is called', () => {
    expect(describeTrend(model(), words, context)[0]).toBe('穿过这些跑步的直线每个月更快 0:30 /公里，整个时间段共更快 2:12 /公里。');
    expect(describeComparison(model(), words, context)).toBe('这个时间段的中间值是 4:54 /公里，比之前 6 个月的中间值（6:40 /公里）更快 1:46 /公里。');
  });
});
