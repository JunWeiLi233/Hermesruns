// The load of the days of a runner and the strain of a week, worked out from the runs the API lists and the rule of the methods document
// (docs/README-ANALYSIS.md, "Training Load and the Load Ratio", "Monotony and training strain" and "Effort Score"), for the specs of the
// Load balance page: written out again here, so a card that printed a wrong week fails.
import { expect } from '@playwright/test';
import { addDays } from './format.ts';

/** What the loads are made from: a run as the analysis list gives it. */
export interface LoadRow {
  distanceKm: number;
  movingTimeSeconds: number;
  startTime: string;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
}

/** Today as the browser of the suite (America/New_York) counts it: the last day of the series the cards are made from. */
export const browserToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

/**
 * The runner's daily loads, oldest first, from the first day with a run to `today`: the Effort Score of each run (from its average heart rate
 * against the highest on any run: `(100 × share − 20) / 80`, kept between 0.4 and 1.2; `hours × (fraction / 0.85)² × 100`), added up for the day.
 */
export function dailyLoads(rows: LoadRow[], today: string): number[] {
  const hrMax = Math.max(0, ...rows.map((row) => row.maxHeartRate ?? 0));
  const daily = new Map<string, number>();
  for (const row of rows) {
    if (row.movingTimeSeconds <= 0 || row.distanceKm <= 0) continue;
    const average = row.averageHeartRate ?? 0;
    const raw = average > 0 && hrMax > 100 ? Math.max(0, (Math.min(1, average / hrMax) * 100 - 20) / 80) : 0;
    const fraction = Math.max(0.4, Math.min(1.2, raw || 0.65));
    const load = (row.movingTimeSeconds / 3600) * (fraction / 0.85) ** 2 * 100;
    const day = row.startTime.slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + load);
  }
  const first = [...daily.keys()].sort()[0];
  const loads: number[] = [];
  for (let day = first; day <= today; day = addDays(day, 1)) loads.push(daily.get(day) ?? 0);
  return loads;
}

export interface Week {
  load: number;
  mean: number;
  spread: number;
  monotony: number | null;
  strain: number | null;
}

/** Seven loads: their sum, mean, the spread over seven (not six) days, the monotony and the strain; none for a week with no load. */
export function weekOf(loads: number[]): Week {
  expect(loads).toHaveLength(7);
  const load = loads.reduce((sum, value) => sum + value, 0);
  const mean = load / 7;
  const spread = Math.sqrt(loads.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 7);
  if (!(mean > 0)) return { load, mean, spread, monotony: null, strain: null };
  const monotony = mean / spread;
  return { load, mean, spread, monotony, strain: load * monotony };
}

export const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value}%`;
export const whole = (value: number): string => Math.round(value).toLocaleString('en-US');
