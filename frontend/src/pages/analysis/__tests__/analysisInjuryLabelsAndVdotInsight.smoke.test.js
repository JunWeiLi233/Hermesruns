import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const analysisJsx = fs.readFileSync(path.join(srcRoot, 'pages/analysis/Analysis.jsx'), 'utf8');
const zh = fs.readFileSync(path.join(srcRoot, 'i18n/locales/zh-CN/components.js'), 'utf8');
const en = fs.readFileSync(path.join(srcRoot, 'i18n/locales/en/components.js'), 'utf8');

function pick(src, key) {
  const m = src.match(new RegExp(`"${key}":\\s*"([^"]*)"`));
  assert.ok(m, `missing key ${key}`);
  return m[1];
}

// Injury pills must be real localized labels, never U+FFFD or ??
for (const [key, zhVal, enVal] of [
  ['stitch_injury_low', '低风险', 'Low'],
  ['stitch_injury_moderate', '中等风险', 'Moderate'],
  ['stitch_injury_high', '高风险', 'High'],
]) {
  assert.equal(pick(zh, key), zhVal);
  assert.equal(pick(en, key), enVal);
  assert.ok(!/[?\uFFFD]/.test(pick(zh, key)));
}

assert.match(analysisJsx, /t\('analysis\.stitch_injury_low'\)/);
assert.match(analysisJsx, /t\(`analysis\.vdot_trend_insight_copy_\$\{vdotTrend\.direction\}`\)/);

for (const dir of ['improving', 'declining', 'maintaining']) {
  const key = `vdot_trend_insight_copy_${dir}`;
  assert.ok(pick(en, key).length > 20, `en ${key}`);
  assert.ok(pick(zh, key).length > 10, `zh ${key}`);
  assert.ok(!/insight copy/i.test(pick(en, key)));
}

assert.match(analysisJsx, /name="load_balance_runner"/);
assert.doesNotMatch(analysisJsx, /name="directions_run"/);

console.log('analysisInjuryLabelsAndVdotInsight.smoke.test.js OK');
