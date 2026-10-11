// Answers of GET /api/training/log, shaped as the server sends them. Today is Saturday 10 October 2026.

let nextId = 100;

export function run(overrides = {}) {
  nextId += 1;
  return {
    id: nextId,
    name: `Run ${nextId}`,
    startTime: '2026-10-05T07:00:00',
    distanceKm: 5,
    movingSeconds: 1500,
    paceSecPerKm: 300,
    effort: 42.4,
    effortSource: 'HR_ZONES',
    elevationGainM: null,
    runType: null,
    tags: [],
    ...overrides,
  };
}

export function day(date, runs) {
  return { date, runs };
}

/** A week from its Monday; its totals are added up from its runs, the way the server does. */
export function week(start, days = []) {
  const first = new Date(`${start}T12:00:00`);
  const end = new Date(first);
  end.setDate(first.getDate() + 6);
  const pad = (value) => String(value).padStart(2, '0');
  const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const runs = days.flatMap((entry) => entry.runs);
  const sum = (pick) => runs.reduce((total, one) => total + (pick(one) || 0), 0);
  return {
    start,
    end: iso(end),
    runs: runs.length,
    distanceKm: Math.round(sum((one) => one.distanceKm) * 100) / 100,
    movingSeconds: sum((one) => one.movingSeconds),
    effort: Math.round(sum((one) => one.effort) * 10) / 10,
    elevationGainM: Math.round(sum((one) => one.elevationGainM) * 10) / 10,
    days,
  };
}

/** The usual three weeks: this one with three runs on two days, an empty one and one with a run that is not analysed. */
export function threeWeeks() {
  return [
    week('2026-10-05', [
      day('2026-10-05', [
        run({ id: 11, name: 'Morning jog', distanceKm: 5, movingSeconds: 1500, paceSecPerKm: 300, effort: 42.4, tags: ['easy'] }),
        run({ id: 12, name: 'Evening strides', distanceKm: 3, movingSeconds: 1000, paceSecPerKm: 333.3, effort: 20, tags: [] }),
      ]),
      day('2026-10-10', [
        run({ id: 13, name: 'City 10K', distanceKm: 10, movingSeconds: 2700, paceSecPerKm: 270, effort: 90.2, elevationGainM: 80, runType: 'RACE', tags: ['10k', 'PR'] }),
      ]),
    ]),
    week('2026-09-28', []),
    week('2026-09-21', [
      day('2026-09-24', [
        run({ id: 14, name: 'Hill repeats', distanceKm: 6, movingSeconds: 2100, paceSecPerKm: 350, effort: null, effortSource: null, runType: 'WORKOUT', tags: ['hills'] }),
      ]),
    ]),
  ];
}

export function log({
  weeks = threeWeeks(), olderRuns = true, runTypes = ['RACE', 'WORKOUT'], tags = [{ tag: 'easy', runs: 5 }, { tag: 'hills', runs: 2 }, { tag: '10k', runs: 1 }],
  today = '2026-10-10', timeZone = 'Z',
} = {}) {
  const from = weeks.length ? weeks[weeks.length - 1].start : today;
  const to = weeks.length ? weeks[0].end : today;
  return { today, timeZone, from, to, weeks, olderRuns, runTypes, tags };
}

/** Twelve empty weeks ending with the week of `start`, going back. */
export function emptyWeeks(start = '2026-10-05', count = 12) {
  return Array.from({ length: count }, (_, index) => {
    const first = new Date(`${start}T12:00:00`);
    first.setDate(first.getDate() - 7 * index);
    const pad = (value) => String(value).padStart(2, '0');
    return week(`${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`, []);
  });
}
