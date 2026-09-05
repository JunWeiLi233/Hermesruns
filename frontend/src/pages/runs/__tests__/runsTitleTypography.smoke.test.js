import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8');
const runsStyleSource = readFileSync(path.join(here, "../../../styles/_split/runs.css"), 'utf8');

assert.match(
  runsSource,
  /<h1 id="runs-profile-title">\{t\('runs\.heading'\)\}<\/h1>/,
  'The Runs history page should keep its localized history title element.',
);

assert.match(
  runsStyleSource,
  /\.runs-dashboard-page \.runs-profile-cockpit h1\s*\{[^}]*font-style:\s*normal;/,
  'The Runs history title should explicitly render without italics.',
);

console.log('[PASS] Runs history title typography guardrails passed.');
