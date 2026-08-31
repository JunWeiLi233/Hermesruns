import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const addShoesSource = readFileSync(path.join(here, 'AddShoes.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/add-shoes-profile-alignment.css'), 'utf8');
const legacyStyleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

const stepCardSections = addShoesSource.match(/<section className="[^"]*add-shoes-step-card[^"]*">/g) || [];
assert.equal(
  stepCardSections.length,
  3,
  'Add Shoes should render exactly three independent step cards.',
);
assert.match(
  addShoesSource,
  /<section className="add-shoes-catalog-step add-shoes-step-card">/,
  'Add Shoes Step 1 should be its own card.',
);
assert.match(
  addShoesSource,
  /<section className="add-shoes-catalog-step add-shoes-model-board add-shoes-step-card">/,
  'Add Shoes Step 2 should be its own card.',
);
assert.match(
  addShoesSource,
  /<section className="add-shoes-step add-shoes-step--form add-shoes-step-card add-shoes-setup-payload">/,
  'Add Shoes Step 3 should be its own card.',
);
assert.doesNotMatch(
  addShoesSource,
  /add-shoes-setup-panel/,
  'Add Shoes should not keep a separate setup aside around Step 3.',
);
assert.doesNotMatch(
  addShoesSource,
  /add-shoes-browser-panel add-shoes-stage/,
  'Add Shoes should not keep a shared card around Steps 1 and 2.',
);
assert.doesNotMatch(
  addShoesSource,
  /add-shoes-stage-head/,
  'Add Shoes should not render the redundant stage-head intro above the step cards.',
);
assert.match(
  styleSource,
  /\.add-shoes-workspace-heading\s*\{\s*display:\s*none\s*!important;/,
  'Add Shoes should hide the removed workspace heading from legacy route chunks.',
);
assert.match(
  styleSource,
  /\.add-shoes-stage-head\s*\{[\s\S]*?display:\s*flex;/,
  'Add Shoes stage-head intro should lay out as a flex row.',
);
assert.match(
  styleSource,
  /\.add-shoes-catalog-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?gap:\s*24px;/,
  'Add Shoes workspace should use a single full-width column.',
);
assert.match(
  styleSource,
  /\.add-shoes-step-card\s*\{[\s\S]*?border:\s*1px solid var\(--profile-line\);[\s\S]*?background:/,
  'Add Shoes step cards should paint as independent bordered cards.',
);
assert.match(
  styleSource,
  /\.add-shoes-catalog-step:not\(\.add-shoes-model-board\)\s*\{\s*background:\s*#fff !important;\s*background-image:\s*none !important;/,
  'Add Shoes catalog step cards should use a solid white surface.',
);
const legacyAddShoesStepRule = legacyStyleSource.match(
  /\.hermes-site-frame\[data-gpt-taste-system="gpt-taste"\]\[data-runner-design="profile-aligned"\]:is\(\[data-route-path="\/shoes\/add"\], \[data-route-path="\/add-shoes"\]\) \.add-shoes-parent-rail,[\s\S]*?\.add-shoes-step-card\s*\{[\s\S]*?\n\}/,
);
assert.ok(legacyAddShoesStepRule, 'Legacy Add Shoes step-card override should exist.');
assert.match(
  legacyAddShoesStepRule[0],
  /background-color:\s*#fff\s*!important;[\s\S]*?background-image:\s*none\s*!important;/,
  'Legacy Add Shoes step-card override should use a solid white background.',
);
const legacySetupGridRule = legacyStyleSource.match(
  /\.hermes-site-frame\[data-gpt-taste-system="gpt-taste"\]\[data-runner-design="profile-aligned"\]:is\(\[data-route-path="\/shoes\/add"\], \[data-route-path="\/add-shoes"\]\) \.add-shoes-setup-payload-shell\s*\{[\s\S]*?\n\}/,
);
assert.ok(legacySetupGridRule, 'Legacy Add Shoes setup grid override should exist.');
assert.match(
  legacySetupGridRule[0],
  /background-color:\s*#fff\s*!important;[\s\S]*?background-image:\s*none\s*!important;/,
  'Legacy Add Shoes setup grid should use a solid white background.',
);
const legacyFinalSurfaceRule = legacyStyleSource.match(
  /#root \.add-shoes-profile-redesign :is\(\.add-shoes-catalog-step, \.add-shoes-step-card, \.add-shoes-setup-payload-shell\)\s*\{[\s\S]*?\n\}/,
);
assert.ok(legacyFinalSurfaceRule, 'Final legacy Add Shoes surface authority should exist.');
assert.match(
  legacyFinalSurfaceRule[0],
  /background-color:\s*#fff\s*!important;[\s\S]*?background-image:\s*none\s*!important;/,
  'Final legacy Add Shoes surfaces should stay solid white.',
);
assert.match(
  styleSource,
  /\.add-shoes-browser-panel\.add-shoes-stage\s*\{[\s\S]*?display:\s*contents;/,
  'Add Shoes shared stage hook should not paint a containing card.',
);
assert.doesNotMatch(
  styleSource,
  /\.add-shoes-catalog-step\s*\+\s*\.add-shoes-catalog-step\s*\{[\s\S]*?border-top:/,
  'Add Shoes step cards should not use the old shared-stage divider.',
);

console.log('[PASS] Add Shoes step card layout guardrails passed.');
