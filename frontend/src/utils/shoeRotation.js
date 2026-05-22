const RECENT_SHOE_SIGNAL_WINDOW_DAYS = 21;

const REDDIT_RECOMMENDED_SHOES = [
  { brand: 'ASICS', model: 'Gel-Nimbus 26', type: 'daily', paceRange: [300, 420], redditNote: 'r/RunningShoeGeeks all-time favorite daily trainer' },
  { brand: 'New Balance', model: 'Fresh Foam X 1080 v14', type: 'daily', paceRange: [300, 420], redditNote: 'r/RunningShoeGeeks top plush daily' },
  { brand: 'ASICS', model: 'Novablast 4', type: 'daily', paceRange: [270, 390], redditNote: 'r/RunningShoeGeeks most-hyped bouncy trainer' },
  { brand: 'Saucony', model: 'Endorphin Speed 4', type: 'speed', paceRange: [230, 330], redditNote: 'r/RunningShoeGeeks speed-day legend' },
  { brand: 'Nike', model: 'Pegasus 41', type: 'daily', paceRange: [280, 400], redditNote: 'r/RunningShoeGeeks proven daily workhorse' },
  { brand: 'Saucony', model: 'Ride 17', type: 'daily', paceRange: [290, 420], redditNote: 'r/RunningShoeGeeks versatile all-rounder' },
  { brand: 'HOKA', model: 'Clifton 9', type: 'daily', paceRange: [310, 450], redditNote: 'r/RunningShoeGeeks cushioned favorite' },
  { brand: 'Brooks', model: 'Ghost 16', type: 'daily', paceRange: [310, 450], redditNote: 'r/RunningShoeGeeks reliable classic' },
  { brand: 'Nike', model: 'Vomero 18', type: 'daily', paceRange: [300, 430], redditNote: 'r/RunningShoeGeeks max cushion pick' },
  { brand: 'Adidas', model: 'Boston 12', type: 'speed', paceRange: [240, 340], redditNote: 'r/RunningShoeGeeks tempo trainer pick' },
  { brand: 'ASICS', model: 'Magic Speed 4', type: 'race', paceRange: [220, 310], redditNote: 'r/RunningShoeGeeks budget race shoe' },
  { brand: 'Nike', model: 'Vaporfly 3', type: 'race', paceRange: [200, 290], redditNote: 'r/RunningShoeGeeks ultimate race day' },
];

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function normalizeWear(shoe) {
  const current = Number(shoe?.currentDistanceKm || 0);
  const max = Number(shoe?.maxDistanceKm || 0);
  if (!max || max <= 0) return current;
  return current / max;
}

function pickRedditRecommendation(avgPaceSecPerKm) {
  if (!avgPaceSecPerKm || avgPaceSecPerKm <= 0) {
    return REDDIT_RECOMMENDED_SHOES[0];
  }
  const matching = REDDIT_RECOMMENDED_SHOES.filter(
    (shoe) => avgPaceSecPerKm >= shoe.paceRange[0] && avgPaceSecPerKm <= shoe.paceRange[1],
  );
  const pool = matching.length > 0 ? matching : REDDIT_RECOMMENDED_SHOES.filter((shoe) => shoe.type === 'daily');
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return pool[dayOfYear % pool.length];
}

function pickOwnedFallback(activeShoes) {
  return [...activeShoes].sort((left, right) => {
    if (Boolean(right?.isPrimary) !== Boolean(left?.isPrimary)) {
      return Number(Boolean(right?.isPrimary)) - Number(Boolean(left?.isPrimary));
    }
    return normalizeWear(left) - normalizeWear(right);
  })[0] || null;
}

