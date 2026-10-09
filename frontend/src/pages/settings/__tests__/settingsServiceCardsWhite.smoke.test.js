import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const styles = readFileSync(new URL('../../../styles/settings-v2.css', import.meta.url), 'utf8');
assert.match(styles, /\.settings-atlas-canvas\.st-v2\s*\{[^}]*--sv-card:\s*#fff/, 'Grouped rows should have a white light-theme surface.');
assert.match(styles, /body:is\(\.theme-midnight, \.theme-high-contrast\)[^}]*--sv-card:/, 'Dark mode should keep its own surfaces.');
assert.match(styles, /\.st-v2-card\s*\{[^}]*background:\s*var\(--sv-card\) !important;[^}]*background-image:\s*none !important;[^}]*box-shadow:\s*none !important/, 'Cards should match the plain grouped surfaces in the reference.');
assert.match(styles, /\.st-v2-sync li :is\(span, strong\)\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/, 'Sync health values should wrap within their own columns.');
console.log('[PASS] Settings grouped surfaces passed.');