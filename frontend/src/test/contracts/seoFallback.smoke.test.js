import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// No-JavaScript content is rendered from the exact components used in the app.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const server = await createServer({ root, configFile: false, plugins: [react()], appType: 'custom',
  logLevel: 'error', server: { middlewareMode: true, watch: null, hmr: false } });
try {
  const { renderPublicPage } = await server.ssrLoadModule('/src/publicPageEntry.jsx');
  const home = renderPublicPage('/');
  assert.match(home.content, /<h1[^>]*>Run the race you trained for[.]/);
  assert.ok(home.content.includes(home.metadata.description));
  assert.match(home.content, /Read the formulas/);
  assert.match(home.content, /How HermesRuns works/);
  assert.match(home.content, /Race-equation VDOT/);
  assert.match(home.content, /38\.3/);
  assert.match(home.content, /How much running history do I need/);
  assert.doesNotMatch(home.content, /Export everything|injury risk is low/);
  assert.ok(home.content.includes('>Methods</a>'));
  assert.doesNotMatch(home.content, /hermes-seo-fallback/);
  for (const route of ['/terms', '/privacy']) {
    const page = renderPublicPage(route);
    assert.equal(page.metadata.canonicalUrl, 'https://hermesruns.com' + route);
    assert.match(page.content, /id="legal-document-title"/);
    assert.match(page.content, /October 17, 2026/);
    assert.equal(page.metadata.structuredData.dateModified, '2026-10-17');
    assert.ok(!page.content.includes('Run the race you trained for.'));
  }
  assert.throws(() => renderPublicPage('/profile'), /Not a public page/);
} finally {
  await server.close();
}
console.log('[PASS] Public no-JavaScript content uses the actual route components.');
