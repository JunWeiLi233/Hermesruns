import assert from 'node:assert/strict';
import config from './vite.config.js';

const groups = config.build?.rolldownOptions?.output?.codeSplitting?.groups;

assert.ok(Array.isArray(groups), 'Production builds should declare explicit Rolldown code-splitting groups.');

const groupByName = (name) => groups.find((group) => group.name === name);
const framework = groupByName('framework');
const englishLocale = groupByName('i18n-en');
const chineseLocale = groupByName('i18n-zh-CN');

assert.ok(framework?.test?.test('C:\\workspace\\frontend\\node_modules\\react-dom\\client.js'));
assert.ok(framework?.test?.test('C:\\workspace\\frontend\\node_modules\\react-router\\dist\\index.js'));
assert.ok(englishLocale?.test?.test('C:\\workspace\\frontend\\src\\i18n\\locales\\en\\pages.js'));
assert.ok(chineseLocale?.test?.test('C:\\workspace\\frontend\\src\\i18n\\locales\\zh-CN\\pages.js'));
assert.equal(englishLocale.test.test('C:\\workspace\\frontend\\src\\i18n\\locales\\zh-CN\\pages.js'), false);

console.log('[PASS] Vite production code-splitting guardrails passed.');
