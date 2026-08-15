import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexStyleSource = readFileSync(path.join(here, '../index.css'), 'utf8');

assert.match(
  indexStyleSource,
  /\.leaflet-container img\.leaflet-tile\s*\{(?=[^}]*mix-blend-mode:\s*normal\s*!important;)(?=[^}]*width:\s*257px\s*!important;)(?=[^}]*height:\s*257px\s*!important;)[^}]*\}/,
  'Leaflet tiles should use normal compositing and a one-pixel overlap so fractional tile boundaries cannot show white seams.',
);

console.log('[PASS] Leaflet tile seam guardrails passed.');
