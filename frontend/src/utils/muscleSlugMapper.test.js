import assert from 'node:assert/strict';
import { aggregateMuscleLoad, muscleSlugsForExercise } from './muscleSlugMapper.js';

const sorted = (values) => [...values].sort();

assert.deepEqual(
  sorted(muscleSlugsForExercise({ en: ['Legs', 'Back', 'Arms', 'Core'] })),
  sorted(['quadriceps', 'hamstring', 'gluteal', 'upper-back', 'lower-back', 'biceps', 'triceps', 'forearm', 'abs', 'obliques']),
  'generic workout labels should resolve to concrete react-muscle-highlighter slugs',
);

assert.deepEqual(
  sorted(muscleSlugsForExercise({ zh: ['腿部', '背部', '手臂', '核心'] })),
  sorted(['quadriceps', 'hamstring', 'gluteal', 'upper-back', 'lower-back', 'biceps', 'triceps', 'forearm', 'abs', 'obliques']),
  'Chinese workout labels should resolve to the same canonical slug set',
);

assert.deepEqual(
  aggregateMuscleLoad([
    { muscles: { en: ['Glutes', 'Hamstrings'] } },
    { muscles: { en: ['Glutes', 'Calves'] } },
    { muscles: { en: ['Glutes'] } },
  ]),
  [
    { slug: 'gluteal', intensity: 3 },
    { slug: 'hamstring', intensity: 1 },
    { slug: 'calves', intensity: 1 },
  ],
  'aggregateMuscleLoad should bucket repeated muscles into stronger heatmap intensities',
);

console.log('[PASS] Muscle slug mapper coverage passed.');
