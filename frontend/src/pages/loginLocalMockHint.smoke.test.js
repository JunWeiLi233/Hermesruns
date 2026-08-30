import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const loginSource = readFileSync(path.join(here, 'Login.jsx'), 'utf8');
const zhPagesSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/pages.js'), 'utf8');
const enPagesSource = readFileSync(path.join(here, '../i18n/locales/en/pages.js'), 'utf8');

assert.doesNotMatch(
  loginSource,
  /LOCAL_SHARED_RUNNER_EMAIL|isLocalSharedRunnerEmail|local_mock_password_hint/,
  'Login should not expose a local shared-runner password hint.',
);

assert.doesNotMatch(
  zhPagesSource,
  /local_mock_password_hint|HermesDev2026!/,
  'Chinese login copy should not disclose the local mock password.',
);

assert.doesNotMatch(
  enPagesSource,
  /local_mock_password_hint|HermesDev2026!/,
  'English login copy should not disclose the local mock password.',
);

console.log('[PASS] Login local mock password hint is removed.');
