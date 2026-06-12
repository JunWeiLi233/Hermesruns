function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getConsecutiveRunDayStreak(runs) {
  const sortedDays = [...new Set(
    runs
      .map((run) => new Date(run.startTime || run.startDate || 0))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()),
  )].sort((a, b) => b - a);

  if (sortedDays.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i += 1) {
    const diffDays = Math.round((sortedDays[i - 1] - sortedDays[i]) / 86400000);
    if (diffDays === 1) streak += 1;
    else break;
  }
  return streak;
}

export function getConsecutiveRunWeekStreak(runs) {
  const sortedWeeks = [...new Set(
    runs
      .map((run) => new Date(run.startTime || run.startDate || 0))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => startOfWeek(date).getTime()),
  )].sort((a, b) => b - a);

  if (sortedWeeks.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < sortedWeeks.length; i += 1) {
    const diffWeeks = Math.round((sortedWeeks[i - 1] - sortedWeeks[i]) / (7 * 86400000));
    if (diffWeeks === 1) streak += 1;
    else break;
  }
  return streak;
}

export function countRewardKeywordRuns(runs, pattern) {
  return runs.reduce((total, run) => {
    const haystack = `${run.name || ''} ${run.title || ''} ${run.description || ''}`;
    return total + (pattern.test(haystack) ? 1 : 0);
  }, 0);
}

function numberValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function distanceKm(run) {
  return numberValue(run.distanceKm ?? run.distance ?? run.distance_km);
}

function elevationM(run) {
  return numberValue(
    run.elevationGainM
    ?? run.totalElevationGainM
    ?? run.elevationGain
    ?? run.elevationMeters,
  );
}

const THEME_METRICS = [
  { metric: 'themeMorning', pattern: /morning|sunrise|dawn|晨跑|清晨|早晨/i },
  { metric: 'themeNight', pattern: /night|evening|moon|after dark|夜跑|晚上|傍晚/i },
  { metric: 'themeRain', pattern: /rain|storm|shower|wet|雨|暴雨/i },
  { metric: 'themeHeat', pattern: /heat|hot|summer|humid|高温|炎热|夏/i },
  { metric: 'themeSnow', pattern: /snow|ice|winter|frost|雪|冰|冬/i },
  { metric: 'themeTrail', pattern: /trail|woods|forest|mountain|山路|越野|森林/i },
  { metric: 'themeTrack', pattern: /track|stadium|lap|400m|操场|田径场|跑道/i },
  { metric: 'themeTempo', pattern: /tempo|threshold|steady|节奏|阈值/i },
  { metric: 'themeIntervals', pattern: /interval|repeat|repeats|fartlek|间歇|变速/i },
  { metric: 'themeRecovery', pattern: /recovery|shakeout|easy recovery|恢复|放松/i },
  { metric: 'themeEasy', pattern: /easy|aerobic|zone 2|轻松|有氧/i },
  { metric: 'themeLong', pattern: /long run|long|LSD|长距离|长跑/i },
  { metric: 'themeRace', pattern: /race|time trial|tt|比赛|计时赛/i },
  { metric: 'themeMarathon', pattern: /marathon|42\.2|全马|马拉松/i },
  { metric: 'themeHalf', pattern: /half marathon|21\.1|half|半马/i },
  { metric: 'themeFiveK', pattern: /\b5k\b|5 km|5000|五公里|5公里/i },
  { metric: 'themeTenK', pattern: /\b10k\b|10 km|10000|十公里|10公里/i },
  { metric: 'themeHill', pattern: /hill|climb|grade|坡|爬升|爬坡/i },
  { metric: 'themeCommute', pattern: /commute|office|work|通勤|上班|下班/i },
  { metric: 'themeWaterfront', pattern: /waterfront|river|lake|coast|beach|江边|河边|湖边|海边/i },
];

