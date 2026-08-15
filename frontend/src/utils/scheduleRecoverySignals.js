function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function fatigueLabel(percent, t) {
  if (percent <= 30) return t('fatigue_low');
  if (percent <= 60) return t('fatigue_moderate');
  return t('fatigue_high');
}

export function buildScheduleRecoverySignals({ metrics = {}, coachState, t }) {
  const unsupported = {
    supported: false,
    label: t('signal_no_data'),
    percent: null,
  };

  const fatigueEstimates = [];
  if (
    coachState?.readinessDataSupported === true
    && coachState.currentReadinessScore != null
    && Number.isFinite(Number(coachState.currentReadinessScore))
  ) {
    fatigueEstimates.push(100 - clampPercent(coachState.currentReadinessScore));
  }
  if (
    metrics.recoveryHasData === true
    && metrics.recoveryHours != null
    && Number.isFinite(Number(metrics.recoveryHours))
  ) {
    fatigueEstimates.push(clampPercent((Number(metrics.recoveryHours) / 48) * 100));
  }

  const fatiguePercent = fatigueEstimates.length > 0 ? Math.max(...fatigueEstimates) : null;
  const sleepScore = Number(coachState?.readinessSleep);
  const sleepSupported = coachState?.sleepDataSupported === true
    && coachState.readinessSleep != null
    && Number.isFinite(sleepScore);

  let sleep = unsupported;
  if (sleepSupported) {
    const percent = clampPercent(sleepScore);
    sleep = {
      supported: true,
      label: percent >= 80
        ? t('sleep_high')
        : percent >= 60
          ? t('sleep_moderate')
          : t('sleep_low'),
      percent,
    };
  }

  return {
    fatigue: fatiguePercent == null
      ? unsupported
      : {
          supported: true,
          label: fatigueLabel(fatiguePercent, t),
          percent: fatiguePercent,
        },
    sleep,
  };
}
