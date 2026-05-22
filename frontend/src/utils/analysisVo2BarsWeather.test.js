import assert from 'node:assert/strict';
import { buildVo2Bars } from './analysisInsights.js';

const now = new Date();

function monthDate(monthOffset, day) {
  return new Date(now.getFullYear(), now.getMonth() + monthOffset, day, 12, 0, 0);
}

const entries = [
  {
    date: monthDate(0, 12),
    vdot: 50.1,
    adjustedVo2max: 52.4,
  },
  {
    date: monthDate(0, 18),
    vdot: 49.2,
    adjustedVo2max: 49.2,
  },
  {
    date: monthDate(-1, 8),
    vdot: 47.3,
    adjustedVo2max: 47.3,
  },
];

const bars = buildVo2Bars(entries, 'en');
const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
const previousDate = monthDate(-1, 8);
const previousKey = `${previousDate.getFullYear()}-${previousDate.getMonth()}`;

const currentBar = bars.find((bar) => bar.key === currentKey);
const previousBar = bars.find((bar) => bar.key === previousKey);

assert.ok(currentBar, 'current month bar should exist');
assert.equal(currentBar.value, 50.1, 'current month should keep the best raw VDOT');
assert.equal(currentBar.adjustedValue, 52.4, 'current month should expose the best adjusted VDOT');
assert.equal(currentBar.hasAdjustment, true, 'current month should flag meaningful weather adjustment');
assert.ok(currentBar.adjustedHeight >= currentBar.height, 'adjusted bar height should be at least the raw height when adjustment exists');

assert.ok(previousBar, 'previous month bar should exist');
assert.equal(previousBar.value, 47.3, 'previous month should keep raw VDOT');
assert.equal(previousBar.adjustedValue, 47.3, 'previous month should expose unchanged adjusted VDOT');
assert.equal(previousBar.hasAdjustment, false, 'previous month should not flag an adjustment when raw and adjusted match');

console.log('[PASS] analysis VO2 bars weather adjustment enrichment works.');
