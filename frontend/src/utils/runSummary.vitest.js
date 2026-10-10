import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import * as fx from '../pages/runs/__tests__/runSummaryFixtures';
import { describeSummary, isRunSummary } from './runSummary';

const dictionaries = { en, 'zh-CN': zh };
const makeT = (lang) => (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionaries[lang]) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
const ctx = (lang = 'en', unit = 'km') => ({
  t: makeT(lang), lang, unit, formatNumber: (value) => new Intl.NumberFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US').format(value),
});

/** The one item of a summary of one finding. */
const describe1 = (finding, lang, unit) => describeSummary(fx.summary([finding]), ctx(lang, unit)).items[0];
const rows = (item) => Object.fromEntries(item.working.rows.map((row) => [row.label, row.value]));

describe('whether an answer is a summary', () => {
  it('accepts a ready summary with findings and a summary of nothing to say', () => {
    expect(isRunSummary(fx.fullSummary())).toBe(true);
    expect(isRunSummary(fx.tooShort())).toBe(true);
  });

  it.each([
    ['nothing', null],
    ['a string', 'ready'],
    ['no findings', { state: 'ready' }],
    ['findings that are not a list', { state: 'ready', findings: 'none' }],
    ['a state it does not know', { state: 'maybe', findings: [] }],
    ['a ready summary with no headline', { state: 'ready', findings: [] }],
    ['a finding with no id', { state: 'ready', findings: [{ variant: 'x', facts: {} }] }],
    ['a finding with no variant', { state: 'ready', findings: [{ id: 'x', facts: {} }] }],
    ['a finding with no facts', { state: 'ready', findings: [{ id: 'x', variant: 'y' }] }],
    ['a finding that is null', { state: 'ready', findings: [null] }],
  ])('refuses %s, so the card says it failed rather than drawing half of it', (_name, data) => {
    expect(isRunSummary(data)).toBe(false);
  });
});

describe('the headline', () => {
  it('says a race or a workout is what the runner called it and not judged', () => {
    const race = describe1(fx.race);
    expect(race.text).toBe('You marked this run as a race, so it is not judged against your training.');
    expect(race.headline).toBe(true);
    expect(rows(race)).toEqual({ Distance: '21.1 km', 'Moving time': '1:30:00' });
    expect(race.working.rule).toBe('Taken from the run type you set. A race or a workout is not judged against your usual runs.');
    expect(describe1(fx.workout).text).toBe('You marked this run as a workout, so it is not called easy or steady.');
  });

  it('says what the kilometres did when they vary too much for one steady effort, and shows them', () => {
    const item = describe1(fx.changes);

    expect(item.text).toBe('A run with changes of pace: your kilometres went from 3:30 /km to 5:30 /km, so it was not one steady effort.');
    expect(rows(item)).toEqual({
      'Fastest kilometre': '3:30 /km', 'Slowest kilometre': '5:30 /km', 'Variation between kilometres': '22.2%', 'Kilometres counted': '6', 'Paces used': 'Pace on the clock',
    });
    expect(item.working.rule).toContain('more than 10%');
    expect(item.working.rule).toContain('at least 4 kilometres');
  });

  it('says easy, moderate or hard from the zones, with the share of each zone behind it', () => {
    const easy = describe1(fx.zonesEasy);
    expect(easy.text).toBe('An easy run: 90% of your time with heart rate was in zones 1 and 2.');
    expect(rows(easy)).toEqual({
      'Zone 1': '30%', 'Zone 2': '60%', 'Zone 3': '7%', 'Zone 4': '2%', 'Zone 5': '1%', 'Time with heart rate': '33 min',
    });
    expect(easy.working.rule).toBe('Hard when zones 4 and 5 hold 30% or more of the time with heart rate; easy when zones 1 and 2 hold 70% or more; otherwise moderate. Needs 10 minutes of heart rate.');
    expect(describe1(fx.zonesModerate).text).toBe('A moderate run: you spent the most time in zone 2 (40% of your time with heart rate).');
    // Level zones: the first of them is named.
    const level = { ...fx.zonesModerate, facts: { ...fx.zonesModerate.facts, zonePercents: [10, 30, 30, 20, 10] } };
    expect(describe1(level).text).toBe('A moderate run: you spent the most time in zone 2 (30% of your time with heart rate).');
    const third = { ...fx.zonesModerate, facts: { ...fx.zonesModerate.facts, zonePercents: [5, 30, 45, 15, 5] } };
    expect(describe1(third).text).toBe('A moderate run: you spent the most time in zone 3 (45% of your time with heart rate).');
    expect(describe1(fx.zonesHard).text).toBe('A hard run: 55% of your time with heart rate was in zones 4 and 5.');
  });

  it('says easy, ordinary or hard for the runner when it had to go on the effort, with the usual and the runs it is from', () => {
    const item = describe1(fx.effortEasy);

    expect(item.text).toBe('An easy run for you: effort 50, against a usual 80.');
    expect(rows(item)).toEqual({ 'Effort of this run': '50', 'Your usual effort': '80', 'This run against usual': '0.63×', 'Runs compared': '6' });
    expect(item.working.rule).toContain('1.25 times your usual or more');
    expect(item.working.rule).toContain('0.75 times or less');
    expect(item.working.rule).toContain('last 90 days');
  });

  it('says it cannot tell, and what it would need, when there is too little to go on', () => {
    const item = describe1(fx.unclear);

    expect(item.text).toBe('There is too little heart rate or history to say how hard this run was.');
    expect(item.working.rule).toBe('Needs 10 minutes of heart rate, or at least 5 earlier runs of about this length to compare the effort with.');
    const withNumbers = describe1({ ...fx.unclear, thresholds: { minHeartRateMinutes: 12, minRuns: 7 } });
    expect(withNumbers.working.rule).toContain('12 minutes');
    expect(withNumbers.working.rule).toContain('7 earlier runs');
  });
});

