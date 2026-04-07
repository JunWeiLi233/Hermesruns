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
