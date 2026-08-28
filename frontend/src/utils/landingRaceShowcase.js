// Landing race showcase: derived entirely from the bundled world race
// catalog (src/data/worldRaceCatalog.json) — real cities, race months, and
// distances. No hand-typed race dates or placeholder goals live here.
import worldRaceCatalog from '../data/worldRaceCatalog.js';

// Flagship world races surfaced on the landing map, by catalog id.
export const LANDING_SHOWCASE_RACE_IDS = [
  'berlin-marathon',
  'sydney-marathon',
  'chicago-marathon',
  'new-york-city-marathon',
  'valencia-marathon',
  'tokyo-marathon',
  'boston-marathon',
  'london-marathon',
  'paris-marathon',
  'comrades-marathon',
];

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

// The catalog records race months (not fixed days), so the showcase counts
// down to the next occurrence of each race's month.
export function getNextRaceOccurrence(month, now = new Date()) {
  const year = now.getUTCFullYear();
  let occurrence = Date.UTC(year, month - 1, 1);
  const currentMonthStart = Date.UTC(year, now.getUTCMonth(), 1);
  if (occurrence < currentMonthStart) occurrence = Date.UTC(year + 1, month - 1, 1);
  return new Date(occurrence);
}

export function formatRaceMonthLabel(occurrence) {
  return `${monthFormatter.format(occurrence).toUpperCase()} ${occurrence.getUTCFullYear()}`;
}

export function formatRaceDistanceLabel(distanceKm) {
  const rounded = Math.round(distanceKm * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}K`;
}

export function buildLandingRaceShowcase(now = new Date(), catalog = worldRaceCatalog) {
  const catalogRaces = Array.isArray(catalog) ? catalog : catalog.races;
  const byId = new Map(catalogRaces.map((race) => [race.id, race]));
  return LANDING_SHOWCASE_RACE_IDS
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((race) => ({
      id: race.id,
      catalogName: race.name,
      city: race.city,
      country: race.country,
      distanceKm: race.distanceKm,
      geo: { lat: race.lat, lng: race.lng },
      nextOccurrence: getNextRaceOccurrence(race.month, now),
    }))
    .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());
}
