import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../api';
import { ACTIVITIES_TTL_MS, cachedApiJson, clearResourceCache, invalidateResourceCache } from './resourceCache';

vi.mock('../api.ts', () => ({ apiJson: vi.fn() }));

const request = vi.mocked(apiJson);
const variantOptions: RequestInit[] = [
  { headers: { Authorization: 'Bearer other-session' } },
  { headers: { 'Accept-Language': 'zh-CN' } },
  { cache: 'no-store' },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  clearResourceCache();
  localStorage.clear();
  localStorage.setItem('hermes_email', 'runner@example.test');
  localStorage.setItem('hermes_jwt', 'session-one');
  localStorage.setItem('hermes_lang', 'en');
  request.mockReset();
});

afterEach(() => vi.useRealTimers());

describe('resource cache', () => {
  it('shares concurrent reads and returns independent copies on every hit', async () => {
    const response = deferred<Array<{ id: number }>>();
    request.mockReturnValue(response.promise);
    const first = cachedApiJson<Array<{ id: number }>>('/api/activities');
    const second = cachedApiJson<Array<{ id: number }>>('/api/activities');
    response.resolve([{ id: 1 }]);
    const [left, right] = await Promise.all([first, second]);
    left[0].id = 99;
    expect(right).toEqual([{ id: 1 }]);
    expect(await cachedApiJson('/api/activities')).toEqual([{ id: 1 }]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('retries a failed read on the next call instead of caching the failure', async () => {
    request.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce([]);
    await expect(cachedApiJson('/api/activities')).rejects.toThrow('offline');
    expect(await cachedApiJson('/api/activities')).toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('expires successful reads after their TTL', async () => {
    vi.useFakeTimers();
    request.mockResolvedValue([]);
    await cachedApiJson('/api/activities');
    vi.advanceTimersByTime(ACTIVITIES_TTL_MS);
    await cachedApiJson('/api/activities');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not restore a late result after invalidation', async () => {
    const old = deferred<unknown>();
    request.mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ id: 2 }]);
    const first = cachedApiJson('/api/activities');
    invalidateResourceCache('/api/activities');
    await cachedApiJson('/api/activities');
    old.resolve([{ id: 1 }]);
    await first;
    expect(await cachedApiJson('/api/activities')).toEqual([{ id: 2 }]);
  });

  it.each(['hermes_email', 'hermes_jwt', 'hermes_lang'])('separates responses when %s changes', async (key) => {
    request.mockResolvedValueOnce({ version: 1 }).mockResolvedValueOnce({ version: 2 });
    await cachedApiJson('/api/profile/me');
    localStorage.setItem(key, 'different-value');
    expect(await cachedApiJson('/api/profile/me')).toEqual({ version: 2 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each(variantOptions)('passes request-specific options through without reusing a default cached response: %o', async (options) => {
    request.mockResolvedValueOnce({ version: 1 }).mockResolvedValueOnce({ version: 2 });
    await cachedApiJson('/api/profile/me');
    expect(await cachedApiJson('/api/profile/me', options)).toEqual({ version: 2 });
    expect(request).toHaveBeenLastCalledWith('/api/profile/me', options);
    expect(await cachedApiJson('/api/profile/me')).toEqual({ version: 1 });
  });

  it('does not cache a different resource whose name only starts with an allowlisted path', async () => {
    request.mockResolvedValue({});
    await cachedApiJson('/api/profile/metadata');
    await cachedApiJson('/api/profile/metadata');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects an already aborted caller even when a cached result is available', async () => {
    request.mockResolvedValue([]);
    await cachedApiJson('/api/activities');
    const controller = new AbortController();
    controller.abort();
    await expect(cachedApiJson('/api/activities', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('cancels one subscriber promptly without cancelling a shared read for another page', async () => {
    const response = deferred<unknown>();
    const controller = new AbortController();
    request.mockImplementation((_url, options) => {
      options?.signal?.addEventListener('abort', () => response.reject(new DOMException('Aborted', 'AbortError')));
      return response.promise;
    });
    const first = cachedApiJson('/api/activities', { signal: controller.signal });
    const second = cachedApiJson('/api/activities');
    const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const surviving = expect(second).resolves.toEqual([{ id: 1 }]);
    controller.abort();
    await cancelled;
    response.resolve([{ id: 1 }]);
    await surviving;
    expect(request).toHaveBeenCalledTimes(1);
    expect(await cachedApiJson('/api/activities')).toEqual([{ id: 1 }]);
  });

  it('starts a fresh read after every subscriber cancels a hanging request', async () => {
    const controller = new AbortController();
    request.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
    })).mockResolvedValueOnce([{ id: 2 }]);
    const first = cachedApiJson('/api/activities', { signal: controller.signal });
    const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await cancelled;
    expect(await cachedApiJson('/api/activities')).toEqual([{ id: 2 }]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
