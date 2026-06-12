import { buildCatalogRewardEntries } from './rewardCatalog.js';

function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getConsecutiveRunDayStreak(runs) {
  const sortedDays = [...new Set(
    runs
      .map((run) => new Date(run.startTime || run.startDate || 0))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => startOfDay(date)),
  )].sort((a, b) => b - a);

  if (sortedDays.length === 0) return 0;
  if (sortedDays[0] !== startOfDay(new Date())) return 0;
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
  if (sortedWeeks[0] !== startOfWeek(new Date()).getTime()) return 0;
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

export function RewardGlyph({ icon }) {
  if (icon === 'park') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 C9 3 7 5.2 7 8 c0 1.6 0.6 3 1.7 4 H5.8 l2.8 3.6 h2.3 V21 h2.2 v-5.4 h2.3 l2.8-3.6 h-2.9 C16.4 11 17 9.6 17 8 c0-2.8-2-5-5-5 Z" />
      </svg>
    );
  }
  if (icon === 'bridge') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17 h16 v2 H4 Z M5 15 c1.8 0 2.2-6 7-6 s5.2 6 7 6 v2 c-2 0-3.3-1.3-4.5-2.5 C13.5 13.3 13 13 12 13 s-1.5 0.3-2.5 1.5 C8.3 15.7 7 17 5 17 Z" />
      </svg>
    );
  }
  if (icon === 'city') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20 h16 v2 H4 Z M6 8 h4 v12 H6 Z M11 4 h7 v16 h-7 Z M7.5 10.5 h1 v1 h-1 Z M7.5 13.5 h1 v1 h-1 Z M13 7 h1.2 v1.2 H13 Z M15.8 7 h1.2 v1.2 h-1.2 Z M13 10 h1.2 v1.2 H13 Z M15.8 10 h1.2 v1.2 h-1.2 Z M13 13 h1.2 v1.2 H13 Z M15.8 13 h1.2 v1.2 h-1.2 Z" />
      </svg>
    );
  }
  if (icon === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2 h2 v3 H7 Z M15 2 h2 v3 h-2 Z M4 5 h16 v15 H4 Z M6 9 h12 v9 H6 Z" />
      </svg>
    );
  }
  if (icon === 'crown') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18 h16 l-1.5 3 h-13 Z M5 7 l4 4 3-6 3 6 4-4 1 9 H4 Z" />
      </svg>
    );
  }
  if (icon === 'summit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 20 11 6 l2.3 4 1.7-2 6 12 Z M13 6 h5 l-2 3 Z" />
      </svg>
    );
  }
  if (icon === 'streak') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2 6 13 h4 l-1 9 7-11 h-4 l1-9 Z" />
      </svg>
    );
  }
  if (icon === 'route') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4 c2.8 0 4.2 2 6.2 2 s3.2-2 5.8-2 c2.1 0 3.5 1.4 3.5 3.4 0 4.5-6.4 4.1-6.4 7.7 0 1.5 1.1 2.5 2.9 2.5 h2.5 v2 H17 c-3.2 0-5.2-1.8-5.2-4.5 0-4.6 6.4-4.2 6.4-7.6 0-.9-.6-1.5-1.5-1.5-1.8 0-3 2-5.6 2S7.4 6 5 6H3.5V4H5Z" />
      </svg>
    );
  }
  if (icon === 'mountain') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 20 9.5 7 l3 5 2.4-3.4L21 20H3Zm7-7.8L7.4 17h5.8L10 12.2Zm5 1L12.8 17h4.6L15 13.2Z" />
      </svg>
    );
  }
  if (icon === 'sun') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 2h2v4h-2V2Zm0 16h2v4h-2v-4ZM2 11h4v2H2v-2Zm16 0h4v2h-4v-2ZM4.2 5.6l1.4-1.4L8.4 7 7 8.4 4.2 5.6Zm11.4 11.4 1.4-1.4 2.8 2.8-1.4 1.4-2.8-2.8Zm2.8-12.8 1.4 1.4L17 8.4 15.6 7l2.8-2.8ZM7 15.6 8.4 17l-2.8 2.8-1.4-1.4L7 15.6ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
      </svg>
    );
  }
  if (icon === 'moon') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.6 2.7A8.7 8.7 0 1 0 21.3 14 7 7 0 0 1 10 5.7a7 7 0 0 1 5.6-3Z" />
      </svg>
    );
  }
  if (icon === 'rain') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.5 17h10A4.5 4.5 0 0 0 18 8.1 6.1 6.1 0 0 0 6.3 9.4 3.9 3.9 0 0 0 7.5 17Zm.5 2h2l-1.6 3H6.4L8 19Zm4.2 0h2l-1.6 3h-2l1.6-3Zm4.2 0h2l-1.6 3h-2l1.6-3Z" />
      </svg>
    );
  }
  if (icon === 'track') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4h8a8 8 0 0 1 0 16H8A8 8 0 0 1 8 4Zm0 3a5 5 0 0 0 0 10h8a5 5 0 0 0 0-10H8Zm0 3h8a2 2 0 1 1 0 4H8a2 2 0 1 1 0-4Z" />
      </svg>
    );
  }
  if (icon === 'bolt') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2 4 13h6l-1 9 11-13h-6l-1-7Z" />
      </svg>
    );
  }
  if (icon === 'flag') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3h2v18H5V3Zm3 1h11l-2.4 4L19 12H8V4Z" />
      </svg>
    );
  }
  if (icon === 'wave') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2v3c-2.5 0-2.5-2-5-2s-2.5 2-5 2-2.5-2-5-2-2.5 2-5 2v-3Zm0-6c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2v3c-2.5 0-2.5-2-5-2s-2.5 2-5 2-2.5-2-5-2-2.5 2-5 2V9Z" />
      </svg>
    );
  }
  if (icon === 'leaf') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 4C11 4 5 8.8 5 15.2c0 2.7 1.9 4.8 4.7 4.8C16.4 20 20 13 20 4Zm-4.2 5.3C13.2 12.6 11 15 7 18c2.4-4.7 5.1-7.1 8.8-8.7Z" />
      </svg>
    );
  }
  if (icon === 'recovery') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21C6.8 17.4 4 14.2 4 10.4A4.4 4.4 0 0 1 8.4 6c1.5 0 2.8.7 3.6 1.8A4.4 4.4 0 0 1 20 10.4c0 3.8-2.8 7-8 10.6Zm-1-11v3H8v2h3v3h2v-3h3v-2h-3v-3h-2Z" />
      </svg>
    );
  }
  if (icon === 'shoe') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 13.5c2.8 1.3 4.5.9 6.1-.2 1.2-.8 1.9-2 3-2.7 1.3-.8 2.8-.5 4 .6 1.3 1.2 2.1 2.8 3.9 3.6V18H4v-4.5Zm2 2.1V16h12.5c-1.1-.7-1.9-1.7-2.8-2.5-.5-.4-1-.5-1.4-.3-.6.3-1.1 1.2-2.1 1.9-1.7 1.1-3.7 1.4-6.2.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 15 9 h7 l-5.5 4.2 2.1 7.1 L12 16.7 5.4 20.3 l2.1-7.1 L2 9 h7 Z" />
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

  const allRewards = [
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
      icon: 'medal',
      title: lang === 'zh-CN' ? '百跑徽章' : 'Hundred Run Badge',
      subtitle: lang === 'zh-CN' ? `累计 ${runs.length} 次跑步` : `${runs.length} total runs recorded`,
      hint: lang === 'zh-CN' ? `${runs.length} / 100 次跑步` : `${runs.length} / 100 runs recorded`,
      progress: Math.min(1, runs.length / 100),
      earned: runs.length >= 100,
    },
    ...buildCatalogRewardEntries(runs, lang),
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
