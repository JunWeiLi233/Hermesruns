import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'MuscleHeatmap.jsx'), 'utf8');
const pageSource = readFileSync(path.join(here, '../pages/MuscleTraining.jsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '../styles/muscle-training-hermes-redesign.css'), 'utf8');

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
  /visibleExerciseItems\.map[\s\S]*<MuscleHeatmap/,
  'Every visible workout row should be able to render a muscle heatmap in its expanded detail.',
);

assert.match(
  pageSource,
  /muscleSlugsForExercise\(\s*exerciseCopy\.muscles/,
  'Workout heatmaps should derive slugs from the workout muscle metadata.',
);

assert.match(
  cssSource,
  /\.mt-exercise-heatmap/,
  'The per-workout heatmap should have route-local styling.',
);

console.log('[PASS] Muscle heatmap source guardrails passed.');
