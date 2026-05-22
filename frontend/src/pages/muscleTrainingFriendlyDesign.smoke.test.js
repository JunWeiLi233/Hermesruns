import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'MuscleTraining.jsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '../styles/_split/muscle-training.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');

// ── New mt-* card-based redesign presence ──────────────────────────────────
assert.match(
  pageSource,
  /muscle-training-canvas/,
  'Muscle Training should use the muscle-training-canvas wrapper class.',
);

assert.match(
  pageSource,
  /className="mt-content"/,
  'Muscle Training should use the mt-content wrapper inside the canvas.',
);

// ── Old IronPulse structures must be gone from page content area ───────────
assert.doesNotMatch(
  pageSource,
  /mt-ironpulse-page|mt-ip-volume-goal|mt-ip-current-split|mt-ip-target-filter-rail|mt-ip-protocol-workbench/,
  'Old IronPulse mt-ip-* class names must not appear in the redesigned content area.',
);

assert.doesNotMatch(
  pageSource,
  /data-friendly-strength-lab|muscle-training-page|mt-week-strip|mt-anatomy-command-board|strength-plan-hero-shell/,
  'Older friendly/Runner Atlas first-screen structures must not remain.',
);

assert.doesNotMatch(
  pageSource,
  /ExerciseActionDiagram|data-action-diagram|actionDiagram/,
  'The removed muscle-training diagram implementation must not be restored with the previous layout.',
);

assert.doesNotMatch(
  cssSource,
  /mt-action-diagram|mt-action-phase-play|mt-action-sweep/,
  'Removed action-diagram styles must stay out of the active muscle-training stylesheet.',
);

// ── Hero ring ──────────────────────────────────────────────────────────────
assert.match(
  pageSource,
  /className="mt-hero"/,
  'The page should start with an mt-hero section.',
);

assert.match(
  pageSource,
  /className="mt-ring-wrap"/,
  'The hero should include a progress ring (mt-ring-wrap) showing weekly completion.',
);

assert.match(
  pageSource,
  /volumeCompletion/,
  'The progress ring should display volumeCompletion percentage.',
);

// ── Recommendation banner ──────────────────────────────────────────────────
assert.match(
  pageSource,
  /className="mt-recommend"/,
  'The page should include an mt-recommend recommendation banner.',
);

// ── Exercise list structure ────────────────────────────────────────────────
assert.match(
  pageSource,
  /className="mt-exercises"/,
  'The page should include an mt-exercises section for the exercise list.',
);

assert.match(
  pageSource,
  /className="mt-exercises-filter"/,
  'The exercise section should include mt-exercises-filter filter chips.',
);

assert.ok(
  pageSource.indexOf('className="mt-exercises"') > pageSource.indexOf('className="mt-hero"'),
  'Exercise list should appear after the hero section.',
);

// ── Card layout ────────────────────────────────────────────────────────────
assert.match(
  pageSource,
  /className="mt-card mt-session-card"/,
  'Today\'s session should be displayed as an mt-card mt-session-card.',
);

assert.match(
  pageSource,
  /className="mt-card mt-history-card"/,
  'Load history should be displayed as an mt-card mt-history-card.',
);

// ── Data integrity: compound library still wired ───────────────────────────
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

// ── API endpoints ──────────────────────────────────────────────────────────
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

// ── CSS: new mt-* classes present in split CSS file ───────────────────────
assert.match(
  cssSource,
  /\.mt-hero\s*\{/,
  'muscle-training.css should define .mt-hero for the gradient hero section.',
);

assert.match(
  cssSource,
  /\.mt-exercises-filter\s*\{/,
  'muscle-training.css should define .mt-exercises-filter for the filter chip row.',
);

assert.match(
  cssSource,
  /\.mt-chip--filter\.is-active/,
  'Filter chips must have a visible active/selected state.',
);

assert.match(
  cssSource,
  /\.mt-ring-progress\s*\{/,
  'muscle-training.css should define .mt-ring-progress for the SVG ring arc.',
);

assert.match(
  cssSource,
  /@media \(max-width:\s*960px\)/,
  'muscle-training.css should have a responsive breakpoint for mobile layout.',
);

// ── Translations ───────────────────────────────────────────────────────────
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
    /"stitch_optional_library_note"/,
    `${locale} locale should clearly mark library exercises as optional.`,
  );
  assert.match(
    source,
    /"stitch_mt_hero_kicker"/,
    `${locale} locale should include the redesigned hero kicker label.`,
  );
  assert.match(
    source,
    /"stitch_mt_exercises_kicker"/,
    `${locale} locale should include the redesigned exercise section kicker.`,
  );
}

console.log('[PASS] Muscle Training redesign guardrails passed.');
