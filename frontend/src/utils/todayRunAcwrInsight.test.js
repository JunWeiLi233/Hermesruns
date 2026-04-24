import assert from 'node:assert/strict';
import { describeAcwrState, getTodayRunAcwrInsight } from './todayRunAcwrInsight.js';

{
  const state = describeAcwrState(null);
  assert.strictEqual(state.zone, 'unknown');
  assert.strictEqual(state.deltaPercent, null);
  assert.strictEqual(state.intensityAction, 'unknown');
}

{
  const state = describeAcwrState(0.74);
  assert.strictEqual(state.zone, 'low');
  assert.strictEqual(state.deltaPercent, 26);
  assert.strictEqual(state.intensityAction, 'push');
}

{
  const state = describeAcwrState(1.08);
  assert.strictEqual(state.zone, 'optimal');
  assert.strictEqual(state.deltaPercent, 8);
  assert.strictEqual(state.intensityAction, 'hold');
}

{
  const state = describeAcwrState(1.38);
  assert.strictEqual(state.zone, 'high');
  assert.strictEqual(state.deltaPercent, 38);
  assert.strictEqual(state.intensityAction, 'recover');
}

{
  const state = describeAcwrState(1.61);
  assert.strictEqual(state.zone, 'danger');
  assert.strictEqual(state.deltaPercent, 61);
  assert.strictEqual(state.intensityAction, 'protect');
}

{
  const insight = getTodayRunAcwrInsight(0.74);
  assert.strictEqual(insight.zone, 'low');
  assert.strictEqual(insight.deltaPercent, 26);
  assert.strictEqual(insight.stripLabelKey, 'today_run.coaching_intelligence_acwr_low');
  assert.strictEqual(insight.calloutTitleKey, 'today_run.acwr_state_low_title');
  assert.deepStrictEqual(insight.calloutParams, { delta: 26 });
}

{
  const insight = getTodayRunAcwrInsight(1.08);
  assert.strictEqual(insight.zone, 'optimal');
  assert.strictEqual(insight.stripLabelKey, 'today_run.coaching_intelligence_acwr_optimal');
  assert.strictEqual(insight.calloutTitleKey, 'today_run.acwr_state_optimal_title');
  assert.deepStrictEqual(insight.calloutParams, {});
}

{
  const insight = getTodayRunAcwrInsight(1.61);
  assert.strictEqual(insight.zone, 'danger');
  assert.strictEqual(insight.intensityAction, 'protect');
  assert.strictEqual(insight.stripLabelKey, 'today_run.coaching_intelligence_acwr_danger');
  assert.strictEqual(insight.calloutBodyKey, 'today_run.acwr_state_danger_body');
  assert.deepStrictEqual(insight.calloutParams, { delta: 61 });
}

{
  const insight = getTodayRunAcwrInsight(null);
  assert.strictEqual(insight.zone, 'unknown');
  assert.strictEqual(insight.stripLabelKey, 'today_run.stitch_duration_unknown');
  assert.strictEqual(insight.calloutTitleKey, 'today_run.acwr_state_unknown_title');
  assert.deepStrictEqual(insight.calloutParams, {});
}

console.log('[PASS] describeAcwrState and getTodayRunAcwrInsight ACWR coverage passed.');
