import { describe, expect, it, vi } from 'vitest';
import { createTranslationRuntime } from './createTranslationRuntime.js';

describe('translation runtime factory', () => {
  it('shares an in-flight load and retries after a failed locale download', async () => {
    let finishLoad;
    const messages = { example: { text: '中文 {count}' } };
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(() => new Promise((resolve) => { finishLoad = resolve; }));
    const runtime = createTranslationRuntime({
      fallbackMessages: { example: { text: 'English {count}', fallback: 'English fallback' } },
      localeLoaders: { 'zh-CN': loader },
    });
    const onMissing = vi.fn();

    expect(await runtime.ensureLocaleMessages('zh-CN')).toBeNull();
    expect(runtime.translate('zh-CN', 'example.text', { count: 2 }, onMissing)).toBe('English 2');
    expect(onMissing).not.toHaveBeenCalled();
    const first = runtime.ensureLocaleMessages('zh-CN');
    const second = runtime.ensureLocaleMessages('zh-CN');
    finishLoad({ default: messages });
    expect(await first).toBe(messages);
    expect(await second).toBe(messages);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(runtime.translate('zh-CN', 'example.text', { count: 3 })).toBe('中文 3');
    expect(runtime.translate('zh-CN', 'example.fallback', undefined, onMissing)).toBe('English fallback');
    expect(onMissing).toHaveBeenCalledWith('example.fallback', 'zh-CN', 'en');
  });

  it('keeps dictionaries and pending loads separate for each runtime', async () => {
    const fallbackMessages = { example: { text: 'English' } };
    const publicRuntime = createTranslationRuntime({ fallbackMessages });
    const privateRuntime = createTranslationRuntime({
      fallbackMessages,
      localeLoaders: { 'zh-CN': async () => ({ default: { example: { text: '中文' } } }) },
    });
    await privateRuntime.ensureLocaleMessages('zh-CN');
    expect(publicRuntime.getLoadedMessages('zh-CN')).toBeNull();
    expect(await publicRuntime.ensureLocaleMessages('zh-CN')).toBeNull();
    expect(publicRuntime.translate('zh-CN', 'example.text')).toBe('English');
  });
});
