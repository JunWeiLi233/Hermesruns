import assert from 'node:assert/strict';

import { buildScheduleTargetBlockModel } from './scheduleMarathonBlock.js';

const marathonModel = buildScheduleTargetBlockModel(
  {
    name: 'Berlin Marathon Build',
    raceDistanceKm: 42.195,
    targetRaceDate: '2026-10-11',
    weekIndex: 9,
    currentLongRunKm: 30,
  },
  { today: '2026-09-21' },
);

assert.equal(marathonModel.hasActiveBlock, true);
assert.equal(marathonModel.hasTargetRace, true);
assert.equal(marathonModel.isMarathonBlock, true);
assert.equal(marathonModel.countdownDays, 20);
assert.equal(marathonModel.countdownWeeks, 3);
assert.equal(marathonModel.raceDistanceKm, 42.2);
assert.equal(marathonModel.currentLongRunKm, 30);
assert.equal(marathonModel.weekIndex, 9);

const halfModel = buildScheduleTargetBlockModel(
  {
    name: 'Half Build',
    raceDistanceKm: 21.1,
    targetRaceDate: '2026-05-04',
    weekIndex: 4,
    currentLongRunKm: 18,
  },
  { today: '2026-05-01' },
);

assert.equal(halfModel.hasActiveBlock, true);
assert.equal(halfModel.isMarathonBlock, false);
assert.equal(halfModel.countdownDays, 3);
assert.equal(halfModel.countdownWeeks, 1);

const emptyModel = buildScheduleTargetBlockModel(null, { today: '2026-05-01' });

assert.deepEqual(emptyModel, {
  hasActiveBlock: false,
  hasTargetRace: false,
  isMarathonBlock: false,
  raceDistanceKm: null,
  raceDistanceLabelKm: null,
  currentLongRunKm: null,
  countdownDays: null,
  countdownWeeks: null,
  targetRaceDate: null,
  weekIndex: null,
  name: '',
});

console.log('[PASS] Schedule marathon block model coverage passed.');
