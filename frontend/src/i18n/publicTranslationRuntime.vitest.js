import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from './locales/en.js';
import zhMessages from './locales/zh-CN.js';

const LEGAL_FOOTER_KEYS = ['stitch_footer_terms', 'stitch_footer_privacy', 'stitch_footer_support'];

async function importFreshRuntime() {
  vi.resetModules();
  return import('./publicTranslationRuntime.js');
}

describe('public translation runtime', () => {
  afterEach(() => vi.restoreAllMocks());

  it('has English public copy synchronously and loads Chinese only on demand', async () => {
    const runtime = await importFreshRuntime();
    expect(runtime.getLoadedMessages('en').landing.home_hero_title).toBe(enMessages.landing.home_hero_title);
    expect(runtime.getLoadedMessages('zh-CN')).toBeNull();
    expect(runtime.translate('zh-CN', 'landing.home_hero_title')).toBe(enMessages.landing.home_hero_title);

    const first = await runtime.ensureLocaleMessages('zh-Hans');
    expect(first).toBe(await runtime.ensureLocaleMessages('zh-CN'));
    expect(runtime.translate('zh-CN', 'landing.home_hero_title')).toBe(zhMessages.landing.home_hero_title);
  });

  it('preserves the exact public subset and excludes legacy landing copy and private namespaces', async () => {
    const runtime = await importFreshRuntime();
    await runtime.ensureLocaleMessages('zh-CN');
    for (const [language, fullMessages] of [['en', enMessages], ['zh-CN', zhMessages]]) {
      const messages = runtime.getLoadedMessages(language);
      const expectedLanding = Object.fromEntries(Object.entries(fullMessages.landing)
        .filter(([key]) => key.startsWith('home_') || LEGAL_FOOTER_KEYS.includes(key)));
      expect(Object.keys(messages)).toEqual(['landing']);
      expect(messages.landing).toEqual(expectedLanding);
      expect(messages.landing.home_hero_title).toBeTruthy();
      expect(messages.landing.home_methods_example_copy).toContain('{vdot}');
      expect(messages.landing.home_supporter_status).toBe(fullMessages.landing.studio_pricing_supporter_status);
      for (const key of LEGAL_FOOTER_KEYS) expect(messages.landing[key]).toBe(fullMessages.landing[key]);
      expect(Object.keys(messages.landing).some((key) => /^(?:studio_|map_|minimal_|cinematic_)/.test(key))).toBe(false);
      expect(messages.profile).toBeUndefined();
      expect(messages.admin).toBeUndefined();
      expect(runtime.translate(language, 'landing.home_footer_copy', { year: 2026 })).toBe('© 2026 HermesRuns');
      expect(runtime.translate(language, 'landing.stitch_footer_terms')).toBe(fullMessages.landing.stitch_footer_terms);
    }
  });

  it('uses the same fallback, interpolation and missing-key behavior as the private runtime', async () => {
    const runtime = await importFreshRuntime();
    const onMissing = vi.fn();
    expect(runtime.translate('en', 'landing.home_footer_copy', { year: 2030 })).toBe('© 2030 HermesRuns');
    expect(runtime.translate('unsupported', 'landing.home_hero_title')).toBe(enMessages.landing.home_hero_title);
    expect(runtime.translate('en', 'landing.unknown_value', undefined, onMissing)).toBe('Unknown value');
    expect(onMissing).toHaveBeenCalledWith('landing.unknown_value', 'en', null);
    expect(runtime.translate('en', 'landing.stitch_missing_label')).toBe('');
  });
});
