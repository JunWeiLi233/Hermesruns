import assert from 'node:assert/strict';

import {
  buildCourseMapAdminDetailFallback,
  buildCourseMapWorkspaceSource,
  getCourseMapCatalogMarathons,
  hasCourseMapBackendRecord,
  mergeCourseMapQueueItems,
} from './courseMapCatalogQueue.js';

const marathonCatalog = getCourseMapCatalogMarathons();

assert.ok(
  marathonCatalog.length >= 70,
  'The shared course-map marathon catalog should expose the full races-page marathon inventory, not a tiny curated subset.',
);

assert.ok(
  marathonCatalog.some((race) => race.raceId === 'tokyo-marathon'),
  'The shared course-map marathon catalog should include early-calendar majors like Tokyo Marathon.',
);

assert.ok(
  marathonCatalog.some((race) => race.raceId === 'ho-chi-minh-city-marathon'),
  'The shared course-map marathon catalog should include later catalog entries from the normal races page as well.',
);

assert.ok(
  !marathonCatalog.some((race) => race.raceId === 'delhi-half-marathon'),
  'The shared course-map marathon catalog should exclude half-marathon entries from the races page.',
);

assert.ok(
  !marathonCatalog.some((race) => race.raceId === 'comrades-marathon'),
  'The shared course-map marathon catalog should mirror full marathon discovery, not ultra-distance races.',
);

const mergedQueue = mergeCourseMapQueueItems({
  catalogItems: marathonCatalog.slice(0, 6),
  backendItems: [
    {
      raceId: 'chicago-marathon',
      updatedAt: '2026-04-21T12:00:00',
      pendingPreview: { updatedAt: '2026-04-21T12:00:00' },
    },
    {
      raceId: 'backend-only-race',
      raceName: 'Backend Only Marathon',
      location: 'Lab City',
    },
  ],
});

assert.deepEqual(
  mergedQueue.slice(0, 6).map((item) => item.raceId),
  marathonCatalog.slice(0, 6).map((item) => item.raceId),
  'The admin course-map queue should keep the same default marathon ordering as the normal races page.',
);

assert.equal(
  mergedQueue.find((item) => item.raceId === 'chicago-marathon')?.updatedAt,
  '2026-04-21T12:00:00',
  'The admin queue should overlay backend course-map state onto the catalog-backed marathon entry.',
);

assert.equal(
  mergedQueue.at(-1)?.raceId,
  'backend-only-race',
  'The admin queue should still append backend-only course-map records after the catalog-backed marathon inventory.',
);

assert.equal(
  hasCourseMapBackendRecord('chicago-marathon', mergedQueue),
  true,
  'The admin queue helper should detect when a race id already has backend course-map state attached.',
);

assert.equal(
  hasCourseMapBackendRecord('tokyo-marathon', marathonCatalog.slice(0, 3)),
  false,
  'The admin queue helper should treat plain catalog entries as not yet backed by a stored course-map record.',
);

const fallbackDetail = buildCourseMapAdminDetailFallback({
  raceId: 'chicago-marathon',
  raceName: 'Chicago Marathon',
  city: 'Chicago',
  country: 'United States',
});

assert.deepEqual(
  fallbackDetail,
  {
    raceId: 'chicago-marathon',
    raceName: 'Chicago Marathon',
    city: 'Chicago',
    country: 'United States',
    live: null,
    pendingPreview: null,
    currentLivePreview: null,
  },
  'Catalog-only marathon entries should be representable as an empty admin detail payload without forcing a backend 404 fetch.',
);

const workspaceSource = buildCourseMapWorkspaceSource({
  queueItem: {
    raceId: 'chicago-marathon',
    raceName: 'Chicago Marathon',
    city: 'Chicago',
    country: 'United States',
    officialWebsite: 'https://www.chicagomarathon.com/',
    lat: 41.8781,
    lng: -87.6298,
    distanceKm: 42.195,
  },
  detail: fallbackDetail,
});

assert.equal(
  workspaceSource.officialWebsite,
  'https://www.chicagomarathon.com/',
  'Catalog-only course-map actions should preserve the richer queue metadata even when the selected detail is only a fallback shell.',
);

assert.equal(
  workspaceSource.distanceKm,
  42.195,
  'Catalog-only course-map actions should keep the marathon distance from the queue item.',
);

console.log('[PASS] Course-map catalog queue test passed.');
