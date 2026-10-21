import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureLocaleMessages, translate } from '../i18n/translationRuntime.js';
import { METHODS_DOC_URL, methodsDocUrl } from './methodsDoc';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, '..');
const doc = readFileSync(path.join(here, '../../../docs/README-ANALYSIS.md'), 'utf8').replace(/\r\n/g, '\n');

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens, a repeated heading gets -1, -2, ... */
function headingAnchors(markdown) {
  const seen = new Map();
  const anchors = new Set();
  let inCode = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) inCode = !inCode;
    if (inCode) continue;
    const match = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const slug = match[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replace(/ /g, '-');
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count ? `${slug}-${count}` : slug);
  }
  return anchors;
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    if (!/\.(js|jsx|ts|tsx)$/.test(entry.name) || /\.(vitest|test|smoke\.test)\./.test(entry.name)) return [];
    return [full];
  });
}

const sources = sourceFiles(srcDir)
  .filter((file) => path.basename(file) !== 'methodsDoc.js')
  .map((file) => ({ file: path.relative(srcDir, file), text: readFileSync(file, 'utf8') }));

function collect(pattern) {
  return sources.flatMap(({ file, text }) => [...text.matchAll(pattern)].map((match) => ({ file, value: match[1] })));
}

describe('the methods document and the links to it', () => {
  it('builds a link to a section of docs/README-ANALYSIS.md on the default branch', () => {
    expect(METHODS_DOC_URL).toMatch(/^https:\/\/github\.com\/.+\/blob\/master\/docs\/README-ANALYSIS\.md$/);
    expect(methodsDocUrl('goals')).toBe(`${METHODS_DOC_URL}#goals`);
    expect(methodsDocUrl()).toBe(METHODS_DOC_URL);
  });

  it('finds every heading the way GitHub anchors it', () => {
    const anchors = headingAnchors(doc);
    expect(anchors.has('vdot-and-vo2max')).toBe(true);
    expect(anchors.has('todays-call-and-readiness')).toBe(true);
    expect(anchors.has('known-limits-1')).toBe(true);
  });

  it('has a heading for every anchor the app links to, so renaming a heading cannot break a link silently', () => {
    const anchors = headingAnchors(doc);
    const used = [
      ...collect(/<(?:HowWorkedOut|MethodsLink)\b[^>]*?\banchor="([a-z0-9-]+)"/g),
      ...collect(/methodsDocUrl\(\s*['"]([a-z0-9-]+)['"]/g),
      ...collect(/\bmethodsAnchor:\s*['"]([a-z0-9-]+)['"]/g),
    ];
    // Not vacuous: the cards on Analysis, the prediction page, the run page and Today all link here.
    expect(new Set(used.map((item) => item.value)).size).toBeGreaterThanOrEqual(10);
    const missing = used.filter((item) => !anchors.has(item.value)).map((item) => `${item.value} (${item.file})`);
    expect(missing).toEqual([]);
  });

  describe('the sentences under the numbers', () => {
    beforeAll(() => ensureLocaleMessages('zh-CN'));

    it('exist in English and in Chinese for every textKey the app uses', () => {
      const keys = collect(/\btextKey="(methods\.[a-z_]+)"/g);
      expect(keys.length).toBeGreaterThanOrEqual(5);
      const missing = [];
      for (const { value } of keys) {
        for (const language of ['en', 'zh-CN']) {
          const text = translate(language, value, undefined, () => missing.push(`${value} (${language})`));
          expect(text).toBeTruthy();
        }
      }
      expect(missing).toEqual([]);
    });
  });
});
