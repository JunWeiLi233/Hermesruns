import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import {
  METRICS,
  PERIODS,
  barWidth,
  formToTarget,
  formatAmount,
  formatDurationWords,
  firstFree,
  hasGoal,
  maxInFormUnit,
  sortGoals,
  targetToForm,
} from './goals';

const translator = (dictionary) => (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
const t = translator(en);
const formatNumber = (value, options) => new Intl.NumberFormat('en-US', options).format(value);

describe('what is typed into the target box', () => {
  it('reads a plain number', () => {
    expect(formToTarget('DISTANCE', '40')).toBe(40);
    expect(formToTarget('DISTANCE', '5.5')).toBe(5.5);
    expect(formToTarget('DISTANCE', ' 12 ')).toBe(12);
    expect(formToTarget('DISTANCE', '.5')).toBe(0.5);
    expect(formToTarget('DISTANCE', '5.')).toBe(5);
  });

  it('reads a comma as a decimal point', () => {
    expect(formToTarget('DISTANCE', '5,5')).toBe(5.5);
    expect(formToTarget('DISTANCE', '0,75')).toBe(0.75);
  });

  it('reads groups of three after a first digit that is not zero as thousands, either way round', () => {
    expect(formToTarget('DISTANCE', '1,250')).toBe(1250);
    expect(formToTarget('DISTANCE', '1.250')).toBe(1250);
    expect(formToTarget('ELEVATION', '12,345')).toBe(12345);
    expect(formToTarget('DISTANCE', '12,345.6')).toBe(12345.6);
    expect(formToTarget('DISTANCE', '12.345,6')).toBe(12345.6);
    expect(formToTarget('DISTANCE', '1,234,567')).toBe(1234567);
  });

  it('does not take a leading zero for thousands', () => {
    expect(formToTarget('DISTANCE', '0.500')).toBe(0.5);
    expect(formToTarget('DISTANCE', '0,250')).toBe(0.25);
  });

  it('turns miles into kilometres, hours into seconds, and keeps runs and metres whole', () => {
    expect(formToTarget('DISTANCE', '26.2', 'mile')).toBe(42.16);
    expect(formToTarget('DISTANCE', '26.2', 'km')).toBe(26.2);
    expect(formToTarget('TIME', '6.5')).toBe(23400);
    expect(formToTarget('TIME', '0.25')).toBe(900);
    expect(formToTarget('COUNT', '3.6')).toBe(4);
    expect(formToTarget('ELEVATION', '800.4')).toBe(800);
  });

  it.each(['', '   ', 'abc', '-3', '0', '0.0', '5 km', '1e3', '--5', '5..5', '1,2,3', '٣', null, undefined])('is not a target: %j', (text) => {
    expect(formToTarget('DISTANCE', text)).toBeNull();
  });
});

describe('what a stored target shows in the box', () => {
  it('shows kilometres or miles, hours, runs and metres', () => {
    expect(targetToForm('DISTANCE', 42.2, 'km')).toBe('42.2');
    expect(targetToForm('DISTANCE', 42.16, 'mile')).toBe('26.2');
    expect(targetToForm('TIME', 23400)).toBe('6.5');
    expect(targetToForm('TIME', 3600)).toBe('1');
    expect(targetToForm('COUNT', 4)).toBe('4');
    expect(targetToForm('ELEVATION', 1250.4)).toBe('1250');
    expect(targetToForm('DISTANCE', undefined)).toBe('');
    expect(targetToForm('DISTANCE', 'x')).toBe('');
  });

  it('comes back to the same target through the box, to the precision the server keeps', () => {
    for (const [metric, stored, unit] of [['DISTANCE', 100, 'km'], ['DISTANCE', 80.47, 'mile'], ['TIME', 18000, 'km'], ['COUNT', 12, 'km'], ['ELEVATION', 2500, 'km']]) {
      const back = formToTarget(metric, targetToForm(metric, stored, unit), unit);
      expect(back).toBeCloseTo(stored, metric === 'DISTANCE' && unit === 'mile' ? 1 : 6);
    }
  });

  it('says the largest target in the unit of the box', () => {
    const max = { DISTANCE: 100000, TIME: 31536000, COUNT: 10000, ELEVATION: 1000000 };
    expect(maxInFormUnit('DISTANCE', max, 'km')).toBe(100000);
    expect(maxInFormUnit('DISTANCE', max, 'mile')).toBe(62137.12);
    expect(maxInFormUnit('TIME', max)).toBe(8760);
    expect(maxInFormUnit('COUNT', max)).toBe(10000);
    expect(maxInFormUnit('ELEVATION', max)).toBe(1000000);
    expect(maxInFormUnit('DISTANCE', undefined)).toBeNull();
    expect(maxInFormUnit('DISTANCE', {})).toBeNull();
  });
});

describe('writing an amount', () => {
  const amount = (metric, value, unit = 'km') => formatAmount(metric, value, { unit, t, formatNumber });

  it('writes distance in kilometres or miles with one decimal at most', () => {
    expect(amount('DISTANCE', 42.5)).toBe('42.5 km');
    expect(amount('DISTANCE', 60)).toBe('60 km');
    expect(amount('DISTANCE', 42.195)).toBe('42.2 km');
    expect(amount('DISTANCE', 42.195, 'mile')).toBe('26.2 mi');
    expect(amount('DISTANCE', 1234.56)).toBe('1,234.6 km');
    expect(amount('DISTANCE', 0)).toBe('0 km');
  });

  it('writes time as hours and minutes', () => {
    expect(amount('TIME', 22800)).toBe('6 h 20 min');
    expect(amount('TIME', 2700)).toBe('45 min');
    expect(amount('TIME', 3600)).toBe('1 h 0 min');
    expect(amount('TIME', 0)).toBe('0 min');
  });

  it('writes a number of runs in the singular for one and the plural for the rest', () => {
    expect(amount('COUNT', 1)).toBe('1 run');
    expect(amount('COUNT', 2)).toBe('2 runs');
    expect(amount('COUNT', 0)).toBe('0 runs');
    expect(amount('COUNT', 0.4)).toBe('0.4 runs');
  });

  it('writes climb in metres', () => {
    expect(amount('ELEVATION', 1250)).toBe('1,250 m');
    expect(amount('ELEVATION', 49.6)).toBe('50 m');
  });

  it('writes in Chinese too', () => {
    const tz = translator(zh);
    expect(formatAmount('DISTANCE', 42.5, { unit: 'km', t: tz, formatNumber })).toBe('42.5 公里');
    expect(formatAmount('TIME', 22800, { unit: 'km', t: tz, formatNumber })).toBe('6 小时 20 分');
    expect(formatAmount('COUNT', 3, { unit: 'km', t: tz, formatNumber })).toBe('3 次');
  });

  it('writes a stretch of time', () => {
    expect(formatDurationWords(59, t)).toBe('1 min');
    expect(formatDurationWords(89 * 60, t)).toBe('1 h 29 min');
    expect(formatDurationWords(-5, t)).toBe('0 min');
    expect(formatDurationWords(undefined, t)).toBe('0 min');
  });
});

describe('the bar and the list', () => {
  it('fills the bar by the share done, never past the end and never below the start', () => {
    expect(barWidth({ progress: 30, target: 60 })).toBe(50);
    expect(barWidth({ progress: 90, target: 60 })).toBe(100);
    expect(barWidth({ progress: 0, target: 60 })).toBe(0);
    expect(barWidth({ progress: -4, target: 60 })).toBe(0);
    expect(barWidth({ progress: 5, target: 0 })).toBe(0);
    expect(barWidth(null)).toBe(0);
  });

  it('lists the goals by period and then by metric, whatever order they come in', () => {
    const goals = [
      { id: 1, period: 'YEAR', metric: 'DISTANCE' },
      { id: 2, period: 'WEEK', metric: 'ELEVATION' },
      { id: 3, period: 'WEEK', metric: 'DISTANCE' },
      { id: 4, period: 'MONTH', metric: 'COUNT' },
      { id: 5, period: 'WEEK', metric: 'TIME' },
    ];

    expect(sortGoals(goals).map((goal) => goal.id)).toEqual([3, 5, 2, 4, 1]);
    expect(goals.map((goal) => goal.id)).toEqual([1, 2, 3, 4, 5]);
    expect(sortGoals(undefined)).toEqual([]);
  });

  it('knows whether a goal for a period and metric is already there', () => {
    const goals = [{ period: 'WEEK', metric: 'DISTANCE' }];
    expect(hasGoal(goals, 'WEEK', 'DISTANCE')).toBe(true);
    expect(hasGoal(goals, 'WEEK', 'COUNT')).toBe(false);
    expect(hasGoal(goals, 'MONTH', 'DISTANCE')).toBe(false);
    expect(hasGoal(undefined, 'WEEK', 'DISTANCE')).toBe(false);
  });

  it('starts a new goal on the first period and metric that is free, weekly distance first', () => {
    expect(firstFree([])).toEqual({ period: 'WEEK', metric: 'DISTANCE' });
    expect(firstFree(undefined)).toEqual({ period: 'WEEK', metric: 'DISTANCE' });
    expect(firstFree([{ period: 'WEEK', metric: 'DISTANCE' }])).toEqual({ period: 'WEEK', metric: 'TIME' });
    expect(firstFree([
      { period: 'WEEK', metric: 'DISTANCE' }, { period: 'WEEK', metric: 'TIME' }, { period: 'WEEK', metric: 'COUNT' }, { period: 'WEEK', metric: 'ELEVATION' },
    ])).toEqual({ period: 'MONTH', metric: 'DISTANCE' });
    const all = PERIODS.flatMap((period) => METRICS.map((metric) => ({ period, metric })));
    expect(firstFree(all)).toEqual({ period: 'WEEK', metric: 'DISTANCE' });
    expect(firstFree(all.filter((goal) => !(goal.period === 'YEAR' && goal.metric === 'COUNT')))).toEqual({ period: 'YEAR', metric: 'COUNT' });
  });

  it('has the periods and the metrics the server has, in the same order', () => {
    expect(PERIODS).toEqual(['WEEK', 'MONTH', 'YEAR']);
    expect(METRICS).toEqual(['DISTANCE', 'TIME', 'COUNT', 'ELEVATION']);
  });
});

describe('the words for every goal exist in both languages', () => {
  it('has a title for each period and metric, and a word for each period', () => {
    for (const dictionary of [en, zh]) {
      for (const period of PERIODS) {
        expect(dictionary.goals[`in_${period}`]).toBeTruthy();
        expect(dictionary.goals[`last_${period}`]).toBeTruthy();
        expect(dictionary.goals[`period_${period}`]).toBeTruthy();
        expect(dictionary.goals[`period_word_${period}`]).toBeTruthy();
        for (const metric of METRICS) expect(dictionary.goals[`title_${period}_${metric}`]).toBeTruthy();
      }
      for (const status of ['reached', 'early', 'ahead', 'on_track', 'behind']) expect(dictionary.goals[`status_${status}`]).toBeTruthy();
      for (const metric of METRICS) expect(dictionary.goals[`metric_${metric}`]).toBeTruthy();
    }
  });
});
