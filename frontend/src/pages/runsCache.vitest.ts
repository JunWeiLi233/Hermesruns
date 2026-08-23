import { describe, expect, it } from 'vitest';

import {
  createRunsLoadGeneration,
  invalidateRunsCache,
  readRunsCache,
  writeRunsCache,
} from './runsCache';

const NOW = 1_755_744_000_000;

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Array<{ key: string; value: string }> = [];
  const removals: string[] = [];

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      writes.push({ key, value });
      values.set(key, value);
    },
    removeItem(key: string) {
      removals.push(key);
      values.delete(key);
    },
    writes,
    removals,
  };
}

function makeRun(index: number) {
  return {
    id: index + 1,
    name: `Run ${index + 1}`,
    startTime: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T08:00:00Z`,
    startDate: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
    distanceKm: 5 + index / 10,
    distanceMeters: 5000 + index,
    movingTimeSeconds: 1800 + index,
    provider: 'GARMIN',
    routePreview: { points: [[42.1, -71.1], [42.2, -71.2]] },
    unrelatedField: 'should not be cached',
  };
}

function storeSnapshot(storage: ReturnType<typeof createStorage>, runs: unknown[], cachedAt = NOW) {
  storage.setItem('hermes_runs_v2_runner@example.com', JSON.stringify({
    runs,
    profile: { displayName: 'Runner' },
    stravaStatus: { linked: true },
    cachedAt,
    sourceCount: runs.length,
    complete: true,
  }));
}

describe('Runs cache', () => {
  it('round-trips all 678 slim runs without truncation', () => {
    const storage = createStorage({ 'hermes_runs_v1_runner@example.com': 'stale partial cache' });
    const runs = Array.from({ length: 678 }, (_, index) => makeRun(index));

    expect(writeRunsCache(storage, 'runner@example.com', runs, { displayName: 'Runner' }, { linked: true }, NOW)).toBe(true);

    const hit = readRunsCache(storage, 'runner@example.com', NOW + 1000);
    expect(hit).toMatchObject({
      sourceCount: 678,
      complete: true,
      cachedAt: NOW,
      profile: { displayName: 'Runner' },
      stravaStatus: { linked: true },
    });
    expect(hit?.runs).toHaveLength(678);
    expect(hit?.runs[677]).toEqual({
      id: 678,
      name: 'Run 678',
      startTime: '2026-08-06T08:00:00Z',
      startDate: '2026-08-06',
      distanceKm: 72.7,
      distanceMeters: 5677,
      movingTimeSeconds: 2477,
      provider: 'GARMIN',
    });
    expect(hit?.runs[677]).not.toHaveProperty('routePreview');
    expect(storage.getItem('hermes_runs_v1_runner@example.com')).toBeNull();
  });

  it('rejects an oversized snapshot atomically without leaving a partial v2 entry', () => {
    const storage = createStorage({
      'hermes_runs_v2_runner@example.com': JSON.stringify({ complete: true, sourceCount: 1, runs: [makeRun(0)] }),
      'hermes_runs_v1_runner@example.com': 'stale partial cache',
    });
    const oversizedRun = { ...makeRun(0), name: 'x'.repeat(750_000) };

    expect(writeRunsCache(storage, 'runner@example.com', [oversizedRun], null, null, NOW)).toBe(false);
    expect(storage.getItem('hermes_runs_v2_runner@example.com')).toBeNull();
    expect(storage.getItem('hermes_runs_v1_runner@example.com')).toBeNull();
    expect(storage.writes).toHaveLength(0);
  });

  it('rejects snapshots at the TTL boundary and from the future', () => {
    const storage = createStorage();
    expect(writeRunsCache(storage, 'runner@example.com', [makeRun(0)], null, null, NOW)).toBe(true);

    expect(readRunsCache(storage, 'runner@example.com', NOW + 86_400_000)).toBeNull();
    expect(readRunsCache(storage, 'runner@example.com', NOW - 1)).toBeNull();
  });

  it.each([
    ['incomplete', { complete: false, sourceCount: 1 }],
    ['source-count mismatched', { complete: true, sourceCount: 2 }],
  ])('ignores %s snapshots', (_label, metadata) => {
    const storage = createStorage({
      'hermes_runs_v2_runner@example.com': JSON.stringify({
        ...metadata,
        runs: [makeRun(0)],
        cachedAt: NOW,
      }),
    });

    expect(readRunsCache(storage, 'runner@example.com', NOW)).toBeNull();
  });

  it('ignores malformed or non-array storage and invalidates both cache generations', () => {
    const storage = createStorage({
      'hermes_runs_v2_runner@example.com': '{not-json',
    });
    expect(readRunsCache(storage, 'runner@example.com', NOW)).toBeNull();

    storage.setItem('hermes_runs_v2_runner@example.com', JSON.stringify({ complete: true, sourceCount: 1, runs: {}, cachedAt: NOW }));
    expect(readRunsCache(storage, 'runner@example.com', NOW)).toBeNull();

    storage.setItem('hermes_runs_v1_runner@example.com', 'stale partial cache');
    invalidateRunsCache(storage, 'runner@example.com');
    expect(storage.getItem('hermes_runs_v2_runner@example.com')).toBeNull();
    expect(storage.getItem('hermes_runs_v1_runner@example.com')).toBeNull();
  });

  it.each([
    ['null entry', null],
    ['non-object entry', 42],
    ['missing card field', (() => {
      const run = makeRun(0);
      Reflect.deleteProperty(run, 'provider');
      return run;
    })()],
    ['zero id', { ...makeRun(0), id: 0 }],
    ['negative id', { ...makeRun(0), id: -1 }],
    ['non-finite id', { ...makeRun(0), id: Number.NaN }],
  ])('ignores a malformed run entry: %s', (_label, malformedRun) => {
    const storage = createStorage();
    storeSnapshot(storage, [malformedRun]);

    expect(readRunsCache(storage, 'runner@example.com', NOW)).toBeNull();
  });

  it('canonicalizes stable identities and disables anonymous cache access', () => {
    const storage = createStorage();
    expect(writeRunsCache(storage, ' Runner@Example.COM ', [makeRun(0)], null, null, NOW)).toBe(true);
    expect(storage.getItem('hermes_runs_v2_runner@example.com')).not.toBeNull();
    expect(readRunsCache(storage, 'runner@example.com', NOW)).not.toBeNull();

    const writesBeforeAnonymous = storage.writes.length;
    const removalsBeforeAnonymous = storage.removals.length;
    expect(writeRunsCache(storage, null as unknown as string, [makeRun(1)], null, null, NOW)).toBe(false);
    expect(readRunsCache(storage, '   ', NOW)).toBeNull();
    expect(invalidateRunsCache(storage, undefined as unknown as string)).toBe(false);
    expect(storage.writes).toHaveLength(writesBeforeAnonymous);
    expect(storage.removals).toHaveLength(removalsBeforeAnonymous);
    expect(storage.getItem('hermes_runs_v2_null')).toBeNull();
  });

  it('marks an older load token stale when a newer generation begins', () => {
    const generation = createRunsLoadGeneration();
    const first = generation.begin();
    const second = generation.begin();

    expect(generation.isCurrent(first)).toBe(false);
    expect(generation.isCurrent(second)).toBe(true);
    expect(generation.invalidate()).toBe(3);
    expect(generation.isCurrent(second)).toBe(false);
  });
});