describe('the lines', () => {
  it('says the longest run of a stretch, against the longest before it', () => {
    const item = describe1(fx.longest);

    expect(item.text).toBe('Your longest run in 28 days: 12.0 km, against 10.0 km for the longest before it.');
    expect(item.headline).toBe(false);
    expect(item.tone).toBe('positive');
    expect(rows(item)).toEqual({ Distance: '12.0 km', 'Longest before': '10.0 km', 'Runs compared': '8', 'Days looked back': '28' });
    expect(item.working.rule).toBe('Longer than every other run in the last 28 days, workouts left out. Needs at least 4 of them, and a run of 5.0 km or more.');
  });

  it('says how the effort compares with the usual one for the kind of run, and what was compared', () => {
    const hardest = describe1(fx.effortHardest);
    expect(hardest.text).toBe('The hardest of your last 10 runs of about this length: effort 120, against a usual 80.');
    expect(rows(hardest)).toEqual({
      'Effort of this run': '120', 'Your usual effort': '80', 'This run against usual': '1.5×', 'Runs compared': '10',
      'Highest effort before': '95', 'Compared with': 'runs of about this length', 'Days looked back': '90',
    });
    expect(hardest.working.rule).toContain('70% to 140% of this distance');
    expect(hardest.working.rule).toContain('The hardest needs 8 runs');

    expect(describe1(fx.effortHigher).text).toBe('Harder than usual: effort 100, against a usual 80 for runs of about this length.');
    expect(rows(describe1(fx.effortHigher))).not.toHaveProperty('Highest effort before');
    const workouts = describe1(fx.effortWorkouts);
    expect(workouts.text).toBe('Easier than usual: effort 60, against a usual 90 for workouts.');
    expect(workouts.working.rule).toContain('earlier workouts, of any length');
    expect(workouts.working.rule).toContain('at least 3 needed');
    expect(describe1({ ...fx.effortHigher, variant: 'typical' }).text).toBe('About as hard as usual: effort 100, against a usual 80 for runs of about this length.');
  });

  it('says the heart rate drifted, a lot, a little or not at all, with the heart rate of each half', () => {
    const high = describe1(fx.driftHigh);
    expect(high.text).toBe('Your heart rate rose a lot for the same pace: 140 bpm in the first half, 152 bpm in the second (efficiency down 12.3%).');
    expect(rows(high)).toEqual({ 'Efficiency change': '+12.3%', 'Heart rate, first half': '140 bpm', 'Heart rate, second half': '152 bpm', 'Length of the run': '50 min' });
    expect(high.working.rule).toContain('more than 5%');
    expect(high.working.rule).toContain('more than 10%');
    expect(describe1(fx.driftLow).text).toBe('Your heart rate stayed steady for the pace: 140 bpm in the first half, 142 bpm in the second.');
    expect(describe1({ ...fx.driftHigh, variant: 'moderate' }).text).toContain('rose a little');
  });

  it('says how the run was paced: sped up, slowed down or even, in pace per kilometre', () => {
    const negative = describe1(fx.shapeNegative);
    expect(negative.text).toBe('You sped up: the second half was 7 s/km faster than the first (5:00 /km, then 4:53 /km).');
    expect(rows(negative)).toEqual({
      'Pace, first half': '5:00 /km', 'Pace, second half': '4:53 /km', Difference: '−7 s/km (−2.3%)', 'Kilometres in each half': '2',
      'Fastest kilometre': '4:50 /km', 'Slowest kilometre': '5:05 /km', 'Paces used': 'Pace adjusted for the hills',
    });
    expect(describe1(fx.shapeFaded).text).toBe('You slowed down: the second half was 12 s/km slower than the first (5:00 /km, then 5:12 /km).');
    expect(describe1(fx.shapeEven).text).toBe('Evenly paced: 5:00 /km in the first half and 5:01 /km in the second.');
    expect(rows(describe1(fx.shapeFaded)).Difference).toBe('+12 s/km (+4%)');
    expect(negative.working.rule).toContain('2% or more apart counts');
  });

  it('says whether the pace was faster, slower or about the same as the recent runs, and which ones', () => {
    const faster = describe1(fx.paceFaster);
    expect(faster.text).toBe('Faster than your recent runs: 4:30 /km, against 5:00 /km across 6 runs of this length in the last 30 days.');
    expect(rows(faster)).toEqual({
      'Pace of this run': '4:30 /km', 'Pace of your recent runs': '5:00 /km', Difference: '−30 s/km (−10%)', 'Runs compared': '6',
      'Days looked back': '30', 'Lengths compared': '7.0 km – 14.0 km',
    });
    expect(faster.working.rule).toContain('70% to 140% of this distance');
    expect(faster.working.rule).toContain('workouts and races left out');
    expect(describe1(fx.paceSlower).text).toBe('Slower than your recent runs: 5:30 /km, against 5:00 /km across 6 runs of this length in the last 30 days.');
    expect(describe1(fx.paceSimilar).text).toBe('About the pace of your recent runs: 5:01 /km, against 5:00 /km across 6 runs of this length in the last 30 days.');
  });

  it('says how fresh the runner was going in, with the numbers and the day', () => {
    const fresh = describe1(fx.formFresh);
    expect(fresh.text).toBe('You started fresh: your form was +20 the day before.');
    expect(rows(fresh)).toEqual({ 'Form the day before': '+20', Fitness: '100', Fatigue: '80', Day: 'Mar 14' });
    const tired = describe1(fx.formTired);
    expect(tired.text).toBe('You started tired: your form was −26 the day before.');
    expect(rows(tired)['Form the day before']).toBe('−25.5');
    expect(tired.working.rule).toContain('above 10% of fitness');
    expect(tired.working.rule).toContain('under 3 points');
  });

  it('says a run was hilly, and the adjusted pace only when the server had one to mention', () => {
    const plain = describe1(fx.climbPlain);
    expect(plain.text).toBe('A hilly run: 200 m of climbing, 20 m/km.');
    expect(rows(plain)).toEqual({ Climb: '200 m', 'Climb per distance': '20 m/km' });

    const adjusted = describe1(fx.climbAdjusted);
    expect(adjusted.text).toBe('A hilly run: 200 m of climbing (20 m/km). Adjusted for the hills your pace was 5:02 /km, against 5:31 /km on the clock.');
    expect(rows(adjusted)).toEqual({
      Climb: '200 m', 'Climb per distance': '20 m/km', 'Pace of this run': '5:31 /km', 'Pace adjusted for the hills': '5:02 /km',
    });
    expect(adjusted.working.rule).toBe('Called hilly from 12 m/km of climb. The adjusted pace is mentioned when it is 5 s/km or more from the pace on the clock.');
  });
});

