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
  /mt-ironpulse-page/,
  'Muscle Training should use the new IRONPULSE page scope.',
);

assert.doesNotMatch(
  pageSource,
  /data-friendly-strength-lab|muscle-training-page|mt-week-strip|mt-anatomy-command-board|strength-plan-hero-shell/,
  'The old friendly/Runner Atlas first-screen structures must not remain in MuscleTraining.jsx.',
);

assert.match(
  pageSource,
  /className="mt-ip-volume-goal"/,
  'The page should start with the centered weekly strength goal ring.',
);

assert.match(
  pageSource,
  /className="mt-ip-current-split"/,
  'The page should render the current training arrangement split bar.',
);

assert.match(
  pageSource,
  /className="mt-ip-target-filter-rail"/,
  'The page should render a compact target-area filter rail for the protocol workbench.',
);

assert.ok(
  pageSource.indexOf('className="mt-ip-protocol mt-ip-protocol-workbench"') > pageSource.indexOf('className="mt-ip-current-split"')
    && pageSource.indexOf('className="mt-ip-protocol mt-ip-protocol-workbench"') < pageSource.indexOf('className="mt-ip-records"'),
  'The action protocol workbench should be promoted directly after the split bar, before lower-priority record modules.',
);

assert.match(
  pageSource,
  /className="mt-ip-protocol mt-ip-protocol-workbench"/,
  'The protocol should use a practical two-column workbench layout.',
);

assert.doesNotMatch(
  pageSource,
  /className="mt-ip-target-grid"/,
  'The large 3x2 target image grid should no longer be the primary interaction path.',
);

assert.match(
  pageSource,
  /recentStrengthPlaceholders/,
  'Recent PR/strength records must remain an explicit placeholder until real strength history is wired.',
);

assert.match(
  pageSource,
  /const COMPOUND_TARGET_LIBRARY = \{/,
  'Muscle Training should define the frontend-only compound target exercise library.',
);

assert.equal(
  (pageSource.match(/compoundLibraryExercise\(\{\s*[\r\n]+\s*key:/g) || []).length,
  24,
  'Each of the six target areas should expose four compound-library exercises.',
);

for (const [targetKey, firstExercise, lastExercise] of [
  ['chest', 'barbell-bench-press', 'push-up'],
  ['back', 'pull-up', 'chest-supported-row'],
  ['legs', 'barbell-squat', 'bulgarian-split-squat'],
  ['shoulders', 'standing-overhead-press', 'dumbbell-clean-press'],
  ['arms', 'chin-up', 'farmer-carry'],
  ['core', 'turkish-get-up', 'barbell-rollout'],
]) {
  assert.match(
    pageSource,
    new RegExp(`${targetKey}: \\[[\\s\\S]*${firstExercise}[\\s\\S]*${lastExercise}`),
    `${targetKey} should include its compound-library exercise set.`,
  );
}

assert.match(
  pageSource,
  /source:\s*'library'/,
  'Compound library rows should be marked as library items, separate from the real plan.',
);

assert.match(
  pageSource,
  /stitch_optional_library_note/,
  'Optional library exercises should be labelled as not participating in today recommendation calculation.',
);

assert.match(
  styleSource,
  /\.mt-ip-exercise-section-label--library/,
  'Compound-library rows should have their own dark IRONPULSE section styling.',
);

assert.equal(
  (pageSource.match(/import target[A-Z][A-Za-z]+Url from '\.\.\/assets\/muscle-training\/target-[a-z]+\.webp';/g) || []).length,
  6,
  'The target area cards should use six local dark WebP training photo assets.',
);

assert.doesNotMatch(
  pageSource,
  /target-[a-z]+\.svg/,
  'The target area cards should not use the old abstract SVG placeholders.',
);

assert.match(
  pageSource,
  /apiJson\('\/api\/training\/muscle\/today'/,
  'Check-in save/reset must call the backend route that actually exists.',
);

assert.doesNotMatch(
  pageSource,
  /\/api\/training\/muscle\/check-in\/today/,
  'The old check-in endpoint must not remain in the page.',
);

assert.match(
  styleSource,
  /\.hermes-site-frame\[data-route-path="\/muscle-training"\] \.runner-shell-canvas::before\s*\{[\s\S]*display:\s*none !important;/,
  'The new route should explicitly suppress Runner Atlas white canvas overlays.',
);

assert.match(
  styleSource,
  /\.mt-ironpulse-page\s*\{[\s\S]*--mt-ironpulse-acid:\s*#ccff00;/,
  'IRONPULSE styles should be scoped to mt-ironpulse-page and use the acid green accent.',
);

assert.match(
  styleSource,
  /\.mt-ip-target-filter-rail/,
  'Target-area filtering should be styled as a compact rail, not the main visual grid.',
);

assert.match(
  styleSource,
  /\.mt-ip-filter-chip:is\(:hover,\s*:focus-visible,\s*\.is-active\)/,
  'Target-area filter chips must keep visible hover, selected, and keyboard focus states.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*760px\)[\s\S]*\.mt-ip-target-filter-rail\s*\{[\s\S]*overflow-x:\s*auto;/,
  'Mobile target-area filter chips should scroll horizontally instead of overflowing the viewport.',
);

for (const [locale, source] of [['en', enSource], ['zh-CN', zhSource]]) {
  assert.match(
    source,
    /"stitch_history_placeholder_badge"/,
    `${locale} locale should label placeholder strength-history metrics honestly.`,
  );
  assert.match(
    source,
    /"stitch_target_chest"/,
    `${locale} locale should include the fixed target-area card labels.`,
  );
  assert.match(
    source,
    /"stitch_recent_prs_title"/,
    `${locale} locale should include the recent strength records heading.`,
  );
  assert.match(
    source,
    /"stitch_today_plan_title"/,
    `${locale} locale should include the real-plan section title.`,
  );
  assert.match(
    source,
    /"stitch_compound_library_title"/,
    `${locale} locale should include the compound-library section title.`,
  );
  assert.match(
    source,
    /"stitch_optional_library_note"/,
    `${locale} locale should clearly mark library exercises as optional.`,
  );
}

console.log('[PASS] Muscle Training IRONPULSE reference-one guardrails passed.');
