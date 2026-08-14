import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'Signup.jsx'), 'utf8');
const zhSource = fs.readFileSync(path.join(here, '../i18n/locales/zh-CN/pages.js'), 'utf8');
const enSource = fs.readFileSync(path.join(here, '../i18n/locales/en/pages.js'), 'utf8');

assert.match(
  source,
  /const SIGNUP_EMAIL_ERROR_KEYS = \{[\s\S]*INVALID_EMAIL: 'signup\.error_invalid_email',[\s\S]*DISPOSABLE_EMAIL: 'signup\.error_disposable_email',[\s\S]*INVALID_EMAIL_DOMAIN: 'signup\.error_invalid_email_domain',[\s\S]*\};/,
  'Signup should map backend email validation codes to localized copy keys.',
);

assert.match(
  source,
  /const emailErrorKey = SIGNUP_EMAIL_ERROR_KEYS\[data\.code\];/,
  'Signup should resolve the email error copy from the backend code before falling back to raw strings.',
);

assert.match(
  source,
  /data\.code === 'INVALID_EMAIL_DOMAIN' && data\.suggestedEmail/,
  'Signup should only adopt the backend typo suggestion for undeliverable-domain rejections.',
);

assert.match(
  source,
  /setSuggestedEmail\(data\.suggestedEmail\);/,
  'Signup should store the suggested email for the typo prompt.',
);

assert.match(
  source,
  /role="status"[\s\S]*typo_suggestion_prefix', \{ email: suggestedEmail \}/,
  'Signup should render the suggested address in a non-alert status prompt.',
);

assert.match(
  source,
  /setEmail\(suggestedEmail\);[\s\S]*setSuggestedEmail\(null\);[\s\S]*setError\(''\);/,
  'The typo prompt action should apply the suggested address and clear the rejection state.',
);

assert.match(
  source,
  /setEmail\(e\.target\.value\);[\s\S]*setSuggestedEmail\(null\);/,
  'Editing the email field should dismiss a stale typo suggestion.',
);

for (const [name, localeSource] of [['zh-CN', zhSource], ['en', enSource]]) {
  for (const key of [
    'error_invalid_email',
    'error_disposable_email',
    'error_invalid_email_domain',
    'typo_suggestion_prefix',
    'typo_suggestion_use',
  ]) {
    assert.match(
      localeSource,
      new RegExp(`"${key}": "[^"]+"`),
      `${name} signup locale should define ${key}.`,
    );
  }
  assert.match(
    localeSource,
    /"typo_suggestion_prefix": "[^"]*\{email\}[^"]*"/,
    `${name} typo_suggestion_prefix should interpolate the {email} variable.`,
  );
}

console.log('[PASS] Signup email validation guardrails passed.');
