import { apiJson } from '../api';
import type { ActivitySummary } from '../contracts/activity';

export interface ActivityHistoryQuery {
  sort: string;
  defaultName: string;
  year?: number | null;
  month?: number | null;
  day?: string | null;
  search?: string;
}

export interface ActivityHistoryPage {
  items: ActivitySummary[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
  summary: {
    count: number;
    distanceKm: number;
    movingTimeSeconds: number;
    activeDays: number;
    longestRun: ActivitySummary | null;
    fastestRun: ActivitySummary | null;
  };
  years: number[];
  monthsByYear: Record<string, number[]>;
  monthSummaries: Array<{ month: string; count: number; distanceKm: number; movingTimeSeconds: number }>;
  weeklyDistance: Array<{ weekStart: string; distanceKm: number }>;
}

export const ACTIVITY_HISTORY_PAGE_SIZE = 60;
export const ACTIVITY_HISTORY_SEARCH_LIMIT = 256;

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isRun = (value: unknown): value is ActivitySummary => isRecord(value) && typeof value.id === 'number' && Number.isSafeInteger(value.id) && value.id > 0;

export function normalizeActivityHistoryPage(value: unknown): ActivityHistoryPage {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isRun)
    || typeof value.hasMore !== 'boolean' || !nonnegative(value.totalCount)
    || (value.hasMore ? typeof value.nextCursor !== 'string' || !value.nextCursor : value.nextCursor !== null)
    || (value.hasMore && value.items.length === 0)
    || !isRecord(value.summary) || !nonnegative(value.summary.count)
    || !nonnegative(value.summary.distanceKm) || !nonnegative(value.summary.movingTimeSeconds) || !nonnegative(value.summary.activeDays)
    || value.summary.count > value.totalCount || value.items.length > value.summary.count
    || !(value.summary.longestRun === null || isRun(value.summary.longestRun))
    || !(value.summary.fastestRun === null || isRun(value.summary.fastestRun))
    || !Array.isArray(value.years) || !value.years.every(year => Number.isInteger(year))
    || !isRecord(value.monthsByYear) || !Object.values(value.monthsByYear).every(months => Array.isArray(months) && months.every(month => Number.isInteger(month) && month >= 1 && month <= 12))
    || !Array.isArray(value.monthSummaries) || !value.monthSummaries.every(month => isRecord(month) && typeof month.month === 'string' && /^\d{4}-\d{2}$/.test(month.month) && nonnegative(month.count) && nonnegative(month.distanceKm) && nonnegative(month.movingTimeSeconds))
    || !Array.isArray(value.weeklyDistance) || !value.weeklyDistance.every(week => isRecord(week) && typeof week.weekStart === 'string' && nonnegative(week.distanceKm))) {
    throw new Error('Invalid activity history page');
  }
  return value as unknown as ActivityHistoryPage;
}

export async function fetchActivityHistoryPage(query: ActivityHistoryQuery, cursor: string | null, options: RequestInit = {}): Promise<ActivityHistoryPage> {
  const params = new URLSearchParams({ sort: query.sort, limit: String(ACTIVITY_HISTORY_PAGE_SIZE), defaultName: query.defaultName });
  if (query.year != null) params.set('year', String(query.year));
  if (query.month != null) params.set('month', String(query.month));
  if (query.day) params.set('day', query.day);
  const search = query.search?.trim().toLowerCase().slice(0, ACTIVITY_HISTORY_SEARCH_LIMIT);
  if (search) params.set('search', search);
  if (cursor) params.set('cursor', cursor);
  const page = normalizeActivityHistoryPage(await apiJson<unknown>(`/api/activities/page?${params}`, options));
  if (!cursor && !page.hasMore && new Set(page.items.map(run => run.id)).size !== page.summary.count) {
    throw new Error('Invalid activity history page');
  }
  return page;
}

/** Keep server ordering while tolerating an overlapping page boundary. */
export function appendActivityHistoryRuns(current: ActivitySummary[], incoming: ActivitySummary[]): ActivitySummary[] {
  const seen = new Set(current.map(run => String(run.id)));
  return [...current, ...incoming.filter(run => {
    const id = String(run.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}
