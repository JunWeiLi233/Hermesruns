import { expect, it, vi } from 'vitest';
import enModule from '../../i18n/locales/en/conditionComparison.js';
import zhModule from '../../i18n/locales/zh-CN/conditionComparison.js';
import { ensureLocaleMessages, translate } from '../../i18n/translationRuntime.js';

it('keeps all dedicated EN/ZH keys and interpolation tokens in sync', () => {
  const en = enModule.condition_comparison, zh = zhModule.condition_comparison;
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  const tokens = value => [...value.matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(en)) {
    expect(en[key].trim()).not.toBe('');
    expect(zh[key].trim()).not.toBe('');
    expect(tokens(en[key]), key).toEqual(tokens(zh[key]));
  }
});

it.each([['en', enModule], ['zh-CN', zhModule]])('resolves %s comparison keys through the actual locale runtime', async (locale, messages) => {
  await ensureLocaleMessages(locale);
  const missing = vi.fn();
  for (const [key, value] of Object.entries(messages.condition_comparison)) {
    expect(translate(locale, `condition_comparison.${key}`, undefined, missing)).toBe(value);
  }
  expect(missing).not.toHaveBeenCalled();
});
