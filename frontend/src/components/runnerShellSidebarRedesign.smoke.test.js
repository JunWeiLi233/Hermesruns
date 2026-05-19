import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  styleSource,
  /--runner-nav-expanded-width:\s*clamp\(156px,\s*9\.2vw,\s*178px\)/,
  'Runner sidebar should define a wider readable desktop rail instead of falling back to the cramped 112px profile rail.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-shell-side-nav\s*\{[\s\S]*counter-reset:\s*runner-nav-item;/,
  'Runner sidebar should reset a nav counter for the numbered command rail treatment.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-shell-side-link::before\s*\{[\s\S]*counter\(runner-nav-item,\s*decimal-leading-zero\)/,
  'Runner sidebar links should render stable two-digit route numbers without extra JSX.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-shell-side-link\.is-active::after\s*\{[\s\S]*width:\s*3px;/,
  'Active runner sidebar links should keep a visible rail marker.',
);

assert.match(
  styleSource,
  /body\.theme-light \.runner-dashboard-page \.runner-shell-side-link\.is-active\s*\{[\s\S]*radial-gradient\(circle at 100% 0%, var\(--runner-nav-active-soft\)/,
  'Runner sidebar should override legacy body.theme-light active-link rules with the new active surface.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*860px\)[\s\S]*\.runner-dashboard-page \.runner-shell-side-nav\s*\{[\s\S]*grid-auto-flow:\s*column;/,
  'Small screens should turn the sidebar nav into a horizontal rail instead of a tall fixed desktop column.',
);

console.log('[PASS] Runner shell sidebar redesign guardrails passed.');
