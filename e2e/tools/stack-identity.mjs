import crypto from 'node:crypto';
import fs from 'node:fs';

export function releaseIdentity(jarPath) {
  if (!jarPath) return {};
  const realPath = fs.realpathSync(jarPath);
  return { jarPath: realPath, jarSha256: crypto.createHash('sha256').update(fs.readFileSync(realPath)).digest('hex') };
}

/** A healthy process is insufficient evidence that a packaged-release test is running the requested build. */
export function assertReleaseStackIdentity(state, requestedJar, baseUrl) {
  if (!requestedJar) return;
  const expected = releaseIdentity(requestedJar);
  if (state?.baseUrl !== baseUrl || state?.jarPath !== expected.jarPath || state?.jarSha256 !== expected.jarSha256) {
    throw new Error('Running test stack does not match E2E_BACKEND_JAR path, SHA-256 and base URL. Stop the named test stack and restart it with the requested release.');
  }
}
