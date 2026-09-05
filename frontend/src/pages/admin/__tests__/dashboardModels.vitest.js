import { describe, expect, it } from 'vitest';
import { getDashboardSectionFromPathname, normalizeDashboardPathname } from '../navigation.js';
import { getShoeCatalogIdentityKey, getShoeLivePhotoUrl, getShoePendingPhotoUrl, getShoeReviewState, getShoeUsageRatio, getShoeHeroBadgeKey } from '../catalogModels.js';
import { buildCourseMapRecommendation, getCourseMapRenderableLive, getCourseMapStatus, getCourseMapActionFromJob, areCourseMapActionsEqual, getCourseMapActionSummary, buildCourseMapAdminPayload, findCourseMapUploadFile } from '../courseMapModels.js';
import { normalizePage, getDashboardJobProgress, getDashboardJobParsedDetails, getDashboardJobTimelineSteps, getDashboardJobPayloadHighlights, getAuditTerminalStatus, getAuditTerminalTraceId, buildDailyCountSeries, buildCumulativeDailySeries, formatDashboardJobDuration } from '../operationsModels.js';

const t = key => key;

describe('admin navigation', () => {
  it('keeps exact tab routing, trailing-slash normalization, and unknown-route handling', () => {
    expect(normalizeDashboardPathname('')).toBe('/dashboard');
    for (const [path, section] of [['', 'overview'], ['/dashboard/', 'overview'], ['/dashboard/users///', 'users'], ['/dashboard/course-maps', 'courseMaps'], ['/dashboard/shoes', 'shoes'], ['/dashboard/jobs', 'jobs'], ['/dashboard/audit', 'audit'], ['/dashboard/settings', 'settings']]) {
      expect(getDashboardSectionFromPathname(path)).toBe(section);
    }
    expect(getDashboardSectionFromPathname('/dashboard/users/123')).toBeNull();
    expect(getDashboardSectionFromPathname('/dashboard/workflows')).toBeNull();
  });
});

describe('catalog review models', () => {
  it('normalizes catalog identity without collapsing the brand/model boundary', () => {
    expect(getShoeCatalogIdentityKey(' ＡＣＭＥ ', '  Fast   Shoe ')).toBe('acme::fast shoe');
    expect(getShoeCatalogIdentityKey('Fast Shoe', 'ACME')).toBe('fast shoe::acme');
  });

  it('preserves image alias precedence and pending-before-live review status', () => {
    const shoe = { livePhotoUrl: 'live-photo', liveImageUrl: 'live-image', photoUrl: 'photo', pendingPreview: { imageUrl: 'pending' } };
    expect(getShoeLivePhotoUrl(shoe)).toBe('live-photo');
    expect(getShoePendingPhotoUrl(shoe)).toBe('pending');
    expect(getShoeReviewState(shoe)).toBe('pending');
    expect(getShoeReviewState({ photoUrl: 'photo' })).toBe('live');
    expect(getShoeReviewState(null)).toBe('missing');
  });

  it('retains legacy distance fallbacks, clamping, and review badge priority', () => {
    expect(getShoeUsageRatio({ currentDistanceKm: 0, initialDistanceKm: 325 })).toBe(0.5);
    expect(getShoeUsageRatio({ currentDistanceKm: 900, maxDistanceKm: 650 })).toBe(1);
    expect(getShoeUsageRatio({ currentDistanceKm: 900, maxDistanceKm: -1 })).toBe(0);
    expect(getShoeHeroBadgeKey({ livePhotoUrl: 'live', currentDistanceKm: 650 })).toBe('dashboard.shoe_stitch_badge_flagged');
    expect(getShoeHeroBadgeKey({ livePhotoUrl: 'live', pendingPhotoUrl: 'pending', currentDistanceKm: 650 })).toBe('dashboard.shoe_stitch_badge_pending');
  });
});

