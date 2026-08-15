import { apiJson } from '../api.ts';
import type { ActivitySummary } from '../contracts/activity';

function isActivityRecord(value: unknown): value is ActivitySummary {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeActivitySummaries(payload: unknown): ActivitySummary[] {
  return Array.isArray(payload) ? payload.filter(isActivityRecord) : [];
}

export async function fetchActivitySummaries(
  options: RequestInit = {},
): Promise<ActivitySummary[]> {
  const payload = await apiJson<unknown>('/api/activities', options);
  return normalizeActivitySummaries(payload);
}
