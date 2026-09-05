import fs from 'node:fs';
import assert from 'node:assert/strict';

const supportUrl = new URL('../../utils/supportContact.js', import.meta.url);
const supportSource = fs.existsSync(supportUrl) ? fs.readFileSync(supportUrl, 'utf8') : '';
const footerSource = fs.readFileSync(new URL('../../components/FooterNavLinks.jsx', import.meta.url), 'utf8');
const landingSource = fs.readFileSync(new URL('../../pages/landing/Landing.jsx', import.meta.url), 'utf8');
const legalSource = fs.readFileSync(new URL('../../pages/legal/LegalPage.jsx', import.meta.url), 'utf8');
const legalStylesSource = fs.readFileSync(new URL('../../styles/_split/misc.css', import.meta.url), 'utf8');

function collectFrontendSource(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) return collectFrontendSource(entryUrl);
    if (!/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) return [];
    return fs.readFileSync(entryUrl, 'utf8');
  });
}

const allFrontendSource = collectFrontendSource(new URL('../../', import.meta.url)).join('\n');

assert.match(
  supportSource,
  /export const SUPPORT_EMAIL = 'support@hermesruns\.com';/,
  'Customer support should use the licensed hermesruns.com mailbox.',
);
assert.match(
  supportSource,
  /export const SUPPORT_MAILTO = `mailto:\$\{SUPPORT_EMAIL\}`;/,
  'Customer support links should share one canonical mailto destination.',
);
assert.match(
  footerSource,
  /import \{ SUPPORT_MAILTO \} from '\.\.\/utils\/supportContact(?:\.js)?';/,
  'The shared footer should import its destination from the canonical support utility.',
);
assert.match(
  footerSource,
  /href=\{SUPPORT_MAILTO\}/,
  'The shared footer support entry should open the customer-support mailbox.',
);
assert.match(
  landingSource,
  /import \{ SUPPORT_MAILTO \} from '\.\.\/\.\.\/utils\/supportContact(?:\.js)?';/,
  'The landing page should import its destination from the canonical support utility.',
);
assert.match(
  landingSource,
  /href: SUPPORT_MAILTO/,
  'The standalone landing footer support entry should use the canonical mailbox.',
);
assert.match(
  legalSource,
  /import \{ SUPPORT_EMAIL, SUPPORT_MAILTO \} from '\.\.\/\.\.\/utils\/supportContact(?:\.js)?';/,
  'The legal page should import both support values from the canonical utility.',
);
assert.equal(
  (legalSource.match(/\$\{SUPPORT_EMAIL\}/g) ?? []).length,
  4,
  'English and Chinese Terms and Privacy copy should all retain the canonical support address.',
);
assert.match(
  legalSource,
  /<a href=\{SUPPORT_MAILTO\}>\{SUPPORT_EMAIL\}<\/a>/,
  'Legal customer-service references should be actionable email links.',
);
assert.equal(
  allFrontendSource.toLowerCase().includes(['support', 'hermes.run'].join('@')),
  false,
  'Customer-facing support surfaces must not retain the retired hermes.run mailbox.',
);
assert.match(
  legalStylesSource,
  /\.legal-page-row-copy a\s*\{[^}]*text-decoration:\s*underline;/s,
  'Legal support links should be visibly distinguishable from surrounding paragraph text.',
);
assert.match(
  legalStylesSource,
  /\.legal-page-row-copy a:focus-visible\s*\{[^}]*outline:/s,
  'Legal support links should expose a visible keyboard-focus treatment.',
);

console.log('customer support contact smoke passed');
