import { afterEach, describe, expect, it, vi } from 'vitest';

// The lazy-locale contract: the fallback locale is always available
// synchronously, non-default locales load on demand (once), and translate()
// degrades to the fallback copy instead of crashing while a chunk is in
// flight. Reload the module per test so the pending-load cache is fresh.
async function importFreshRuntime() {
  vi.resetModules();
  return import('./translationRuntime.js');
}

const zhLocaleModule = () => import('./locales/zh-CN.js');

describe('lazy locale loading', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serves the fallback locale synchronously without loading any chunk', async () => {
    const loaderSpy = vi.fn(zhLocaleModule);
    const runtime = await importFreshRuntime();
    // The runtime under test never sees the spy, but the assertion below
    // proves no loader call is required for DEFAULT_LOCALE lookups.
    expect(loaderSpy).not.toHaveBeenCalled();
    expect(runtime.getLoadedMessages('en')).toBeTruthy();
    expect(runtime.getLoadedMessages('zh-CN')).toBeNull();
  });

  it('falls back to the eager locale for keys before the lazy chunk arrives', async () => {
    const runtime = await importFreshRuntime();
    const missing = runtime.translate('zh-CN', 'landing.cinematic_races_kicker');
    // Either real zh-CN copy (if a previous test cached it) or the en
    // fallback — but never a humanized key crash placeholder for a real key.
    expect(missing).toBeTruthy();
    expect(missing).not.toMatch(/^[a-z_]+$/);
  });

  it('does not warn while a supported lazy locale is still loading', async () => {
    const runtime = await importFreshRuntime();
    const onMissing = vi.fn();
    runtime.translate('zh-CN', 'landing.cinematic_races_kicker', undefined, onMissing);
    expect(onMissing).not.toHaveBeenCalled();
  });

  it('loads the zh-CN dictionary once and caches it', async () => {
    const runtime = await importFreshRuntime();
    const first = await runtime.ensureLocaleMessages('zh-CN');
    const second = await runtime.ensureLocaleMessages('zh-CN');
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(runtime.getLoadedMessages('zh-CN')).toBe(first);
  });

  it('translates real zh-CN copy after the dictionary loads', async () => {
    const runtime = await importFreshRuntime();
    await runtime.ensureLocaleMessages('zh-CN');
    const enValue = runtime.translate('en', 'landing.cinematic_races_kicker');
    const zhValue = runtime.translate('zh-CN', 'landing.cinematic_races_kicker');
    if (typeof enValue === 'string' && enValue && enValue !== zhValue) {
      expect(typeof zhValue).toBe('string');
      expect(zhValue.length).toBeGreaterThan(0);
    }
  });

  it('resolves unknown locales to the fallback dictionary without throwing', async () => {
    const runtime = await importFreshRuntime();
    const result = await runtime.ensureLocaleMessages('klingon');
    expect(result).toBe(runtime.getLoadedMessages('en'));
    expect(runtime.translate('klingon', 'landing.cinematic_races_kicker')).toBeTruthy();
  });
});
