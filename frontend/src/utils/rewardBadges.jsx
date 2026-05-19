import { calculateStreaks } from './streakUtils';

function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getConsecutiveRunDayStreak(runs) {
  return calculateStreaks(runs).current;
}

export function getConsecutiveRunWeekStreak(runs) {
  const sortedWeeks = [...new Set(
    runs
      .map((run) => new Date(run.startTime || run.startDate || 0))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => startOfWeek(date).getTime()),
  )].sort((a, b) => b - a);

  if (sortedWeeks.length === 0) return 0;

  const currentWeek = startOfWeek(new Date()).getTime();
  const lastRunWeek = sortedWeeks[0];
  const diffWeeksFromCurrent = Math.round((currentWeek - lastRunWeek) / (7 * 86400000));

  if (diffWeeksFromCurrent > 1) return 0;

  let streak = 1;
  for (let i = 1; i < sortedWeeks.length; i += 1) {
    const diffWeeks = Math.round((sortedWeeks[i - 1] - sortedWeeks[i]) / (7 * 86400000));
    if (diffWeeks === 1) streak += 1;
    else break;
  }
  return streak;
}

function countKeywordRuns(runs, pattern) {
  return runs.reduce((total, run) => {
    const haystack = `${run.name || ''} ${run.title || ''} ${run.description || ''}`;
    return total + (pattern.test(haystack) ? 1 : 0);
  }, 0);
}

function runHour(run) {
  const value = run.startTime || run.startDate || null;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getHours();
}

function totalDistanceKm(runs) {
  return runs.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0);
}

function bestWeeklyDistanceKm(runs) {
  const weekly = new Map();
  runs.forEach((run) => {
    const date = new Date(run.startTime || run.startDate || 0);
    if (Number.isNaN(date.getTime())) return;
    const key = startOfWeek(date).getTime();
    weekly.set(key, (weekly.get(key) || 0) + Number(run.distanceKm || 0));
  });
  let best = 0;
  weekly.forEach((value) => {
    if (value > best) best = value;
  });
  return best;
}

function countWeekendPairs(runs) {
  const days = new Map();
  runs.forEach((run) => {
    const date = new Date(run.startTime || run.startDate || 0);
    if (Number.isNaN(date.getTime())) return;
    const day = date.getDay();
    if (day !== 0 && day !== 6) return;
    const wk = startOfWeek(date).getTime();
    if (!days.has(wk)) days.set(wk, new Set());
    days.get(wk).add(day);
  });
  let count = 0;
  days.forEach((set) => {
    if (set.has(0) && set.has(6)) count += 1;
  });
  return count;
}

// ===========================================================================
// Reward artwork — layered SVG medals with category-themed colors.
//
// Each glyph is composed of:
//   • a soft outer "halo" disc (low-opacity color wash)
//   • a metallic ring frame (gradient stroke)
//   • a colored center disc (the medal face)
//   • a dashed "engraved" inner accent ring
//   • a central icon (category-specific shape)
//   • a fluttering ribbon underneath (two folds, slightly offset)
//
// All shapes render on a 0 0 64 64 viewBox so the rendered <svg> scales cleanly
// inside any sized container in Rewards.jsx.
// ===========================================================================

const PALETTES = {
  coral: { halo: '#fde0d7', ring: '#f07561', face: '#fff5f1', accent: '#a0392a', ribbon: '#e25a3f', ink: '#7a1f10' },
  gold: { halo: '#fef3c7', ring: '#d97706', face: '#fffbeb', accent: '#92400e', ribbon: '#b45309', ink: '#5c2c08' },
  bronze: { halo: '#f5e1c8', ring: '#9a6535', face: '#fbf2e6', accent: '#5d3a1c', ribbon: '#8a5a30', ink: '#4a2a14' },
  emerald: { halo: '#d1fae5', ring: '#10b981', face: '#ecfdf5', accent: '#065f46', ribbon: '#0d9488', ink: '#032f24' },
  teal: { halo: '#cffafe', ring: '#0891b2', face: '#ecfeff', accent: '#155e75', ribbon: '#0e7490', ink: '#072734' },
  sky: { halo: '#dbeafe', ring: '#2563eb', face: '#eff6ff', accent: '#1e3a8a', ribbon: '#1d4ed8', ink: '#0c1c4d' },
  navy: { halo: '#dbeafe', ring: '#1e293b', face: '#f1f5f9', accent: '#0f172a', ribbon: '#334155', ink: '#020617' },
  rose: { halo: '#fce7f3', ring: '#db2777', face: '#fdf2f8', accent: '#9d174d', ribbon: '#be185d', ink: '#4a0723' },
  amber: { halo: '#fef3c7', ring: '#ea580c', face: '#fff7ed', accent: '#9a3412', ribbon: '#c2410c', ink: '#5a1f08' },
  slate: { halo: '#e2e8f0', ring: '#475569', face: '#f1f5f9', accent: '#1e293b', ribbon: '#334155', ink: '#020617' },
  plum: { halo: '#ede9fe', ring: '#7c3aed', face: '#f5f3ff', accent: '#4c1d95', ribbon: '#6d28d9', ink: '#1e0a4f' },
};

