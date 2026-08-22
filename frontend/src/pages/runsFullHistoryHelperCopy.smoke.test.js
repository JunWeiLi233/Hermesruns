import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const zhPagesSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/pages.js'), 'utf8');
const enPagesSource = readFileSync(path.join(here, '../i18n/locales/en/pages.js'), 'utf8');

assert.match(
  runsSource,
  /className="runs-profile-signal runs-profile-signal--count"[\s\S]*<span>\{t\('runs\.full_history'\)\}<\/span>[\s\S]*<strong>\{countText\}<\/strong>/,
  'The full-history signal should keep its label and run count.',
);

assert.doesNotMatch(
  runsSource,
  /className="runs-profile-signal runs-profile-signal--count"[\s\S]*<p>\{t\('runs\.full_history_copy'\)\}<\/p>/,
  'The full-history signal should not render the removed helper copy.',
);

for (const [label, source] of [['zh-CN pages', zhPagesSource], ['en pages', enPagesSource]]) {
  assert.doesNotMatch(
    source,
    /\s+"full_history_copy":/,
    `${label} should remove the unused full-history helper translation key.`,
  );
}

console.log('[PASS] Runs full-history helper copy guardrails passed.');
