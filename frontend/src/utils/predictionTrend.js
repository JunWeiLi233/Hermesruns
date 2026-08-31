const MINIMUM_TREND_VDOT_DELTA = 0.05;

export function hasMeaningfulWeatherTrendAdjustment({
  rawVdot,
  adjustedVdot,
  rawMinutes,
  adjustedMinutes,
}) {
  return Number.isFinite(rawVdot)
    && Number.isFinite(adjustedVdot)
    && Number.isFinite(rawMinutes)
    && Number.isFinite(adjustedMinutes)
    && adjustedVdot - rawVdot > MINIMUM_TREND_VDOT_DELTA
    && adjustedMinutes < rawMinutes;
}
