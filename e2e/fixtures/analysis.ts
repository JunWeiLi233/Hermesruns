// Helpers for the specs of the screens built from the Runalyze review: time in zones (37), the pace curve (38), the VO2max
// estimates (39), rest days to zero form (46) and the long-run check (51).
import fs from 'node:fs';
import path from 'node:path';
import { Api, eventually, newRunner, stackState } from './api.ts';
import { daysAgo, gpxRun } from './gpx.ts';
import { waitForEffort } from './history.ts';

export interface RunSpec {
  name: string;
  /** Days before today (0 is today); the run starts at `hourUtc`. */
  daysBack: number;
  km: number;
  /** Seconds per kilometre, held all the way. */
  pace: number;
  /** Heart rate in bpm, held all the way (so it is the run's average and its peak); null for a run with none. */
  hr: number | null;
  hourUtc?: number;
}

/** Imports one run as a straight line, so its distance is the one asked for; returns its id. */
export async function importRunSpec(api: Api, run: RunSpec): Promise<number> {
  const gpx = gpxRun({
    name: run.name,
    start: daysAgo(run.daysBack, run.hourUtc ?? 11),
    distanceM: run.km * 1000,
    pace: run.pace,
    hr: run.hr,
    shape: 'line',
  });
  return api.importRun(`${run.name.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40) || 'run'}.gpx`, gpx);
}

/**
 * Imports runs one after another (the route takes one file at a time) and waits until each has an Effort score. The wait reads the
 * training series, which looks back six months by default, so a set of runs older than that is imported with `wait: false` and
 * waited for some other way (the best efforts, say).
 */
export async function importRunSpecs(api: Api, runs: RunSpec[], options: { wait?: boolean } = {}): Promise<number[]> {
  const ids: number[] = [];
  for (const run of runs) ids.push(await importRunSpec(api, run));
  if (options.wait !== false) await waitForEffort(api, runs.length);
  return ids;
}

/** Waits until the best efforts of the runner's runs are worked out and there are at least `points` of them in the window. */
export async function waitForBestEfforts(api: Api, points = 1, timeoutMs = 120_000): Promise<any> {
  return eventually(
    async () => {
      const curve = await api.get('/api/training/pace-curve?days=all');
      return curve.ok && curve.json.complete && curve.json.points.length >= points ? curve.json : null;
    },
    `the best efforts of the runner's runs (${points} or more)`,
    timeoutMs,
  );
}

interface Saved<T> {
  baseUrl: string;
  day: string;
  email: string;
  token: string;
  meta: T;
}

export interface SharedRunner<T> {
  api: Api;
  email: string;
  token: string;
  meta: T;
}

/**
 * A runner made once per stack and day, whose runs `build` imports: kept in `.auth/` (git-ignored, like the other test accounts) so
 * a retry, the phone project and the next spec file use it rather than importing the same runs again. A restarted stack has a new
 * database, the saved token fails and a new runner is made. Runs are dated from the day the runner was made, so one kept over
 * midnight is made again rather than shown a day late.
 */
export async function sharedRunner<T>(label: string, build: (made: { api: Api; email: string }) => Promise<T>): Promise<SharedRunner<T>> {
  const { baseUrl } = stackState();
  const file = path.resolve(import.meta.dirname, '..', '.auth', `analysis-${label}.json`);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Saved<T>;
    if (saved.baseUrl === baseUrl && saved.day === today) {
      const api = new Api(baseUrl, saved.token);
      if ((await api.get('/api/activities')).ok) return { api, email: saved.email, token: saved.token, meta: saved.meta };
    }
  } catch {
    /* nothing saved, or unreadable: make one */
  }
  const made = await newRunner(label);
  const meta = await build({ api: made.api, email: made.email });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const saved: Saved<T> = { baseUrl, day: today, email: made.email, token: made.api.token as string, meta };
  fs.writeFileSync(file, JSON.stringify(saved), { mode: 0o600 });
  return { api: made.api, email: made.email, token: made.api.token as string, meta };
}

/** A time in zones as the cards write it: "12:05" or "1:02:03", and a dash for none. */
export function zoneTime(seconds: number): string {
  if (!(seconds > 0)) return '–';
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** "1:02:03" or "12:05" back to seconds. */
export function secondsOf(text: string): number {
  return text
    .trim()
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

/** Ordinary least squares of distance on time, the model the pace curve fits: distance = intercept + slope x time. */
export function leastSquares(points: Array<{ seconds: number; meters: number }>): { slope: number; intercept: number } {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.seconds, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.meters, 0) / n;
  const sxx = points.reduce((sum, p) => sum + (p.seconds - meanX) ** 2, 0);
  const sxy = points.reduce((sum, p) => sum + (p.seconds - meanX) * (p.meters - meanY), 0);
  const slope = sxy / sxx;
  return { slope, intercept: meanY - slope * meanX };
}

export const KM_PER_MILE = 1.609344;
