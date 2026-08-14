import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const checker = readFileSync(path.resolve(here, '../../../.tools/check-translations.mjs'), 'utf8');

assert.match(checker, /localeRegistry\.js/);
assert.match(checker, /SUPPORTED_LOCALES/);
assert.match(checker, /DEFAULT_LOCALE/);
assert.match(checker, /missingBundles/);
assert.match(checker, /extraBundles/);
assert.match(checker, /'\.ts'/);
assert.match(checker, /'\.tsx'/);

console.log('[PASS] Translation checker is locale-registry driven and TypeScript-aware.');
