export const ACWR_SAFE_MIN = 0.8;
export const ACWR_SAFE_MAX = 1.3;
export const ACWR_DANGER_MIN = 1.5;

export function describeAcwrState(acwr) {
  const numeric = Number(acwr);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return {
      zone: 'unknown',
      deltaPercent: null,
      intensityAction: 'unknown',
    };
  }

  const deltaPercent = Math.round(Math.abs(numeric - 1) * 100);

  if (numeric < ACWR_SAFE_MIN) {
    return {
      zone: 'low',
      deltaPercent,
      intensityAction: 'push',
    };
  }

  if (numeric <= ACWR_SAFE_MAX) {
    return {
      zone: 'optimal',
      deltaPercent,
      intensityAction: 'hold',
    };
  }

  if (numeric <= ACWR_DANGER_MIN) {
    return {
      zone: 'high',
      deltaPercent,
      intensityAction: 'recover',
    };
  }

  return {
    zone: 'danger',
    deltaPercent,
    intensityAction: 'protect',
  };
}

export function getTodayRunAcwrInsight(acwr) {
  const state = describeAcwrState(acwr);

  switch (state.zone) {
    case 'low':
      return {
        ...state,
        stripLabelKey: 'today_run.coaching_intelligence_acwr_low',
        calloutTitleKey: 'today_run.acwr_state_low_title',
        calloutBodyKey: 'today_run.acwr_state_low_body',
        calloutParams: { delta: state.deltaPercent ?? 0 },
      };
    case 'optimal':
      return {
        ...state,
        stripLabelKey: 'today_run.coaching_intelligence_acwr_optimal',
        calloutTitleKey: 'today_run.acwr_state_optimal_title',
        calloutBodyKey: 'today_run.acwr_state_optimal_body',
        calloutParams: {},
      };
    case 'high':
      return {
        ...state,
        stripLabelKey: 'today_run.coaching_intelligence_acwr_high',
        calloutTitleKey: 'today_run.acwr_state_high_title',
        calloutBodyKey: 'today_run.acwr_state_high_body',
        calloutParams: { delta: state.deltaPercent ?? 0 },
      };
    case 'danger':
      return {
        ...state,
        stripLabelKey: 'today_run.coaching_intelligence_acwr_danger',
        calloutTitleKey: 'today_run.acwr_state_danger_title',
        calloutBodyKey: 'today_run.acwr_state_danger_body',
        calloutParams: { delta: state.deltaPercent ?? 0 },
      };
    default:
      return {
        ...state,
        stripLabelKey: 'today_run.stitch_duration_unknown',
        calloutTitleKey: 'today_run.acwr_state_unknown_title',
        calloutBodyKey: 'today_run.acwr_state_unknown_body',
        calloutParams: {},
      };
  }
}
