import { describe, expect, it } from 'vitest';
import {
  LANDING_SHOWCASE_RACE_IDS,
  buildLandingRaceShowcase,
  formatRaceDistanceLabel,
  formatRaceMonthLabel,
  getNextRaceOccurrence,
} from './landingRaceShowcase.js';
import worldRaceCatalog from '../data/worldRaceCatalog.json';

const catalogRaces = Array.isArray(worldRaceCatalog) ? worldRaceCatalog : worldRaceCatalog.races;

describe('landing race showcase (catalog-driven)', () => {
  it('references only races that exist in the world race catalog', () => {
    const catalogIds = new Set(catalogRaces.map((race) => race.id));
    for (const id of LANDING_SHOWCASE_RACE_IDS) {
      expect(catalogIds.has(id), `catalog should contain ${id}`).toBe(true);
    }
  });

  it('derives every showcase fact from catalog rows, never hand-typed values', () => {
    const byId = new Map(catalogRaces.map((race) => [race.id, race]));
    const showcase = buildLandingRaceShowcase(new Date('2026-08-27T00:00:00Z'));
    expect(showcase).toHaveLength(LANDING_SHOWCASE_RACE_IDS.length);
    for (const entry of showcase) {
      const source = byId.get(entry.id);
      expect(entry.catalogName).toBe(source.name);
      expect(entry.city).toBe(source.city);
      expect(entry.distanceKm).toBe(source.distanceKm);
      expect(entry.geo).toEqual({ lat: source.lat, lng: source.lng });
    }
  });

  it('sorts the showcase by the next upcoming race month', () => {
    const showcase = buildLandingRaceShowcase(new Date('2026-08-27T00:00:00Z'));
    const times = showcase.map((entry) => entry.nextOccurrence.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(showcase[0].id).toBe('berlin-marathon');
    expect(showcase[showcase.length - 1].id).toBe('comrades-marathon');
  });

  it('rolls a passed month forward to next year instead of counting backwards', () => {
    expect(getNextRaceOccurrence(3, new Date('2026-08-27T00:00:00Z')).toISOString())
      .toBe('2027-03-01T00:00:00.000Z');
    expect(getNextRaceOccurrence(9, new Date('2026-08-27T00:00:00Z')).toISOString())
      .toBe('2026-09-01T00:00:00.000Z');
  });

  it('formats month labels and real catalog distances', () => {
    expect(formatRaceMonthLabel(new Date('2026-10-01T00:00:00Z'))).toBe('OCT 2026');
    expect(formatRaceDistanceLabel(42.195)).toBe('42.2K');
    expect(formatRaceDistanceLabel(89)).toBe('89K');
  });
});
