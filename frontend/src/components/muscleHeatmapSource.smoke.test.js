import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { buildStrengthWeekCoverage } from '../pages/muscle-training/strengthWeek.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'MuscleHeatmap.jsx'), 'utf8');
const pageSource = readFileSync(path.join(here, "../pages/muscle-training/MuscleTraining.jsx"), 'utf8');
const cssSource = readFileSync(path.join(here, '../styles/muscle-training-week-v2.css'), 'utf8');

assert.match(
  componentSource,
  /from ['"]react-muscle-highlighter['"]/,
  'MuscleHeatmap should wrap the react-muscle-highlighter package named in the task.',
);

assert.match(
  componentSource,
  /side="front"/,
  'MuscleHeatmap should render the front anatomy view.',
);

assert.match(
  componentSource,
  /side="back"/,
  'MuscleHeatmap should render the back anatomy view.',
);

assert.match(
  pageSource,
  /activeWeekDay\.items\.map\(\(item, index\) => \{\s*const exerciseCopy = getExerciseContentForItem\(item, isZh\);[\s\S]*?className="mt-week-v2-exercise-copy"[\s\S]*?\{exerciseCopy\.muscles\.slice\(0, 2\)\.join\(' · '\)\}/,
  'Every strength-week workout row must display anatomy from its own localized muscle metadata.',
);

assert.match(
  pageSource,
  /buildStrengthWeekCoverage\(\s*weekPlanDays,\s*\(item\) => getExerciseContentForItem\(item, isZh\)\.muscles/,
  'Weekly anatomy coverage must use the same workout muscle metadata as the visible rows.',
);

assert.match(
  cssSource,
  /#root \.mt-week-v2-exercise-copy span\s*\{[^}]*color:\s*var\(--mw-muted\)/,
  'Workout anatomy labels must retain strength-week styling and theme colors.',
);

// The week uses anatomy labels; the reusable heatmap still protects both views
// and validates the package's muscle slugs rather than accepting arbitrary parts.
const heatmap = runInNewContext(`${componentSource.slice(
  componentSource.indexOf('const COLORS ='),
  componentSource.indexOf('function HeatmapBody('),
)}\n({ normalizeHeatmapData, resolveViews })`);
const normalized = heatmap.normalizeHeatmapData([
  { slug: 'quadriceps', intensity: 0 },
  { slug: 'quadriceps', intensity: 8 },
  { slug: 'hamstring', intensity: 2 },
  { slug: 'abs', intensity: 'invalid' },
  { slug: 'not-an-anatomy-region', intensity: 3 },
  null,
]);
assert.deepEqual(Array.from(normalized, ({ slug, intensity }) => [slug, intensity]), [
  ['quadriceps', 3], ['hamstring', 2], ['abs', 1],
]);
assert.equal(heatmap.normalizeHeatmapData(null).length, 0);
for (const [slugs, side, expected] of [
  [[], 'auto', { front: true, back: false }],
  [['chest', 'quadriceps', 'abs'], 'auto', { front: true, back: false }],
  [['upper-back', 'hamstring', 'gluteal'], 'auto', { front: false, back: true }],
  [['quadriceps', 'hamstring'], 'auto', { front: true, back: true }],
  [['calves'], 'auto', { front: true, back: true }],
  [['hamstring'], 'front', { front: true, back: false }],
  [['chest'], 'back', { front: false, back: true }],
  [[], 'both', { front: true, back: true }],
]) {
  assert.deepEqual(JSON.parse(JSON.stringify(heatmap.resolveViews(slugs.map((slug) => ({ slug })), side))), expected);
}

// Execute the actual metadata resolver without mounting the authenticated page.
const { getExerciseContentForItem, library } = runInNewContext(`
  ${pageSource.slice(pageSource.indexOf('const FALLBACK_EXERCISE_COPY ='), pageSource.indexOf('const EXERCISE_HEATMAP_SLUGS ='))}
  ${pageSource.slice(pageSource.indexOf('const EXERCISE_COPY_FIELDS ='), pageSource.indexOf('function mapWorkoutTypeToCheckInType('))}
  ${pageSource.slice(pageSource.indexOf('function getExerciseCardContent('), pageSource.indexOf('function getExerciseVideoUrl('))}
  ({ getExerciseContentForItem, library: LOCALIZED_EXERCISE_LIBRARY })
`);
for (const [name, metadata] of Object.entries(library)) {
  for (const [locale, isZh] of [['en', false], ['zh', true]]) {
    const content = getExerciseContentForItem({ exercise: { name } }, isZh);
    assert.equal(content.name, metadata.name[locale], `${name} must keep its ${locale} exercise name.`);
    assert.ok(content.muscles.length > 0, `${name} must describe its ${locale} anatomy.`);
    assert.deepEqual(Array.from(content.muscles), Array.from(metadata.muscles[locale]));
  }
}
for (const [name, enMuscles, zhMuscles] of [
  ['Hip airplanes', ['Glutes', 'Core'], ['臀部', '核心']],
  ['Calf raises (slow tempo)', ['Calves'], ['小腿']],
  ['Dead bug', ['Core'], ['核心']],
  ['Single-leg Romanian deadlift', ['Glutes', 'Hamstrings'], ['臀部', '腘绳肌']],
]) {
  assert.deepEqual(Array.from(getExerciseContentForItem({ exercise: { name } }, false).muscles), enMuscles, `${name} must retain its English anatomy.`);
  assert.deepEqual(Array.from(getExerciseContentForItem({ exercise: { name } }, true).muscles), zhMuscles, `${name} must retain its Chinese anatomy.`);
}
const libraryItem = {
  source: 'library',
  exercise: { name: 'Library movement' },
  libraryContent: { muscles: { en: ['Chest', 'Triceps'], zh: ['胸部', '三头肌'] } },
};
assert.deepEqual(Array.from(getExerciseContentForItem(libraryItem, false).muscles), ['Chest', 'Triceps']);
assert.deepEqual(Array.from(getExerciseContentForItem(libraryItem, true).muscles), ['胸部', '三头肌']);
const days = [{ items: ['Hip airplanes', 'Calf raises (slow tempo)', 'Calf raises (slow tempo)'].map((name, index) => ({
  source: 'library', exercise: { name: `Movement ${index}` }, libraryContent: library[name],
})) }];
assert.deepEqual(buildStrengthWeekCoverage(days, (item) => getExerciseContentForItem(item, false).muscles), [
  { key: 'legs', sessions: 0 },
  { key: 'hips', sessions: 1 },
  { key: 'calves', sessions: 1 },
  { key: 'core', sessions: 1 },
  { key: 'upper', sessions: 0 },
]);

console.log('[PASS] Muscle heatmap source guardrails passed.');
