export const RACE_INTEL_OVERRIDES = {
  'boston-marathon': { courseKey: 'point_to_point', ascentMeters: 247, predictionPenaltyPct: 2.4 },
  'chicago-marathon': { courseKey: 'flat_city', ascentMeters: 35, predictionPenaltyPct: 0.3 },
  'new-york-city-marathon': { courseKey: 'bridge_rolling', ascentMeters: 320, predictionPenaltyPct: 3.2 },
  'big-sur-marathon': { courseKey: 'coastal_hilly', ascentMeters: 540, predictionPenaltyPct: 6.8 },
  'honolulu-marathon': { courseKey: 'rolling_city', ascentMeters: 170, predictionPenaltyPct: 1.7 },
  'berlin-marathon': { courseKey: 'flat_city', ascentMeters: 45, predictionPenaltyPct: 0.2 },
  'valencia-marathon': { courseKey: 'flat_city', ascentMeters: 30, predictionPenaltyPct: 0.1 },
  'tokyo-marathon': { courseKey: 'flat_city', ascentMeters: 70, predictionPenaltyPct: 0.6 },
  'london-marathon': { courseKey: 'flat_city', ascentMeters: 75, predictionPenaltyPct: 0.7 },
  'amsterdam-marathon': { courseKey: 'flat_city', ascentMeters: 28, predictionPenaltyPct: 0.1 },
  'rotterdam-marathon': { courseKey: 'flat_city', ascentMeters: 40, predictionPenaltyPct: 0.2 },
  'nice-cannes-marathon': { courseKey: 'coastal_hilly', ascentMeters: 155, predictionPenaltyPct: 2.1 },
  'bergen-city-marathon': { courseKey: 'rolling_city', ascentMeters: 210, predictionPenaltyPct: 2.8 },
  'helsinki-marathon': { courseKey: 'rolling_city', ascentMeters: 125, predictionPenaltyPct: 1.4 },
  'athens-classic-marathon': { courseKey: 'trail_hilly', ascentMeters: 295, predictionPenaltyPct: 4.1 },
};

export const RACE_ELEVATION_PROFILES = {
  'tokyo-marathon': [36, 34, 31, 28, 24, 20, 15, 12, 10, 8, 9, 11, 14, 16, 18, 16, 13, 10, 8, 7, 8, 10, 12, 9, 6],
  'boston-marathon': [146, 142, 137, 131, 126, 118, 110, 104, 96, 88, 79, 70, 63, 69, 76, 71, 82, 74, 59, 43, 31, 24, 18, 12, 8],
  'london-marathon': [18, 17, 16, 15, 14, 13, 14, 16, 18, 17, 16, 15, 15, 16, 17, 16, 15, 14, 13, 14, 15, 16, 16, 15, 14],
  'berlin-marathon': [38, 37, 36, 35, 34, 35, 36, 37, 38, 37, 36, 35, 34, 34, 35, 36, 37, 36, 35, 34, 33, 34, 35, 34, 33],
  'chicago-marathon': [181, 180, 179, 178, 179, 180, 181, 180, 179, 178, 179, 180, 181, 180, 179, 178, 177, 178, 179, 180, 179, 178, 177, 176, 176],
  'new-york-city-marathon': [5, 45, 61, 38, 22, 18, 16, 14, 21, 28, 18, 14, 12, 46, 58, 24, 15, 13, 22, 30, 36, 29, 20, 13, 9],
  'valencia-marathon': [12, 12, 11, 11, 10, 10, 11, 11, 12, 12, 11, 11, 10, 10, 10, 11, 11, 12, 12, 11, 11, 10, 10, 9, 9],
  'amsterdam-marathon': [1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1],
  'rotterdam-marathon': [4, 4, 4, 5, 5, 4, 4, 4, 5, 5, 4, 4, 4, 5, 5, 4, 4, 4, 5, 5, 4, 4, 3, 3, 3],
  'beijing-marathon': [52, 51, 49, 48, 47, 49, 51, 54, 56, 55, 53, 51, 50, 52, 54, 56, 57, 55, 53, 51, 49, 48, 47, 46, 45],
  'shanghai-marathon': [7, 7, 8, 9, 11, 13, 14, 15, 16, 15, 14, 13, 12, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9, 8, 7],
  'guangzhou-marathon': [9, 10, 11, 13, 15, 18, 20, 21, 19, 17, 15, 13, 12, 13, 15, 17, 18, 17, 15, 13, 12, 11, 10, 9, 8],
  'wuhan-marathon': [24, 24, 25, 28, 32, 36, 41, 38, 34, 30, 28, 26, 24, 26, 30, 35, 39, 36, 31, 27, 24, 23, 22, 21, 20],
  'qingdao-marathon': [14, 16, 20, 24, 30, 36, 43, 39, 33, 27, 22, 19, 17, 20, 26, 33, 39, 42, 37, 31, 25, 20, 17, 15, 14],
  'shenzhen-marathon': [6, 8, 11, 15, 19, 24, 29, 25, 20, 16, 13, 11, 10, 12, 16, 21, 26, 28, 24, 18, 14, 11, 9, 8, 7],
  'hangzhou-marathon': [10, 11, 13, 16, 20, 25, 31, 34, 31, 27, 23, 20, 18, 19, 22, 26, 31, 35, 33, 28, 23, 19, 16, 13, 11],
  'chengdu-marathon': [500, 499, 498, 497, 496, 497, 499, 501, 503, 502, 500, 498, 497, 498, 500, 502, 504, 503, 501, 499, 497, 496, 495, 494, 494],
};

function guessRaceIntel(race) {
  const name = `${race?.name || ''} ${race?.location || ''}`.toLowerCase();
  if (name.includes('trail') || name.includes('mountain') || name.includes('athens')) {
    return { courseKey: 'trail_hilly', ascentMeters: 280, predictionPenaltyPct: 4.3 };
  }
  if (name.includes('coast') || name.includes('cannes') || name.includes('sur') || name.includes('cape')) {
    return { courseKey: 'coastal_hilly', ascentMeters: 180, predictionPenaltyPct: 2.4 };
  }
  if (name.includes('bridge') || name.includes('new york')) {
    return { courseKey: 'bridge_rolling', ascentMeters: 240, predictionPenaltyPct: 2.8 };
  }
  if (name.includes('downhill') || name.includes('point')) {
    return { courseKey: 'point_to_point', ascentMeters: 120, predictionPenaltyPct: 1.2 };
  }
  if (name.includes('bergen') || name.includes('helsinki') || name.includes('porto') || name.includes('lisbon')) {
    return { courseKey: 'rolling_city', ascentMeters: 130, predictionPenaltyPct: 1.6 };
  }
  return { courseKey: 'flat_city', ascentMeters: 60, predictionPenaltyPct: 0.4 };
}

export function resolveRaceIntel(race) {
  if (!race) return null;
  return {
    estimated: true,
    ...(RACE_INTEL_OVERRIDES[race.id] || guessRaceIntel(race)),
  };
}

export function resolveRaceElevationProfile(race) {
  if (!race) return null;
  return RACE_ELEVATION_PROFILES[race.id] || null;
}

export function getElevationBand(ascentMeters) {
  if (ascentMeters >= 260) return 'hard';
  if (ascentMeters >= 120) return 'moderate';
  return 'fast';
}
