import { describe, expect, it } from 'vitest';
import {
  ZONE_COUNT,
  boundaryProblem,
  boundaryValues,
  invalidBoundaryIndexes,
  parseMaxHeartRate,
  zoneDurationLabel,
  zonesFromBoundaries,
} from './heartRateZones';

const limits = { minMaxHeartRate: 120, maxMaxHeartRate: 230, minBoundary: 40, maxBoundary: 230 };

describe('zonesFromBoundaries', () => {
  it('makes five zones where a boundary is the first bpm of the next zone', () => {
    expect(zonesFromBoundaries([114, 133, 152, 171])).toEqual([
      { zone: 1, fromBpm: null, toBpm: 113 },
      { zone: 2, fromBpm: 114, toBpm: 132 },
      { zone: 3, fromBpm: 133, toBpm: 151 },
      { zone: 4, fromBpm: 152, toBpm: 170 },
      { zone: 5, fromBpm: 171, toBpm: null },
    ]);
    expect(ZONE_COUNT).toBe(5);
  });
});

describe('boundaryProblem', () => {
  it('accepts four whole numbers inside the limits that rise', () => {
    expect(boundaryProblem(['114', '133', '152', '171'], limits)).toBeNull();
    expect(boundaryProblem([' 114 ', '133', '152', '230'], limits)).toBeNull();
    expect(boundaryProblem(['40', '41', '42', '43'], limits)).toBeNull();
  });

  it('reports a box that is empty or not a whole number as incomplete', () => {
    expect(boundaryProblem(['114', '', '152', '171'], limits)).toBe('incomplete');
    expect(boundaryProblem(['114', '133.5', '152', '171'], limits)).toBe('incomplete');
    expect(boundaryProblem(['114', '-133', '152', '171'], limits)).toBe('incomplete');
    expect(boundaryProblem(['114', '1e2', '152', '171'], limits)).toBe('incomplete');
    expect(boundaryProblem(['114', '133', '152'], limits)).toBe('incomplete');
  });

  it('reports a value outside the allowed heart rates as out of range, before checking the order', () => {
    expect(boundaryProblem(['39', '133', '152', '171'], limits)).toBe('range');
    expect(boundaryProblem(['114', '133', '152', '231'], limits)).toBe('range');
    expect(boundaryProblem(['300', '133', '152', '171'], limits)).toBe('range');
  });

  it('reports a zone that does not start higher than the one before it', () => {
    expect(boundaryProblem(['133', '133', '152', '171'], limits)).toBe('order');
    expect(boundaryProblem(['114', '152', '133', '171'], limits)).toBe('order');
  });
});

describe('invalidBoundaryIndexes', () => {
  it('flags nothing when the boundaries are fine', () => {
    expect([...invalidBoundaryIndexes(['114', '133', '152', '171'], limits)]).toEqual([]);
  });

  it('flags the boxes that are empty or not whole numbers', () => {
    expect([...invalidBoundaryIndexes(['114', '', '152', 'x'], limits)]).toEqual([1, 3]);
    expect([...invalidBoundaryIndexes(['114', '133', '152'], limits)]).toEqual([0, 1, 2]);
  });

  it('flags the boxes outside the limits', () => {
    expect([...invalidBoundaryIndexes(['39', '133', '152', '231'], limits)]).toEqual([0, 3]);
  });

  it('flags both boxes of a pair that is out of order', () => {
    expect([...invalidBoundaryIndexes(['114', '110', '152', '171'], limits)]).toEqual([0, 1]);
    expect([...invalidBoundaryIndexes(['114', '133', '133', '130'], limits)]).toEqual([1, 2, 3]);
  });
});

describe('boundaryValues', () => {
  it('reads the boxes as numbers, and a bad box as null', () => {
    expect(boundaryValues(['114', ' 133 ', '152', '171'])).toEqual([114, 133, 152, 171]);
    expect(boundaryValues(['114', 'abc', '', '171'])).toEqual([114, null, null, 171]);
  });
});

describe('parseMaxHeartRate', () => {
  it('returns the number only when it is a whole number inside the limits', () => {
    expect(parseMaxHeartRate('190', limits)).toBe(190);
    expect(parseMaxHeartRate(' 120 ', limits)).toBe(120);
    expect(parseMaxHeartRate('230', limits)).toBe(230);
    expect(parseMaxHeartRate('119', limits)).toBeNull();
    expect(parseMaxHeartRate('231', limits)).toBeNull();
    expect(parseMaxHeartRate('190.5', limits)).toBeNull();
    expect(parseMaxHeartRate('', limits)).toBeNull();
    expect(parseMaxHeartRate('abc', limits)).toBeNull();
  });
});

describe('zoneDurationLabel', () => {
  it('shows minutes and seconds, hours when there are any, and a dash for no time', () => {
    expect(zoneDurationLabel(0)).toBe('–');
    expect(zoneDurationLabel(65)).toBe('1:05');
    expect(zoneDurationLabel(3723)).toBe('1:02:03');
  });
});
