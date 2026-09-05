import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../../../start_hermes.bat', import.meta.url), 'utf8');
const backendLauncherSource = readFileSync(
  new URL('../../../../tools/run-backend.cmd', import.meta.url),
  'utf8',
);

const adminSecurityEnvironmentVariables = [
  'HERMES_ADMIN_MFA_ENABLED',
  'HERMES_WEBAUTHN_RP_ID',
  'HERMES_WEBAUTHN_RP_NAME',
  'HERMES_WEBAUTHN_ALLOWED_ORIGINS',
  'HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN',
  'HERMES_ADMIN_ACCESS_ENABLED',
  'HERMES_ADMIN_ACCESS_TEAM_DOMAIN',
  'HERMES_ADMIN_ACCESS_AUDIENCE',
  'HERMES_ADMIN_ACCESS_ALLOWED_EMAILS',
];

assert.match(
  source,
  /findstr \/C:"Application run failed" \/C:"BUILD FAILURE" \/C:"DataIntegrityViolationException"/,
  'The Hermes launcher should recognize a Spring Boot process that failed before binding port 8080.',
);
assert.match(
  source,
  /Spring Boot exited before binding localhost:8080/,
  'The Hermes launcher should report the backend failure instead of silently polling until timeout.',
);

for (const variable of adminSecurityEnvironmentVariables) {
  assert.ok(
    source.includes(`'${variable}'`) && source.includes(`if defined ${variable}`),
    `start_hermes.bat must load and forward ${variable} to the backend process.`,
  );
  assert.ok(
    backendLauncherSource.includes(`'${variable}'`),
    `tools/run-backend.cmd must load ${variable} when it is invoked directly.`,
  );
}

console.log('[PASS] Hermes startup failure detection guard passed.');
