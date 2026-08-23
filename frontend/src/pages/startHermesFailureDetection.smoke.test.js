import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../../start_hermes.bat', import.meta.url), 'utf8');

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

console.log('[PASS] Hermes startup failure detection guard passed.');
