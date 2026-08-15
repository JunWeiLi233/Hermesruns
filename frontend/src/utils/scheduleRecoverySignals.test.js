import assert from 'node:assert/strict';

import { buildScheduleRecoverySignals } from './scheduleRecoverySignals.js';

const copy = {
  fatigue_low: 'Low fatigue',
  fatigue_moderate: 'Manageable fatigue',
  fatigue_high: 'High fatigue',
  sleep_high: 'Recovery is strong',
  sleep_moderate: 'Still room to improve',
  sleep_low: 'Recovery is limited',
  signal_no_data: 'No supporting data',
};
const t = (key) => copy[key] || key;

const unsupported = buildScheduleRecoverySignals({
  readinessScore: 82,
  metrics: { acwr: null, recoveryHours: 0, recoveryHasData: false },
  coachState: { lastSleepScore: 72, readinessSleep: 72, sleepDataSupported: false },
  t,
});

assert.deepEqual(unsupported.fatigue, {
  supported: false,
  label: 'No supporting data',
  percent: null,
});
assert.deepEqual(unsupported.sleep, {
  supported: false,
  label: 'No supporting data',
  percent: null,
});

const incompletePayload = buildScheduleRecoverySignals({
  metrics: { recoveryHours: null, recoveryHasData: true },
  coachState: {
    currentReadinessScore: null,
    readinessDataSupported: true,
    readinessSleep: null,
    sleepDataSupported: true,
  },
  t,
});

assert.equal(incompletePayload.fatigue.supported, false);
assert.equal(incompletePayload.sleep.supported, false);

const supported = buildScheduleRecoverySignals({
  readinessScore: 88,
  metrics: { acwr: 1.1, recoveryHours: 10, recoveryHasData: true },
  coachState: {
    currentReadinessScore: 84,
    readinessDataSupported: true,
    readinessSleep: 91,
    sleepDataSupported: true,
  },
  t,
});

assert.equal(supported.fatigue.supported, true);
assert.equal(supported.fatigue.label, 'Low fatigue');
assert.equal(supported.fatigue.percent, 21);
assert.deepEqual(supported.sleep, {
  supported: true,
  label: 'Recovery is strong',
  percent: 91,
});

const poorSleep = buildScheduleRecoverySignals({
  readinessScore: 60,
  metrics: { recoveryHours: 30, recoveryHasData: true },
  coachState: { readinessSleep: 42, sleepDataSupported: true },
  t,
});

assert.equal(poorSleep.sleep.label, 'Recovery is limited');
assert.equal(poorSleep.sleep.percent, 42);
assert.equal(poorSleep.fatigue.label, 'High fatigue');

console.log('[PASS] Schedule recovery signals only display supported evidence.');