export function getCatalogRewardStats(runs) {
  const safeRuns = Array.isArray(runs) ? runs : [];
  const stats = {
    runCount: safeRuns.length,
    longestRunKm: safeRuns.reduce((max, run) => Math.max(max, distanceKm(run)), 0),
    totalDistanceKm: safeRuns.reduce((total, run) => total + distanceKm(run), 0),
    totalElevationM: safeRuns.reduce((total, run) => total + elevationM(run), 0),
    streakDays: getConsecutiveRunDayStreak(safeRuns),
    streakWeeks: getConsecutiveRunWeekStreak(safeRuns),
  };

  for (const theme of THEME_METRICS) {
    stats[theme.metric] = countRewardKeywordRuns(safeRuns, theme.pattern);
  }

  return stats;
}

const singleRunRewards = [
  [1, 'First Kilometer', '第一公里'],
  [3, 'Three-K Spark', '三公里火花'],
  [5, 'Five-K Foundation', '五公里基石'],
  [8, 'Eight-K Settler', '八公里稳定器'],
  [10, 'Ten-K Standard', '十公里标准'],
  [12, 'Range Builder', '十二公里扩容'],
  [15, 'Long Door Open', '长距离之门'],
  [18, 'Endurance Line', '耐力边界'],
  [21.1, 'Half Marathon Ready', '半马就绪'],
  [25, 'Quarter-Century Route', '二十五公里路线'],
  [30, 'Deep Fuel Run', '三十公里补给线'],
  [32, 'Marathon Gate', '马拉松门槛'],
  [35, 'Wall Rehearsal', '撞墙预演'],
  [42.2, 'Marathon Distance', '全马距离'],
  [50, 'Ultra Signal', '超马信号'],
  [60, 'Beyond Roads', '路外六十'],
];

const lifetimeDistanceRewards = [
  [25, 'First Training Block', '第一训练块'],
  [50, 'City Loop Collector', '城市环线收藏家'],
  [100, 'Century Ledger', '百公里账本'],
  [150, 'Base Builder', '基础建造者'],
  [200, 'Two-Hundred Engine', '双百引擎'],
  [300, 'Three-Hundred Season', '三百公里赛季'],
  [421, 'Ten Marathon Bank', '十个全马储备'],
  [500, 'Five-Hundred Archive', '五百公里档案'],
  [750, 'Durability Bank', '耐久银行'],
  [1000, 'Thousand-K Club', '千公里俱乐部'],
  [1500, 'Continental Legs', '大陆级双腿'],
  [2000, 'Two-Thousand Base', '两千公里底盘'],
  [3000, 'Long Horizon', '长地平线'],
  [4219, 'Hundred Marathon Ledger', '百个全马账本'],
  [5000, 'Five-Kilometer Thousand', '五千公里碑'],
  [8000, 'Road Atlas', '公路地图册'],
];

const runCountRewards = [
  [1, 'First Check-In', '第一次打卡'],
  [3, 'Three Signals', '三次信号'],
  [5, 'Five-Run Rhythm', '五跑节奏'],
  [10, 'Ten Entries', '十次记录'],
  [15, 'Fifteen Footnotes', '十五条脚注'],
  [20, 'Twenty-Run Habit', '二十跑习惯'],
  [30, 'Thirty-Run Month', '三十跑月份'],
  [40, 'Forty Sessions', '四十次训练'],
  [50, 'Fifty-Run Shelf', '五十跑奖架'],
  [75, 'Seventy-Five Starts', '七十五次出发'],
  [100, 'Hundred Starts', '百次出发'],
  [150, 'One-Fifty Archive', '一百五十次档案'],
  [200, 'Two-Hundred Logbook', '两百次日志'],
  [250, 'Quarter-Thousand Runner', '二百五十次跑者'],
  [300, 'Three-Hundred Entries', '三百条记录'],
  [365, 'Year of Starts', '一整年出发'],
];

const dayStreakRewards = [
  [2, 'Back-to-Back', '背靠背'],
  [3, 'Three-Day Thread', '三日线'],
  [5, 'Five-Day Lock', '五日锁定'],
  [10, 'Ten-Day Signal', '十日信号'],
  [14, 'Two-Week Spark', '双周火花'],
  [21, 'Habit Lock', '习惯锁定'],
  [45, 'Forty-Five Flame', '四十五日火焰'],
  [60, 'Sixty-Day Engine', '六十日引擎'],
  [90, 'Quarter-Year Streak', '季度连续'],
  [120, 'Four-Month Thread', '四个月连续线'],
  [180, 'Half-Year Chain', '半年链条'],
  [365, 'Calendar Unbroken', '全年不断线'],
];

