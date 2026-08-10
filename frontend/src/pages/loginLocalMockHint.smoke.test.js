import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const loginSource = readFileSync(path.join(here, 'Login.jsx'), 'utf8');
const authStyleSource = readFileSync(path.join(here, '../styles/_split/auth.css'), 'utf8');
const zhPagesSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/pages.js'), 'utf8');
const enPagesSource = readFileSync(path.join(here, '../i18n/locales/en/pages.js'), 'utf8');

assert.match(
  loginSource,
  /LOCAL_SHARED_RUNNER_EMAIL\s*=\s*'strava\+140971747@hermes\.local'/,
  'Login should identify the local shared runner account explicitly.',
);

assert.match(
  loginSource,
  /local_mock_password_hint/,
  'Login should show a local mock password hint for the shared runner account.',
);

assert.match(
  authStyleSource,
  /\.auth-flow-field-note\s*\{/,
  'Login local mock hint should have a styled field note.',
);

assert.match(
  zhPagesSource,
  /HermesDev2026!/,
  'Chinese login copy should state the current local mock password.',
);

assert.match(
  enPagesSource,
  /HermesDev2026!/,
  'English login copy should state the current local mock password.',
);

console.log('[PASS] Login local mock hint guardrails passed.');
