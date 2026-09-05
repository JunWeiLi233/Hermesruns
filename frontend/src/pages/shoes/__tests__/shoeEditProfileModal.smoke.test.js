import assert from 'node:assert/strict';
import fs from 'node:fs';

const shoesSource = fs.readFileSync(new URL('../Shoes.jsx', import.meta.url), 'utf8');
const shoesStyles = fs.readFileSync(new URL('../../../styles/shoes-atelier-redesign.css', import.meta.url), 'utf8');

assert.match(
  shoesSource,
  /shellClassName="shoe-edit-modal-shell"[\s\S]*cardClassName="shoe-edit-modal-card"/,
  'The shoe editor should opt into a scoped profile-style modal shell.',
);
assert.match(
  shoesSource,
  /className="shoe-edit-modal-form"[\s\S]*className="shoe-edit-modal-fields"/,
  'The shoe editor should use a bounded responsive form layout.',
);
assert.match(
  shoesSource,
  /className="shoe-edit-primary-toggle shoe-checkbox-label"[\s\S]*className="shoe-edit-modal-toggle-control"/,
  'The primary-shoe choice should use the atelier toggle treatment.',
);
assert.match(
  shoesSource,
  /className="shoe-edit-modal-actions modal-actions"/,
  'The shoe editor should use a dedicated balanced action footer.',
);

assert.match(
  shoesStyles,
  /#root \.shoe-edit-modal-shell\s*\{[\s\S]*backdrop-filter:\s*blur\(18px\)/,
  'The edit modal should use the atelier warm blurred overlay.',
);
assert.match(
  shoesStyles,
  /#root \.shoe-edit-modal-card\s*\{[\s\S]*width:\s*min\(640px,[\s\S]*border-radius:\s*12px;[\s\S]*linear-gradient\(145deg/,
  'The edit modal card should use the bounded atelier sheet geometry and surface.',
);
assert.match(
  shoesStyles,
  /#root \.shoe-edit-modal-fields\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  'The edit form should pair fields in two columns on wide screens.',
);
assert.match(
  shoesStyles,
  /@media \(max-width:\s*760px\)\s*\{[\s\S]*#root \.shoe-edit-modal-fields,[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  'The edit form should collapse to one column on small screens.',
);
assert.match(
  shoesStyles,
  /#root \.shoe-edit-modal-actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.8fr\) minmax\(0,\s*1\.2fr\)/,
  'The edit modal should keep the primary action visually dominant on wide screens.',
);

console.log('[PASS] Shoe edit profile-modal guardrails passed.');
