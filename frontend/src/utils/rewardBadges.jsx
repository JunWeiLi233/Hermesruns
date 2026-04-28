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

  // Check if the current streak is still alive (run this week or last week)
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
  if (icon === 'medal') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="6" />
        <path d="M8.5 13 L10 21 l2-3.5 L14 21 l1.5-8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="12" y="11" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#f59e0b">1</text>
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

  // Marathon badge: any run >= 42.195 km
  const marathonCompleted = longestRunKm >= 42.195;
  // Half-marathon badge: any run >= 21.0975 km
  const halfMarathonCompleted = longestRunKm >= 21.0975;
  // 10K badge: any run >= 10 km
  const tenKCompleted = longestRunKm >= 10;
  // 5K badge: any run >= 5 km
  const fiveKCompleted = longestRunKm >= 5;

  // Regional/city detection
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

  // Holiday/seasonal detection
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
    // Marathon series
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
    // Regional achievements
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
      icon: 'crown',
      title: lang === 'zh-CN' ? '大满贯城市' : 'World Major City',
      subtitle: lang === 'zh-CN' ? '在至少一个大满贯赛道上留下足迹' : 'Ran in a World Marathon Major city',
      hint: lang === 'zh-CN' ? '在波士顿、伦敦、柏林、芝加哥、纽约或东京完成一次跑步' : 'Log a run in Boston, London, Berlin, Chicago, NYC, or Tokyo',
      progress: Math.min(1, cityCounts.boston + cityCounts.london + cityCounts.berlin + cityCounts.chicago + cityCounts.nyc + cityCounts.tokyo),
      earned: (cityCounts.boston + cityCounts.london + cityCounts.berlin + cityCounts.chicago + cityCounts.nyc + cityCounts.tokyo) >= 1,
    },
    // Holiday / Seasonal
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
