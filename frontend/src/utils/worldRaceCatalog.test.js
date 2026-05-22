import assert from 'node:assert/strict';

import worldRaceCatalog, {
  standardCityRoadMarathonCatalog,
  worldRaceCountries,
} from '../data/worldRaceCatalog.js';

const standardRaceIds = new Set(standardCityRoadMarathonCatalog.map((race) => race.id));

assert.ok(
  standardRaceIds.has('chicago-marathon'),
  'Standard city road marathon catalog should keep major road marathons like Chicago.',
);

assert.ok(
  standardRaceIds.has('tokyo-marathon'),
  'Standard city road marathon catalog should keep international city road marathons like Tokyo.',
);

assert.ok(
  !standardRaceIds.has('delhi-half-marathon'),
  'Standard city road marathon catalog should exclude half marathon entries.',
);

assert.ok(
  !standardRaceIds.has('nyrr-brooklyn-half') && !standardRaceIds.has('nyrr-united-half'),
  'Standard city road marathon catalog should exclude NYRR half marathon discovery entries.',
);

assert.ok(
  !standardRaceIds.has('comrades-marathon'),
  'Standard city road marathon catalog should exclude ultra-distance races.',
);

assert.ok(
  !standardRaceIds.has('big-sur-marathon') && !standardRaceIds.has('queenstown-marathon'),
  'Standard city road marathon catalog should exclude scenic or trail-adjacent non-city marathon outliers.',
);

assert.ok(
  standardCityRoadMarathonCatalog.length < worldRaceCatalog.length,
  'The public races catalog should be narrower than the raw source inventory.',
);

assert.ok(
  worldRaceCountries.every((country) => standardCityRoadMarathonCatalog.some((race) => race.country === country.key)),
  'Country filters should only include countries with visible standard city road marathons.',
);

console.log('[PASS] World race catalog standard road marathon guardrails passed.');
