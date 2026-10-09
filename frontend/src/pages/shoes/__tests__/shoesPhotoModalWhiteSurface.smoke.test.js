import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');
const source = read('../Shoes.jsx');
const pickerStyles = read('../../../styles/shoe-photo-picker-v2.css');

assert.match(source, /cardClassName="shoe-photo-modal-card shoe-photo-picker-card"/, 'Shoes should retain the v2 photo picker');
assert.match(pickerStyles, /\.shoe-photo-modal-card\.shoe-photo-picker-card\s*\{[^}]*--picker-surface:\s*#fff;[^}]*background:\s*var\(--picker-surface\);/, 'The light-theme picker should have a white surface');
assert.match(pickerStyles, /\.shoe-photo-picker-input\s*\{[^}]*background:\s*var\(--picker-fill\);/, 'Picker inputs should retain their contrasting fill');
assert.match(pickerStyles, /\.shoe-photo-picker-card \.modal-header h3\s*\{[^}]*color:\s*var\(--picker-ink\);/, 'Picker headings should retain readable theme colors');
assert.match(pickerStyles, /body:not\(\.theme-light\):not\(\.theme-high-contrast-light\)[\s\S]*?--picker-surface:\s*var\(--profile-night-solid/, 'Dark mode should retain its solid picker surface');

console.log('shoesPhotoModalWhiteSurface smoke test passed');
