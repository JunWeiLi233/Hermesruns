import type {
  RacePredictionSelection,
  RacePredictionSelectionInput,
} from '../contracts/prediction';

const MINIMUM_MEANINGFUL_ADJUSTMENT_MINUTES = 1 / 60;

function isPositiveFinite(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function toSeconds(value: number | null): number | null {
  return isPositiveFinite(value) ? Math.round(value * 60) : null;
}

export function selectRacePrediction(input: RacePredictionSelectionInput): RacePredictionSelection {
  const rawPredictionMinutes = isPositiveFinite(input.rawPredictionMinutes)
    ? input.rawPredictionMinutes
    : null;
  const adjustedPredictionMinutes = isPositiveFinite(input.adjustedPredictionMinutes)
    ? input.adjustedPredictionMinutes
    : null;
  const rawAvailable = rawPredictionMinutes != null;
  const adjustedAvailable = adjustedPredictionMinutes != null;
  const useWeatherAdjusted = Boolean(
    input.hasWeatherEvidence
      && input.adjustedVdot - input.representativeVdot > 0.05
      && adjustedAvailable
      && rawAvailable
      && adjustedPredictionMinutes < rawPredictionMinutes - MINIMUM_MEANINGFUL_ADJUSTMENT_MINUTES,
  );

  const rawSeconds = toSeconds(rawPredictionMinutes);
  const adjustedSeconds = toSeconds(adjustedPredictionMinutes);

  return {
    useWeatherAdjusted,
    forecastVdot: useWeatherAdjusted ? input.adjustedVdot : input.representativeVdot,
    predictionMinutes: useWeatherAdjusted
      ? adjustedPredictionMinutes
      : rawPredictionMinutes,
    weather: {
      available: input.hasWeatherEvidence && rawAvailable && adjustedAvailable,
      temperatureC: null,
      dewPointC: null,
      adjustmentSeconds: useWeatherAdjusted && rawSeconds != null && adjustedSeconds != null
        ? rawSeconds - adjustedSeconds
        : null,
      originalSeconds: rawSeconds,
      adjustedSeconds,
    },
  };
}
