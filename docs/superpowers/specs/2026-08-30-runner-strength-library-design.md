# Runner Strength Library Design

## Goal

Add a small, research-backed set of runner-oriented strength actions to the Muscle Training page without changing Hermes' personalized plan generator.

## Evidence and selection

The exercise selection follows two findings from the reviewed literature:

- Strength programs for middle- and long-distance runners commonly use hip thrusts, single-leg presses, and glute-ham raises alongside running training.
- Plyometric work can complement heavy resistance work, with squat jumps providing a simple bilateral power action when performed for quality rather than fatigue.

Sources:

- [Effect of Strength Training Programs in Middle- and Long-Distance Runners' Economy at Different Running Speeds](https://pmc.ncbi.nlm.nih.gov/articles/PMC11052887/)
- [Effects of Strength Training on the Physiological Determinants of Middle- and Long-Distance Running Performance](https://pmc.ncbi.nlm.nih.gov/articles/PMC5889786/)
- [NASM squat jump technique](https://www.nasm.org/resource-center/exercise-library/squat-jump)

The imported actions are:

1. Barbell hip thrust
2. Single-leg leg press
3. Glute-ham raise
4. Squat jump

Existing split squats, single-leg Romanian deadlifts, calf raises, pogo hops, and explosive step-ups are not duplicated.

## Product behavior

The four actions belong to the existing frontend-only optional library under the legs target. They appear in the target count, exercise list, top recommendations, detail expansion, anatomy heatmap, reference image, and video dock. Their `source: 'library'` behavior remains unchanged, so they do not affect today's backend-generated recommendation or check-in calculations.

Each action includes bilingual names, target muscles, three concise steps, training intent, regression, and progression. Resistance actions use strength-oriented prescriptions; squat jumps use low repetitions and explicitly prioritize crisp landings over fatigue.

## Files and boundaries

- Modify `frontend/src/pages/muscle-training/MuscleTraining.jsx` for catalog entries and media/anatomy mappings.
- Modify `frontend/src/pages/muscle-training/__tests__/muscleTrainingFriendlyDesign.smoke.test.js` for catalog coverage.
- Do not change backend services, API payloads, CSS, route structure, or locale-wide page labels.

## Verification

1. Run the focused Muscle Training design contract.
2. Run the focused plan-video contract.
3. Run frontend lint.
4. Run the production frontend build through `frontend/scripts/run-vite-build.mjs`.
5. Run runtime-sync verification if the helper exists; otherwise report source/build status without claiming a live website update.