describe('miles', () => {
  it('writes paces, differences and distances in miles for a runner who counts in miles', () => {
    expect(describe1(fx.paceFaster, 'en', 'mile').text).toBe('Faster than your recent runs: 7:15 /mi, against 8:03 /mi across 6 runs of this length in the last 30 days.');
    expect(rows(describe1(fx.paceFaster, 'en', 'mile'))).toMatchObject({ Difference: '−48 s/mi (−10%)', 'Lengths compared': '4.3 mi – 8.7 mi' });
    expect(describe1(fx.shapeNegative, 'en', 'mile').text).toBe('You sped up: the second half was 11 s/mi faster than the first (8:03 /mi, then 7:52 /mi).');
    expect(describe1(fx.longest, 'en', 'mile').text).toBe('Your longest run in 28 days: 7.5 mi, against 6.2 mi for the longest before it.');
    expect(describe1(fx.climbPlain, 'en', 'mile').text).toBe('A hilly run: 200 m of climbing, 32.2 m/mi.');
  });
});

describe('in Chinese', () => {
  it('words the headline, a line and the working in Chinese with the same figures', () => {
    const headline = describe1(fx.zonesEasy, 'zh-CN');
    expect(headline.text).toBe('轻松的一次跑：在有心率的时间里，90% 处于 1、2 区。');
    expect(rows(headline)).toMatchObject({ '1 区': '30%', '2 区': '60%', 有心率的时间: '33 分钟' });
    expect(headline.working.rule).toContain('4、5 区合计占有心率时间的 30% 以上为高强度');

    const pace = describe1(fx.paceFaster, 'zh-CN');
    expect(pace.text).toBe('比你最近的跑步更快：4:30 /公里，最近 30 天内 6 次距离相近的跑步为 5:00 /公里。');
    expect(rows(pace)).toMatchObject({ 差值: '−30 秒/公里 (−10%)', 参与比较的跑步: '6' });

    expect(describe1(fx.formTired, 'zh-CN').text).toBe('开跑时比较疲惫：前一天的状态值为 −26。');
    expect(describe1(fx.shapeFaded, 'zh-CN').text).toBe('后程变慢：后半程比前半程慢 12 秒/公里（先 5:00 /公里，后 5:12 /公里）。');
  });
});

describe('the summary as a whole', () => {
  it('has the headline first, then the lines in the order sent, each with a distinct key', () => {
    const model = describeSummary(fx.fullSummary(), ctx());

    expect(model.state).toBe('ready');
    expect(model.reason).toBeNull();
    expect(model.items.map((item) => item.id)).toEqual(['character', 'longest', 'effort', 'shape', 'pace']);
    expect(model.items.map((item) => item.headline)).toEqual([true, false, false, false, false]);
    expect(new Set(model.items.map((item) => item.key)).size).toBe(5);
    expect(model.items.every((item) => item.working.rows.length > 0 && item.working.rule.length > 0)).toBe(true);
  });

  it('says why when there is nothing to say', () => {
    const model = describeSummary(fx.tooShort(), ctx());

    expect(model).toEqual({ state: 'none', reason: 'too_short', items: [] });
  });

  it('leaves out a finding of a kind it does not know, so a newer server cannot break an older page', () => {
    const model = describeSummary(fx.summary([fx.zonesEasy, { id: 'sleep', variant: 'poor', tone: 'neutral', weight: 2, facts: {}, thresholds: {} }, fx.longest]), ctx());

    expect(model.items.map((item) => item.id)).toEqual(['character', 'longest']);
  });
});
