import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'MuscleTraining.jsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '../styles/_split/muscle-training.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');

assert.match(
  pageSource,
  /const STRENGTH_FOCUS_OPTIONS = \[[\s\S]*'LEG_DAY'[\s\S]*'MOBILITY_RESET'/,
  'Daily composer should expose runner-specific focus options, including leg day and mobility reset.',
);

assert.match(
  pageSource,
  /const STRENGTH_DOSE_OPTIONS = \['MICRO', 'STANDARD', 'STRONG'\]/,
  'Daily composer should expose micro, standard, and strong dose controls.',
);

assert.match(
  pageSource,
  /className="muscle-pref-field muscle-checkin-field muscle-checkin-field-wide mt-strength-composer"/,
  'Daily composer should render inside the today check-in control surface.',
);

assert.match(
  pageSource,
  /updateCheckInDraft\('strengthFocus', focus\)/,
  'Focus chips should update the today check-in draft.',
);

assert.match(
  pageSource,
  /updateCheckInDraft\('strengthDose', dose\)/,
  'Dose chips should update the today check-in draft.',
);

assert.match(
  pageSource,
  /strengthFocus: checkInDraft\.strengthFocus/,
  'Today check-in save payload should persist the selected strength focus.',
);

assert.match(
  pageSource,
  /strengthDose: checkInDraft\.strengthDose/,
  'Today check-in save payload should persist the selected strength dose.',
);

assert.match(
  pageSource,
  /function pickStrengthSessionLabel\(copy, sessionType/,
  'Custom backend session codes should be mapped into localized focus and dose labels.',
);

assert.match(
  pageSource,
  /CUSTOM_\(\.\+\)_\(MICRO\|STANDARD\|STRONG\)/,
  'Custom session label mapping should handle focus plus dose codes.',
);

assert.match(
  cssSource,
  /\.mt-strength-composer\s*\{/,
  'Daily composer should have a dedicated styled container.',
);

for (const [locale, source] of [['en', enSource], ['zh-CN', zhSource]]) {
  assert.match(source, /"strength_composer_title"/, `${locale} should include the composer title.`);
  assert.match(source, /"strength_focus_leg_day"/, `${locale} should include leg-day copy.`);
  assert.match(source, /"strength_dose_strong"/, `${locale} should include strong-dose copy.`);
  assert.match(source, /"rationale_r_custom_today_focus"/, `${locale} should include custom-focus rationale copy.`);
}

console.log('[PASS] Muscle Training daily composer guardrails passed.');
