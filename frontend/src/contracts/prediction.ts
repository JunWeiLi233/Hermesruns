export type PredictionDistanceKey = '5k' | '10k' | 'half' | 'marathon';

export interface PredictionWeatherAdjustment {
  available: boolean;
  temperatureC: number | null;
  dewPointC: number | null;
  adjustmentSeconds: number | null;
  originalSeconds: number | null;
  adjustedSeconds: number | null;
}

export interface RacePredictionSelectionInput {
  representativeVdot: number;
  adjustedVdot: number;
  rawPredictionMinutes: number | null;
  adjustedPredictionMinutes: number | null;
  hasWeatherEvidence: boolean;
}

export interface RacePredictionSelection {
  useWeatherAdjusted: boolean;
  forecastVdot: number;
  predictionMinutes: number | null;
  weather: PredictionWeatherAdjustment;
}
