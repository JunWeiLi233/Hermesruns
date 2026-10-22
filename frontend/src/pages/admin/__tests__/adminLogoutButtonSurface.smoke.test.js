import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readDashboardSources } from '../readDashboardSources.mjs';

// The dedicated admin console owns these controls after the reference redesign.
const source = readDashboardSources();
const styles = readFileSync(new URL('../../../styles/admin-reference.css', import.meta.url), 'utf8');
for (const marker of [
  "admin-ref-session",
  "onClick={logout}",
  "admin.console.sign_out"
]) assert.ok(source.includes(marker), `Admin console must retain ${marker}`);
assert.match(styles, /\.admin-reference \.admin-ref-button\s*\{[^}]*border-radius:\s*999px/s);
assert.match(source, /onClick=\{(?:\(\) => )?logout\(?\)?\}/);
