// Pure planning helpers plus a bounded-concurrency page fetcher for the
// background heatmap GPS pages. Page 1 still loads first (it discovers
// pointCount/hasMore); every later offset is deterministic, so the remaining
// pages can be computed up front and fetched with a small overlapped pool
// instead of one strictly sequential round trip per 100k-point chunk.

export const HEATMAP_PAGE_FETCH_CONCURRENCY = 3;

/**
 * Deterministic offset plan for the background heatmap pages.
 *
 * Pages tile the range [startOffset, sourcePointCount) with fixed-size
 * chunks; the last chunk is clamped to the remainder. Mirrors what the old
 * sequential loop produced when every page returns its full limit.
 */
export function computeBackgroundPagePlan({ sourcePointCount, startOffset, pageSize, maxPages }) {
  const total = Number(sourcePointCount) || 0;
  const start = Number(startOffset) || 0;
  const size = Number(pageSize);
  const cap = Number(maxPages);
  if (!Number.isFinite(size) || size <= 0) return [];
  if (!Number.isFinite(cap) || cap <= 0) return [];
  if (total <= 0 || start <= 0 || start >= total) return [];

  const remaining = total - start;
  const pageCount = Math.min(cap, Math.ceil(remaining / size));
  return Array.from({ length: pageCount }, (_, index) => ({
    offset: start + index * size,
    limit: Math.min(size, remaining - index * size),
  }));
}

export function getHeatmapPageReturnedPointCount(pagePayload) {
  const points = Array.isArray(pagePayload?.points) ? pagePayload.points : [];
  const declared = Number(pagePayload?.page?.returnedPointCount);
  return Number.isFinite(declared) && declared >= 0 ? declared : points.length;
}

/**
 * True when every planned page returned exactly the number of points its
 * offset span promised. Any null payload or short/over-long page means the
 * deterministic tiling cannot be trusted, and the caller must degrade to a
 * partial payload exactly like the sequential loop did on a failed page.
 */
export function isCompletePageAssembly(pagePlan, pageResults) {
  if (!Array.isArray(pagePlan) || !Array.isArray(pageResults)) return false;
  if (pagePlan.length !== pageResults.length) return false;
  return pagePlan.every((page, index) => {
    const pagePayload = pageResults[index];
    if (!pagePayload || typeof pagePayload !== 'object') return false;
    return getHeatmapPageReturnedPointCount(pagePayload) === page.limit;
  });
}

/**
 * Fetch the planned pages with at most `concurrency` requests in flight.
 * Results are kept in per-index slots so the assembled point order is
 * identical to the sequential fetch; rejections propagate (abort, network,
 * 429) and a page that resolves without a usable payload stays null.
 */
export async function fetchHeatmapPagesWithBounds(pagePlan, fetchPage, concurrency = HEATMAP_PAGE_FETCH_CONCURRENCY) {
  const results = new Array(pagePlan.length).fill(null);
  if (pagePlan.length === 0) return results;

  let nextIndex = 0;
  let firstError = null;

  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, pagePlan.length));
  const runWorker = async () => {
    while (firstError === null) {
      const index = nextIndex;
      if (index >= pagePlan.length) return;
      nextIndex += 1;
      try {
        results[index] = await fetchPage(pagePlan[index].offset, pagePlan[index].limit);
      } catch (error) {
        if (firstError === null) firstError = error;
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  if (firstError !== null) throw firstError;
  return results;
}
