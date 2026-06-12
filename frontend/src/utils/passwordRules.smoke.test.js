import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const signupPath = path.join(here, '../pages/Signup.jsx');
const utilityPath = path.join(here, 'passwordRules.js');
const signupSource = readFileSync(signupPath, 'utf8');

assert.ok(
  existsSync(utilityPath),
  'Signup should delegate password validation to a shared passwordRules utility.',
);

const { getDisplayPasswordRuleIds, getFailedPasswordRuleIds, normalizePasswordRules } = await import(
  pathToFileURL(utilityPath).href
);

const legacyRules = normalizePasswordRules({
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  ruleIds: ['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'DIGIT', 'SPECIAL', 'NOT_COMMON'],
});

assert.deepStrictEqual(
  getDisplayPasswordRuleIds(legacyRules),
  ['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'DIGIT', 'SPECIAL'],
  'Legacy password-rules payloads should only display rules the frontend can evaluate locally.',
);

const canonicalRules = normalizePasswordRules({
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  commonPasswords: ['Runner123!'],
  ruleIds: ['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'DIGIT', 'SPECIAL', 'NOT_COMMON'],
});

assert.deepStrictEqual(
  getDisplayPasswordRuleIds(canonicalRules),
  ['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'DIGIT', 'SPECIAL', 'NOT_COMMON'],
  'Canonical password-rules payloads should surface the backend common-password rule when details are provided.',
);

assert.deepStrictEqual(
  getFailedPasswordRuleIds('Runner123!', canonicalRules),
  ['NOT_COMMON'],
  'Shared password rule evaluation should honor backend-provided common-password data.',
);

assert.match(
  signupSource,
  /from '\.\.\/utils\/passwordRules'/,
  'Signup should import the shared passwordRules utility.',
);

assert.doesNotMatch(
  signupSource,
  /function checkPasswordClient/,
  'Signup should not keep a page-local password checker once backend rules are shared.',
);

assert.doesNotMatch(
  signupSource,
  /const common = \[/,
  'Signup should not keep a hardcoded common-password blocklist.',
);

console.log('[PASS] Password rules frontend dedup guard passed.');
