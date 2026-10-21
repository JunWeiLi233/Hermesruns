import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { releaseIdentity, assertReleaseStackIdentity } from '../e2e/tools/stack-identity.mjs';

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-stack-identity-'));
try {
  const jar = path.join(fixture, 'backend.jar');
  fs.writeFileSync(jar, 'release one');
  const baseUrl = 'http://127.0.0.1:18086';
  const recorded = { baseUrl, ...releaseIdentity(jar) };
  assert.doesNotThrow(() => assertReleaseStackIdentity(recorded, jar, baseUrl));
  assert.throws(() => assertReleaseStackIdentity({ baseUrl }, jar, baseUrl), /does not match/);
  assert.throws(() => assertReleaseStackIdentity(recorded, jar, 'http://127.0.0.1:18087'), /does not match/);
  fs.writeFileSync(jar, 'release two');
  assert.throws(() => assertReleaseStackIdentity(recorded, jar, baseUrl), /does not match/);
  assert.doesNotThrow(() => assertReleaseStackIdentity(null, undefined, baseUrl));
  console.log('PASS packaged-release tests reject missing, stale and mismatched stack identity');
} finally { fs.rmSync(fixture, { recursive: true, force: true }); }
