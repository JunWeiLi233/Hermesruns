import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const visited = new Set();

function visitLocalImports(moduleUrl) {
  const pathname = fileURLToPath(moduleUrl).replaceAll('\\', '/');
  if (visited.has(pathname)) return;
  visited.add(pathname);
  const source = fs.readFileSync(moduleUrl, 'utf8');
  const imports = source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"]+)\1/g);
  for (const [, , specifier] of imports) {
    if (specifier.startsWith('.')) visitLocalImports(new URL(specifier, moduleUrl));
  }
}

visitLocalImports(new URL('./publicTranslationRuntime.js', import.meta.url));
visitLocalImports(new URL('../contexts/I18nProviderBase.jsx', import.meta.url));
visitLocalImports(new URL('../contexts/i18nContextState.js', import.meta.url));

for (const pathname of visited) {
  assert.doesNotMatch(pathname, /\/(?:translationRuntime|translations|I18nContext)\.(?:js|jsx)$/,
    `Public translations must not import the private runtime: ${pathname}`);
  if (pathname.includes('/i18n/locales/')) {
    assert.match(pathname, /\/locales\/(?:en|zh-CN)\/publicLanding\.js$/,
      `Public translations must only import the public landing subset: ${pathname}`);
  }
}
assert.ok([...visited].some((pathname) => pathname.endsWith('/locales/en/publicLanding.js')));
assert.ok([...visited].some((pathname) => pathname.endsWith('/locales/zh-CN/publicLanding.js')));

const requiredKeys = new Set();
for (const sourcePath of [
  '../pages/landing/Landing.jsx',
  '../pages/landing/LandingMethods.jsx',
  '../pages/landing/landingV3Content.js',
  '../pages/legal/LegalPage.jsx',
]) {
  const source = fs.readFileSync(new URL(sourcePath, import.meta.url), 'utf8');
  for (const [, key] of source.matchAll(/['"]landing\.([a-zA-Z_0-9]+)['"]/g)) requiredKeys.add(key);
}
assert.ok(requiredKeys.size > 100, 'Public consumer key discovery should include landing content and legal footer copy.');
const runtime = await import('./publicTranslationRuntime.js');
await runtime.ensureLocaleMessages('zh-CN');
for (const language of ['en', 'zh-CN']) {
  const messages = runtime.getLoadedMessages(language).landing;
  for (const key of requiredKeys) {
    assert.equal(typeof messages[key], 'string', `Public ${language} dictionary is missing consumer key landing.${key}`);
  }
}
console.log('[PASS] Public i18n runtime and provider depend only on public landing subsets.');
