function localDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) || dateKey(date) !== value ? null : date;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mondayOf(date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function summarizeStrengthActivity(checkIns, referenceDate) {
  const today = localDate(referenceDate) || new Date();
  const currentWeek = mondayOf(today);
  const completedDates = new Set();
  const activeWeeks = new Set();
  for (const entry of Array.isArray(checkIns) ? checkIns : []) {
    const date = localDate(entry?.trainingDate);
    if (entry?.entryState !== 'ACTUAL' || !date || date > today) continue;
    completedDates.add(entry.trainingDate);
    activeWeeks.add(dateKey(mondayOf(date)));
  }
  const completedThisWeek = [...completedDates].filter((key) => localDate(key) >= currentWeek).length;
  const streakWeek = new Date(currentWeek);
  // Keep last week's streak available until this week has a completed session.
  if (!activeWeeks.has(dateKey(streakWeek))) streakWeek.setDate(streakWeek.getDate() - 7);
  let streakWeeks = 0;
  while (activeWeeks.has(dateKey(streakWeek))) {
    streakWeeks += 1;
    streakWeek.setDate(streakWeek.getDate() - 7);
  }
  return { completedDates, completedThisWeek, streakWeeks };
}

const COVERAGE_AREAS = [
  { key: 'legs', match: /quad|hamstring|leg|股|腘|腿/i },
  { key: 'hips', match: /hip|glute|臀|髋/i },
  { key: 'calves', match: /foot|feet|calf|calves|ankle|tibialis|小腿|腓肠|比目鱼|跟腱|胫|踝|足/i },
  { key: 'core', match: /core|abs|oblique|trunk|plank|dead bug|腹|核心|躯干/i },
  { key: 'upper', match: /chest|pec|back|lats|latissimus|scapula|shoulder|deltoid|arm|biceps|triceps|grip|carry|胸|背|肩|臂|握/i },
];

export function buildStrengthWeekCoverage(days, musclesForItem) {
  return COVERAGE_AREAS.map((area) => ({
    key: area.key,
    sessions: days.filter((day) => day.items.some((item) => {
      const muscles = musclesForItem(item);
      return area.match.test([item.exercise?.name, ...muscles].filter(Boolean).join(' '));
    })).length,
  }));
}
