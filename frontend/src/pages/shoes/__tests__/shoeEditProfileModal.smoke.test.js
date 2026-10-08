import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../Shoes.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../../../styles/shoe-edit-modal-v2.css', import.meta.url), 'utf8');
assert.match(source, /shellClassName="shoe-edit-modal-shell edit-v2-shell"[\s\S]*cardClassName="shoe-edit-modal-card edit-v2-card"/, 'The editor should opt into its scoped v2 modal styles.');
assert.match(source, /className="shoe-edit-modal-form edit-v2"[\s\S]*className="edit-v2-row"/, 'The editor should retain its responsive form.');
assert.match(source, /type="checkbox" role="switch"[\s\S]*className="edit-v2-switch"/, 'The primary control should remain an accessible checkbox switch.');
assert.match(source, /className="edit-v2-footer"/, 'The editor should retain its action footer.');
assert.match(styles, /\.modal-card\.edit-v2-card\s*\{[^}]*width:\s*min\(480px,[^}]*max-height:\s*calc\(100dvh - 32px\)/, 'The card should fit its viewport.');
assert.match(styles, /\.edit-v2-card \.modal-form\s*\{[^}]*overflow-y:\s*auto/, 'Short viewports should scroll the form.');
assert.match(styles, /\.edit-v2-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1\.4fr\)/, 'Wide forms should pair brand and model.');
assert.match(styles, /@media \(max-width: 440px\)[\s\S]*\.edit-v2-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, 'Phone forms should stack brand and model.');
console.log('[PASS] Shoe edit modal v2 guardrails passed.');
