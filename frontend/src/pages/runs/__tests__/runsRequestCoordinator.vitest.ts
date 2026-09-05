import { describe, expect, it } from 'vitest';
import { createRoutePreviewRequestCoordinator } from '../runsRequestCoordinator';

describe('createRoutePreviewRequestCoordinator', () => {
  it('deduplicates overlapping claims and terminally settles successful batches', () => {
    const coordinator = createRoutePreviewRequestCoordinator();

    expect(coordinator.claim([1, 2, 2])).toEqual([1, 2]);
    expect(coordinator.claim([2, 3])).toEqual([3]);
    expect(coordinator.claim([null, '4', 0, -5, Infinity, 'not-an-id', 4])).toEqual([4]);

    coordinator.settle([1, 3, 4]);

    expect(coordinator.claim([1, 3, 4, 5])).toEqual([5]);
  });

  it('releases claimed IDs after a transport failure so they can be retried', () => {
    const coordinator = createRoutePreviewRequestCoordinator();
    const claimed = coordinator.claim([11, 12]);

    try {
      throw new Error('route preview transport failed');
    } catch {
      coordinator.release(claimed);
    }

    expect(coordinator.claim([11, 12])).toEqual([11, 12]);
    coordinator.settle([11]);
    coordinator.release([12]);
    expect(coordinator.claim([11, 12])).toEqual([12]);
  });

  it('resets in-flight and settled IDs after sync, import, or data mutation', () => {
    const coordinator = createRoutePreviewRequestCoordinator();

    coordinator.claim([21]);
    coordinator.settle([22]);
    coordinator.reset();

    expect(coordinator.claim([21, 22])).toEqual([21, 22]);
  });

  it('protects newer ownership from stale settle and release after a reset', () => {
    const coordinator = createRoutePreviewRequestCoordinator();
    const stale = coordinator.claimWithToken([31, 32]);

    coordinator.reset();

    const current = coordinator.claimWithToken([31, 32]);
    expect(current.token.generation).toBe(stale.token.generation + 1);

    coordinator.settle(stale.ids, stale.token);
    coordinator.release(stale.ids, stale.token);

    expect(coordinator.isCurrent(current.token)).toBe(true);
    expect(coordinator.claim([31, 32])).toEqual([]);

    coordinator.settle(current.ids, current.token);
  });

  it('wakes an in-flight waiter after reset and returns the new-generation IDs', async () => {
    const coordinator = createRoutePreviewRequestCoordinator();
    const stale = coordinator.claimWithToken([36]);
    const waiting = coordinator.waitFor([36]);

    coordinator.reset();

    await expect(waiting).resolves.toEqual([36]);
    const current = coordinator.claimWithToken([36]);
    coordinator.settle(stale.ids, stale.token);
    coordinator.release(stale.ids, stale.token);

    expect(coordinator.isCurrent(current.token)).toBe(true);
    coordinator.settle(current.ids, current.token);
  });

  it('keeps out-of-order ownership isolated within the same generation', () => {
    const coordinator = createRoutePreviewRequestCoordinator();
    const first = coordinator.claimWithToken([41]);

    coordinator.release(first.ids, first.token);
    const second = coordinator.claimWithToken([41]);

    coordinator.settle(first.ids, first.token);
    coordinator.release(first.ids, first.token);

    expect(coordinator.isCurrent(second.token)).toBe(true);
    expect(coordinator.claim([41])).toEqual([]);

    coordinator.settle(second.ids, second.token);
  });

  it('notifies waiters when an in-flight request releases so the ID can retry', async () => {
    const coordinator = createRoutePreviewRequestCoordinator();
    const first = coordinator.claimWithToken([51]);
    let notified = false;
    const waiting = coordinator.waitFor([51]).then((retryableIds) => {
      notified = true;
      expect(retryableIds).toEqual([51]);
    });

    await Promise.resolve();
    expect(notified).toBe(false);

    coordinator.release(first.ids, first.token);
    await waiting;

    const retry = coordinator.claimWithToken([51]);
    expect(retry.ids).toEqual([51]);
    coordinator.settle(retry.ids, retry.token);
  });

  it('waits through partial overlap so every candidate is requested or terminally handled', async () => {
    const coordinator = createRoutePreviewRequestCoordinator();
    const existingOwner = coordinator.claimWithToken([61]);
    const waiting = coordinator.waitFor([61, 62]);

    await Promise.resolve();
    coordinator.settle(existingOwner.ids, existingOwner.token);

    const retryableIds = await waiting;
    expect(retryableIds).toEqual([62]);

    const retry = coordinator.claimWithToken(retryableIds);
    expect(retry.ids).toEqual([62]);
    coordinator.settle(retry.ids, retry.token);
  });
});