function MedalFrame({ palette, ribbon = true }) {
  return (
    <>
      {ribbon && (
        <g aria-hidden="true">
          <path d="M19 45 L13 60 L21 56 L24 60 L28 50 Z" fill={palette.ribbon} />
          <path d="M45 45 L51 60 L43 56 L40 60 L36 50 Z" fill={palette.ribbon} opacity="0.86" />
        </g>
      )}
      <circle cx="32" cy="28" r="24" fill={palette.halo} opacity="0.55" />
      <circle cx="32" cy="28" r="20.5" fill={palette.face} stroke={palette.ring} strokeWidth="2.5" />
      <circle cx="32" cy="28" r="16" fill="none" stroke={palette.ring} strokeWidth="0.9" opacity="0.55" strokeDasharray="1.6 2" />
    </>
  );
}

function Star({ x, y, size = 1.6, fill = '#fbbf24', opacity = 1 }) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(x + Math.cos(angle) * r).toFixed(2)},${(y + Math.sin(angle) * r).toFixed(2)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} opacity={opacity} />;
}

export function RewardGlyph({ icon }) {
  // ----- Streaks -----
  if (icon === 'streak') {
    const p = PALETTES.coral;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M34 14 L23 32 h6 L26.5 44 L41 28 h-6 L37.5 14 Z" fill={p.ribbon} />
        <path d="M34 14 L23 32 h6 L26.5 44 L41 28 h-6 L37.5 14 Z" fill="none" stroke={p.accent} strokeWidth="0.9" />
        <circle cx="29" cy="20" r="1.6" fill="#fbbf24" />
      </svg>
    );
  }

  // 7-day streak alt (calendar with checkmark)
  if (icon === 'calendar') {
    const p = PALETTES.amber;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <rect x="20" y="18" width="24" height="20" rx="2.2" fill="#fff" stroke={p.accent} strokeWidth="1.2" />
        <rect x="20" y="18" width="24" height="5.5" fill={p.ring} />
        <rect x="25" y="14" width="2" height="6" fill={p.accent} rx="0.6" />
        <rect x="37" y="14" width="2" height="6" fill={p.accent} rx="0.6" />
        <path d="M25.5 30 L30 34.5 L39 25.5" fill="none" stroke={p.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // 4-week crown
  if (icon === 'crown') {
    const p = PALETTES.gold;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M16 36 L18 22 L24 30 L32 16 L40 30 L46 22 L48 36 Z" fill={p.ring} stroke={p.accent} strokeWidth="1" />
        <rect x="16" y="36" width="32" height="3" fill={p.accent} />
        <circle cx="24" cy="29" r="1.6" fill="#fff" />
        <circle cx="32" cy="22" r="1.8" fill="#fef3c7" />
        <circle cx="40" cy="29" r="1.6" fill="#fff" />
      </svg>
    );
  }

  // Distance — gold medal with engraved figure
  if (icon === 'medal') {
    const p = PALETTES.gold;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <circle cx="32" cy="28" r="11" fill={p.ring} stroke={p.accent} strokeWidth="1.4" />
        <path d="M32 21 a2.4 2.4 0 1 0 0 4.8 a2.4 2.4 0 0 0 0-4.8 Z" fill="#fff" />
        <path d="M27 36 L29 31 L32 33 L35 31 L37 36 Z" fill="#fff" />
        <Star x={26} y={23} size={1.1} fill="#fef3c7" />
        <Star x={38} y={23} size={1.1} fill="#fef3c7" />
      </svg>
    );
  }

  // Summit / mountain
  if (icon === 'summit') {
    const p = PALETTES.emerald;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M16 40 L24 24 L30 34 L34 28 L48 40 Z" fill={p.ring} stroke={p.accent} strokeWidth="0.8" />
        <path d="M24 24 L27 29 L22 29 Z" fill="#fff" />
        <path d="M34 28 L36 31 L32 31 Z" fill="#fff" opacity="0.8" />
        <circle cx="42" cy="18" r="2.2" fill="#fbbf24" />
      </svg>
    );
  }

  // Park / tree
  if (icon === 'park') {
    const p = PALETTES.emerald;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <ellipse cx="32" cy="24" rx="9" ry="7" fill={p.ring} />
        <ellipse cx="26" cy="28" rx="6" ry="5" fill={p.accent} opacity="0.85" />
        <ellipse cx="38" cy="28" rx="6" ry="5" fill={p.accent} opacity="0.85" />
        <rect x="30.5" y="30" width="3" height="10" fill="#7c2d12" />
        <circle cx="30" cy="22" r="1" fill="#fef3c7" opacity="0.8" />
      </svg>
    );
  }

  // Bridge
  if (icon === 'bridge') {
    const p = PALETTES.teal;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M14 38 L50 38" stroke={p.ring} strokeWidth="2" />
        <path d="M14 38 Q32 18 50 38" fill="none" stroke={p.ring} strokeWidth="2.4" />
        <line x1="20" y1="38" x2="20" y2="30.5" stroke={p.accent} strokeWidth="1.4" />
        <line x1="26" y1="38" x2="26" y2="26" stroke={p.accent} strokeWidth="1.4" />
        <line x1="32" y1="38" x2="32" y2="24.5" stroke={p.accent} strokeWidth="1.4" />
        <line x1="38" y1="38" x2="38" y2="26" stroke={p.accent} strokeWidth="1.4" />
        <line x1="44" y1="38" x2="44" y2="30.5" stroke={p.accent} strokeWidth="1.4" />
        <path d="M14 40 L50 40 L50 42 L14 42 Z" fill={p.accent} />
      </svg>
    );
  }

  // City skyline
  if (icon === 'city') {
    const p = PALETTES.sky;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <rect x="18" y="26" width="6" height="14" fill={p.ring} />
        <rect x="24" y="20" width="6" height="20" fill={p.accent} />
        <rect x="30" y="14" width="7" height="26" fill={p.ring} />
        <rect x="37" y="22" width="5" height="18" fill={p.accent} />
        <rect x="42" y="28" width="5" height="12" fill={p.ring} />
        <rect x="20" y="29" width="1.2" height="1.2" fill="#fff" />
        <rect x="26" y="24" width="1.2" height="1.2" fill="#fff" />
        <rect x="32" y="18" width="1.2" height="1.2" fill="#fff" />
        <rect x="32" y="22" width="1.2" height="1.2" fill="#fff" />
        <rect x="38.5" y="26" width="1.2" height="1.2" fill="#fff" />
      </svg>
    );
  }

  // Trophy (general)
  if (icon === 'trophy') {
    const p = PALETTES.gold;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M22 16 h20 v6 a10 10 0 0 1-20 0 Z" fill={p.ring} stroke={p.accent} strokeWidth="1.2" />
        <path d="M22 22 a4 4 0 0 1-4-4 v-2 h4 Z" fill={p.ring} />
        <path d="M42 22 a4 4 0 0 0 4-4 v-2 h-4 Z" fill={p.ring} />
        <rect x="29" y="32" width="6" height="4" fill={p.accent} />
        <rect x="25" y="36" width="14" height="3.5" fill={p.accent} rx="0.5" />
        <Star x={32} y={20} size={2} fill="#fef3c7" />
      </svg>
    );
  }

  // Lightning (speed, intensity)
  if (icon === 'bolt') {
    const p = PALETTES.amber;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M34 14 L22 32 h6 L25 44 L42 26 h-6 L38 14 Z" fill="#fde047" stroke={p.accent} strokeWidth="1.1" />
        <circle cx="36" cy="20" r="1.4" fill="#fff" />
      </svg>
    );
  }

  // Sunrise — early bird
  if (icon === 'sunrise') {
    const p = PALETTES.rose;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <circle cx="32" cy="36" r="10" fill="#fde047" opacity="0.95" />
        <path d="M14 36 L50 36" stroke={p.accent} strokeWidth="1.6" />
        <path d="M18 38 L46 38" stroke={p.ring} strokeWidth="1" opacity="0.6" />
        <line x1="32" y1="14" x2="32" y2="20" stroke={p.accent} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="22" y1="18" x2="25" y2="22" stroke={p.accent} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="42" y1="18" x2="39" y2="22" stroke={p.accent} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="16" y1="28" x2="20" y2="29" stroke={p.accent} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="48" y1="28" x2="44" y2="29" stroke={p.accent} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  // Moon — night owl
  if (icon === 'moon') {
    const p = PALETTES.plum;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M40 16 a14 14 0 1 0 8 26 a11 11 0 0 1-8-26 Z" fill="#fef3c7" stroke={p.accent} strokeWidth="1.2" />
        <Star x={24} y={20} size={1.4} fill="#fbbf24" />
        <Star x={21} y={32} size={1.1} fill="#fef3c7" />
        <Star x={26} y={40} size={1.2} fill="#fbbf24" />
      </svg>
    );
  }

  // Globe — for world / cumulative
  if (icon === 'globe') {
    const p = PALETTES.sky;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <circle cx="32" cy="28" r="11" fill={p.ring} stroke={p.accent} strokeWidth="1.2" />
        <path d="M21 28 L43 28" stroke="#fff" strokeWidth="0.9" />
        <path d="M32 17 a14 8 0 0 0 0 22 a14 8 0 0 0 0-22 Z" fill="none" stroke="#fff" strokeWidth="0.9" />
        <path d="M32 17 L32 39" stroke="#fff" strokeWidth="0.9" />
        <path d="M26 19 Q26 28 26 37" stroke="#fff" strokeWidth="0.7" fill="none" opacity="0.8" />
        <path d="M38 19 Q38 28 38 37" stroke="#fff" strokeWidth="0.7" fill="none" opacity="0.8" />
      </svg>
    );
  }

  // Stopwatch — pace
  if (icon === 'stopwatch') {
    const p = PALETTES.coral;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <circle cx="32" cy="30" r="11.5" fill="#fff" stroke={p.ring} strokeWidth="1.8" />
        <rect x="29" y="14" width="6" height="3" fill={p.accent} rx="0.5" />
        <rect x="30.7" y="17" width="2.6" height="2" fill={p.accent} />
        <line x1="32" y1="30" x2="32" y2="22" stroke={p.accent} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="32" y1="30" x2="37" y2="32.5" stroke={p.ring} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="32" cy="30" r="1.4" fill={p.accent} />
      </svg>
    );
  }

  // Weekend Warrior — calendar with star
  if (icon === 'weekend') {
    const p = PALETTES.rose;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <rect x="20" y="20" width="24" height="18" rx="2" fill="#fff" stroke={p.accent} strokeWidth="1.2" />
        <rect x="20" y="20" width="24" height="5" fill={p.ring} />
        <rect x="24" y="28" width="3" height="3" fill={p.accent} opacity="0.5" />
        <rect x="29" y="28" width="3" height="3" fill={p.accent} opacity="0.5" />
        <rect x="34" y="28" width="3" height="3" fill={p.ring} />
        <rect x="34" y="33" width="3" height="3" fill={p.ring} />
        <rect x="39" y="33" width="3" height="3" fill={p.ring} />
        <Star x={32} y={42} size={2} fill={p.ring} />
      </svg>
    );
  }

  // Flame — milestone, lifetime
  if (icon === 'flame') {
    const p = PALETTES.coral;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M32 14 Q26 22 28 28 Q23 28 23 34 Q23 42 32 44 Q41 42 41 34 Q41 28 36 28 Q38 22 32 14 Z" fill="#f97316" stroke={p.accent} strokeWidth="1" />
        <path d="M32 22 Q29 27 31 30 Q34 27 32 22 Z" fill="#fbbf24" />
      </svg>
    );
  }

  // Boot — first run
  if (icon === 'boot') {
    const p = PALETTES.bronze;
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <MedalFrame palette={p} />
        <path d="M22 22 v14 c0 1.5 1 2.5 2.5 2.5 h16 c2 0 3.5-1.5 3.5-3.5 v-2.5 c0-1.5-1-2.5-2.5-2.5 H35 v-8 Z" fill={p.ring} stroke={p.accent} strokeWidth="1.2" />
        <path d="M22 22 h13 v3 h-13 Z" fill={p.accent} />
        <circle cx="27" cy="30" r="0.9" fill="#fff" />
        <circle cx="31" cy="30" r="0.9" fill="#fff" />
        <line x1="42" y1="35" x2="43.5" y2="33.5" stroke={p.accent} strokeWidth="1" />
      </svg>
    );
  }

  // Default fallback star
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <MedalFrame palette={PALETTES.coral} />
      <Star x={32} y={28} size={9} fill={PALETTES.coral.ring} />
      <Star x={32} y={28} size={4.5} fill="#fff" opacity="0.6" />
    </svg>
  );
}

