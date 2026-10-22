import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readDashboardSources } from '../readDashboardSources.mjs';

export const dashboard = readDashboardSources();
export const css = readFileSync(new URL('../../../styles/admin-reference.css', import.meta.url), 'utf8');
assert.match(dashboard, /import ['"]\.\.\/\.\.\/styles\/admin-reference\.css['"]/,
  'Contracts must inspect the reference stylesheet actually imported by the dashboard.');

export function adminModule(name) {
  const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  assert.ok(dashboard.includes(source), `${name} must remain reachable from the dashboard entry.`);
  return source;
}

export function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  assert.ok(body, `Active reference styles must define ${selector}.`);
  return body;
}
