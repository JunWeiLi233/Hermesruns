import { describe, expect, it } from 'vitest';

import {
  buildAcknowledgedSnapshot,
  buildRecordSnapshot,
  collectPersonalRecordBreakthroughs,
} from './ProfileDashboard';

// Two recent runs; imported history (older dates, newer ids) is intentionally
// absent — the date-ordered dashboard feed never includes it.
const runs = [
  { id: 101, startTime: '2026-08-10T07:00:00' },
  { id: 102, startTime: '2026-08-12T07:00:00' },
];

function personalRecords({ fiveKmActivityId, fiveKmSeconds, longestActivityId, longestKm }) {
  return {
    distances: [],
    records: {
      '5km': fiveKmActivityId == null ? undefined : {
        key: '5km',
        activityId: fiveKmActivityId,
        elapsedSeconds: fiveKmSeconds,
        paceSecondsPerKm: fiveKmSeconds / 5,
        recordedAt: '2025-10-25T07:30',
        sourceRunName: 'Morning Run',
      },
    },
    longestRun: longestActivityId == null ? null : {
      primaryValue: longestKm,
      activityId: longestActivityId,
    },
    fastestPace: null,
    mostElevation: null,
  };
}

// Snapshot in the pre-fix format: acknowledgedBreakthroughs signatures, no
// celebratedRecords map, and a high-water mark that misses backdated imports.
function legacySnapshot(records, longestRun, latestSeenActivityId) {
  return {
    version: 1,
    latestSeenActivityId,
    records,
    longestRun,
    fastestPace: null,
    mostElevation: null,
    acknowledgedBreakthroughs: [],
  };
}

describe('profile dashboard PR celebration', () => {
  it('celebrates once when a brand-new activity sets a better record', () => {
    const previous = buildAcknowledgedSnapshot(null, personalRecords({ fiveKmActivityId: 90, fiveKmSeconds: 1200 }), runs, []);
    const payload = personalRecords({ fiveKmActivityId: 103, fiveKmSeconds: 1150 });
    payload.records['5km'].sourceRunName = 'Track Intervals';
    const withNewRun = [...runs, { id: 103, startTime: '2026-08-13T07:00:00' }];

    const breakthroughs = collectPersonalRecordBreakthroughs(previous, payload, withNewRun);
    expect(breakthroughs).toHaveLength(1);
    expect(breakthroughs[0].key).toBe('5km');

    const acknowledged = buildAcknowledgedSnapshot(previous, payload, withNewRun, breakthroughs);
    expect(collectPersonalRecordBreakthroughs(acknowledged, payload, withNewRun)).toEqual([]);
  });

  it('does not re-celebrate when the same activity recomputes to a faster time', () => {
    const payload = personalRecords({ fiveKmActivityId: 103, fiveKmSeconds: 1150 });
    const previous = buildAcknowledgedSnapshot(null, payload, runs, [
      { type: 'distance', key: '5km', record: payload.records['5km'] },
    ]);

    // GPS samples finish landing asynchronously; the 5km time improves for the
    // same record-holding activity.
    const recomputed = personalRecords({ fiveKmActivityId: 103, fiveKmSeconds: 1100 });
    expect(collectPersonalRecordBreakthroughs(previous, recomputed, runs)).toEqual([]);
  });

  it('advances the high-water mark past backdated imports and celebrates them exactly once', () => {
    const baseline = legacySnapshot(
      { '5km': { key: '5km', elapsedSeconds: 1200, paceSecondsPerKm: 240, recordedAt: '2025-06-01T07:30', activityId: 90 } },
      null,
      102,
    );
    // Imported 2025-dated run with a brand-new id takes the 5km record; the
    // date-ordered run feed still only knows about runs 101/102.
    const payload = personalRecords({ fiveKmActivityId: 130, fiveKmSeconds: 1150 });

    const breakthroughs = collectPersonalRecordBreakthroughs(baseline, payload, runs);
    expect(breakthroughs).toHaveLength(1);

    const acknowledged = buildAcknowledgedSnapshot(baseline, payload, runs, breakthroughs);
    expect(acknowledged.latestSeenActivityId).toBe(130);
    expect(collectPersonalRecordBreakthroughs(acknowledged, payload, runs)).toEqual([]);
    // Even a later recomputation of that import must stay silent.
    expect(collectPersonalRecordBreakthroughs(acknowledged, personalRecords({ fiveKmActivityId: 130, fiveKmSeconds: 1100 }), runs)).toEqual([]);
  });

  it('seeds celebration state from legacy snapshots so the upgrade never re-pops old records', () => {
    const legacy = legacySnapshot(
      { '5km': { key: '5km', elapsedSeconds: 1150, paceSecondsPerKm: 230, recordedAt: '2025-10-25T07:30', activityId: 130 } },
      null,
      102,
    );
    const recomputed = personalRecords({ fiveKmActivityId: 130, fiveKmSeconds: 1100 });

    expect(collectPersonalRecordBreakthroughs(legacy, recomputed, runs)).toEqual([]);
  });

  it('celebrates summary records once per record-holding activity', () => {
    const baseline = legacySnapshot(
      {},
      { primaryValue: 30, activityId: 90 },
      102,
    );
    const payload = personalRecords({ longestActivityId: 130, longestKm: 42.2 });

    const breakthroughs = collectPersonalRecordBreakthroughs(baseline, payload, runs);
    expect(breakthroughs).toHaveLength(1);
    expect(breakthroughs[0].type).toBe('longest');

    const acknowledged = buildAcknowledgedSnapshot(baseline, payload, runs, breakthroughs);
    // Distance correction recomputes the same run slightly longer: same
    // activity, no second celebration.
    const recomputed = personalRecords({ longestActivityId: 130, longestKm: 42.4 });
    expect(collectPersonalRecordBreakthroughs(acknowledged, recomputed, runs)).toEqual([]);
  });

  it('still celebrates a genuinely newer record after a previous celebration', () => {
    const payload = personalRecords({ fiveKmActivityId: 103, fiveKmSeconds: 1150 });
    const previous = buildAcknowledgedSnapshot(null, payload, runs, [
      { type: 'distance', key: '5km', record: payload.records['5km'] },
    ]);
    const better = personalRecords({ fiveKmActivityId: 150, fiveKmSeconds: 1100 });
    const withNewRun = [...runs, { id: 150, startTime: '2026-08-14T07:00:00' }];

    const breakthroughs = collectPersonalRecordBreakthroughs(previous, better, withNewRun);
    expect(breakthroughs).toHaveLength(1);
    expect(breakthroughs[0].record.activityId).toBe(150);
  });

  it('folds record-holder ids into the snapshot high-water mark', () => {
    const snapshot = buildRecordSnapshot(personalRecords({ fiveKmActivityId: 130, fiveKmSeconds: 1150 }), runs);
    expect(snapshot.latestSeenActivityId).toBe(130);
  });
});
