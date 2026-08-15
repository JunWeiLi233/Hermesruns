import { describe, expect, it } from 'vitest';

import { selectRacePrediction } from './predictionSelection';

describe('selectRacePrediction', () => {
  it('uses a meaningful weather-adjusted prediction when evidence supports it', () => {
    const selection = selectRacePrediction({
      representativeVdot: 48,
      adjustedVdot: 49,
      rawPredictionMinutes: 210,
      adjustedPredictionMinutes: 205,
      hasWeatherEvidence: true,
    });

    expect(selection.useWeatherAdjusted).toBe(true);
    expect(selection.forecastVdot).toBe(49);
    expect(selection.predictionMinutes).toBe(205);
    expect(selection.weather.adjustmentSeconds).toBe(300);
  });

  it('ignores sub-second model noise', () => {
    const selection = selectRacePrediction({
      representativeVdot: 48,
      adjustedVdot: 49,
      rawPredictionMinutes: 210,
      adjustedPredictionMinutes: 209.99,
      hasWeatherEvidence: true,
    });

    expect(selection.useWeatherAdjusted).toBe(false);
    expect(selection.predictionMinutes).toBe(210);
    expect(selection.weather.adjustmentSeconds).toBeNull();
  });

  it('returns an unavailable state without valid predictions', () => {
    const selection = selectRacePrediction({
      representativeVdot: 0,
      adjustedVdot: 0,
      rawPredictionMinutes: null,
      adjustedPredictionMinutes: null,
      hasWeatherEvidence: false,
    });

    expect(selection.predictionMinutes).toBeNull();
    expect(selection.weather.available).toBe(false);
  });
});
