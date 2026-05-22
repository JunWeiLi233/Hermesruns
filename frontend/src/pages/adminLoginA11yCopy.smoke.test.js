import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./AdminLogin.jsx', import.meta.url), 'utf8');

const requiredSnippets = [
  "apiFetch('/api/auth/admin-login'",
  "login(data.token, data.email, 'ADMIN')",
  'role="alert"',
  "t('landing.stitch_footer_terms')",
  "t('landing.stitch_footer_privacy')",
  '<LanguageSwitcher />',
];

for (const snippet of requiredSnippets) {
  assert.ok(source.includes(snippet), `Admin login source missing expected snippet: ${snippet}`);
}

const disallowedSnippets = [
  '<Link to="/terms">Terms</Link>',
  '<Link to="/privacy">Privacy</Link>',
];

for (const snippet of disallowedSnippets) {
  assert.equal(
    source.includes(snippet),
    false,
    `Admin login should not hardcode locale-sensitive link text: ${snippet}`,
  );
}

console.log('admin login a11y/copy smoke passed');
