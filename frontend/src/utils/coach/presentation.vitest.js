import { describe, expect, it } from 'vitest';
import { formatPlannedDuration, prettifyWorkoutType } from './presentation.js';

describe('coach presentation', () => {
  it('preserves minute rounding and clock formatting across the hour boundary', () => {
    for (const [minutes, expected] of [
      [0.1, '0:00'], [0.5, '1:00'], [30, '30:00'], [59.49, '59:00'],
      [59.5, '1:00:00'], [60, '1:00:00'], [61, '1:01:00'], [119.5, '2:00:00'],
    ]) {
      expect(formatPlannedDuration(minutes)).toBe(expected);
    }
  });

  it('keeps the unavailable marker without coercing non-numeric durations', () => {
    for (const minutes of [undefined, null, NaN, Infinity, -Infinity, 0, -1, '60', '', true, [], {}]) {
      expect(formatPlannedDuration(minutes)).toBe('--');
    }
  });

  it('uses the existing translation keys for every recognized workout type', () => {
    const translate = (key) => `translated:${key}`;
    for (const [workoutType, suffix] of [
      ['QUALITY', 'quality'], [' easy ', 'easy'], ['recovery', 'recovery'],
      [' long_run ', 'long_run'], ['BASE', 'base'], ['REST', 'rest'],
    ]) {
      expect(prettifyWorkoutType(workoutType, translate)).toBe(`translated:profile.dashboard_workout_${suffix}`);
    }
  });

  it('preserves unknown workout labels and the translated empty fallback', () => {
    const translate = (key) => `translated:${key}`;
    expect(prettifyWorkoutType(' custom_session ', translate)).toBe('CUSTOM SESSION');
    expect(prettifyWorkoutType('hill__repeats', translate)).toBe('HILL  REPEATS');
    expect(prettifyWorkoutType(42, translate)).toBe('42');
    for (const workoutType of [undefined, null, '', '   ', false, 0]) {
      expect(prettifyWorkoutType(workoutType, translate)).toBe('translated:profile.dashboard_workout_fallback');
    }
  });
});
