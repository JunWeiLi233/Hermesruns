import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'MuscleTraining.jsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '../styles/_split/muscle-training.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');
const anatomyAssetPath = path.join(here, '../assets/muscle-training/anatomy-neon-selector.png');

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
  pageSource,
  /className="mt-muscle-selector"|selectedMuscleRegionKey|handleMuscleRegionSelect/,
  'The rejected self-drawn anatomy selector implementation must stay removed.',
);

assert.doesNotMatch(
  cssSource,
  /mt-action-diagram|mt-action-phase-play|mt-action-sweep/,
  'Removed action-diagram styles must stay out of the active muscle-training stylesheet.',
);

// ── Hero ring ──────────────────────────────────────────────────────────────
assert.ok(
  existsSync(anatomyAssetPath),
  'The top anatomy workbench should use a local anatomy image asset instead of a hotlinked image.',
);

assert.match(
  pageSource,
  /anatomyNeonSelectorUrl/,
  'The page should import the local neon anatomy image asset.',
);

assert.match(
  pageSource,
  /className="mt-top-workbench"/,
  'The page should add the screenshot-matched top anatomy workbench.',
);

assert.match(
  pageSource,
  /className="mt-muscle-hotspot/,
  'The top anatomy image should expose real clickable muscle-group hotspots.',
);

assert.match(
  pageSource,
  /handleTopExerciseSelect/,
  'Top recommendations should select the current reference action without expanding the lower protocol rows.',
);

assert.match(
  pageSource,
  /EXERCISE_VIDEO_EMBEDS/,
  'The right rail should restore the GitHub-history YouTube nocookie embed mapping.',
);

assert.match(
  pageSource,
  /getExerciseVideoEmbedUrl/,
  'The right rail should resolve video embeds from the selected protocol item.',
);

assert.match(
  pageSource,
  /className="mt-card mt-video-card"/,
  'The lower right rail should render an exercise video card.',
);

assert.match(
  pageSource,
  /className="mt-card mt-reference-card"/,
  'The lower right rail should render the restored exercise image and cue card.',
);

assert.doesNotMatch(
  pageSource,
  /mt-recovery-suggestions/,
  'The gray recovery placeholder icon list should not render in the lower right rail.',
);

assert.ok(
  pageSource.indexOf('className="mt-top-workbench"') < pageSource.indexOf('className="mt-hero"'),
  'Top anatomy workbench should appear before the existing hero.',
);

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

assert.match(
  pageSource,
  /className="mt-filter-visual"/,
  'Target filter chips should display their local body-part image inside each body-part button.',
);

assert.match(
  pageSource,
  /handleExerciseSelect\(item\)/,
  'Clicking a lower exercise row should sync the right rail video and reference card.',
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
  /className="mt-side-grid mt-media-rail"/,
  'The lower right rail should use the restored media rail instead of the gray recovery placeholder.',
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
  /\.mt-top-workbench\s*\{/,
  'muscle-training.css should define the three-column top anatomy workbench.',
);

assert.match(
  cssSource,
  /\.mt-top-action-card\.is-selected/,
  'Top recommended actions need a visible selected state.',
);

assert.match(
  cssSource,
  /\.mt-muscle-hotspot\.is-active/,
  'Clickable muscle hotspots need a visible active state.',
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
  /\.mt-video-frame iframe/,
  'muscle-training.css should style the restored embedded video frame.',
);

assert.match(
  cssSource,
  /\.mt-filter-visual img/,
  'muscle-training.css should size the body-part images inside filter buttons.',
);

assert.match(
  cssSource,
  /\.mt-reference-media img/,
  'muscle-training.css should style the restored exercise reference image.',
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
  assert.match(
    source,
    /"stitch_top_muscle_title"/,
    `${locale} locale should include the top anatomy workbench copy.`,
  );
  assert.match(
    source,
    /"stitch_top_reference_title"/,
    `${locale} locale should include the Reference Dock copy.`,
  );
  assert.match(
    source,
    /"stitch_video_demo_title"/,
    `${locale} locale should include the restored exercise video title.`,
  );
  assert.match(
    source,
    /"stitch_video_unavailable"/,
    `${locale} locale should include the no-video state.`,
  );
}

console.log('[PASS] Muscle Training redesign guardrails passed.');
