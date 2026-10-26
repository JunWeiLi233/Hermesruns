import { describe, expect, it, vi } from 'vitest';
import en from './locales/en.js';
import zhCN from './locales/zh-CN.js';
import { SUPPORTED_LOCALES } from './localeRegistry.js';
import { ensureLocaleMessages, translate } from './translationRuntime.js';

const dictionaries = { en, 'zh-CN': zhCN };
const chapters = ['lantern', 'seed-library', 'last-ferry'];
const chapterFields = ['title', 'body', 'left', 'right', 'left_ending', 'right_ending', 'card', 'alt'];
const interfaceKeys = [
  'title', 'invitation', 'open', 'hide', 'restore', 'hidden', 'intro', 'length', 'loading',
  'load_failed', 'retry', 'retry_save', 'saving', 'saved', 'save_failed', 'check_saved',
  'draft', 'saved_choice', 'choose', 'complete', 'start', 'continue', 'replay', 'next',
  'exit', 'not_started', 'in_progress', 'completed', 'ending', 'postcard_saved', 'album',
  'source', 'earned', 'available', 'unlock', 'album_count', 'all_done', 'no_activity',
];
const expectedKeys = [...interfaceKeys, ...chapters.flatMap(id => chapterFields.map(field => `${id}_${field}`))];
const placeholders = value => [...value.matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort();

describe.each(SUPPORTED_LOCALES)('Pocket stories real %s dictionary', language => {
  it('merges all 62 story keys into the supported production locale', () => {
    const stories = dictionaries[language].stories;
    expect(stories, 'The stories namespace must reach the actual locale barrel').toBeDefined();
    expect(Object.keys(stories).sort()).toEqual(expectedKeys.toSorted());
    for (const key of expectedKeys) expect(stories[key], key).toBeTypeOf('string');
  });

  it('supplies three complete chapters, six distinct endings and all postcard meanings', () => {
    const stories = dictionaries[language].stories;
    expect(stories).toBeDefined();
    const endings = [];
    for (const id of chapters) {
      expect(stories[`${id}_body`].length).toBeGreaterThan(150);
      expect(stories[`${id}_left`]).not.toBe(stories[`${id}_right`]);
      for (const branch of ['left', 'right']) {
        const ending = stories[`${id}_${branch}_ending`];
        expect(ending).toMatch(language === 'zh-CN' ? /。$/ : /\.$/);
        const sentences = ending.split(language === 'zh-CN' ? /[。！？]/ : /[.!?]/).filter(part => part.trim());
        expect(sentences.length).toBeGreaterThanOrEqual(2);
        endings.push(ending);
      }
      expect(stories[`${id}_card`].trim().length).toBeGreaterThan(0);
      expect(stories[`${id}_alt`].length).toBeGreaterThan(30);
      if (language === 'zh-CN') expect(stories[`${id}_body`]).toMatch(/[\u4e00-\u9fff]/);
    }
    expect(new Set(endings).size).toBe(6);
    expect(new Set(chapters.map(id => stories[`${id}_title`])).size).toBe(3);
  });

  it('resolves every story key through the real eager/lazy runtime without missing-copy fallback', async () => {
    await ensureLocaleMessages(language);
    const stories = dictionaries[language].stories;
    expect(stories).toBeDefined();
    const missing = vi.fn();
    for (const key of expectedKeys) expect(translate(language, `stories.${key}`, undefined, missing)).toBe(stories[key]);
    expect(missing).not.toHaveBeenCalled();
  });

  it('interpolates earned dates, chapter titles and album counts without unresolved tokens', async () => {
    await ensureLocaleMessages(language);
    const title = language === 'en' ? 'The lantern on Platform Nine' : '九号站台的灯笼';
    const date = '2026-10-10';
    const earned = translate(language, 'stories.earned', { date });
    expect(earned).toBe(language === 'en' ? `Earned ${date}` : `获得日期：${date}`);
    expect(translate(language, 'stories.album_count', { earned: 2 })).toBe(language === 'en'
      ? '2 of 3 postcards collected' : '已收藏 2/3 张明信片');
    expect(translate(language, 'stories.unlock', { title })).toBe(language === 'en'
      ? `Finish “${title}” with either choice to collect this postcard once. Replaying keeps it.`
      : `选择任意结局，完成《${title}》，即可获得这张明信片一次。重读不会失去它。`);
  });
});

it('keeps EN/ZH story key and interpolation-token parity for every supported locale', () => {
  expect(SUPPORTED_LOCALES).toEqual(['en', 'zh-CN']);
  expect(en.stories).toBeDefined();
  expect(zhCN.stories).toBeDefined();
  expect(Object.keys(en.stories).sort()).toEqual(Object.keys(zhCN.stories).sort());
  for (const key of expectedKeys) expect(placeholders(en.stories[key]), key).toEqual(placeholders(zhCN.stories[key]));
});
