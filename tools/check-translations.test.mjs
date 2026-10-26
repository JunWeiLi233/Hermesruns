import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const checker = readFileSync(fileURLToPath(new URL('./check-translations.mjs', import.meta.url)), 'utf8');
const messages = { landing: { valid: 'Welcome' }, admin: { console: { nav_overview: 'Overview' } } };

function runChecker(t, files, locales = { en: messages, 'zh-CN': messages }, args = ['--full']) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'hermes-translations-'));
  assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('hermes-translations-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const fixture = {
    'package.json': '{"type":"module"}',
    'tools/check-translations.mjs': checker,
    'frontend/src/i18n/translations.js': `export default ${JSON.stringify(locales)};`,
    'frontend/src/i18n/localeRegistry.js': "export const DEFAULT_LOCALE = 'en'; export const SUPPORTED_LOCALES = ['en', 'zh-CN'];",
    ...files,
  };
  for (const [relative, source] of Object.entries(fixture)) {
    const file = path.join(directory, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source);
  }
  const result = spawnSync(process.execPath, [path.join(directory, 'tools/check-translations.mjs'), ...args], {
    cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 10_000,
  });
  assert.ifError(result.error);
  return { ...result, output: result.stdout + result.stderr };
}

test('does not treat concatenated translation prefixes as complete keys', (t) => {
  const result = runChecker(t, {
    'frontend/src/pages/Dashboard.jsx': `
      t('admin.console.nav_' + tab.key);
      i18n.t("admin.console.nav_" /* selected tab */ + tab.key);
      t('admin.console.nav_overview');
      t('landing.valid', { count: 2 });
    `,
  });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /No undefined translation-key usages/);
});

test('excludes Vitest fixtures from usage and hardcoded-copy scans like existing test files', (t) => {
  const fixture = `t('fixture.only'); const copy = lang === 'zh-CN' ? '测试夹具内容' : 'Fixture-only copy';`;
  const result = runChecker(t, {
    'frontend/src/contexts/Provider.vitest.jsx': fixture,
    'frontend/src/pages/View.vitest.tsx': fixture,
    'frontend/src/components/View.test.jsx': fixture,
    'frontend/src/components/View.smoke.test.tsx': fixture,
    'frontend/src/pages/Product.jsx': "t('landing.valid');",
  }, undefined, ['--all']);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /fixture\.only|BYPASS —/);
});

test('still rejects genuine missing literal keys, including calls with options and comments', (t) => {
  const result = runChecker(t, {
    'frontend/src/pages/Product.jsx': `
      t('landing.valid');
      t('landing.missing', { count: 2 });
      i18n.t("landing.other_missing" /* options follow */, { count: 1 });
    `,
  });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /landing\.missing/);
  assert.match(result.output, /landing\.other_missing/);
  assert.match(result.output, /MISSING USAGE/);
});

test('still rejects a real locale parity gap even when product usages are valid', (t) => {
  const result = runChecker(t, { 'frontend/src/pages/Product.jsx': "t('landing.valid');" }, {
    en: { ...messages, onlyEnglish: 'Missing translation' }, 'zh-CN': messages,
  });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /onlyEnglish/);
});
