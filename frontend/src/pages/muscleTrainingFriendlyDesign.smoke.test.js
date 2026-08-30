import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'MuscleTraining.jsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '../styles/_split/muscle-training.css'), 'utf8');
const profileAlignmentSource = readFileSync(path.join(here, '../styles/muscle-training-profile-alignment.css'), 'utf8');
const contrastSource = readFileSync(path.join(here, '../styles/contrast-fixes.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');
const controlDeckCssMatch = cssSource.match(
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck[\s\S]*?@media \(max-width:\s*980px\)/,
);
assert.ok(controlDeckCssMatch, 'The strength settings control deck should keep a dedicated CSS scope.');
const controlDeckCss = controlDeckCssMatch[0];

function extractObjectBlock(source, declarationName) {
  const declarationStart = source.indexOf(`const ${declarationName} = {`);
  assert.notEqual(declarationStart, -1, `${declarationName} should be declared.`);
  const objectStart = source.indexOf('{', declarationStart);
  let depth = 0;
  for (let index = objectStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(objectStart, index + 1);
    }
  }
  assert.fail(`${declarationName} object should close.`);
}

function extractTopLevelQuotedKeys(objectSource) {
  const keys = [];
  const keyPattern = /^\s{2}(['"])((?:\\.|(?!\1).)+)\1\s*:/gm;
  let match;
  while ((match = keyPattern.exec(objectSource))) {
    keys.push(match[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return keys;
}

function slugExerciseNameForTest(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function objectBlockHasTopLevelKey(objectSource, key) {
  const escaped = escapeRegExp(key);
  return new RegExp(`(^|\\n)\\s{2}(?:['"]${escaped}['"]|${escaped})\\s*:`).test(objectSource);
}

const videoEmbedKeys = new Set(extractTopLevelQuotedKeys(extractObjectBlock(pageSource, 'EXERCISE_VIDEO_EMBEDS')));
const compoundExerciseKeys = [
  ...pageSource.matchAll(/compoundLibraryExercise\(\{\s*key:\s*'([^']+)'/g),
].map((match) => match[1]);
const researchedRunnerStrengthKeys = [
  'barbell-hip-thrust',
  'single-leg-leg-press',
  'glute-ham-raise',
  'squat-jump',
];
const runnerExerciseNames = extractTopLevelQuotedKeys(extractObjectBlock(pageSource, 'EXERCISE_LIBRARY'));
const runnerExerciseKeys = runnerExerciseNames.map(
  slugExerciseNameForTest,
);

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
assert.match(
  pageSource,
  /className="mt-muscle-visual mt-muscle-visual--svg"[\s\S]*<MuscleHeatmap[\s\S]*side="both"/,
  'The top anatomy workbench should use the MIT SVG muscle diagram component instead of the old raster anatomy image.',
);

assert.doesNotMatch(
  pageSource,
  /anatomyNeonSelectorUrl|anatomy-neon-selector\.png/,
  'The page should not keep the replaced neon anatomy PNG import.',
);

assert.match(
  pageSource,
  /className="mt-top-workbench"/,
  'The page should add the screenshot-matched top anatomy workbench.',
);

assert.doesNotMatch(
  pageSource,
  /className="mt-muscle-hotspot/,
  'The anatomy image should not render misaligned clickable hotspot circles.',
);

assert.doesNotMatch(
  pageSource,
  /TOP_MUSCLE_HIT_ZONES|mt-muscle-hit-zone-layer|selectedMuscleHitZoneId|getPrimaryTopMuscleHitZoneId/,
  'The top anatomy selector should not render a separate floating hit-zone overlay; the SVG paths are the hit zones.',
);

assert.match(
  pageSource,
  /<MuscleHeatmap[\s\S]*?data=\{topMuscleSelectorData\}[\s\S]*?onMuscleClick=\{\(part\) => \{[\s\S]*?resolveTopMuscleTargetFromSlug\(part\?\.slug\)[\s\S]*?handleTopMuscleSelect\(targetKey\);/,
  'The anatomy diagram should use the real react-muscle-highlighter SVG muscle paths for click selection.',
);

assert.match(
  pageSource,
  /function buildTopMuscleSelectorData\(activeTarget\)[\s\S]*?const activeSlugs = TOP_MUSCLE_SELECTOR_GROUPS\[activeTarget\] \|\| TOP_MUSCLE_SELECTOR_GROUPS\.legs;[\s\S]*?fill: 'var\(--mtpa-muscle-active-fill\)',[\s\S]*?stroke: 'var\(--mtpa-muscle-active-stroke\)',[\s\S]*?strokeWidth: 1\.65,[\s\S]*?opacity: 0\.94,/,
  'The selected top muscle target should use Hermes-themed SVG path fill/stroke styles so the highlight is visible without neon color.',
);

assert.match(
  pageSource,
  /className="mt-muscle-target-buttons"/,
  'The top anatomy selector should include visible muscle-target shortcut buttons.',
);

assert.match(
  pageSource,
  /className=\{`mt-muscle-target-button/,
  'Visible muscle-target shortcut buttons should render from the real target-area data.',
);

assert.ok(
  (pageSource.match(/onClick=\{\(\) => handleTopMuscleSelect\(target\.key\)\}/g) || []).length >= 1,
  'Visible target buttons should call the top-muscle selection handler.',
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

assert.deepEqual(
  [...new Set([...compoundExerciseKeys, ...runnerExerciseKeys])].filter((key) => !videoEmbedKeys.has(key)),
  [],
  'Every compound and runner-specific training exercise should have a nocookie video embed.',
);

assert.ok(
  videoEmbedKeys.size >= 43,
  'Video embeds should cover the compound library and the runner-specific exercise library.',
);

assert.match(
  pageSource,
  /className="mt-card mt-reference-card"/,
  'The lower right rail should render the restored exercise image and cue card.',
);

assert.match(
  pageSource,
  /className="mt-media-rail-sticky"/,
  'The lower right rail should use an inner sticky wrapper so the grid area can stay tall.',
);

assert.match(
  pageSource,
  /const EXERCISE_REFERENCE_IMAGES = \{/,
  'Muscle Training should define an action-keyed online exercise image registry.',
);

assert.ok(
  (pageSource.match(/:\s*(exerciseDbImage|youtubeThumbnail)\(/g) || []).length >= 40,
  'Exercise reference images should cover the compound library plus common generated-plan movements.',
);

assert.match(
  pageSource,
  /resolveExerciseReferenceImage/,
  'The reference rail should resolve images by selected exercise before falling back to the target area.',
);

assert.doesNotMatch(
  pageSource,
  /<img\s+src=\{selectedRailTargetCard\?\.image\s*\|\|\s*targetLegsUrl\}/,
  'The lower right rail image must not bind directly to the target-area image.',
);

assert.match(
  pageSource,
  /'standing-overhead-press':\s*exerciseDbImage\('Standing_Military_Press\/0\.jpg'\)/,
  'Standing overhead press should have its own online reference image.',
);

assert.match(
  pageSource,
  /'push-press':\s*exerciseDbImage\('Push_Press\/0\.jpg'\)/,
  'Push press should have its own online reference image distinct from standing overhead press.',
);

assert.doesNotMatch(
  pageSource,
  /import\.meta\.glob\(\s*['"][^'"]*muscle-training\/exercises/,
  'Exercise reference images should not use locally generated exercise assets.',
);

assert.doesNotMatch(
  pageSource,
  /mt-recovery-suggestions/,
  'The gray recovery placeholder icon list should not render in the lower right rail.',
);

assert.ok(
  pageSource.indexOf('className="mt-top-workbench"') < pageSource.indexOf('className="mt-exercises"'),
  'Top anatomy workbench should appear before the exercise list.',
);

assert.doesNotMatch(
  pageSource,
  /className="mt-hero"|mt-hero-title|mt-hero-cta|mt-ring-wrap/,
  'The removed mt-hero section and its progress-ring/CTA children should not render.',
);

// ── Removed recommendation/grid panels ─────────────────────────────────────
assert.doesNotMatch(
  pageSource,
  /className="mt-recommend"|className="mt-card mt-session-card"|className="mt-card mt-targets-card"|className="mt-target-grid"/,
  'The removed recommendation band and target/session grid cards should not render.',
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

assert.match(
  pageSource,
  /className="card muscle-panel muscle-preference-panel muscle-profile-panel muscle-control-card"/,
  'The lower training profile panel should use the upgraded profile-specific layout.',
);

assert.match(
  pageSource,
  /className="muscle-controls-grid"/,
  'The lower settings deck should use one compact control-console grid instead of loose stacked forms.',
);

assert.match(
  pageSource,
  /className="card muscle-panel muscle-preference-panel muscle-checkin-panel muscle-control-card"/,
  'The check-in panel should be one lane of the compact settings console.',
);

assert.match(
  pageSource,
  /className="card muscle-panel muscle-preference-panel muscle-profile-panel muscle-control-card"/,
  'The training profile panel should be one lane of the compact settings console.',
);

assert.match(
  pageSource,
  /className="muscle-control-source-note"/,
  'Plan source should move into a lightweight inline note instead of a bulky status block.',
);

assert.doesNotMatch(
  pageSource,
  /className="muscle-status-source"/,
  'The compact settings deck should not render the old bulky plan-source horizontal block.',
);

assert.match(
  pageSource,
  /className="muscle-profile-summary-strip muscle-profile-summary-strip--compact"/,
  'The training profile summary should render as a compact data strip.',
);

assert.match(
  pageSource,
  /className="muscle-profile-impact muscle-profile-impact-strip"/,
  'The plan-impact hints should render as a compact bottom strip.',
);

assert.match(
  pageSource,
  /const profileSummaryItems = useMemo/,
  'The training profile summary should be derived from existing plan and draft data.',
);

assert.match(
  pageSource,
  /draft\.equipmentLevel[\s\S]*draft\.experienceLevel[\s\S]*draft\.sessionMinutes[\s\S]*draft\.preferredStrengthDays/,
  'The tuning preview should use draft equipment, experience, duration, and preferred days before save.',
);

assert.match(
  pageSource,
  /const profileImpactItems = useMemo/,
  'The training profile panel should include plan-impact copy derived from the current draft.',
);

assert.match(
  pageSource,
  /const profileHasUnsavedChanges = useMemo/,
  'The tuning panel should explicitly detect unsaved profile changes.',
);

const profilePanelIndex = pageSource.indexOf('className="card muscle-panel muscle-preference-panel muscle-profile-panel muscle-control-card"');
const profilePanelEnd = pageSource.indexOf('</section>', profilePanelIndex);
const profilePanelSource = pageSource.slice(profilePanelIndex, profilePanelEnd);
const checkinPanelIndex = pageSource.indexOf('className="card muscle-panel muscle-preference-panel muscle-checkin-panel muscle-control-card"');
const checkinPanelEnd = pageSource.indexOf('</section>', checkinPanelIndex);
const checkinPanelSource = pageSource.slice(checkinPanelIndex, checkinPanelEnd);

assert.match(
  profilePanelSource,
  /<form onSubmit=\{handleSave\} className="muscle-pref-grid muscle-profile-form"/,
  'The upgraded training profile must keep the existing save handler.',
);

assert.match(
  profilePanelSource,
  /profileHasUnsavedChanges \? copy\.profileDirty : copy\.profileSynced/,
  'The tuning panel should show whether the visible draft is already synced.',
);

assert.match(
  profilePanelSource,
  /copy\.profileSummaryTitle/,
  'The tuning preview title should stay localized instead of hardcoded.',
);

for (const hint of [
  'profileExperienceHint',
  'profileEquipmentHint',
  'profileSessionMinutesHint',
  'profileNoiseHint',
  'profilePreferredDaysHint',
]) {
  assert.match(
    profilePanelSource,
    new RegExp(`copy\\.${hint}`),
    `The tuning form should explain what ${hint} changes.`,
  );
}

assert.match(
  checkinPanelSource,
  /copy\.checkInEffectHint/,
  'The check-in panel should explain that saving recalculates the remaining plan.',
);

assert.match(
  checkinPanelSource,
  /<form onSubmit=\{handleCheckInSave\} className="muscle-pref-grid muscle-checkin-form"/,
  'The compact check-in lane must keep the existing check-in save handler.',
);

assert.match(
  checkinPanelSource,
  /onClick=\{handleCheckInReset\}/,
  'The compact check-in lane must keep the existing reset handler.',
);

for (const field of [
  'checkInDraft.entryState',
  'checkInDraft.runType',
  'checkInDraft.distanceKm',
  'checkInDraft.durationMinutes',
]) {
  assert.match(
    checkinPanelSource,
    new RegExp(field.replace('.', '\\.')),
    `The check-in form should keep using the existing field ${field}.`,
  );
}

for (const field of [
  'draft.experienceLevel',
  'draft.equipmentLevel',
  'draft.sessionMinutes',
  'draft.noisePreference',
  'draft.preferredStrengthDays',
]) {
  assert.match(
    profilePanelSource,
    new RegExp(field.replace('.', '\\.')),
    `The profile form should keep using the existing field ${field}.`,
  );
}

assert.doesNotMatch(
  profilePanelSource,
  /oneRepMax|weightKg|repsOrDuration|targetRpe/,
  'The profile panel must not add fake lifting log fields.',
);

assert.match(
  pageSource,
  /className="mt-exercise-detail-layout"/,
  'Expanded exercise details should use an internal two-column layout wrapper.',
);

assert.match(
  pageSource,
  /className="mt-exercise-record"/,
  'Expanded exercise details should keep prescription, steps, and intent in a left-side record area.',
);

assert.match(
  pageSource,
  /className="mt-exercise-anatomy-panel"/,
  'Expanded exercise details should keep the MuscleHeatmap in a right-side anatomy panel.',
);

const detailIndex = pageSource.indexOf('className="mt-exercise-detail"');
const heatmapIndex = pageSource.indexOf('<MuscleHeatmap', detailIndex);
assert.ok(
  detailIndex >= 0 && heatmapIndex > detailIndex,
  'MuscleHeatmap should remain inside the expanded exercise detail block.',
);

assert.match(
  pageSource,
  /className="mt-exercise-record-prescription"[\s\S]*\{exercisePrescription\}/,
  'Expanded exercise details should show the existing localized prescription in the record area.',
);

assert.match(
  pageSource,
  /exerciseCopy\.steps\.length > 0[\s\S]*className="mt-exercise-steps"/,
  'Expanded exercise details should continue rendering the existing step list.',
);

assert.match(
  pageSource,
  /exerciseCopy\.intent[\s\S]*className="mt-exercise-intent"/,
  'Expanded exercise details should continue rendering the existing training intent.',
);

assert.ok(
  pageSource.indexOf('className="mt-exercises"') > pageSource.indexOf('className="mt-top-workbench"'),
  'Exercise list should appear after the top anatomy workbench.',
);

// ── Card layout ────────────────────────────────────────────────────────────
assert.match(
  pageSource,
  /className="mt-side-grid mt-media-rail"/,
  'The lower right rail should use the restored media rail instead of the gray recovery placeholder.',
);

// ── Data integrity: compound library still wired ───────────────────────────
assert.match(
  pageSource,
  /historyPlaceholderBadge/,
  'Recent PR/strength placeholder copy should stay explicit until real strength history is wired.',
);

assert.match(
  pageSource,
  /const COMPOUND_TARGET_LIBRARY = \{/,
  'Muscle Training should define the frontend-only compound target exercise library.',
);

for (const key of researchedRunnerStrengthKeys) {
  assert.ok(
    compoundExerciseKeys.includes(key),
    `The researched runner-strength library should include ${key}.`,
  );
}

assert.equal(
  (pageSource.match(/compoundLibraryExercise\(\{\s*[\r\n]+\s*key:/g) || []).length,
  28,
  'The six target areas should expose 24 compound exercises plus four researched runner-strength actions.',
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

// ── Exercise-specific anatomy heatmaps ─────────────────────────────────────
const heatmapSlugSource = extractObjectBlock(pageSource, 'EXERCISE_HEATMAP_SLUGS');
for (const key of compoundExerciseKeys) {
  assert.ok(
    objectBlockHasTopLevelKey(heatmapSlugSource, key),
    `Compound exercise ${key} should have explicit heatmap muscle slugs.`,
  );
}
for (const name of runnerExerciseNames) {
  assert.ok(
    objectBlockHasTopLevelKey(heatmapSlugSource, name),
    `Runner exercise ${name} should have explicit heatmap muscle slugs.`,
  );
}

assert.match(
  pageSource,
  /'Standing calf raise': \['calves'\]/,
  'Standing calf raise should highlight only the calves, not the whole leg group.',
);

assert.match(
  pageSource,
  /'Step-down \(knee tracking\)': \['quadriceps', 'gluteal', 'hamstring', 'adductors'\]/,
  'Step-down should highlight the actual stance-leg muscles rather than generic core/glute text.',
);

assert.match(
  pageSource,
  /const heatmapSlugs = getExerciseHeatmapSlugs\(item, exerciseCopy\);/,
  'Exercise detail anatomy panels should use explicit per-exercise heatmap slugs before falling back to text parsing.',
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
  /\.mt-top-workbench\s*\{/,
  'muscle-training.css should define the three-column top anatomy workbench.',
);

assert.match(
  cssSource,
  /\.mt-top-action-card\.is-selected/,
  'Top recommended actions need a visible selected state.',
);

assert.doesNotMatch(
  cssSource,
  /\.mt-muscle-hotspot/,
  'Misaligned anatomy hotspot circles should not be styled or rendered.',
);

assert.match(
  cssSource,
  /\.mt-muscle-hit-zone-layer\s*\{[\s\S]*display:\s*none !important;/,
  'Any legacy external anatomy overlay should be hidden so it cannot float between the SVG bodies.',
);

assert.match(
  cssSource,
  /\.mt-muscle-visual--svg \.muscle-heatmap__body--interactive svg path\s*\{[\s\S]*cursor:\s*pointer;[\s\S]*vector-effect:\s*non-scaling-stroke;[\s\S]*transition:\s*filter 150ms ease, opacity 150ms ease, stroke-width 150ms ease;/,
  'The real SVG muscle paths should be the clickable hit zones.',
);

assert.match(
  cssSource,
  /\.mt-muscle-visual--svg \.muscle-heatmap__body--interactive svg path:hover\s*\{[\s\S]*filter:\s*brightness\(1\.28\) drop-shadow\(0 0 5px rgba\(191,\s*255,\s*0,\s*0\.52\)\);/,
  'The real SVG muscle paths should show visible hover feedback instead of relying on rectangular overlays.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.runner-shell-canvas\.muscle-training-canvas\s*\{[\s\S]*width:\s*100% !important;[\s\S]*max-width:\s*none !important;[\s\S]*min-height:\s*calc\(100vh - 68px\);/,
  'The Muscle Training route canvas should fill the available viewport instead of using a boxed content width.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-content\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;[\s\S]*min-height:\s*calc\(100vh - 68px\);[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.72fr\) minmax\(360px,\s*0\.88fr\);/,
  'The Muscle Training route content grid should be full-screen width with no max-width clamp.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-top-workbench\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;[\s\S]*grid-template-columns:\s*minmax\(320px,\s*1\.05fr\) minmax\(420px,\s*1\.2fr\) minmax\(340px,\s*0\.95fr\);/,
  'The top muscle workbench should stretch its three grid lanes across the full route width.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-protocol-board \.strength-plan-content-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.6fr\) minmax\(340px,\s*0\.8fr\);/,
  'The lower protocol grid should also use full-width route proportions.',
);

assert.match(
  cssSource,
  /\.mt-muscle-target-buttons\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[\s\S]*grid-auto-rows:\s*minmax\(52px,\s*auto\);[\s\S]*gap:\s*10px;/,
  'Visible muscle-target shortcut buttons should use a concrete 3-column desktop grid with stable row sizing.',
);

assert.match(
  cssSource,
  /\.mt-top-muscle-card\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-rows:\s*auto minmax\(300px,\s*1fr\) auto auto;[\s\S]*gap:\s*14px;/,
  'The top muscle card should be a concrete four-row grid: title, anatomy selector, target grid, hint.',
);

assert.match(
  cssSource,
  /\.mt-muscle-visual-shell\s*\{[\s\S]*position:\s*relative;[\s\S]*display:\s*grid;[\s\S]*place-items:\s*center;[\s\S]*background:[\s\S]*linear-gradient\(rgba\(191,\s*255,\s*0,\s*0\.045\) 1px, transparent 1px\)[\s\S]*background-size:\s*32px 32px,\s*32px 32px,\s*auto,\s*auto;[\s\S]*min-height:\s*clamp\(280px,\s*34vw,\s*420px\);/,
  'The anatomy visual shell should be the positioned grid container for the absolute hit-zone layer.',
);

assert.match(
  cssSource,
  /\.mt-muscle-visual\s*\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*1;[\s\S]*width:\s*min\(100%,\s*430px\);[\s\S]*object-fit:\s*contain;/,
  'The anatomy image should be bounded inside the concrete selector grid instead of relying on intrinsic image sizing.',
);

assert.match(
  cssSource,
  /\.mt-muscle-target-button\s*\{[\s\S]*min-height:\s*46px;[\s\S]*cursor:\s*pointer;[\s\S]*touch-action:\s*manipulation;/,
  'Visible muscle-target shortcut buttons should meet touch target and pointer affordance requirements.',
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
  /\.muscle-profile-form\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  'Training profile controls should be grouped into a two-column form on desktop.',
);

assert.match(
  cssSource,
  /\.muscle-profile-control select,[\s\S]*\.muscle-profile-control input\s*\{[\s\S]*min-height:\s*46px;/,
  'Training profile controls should keep accessible touch height.',
);

assert.match(
  cssSource,
  /\.muscle-controls-grid\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.9fr\)\s*minmax\(0,\s*1\.1fr\);/,
  'The settings console should use a desktop two-lane grid.',
);

assert.match(
  cssSource,
  /@media \(max-width:\s*980px\)\s*\{[\s\S]*\.muscle-controls-grid\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
  'The settings console should stack to one column on small screens.',
);

assert.match(
  cssSource,
  /\.muscle-profile-summary-strip--compact\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
  'The training profile summary should be compact instead of a nested card grid.',
);

assert.match(
  cssSource,
  /\.muscle-profile-impact-strip ul\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
  'The plan-impact hints should sit in a compact horizontal strip on desktop.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-preference-head p,[\s\S]*\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-control-source-note,[\s\S]*color:\s*#dce6ca !important;/,
  'The compact settings deck should brighten muted headings and lightweight source copy.',
);

assert.doesNotMatch(
  pageSource,
  /className="mt-settings-summary"|className="mt-settings-disclosure"|stitchCopy\.settingsDisclosure/,
  'The unclear coach-settings disclosure button should not render on the strength settings deck.',
);

assert.match(
  pageSource,
  /<section id="muscle-controls" className="strength-plan-control-deck">[\s\S]*className="muscle-controls-grid"[\s\S]*className="card muscle-panel muscle-preference-panel muscle-checkin-panel muscle-control-card"[\s\S]*className="card muscle-panel muscle-preference-panel muscle-profile-panel muscle-control-card"/,
  'Removing the settings disclosure must keep check-in and training profile panels directly available.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-profile-summary-card strong,[\s\S]*color:\s*#f7fbe8 !important;/,
  'Training profile summary values should beat global light-theme strong overrides.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-preference-head h2,[\s\S]*color:\s*#f7fbe8 !important;/,
  'Settings deck section titles should beat global light-theme heading overrides.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-profile-impact p\s*\{[\s\S]*color:\s*#dce6ca !important;/,
  'Plan-impact copy should not use low-opacity muted text in the dark settings deck.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-pref-field :is\(input, select\),[\s\S]*color:\s*#f7fbe8 !important;/,
  'Training profile form controls should keep readable input and select text.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.primary-action-btn:not\(:disabled\)\s*\{[\s\S]*background:\s*linear-gradient\(135deg,\s*#ff8b74,\s*#e96651\) !important;[\s\S]*color:\s*#170807 !important;/,
  'Enabled settings primary actions should use the red-coral treatment instead of the old lime treatment.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-preference-baseline \.muscle-pill\s*\{[\s\S]*background:\s*rgba\(240,\s*117,\s*97,\s*0\.16\) !important;[\s\S]*color:\s*#f7fbe8 !important;/,
  'Settings preference pills should use a readable red-coral tint.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-day-chip\.active\s*\{[\s\S]*background:\s*linear-gradient\(135deg,\s*#ff8b74,\s*#e96651\) !important;[\s\S]*color:\s*#170807 !important;/,
  'Active settings chips must keep readable red-coral styling after light-theme overrides.',
);

assert.doesNotMatch(
  controlDeckCss,
  /#ccff00|204,\s*255,\s*0|var\(--mt-iron-accent\)/,
  'The settings control deck should not keep the old acid-lime active palette.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-profile-impact-strip\s*\{[\s\S]*border-color:\s*rgba\(240,\s*117,\s*97,\s*0\.28\);[\s\S]*background:\s*rgba\(240,\s*117,\s*97,\s*0\.09\);/,
  'The settings plan-impact strip should match the red-coral control palette.',
);

assert.match(
  contrastSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-day-chip\.active\s*\{[\s\S]*background:\s*var\(--brand-accent,\s*#c0462b\) !important;[\s\S]*color:\s*#ffffff !important;/,
  'White-theme final contrast guard should keep active settings chips red and readable.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck select option\s*\{[\s\S]*background:\s*#11140f !important;[\s\S]*color:\s*#f7fbe8 !important;/,
  'Native select options should use a dark readable option palette in the settings deck.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.primary-action-btn:disabled,[\s\S]*\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-secondary-btn:disabled\s*\{[\s\S]*color:\s*#cbd6bd !important;/,
  'Disabled primary and secondary settings actions should remain readable.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.primary-action-btn:disabled,[\s\S]*body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-secondary-btn:disabled\s*\{[\s\S]*color:\s*#cbd6bd !important;/,
  'Disabled settings buttons should beat global light-theme button overrides.',
);

assert.match(
  cssSource,
  /\.mt-exercise-detail-layout\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(220px,\s*320px\);/,
  'Expanded exercise details should define a two-column default layout.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-exercise-detail-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(260px,\s*360px\);/,
  'The active muscle-training page should place records left and the anatomy panel right on desktop.',
);

assert.match(
  cssSource,
  /@media \(max-width:\s*1180px\)\s*\{[\s\S]*\.mt-exercise-detail-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  'Expanded exercise details should stack on smaller screens.',
);

assert.match(
  cssSource,
  /\.mt-media-rail-sticky\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*24px;[\s\S]*max-height:\s*calc\(100vh - 48px\);[\s\S]*overflow-y:\s*auto;/,
  'Desktop media rail should stay visible while scrolling the exercise list.',
);

assert.match(
  cssSource,
  /html:has\(\.runner-dashboard-page \.mt-top-workbench\),[\s\S]*body:has\(\.runner-dashboard-page \.mt-top-workbench\),[\s\S]*#root\s*\{[\s\S]*overflow:\s*visible;/,
  'The muscle-training page should not create an outer overflow ancestor that breaks sticky positioning.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\)\s*\{[\s\S]*overflow-x:\s*clip;/,
  'The muscle-training page should keep horizontal overflow clipped after releasing the outer scroll ancestors.',
);

assert.match(
  cssSource,
  /@media \(max-width:\s*1180px\)\s*\{[\s\S]*\.mt-media-rail-sticky\s*\{[\s\S]*position:\s*static;[\s\S]*max-height:\s*none;[\s\S]*overflow:\s*visible;/,
  'Media rail sticky behavior should turn off below the tablet breakpoint.',
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

assert.match(
  pageSource,
  /useTheme/,
  'Muscle Training should read the global theme before choosing its local theme default.',
);

assert.match(
  pageSource,
  /const resolvedMuscleTheme = theme === 'midnight' \? 'dark' : 'white';/,
  'Muscle Training should derive its local surface theme directly from the global app theme.',
);

assert.match(
  pageSource,
  /data-muscle-theme=\{resolvedMuscleTheme\}/,
  'Muscle Training root should expose the theme derived from the global app theme for scoped CSS.',
);

assert.doesNotMatch(
  pageSource,
  /hermes_muscle_training_theme|MUSCLE_THEME_STORAGE_KEY|muscleThemeOverride|handleMuscleThemeSelect/,
  'Muscle Training should not keep a separate local theme preference.',
);

assert.doesNotMatch(
  pageSource,
  /mt-theme-switch|stitch_theme_toggle_label|stitch_theme_dark|stitch_theme_white/,
  'Muscle Training should not render a second theme switch inside the page.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-midnight, \.theme-high-contrast\) #root \.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-hero-title,[\s\S]*\.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-card-title\s*\{[\s\S]*color:\s*#fff !important;/,
  'Dark title forcing should only apply while the global app theme is dark.',
);

assert.doesNotMatch(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light, \.theme-midnight, \.theme-high-contrast\) #root \.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-hero-title/,
  'Light theme must not be included in the dark-only title forcing rule.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\)\s*\{/,
  'White theme should be scoped to the muscle-training page root.',
);

assert.doesNotMatch(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.runner-shell-sidebar\s*\{[\s\S]*background:\s*#f2efed !important;/,
  'Muscle Training sidebar must not be forced to the light shell before data-muscle-theme is applied.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\):not\(\[data-muscle-theme="white"\]\) \.runner-shell-sidebar\s*\{[\s\S]*background:[\s\S]*#080808/,
  'Dark muscle-training theme should keep the shared sidebar dark instead of turning it white.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.runner-shell-sidebar\s*\{[\s\S]*background:[\s\S]*#f2efed/,
  'White muscle-training theme should be the only place that uses the light sidebar surface.',
);

assert.doesNotMatch(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\):not\(\[data-muscle-theme="white"\]\) \.runner-shell-side-link\s*\{[^}]*font-size:/,
  'Dark muscle-training sidebar should inherit shared nav font size instead of enlarging it.',
);

assert.doesNotMatch(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\):not\(\[data-muscle-theme="white"\]\) \.runner-shell-side-link\s*\{[^}]*font-weight:/,
  'Dark muscle-training sidebar should inherit shared nav font weight instead of changing it.',
);

assert.doesNotMatch(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.runner-shell-side-link\s*\{[^}]*font-size:/,
  'White muscle-training sidebar should inherit shared nav font size instead of enlarging it.',
);

assert.doesNotMatch(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.runner-shell-side-link\s*\{[^}]*font-weight:/,
  'White muscle-training sidebar should inherit shared nav font weight instead of changing it.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.mt-top-workbench\s*\{[\s\S]*background:/,
  'White theme should repaint the top muscle workbench, not only the page background.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) :is\(\.mt-card,\s*\.mt-exercises,\s*\.mt-top-panel,\s*\.mt-top-reference-card,\s*\.mt-video-card,\s*\.mt-reference-card,\s*\.strength-plan-control-deck,\s*\.muscle-panel\)\s*\{[\s\S]*color:\s*#2c2f30 !important;/,
  'White theme should convert main cards to dark text on light surfaces.',
);

const whiteThemeSurfaceRuleIndex = profileAlignmentSource.indexOf(
  '#root .runner-dashboard-page[data-muscle-theme]:has(.mt-top-workbench) :is(.mt-card, .mt-exercises,',
);
const exercisesSurfaceResetIndex = profileAlignmentSource.lastIndexOf(
  '#root .runner-dashboard-page[data-muscle-theme]:has(.mt-top-workbench) .mt-exercises {',
);
assert.ok(
  whiteThemeSurfaceRuleIndex >= 0 && exercisesSurfaceResetIndex > whiteThemeSurfaceRuleIndex,
  'The top-workbench exercise-section reset should be defined after the broad card rule so the title band stays transparent in every theme.',
);
assert.match(
  profileAlignmentSource.slice(exercisesSurfaceResetIndex, exercisesSurfaceResetIndex + 420),
  /border:\s*0 !important;[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;/,
  'The top-workbench exercise section should not paint a separate strip behind its heading.',
);
const exercisesHeadingResetIndex = profileAlignmentSource.lastIndexOf(
  '#root .runner-dashboard-page[data-muscle-theme]:has(.mt-top-workbench) .mt-exercises-head {',
);
assert.ok(
  exercisesHeadingResetIndex > exercisesSurfaceResetIndex,
  'The exercise heading wrapper reset should follow the section surface reset.',
);
assert.match(
  profileAlignmentSource.slice(exercisesHeadingResetIndex, exercisesHeadingResetIndex + 260),
  /background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;/,
  'The exercise heading wrapper should not retain a background strip of its own.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) :is\([^}]*\.mt-top-workbench \.mt-top-reference-head h2[^}]*\.mt-reference-body h3[^}]*\)\s*\{[\s\S]*color:\s*var\(--mt-white-ink\) !important;/,
  'White theme should keep Reference Dock headings readable with dark text.',
);

assert.match(
  contrastSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) :is\(\.mt-top-actions-head h2,\s*\.mt-top-reference-head h2,\s*\.mt-reference-body h3,\s*\.mt-top-reference-body h3\)\s*\{[\s\S]*color:\s*#2c2f30 !important;/,
  'White theme contrast guard should force the top recommendation and reference body headings to dark text.',
);

assert.match(
  contrastSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) :is\(\.mt-reference-body p,\s*\.mt-reference-body li,\s*\.mt-reference-muscles > span,\s*\.mt-top-reference-body p,\s*\.mt-top-reference-body li,\s*\.mt-top-reference-muscles > span\)\s*\{[\s\S]*color:\s*#595c5d !important;/,
  'White theme contrast guard should keep reference body copy readable on light cards.',
);

assert.match(
  contrastSource,
  /\.runner-dashboard-page:not\(\[data-muscle-theme="white"\]\) \.mt-top-workbench \.mt-top-actions-head h2/,
  'Legacy light-theme contrast fixes should not force white headings on the new white muscle theme.',
);

assert.match(
  pageSource,
  /<span>\{stitchCopy\.targetMusclesLabel\}<\/span>/,
  'The top reference card should use localized target-muscle copy.',
);

assert.doesNotMatch(
  pageSource,
  /<span>Target Muscles<\/span>/,
  'The top reference card should not hard-code English target-muscle copy.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.mt-top-workbench \.mt-top-action-copy strong\s*\{[\s\S]*color:\s*var\(--brand-accent-strong, #8f2f22\) !important;/,
  'White theme should avoid neon recommendation names on a white card.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.mt-reference-steps li span\s*\{[\s\S]*color:\s*var\(--brand-accent-strong, #8f2f22\) !important;/,
  'White theme should keep Reference Dock step icons readable.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.strength-plan-control-deck \.muscle-day-chip\.active\s*\{[\s\S]*background:\s*var\(--brand-accent, #c0462b\) !important;[\s\S]*color:\s*#ffffff !important;/,
  'White theme active settings chips should stay readable on the darker green active surface.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.strength-plan-control-deck select option\s*\{[\s\S]*background:\s*#ffffff !important;[\s\S]*color:\s*#2c2f30 !important;/,
  'White theme select options should use white surfaces with dark text.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.strength-plan-control-deck :is\(\.muscle-preference-head h2,[\s\S]*\.muscle-profile-impact-strip > strong\)\s*\{[\s\S]*color:\s*#232629 !important;/,
  'White theme control deck headings and summary values should use explicit dark text after global light overrides.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.strength-plan-control-deck :is\(\.muscle-preference-head p,[\s\S]*\.muscle-profile-impact-strip p\)\s*\{[\s\S]*color:\s*#4d5650 !important;/,
  'White theme control deck descriptions and helper copy should use readable muted text on light surfaces.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.strength-plan-control-deck :is\(\.muscle-pref-field input,[\s\S]*\.muscle-day-chip:not\(\.active\),[\s\S]*\.muscle-secondary-btn:not\(:disabled\)\)\s*\{[\s\S]*background:\s*#fffaf6 !important;[\s\S]*color:\s*#232629 !important;/,
  'White theme controls, normal day chips, and secondary actions should not inherit pale dark-theme text.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.strength-plan-control-deck select option\s*\{[\s\S]*background:\s*#fffaf6 !important;[\s\S]*color:\s*#232629 !important;/,
  'White theme native select options should keep a high-contrast light menu palette.',
);

assert.match(
  cssSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.strength-plan-control-deck :is\(\.primary-action-btn:disabled,[\s\S]*\.muscle-secondary-btn:disabled\)\s*\{[\s\S]*color:\s*#6e625d !important;/,
  'White theme disabled settings buttons should stay visibly disabled without becoming unreadable.',
);

assert.match(
  contrastSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\)/,
  'Contrast fixes should include a final white-theme guard against global light-theme overrides.',
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
  assert.match(
    source,
    /"profile_summary_title"/,
    `${locale} locale should include the upgraded training profile summary copy.`,
  );
  assert.match(
    source,
    /"profile_dirty"/,
    `${locale} locale should include the unsaved tuning state copy.`,
  );
  assert.match(
    source,
    /"profile_equipment_hint"/,
    `${locale} locale should include field-level tuning explanation copy.`,
  );
  assert.match(
    source,
    /"profile_impact_equipment"/,
    `${locale} locale should include the training profile plan-impact copy.`,
  );
  assert.doesNotMatch(
    source,
    /"stitch_theme_toggle_label"|"stitch_theme_dark"|"stitch_theme_white"/,
    `${locale} locale should not include a second local muscle theme switch label.`,
  );
}

assert.match(
  zhSource,
  /"stitch_top_reference_title":\s*"动作参考"/,
  'zh-CN should translate Reference Dock to Chinese copy.',
);

assert.doesNotMatch(
  zhSource,
  /"stitch_top_reference_title":\s*"Reference Dock"/,
  'zh-CN should not show the English Reference Dock label.',
);

console.log('[PASS] Muscle Training redesign guardrails passed.');
