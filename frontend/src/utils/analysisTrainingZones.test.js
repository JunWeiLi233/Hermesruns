import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const analysisInsightsPath = path.join(currentDir, 'analysisInsights.js');
const { buildTrainingZones } = await import(pathToFileURL(analysisInsightsPath).href);

const zones = buildTrainingZones(50, 'zh-CN', 'km');

assert.equal(zones.length, 5);

for (const zone of zones) {
  assert.match(
    zone.paceLabel,
    / - /,
    `Expected ${zone.key} pace label to render as a range, got "${zone.paceLabel}".`,
  );
}

console.log('[PASS] Analysis training zones render ranges for every zone.');
