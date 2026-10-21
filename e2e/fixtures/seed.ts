// The runs the suite puts into the seeded runner's account, as GPX files imported through the real import route.
// Each one exists to put a card of the run page into a known state (see replica/test-plan.md for the case numbers).
//
// Distances differ by more than 5 % between unrelated runs on purpose, so the same-route group is exactly the
// three "Park loop" runs and nothing else.
import { Api } from './api.ts';
import { DEFAULT_ORIGIN, daysAgo, gpxRun, intervalPace, rollingHills } from './gpx.ts';

export interface SeedRun {
  key: string;
  /** Name the run has in the app. */
  name: string;
  /** The route length the file was built with, in metres. */
  distanceM: number;
  /** Builds the GPX text; called once. */
  build: () => string;
}

const ORIGIN = DEFAULT_ORIGIN;

export const SEED_RUNS: SeedRun[] = [
  {
    key: 'hills',
    name: 'E2E Hill intervals',
    distanceM: 8000,
    build: () =>
      gpxRun({
        name: 'E2E Hill intervals',
        start: daysAgo(10),
        distanceM: 8000,
        pace: intervalPace(270, 330, 1000),
        hr: (m) => (Math.floor(m / 1000) % 2 === 0 ? 172 : 150),
        elevation: rollingHills(30, 2000),
        stops: [{ atM: 4000, forSec: 60 }],
        cadence: 172,
      }),
  },
  {
    key: 'flat',
    name: 'E2E Flat steady 6k',
    distanceM: 6000,
    build: () => gpxRun({ name: 'E2E Flat steady 6k', start: daysAgo(7), distanceM: 6000, pace: 330, shape: 'line', hr: 142 }),
  },
  {
    key: 'nohr',
    name: 'E2E Easy no heart rate',
    distanceM: 3500,
    build: () =>
      gpxRun({
        name: 'E2E Easy no heart rate',
        start: daysAgo(4),
        distanceM: 3500,
        pace: 360,
        clockwise: false,
        elevation: rollingHills(6, 1750),
      }),
  },
  {
    key: 'loop1',
    name: 'E2E Park loop (oldest)',
    distanceM: 5000,
    build: () => gpxRun({ name: 'E2E Park loop (oldest)', start: daysAgo(60), distanceM: 5000, pace: 320, hr: 150, elevation: rollingHills(8, 2500) }),
  },
  {
    key: 'loop2',
    name: 'E2E Park loop (middle)',
    distanceM: 5000,
    build: () => gpxRun({ name: 'E2E Park loop (middle)', start: daysAgo(30), distanceM: 5000, pace: 305, hr: 152, elevation: rollingHills(8, 2500) }),
  },
  {
    key: 'loop3',
    name: 'E2E Park loop (newest)',
    distanceM: 5000,
    build: () => gpxRun({ name: 'E2E Park loop (newest)', start: daysAgo(3), distanceM: 5000, pace: 295, hr: 154, elevation: rollingHills(8, 2500) }),
  },
  {
    key: 'loopReversed',
    name: 'E2E Park loop reversed',
    distanceM: 5000,
    build: () =>
      gpxRun({ name: 'E2E Park loop reversed', start: daysAgo(14), distanceM: 5000, pace: 310, clockwise: false, hr: 151, elevation: rollingHills(8, 2500) }),
  },
  {
    key: 'long',
    name: 'E2E Long run 21k',
    distanceM: 21100,
    build: () =>
      gpxRun({ name: 'E2E Long run 21k', start: daysAgo(5, 9), distanceM: 21100, pace: 330, hr: (m) => 148 + Math.round(m / 2000), elevation: rollingHills(12, 4000) }),
  },
  {
    key: 'fast10k',
    name: 'E2E Fast 10k negative split',
    distanceM: 10000,
    build: () =>
      gpxRun({
        name: 'E2E Fast 10k negative split',
        start: daysAgo(2),
        distanceM: 10000,
        pace: (m) => (m < 5000 ? 300 : 270),
        hr: (m) => (m < 5000 ? 160 : 172),
        elevation: rollingHills(10, 5000),
      }),
  },
  {
    key: 'notimes',
    name: 'E2E Route without times',
    distanceM: 4000,
    build: () => gpxRun({ name: 'E2E Route without times', start: daysAgo(20), distanceM: 4000, pace: 330, shape: 'line', timestamps: false }),
  },
  {
    key: 'scrap',
    name: 'E2E Tiny scrap',
    distanceM: 60,
    build: () => gpxRun({ name: 'E2E Tiny scrap', start: daysAgo(1), distanceM: 60, pace: 360, shape: 'line', hr: 120 }),
  },
];

export interface SeededRun extends SeedRun {
  id: number;
}

/** Imports every seed run for the signed-in `api` and returns them with their ids. Skips ones already there. */
export async function seedRuns(api: Api): Promise<Record<string, number>> {
  const existing = (await api.get('/api/activities')).json as Array<{ id: number; name: string }>;
  const ids: Record<string, number> = {};
  for (const run of SEED_RUNS) {
    const already = existing.find((row) => row.name === run.name);
    if (already) {
      ids[run.key] = already.id;
      continue;
    }
    ids[run.key] = await api.importRun(`${run.key}.gpx`, run.build());
  }
  return ids;
}

export { ORIGIN };
