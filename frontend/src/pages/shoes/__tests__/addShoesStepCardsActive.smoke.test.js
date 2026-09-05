import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../AddShoes.jsx"), 'utf8');
const styles = readFileSync(path.join(here, "../../../styles/add-shoes-profile-alignment.css"), 'utf8');

const stepCards = source.match(/<section className="[^"]*add-shoes-step-card[^"]*">/g) || [];
assert.equal(stepCards.length, 3, 'Add Shoes should render exactly three independent step cards.');
assert.doesNotMatch(source, /add-shoes-setup-panel/, 'Step 3 should not remain inside a setup aside wrapper.');
assert.doesNotMatch(source, /add-shoes-browser-panel add-shoes-stage/, 'Steps 1 and 2 should not remain inside a shared stage card.');
assert.match(
  styles,
  /\.add-shoes-catalog-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?gap:\s*24px;/,
  'The Add Shoes workspace should use one full-width column with a consistent card gap.',
);
assert.match(
  styles,
  /\.add-shoes-browser-panel\.add-shoes-stage\s*\{[\s\S]*?display:\s*contents;/,
  'The legacy stage hook should not paint a containing card.',
);
assert.doesNotMatch(
  styles,
  /\.add-shoes-catalog-step\s*\+\s*\.add-shoes-catalog-step\s*\{[\s\S]*?border-top:/,
  'Independent step cards should not retain the shared-stage divider.',
);

console.log('[PASS] Active Add Shoes checkout renders three independent step cards.');
