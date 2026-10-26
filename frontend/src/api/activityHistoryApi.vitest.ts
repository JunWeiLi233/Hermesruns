import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../api';
import { appendActivityHistoryRuns, fetchActivityHistoryPage, normalizeActivityHistoryPage } from './activityHistoryApi';
import { historyPageFixture } from '../pages/runs/__tests__/historyPageFixture';

vi.mock('../api', () => ({ apiJson: vi.fn() }));
const run = { id: 1, name: 'Morning', startDate: '2026-10-21', startTime: '2026-10-21T08:00:00Z', distanceKm: 5, movingTimeSeconds: 1800 };
const fixture = () => historyPageFixture([run]);
beforeEach(() => { vi.mocked(apiJson).mockReset(); });

describe('activity history API', () => {
  it('encodes criteria, an opaque cursor and cancellation on a fixed-size request', async () => {
    vi.mocked(apiJson).mockResolvedValue(fixture());
    const controller = new AbortController();
    await fetchActivityHistoryPage({ sort: 'pace', defaultName: '跑步', year: 2025, month: 12, search: ' River & Hills ' }, 'opaque+/=?', { signal: controller.signal });
    const [url, options] = vi.mocked(apiJson).mock.calls[0];
    const query = new URL(String(url), 'http://localhost').searchParams;
    expect(query.get('limit')).toBe('60');
    expect(query.get('sort')).toBe('pace');
    expect(query.get('defaultName')).toBe('跑步');
    expect(query.get('year')).toBe('2025');
    expect(query.get('month')).toBe('12');
    expect(query.get('search')).toBe('river & hills');
    expect(query.get('cursor')).toBe('opaque+/=?');
    expect(options?.signal).toBe(controller.signal);
    expect(query.has('beforeId')).toBe(false);
  });

  it('bounds search after case normalization so pasted Unicode cannot exceed the server limit', async () => {
    vi.mocked(apiJson).mockResolvedValue(fixture());
    await fetchActivityHistoryPage({ sort: 'date', defaultName: 'Run', search: 'İ'.repeat(300) }, null);
    const query = new URL(String(vi.mocked(apiJson).mock.calls[0][0]), 'http://localhost').searchParams;
    expect(query.get('search')).toHaveLength(256);
    expect(query.get('search')).toBe('i\u0307'.repeat(128));
  });

  it.each([
    null, [], { items: [] },
    { ...fixture(), items: [null] },
    { ...fixture(), hasMore: true, nextCursor: null },
    { ...fixture(), hasMore: true, nextCursor: 'next', items: [] },
    { ...fixture(), totalCount: -1 },
    { ...fixture(), summary: { ...fixture().summary, count: 2 } },
    { ...fixture(), monthsByYear: { 2026: [13] } },
  ])('rejects malformed history and cursor metadata: %o', value => {
    expect(() => normalizeActivityHistoryPage(value)).toThrow('Invalid activity history page');
  });

  it('rejects a first terminal page whose complete matching count exceeds its items', async () => {
    vi.mocked(apiJson).mockResolvedValue({ ...fixture(), totalCount: 2, summary: { ...fixture().summary, count: 2 } });
    await expect(fetchActivityHistoryPage({ sort: 'date', defaultName: 'Run' }, null)).rejects.toThrow('Invalid activity history page');
  });

  it('deduplicates IDs without changing the server order', () => {
    const older = { ...run, id: 900, startDate: '2020-01-01' };
    expect(appendActivityHistoryRuns([run], [run, older, older])).toEqual([run, older]);
  });
});
