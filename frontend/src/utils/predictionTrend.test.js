import assert from 'node:assert/strict';

import { hasMeaningfulWeatherTrendAdjustment } from './predictionTrend.js';

assert.equal(
  hasMeaningfulWeatherTrendAdjustment({
    rawVdot: 48,
    adjustedVdot: 48.1,
    rawMinutes: 60,
    adjustedMinutes: 59.99,
  }),
  true,
  'A meaningful VDOT correction should keep the 10K weather-adjusted series even when the time delta is under one second.',
);

assert.equal(
  hasMeaningfulWeatherTrendAdjustment({
    rawVdot: 48,
    adjustedVdot: 48.04,
    rawMinutes: 60,
    adjustedMinutes: 59.99,
  }),
  false,
  'Sub-threshold VDOT noise should not create a duplicate trend series.',
);

assert.equal(
  hasMeaningfulWeatherTrendAdjustment({
    rawVdot: 48,
    adjustedVdot: 48.1,
    rawMinutes: 60,
    adjustedMinutes: 60,
  }),
  false,
  'An adjusted value that does not improve the predicted time should stay hidden.',
);

console.log('[PASS] Prediction trend adjustment guardrails passed.');
