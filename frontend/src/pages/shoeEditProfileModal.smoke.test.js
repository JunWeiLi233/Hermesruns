import assert from 'node:assert/strict';
import fs from 'node:fs';

const shoesSource = fs.readFileSync(new URL('./Shoes.jsx', import.meta.url), 'utf8');
const shoesStyles = fs.readFileSync(new URL('../styles/_split/shoes.css', import.meta.url), 'utf8');

assert.match(
  shoesSource,
  /shellClassName="shoe-edit-modal-shell"[\s\S]*cardClassName="shoe-edit-modal-card"/,
  'The shoe editor should opt into a scoped profile-style modal shell.',
);
assert.match(
  shoesSource,
  /className="shoe-edit-modal-form"[\s\S]*className="shoe-edit-modal-grid"/,
  'The shoe editor should use a bounded responsive form layout.',
);
assert.match(
  shoesSource,
  /className="shoe-edit-modal-primary-toggle"[\s\S]*className="shoe-edit-modal-toggle-control"/,
  'The primary-shoe choice should use the profile-style toggle treatment.',
);
assert.match(
  shoesSource,
  /className="modal-actions shoe-edit-modal-actions"/,
  'The shoe editor should use a dedicated balanced action footer.',
);

assert.match(
  shoesStyles,
  /\.shoe-edit-modal-shell\s*\{[\s\S]*backdrop-filter:\s*blur\(20px\) saturate\(120%\)/,
  'The edit modal should use the Profile page warm blurred overlay.',
);
assert.match(
  shoesStyles,
  /\.modal-card\.shoe-edit-modal-card\s*\{[\s\S]*width:\s*min\(720px,[\s\S]*max-width:\s*720px[\s\S]*border-radius:\s*clamp\(24px,[\s\S]*var\(--runner-profile-card-strong/,
  'The edit modal card should override the legacy width cap and use the Profile page sheet geometry.',
);
assert.match(
  shoesStyles,
  /\.shoe-edit-modal-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  'The edit form should pair fields in two columns on wide screens.',
);
assert.match(
  shoesStyles,
  /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.shoe-edit-modal-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/,
  'The edit form should collapse to one column on small screens.',
);
assert.match(
  shoesStyles,
  /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.shoe-edit-modal-card/,
  'The edit modal should preserve reduced-motion behavior.',
);

console.log('[PASS] Shoe edit profile-modal guardrails passed.');
