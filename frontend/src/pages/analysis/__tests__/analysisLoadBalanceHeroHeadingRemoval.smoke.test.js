import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(currentDir, "../AnalysisInsightDetail.jsx"), 'utf8');
const enSource = readFileSync(path.join(currentDir, "../../../i18n/locales/en/pages.js"), 'utf8');
const zhSource = readFileSync(path.join(currentDir, "../../../i18n/locales/zh-CN/pages.js"), 'utf8');

assert.doesNotMatch(
  source,
  /className="analysis-load-profile-header analysis-profile-v2-header"/,
  'Load Balance should not render the redundant ACWR hero heading block.',
);
assert.match(
  source,
  /className="analysis-load-profile-decision analysis-profile-v2-focus"/,
  'Load Balance should keep the coaching decision surface after removing the hero heading.',
);
assert.match(
  source,
  /className="analysis-load-profile-evidence analysis-profile-v2-evidence-grid"/,
  'Load Balance should keep the evidence charts after removing the hero heading.',
);
for (const localeSource of [enSource, zhSource]) {
  assert.doesNotMatch(localeSource, /"load_hero_(?:eyebrow|title|accent)"/, 'Removed Load Balance hero copy should not remain in either locale.');
}

console.log('[PASS] Load Balance hero heading removal guardrails passed.');
