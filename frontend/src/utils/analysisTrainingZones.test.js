import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const analysisInsightsPath = path.join(currentDir, 'analysisInsights.js');
const formatUrl = pathToFileURL(path.join(currentDir, 'format.js')).href;
const vdotUrl = pathToFileURL(path.join(currentDir, 'vdot.js')).href;

const source = await readFile(analysisInsightsPath, 'utf8');
const patchedSource = source
  .replace("from './format';", `from '${formatUrl}';`)
  .replace("from './vdot';", `from '${vdotUrl}';`);

const moduleUrl = `data:text/javascript;base64,${Buffer.from(patchedSource).toString('base64')}`;
const { buildTrainingZones } = await import(moduleUrl);

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