describe('course-map review models', () => {
  const aligned = { overlayBounds: { north: 1, south: 0, east: 1, west: 0 }, routePoints: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }] };

  it('keeps every acquisition, improvement, refresh, and publish decision', () => {
    expect(buildCourseMapRecommendation(null, null, t).action).toBe('scan');
    expect(buildCourseMapRecommendation(null, aligned, t).tone).toBe('refresh');
    expect(buildCourseMapRecommendation({ imageUrl: 'image' }, aligned, t).action).toBe('reanalyze');
    expect(buildCourseMapRecommendation(aligned, null, t).body).toBe('dashboard.course_maps_recommendation_publish_body_first');
    expect(buildCourseMapRecommendation(aligned, aligned, t).body).toBe('dashboard.course_maps_recommendation_publish_body_update');
  });

  it('prefers resolved live geometry, falls back to stored geometry, and rejects image-only live assets', () => {
    const current = { routePoints: aligned.routePoints };
    expect(getCourseMapRenderableLive({ currentLivePreview: current, live: aligned })).toBe(current);
    expect(getCourseMapRenderableLive({ currentLivePreview: { imageUrl: 'image' }, live: aligned })).toBe(aligned);
    expect(getCourseMapStatus({ live: { imageUrl: 'image' } })).toBe('missing');
    expect(getCourseMapStatus({ live: aligned })).toBe('live');
    expect(getCourseMapStatus({ pendingPreview: {}, live: aligned })).toBe('pending');
  });

  it('preserves pending/running action transitions and suppresses stale queued summaries', () => {
    const pending = getCourseMapActionFromJob('race', 'queued', { id: 7, status: 'PENDING' });
    expect(pending).toMatchObject({ raceId: 'race', type: 'queued', progress: 12, jobId: 7, jobStatus: 'PENDING' });
    const running = getCourseMapActionFromJob('race', 'queued', { id: 7, status: 'RUNNING', summary: 'Queued course-map FIFO scan' });
    expect(running.type).toBe('scan');
    expect(getCourseMapActionSummary(pending, t)).toBe('dashboard.course_maps_progress_waiting_hint');
    expect(getCourseMapActionSummary(running, t)).toBe('dashboard.course_maps_status_running_scan');
    expect(areCourseMapActionsEqual(running, { ...running })).toBe(true);
    expect(areCourseMapActionsEqual(running, { ...running, summary: 'changed' })).toBe(false);
    expect(areCourseMapActionsEqual(null, null)).toBe(true);
  });

  it('preserves upload selection and optional numeric payload coercion', () => {
    const pdf = { name: 'course.PDF', type: '' };
    expect(findCourseMapUploadFile([{ name: 'notes.txt', type: 'text/plain' }, pdf])).toBe(pdf);
    expect(findCourseMapUploadFile([])).toBeNull();
    expect(buildCourseMapAdminPayload({ name: 'Race', city: 'City', latitude: '40', longitude: '-74', distanceKm: '42.195' }))
      .toEqual({ raceName: 'Race', city: 'City', lat: 40, lng: -74, distanceKm: 42.195 });
    expect(buildCourseMapAdminPayload({})).toEqual({ raceName: 'Unknown race' });
  });
});

describe('operations presentation models', () => {
  it('accepts legacy array pages and preserves server pagination', () => {
    expect(normalizePage([])).toEqual({ items: [], page: 0, totalPages: 0, totalItems: 0 });
    expect(normalizePage([{ id: 1 }])).toEqual({ items: [{ id: 1 }], page: 0, totalPages: 1, totalItems: 1 });
    expect(normalizePage({ items: null, page: '2', totalPages: '3', totalItems: '12' })).toEqual({ items: [], page: 2, totalPages: 3, totalItems: 12 });
  });

  it('keeps terminal job progress, pending progress, and bounded running estimates', () => {
    for (const [job, progress] of [[{ status: 'PENDING' }, 12], [{ status: 'FAILED' }, 100], [{ status: 'COMPLETED' }, 100], [{ status: 'RUNNING' }, 62], [{ status: 'RUNNING', totalCount: 10, successCount: 2, failureCount: 1 }, 30], [{ totalCount: 1, successCount: 5 }, 100], [null, 8]]) {
      expect(getDashboardJobProgress(job)).toBe(progress);
    }
  });

  it('handles malformed job details and retains timeline fallbacks and highlight filtering', () => {
    for (const detailsJson of ['invalid', '[]', 'null', '3']) expect(getDashboardJobParsedDetails({ detailsJson })).toBeNull();
    const details = { count: 2, qwenScanSteps: [{ stage: 'scan', status: 'running' }], lastQwenScanStep: { stage: 'old' } };
    expect(getDashboardJobParsedDetails({ detailsJson: JSON.stringify(details) })).toEqual(details);
    expect(getDashboardJobPayloadHighlights(details)).toEqual([{ key: 'count', label: 'count', value: '2' }]);
    expect(getDashboardJobTimelineSteps(details)[0].stage).toBe('scan');
    expect(getDashboardJobTimelineSteps({ lastQwenScanStep: { stage: 'fallback' } })[0].stage).toBe('fallback');
  });

  it('keeps failure precedence in audit classification and trace ID formatting', () => {
    expect(getAuditTerminalStatus({ action: 'queued', summary: 'request denied' })).toBe('failed');
    expect(getAuditTerminalStatus({ summary: 'retry scheduled' })).toBe('pending');
    expect(getAuditTerminalStatus(null)).toBe('success');
    expect(getAuditTerminalTraceId({ id: 'ab-12' }, 0)).toBe('#AB1200');
  });

  it('sorts daily series and respects persisted counts, invalid dates, and the window limit', () => {
    const items = [{ createdAt: '2026-01-02T12:00', count: 4 }, { createdAt: '2026-01-01T08:00', count: 2 }, { createdAt: '2026-01-02T13:00' }, { createdAt: 'invalid' }];
    expect(buildDailyCountSeries(items)).toEqual({ labels: ['2026-01-01', '2026-01-02'], values: [2, 5] });
    expect(buildDailyCountSeries(items, 'createdAt', 1)).toEqual({ labels: ['2026-01-02'], values: [5] });
    expect(buildCumulativeDailySeries(items)).toEqual({ labels: ['2026-01-01', '2026-01-02'], values: [1, 3] });
    expect(formatDashboardJobDuration('2026-01-01T00:00:00Z', '2026-01-01T01:02:03Z')).toBe('1h 2m');
    expect(formatDashboardJobDuration('invalid', '2026-01-01')).toBe('-');
  });
});
