import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, '../LegalPage.jsx'), 'utf8');
const css = readFileSync(join(here, '../legal-document.css'), 'utf8');

// Terms and Privacy share a reading layout and theme-aware wordmark.
assert.ok(pageSource.includes('dictionary[variant] || dictionary.terms'));
assert.ok(pageSource.includes('<HermesLogo showIcon={false} />'));
assert.ok(pageSource.includes("isAuthenticated ? '/profile' : '/'"));
assert.ok(pageSource.includes("lang === 'zh-CN'"));
assert.ok(pageSource.includes('renderLegalBody(section.body)'));
assert.ok(pageSource.includes('<a href={SUPPORT_MAILTO}>'));
for (const name of ['main', 'section', 'footer']) {
  assert.ok(pageSource.includes(`legal-document-${name}`));
}
assert.equal((pageSource.match(/<main /g) || []).length, 1);
assert.ok(!/AuthDotField|privacy-hero-panel|privacy-signal-strip|auth-page--liquid-glass/.test(pageSource));
assert.ok(css.includes('max-width: 680px'));
assert.ok(css.includes('min-height: 100dvh'));
assert.ok(css.includes('body.theme-midnight .legal-document'));
assert.ok(css.includes('a:focus-visible'));
assert.ok(css.includes("a[aria-current='page']"));
console.log('[PASS] Shared legal document layout guard passed.');