export function buildRewardShowcase(runs, lang) {
  const longestRunKm = runs.reduce((max, run) => Math.max(max, Number(run.distanceKm || 0)), 0);
  const streakDays = getConsecutiveRunDayStreak(runs);
  const streakWeeks = getConsecutiveRunWeekStreak(runs);
  const parkRuns = countKeywordRuns(runs, /\b(park|garden|greenway|trail)\b/i);
  const bridgeRuns = countKeywordRuns(runs, /\b(bridge|riverwalk|waterfront)\b/i);
  const cityRuns = countKeywordRuns(runs, /\b(city|downtown|plaza|campus|tower|building)\b/i);
  const totalKm = totalDistanceKm(runs);
  const bestWeekKm = bestWeeklyDistanceKm(runs);
  const weekendPairs = countWeekendPairs(runs);

  const dawnRuns = runs.filter((r) => {
    const h = runHour(r);
    return h !== null && h >= 4 && h < 7;
  }).length;
  const nightRuns = runs.filter((r) => {
    const h = runHour(r);
    return h !== null && h >= 20;
  }).length;

  const marathonCompleted = longestRunKm >= 42.195;
  const halfMarathonCompleted = longestRunKm >= 21.0975;
  const tenKCompleted = longestRunKm >= 10;
  const fiveKCompleted = longestRunKm >= 5;
  const twentyFiveKCompleted = longestRunKm >= 25;
  const ultraCompleted = longestRunKm >= 50;

  const cityKeywords = {
    beijing: /\b(beijing|北京|běijīng)\b/i,
    shanghai: /\b(shanghai|上海|shànghǎi)\b/i,
    guangzhou: /\b(guangzhou|广州|guǎngzhōu)\b/i,
    shenzhen: /\b(shenzhen|深圳|shēnzhèn)\b/i,
    hangzhou: /\b(hangzhou|杭州|hángzhōu)\b/i,
    chengdu: /\b(chengdu|成都|chéngdū)\b/i,
    london: /\b(london|londres)\b/i,
    boston: /\b(boston)\b/i,
    tokyo: /\b(tokyo|东京|dōngjīng|tōkyō)\b/i,
    nyc: /\b(new york|nyc|纽约|niǔyuē)\b/i,
    chicago: /\b(chicago|芝加哥|zhījiāgē)\b/i,
    berlin: /\b(berlin|柏林|bólín)\b/i,
    paris: /\b(paris|巴黎|bālí)\b/i,
  };

  const cityCounts = {};
  for (const [city, pattern] of Object.entries(cityKeywords)) {
    cityCounts[city] = countKeywordRuns(runs, pattern);
  }
  const distinctCities = Object.values(cityCounts).filter((count) => count > 0).length;

  function countHolidayRuns(pattern) {
    return runs.filter((run) => {
      const date = new Date(run.startTime || run.startDate || 0);
      return !Number.isNaN(date.getTime()) && pattern(date);
    }).length;
  }

  function countSeasonKeywordRuns(pattern) {
    return countKeywordRuns(runs, pattern);
  }

  const newYearRuns = countHolidayRuns((date) => date.getMonth() === 0 && date.getDate() === 1);
  const christmasRuns = countHolidayRuns((date) => date.getMonth() === 11 && date.getDate() === 25);
  const springRuns = countSeasonKeywordRuns(/\b(spring|春|chūntiān|春天)\b/i);
  const summerRuns = countSeasonKeywordRuns(/\b(summer|夏|xiàtiān|夏天)\b/i);
  const autumnRuns = countSeasonKeywordRuns(/\b(autumn|fall|秋|qiūtiān|秋天)\b/i);
  const winterRuns = countSeasonKeywordRuns(/\b(winter|冬|dōngtiān|冬天)\b/i);

  const allRewards = [
    // ===== Onboarding =====
    {
      id: 'first-run',
      icon: 'boot',
      title: lang === 'zh-CN' ? '首跑印记' : 'First Footprint',
      subtitle: lang === 'zh-CN' ? '完成你的第一次跑步' : 'Logged your very first run',
      hint: lang === 'zh-CN' ? '记录任意一次跑步即可解锁' : 'Log any run to unlock',
      progress: Math.min(1, runs.length),
      earned: runs.length >= 1,
    },
    // ===== Streaks =====
    {
      id: 'streak-7',
      icon: 'streak',
      title: lang === 'zh-CN' ? '七日连跑' : '7-Day Streak',
      subtitle: lang === 'zh-CN' ? `连续 ${streakDays} 天保持跑步节奏` : `${streakDays} straight days on the run`,
      hint: lang === 'zh-CN' ? `再坚持 ${Math.max(0, 7 - streakDays)} 天即可解锁` : `${Math.max(0, 7 - streakDays)} more day(s) in a row`,
      progress: Math.min(1, streakDays / 7),
      earned: streakDays >= 7,
    },
    {
      id: 'streak-30',
      icon: 'calendar',
      title: lang === 'zh-CN' ? '三十日挑战' : '30-Day Challenge',
      subtitle: lang === 'zh-CN' ? '把短期坚持变成稳定习惯' : 'Turn consistency into a durable habit',
      hint: lang === 'zh-CN' ? `当前连续 ${streakDays} 天，目标 30 天` : `${streakDays} / 30 consecutive days`,
      progress: Math.min(1, streakDays / 30),
      earned: streakDays >= 30,
    },
    {
      id: 'weeks-4',
      icon: 'crown',
      title: lang === 'zh-CN' ? '四周连续训练' : '4-Week Flow',
      subtitle: lang === 'zh-CN' ? `已连续 ${streakWeeks} 周完成跑步` : `${streakWeeks} consecutive training weeks`,
      hint: lang === 'zh-CN' ? `${streakWeeks} / 4 连续训练周` : `${streakWeeks} / 4 consecutive weeks`,
      progress: Math.min(1, streakWeeks / 4),
      earned: streakWeeks >= 4,
    },
    // ===== Distance milestones (single run) =====
    {
      id: 'ultra-marathon',
      icon: 'flame',
      title: lang === 'zh-CN' ? '超马荣耀' : 'Ultra Marathon',
      subtitle: lang === 'zh-CN' ? '单次跑步突破 50 km 超马门槛' : 'Crossed the 50 km ultra threshold',
      hint: lang === 'zh-CN' ? `当前最长 ${longestRunKm.toFixed(1)} km，目标 50 km` : `Best ${longestRunKm.toFixed(1)} km — reach 50 km to unlock`,
      progress: Math.min(1, longestRunKm / 50),
      earned: ultraCompleted,
    },
    {
      id: 'marathon',
      icon: 'medal',
      title: lang === 'zh-CN' ? '全程马拉松' : 'Full Marathon',
      subtitle: lang === 'zh-CN' ? '完成一次 42.195 km 全马距离' : 'Completed a full 42.195 km marathon distance',
      hint: lang === 'zh-CN' ? `当前最长 ${longestRunKm.toFixed(1)} km，目标 42.195 km` : `Best ${longestRunKm.toFixed(1)} km — reach 42.195 km to unlock`,
      progress: Math.min(1, longestRunKm / 42.195),
      earned: marathonCompleted,
    },
    {
      id: '25k',
      icon: 'summit',
      title: lang === 'zh-CN' ? '二十五公里突破' : '25K Breakthrough',
      subtitle: lang === 'zh-CN' ? '单次跑步达到 25 km' : 'Pushed past 25 km in a single effort',
      hint: lang === 'zh-CN' ? `当前最长 ${longestRunKm.toFixed(1)} km，目标 25 km` : `Best ${longestRunKm.toFixed(1)} km — reach 25 km to unlock`,
      progress: Math.min(1, longestRunKm / 25),
      earned: twentyFiveKCompleted,
    },
    {
      id: 'half-marathon',
      icon: 'medal',
      title: lang === 'zh-CN' ? '半程马拉松' : 'Half Marathon',
      subtitle: lang === 'zh-CN' ? '完成一次 21.1 km 半马距离' : 'Completed a 21.1 km half-marathon distance',
      hint: lang === 'zh-CN' ? `当前最长 ${longestRunKm.toFixed(1)} km，目标 21.1 km` : `Best ${longestRunKm.toFixed(1)} km — reach 21.1 km to unlock`,
      progress: Math.min(1, longestRunKm / 21.1),
      earned: halfMarathonCompleted,
    },
    {
      id: '10k',
      icon: 'summit',
      title: lang === 'zh-CN' ? '十公里里程碑' : '10K Milestone',
      subtitle: lang === 'zh-CN' ? '单次跑步达到 10 km' : 'Ran 10 km in a single effort',
      hint: lang === 'zh-CN' ? `当前最长 ${longestRunKm.toFixed(1)} km，目标 10 km` : `Best ${longestRunKm.toFixed(1)} km — reach 10 km to unlock`,
      progress: Math.min(1, longestRunKm / 10),
      earned: tenKCompleted,
    },
    {
      id: '5k',
      icon: 'summit',
      title: lang === 'zh-CN' ? '五公里起跑' : '5K Starter',
      subtitle: lang === 'zh-CN' ? '单次跑步达到 5 km' : 'Ran 5 km in a single effort',
      hint: lang === 'zh-CN' ? `当前最长 ${longestRunKm.toFixed(1)} km，目标 5 km` : `Best ${longestRunKm.toFixed(1)} km — reach 5 km to unlock`,
      progress: Math.min(1, longestRunKm / 5),
      earned: fiveKCompleted,
    },
    // ===== Cumulative lifetime distance =====
    {
      id: 'lifetime-100',
      icon: 'flame',
      title: lang === 'zh-CN' ? '百公里俱乐部' : '100 km Club',
      subtitle: lang === 'zh-CN' ? `累计 ${totalKm.toFixed(0)} km 跑步距离` : `${totalKm.toFixed(0)} km career distance`,
      hint: lang === 'zh-CN' ? `累计 ${totalKm.toFixed(0)} / 100 km` : `${totalKm.toFixed(0)} / 100 km lifetime`,
      progress: Math.min(1, totalKm / 100),
      earned: totalKm >= 100,
    },
    {
      id: 'lifetime-500',
      icon: 'flame',
      title: lang === 'zh-CN' ? '五百公里勋章' : '500 km Veteran',
      subtitle: lang === 'zh-CN' ? `累计 ${totalKm.toFixed(0)} km 跑步距离` : `${totalKm.toFixed(0)} km career distance`,
      hint: lang === 'zh-CN' ? `累计 ${totalKm.toFixed(0)} / 500 km` : `${totalKm.toFixed(0)} / 500 km lifetime`,
      progress: Math.min(1, totalKm / 500),
      earned: totalKm >= 500,
    },
    {
      id: 'lifetime-1000',
      icon: 'globe',
      title: lang === 'zh-CN' ? '千公里旅程' : '1000 km Journey',
      subtitle: lang === 'zh-CN' ? `累计 ${totalKm.toFixed(0)} km 跑步距离` : `${totalKm.toFixed(0)} km career distance`,
      hint: lang === 'zh-CN' ? `累计 ${totalKm.toFixed(0)} / 1000 km` : `${totalKm.toFixed(0)} / 1000 km lifetime`,
      progress: Math.min(1, totalKm / 1000),
      earned: totalKm >= 1000,
    },
    // ===== Weekly volume =====
    {
      id: 'marathon-week',
      icon: 'trophy',
      title: lang === 'zh-CN' ? '马拉松一周' : 'Marathon Week',
      subtitle: lang === 'zh-CN' ? `单周最高 ${bestWeekKm.toFixed(1)} km` : `Peak ${bestWeekKm.toFixed(1)} km in a single week`,
      hint: lang === 'zh-CN' ? `本周累计 ${bestWeekKm.toFixed(1)} / 42.2 km` : `${bestWeekKm.toFixed(1)} / 42.2 km in any week`,
      progress: Math.min(1, bestWeekKm / 42.195),
      earned: bestWeekKm >= 42.195,
    },
    // ===== Time of day =====
    {
      id: 'early-bird',
      icon: 'sunrise',
      title: lang === 'zh-CN' ? '破晓先行' : 'Early Bird',
      subtitle: lang === 'zh-CN' ? '在凌晨 4-7 点开始过跑步' : 'Started a run between 4–7 am',
      hint: lang === 'zh-CN' ? `已记录 ${dawnRuns} 次破晓跑` : `${dawnRuns} dawn runs logged`,
      progress: Math.min(1, dawnRuns),
      earned: dawnRuns >= 1,
    },
    {
      id: 'night-owl',
      icon: 'moon',
      title: lang === 'zh-CN' ? '夜跑者' : 'Night Owl',
      subtitle: lang === 'zh-CN' ? '在晚 8 点后开始过跑步' : 'Started a run after 8 pm',
      hint: lang === 'zh-CN' ? `已记录 ${nightRuns} 次夜跑` : `${nightRuns} night runs logged`,
      progress: Math.min(1, nightRuns),
      earned: nightRuns >= 1,
    },
    // ===== Weekend =====
    {
      id: 'weekend-warrior',
      icon: 'weekend',
      title: lang === 'zh-CN' ? '周末战士' : 'Weekend Warrior',
      subtitle: lang === 'zh-CN' ? `已完成 ${weekendPairs} 个跑步周末` : `${weekendPairs} double-run weekends`,
      hint: lang === 'zh-CN' ? '在同一个周末完成周六 + 周日跑步' : 'Run on both Saturday and Sunday of the same week',
      progress: Math.min(1, weekendPairs),
      earned: weekendPairs >= 1,
    },
    // ===== City / regional =====
    {
      id: 'city-one',
      icon: 'city',
      title: lang === 'zh-CN' ? '城市跑者' : 'City Runner',
      subtitle: lang === 'zh-CN' ? `在 ${distinctCities} 个城市留下足迹` : `Logged runs in ${distinctCities} cities`,
      hint: lang === 'zh-CN' ? '在至少 1 个知名城市完成跑步' : 'Log a run in a known city',
      progress: Math.min(1, distinctCities),
      earned: distinctCities >= 1,
    },
    {
      id: 'city-three',
      icon: 'city',
      title: lang === 'zh-CN' ? '三城旅跑' : '3-City Tourist',
      subtitle: lang === 'zh-CN' ? `已经在 ${distinctCities} 个城市中跑步` : `${distinctCities} cities in your running passport`,
      hint: lang === 'zh-CN' ? `当前 ${distinctCities} / 3 座城市` : `${distinctCities} / 3 cities`,
      progress: Math.min(1, distinctCities / 3),
      earned: distinctCities >= 3,
    },
    {
      id: 'world-major',
      icon: 'globe',
      title: lang === 'zh-CN' ? '大满贯城市' : 'World Major City',
      subtitle: lang === 'zh-CN' ? '在至少一个大满贯赛道上留下足迹' : 'Ran in a World Marathon Major city',
      hint: lang === 'zh-CN' ? '在波士顿、伦敦、柏林、芝加哥、纽约或东京完成一次跑步' : 'Log a run in Boston, London, Berlin, Chicago, NYC, or Tokyo',
      progress: Math.min(1, cityCounts.boston + cityCounts.london + cityCounts.berlin + cityCounts.chicago + cityCounts.nyc + cityCounts.tokyo),
      earned: (cityCounts.boston + cityCounts.london + cityCounts.berlin + cityCounts.chicago + cityCounts.nyc + cityCounts.tokyo) >= 1,
    },
    // ===== Holiday / Seasonal =====
    {
      id: 'newyear',
      icon: 'calendar',
      title: lang === 'zh-CN' ? '元旦跑者' : 'New Year Runner',
      subtitle: lang === 'zh-CN' ? '在元旦当天完成了跑步' : 'Started the year with a run on Jan 1',
      hint: lang === 'zh-CN' ? '在 1 月 1 日完成一次跑步' : 'Run on January 1st',
      progress: Math.min(1, newYearRuns),
      earned: newYearRuns >= 1,
    },
    {
      id: 'christmas',
      icon: 'calendar',
      title: lang === 'zh-CN' ? '圣诞跑者' : 'Christmas Runner',
      subtitle: lang === 'zh-CN' ? '圣诞节也坚持跑步' : 'Stayed active on Christmas Day',
      hint: lang === 'zh-CN' ? '在 12 月 25 日完成一次跑步' : 'Run on December 25th',
      progress: Math.min(1, christmasRuns),
      earned: christmasRuns >= 1,
    },
    {
      id: 'spring',
      icon: 'park',
      title: lang === 'zh-CN' ? '春意盎然' : 'Spring Bloom',
      subtitle: lang === 'zh-CN' ? '在春季记录过跑步' : 'Recorded a run during spring',
      hint: lang === 'zh-CN' ? '记录一次含「春」字的路线或活动名' : 'Log a run named with spring keywords',
      progress: Math.min(1, springRuns),
      earned: springRuns >= 1,
    },
    {
      id: 'summer',
      icon: 'park',
      title: lang === 'zh-CN' ? '盛夏坚持' : 'Summer Heat',
      subtitle: lang === 'zh-CN' ? '在夏季记录过跑步' : 'Recorded a run during summer',
      hint: lang === 'zh-CN' ? '记录一次含「夏」字的路线或活动名' : 'Log a run named with summer keywords',
      progress: Math.min(1, summerRuns),
      earned: summerRuns >= 1,
    },
    {
      id: 'autumn',
      icon: 'park',
      title: lang === 'zh-CN' ? '秋日收获' : 'Autumn Miles',
      subtitle: lang === 'zh-CN' ? '在秋季记录过跑步' : 'Recorded a run during autumn',
      hint: lang === 'zh-CN' ? '记录一次含「秋」字的路线或活动名' : 'Log a run named with autumn or fall keywords',
      progress: Math.min(1, autumnRuns),
      earned: autumnRuns >= 1,
    },
    {
      id: 'winter',
      icon: 'park',
      title: lang === 'zh-CN' ? '寒冬不惧' : 'Winter Warrior',
      subtitle: lang === 'zh-CN' ? '在冬季记录过跑步' : 'Recorded a run during winter',
      hint: lang === 'zh-CN' ? '记录一次含「冬」字的路线或活动名' : 'Log a run named with winter keywords',
      progress: Math.min(1, winterRuns),
      earned: winterRuns >= 1,
    },
    // ===== Route themes =====
    {
      id: 'park',
      icon: 'park',
      title: lang === 'zh-CN' ? '公园探索家' : 'Park Explorer',
      subtitle: lang === 'zh-CN' ? `已经记录 ${parkRuns} 次公园或绿道路线` : `${parkRuns} park or trail themed efforts`,
      hint: lang === 'zh-CN' ? '记录一次名称含「公园」或「绿道」的路线' : 'Log a run named with park, trail, or greenway',
      progress: Math.min(1, parkRuns),
      earned: parkRuns >= 1,
    },
    {
      id: 'bridge',
      icon: 'bridge',
      title: lang === 'zh-CN' ? '桥梁猎手' : 'Bridge Chaser',
      subtitle: lang === 'zh-CN' ? `已经记录 ${bridgeRuns} 次桥边或滨水路线` : `${bridgeRuns} bridge or waterfront routes logged`,
      hint: lang === 'zh-CN' ? '记录一次名称含「桥」或「滨水」的路线' : 'Log a run named with bridge or waterfront',
      progress: Math.min(1, bridgeRuns),
      earned: bridgeRuns >= 1,
    },
    {
      id: 'city',
      icon: 'city',
      title: lang === 'zh-CN' ? '城市地标收藏家' : 'City Landmark Hunter',
      subtitle: lang === 'zh-CN' ? `已经记录 ${cityRuns} 次城市地标路线` : `${cityRuns} city landmark style runs`,
      hint: lang === 'zh-CN' ? '记录一次含城市地标关键词的路线' : 'Log a run near a city landmark or plaza',
      progress: Math.min(1, cityRuns),
      earned: cityRuns >= 1,
    },
    {
      id: 'long-run',
      icon: 'summit',
      title: lang === 'zh-CN' ? '长距离里程碑' : 'Long Run Milestone',
      subtitle: lang === 'zh-CN' ? `单次最长 ${longestRunKm.toFixed(1)} km` : `Longest single run: ${longestRunKm.toFixed(1)} km`,
      hint: lang === 'zh-CN' ? `最长单次 ${longestRunKm.toFixed(1)} km，目标 15 km` : `Best ${longestRunKm.toFixed(1)} km — reach 15 km to unlock`,
      progress: Math.min(1, longestRunKm / 15),
      earned: longestRunKm >= 15,
    },
    {
      id: 'hundred-runs',
      icon: 'trophy',
      title: lang === 'zh-CN' ? '百跑徽章' : 'Hundred Run Badge',
      subtitle: lang === 'zh-CN' ? `累计 ${runs.length} 次跑步` : `${runs.length} total runs recorded`,
      hint: lang === 'zh-CN' ? `${runs.length} / 100 次跑步` : `${runs.length} / 100 runs recorded`,
      progress: Math.min(1, runs.length / 100),
      earned: runs.length >= 100,
    },
  ];

  const earnedRewards = allRewards.filter((item) => item.earned);
  const upcomingRewards = allRewards
    .filter((item) => !item.earned)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);
  const mapHighlights = [
    parkRuns > 0 ? { key: 'park', icon: 'park', label: lang === 'zh-CN' ? '公园路线' : 'Park routes', count: parkRuns } : null,
    bridgeRuns > 0 ? { key: 'bridge', icon: 'bridge', label: lang === 'zh-CN' ? '桥梁路线' : 'Bridge routes', count: bridgeRuns } : null,
    cityRuns > 0 ? { key: 'city', icon: 'city', label: lang === 'zh-CN' ? '城市地标' : 'City landmarks', count: cityRuns } : null,
  ].filter(Boolean);

  return {
    allRewards,
    earnedRewards,
    upcomingRewards,
    mapHighlights,
  };
}
