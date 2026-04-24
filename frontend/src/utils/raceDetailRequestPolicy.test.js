import assert from 'node:assert/strict';

import { shouldFetchRaceElevationProfile } from './raceDetailRequestPolicy.js';

assert.equal(
  shouldFetchRaceElevationProfile({
    isAuthenticated: false,
    raceName: 'Chicago Marathon',
    courseMapRequestSettled: true,
    hasAlignedElevationSamples: false,
  }),
  false,
);

assert.equal(
  shouldFetchRaceElevationProfile({
    isAuthenticated: true,
    raceName: '',
    courseMapRequestSettled: true,
    hasAlignedElevationSamples: false,
  }),
  false,
);

assert.equal(
  shouldFetchRaceElevationProfile({
    isAuthenticated: true,
    raceName: 'Chicago Marathon',
    courseMapRequestSettled: false,
    hasAlignedElevationSamples: false,
  }),
  false,
);

assert.equal(
  shouldFetchRaceElevationProfile({
    isAuthenticated: true,
    raceName: 'Chicago Marathon',
    courseMapRequestSettled: true,
    hasAlignedElevationSamples: true,
  }),
  false,
);

assert.equal(
  shouldFetchRaceElevationProfile({
    isAuthenticated: true,
    raceName: 'Chicago Marathon',
    courseMapRequestSettled: true,
    hasAlignedElevationSamples: false,
  }),
  true,
);

console.log('[PASS] Race detail request policy guardrails passed.');
