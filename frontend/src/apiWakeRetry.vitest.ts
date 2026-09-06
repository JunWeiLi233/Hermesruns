import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  apiFetch,
  isSafeWakeRetryMethod,
  isWakeRetryableNetworkError,
  isWakeRetryableStatus,
  subscribeWakeRetry,
  withWakeRetry,
  WAKE_RETRY_DELAYS_MS,
  WAKE_RETRY_MAX,
} from './api';

type StatusLike = { status: number };

describe('wake retry helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses seconds-scale default backoff for Railway cold start', () => {
    expect(WAKE_RETRY_MAX).toBe(2);
    expect([...WAKE_RETRY_DELAYS_MS]).toEqual([1000, 2500]);
  });

  it('treats GET as safe and POST as unsafe', () => {
    expect(isSafeWakeRetryMethod('GET')).toBe(true);
    expect(isSafeWakeRetryMethod(undefined)).toBe(true);
    expect(isSafeWakeRetryMethod('POST')).toBe(false);
    expect(isSafeWakeRetryMethod('put')).toBe(false);
  });

  it('retries only wake-friendly statuses', () => {
    expect(isWakeRetryableStatus(502)).toBe(true);
    expect(isWakeRetryableStatus(503)).toBe(true);
    expect(isWakeRetryableStatus(504)).toBe(true);
    expect(isWakeRetryableStatus(401)).toBe(false);
    expect(isWakeRetryableStatus(400)).toBe(false);
    expect(isWakeRetryableStatus(200)).toBe(false);
  });

  it('retries network-style errors but not AbortError', () => {
    expect(isWakeRetryableNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isWakeRetryableNetworkError(new Error('timeout waiting for upstream'))).toBe(true);
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    expect(isWakeRetryableNetworkError(abortError)).toBe(false);
  });

  it('retries on 502 then succeeds', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<StatusLike & { ok?: boolean }>>()
      .mockResolvedValueOnce({ status: 502 })
      .mockResolvedValueOnce({ status: 200, ok: true });

    const pending = withWakeRetry(operation, {
      method: 'GET',
      shouldRetryResult: (result) => isWakeRetryableStatus(result.status),
      delaysMs: [10, 10],
    });

    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result).toEqual({ status: 200, ok: true });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 401', async () => {
    const operation = vi.fn<() => Promise<StatusLike>>().mockResolvedValue({ status: 401 });
    const result = await withWakeRetry(operation, {
      method: 'GET',
      shouldRetryResult: (result) => isWakeRetryableStatus(result.status),
    });
    expect(result).toEqual({ status: 401 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 400', async () => {
    const operation = vi.fn<() => Promise<StatusLike>>().mockResolvedValue({ status: 400 });
    const result = await withWakeRetry(operation, {
      method: 'GET',
      shouldRetryResult: (result) => isWakeRetryableStatus(result.status),
    });
    expect(result).toEqual({ status: 400 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry POST mutations on 502', async () => {
    const operation = vi.fn<() => Promise<StatusLike>>().mockResolvedValue({ status: 502 });
    const result = await withWakeRetry(operation, {
      method: 'POST',
      shouldRetryResult: (result) => isWakeRetryableStatus(result.status),
    });
    expect(result).toEqual({ status: 502 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('apiFetch retries GET 502 responses', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = apiFetch('/api/profile');
    await vi.runAllTimersAsync();
    const response = await pending;

    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('apiFetch does not retry POST 502 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiFetch('/api/auth/login', { method: 'POST' });

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('notifies wake subscribers while retrying', async () => {
    vi.useFakeTimers();
    const seen: boolean[] = [];
    const unsubscribe = subscribeWakeRetry((active) => {
      seen.push(active);
    });

    const operation = vi
      .fn<() => Promise<StatusLike>>()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 });

    const pending = withWakeRetry(operation, {
      method: 'GET',
      shouldRetryResult: (result) => isWakeRetryableStatus(result.status),
      delaysMs: [5],
    });
    await vi.runAllTimersAsync();
    await pending;
    unsubscribe();

    expect(seen).toContain(true);
    expect(seen[seen.length - 1]).toBe(false);
  });
});