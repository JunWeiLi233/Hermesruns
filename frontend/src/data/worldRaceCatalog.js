// Static race data lives in worldRaceCatalog.json (Vite resolves JSON imports natively).
// All named exports and the default export are preserved for backward-compatibility.
import raceData from './worldRaceCatalog.json';

const worldRaceCatalog = raceData;

const CITY_PAGE_WEBSITE_OVERRIDES = {
  'Big Sur': 'https://en.wikipedia.org/wiki/Big_Sur',
  'Gold Coast': 'https://en.wikipedia.org/wiki/Gold_Coast,_Queensland',
  'Ho Chi Minh City': 'https://en.wikipedia.org/wiki/Ho_Chi_Minh_City',
  'Hong Kong': 'https://en.wikipedia.org/wiki/Hong_Kong',
  'Mexico City': 'https://en.wikipedia.org/wiki/Mexico_City',
  'New Delhi': 'https://en.wikipedia.org/wiki/New_Delhi',
  'New York City': 'https://en.wikipedia.org/wiki/New_York_City',
  'Nice-Cannes': 'https://en.wikipedia.org/wiki/French_Riviera',
  Queenstown: 'https://en.wikipedia.org/wiki/Queenstown,_New_Zealand',
  'Rio de Janeiro': 'https://en.wikipedia.org/wiki/Rio_de_Janeiro',
  'Washington, D.C.': 'https://en.wikipedia.org/wiki/Washington,_D.C.',
  "Xi'an": 'https://en.wikipedia.org/wiki/Xi%27an',
};

export function getCityPageWebsite(city) {
  if (!city) return '';
  if (CITY_PAGE_WEBSITE_OVERRIDES[city]) return CITY_PAGE_WEBSITE_OVERRIDES[city];
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(city.replace(/\s+/g, '_'))}`;
}

export function getRaceImageSourceCandidates(race) {
  if (!race) return [];
  const candidates = [race.officialWebsite, getCityPageWebsite(race.city)];
  return [...new Set(candidates.filter(Boolean))];
}

const FULL_MARATHON_DISTANCE_KM = 42.195;
const NON_STANDARD_CITY_ROAD_MARATHON_IDS = new Set([
  'big-sur-marathon',
  'queenstown-marathon',
]);

export function isStandardCityRoadMarathon(race) {
  const distanceKm = Number(race?.distanceKm);
  return Math.abs(distanceKm - FULL_MARATHON_DISTANCE_KM) < 0.5
    && !NON_STANDARD_CITY_ROAD_MARATHON_IDS.has(race?.id);
}

export const standardCityRoadMarathonCatalog = worldRaceCatalog.filter(isStandardCityRoadMarathon);

const WORLD_RACE_COUNTRY_LAYOUT = [
  { key: 'United States', x: 17, y: 36, region: 'North America' },
  { key: 'Canada', x: 16, y: 20, region: 'North America' },
  { key: 'Mexico', x: 15, y: 50, region: 'North America' },
  { key: 'Brazil', x: 28, y: 69, region: 'South America' },
  { key: 'Argentina', x: 29, y: 83, region: 'South America' },
  { key: 'Chile', x: 24, y: 79, region: 'South America' },
  { key: 'United Kingdom', x: 46, y: 26, region: 'Europe' },
  { key: 'Ireland', x: 44, y: 25, region: 'Europe' },
  { key: 'France', x: 48, y: 33, region: 'Europe' },
  { key: 'Germany', x: 51, y: 28, region: 'Europe' },
  { key: 'Netherlands', x: 49, y: 29, region: 'Europe' },
  { key: 'Belgium', x: 49, y: 30, region: 'Europe' },
  { key: 'Spain', x: 46, y: 39, region: 'Europe' },
  { key: 'Portugal', x: 44, y: 40, region: 'Europe' },
  { key: 'Italy', x: 52, y: 38, region: 'Europe' },
  { key: 'Switzerland', x: 50, y: 32, region: 'Europe' },
  { key: 'Sweden', x: 54, y: 17, region: 'Europe' },
  { key: 'Denmark', x: 51, y: 21, region: 'Europe' },
  { key: 'Norway', x: 49, y: 14, region: 'Europe' },
  { key: 'Finland', x: 58, y: 15, region: 'Europe' },
  { key: 'Austria', x: 54, y: 31, region: 'Europe' },
  { key: 'Czech Republic', x: 53, y: 29, region: 'Europe' },
  { key: 'Poland', x: 55, y: 26, region: 'Europe' },
  { key: 'Greece', x: 56, y: 40, region: 'Europe' },
  { key: 'Turkey', x: 59, y: 37, region: 'Europe / Asia' },
  { key: 'Morocco', x: 45, y: 46, region: 'Africa' },
  { key: 'South Africa', x: 53, y: 83, region: 'Africa' },
  { key: 'Kenya', x: 58, y: 63, region: 'Africa' },
  { key: 'Israel', x: 60, y: 41, region: 'Middle East' },
  { key: 'United Arab Emirates', x: 67, y: 43, region: 'Middle East' },
  { key: 'Qatar', x: 65, y: 44, region: 'Middle East' },
  { key: 'India', x: 72, y: 47, region: 'Asia' },
  { key: 'China', x: 81, y: 38, region: 'Asia' },
  { key: 'Japan', x: 89, y: 31, region: 'Asia' },
  { key: 'South Korea', x: 84, y: 29, region: 'Asia' },
  { key: 'Singapore', x: 78, y: 57, region: 'Asia' },
  { key: 'Malaysia', x: 77, y: 55, region: 'Asia' },
  { key: 'Thailand', x: 76, y: 50, region: 'Asia' },
  { key: 'Vietnam', x: 79, y: 52, region: 'Asia' },
  { key: 'Indonesia', x: 80, y: 61, region: 'Asia' },
  { key: 'Australia', x: 86, y: 78, region: 'Oceania' },
  { key: 'New Zealand', x: 96, y: 87, region: 'Oceania' },
];

export const worldRaceCountries = WORLD_RACE_COUNTRY_LAYOUT.filter((country) => (
  standardCityRoadMarathonCatalog.some((race) => race.country === country.key)
));

export default worldRaceCatalog;
