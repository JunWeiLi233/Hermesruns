import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');

assert.match(
  zhSource,
  /"vdot_trend_insight_title":\s*"你的体能"/,
  'The Chinese fitness-trend label should be concise.',
);
assert.match(
  enSource,
  /"vdot_trend_insight_title":\s*"Your fitness"/,
  'The English fitness-trend label should match the concise Chinese label.',
);

console.log('[PASS] Analysis fitness-trend label copy guard passed.');
