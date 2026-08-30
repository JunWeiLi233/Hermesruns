import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const loginSource = readFileSync(path.join(here, 'Login.jsx'), 'utf8');
const enPagesSource = readFileSync(path.join(here, '../i18n/locales/en/pages.js'), 'utf8');
const zhPagesSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/pages.js'), 'utf8');

assert.match(
  loginSource,
  /ADMIN_MFA_SETUP_UNAVAILABLE/,
  'Login should distinguish unavailable admin MFA setup from an expired challenge.',
);
assert.match(
  enPagesSource,
  /"admin_mfa_setup_unavailable":/,
  'English login copy should explain how to configure admin MFA setup.',
);
assert.match(
  zhPagesSource,
  /"admin_mfa_setup_unavailable":/,
  'Chinese login copy should explain how to configure admin MFA setup.',
);

console.log('[PASS] Admin MFA setup availability guardrails passed.');