export function getRunTimestamp(run) {
  const candidates = [
    run?.startDateLocal,
    run?.startDate,
    run?.activityDate,
    run?.date,
    run?.createdAt,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  const numericId = Number(run?.id || run?.activityId || 0);
  return Number.isFinite(numericId) ? numericId : 0;
}

export function getRecentRuns(runs, windowDays = RECENT_SHOE_SIGNAL_WINDOW_DAYS) {
  const cutoff = Date.now() - (windowDays * 24 * 60 * 60 * 1000);
  return runs
    .filter((run) => getRunTimestamp(run) >= cutoff)
    .sort((left, right) => getRunTimestamp(right) - getRunTimestamp(left));
}

export function buildShoePerformanceInsights(shoes, runs) {
  const eligibleRuns = runs
    .map((run) => {
      const shoeId = run.shoeId;
      const distanceKm = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
      const movingTimeSeconds = Number(run.movingTimeSeconds || run.durationSeconds || 0);
      const averageHeartRate = Number(run.averageHeartRate || 0);
      const averageCadence = Number(run.averageCadence || 0);
      if (!shoeId || distanceKm < 4 || movingTimeSeconds <= 0 || averageHeartRate <= 0) return null;
      return {
        shoeId,
        distanceKm,
        movingTimeSeconds,
        averageHeartRate,
        averageCadence: averageCadence > 0 ? averageCadence : null,
        paceSecPerKm: movingTimeSeconds / Math.max(distanceKm, 0.001),
      };
    })
    .filter(Boolean);

  const byShoe = new Map();
  for (const run of eligibleRuns) {
    if (!byShoe.has(run.shoeId)) byShoe.set(run.shoeId, []);
    byShoe.get(run.shoeId).push(run);
  }

  const insights = new Map();
  let topInsight = null;

  for (const shoe of shoes) {
    const shoeRuns = byShoe.get(shoe.id) || [];
    if (shoeRuns.length < 3) continue;

    const anchorPace = Math.round(median(shoeRuns.map((run) => run.paceSecPerKm)) / 15) * 15;
    const samePaceRuns = shoeRuns.filter((run) => Math.abs(run.paceSecPerKm - anchorPace) <= 20);
    const comparisonRuns = eligibleRuns.filter((run) => run.shoeId !== shoe.id && Math.abs(run.paceSecPerKm - anchorPace) <= 20);
    if (samePaceRuns.length < 2 || comparisonRuns.length < 2) continue;

    const shoeHr = average(samePaceRuns.map((run) => run.averageHeartRate));
    const otherHr = average(comparisonRuns.map((run) => run.averageHeartRate));
    const deltaHr = otherHr - shoeHr;
    const shoeCadenceValues = samePaceRuns.filter((run) => run.averageCadence != null).map((run) => run.averageCadence);
    const otherCadenceValues = comparisonRuns.filter((run) => run.averageCadence != null).map((run) => run.averageCadence);
    const cadenceDelta = shoeCadenceValues.length >= 2 && otherCadenceValues.length >= 2
      ? average(shoeCadenceValues) - average(otherCadenceValues)
      : null;

    const insight = {
      shoeId: shoe.id,
      paceSecPerKm: anchorPace,
      deltaHr,
      cadenceDelta,
      sampleCount: samePaceRuns.length,
      compareCount: comparisonRuns.length,
      positive: deltaHr > 0.8,
    };

    insights.set(shoe.id, insight);
    if (!topInsight || Math.abs(deltaHr) > Math.abs(topInsight.deltaHr)) {
      topInsight = insight;
    }
  }

  return { byShoe: insights, topInsight };
}

export function buildRecentShoeSignal(shoes, runs, options = {}) {
  const { preferOwnedFallback = false } = options;
  const activeShoes = (Array.isArray(shoes) ? shoes : []).filter((shoe) => !shoe?.retired);
  const recentRuns = getRecentRuns(Array.isArray(runs) ? runs : []);
  const performanceInsights = buildShoePerformanceInsights(activeShoes, recentRuns);
  const recentPerformanceRuns = recentRuns.filter((run) => {
    const km = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
    const sec = Number(run.movingTimeSeconds || run.durationSeconds || 0);
    return km >= 1 && sec > 0;
  });

  if (performanceInsights.topInsight?.positive) {
    const recommendedShoe = activeShoes.find((shoe) => shoe.id === performanceInsights.topInsight.shoeId) || null;
    if (recommendedShoe) {
      return {
        recentRuns,
        recentPerformanceRuns,
        performanceInsights,
        recommendation: {
          type: 'insight',
          shoe: recommendedShoe,
          avgPace: performanceInsights.topInsight.paceSecPerKm,
          runCount: performanceInsights.topInsight.sampleCount,
          insight: performanceInsights.topInsight,
        },
      };
    }
  }

  if (recentPerformanceRuns.length === 0) {
    if (preferOwnedFallback && activeShoes.length > 0) {
      return {
        recentRuns,
        recentPerformanceRuns,
        performanceInsights,
        recommendation: {
          type: 'primary',
          shoe: pickOwnedFallback(activeShoes),
          avgPace: null,
          runCount: 0,
        },
      };
    }
    return {
      recentRuns,
      recentPerformanceRuns,
      performanceInsights,
      recommendation: null,
    };
  }

  const avgPace = average(recentPerformanceRuns.map((run) => {
    const km = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
    const sec = Number(run.movingTimeSeconds || run.durationSeconds || 0);
    return sec / km;
  }));

  const activeShoeIds = new Set(activeShoes.map((shoe) => shoe.id));
  const recentLinkedRuns = recentPerformanceRuns.filter((run) => activeShoeIds.has(run.shoeId));

  if (activeShoes.length > 0 && recentLinkedRuns.length > 0) {
    const recentByShoe = new Map();
    recentLinkedRuns.forEach((run) => {
      const current = recentByShoe.get(run.shoeId) || [];
      current.push(run);
      recentByShoe.set(run.shoeId, current);
    });

    const best = activeShoes
      .map((shoe) => {
        const shoeRuns = recentByShoe.get(shoe.id) || [];
        if (!shoeRuns.length) return null;
        return {
          shoe,
          count: shoeRuns.length,
          latest: Math.max(...shoeRuns.map((run) => getRunTimestamp(run))),
          avgPace: average(shoeRuns.map((run) => {
            const km = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
            const sec = Number(run.movingTimeSeconds || run.durationSeconds || 0);
            return sec / km;
          })),
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return right.latest - left.latest;
      })[0];

    if (best) {
      return {
        recentRuns,
        recentPerformanceRuns,
        performanceInsights,
        recommendation: {
          type: 'rotation',
          shoe: best.shoe,
          avgPace: best.avgPace,
          runCount: best.count,
          totalRecentRuns: recentPerformanceRuns.length,
        },
      };
    }
  }

  if (preferOwnedFallback && activeShoes.length > 0) {
    return {
      recentRuns,
      recentPerformanceRuns,
      performanceInsights,
      recommendation: {
        type: 'primary',
        shoe: pickOwnedFallback(activeShoes),
        avgPace,
        runCount: recentPerformanceRuns.length,
      },
    };
  }

  return {
    recentRuns,
    recentPerformanceRuns,
    performanceInsights,
    recommendation: {
      type: 'recommend',
      shoe: pickRedditRecommendation(avgPace),
      avgPace,
      runCount: recentPerformanceRuns.length,
    },
  };
}

export function calculateRotationHealth(shoes, runs) {
  const activeShoes = (Array.isArray(shoes) ? shoes : []).filter((s) => !s?.retired);
  const recentRuns = getRecentRuns(Array.isArray(runs) ? runs : []);
  const shoeIdsInRecentRuns = new Set(
    recentRuns.map((r) => r.shoeId).filter(Boolean)
  );
  
  const rotationSize = activeShoes.length;
  const uniqueUsed = shoeIdsInRecentRuns.size;
  
  if (rotationSize <= 1) {
    return {
      status: 'minimal',
      score: 0,
      uniqueUsed,
      rotationSize,
    };
  }

  if (recentRuns.length < 3) {
    return {
      status: 'minimal',
      score: 0,
      uniqueUsed,
      rotationSize,
    };
  }

  const ratio = uniqueUsed / rotationSize;
  
  let status = 'stale';
  if (ratio >= 0.8 || uniqueUsed >= 3) status = 'excellent';
  else if (ratio >= 0.5 || uniqueUsed >= 2) status = 'good';

  return {
    status,
    score: Math.round(ratio * 100),
    uniqueUsed,
    rotationSize,
    recentCount: recentRuns.length,
  };
}

const SHOE_TYPE_LIFESPAN_KM = {
  daily: 800,
  stability: 800,
  speed: 600,
  race: 500,
  trail: 650,
};

export function predictRetirement(shoe, runs) {
  if (!shoe || shoe.retired) return null;

  const typeLifespan = SHOE_TYPE_LIFESPAN_KM[shoe.type] || 800;
  const lifespanKm = Number(shoe.maxDistanceKm) || typeLifespan;
  const currentKm = Number(shoe.currentDistanceKm) || 0;

  if (lifespanKm <= 0 && currentKm <= 0) return null;

  const remainingKm = Math.max(0, lifespanKm - currentKm);
  const healthPercent = lifespanKm > 0 ? Math.round((remainingKm / lifespanKm) * 100) : 0;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentShoeRuns = (Array.isArray(runs) ? runs : []).filter((run) => {
    if (run.shoeId !== shoe.id) return false;
    return getRunTimestamp(run) >= thirtyDaysAgo;
  });

  if (recentShoeRuns.length < 2) {
    return { remainingKm, estimatedRetirementDate: null, daysLeft: null, healthPercent };
  }

  const recentDistance = recentShoeRuns.reduce((sum, run) => {
    const km = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
    return sum + km;
  }, 0);

  const dailyRate = recentDistance / 30;
  if (dailyRate <= 0) {
    return { remainingKm, estimatedRetirementDate: null, daysLeft: null, healthPercent };
  }

  const daysLeft = Math.round(remainingKm / dailyRate);
  const estimatedRetirementDate = daysLeft > 0
    ? new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000)
    : null;

  return { remainingKm, estimatedRetirementDate, daysLeft, healthPercent };
}

export { RECENT_SHOE_SIGNAL_WINDOW_DAYS };
