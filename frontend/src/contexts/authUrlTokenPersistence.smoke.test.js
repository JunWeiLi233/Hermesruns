import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'AuthContext.jsx'), 'utf8');

assert.match(
  source,
  /function persistIncomingAuth\(incomingAuth\)/,
  'AuthProvider should expose a synchronous URL-token persistence helper.',
);

assert.match(
  source,
  /localStorage\.setItem\('hermes_jwt', incomingAuth\.token\);/,
  'AuthProvider should write an incoming URL token to localStorage before child page effects call apiJson.',
);

assert.match(
  source,
  /const incomingAuth = readAuthFromUrl\(\);\s*persistIncomingAuth\(incomingAuth\);\s*const initialToken/s,
  'AuthProvider should persist URL auth before deriving initialToken and before route data loaders run.',
);

console.log('[PASS] Auth URL token persistence guard passed.');
