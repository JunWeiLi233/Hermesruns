/**
 * Interpret raw Garmin wellness signals into human-readable "Coach Voice" sentences.
 */
export function interpretWellness(state, t) {
  const interpretations = [];

  // 1. Sleep Interpretation
  if (state?.lastSleepScore != null) {
    const score = state.lastSleepScore;
    if (score < 50) interpretations.push(t('today_run.wellness_sleep_poor'));
    else if (score < 70) interpretations.push(t('today_run.wellness_sleep_suboptimal'));
    else if (score > 85) interpretations.push(t('today_run.wellness_sleep_excellent'));
  }

  // 2. HRV Interpretation
  if (state?.lastHrvStatus) {
    const status = state.lastHrvStatus.toUpperCase();
    if (status === 'LOW' || status === 'POOR' || status === 'UNBALANCED') {
      interpretations.push(t('today_run.wellness_hrv_strained'));
    } else if (status === 'BALANCED') {
      interpretations.push(t('today_run.wellness_hrv_balanced'));
    }
  }

  // 3. Stress Interpretation
  if (state?.lastStressScore != null) {
    const stress = state.lastStressScore;
    if (stress > 75) interpretations.push(t('today_run.wellness_stress_high'));
    else if (stress < 25) interpretations.push(t('today_run.wellness_stress_low'));
  }

  // 4. Resting HR Interpretation
  if (state?.lastNightRestingHr != null && state?.baselineRestingHr != null) {
    const delta = state.lastNightRestingHr - state.baselineRestingHr;
    if (delta > 5) interpretations.push(t('today_run.wellness_rhr_elevated'));
    else if (delta < -2) interpretations.push(t('today_run.wellness_rhr_optimal'));
  }

  return interpretations;
}
