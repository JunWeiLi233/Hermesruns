import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const loginSource = readFileSync(path.join(here, 'Login.jsx'), 'utf8');
const signupSource = readFileSync(path.join(here, 'Signup.jsx'), 'utf8');
const authStyleSource = readFileSync(path.join(here, '../styles/_split/auth.css'), 'utf8');
const redesignSection = authStyleSource.split('/* Auth command entry redesign */')[1] || '';

assert.match(
  loginSource,
  /className="auth-page auth-page--login[^"]*" data-auth-redesign="command-entry"/,
  'Login should expose the shared auth command-entry redesign marker.',
);

assert.equal(
  (signupSource.match(/data-auth-redesign="command-entry"/g) || []).length,
  2,
  'Signup should expose the redesign marker on both normal and post-signup states.',
);

assert.ok(
  redesignSection.includes('.auth-page[data-auth-redesign="command-entry"]'),
  'Auth split stylesheet should define a route-scoped command-entry redesign layer.',
);

assert.ok(
  redesignSection.includes('overflow-y: auto;'),
  'Auth redesign should allow vertical scrolling for long signup/error states.',
);

assert.ok(
  redesignSection.includes('.auth-flow-formside::before') && redesignSection.includes('display: none;'),
  'Auth redesign should remove the old cream panel pseudo-layer.',
);

assert.ok(
  redesignSection.includes(':focus-visible'),
  'Auth redesign should preserve visible keyboard focus states.',
);

assert.ok(
  redesignSection.includes('.pwd-strength-card'),
  'Auth redesign should restyle the signup password strength panel.',
);

assert.match(
  redesignSection,
  /\.auth-page\[data-auth-redesign="command-entry"\] \.error-alert\s*\{[\s\S]*display:\s*grid;[\s\S]*overflow-wrap:\s*anywhere;[\s\S]*max-height:[^;]+;[\s\S]*overflow:\s*auto;/,
  'Auth error alerts should safely contain long backend messages without breaking the command-entry layout.',
);

assert.match(
  redesignSection,
  /\.auth-page\[data-auth-redesign="command-entry"\] \.error-alert::before\s*\{[\s\S]*content:\s*["']!["'];/,
  'Auth error alerts should expose a compact visual warning marker.',
);

assert.match(
  redesignSection,
  /\.auth-page\[data-auth-redesign="command-entry"\] \.error-alert--success\s*\{[\s\S]*display:\s*block;[\s\S]*border-left-color:/,
  'Success notices should keep a distinct, non-warning treatment from error alerts.',
);

assert.doesNotMatch(
  redesignSection,
  /font-size:\s*clamp\(/,
  'New auth redesign layer should use fixed type steps with breakpoint overrides, not viewport-scaled font sizes.',
);

console.log('[PASS] Auth command entry redesign guardrails passed.');