const weekStreakRewards = [
  [2, 'Two-Week Rhythm', '两周节奏'],
  [3, 'Three-Week Rail', '三周轨道'],
  [6, 'Six-Week Block', '六周训练块'],
  [8, 'Eight-Week Build', '八周构建'],
  [10, 'Ten-Week Shape', '十周成型'],
  [12, 'Twelve-Week Plan', '十二周计划'],
  [16, 'Sixteen-Week Cycle', '十六周周期'],
  [20, 'Twenty-Week Spine', '二十周主线'],
  [26, 'Half-Year Weekly Flow', '半年周节奏'],
  [52, 'Yearlong Weekly Flow', '全年周节奏'],
];

const elevationRewards = [
  [100, 'First Climb Bank', '第一笔爬升'],
  [250, 'Hill Ledger', '坡度账本'],
  [500, 'Vertical Starter', '垂直起步'],
  [1000, 'One-K Vertical', '千米爬升'],
  [1500, 'Ridgeline Builder', '山脊建造者'],
  [2000, 'Two-K Ascent', '两千米上升'],
  [3000, 'Mountain Account', '山地账户'],
  [5000, 'Highland Engine', '高地引擎'],
  [7500, 'Thin-Air Ledger', '高海拔账本'],
  [10000, 'Ten-K Vertical Club', '万米爬升俱乐部'],
];

const themeRewards = [
  ['themeMorning', 3, 'sun', 'Dawn Regular', '晨跑常客', 'morning runs', '次晨跑'],
  ['themeNight', 3, 'moon', 'After-Dark Runner', '夜跑者', 'night runs', '次夜跑'],
  ['themeRain', 2, 'rain', 'Rainproof', '雨中不退', 'rain runs', '次雨中跑'],
  ['themeHeat', 2, 'sun', 'Heat Manager', '高温管理者', 'hot-weather runs', '次高温跑'],
  ['themeSnow', 1, 'summit', 'Cold Line', '冷线跑者', 'cold-weather runs', '次寒冷跑'],
  ['themeTrail', 3, 'leaf', 'Trail Thread', '越野线索', 'trail runs', '次越野跑'],
  ['themeTrack', 3, 'track', 'Track Regular', '跑道常客', 'track sessions', '次跑道训练'],
  ['themeTempo', 3, 'bolt', 'Tempo Dial', '节奏旋钮', 'tempo runs', '次节奏跑'],
  ['themeIntervals', 3, 'bolt', 'Repeat Craft', '间歇工艺', 'interval sessions', '次间歇训练'],
  ['themeRecovery', 3, 'recovery', 'Recovery Keeper', '恢复守门员', 'recovery runs', '次恢复跑'],
  ['themeEasy', 5, 'route', 'Easy Miles Bank', '轻松里程银行', 'easy runs', '次轻松跑'],
  ['themeLong', 3, 'summit', 'Long Run Habit', '长距离习惯', 'long runs', '次长距离'],
  ['themeRace', 1, 'flag', 'Pinned Bib', '别上号码布', 'race efforts', '次比赛记录'],
  ['themeMarathon', 1, 'crown', 'Marathon Mark', '马拉松印记', 'marathon efforts', '次马拉松'],
  ['themeHalf', 1, 'medal', 'Half-Marathon Mark', '半马印记', 'half-marathon efforts', '次半马'],
  ['themeFiveK', 3, 'track', 'Five-K Specialist', '五公里专家', '5K efforts', '次五公里'],
  ['themeTenK', 3, 'track', 'Ten-K Specialist', '十公里专家', '10K efforts', '次十公里'],
  ['themeHill', 3, 'mountain', 'Hill Repeat Mindset', '爬坡心态', 'hill runs', '次爬坡跑'],
  ['themeCommute', 3, 'shoe', 'Commute Runner', '通勤跑者', 'commute runs', '次通勤跑'],
  ['themeWaterfront', 3, 'wave', 'Waterline Collector', '水岸收藏家', 'waterfront runs', '次水岸跑'],
];

