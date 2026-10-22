import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const stylesDir = path.join(here, '../styles');
const read = (file) => readFileSync(path.join(stylesDir, file), 'utf8');
const sharedStyleSource = read('_split/shared.css') + read('brand.css');

function activeStyleFiles(dir = stylesDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return activeStyleFiles(full);
    // style.css is the frozen legacy bundle and style.generated.css is built from the active files.
    if (!entry.name.endsWith('.css') || entry.name === 'style.css' || entry.name === 'style.generated.css') return [];
    return [full];
  });
}

// hermes:runs logo kit (2026): ink #1a1714, coral #ff5a3c, paper #f5f1ea.
assert.match(sharedStyleSource, /--hermes-logo-ink:\s*#1a1714;/, 'The logo ink must be the kit ink.');
assert.match(sharedStyleSource, /--hermes-logo-paper:\s*#f5f1ea;/, 'The logo paper must be the kit paper.');

// Lockup proportions of the kit's lockup.svg: tile 96, logotype 42.7 tall (0.4448), gap 22 (0.2292).
assert.match(
  sharedStyleSource,
  /\.hermes-logo\s*\{[^}]*--hermes-logo-tile:[^;]+;[^}]*gap:\s*calc\(var\(--hermes-logo-tile\)\s*\*\s*0\.2292\);/,
  'The lockup gap must stay 22/96 of the tile.',
);
assert.match(
  sharedStyleSource,
  /\.hermes-logo__icon\s*\{[^}]*width:\s*var\(--hermes-logo-tile\);[^}]*height:\s*var\(--hermes-logo-tile\);/,
  'The lockup symbol must be exactly the tile size.',
);
assert.match(
  sharedStyleSource,
  /\.hermes-logo__word\s*\{[^}]*height:\s*calc\(var\(--hermes-logo-tile\)\s*\*\s*0\.4448\);/,
  'The lockup logotype must stay 42.7/96 of the tile.',
);

// tone="auto" (the HermesLogo default) turns paper under the midnight theme; tone="dark" is always paper.
assert.match(
  sharedStyleSource,
  /\.hermes-logo--dark \.hermes-logo__word,\s*body\.theme-midnight \.hermes-logo--auto \.hermes-logo__word\s*\{[^}]*color:\s*var\(--hermes-logo-paper\);/,
  'Logotype letters must be paper on dark surfaces.',
);
assert.match(
  sharedStyleSource,
  /body\.theme-midnight \.hermes-mark--auto \.hermes-mark__tile\s*\{[^}]*fill:\s*var\(--hermes-logo-paper\);/,
  'The auto symbol must get a paper tile under the midnight theme.',
);
assert.match(
  sharedStyleSource,
  /body\.theme-midnight \.hermes-mark--auto \.hermes-mark__letter\s*\{[^}]*stroke:\s*var\(--hermes-logo-ink\);/,
  'The auto symbol must get an ink h under the midnight theme.',
);

// The colon is coral in the drawing itself, so nothing may read the retired "runs" accent variable (a stylesheet that
// still sets it is harmless) or target the retired default tone class.
for (const file of activeStyleFiles()) {
  const source = readFileSync(file, 'utf8');
  const name = path.relative(stylesDir, file).split(path.sep).join('/');
  assert.doesNotMatch(source, /var\(\s*--hermes-logo-accent/, `${name} must not read the retired --hermes-logo-accent.`);
  assert.doesNotMatch(source, /hermes-logo--light/, `${name} must not target the retired default tone class.`);
}

console.log('[PASS] HermesRuns logo styles keep the hermes:runs kit colours and lockup proportions.');
