// Smoke test for GitHub issue #36:
// "补齐力量训练今日计划动作的视频映射"
//
// Asserts the 12 backend-generated plan exercises listed in
// MuscleTrainingSessionService.java each resolve to a youtube-nocookie embed
// via the slugExerciseName + EXERCISE_VIDEO_EMBEDS pipeline in MuscleTraining.jsx,
// so the right-rail Reference Dock never shows "暂无动作视频" for them.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(__dirname, 'MuscleTraining.jsx'), 'utf8');

// Match the JS slug function inline so we don't have to import JSX into Node.
function slugExerciseName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// The 12 backend-generated plan exercises that issue #36 calls out.
const BACKEND_PLAN_EXERCISES = [
  'Hip airplanes',
  'Dead bug',
  'Split squat',
  'Single-leg Romanian deadlift',
  'Standing calf raise',
  'Side plank',
  'Glute bridge (pause at top)',
  'Tibialis wall raise',
  'Pogo hops',
  'Skipping A-drill',
  'Box step-up (explosive)',
  'Single-leg hop (low amplitude)',
];

// Extract the EXERCISE_VIDEO_EMBEDS literal from the page source so the
// test stays in lockstep with the production map.
const embedSliceMatch = pageSource.match(/const EXERCISE_VIDEO_EMBEDS\s*=\s*\{([\s\S]*?)\n\};/);
assert.ok(embedSliceMatch, 'EXERCISE_VIDEO_EMBEDS literal not found in MuscleTraining.jsx');
const embedBody = embedSliceMatch[1];

const embedMap = new Map();
const entryPattern = /['"]([a-z0-9-]+)['"]\s*:\s*['"](https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]+)['"]/g;
let m;
while ((m = entryPattern.exec(embedBody)) !== null) {
  embedMap.set(m[1], m[2]);
}
assert.ok(embedMap.size > 20, `EXERCISE_VIDEO_EMBEDS only parsed ${embedMap.size} entries — regex likely broke`);

// Per acceptance criteria: at least one backend plan exercise must resolve to
// a video embed. We assert ALL 12 resolve, because the fix landed all 12.
const unresolved = [];
for (const exerciseName of BACKEND_PLAN_EXERCISES) {
  const slug = slugExerciseName(exerciseName);
  if (!embedMap.has(slug)) {
    unresolved.push(`${exerciseName} (slug=${slug})`);
  }
}
assert.equal(
  unresolved.length,
  0,
  `Backend-generated plan exercises with no EXERCISE_VIDEO_EMBEDS entry: ${unresolved.join(', ')}`
);

const resolvedSample = slugExerciseName(BACKEND_PLAN_EXERCISES[0]);
assert.match(
  embedMap.get(resolvedSample) || '',
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]+$/,
  'Resolved embed URL must be a youtube-nocookie embed (matches the existing trust policy).',
);

console.log(`PASS muscleTrainingPlanVideoMapping: ${BACKEND_PLAN_EXERCISES.length}/12 backend plan exercises resolve to video embeds`);
