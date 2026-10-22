// A throwaway runner with weeks of running behind it, for the specs of the screens that need a history to say anything: fitness
// and form, the weekly effort range, the training log, goals and the run summary.
//
// Four runs a week the way a plan would have them: two easy runs, one hard one with the heart rate up, and a long one. Every run has
// a heart-rate stream, so every run gets an Effort score from its zones. The seeded runner is left alone.
import fs from 'node:fs';
import path from 'node:path';
import { Api, eventually, newRunner, stackState } from './api.ts';
import { daysAgo, gpxRun, rollingHills } from './gpx.ts';
import { zip, type ZipEntry } from './zip.ts';

export interface HistoryRun {
  id: number;
  name: string;
  daysAgo: number;
  km: number;
  kind: 'easy' | 'hard' | 'long';
}

export interface RunnerWithHistory {
  api: Api;
  email: string;
  token: string;
  runs: HistoryRun[];
}

// A week is four runs, at these distances back from the start of that week of the plan (not from a Monday): 1, 3, 5 and 7 days.
const PLAN = [
  { offset: 1, kind: 'easy', km: 6, pace: 340, hr: 138 },
  { offset: 3, kind: 'hard', km: 8, pace: 285, hr: 170 },
  { offset: 5, kind: 'easy', km: 7, pace: 345, hr: 140 },
  { offset: 7, kind: 'long', km: 14, pace: 350, hr: 148 },
] as const;

/** Waits until every run has an Effort score (the analysis runs off the request thread after an import). */
export async function waitForEffort(api: Api, count: number, timeoutMs = 180_000, from?: string): Promise<void> {
  await eventually(
    async () => {
      const series = await api.get(`/api/training/series${from ? `?from=${encodeURIComponent(from)}` : ''}`);
      return series.ok && series.json.runs >= count ? true : null;
    },
    `an Effort score for each of ${count} runs`,
    timeoutMs,
  );
}

function historyFile(daysBack: number, kind: HistoryRun['kind'], km: number, pace: number, hr: number, name?: string, hourUtc = 11) {
  const title = name ?? `E2E ${kind} ${daysBack} days ago`;
  const gpx = gpxRun({
    name: title,
    start: daysAgo(daysBack, hourUtc),
    distanceM: km * 1000,
    pace,
    hr,
    shape: 'line',
    elevation: kind === 'long' ? rollingHills(30, 3000) : null,
  });
  return { entry: { name: `${title.replace(/\s+/g, '-')}.gpx`, data: gpx },
    run: { name: title, daysAgo: daysBack, km, kind } };
}

/** Imports one run for a runner and returns it; `daysBack` counts from today (0 is today), and the run starts at `hourUtc`. */
export async function importHistoryRun(api: Api, daysBack: number, kind: HistoryRun['kind'], km: number, pace: number, hr: number, name?: string, hourUtc = 11): Promise<HistoryRun> {
  const file = historyFile(daysBack, kind, km, pace, hr, name, hourUtc);
  const id = await api.importRun(file.entry.name, file.entry.data);
  return { id, ...file.run };
}

export interface HistoryOptions {
  /**
   * Also a run today, at midnight UTC (so it has happened, whatever the time), which puts a run in the week, the month and the year
   * going on: the runs of the plan alone can all be from before this week on a Monday, before this month on the 1st.
   */
  todayRun?: boolean;
}

export async function runnerWithHistory(label: string, weeks = 14, options: HistoryOptions = {}): Promise<RunnerWithHistory> {
  const { api, email } = await newRunner(label);
  const runs: HistoryRun[] = [];
  const entries: ZipEntry[] = [];
  const append = (daysBack: number, kind: HistoryRun['kind'], km: number, pace: number, hr: number, name?: string, hourUtc = 11) => {
    const file = historyFile(daysBack, kind, km, pace, hr, name, hourUtc);
    entries.push(file.entry);
    runs.push({ id: 0, ...file.run });
  };
  for (let week = 0; week < weeks; week += 1) {
    for (const item of PLAN) {
      append(week * 7 + item.offset, item.kind, item.km, item.pace, item.hr);
    }
  }
  if (options.todayRun) append(0, 'easy', 5, 360, 140, 'E2E easy today', 0);
  // Use the real archive importer in bounded batches rather than reading the entire growing
  // history twice per file. Large fixtures must not exhaust the production IP read budget.
  for (let offset = 0; offset < entries.length; offset += 20) {
    const batch = entries.slice(offset, offset + 20);
    const imported = await api.importFile(`history-${offset}.zip`, zip(batch));
    if (!imported.ok || imported.json.importedActivities !== batch.length) {
      throw new Error(`history batch import failed: ${imported.status} ${JSON.stringify(imported.json)}`);
    }
  }
  const stored = await api.get('/api/activities');
  if (!stored.ok || !Array.isArray(stored.json) || stored.json.length !== runs.length) {
    throw new Error(`history fixture did not retain all ${runs.length} runs: ${stored.status}`);
  }
  for (const run of runs) {
    const matches = stored.json.filter((item: { name: string }) => item.name === run.name);
    if (matches.length !== 1 || !(matches[0].id > 0)) throw new Error(`history fixture has no unique run named ${run.name}`);
    run.id = matches[0].id;
  }
  await waitForEffort(api, runs.length, 180_000, historyStart(runs));
  return { api, email, token: api.token as string, runs };
}

interface SavedHistory {
  baseUrl: string;
  day: string;
  weeks: number;
  todayRun: boolean;
  email: string;
  token: string;
  runs: HistoryRun[];
}

function historyStart(runs: HistoryRun[]): string {
  return daysAgo(Math.max(0, ...runs.map(run => run.daysAgo))).toISOString().slice(0, 10);
}

/**
 * `runnerWithHistory`, made once per stack and day: the runner is kept in `.auth/` (git-ignored, like the other test accounts), so a
 * retry, the phone project and the next spec file use it rather than importing the same weeks again. A restarted stack has a new
 * database, the saved token fails and a new runner is made. Runs are dated from the day the runner was made, so a runner kept over
 * midnight is made again rather than shown a day late.
 */
export async function sharedHistoryRunner(label: string, weeks: number, options: HistoryOptions = {}): Promise<RunnerWithHistory> {
  const { baseUrl } = stackState();
  const file = path.resolve(import.meta.dirname, '..', '.auth', `history-${label}.json`);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as SavedHistory;
    if (saved.baseUrl === baseUrl && saved.day === today && saved.weeks === weeks && saved.todayRun === Boolean(options.todayRun)) {
      const api = new Api(baseUrl, saved.token);
      const series = await api.get(`/api/training/series?from=${historyStart(saved.runs)}`);
      if (series.ok && series.json.runs >= saved.runs.length) return { api, email: saved.email, token: saved.token, runs: saved.runs };
    }
  } catch {
    /* nothing saved, or unreadable: make one */
  }
  const made = await runnerWithHistory(label, weeks, options);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const saved: SavedHistory = { baseUrl, day: today, weeks, todayRun: Boolean(options.todayRun), email: made.email, token: made.token, runs: made.runs };
  fs.writeFileSync(file, JSON.stringify(saved), { mode: 0o600 });
  return made;
}

/** The run imported `daysBack` days ago; throws when the plan has none there. */
export function runOn(runner: RunnerWithHistory, daysBack: number): HistoryRun {
  const found = runner.runs.find((run) => run.daysAgo === daysBack);
  if (!found) throw new Error(`the history has no run ${daysBack} days ago`);
  return found;
}
