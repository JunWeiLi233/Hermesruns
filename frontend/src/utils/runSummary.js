/**
 * Puts the findings of GET /api/activities/{id}/summary into words (see docs/README-ANALYSIS.md, "Run Summary"). The server
 * sends what it found, the numbers it was worked out from and the thresholds of the rule; this writes each as a sentence in
 * the runner's language and distance unit, with the numbers (the working) and the rule to show when asked. Pure, so every
 * sentence and every figure can be tested without a browser.
 */
import { formatShortDate } from './fitnessChart';
import { formatDistance, getDistanceUnitLabel } from './format';
import { clockText, paceText } from './trainingLog';

const KM_PER_MILE = 1.609344;
/** What the headline says when it could not tell, if the server did not send the numbers behind that. */
const UNCLEAR_MINUTES = 10;
const UNCLEAR_RUNS = 5;

/** Whether an answer has the parts the card draws. Anything else is treated as a failed load, not drawn half. */
export function isRunSummary(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.findings)) return false;
  if (data.state !== 'ready' && data.state !== 'none') return false;
  if (data.state === 'ready' && data.findings.length === 0) return false;
  return data.findings.every((finding) => finding && typeof finding === 'object'
    && typeof finding.id === 'string' && typeof finding.variant === 'string'
    && finding.facts && typeof finding.facts === 'object');
}

/** The figures of one language and distance unit: each writes a number the way the log writes it. */
function figures({ t, lang, unit, formatNumber }) {
  const per = getDistanceUnitLabel(lang, unit);
  const perUnit = (value) => (unit === 'mile' ? value * KM_PER_MILE : value);
  const num = (value, digits = 0) => formatNumber(Number(Number(value).toFixed(digits)));
  const signed = (value, digits = 0) => (value > 0 ? '+' : value < 0 ? '−' : '') + num(Math.abs(value), digits);
  return {
    num,
    pace: (secPerKm) => {
      const text = paceText(secPerKm, unit);
      return text === '–' ? text : `${text} /${per}`;
    },
    km: (km) => formatDistance(km, 1, lang, unit),
    clock: (seconds) => clockText(seconds),
    minutes: (value) => t('run_summary.minutes', { count: num(value) }),
    secPer: (seconds) => t('run_summary.seconds_per', { count: num(Math.abs(perUnit(seconds))), unit: per }),
    signedSecPer: (seconds) => t('run_summary.seconds_per', { count: signed(perUnit(seconds)), unit: per }),
    percent: (value, digits = 0) => `${num(value, digits)}%`,
    signedPercent: (value, digits = 1) => `${signed(value, digits)}%`,
    metres: (value) => `${num(value)} m`,
    metresPer: (value) => `${num(perUnit(value), 1)} m/${per}`,
    ratio: (value) => `${num(value, 2)}×`,
    bpm: (value) => t('run_summary.bpm', { count: num(value) }),
    day: (iso) => formatShortDate(iso, lang),
    signed,
    per,
  };
}

/**
 * Each kind of finding writes itself: a sentence, the numbers it came from, and the rule that decided it. `f` is the
 * finding's facts, `th` its thresholds, `x` the figures, `t` the language.
 */
