import { describe, expect, it } from 'vitest';

import { normalizeActivitySummaries } from './activityApi';

describe('normalizeActivitySummaries', () => {
  it('keeps activity records and drops malformed payload entries', () => {
    const firstActivity = {
      id: 42,
      distanceKm: 10.3,
      movingTimeSeconds: 3244,
      startTime: '2026-08-13T11:00:00Z',
    };

    expect(normalizeActivitySummaries([
      firstActivity,
      null,
      'invalid',
      17,
      ['invalid'],
      { id: 'legacy-run', distanceMeters: 5000 },
    ])).toEqual([
      firstActivity,
      { id: 'legacy-run', distanceMeters: 5000 },
    ]);
  });

  it('returns an empty list for non-array API payloads', () => {
    expect(normalizeActivitySummaries({ items: [] })).toEqual([]);
    expect(normalizeActivitySummaries(undefined)).toEqual([]);
  });
});
