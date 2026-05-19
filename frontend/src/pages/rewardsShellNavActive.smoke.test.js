import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'Rewards.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '..', 'styles', 'style.css'), 'utf8');

assert.match(
  pageSource,
  /getRunnerShellNavItems\(\{\s*t,\s*lang,\s*activeKey:\s*'rewards',\s*\}\)/s,
  'Rewards should mark the shared runner-shell Rewards nav item active instead of adding a duplicate route-local nav button.',
);

assert.doesNotMatch(
  pageSource,
  /className="runner-shell-side-link is-active"[\s\S]{0,240}navigate\('\/rewards'\)/,
  'Rewards should not append a second active Rewards button after the shared nav items.',
);

assert.doesNotMatch(
  pageSource,
  /item\.route === '\/profile' && false/,
  'Rewards nav className should not keep a dead false expression.',
);

assert.match(
  pageSource,
  /runner-dashboard-page rewards-command-page/,
  'Rewards should carry the redesigned command-board route class.',
);

assert.match(
  pageSource,
  /runner-shell-canvas rewards-command-canvas/,
  'Rewards should use a route-scoped command canvas instead of the generic shell canvas only.',
);

assert.match(
  pageSource,
  /className="rewards-command-hero"[\s\S]*className="rewards-command-progress-panel"/,
  'Rewards should render an asymmetric hero with a dedicated progress panel.',
);

assert.match(
  pageSource,
  /rewards-command-grid rewards-command-grid--earned[\s\S]*rewards-command-grid rewards-command-grid--upcoming/,
  'Rewards should keep separate earned and upcoming badge grids in the redesigned surface.',
);

assert.doesNotMatch(
  pageSource,
  /rewards-editorial-/,
  'Rewards page markup should no longer use the old centered editorial classes.',
);

assert.match(
  styleSource,
  /\.rewards-command-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/,
  'Rewards command grid should use a 12-column asymmetric layout, not generic equal cards.',
);

assert.match(
  styleSource,
  /\.rewards-command-grid--earned \.rewards-command-card\.is-featured\s*\{[\s\S]*grid-column:\s*span 5;/,
  'Earned Rewards should feature a wider first card to avoid a generic equal-card row.',
);

assert.match(
  styleSource,
  /\.rewards-command-card\s*\{[\s\S]*animation-delay:\s*calc\(var\(--reward-index,\s*0\) \* 62ms\);/,
  'Rewards cards should keep the transform/opacity stagger reveal required by the redesign.',
);

console.log('[PASS] Rewards shell active nav guard passed.');