function thresholdRewards(items, config) {
  return items.map(([threshold, enTitle, zhTitle]) => ({
    id: `${config.idPrefix}-${String(threshold).replace('.', '-')}`,
    icon: config.icon,
    metric: config.metric,
    threshold,
    valueType: config.valueType,
    metricLabel: config.metricLabel,
    title: { en: enTitle, zh: zhTitle },
  }));
}

export const EXTRA_REWARD_DEFINITIONS = [
  ...thresholdRewards(singleRunRewards, {
    idPrefix: 'single-run',
    icon: 'route',
    metric: 'longestRunKm',
    valueType: 'km',
    metricLabel: { en: 'km best single run', zh: '公里单次最长距离' },
  }),
  ...thresholdRewards(lifetimeDistanceRewards, {
    idPrefix: 'lifetime-distance',
    icon: 'route',
    metric: 'totalDistanceKm',
    valueType: 'km',
    metricLabel: { en: 'km lifetime distance', zh: '公里累计距离' },
  }),
  ...thresholdRewards(runCountRewards, {
    idPrefix: 'run-count',
    icon: 'medal',
    metric: 'runCount',
    valueType: 'count',
    metricLabel: { en: 'runs recorded', zh: '次跑步记录' },
  }),
  ...thresholdRewards(dayStreakRewards, {
    idPrefix: 'day-streak',
    icon: 'streak',
    metric: 'streakDays',
    valueType: 'count',
    metricLabel: { en: 'straight days', zh: '天连续跑步' },
  }),
  ...thresholdRewards(weekStreakRewards, {
    idPrefix: 'week-streak',
    icon: 'calendar',
    metric: 'streakWeeks',
    valueType: 'count',
    metricLabel: { en: 'straight training weeks', zh: '周连续训练' },
  }),
  ...thresholdRewards(elevationRewards, {
    idPrefix: 'elevation',
    icon: 'mountain',
    metric: 'totalElevationM',
    valueType: 'meter',
    metricLabel: { en: 'm total climbing', zh: '米累计爬升' },
  }),
  ...themeRewards.map(([metric, threshold, icon, enTitle, zhTitle, enLabel, zhLabel]) => ({
    id: `theme-${metric.replace(/^theme/, '').replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '')}`,
    icon,
    metric,
    threshold,
    valueType: 'count',
    metricLabel: { en: enLabel, zh: zhLabel },
    title: { en: enTitle, zh: zhTitle },
  })),
];

function localize(value, lang) {
  return lang === 'zh-CN' ? value.zh : value.en;
}

function formatValue(value, valueType) {
  if (valueType === 'km') {
    return value >= 100 ? `${Math.round(value)}` : `${Number(value).toFixed(1)}`;
  }
  if (valueType === 'meter') return `${Math.round(value)}`;
  return `${Math.round(value)}`;
}

function materializeReward(definition, stats, lang) {
  const current = numberValue(stats[definition.metric]);
  const target = numberValue(definition.threshold);
  const remaining = Math.max(0, target - current);
  const earned = current >= target;
  const progress = target > 0 ? Math.min(1, current / target) : 0;
  const metricLabel = localize(definition.metricLabel, lang);
  const currentText = formatValue(current, definition.valueType);
  const targetText = formatValue(target, definition.valueType);
  const remainingText = formatValue(remaining, definition.valueType);

  return {
    id: definition.id,
    icon: definition.icon,
    title: localize(definition.title, lang),
    subtitle: lang === 'zh-CN'
      ? `当前 ${currentText} ${metricLabel}`
      : `${currentText} ${metricLabel} so far`,
    hint: earned
      ? (lang === 'zh-CN'
        ? `已达成目标：${targetText} ${metricLabel}`
        : `Unlocked at ${targetText} ${metricLabel}`)
      : (lang === 'zh-CN'
        ? `距离目标还差 ${remainingText} ${metricLabel}`
        : `${remainingText} ${metricLabel} to unlock`),
    progress,
    earned,
  };
}

export function buildCatalogRewardEntries(runs, lang = 'en') {
  const stats = getCatalogRewardStats(runs);
  return EXTRA_REWARD_DEFINITIONS.map((definition) => materializeReward(definition, stats, lang));
}
