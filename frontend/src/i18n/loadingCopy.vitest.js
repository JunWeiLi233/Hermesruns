import { describe, expect, it, vi } from 'vitest';
import { ensureLocaleMessages, translate } from './translationRuntime.js';
import { translateLoadingText } from './loadingCopy.js';
import enLoading from './locales/en/loading.js';
import zhLoading from './locales/zh-CN/loading.js';

describe.each([
  ['en', {
    what: 'your runs',
    initial: 'Loading your runs…',
    slow: 'Still loading your runs…',
    waking: 'Waking the server…',
    slowBody: 'This is taking longer than usual. Everything will appear right here.',
    wakingBody: 'The server is starting. Your data will appear when it is ready.',
    primaryNavigation: 'Primary navigation',
  }],
  ['zh-CN', {
    what: '跑步记录',
    initial: '正在加载跑步记录…',
    slow: '仍在加载跑步记录…',
    waking: '正在唤醒服务器…',
    slowBody: '加载比平时稍久，内容加载后会显示在这里。',
    wakingBody: '服务器正在启动，准备就绪后会显示你的数据。',
    primaryNavigation: '主导航',
  }],
])('loading status through the real %s translation runtime', (language, copy) => {
  it('resolves initial, slow and waking status with the localized subject', async () => {
    await ensureLocaleMessages(language);
    const missing = vi.fn();
    expect(translate(language, 'loading.status.initial', { what: copy.what }, missing)).toBe(copy.initial);
    expect(translate(language, 'loading.status.slow', { what: copy.what }, missing)).toBe(copy.slow);
    expect(translate(language, 'loading.status.waking', undefined, missing)).toBe(copy.waking);
    expect(translate(language, 'loading.status.slow_body', undefined, missing)).toBe(copy.slowBody);
    expect(translate(language, 'loading.status.waking_body', undefined, missing)).toBe(copy.wakingBody);
    expect(translate(language, 'loading.nav.primary', undefined, missing)).toBe(copy.primaryNavigation);
    expect(missing).not.toHaveBeenCalled();
  });
});

describe('downloaded loading design copy', () => {
  it('translates captions and loading subjects through the production dictionaries', async () => {
    await ensureLocaleMessages('zh-CN');
    const missing = vi.fn();
    const t = (key, replacements) => translate('zh-CN', key, replacements, missing);
    const translateText = text => translateLoadingText(t, text);
    expect(translateText('Runs')).toBe('跑步记录');
    expect(translateText('Workout name')).toBe('训练名称');
    expect(translateText('your runs')).toBe('跑步记录');
    expect(translateText('profile settings')).toBe('个人资料设置');
    expect(translateText('Activity')).toBe('跑步活动');
    expect(translateText('activity settings')).toBe('跑步活动设置');
    expect(translateText('Ready to import · 1')).toBe('待导入 · 1');
    expect(translateText('Drop FIT/GPX files here, or click to choose')).toBe('将 FIT/GPX 文件拖到这里，或点击选择');
    expect(translateText('GPX, TCX, FIT, ZIP or .fit.gz from a Strava export')).toBe('支持 GPX、TCX、FIT、ZIP，或 Strava 导出的 .fit.gz 文件');
    expect(translateText('More')).toBe('更多');
    expect(translateText('Today')).toBe('今日训练');
    expect(translateText('Sun')).toBe('周日');
    expect(translateText('Admin / ')).toBe('管理 / ');
    expect(translateText('Primary')).toBe('主导航');
    expect(missing).not.toHaveBeenCalled();
  });

  it('merges every new caption and subject into both production locale barrels', async () => {
    expect(Object.keys(enLoading.loading.copy)).toEqual(Object.keys(zhLoading.loading.copy));
    for (const language of ['en', 'zh-CN']) {
      await ensureLocaleMessages(language);
      const missing = vi.fn();
      const t = key => translate(language, key, undefined, missing);
      for (const [key, caption] of Object.entries(enLoading.loading.copy)) {
        const expected = language === 'en' ? caption : zhLoading.loading.copy[key];
        expect(translateLoadingText(t, caption), key).toBe(expected);
        if (language === 'zh-CN') expect(expected, key).toMatch(/[\u4e00-\u9fff]/);
      }
      expect(missing).not.toHaveBeenCalled();
    }
  });

  it('replaces obsolete waking claims with the current honest status copy', async () => {
    await ensureLocaleMessages('zh-CN');
    for (const language of ['en', 'zh-CN']) {
      const t = key => translate(language, key);
      expect(translateLoadingText(t, 'Waking the server · can take up to 30 s')).toBe(t('loading.status.waking'));
      expect(translateLoadingText(t, 'HermesRuns rests when idle. The first load can take up to 30 seconds — nothing is lost.')).toBe(t('loading.status.waking_body'));
    }
  });

  it('preserves unknown text, fixture values, brands, numbers and surrounding whitespace', async () => {
    await ensureLocaleMessages('zh-CN');
    const t = key => translate('zh-CN', key);
    expect(translateLoadingText(t, '  Runs \n')).toBe('  跑步记录 \n');
    for (const text of ['HermesRuns', 'Nike Pegasus 41', 'preview-run.gpx', '1 KB', 'S', '5K', '10K', 'VO₂max', 'GPX', '>', 'Unknown caption!', '  ', '']) {
      expect(translateLoadingText(t, text), text).toBe(text);
    }
    expect(translateLoadingText(t, 42)).toBe(42);
    expect(translateLoadingText(t, null)).toBeNull();
  });
});
