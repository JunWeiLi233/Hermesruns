import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const catalogRowStart = dashboardSource.indexOf('function CatalogRowComponent');
const catalogRowEnd = dashboardSource.indexOf('function CourseMapQueueRowComponent');
const catalogGridSource = dashboardSource.slice(catalogRowStart, catalogRowEnd);
const shoeInventorySource = readFileSync(
  path.join(here, "../../../../../backend/src/main/java/com/hermes/backend/shoes/ShoeInventoryService.java"),
  'utf8',
);
const imageAssetServiceSource = readFileSync(
  path.join(here, "../../../../../backend/src/main/java/com/hermes/backend/shoes/ShoeImageAssetService.java"),
  'utf8',
);

assert.doesNotMatch(
  catalogGridSource,
  /\/api\/shoe-catalog\/admin\/models/,
  'The admin shoe image grid must not create or update the runner-facing shoe series catalog.',
);

assert.match(
  dashboardSource,
  /\/api\/admin\/shoe-catalog\/images\/(?:search|pending|accept)/,
  'The admin grid should use the identity-based shared image curation API.',
);

assert.match(
  dashboardSource,
  /catalogImageAssets|catalog_image_library|catalog_image_manage/,
  'The admin shoe grid should present a shared verified-image library, not a catalog editor.',
);

assert.match(
  imageAssetServiceSource,
  /applyLiveAssetToShoe/,
  'The shared image service should expose the live asset for newly created runner shoes.',
);

assert.match(
  shoeInventorySource,
  /applyLiveAssetToShoe/,
  'Runner shoe creation should inherit the verified image for the same shoe identity.',
);

console.log('[PASS] Admin shoe image-library guardrails passed.');
