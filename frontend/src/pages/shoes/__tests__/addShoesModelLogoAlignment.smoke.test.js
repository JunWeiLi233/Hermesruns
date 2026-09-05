import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "../../../styles/add-shoes-profile-alignment.css"), 'utf8');

assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-model-art\s*\{[^}]*justify-self:\s*center;[^}]*align-self:\s*start;/,
  'Each shoe model logo should be centered in its grid cell while staying above the labels.',
);

assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-model-art \.shoe-brand-logo-img\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;[^}]*transform:\s*translateY\(-4px\);/,
  'Raster brand marks should be visually centered inside the model-art tile instead of inheriting transparent asset whitespace.',
);

console.log('[PASS] Add Shoes model logos are centered in their grid cells.');
