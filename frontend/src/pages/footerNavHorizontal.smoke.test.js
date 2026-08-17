import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const authStyles = fs.readFileSync(path.join(here, '../styles/_split/auth.css'), 'utf8');

test('public auth footer links stay in one horizontal row', () => {
  assert.match(
    authStyles,
    /\.auth-flow-legal\s*>\s*\.global-footer-links\s*\{[^}]*flex:\s*0\s+0\s+auto;[^}]*flex-wrap:\s*nowrap;/s,
  );
});
