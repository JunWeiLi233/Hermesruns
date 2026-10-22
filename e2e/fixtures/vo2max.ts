// The VO2max number over time, worked out again from the runs the API lists and the rule of the methods document (docs/README-ANALYSIS.md, "VDOT and VO2max", "The number
// over time"), for the specs of the VO2max estimates page: written out here, so a page that took the wrong runs, the wrong 90 days or the wrong days for its average fails.
// The runs of these specs have no heart rate (asserted), so every estimate is Daniels' race equation.
import type { Locator } from '@playwright/test';
import { raceEquationVo2max } from './format.ts';
import { expect } from './test.ts';

export const DAY = 24 * 3600 * 1000;

export interface Row {
  id: number;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  startTime: string;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
}

export interface Point {
  time: number;
  date: string;
  value: number;
  usedCount: number;
  firm: boolean;
  now: boolean;
}

export const round1 = (value: number): number => Math.round(value * 10) / 10;
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
/** The moment a run began: its wall-clock start read as UTC (the page reads it on the device's clock; the gaps between runs are the same but for a change of clocks). */
export const timeOf = (row: Row): number => Date.parse(`${row.startTime}Z`);

/**
 * The number at a moment, from the runs that began before it (the rule of the methods document): an estimate for each run of 1.5 km or more in the
 * 90 days before, here by the race equation (no run has a heart rate: asserted) unless the run is more than 1.18 times slower than the median pace
 * of the runs there were by then; the best three of the runs of 3 km or more (or of all of them when none is that long), their mean to one decimal.
 */
export function numberAt(moment: number, rows: Row[], inclusive: boolean): { value: number; usedCount: number } | null {
  const by = rows.filter((row) => (inclusive ? timeOf(row) <= moment : timeOf(row) < moment));
  expect(by.every((row) => !row.averageHeartRate), 'the fixture runs have no heart rate').toBe(true);
  const paces = by.filter((row) => row.distanceKm >= 1.5 && row.movingTimeSeconds > 0).map((row) => row.movingTimeSeconds / row.distanceKm).sort((a, b) => a - b);
  const median = paces.length ? paces[Math.floor(paces.length / 2)] : null;
  const found = by
    .filter((row) => row.distanceKm >= 1.5 && row.movingTimeSeconds > 0 && moment - timeOf(row) <= 90 * DAY)
    .filter((row) => median === null || row.movingTimeSeconds / row.distanceKm <= median * 1.18)
    .map((row) => ({ km: row.distanceKm, estimate: raceEquationVo2max(row.distanceKm * 1000, row.movingTimeSeconds) }));
  if (found.length === 0) return null;
  const pool = found.some((item) => item.km >= 3) ? found.filter((item) => item.km >= 3) : found;
  const top = [...pool].sort((a, b) => b.estimate - a.estimate).slice(0, 3);
  return { value: round1(mean(top.map((item) => item.estimate))), usedCount: top.length };
}

/** Every point of the line, oldest first: after each run, and today. */
export function pointsOf(rows: Row[], now = Date.now()): Point[] {
  const sorted = [...rows].sort((a, b) => timeOf(a) - timeOf(b));
  const points: Point[] = [];
  for (const row of sorted) {
    const found = numberAt(timeOf(row), sorted, true);
    if (found) points.push({ time: timeOf(row), date: row.startTime.slice(0, 10), value: found.value, usedCount: found.usedCount, firm: found.usedCount >= 3, now: false });
  }
  const today = numberAt(now, sorted, true);
  if (today) points.push({ time: now, date: new Date(now).toISOString().slice(0, 10), value: today.value, usedCount: today.usedCount, firm: today.usedCount >= 3, now: true });
  return points;
}

/**
 * The average of the number over the days each firm point stood (docs/README-ANALYSIS.md, "The number over time"): from its run to the next point, or to `end` for
 * the last, and for 90 days at most; thin points count for nothing but end the stand of the point before them.
 */
export function averageOver(points: Point[], end: number): { value: number; days: number } | null {
  let sum = 0;
  let days = 0;
  points.forEach((point, index) => {
    if (!point.firm) return;
    const next = index + 1 < points.length ? points[index + 1].time : end;
    const stood = (Math.min(next, point.time + 90 * DAY, end) - point.time) / DAY;
    if (!(stood > 0)) return;
    sum += point.value * stood;
    days += stood;
  });
  return days > 0 ? { value: sum / days, days } : null;
}

/** The mean of the numbers of the points, which is not what the average is: it counts a point for each run and not for each day. */
export const meanOfPoints = (points: Point[]): number => mean(points.filter((point) => point.firm).map((point) => point.value));

/**
 * What an average reads: its number (to one decimal) and the days it is of. The page parses the wall-clock times of the runs on the device's clock and this file reads
 * them as UTC, so the gaps across a change of clocks differ by an hour: a tenth of a point and a day are the allowance, which no wrong rule fits inside.
 */
export async function expectAverage(reading: Locator, expected: { value: number; days: number } | null, daysText = /^over (\d+) days$/): Promise<void> {
  if (expected === null) {
    await expect(reading).toContainText('–');
    return;
  }
  await expect.poll(async () => Math.abs(Number(await reading.locator('strong').textContent()) - expected.value), { message: 'the average' }).toBeLessThanOrEqual(0.1);
  const text = (await reading.locator('small').textContent()) ?? '';
  const shown = Number(daysText.exec(text)?.[1]);
  expect(Math.abs(shown - expected.days), `the days of the average, "${text}"`).toBeLessThanOrEqual(1);
}
