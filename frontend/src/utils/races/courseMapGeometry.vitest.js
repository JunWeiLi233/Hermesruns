import { describe, expect, it } from 'vitest';
import { normalizeOverlayBounds } from './courseMapGeometry.js';

describe('normalizeOverlayBounds', () => {
  it('normalizes numeric strings without mutating bounds or retaining extra fields', () => {
    const bounds = Object.freeze({ north: '41', south: '40', east: '-73', west: '-74', label: 'course' });
    expect(normalizeOverlayBounds(bounds)).toEqual({ north: 41, south: 40, east: -73, west: -74 });
    expect(bounds.north).toBe('41');
  });

  it('preserves Number coercion for finite values and does not add geographic limits', () => {
    expect(normalizeOverlayBounds({ north: true, south: null, east: '2', west: '' }))
      .toEqual({ north: 1, south: 0, east: 2, west: 0 });
    expect(normalizeOverlayBounds({ north: 100, south: -100, east: 200, west: -200 }))
      .toEqual({ north: 100, south: -100, east: 200, west: -200 });
  });

  it('rejects missing or non-finite coordinates and non-object inputs', () => {
    for (const bounds of [undefined, null, false, 3, 'bounds', {}, [],
      { north: NaN, south: 0, east: 2, west: 0 },
      { north: 1, south: -Infinity, east: 2, west: 0 },
      { north: 1, south: 0, east: 'invalid', west: 0 },
      { north: 1, south: 0, east: 2, west: Infinity },
    ]) {
      expect(normalizeOverlayBounds(bounds)).toBeNull();
    }
  });

  it('rejects collapsed or reversed bounds without sorting coordinates', () => {
    for (const bounds of [
      { north: 1, south: 1, east: 2, west: 0 },
      { north: 0, south: 1, east: 2, west: 0 },
      { north: 1, south: 0, east: 2, west: 2 },
      { north: 1, south: 0, east: -170, west: 170 },
    ]) {
      expect(normalizeOverlayBounds(bounds)).toBeNull();
    }
  });
});