const DESCRIBE = {
  character(finding, f, th, x, t) {
    const runTypeRows = [['fact_distance', x.km(f.distanceKm)], ['fact_moving_time', x.clock(f.movingSeconds)]];
    if (finding.variant === 'race' || finding.variant === 'workout') {
      return { sentence: `s_character_${finding.variant}`, params: {}, rows: runTypeRows, rule: 'r_character_run_type', ruleParams: {} };
    }
    if (finding.variant === 'changes') {
      return {
        sentence: 's_character_changes',
        params: { fastest: x.pace(f.fastestPaceSecPerKm), slowest: x.pace(f.slowestPaceSecPerKm) },
        rows: [
          ['fact_fastest_km', x.pace(f.fastestPaceSecPerKm)],
          ['fact_slowest_km', x.pace(f.slowestPaceSecPerKm)],
          ['fact_variation', x.percent(f.variationPercent, 1)],
          ['fact_kilometres', x.num(f.splits)],
          ['fact_basis', t(f.basis === 'grade_adjusted' ? 'run_summary.basis_grade_adjusted' : 'run_summary.basis_pace')],
        ],
        rule: 'r_character_changes',
        ruleParams: { percent: x.num(th.variationPercent), splits: x.num(th.minSplits) },
      };
    }
    if (f.basis === 'zones') {
      const zones = Array.isArray(f.zonePercents) ? f.zonePercents : [];
      // Where most of the time went: the first zone when two are level.
      const top = zones.reduce((best, percent, index) => (percent > best.percent ? { percent, zone: index + 1 } : best), { percent: -1, zone: 1 });
      return {
        sentence: `s_character_${finding.variant}_zones`,
        params: { easy: x.num(f.easyPercent), hard: x.num(f.hardPercent), zone: x.num(top.zone), percent: x.num(top.percent) },
        rows: [
          ...zones.map((percent, index) => [t('run_summary.fact_zone', { n: index + 1 }), x.percent(percent)]),
          ['fact_heart_rate_time', x.minutes(f.heartRateMinutes)],
        ],
        rule: 'r_character_zones',
        ruleParams: { hard: x.num(th.hardPercent), easy: x.num(th.easyPercent), minutes: x.num(th.minHeartRateMinutes) },
      };
    }
    if (f.basis === 'effort') {
      return {
        sentence: `s_character_${finding.variant}_effort`,
        params: { effort: x.num(f.effort), usual: x.num(f.usualEffort) },
        rows: [
          ['fact_effort', x.num(f.effort, 1)],
          ['fact_usual_effort', x.num(f.usualEffort, 1)],
          ['fact_ratio', x.ratio(f.ratio)],
          ['fact_runs_compared', x.num(f.count)],
        ],
        rule: 'r_character_effort',
        ruleParams: { higher: x.num(th.higherRatio, 2), lower: x.num(th.lowerRatio, 2), days: x.num(th.windowDays) },
      };
    }
    return {
      sentence: 's_character_unclear',
      params: {},
      rows: runTypeRows,
      rule: 'r_character_unclear',
      ruleParams: { minutes: x.num(th.minHeartRateMinutes ?? UNCLEAR_MINUTES), runs: x.num(th.minRuns ?? UNCLEAR_RUNS) },
    };
  },

  longest(finding, f, th, x) {
    return {
      sentence: 's_longest_longest',
      params: { days: x.num(f.windowDays), distance: x.km(f.distanceKm), previous: x.km(f.previousLongestKm) },
      rows: [
        ['fact_distance', x.km(f.distanceKm)],
        ['fact_previous_longest', x.km(f.previousLongestKm)],
        ['fact_runs_compared', x.num(f.count)],
        ['fact_window', x.num(f.windowDays)],
      ],
      rule: 'r_longest',
      ruleParams: { days: x.num(th.windowDays), minRuns: x.num(th.minRuns), minKm: x.km(th.minKm) },
    };
  },

  effort(finding, f, th, x, t) {
    const scope = t(`run_summary.scope_${f.scope === 'workouts' ? 'workouts' : 'similar_length'}`);
    const rows = [
      ['fact_effort', x.num(f.effort, 1)],
      ['fact_usual_effort', x.num(f.usualEffort, 1)],
      ['fact_ratio', x.ratio(f.ratio)],
      ['fact_runs_compared', x.num(f.count)],
      ['fact_compared_with', scope],
      ['fact_window', x.num(f.windowDays)],
    ];
    if (finding.variant === 'hardest') rows.splice(4, 0, ['fact_highest_before', x.num(f.highestBefore, 1)]);
    return {
      sentence: `s_effort_${finding.variant}`,
      params: { effort: x.num(f.effort), usual: x.num(f.usualEffort), scope, count: x.num(f.count) },
      rows,
      rule: f.scope === 'workouts' ? 'r_effort_workouts' : 'r_effort',
      ruleParams: {
        higher: x.num(th.higherRatio, 2), lower: x.num(th.lowerRatio, 2), minRuns: x.num(th.minRuns), recordMinRuns: x.num(th.recordMinRuns),
        days: x.num(th.windowDays), from: x.num(th.lengthFromPercent), to: x.num(th.lengthToPercent),
      },
    };
  },

  drift(finding, f, th, x) {
    return {
      sentence: `s_drift_${finding.variant}`,
      params: { first: x.num(f.firstHalfHeartRate), second: x.num(f.secondHalfHeartRate), percent: x.num(f.driftPercent, 1) },
      rows: [
        ['fact_drift', x.signedPercent(f.driftPercent)],
        ['fact_heart_rate_first', x.bpm(f.firstHalfHeartRate)],
        ['fact_heart_rate_second', x.bpm(f.secondHalfHeartRate)],
        ['fact_run_length', x.minutes(f.minutes)],
      ],
      rule: 'r_drift',
      ruleParams: { moderate: x.num(th.moderatePercent), high: x.num(th.highPercent), minutes: x.num(th.minMinutes) },
    };
  },

  shape(finding, f, th, x, t) {
    return {
      sentence: `s_shape_${finding.variant}`,
      params: { seconds: x.secPer(f.deltaSeconds), first: x.pace(f.firstHalfPaceSecPerKm), second: x.pace(f.secondHalfPaceSecPerKm) },
      rows: [
        ['fact_first_half', x.pace(f.firstHalfPaceSecPerKm)],
        ['fact_second_half', x.pace(f.secondHalfPaceSecPerKm)],
        ['fact_difference', `${x.signedSecPer(f.deltaSeconds)} (${x.signedPercent(f.deltaPercent)})`],
        ['fact_kilometres_per_half', x.num(f.splitsPerHalf)],
        ['fact_fastest_km', x.pace(f.fastestPaceSecPerKm)],
        ['fact_slowest_km', x.pace(f.slowestPaceSecPerKm)],
        ['fact_basis', t(f.basis === 'grade_adjusted' ? 'run_summary.basis_grade_adjusted' : 'run_summary.basis_pace')],
      ],
      rule: 'r_shape',
      ruleParams: { band: x.num(th.bandPercent), minSplits: x.num(th.minSplits), variation: x.num(th.variationPercent) },
    };
  },

  pace(finding, f, th, x) {
    return {
      sentence: `s_pace_${finding.variant}`,
      params: { pace: x.pace(f.paceSecPerKm), recent: x.pace(f.recentPaceSecPerKm), count: x.num(f.count), days: x.num(f.windowDays) },
      rows: [
        ['fact_pace', x.pace(f.paceSecPerKm)],
        ['fact_recent_pace', x.pace(f.recentPaceSecPerKm)],
        ['fact_difference', `${x.signedSecPer(f.deltaSeconds)} (${x.signedPercent(f.deltaPercent)})`],
        ['fact_runs_compared', x.num(f.count)],
        ['fact_window', x.num(f.windowDays)],
        ['fact_length_range', `${x.km(f.fromKm)} – ${x.km(f.toKm)}`],
      ],
      rule: 'r_pace',
      ruleParams: { band: x.num(th.bandPercent), minRuns: x.num(th.minRuns), days: x.num(th.windowDays), from: x.num(th.lengthFromPercent), to: x.num(th.lengthToPercent) },
    };
  },

  form(finding, f, th, x) {
    return {
      sentence: `s_form_${finding.variant}`,
      params: { form: x.signed(f.form), day: x.day(f.day) },
      rows: [
        ['fact_form', x.signed(f.form, 1)],
        ['fact_fitness', x.num(f.fitness, 1)],
        ['fact_fatigue', x.num(f.fatigue, 1)],
        ['fact_day', x.day(f.day)],
      ],
      rule: 'r_form',
      ruleParams: { band: x.num(th.bandPercent), swing: x.num(th.minSwing) },
    };
  },

  climb(finding, f, th, x) {
    const adjusted = Number.isFinite(f.gradeAdjustedPaceSecPerKm) && Number.isFinite(f.paceSecPerKm);
    const rows = [['fact_climb', x.metres(f.climbMetres)], ['fact_climb_rate', x.metresPer(f.metresPerKm)]];
    if (adjusted) rows.push(['fact_pace', x.pace(f.paceSecPerKm)], ['fact_adjusted_pace', x.pace(f.gradeAdjustedPaceSecPerKm)]);
    return {
      sentence: adjusted ? 's_climb_hilly_gap' : 's_climb_hilly',
      params: {
        climb: x.metres(f.climbMetres),
        perKm: x.metresPer(f.metresPerKm),
        pace: adjusted ? x.pace(f.paceSecPerKm) : '',
        gap: adjusted ? x.pace(f.gradeAdjustedPaceSecPerKm) : '',
      },
      rows,
      rule: 'r_climb',
      ruleParams: { hilly: x.metresPer(th.hillyMetresPerKm), diff: x.secPer(th.paceDifferenceSeconds) },
    };
  },
};

/**
 * The findings as the card shows them: the headline first, then the lines in the order the server sent, each a sentence with
 * the numbers it came from and the rule that decided it. A finding of a kind this build does not know is left out, so a
 * newer server cannot break an older page.
 *
 * @param ctx { t, lang, unit, formatNumber }
 */
export function describeSummary(summary, ctx) {
  const x = figures(ctx);
  const { t } = ctx;
  const items = [];
  for (const finding of summary.findings) {
    const describe = DESCRIBE[finding.id];
    if (!describe) continue;
    const facts = finding.facts ?? {};
    const thresholds = finding.thresholds ?? {};
    const text = describe(finding, facts, thresholds, x, t);
    items.push({
      key: `${finding.id}:${finding.variant}`,
      id: finding.id,
      variant: finding.variant,
      tone: finding.tone,
      headline: finding.id === 'character',
      text: t(`run_summary.${text.sentence}`, text.params),
      working: {
        rows: text.rows.map(([label, value]) => ({ label: label.startsWith('fact_') ? t(`run_summary.${label}`) : label, value })),
        rule: t(`run_summary.${text.rule}`, text.ruleParams),
      },
    });
  }
  return { state: summary.state, reason: summary.reason ?? null, items };
}
