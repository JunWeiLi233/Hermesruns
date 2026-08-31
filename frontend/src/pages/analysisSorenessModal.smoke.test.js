import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');
const englishComponents = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const chineseComponents = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');

assert.match(
  analysisSource,
  /const \[sorenessModalLevel, setSorenessModalLevel\] = useState\(null\);/,
  'Analysis should track the soreness level awaiting confirmation.',
);
for (const level of ['low', 'medium', 'high']) {
  assert.match(
    analysisSource,
    new RegExp(`onClick=\\{\\(\\) => setSorenessModalLevel\\('${level}'\\)\\}`),
    `${level} soreness should open the confirmation modal before saving.`,
  );
}
assert.doesNotMatch(
  analysisSource,
  /className=\{cx\('analysis-injury-prevention-soreness-btn',[\s\S]*?onClick=\{\(\) => handleSorenessLog\('/,
  'Soreness buttons should not submit directly without confirmation.',
);
assert.match(
  analysisSource,
  /<Modal\s+isOpen=\{Boolean\(sorenessModalLevel\)\}[\s\S]*?onClose=\{\(\) => setSorenessModalLevel\(null\)\}[\s\S]*?analysis\.stitch_injury_prevention_soreness_modal_title/,
  'Analysis should render a closable confirmation modal for the selected soreness level.',
);
assert.match(
  analysisSource,
  /onClick=\{handleSorenessModalConfirm\}/,
  'The modal should confirm and save the selected soreness level.',
);
for (const localeSource of [englishComponents, chineseComponents]) {
  assert.match(localeSource, /stitch_injury_prevention_soreness_modal_title/);
  assert.match(localeSource, /stitch_injury_prevention_soreness_modal_copy/);
  assert.match(localeSource, /stitch_injury_prevention_soreness_modal_cancel/);
  assert.match(localeSource, /stitch_injury_prevention_soreness_modal_confirm/);
}

console.log('[PASS] Analysis soreness confirmation modal guardrails passed.');
