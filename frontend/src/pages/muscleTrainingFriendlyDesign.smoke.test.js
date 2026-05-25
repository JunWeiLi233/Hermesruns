import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'MuscleTraining.jsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '../styles/_split/muscle-training.css'), 'utf8');
const contrastSource = readFileSync(path.join(here, '../styles/contrast-fixes.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');
const anatomyAssetPath = path.join(here, '../assets/muscle-training/anatomy-neon-selector.png');
const controlDeckCssMatch = cssSource.match(
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.strength-plan-control-deck[\s\S]*?@media \(max-width:\s*980px\)/,
);
assert.ok(controlDeckCssMatch, 'The strength settings control deck should keep a dedicated CSS scope.');
const controlDeckCss = controlDeckCssMatch[0];

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

assert.doesNotMatch(
  pageSource,
  /className="mt-muscle-hotspot/,
  'The anatomy image should not render misaligned clickable hotspot circles.',
);

assert.match(
  pageSource,
  /const TOP_MUSCLE_HIT_ZONES = \[/,
  'The anatomy selector should define aligned transparent body-part hit zones.',
);

assert.match(
  pageSource,
  /id: 'shoulders-front-left', key: 'shoulders', left: '16%', top: '22%', width: '12%', height: '12%'/,
  'The shoulder hit zone should be aligned to the actual shoulder area, not the abdomen.',
);

assert.match(
  pageSource,
  /className="mt-muscle-hit-zone-layer"/,
  'The anatomy image should restore a transparent clickable body-part layer.',
);

assert.match(
  pageSource,
  /className=\{`mt-muscle-hit-zone/,
  'The anatomy body-part layer should render real buttons for image clicks.',
);

assert.match(
  pageSource,
  /getPrimaryTopMuscleHitZoneId/,
  'The anatomy selector should map each bottom muscle button to a persistent primary hit-zone ring.',
);

assert.ok(
  (pageSource.match(/onClick=\{\(\) => handleTopMuscleSelect\(zone\.key,\s*zone\.id\)\}/g) || []).length >= 1,
  'Anatomy image hit zones should call the top-muscle selection handler.',
);

assert.match(
  pageSource,
  /selectedMuscleHitZoneId === zone\.id/,
  'Only the specific selected anatomy hit zone should keep a persistent active ring.',
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
  /<button type="button" className="mt-hero-cta" onClick=\{scrollToControls\}>[\s\S]*className="mt-hero-cta-label"[\s\S]*\{stitchCopy\.startWorkout\}/,
  'The hero CTA text should use a dedicated label wrapper so Chinese copy cannot collapse into stacked lines.',
);

assert.match(
  cssSource,
  /\.mt-hero-cta-label\s*\{[\s\S]*white-space:\s*nowrap;/,
  'The hero CTA label should force one-line text layout.',
);

assert.match(
  cssSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-hero-cta > svg,[\s\S]*width:\s*1\.35em;[\s\S]*height:\s*1\.35em;/,
  'The hero CTA arrow should keep a fixed visible size beside the label.',
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
  /historyPlaceholderBadge/,
  'Recent PR/strength placeholder copy should stay explicit until real strength history is wired.',
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

assert.doesNotMatch(
  cssSource,
  /\.mt-muscle-hotspot/,
  'Misaligned anatomy hotspot circles should not be styled or rendered.',
);

assert.match(
  cssSource,
  /\.mt-muscle-hit-zone-layer\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*pointer-events:\s*none;/,
  'The anatomy image should use an overlay layer for transparent body-part hit zones.',
);

assert.match(
  cssSource,
  /\.mt-muscle-hit-zone\s*\{[\s\S]*min-width:\s*44px;[\s\S]*min-height:\s*44px;[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*cursor:\s*pointer;/,
  'Anatomy hit zones should be transparent by default and still meet touch target requirements.',
);

assert.match(
  cssSource,
  /\.mt-muscle-hit-zone:hover,[\s\S]*\.mt-muscle-hit-zone:focus-visible,[\s\S]*\.mt-muscle-hit-zone\.is-active\s*\{[\s\S]*background:\s*rgba\(240,\s*117,\s*97,\s*0\.12\);[\s\S]*outline-color:\s*rgba\(240,\s*117,\s*97,\s*0\.88\);/,
  'Anatomy hit zones should reveal feedback on hover, keyboard focus, and the selected persistent ring.',
);

assert.match(
  cssSource,
  /\.mt-muscle-hit-zone\.is-active\s*\{[\s\S]*box-shadow:\s*0 0 0 2px rgba\(240,\s*117,\s*97,\s*0\.78\) inset/,
  'The selected anatomy hit zone should keep a persistent visible ring after click or bottom-button selection.',
);

assert.match(
  cssSource,
  /\.mt-muscle-hit-zone:active\s*\{[\s\S]*background:\s*rgba\(240,\s*117,\s*97,\s*0\.18\);/,
  'Anatomy hit zones should show pressed feedback without persistent default circles.',
);

assert.match(
  cssSource,
  /\.mt-muscle-target-buttons\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[\s\S]*gap:\s*10px;/,
  'Visible muscle-target shortcut buttons should use a compact desktop grid.',
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
