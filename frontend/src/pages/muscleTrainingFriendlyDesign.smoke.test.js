import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'MuscleTraining.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN.js'), 'utf8');

assert.match(
  pageSource,
  /data-friendly-strength-lab="true"/,
  'Muscle Training should mark the redesigned strength lab so scoped CSS cannot leak to other pages.',
);

assert.match(
  pageSource,
  /className="mt-strength-lab-intro"/,
  'Muscle Training should explain the daily decision flow before showing dense plan details.',
);

assert.match(
  pageSource,
  /className="mt-friendly-guide-card"/,
  'Muscle Training should include a three-step guide card for first-time readability.',
);

assert.match(
  pageSource,
  /formatCopyTemplate\(copy\.checkInUpdatedAt,\s*\{\s*date:\s*formatTimestamp\(plan\.todayCheckIn\.updatedAt,\s*displayLang\)\s*\}\)/,
  'Muscle Training should interpolate the check-in updated date instead of rendering {date}.',
);

assert.doesNotMatch(
  pageSource,
  /weekday_zh|weekday_en/,
  'Muscle Training day chips should use DAY_OPTIONS labels instead of missing weekday translation keys.',
);

assert.match(
  styleSource,
  /\.mt-strength-lab\[data-friendly-strength-lab="true"\] \.mt-strength-lab-header\s*\{[\s\S]*order:\s*1;/,
  'The daily heading must render before the anatomy board.',
);

assert.match(
  styleSource,
  /\.muscle-training-page \.mt-strength-lab\[data-friendly-strength-lab="true"\] \.mt-strength-lab-header\s*\{[\s\S]*order:\s*1;/,
  'The live backend shell should get the same decision-first ordering even when .hermes-site-frame is absent.',
);

assert.match(
  styleSource,
  /\.mt-strength-lab\[data-friendly-strength-lab="true"\] \.mt-coach-cockpit\s*\{[\s\S]*order:\s*2;/,
  'The coach decision cockpit must render before the weekly strip and anatomy explorer.',
);

assert.match(
  styleSource,
  /\.mt-strength-lab\[data-friendly-strength-lab="true"\] \.mt-anatomy-command-board\s*\{[\s\S]*order:\s*4;/,
  'The anatomy map should be an explanation surface after the daily decision, not the first fold.',
);

assert.match(
  styleSource,
  /\.mt-friendly-secondary-btn:active\s*\{[\s\S]*scale\(0\.99\)/,
  'The secondary check-in action should have tactile active feedback.',
);

for (const [locale, source] of [['en', enSource], ['zh-CN', zhSource]]) {
  assert.match(
    source,
    /"stitch_guide_title"/,
    `${locale} locale should include guide title copy.`,
  );
  assert.match(
    source,
    /"stitch_anatomy_explore_hint"/,
    `${locale} locale should include anatomy explorer helper copy.`,
  );
}

console.log('[PASS] Muscle Training friendly design guardrails passed.');
