import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const profileStyleSource = readFileSync(path.join(here, '../styles/_split/profile.css'), 'utf8');
const runnerShellStyleSource = readFileSync(path.join(here, '../styles/_split/runner-shell.css'), 'utf8');

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

assert.match(
  styleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed\s*\{[\s\S]*--runner-nav-collapsed-width:\s*96px;/,
  'Collapsed runner sidebar should reserve enough width for a centered icon rail instead of clipping against the viewport edge.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-brand\s*\{[\s\S]*overflow:\s*hidden;/,
  'Collapsed runner sidebar should intentionally contain the brand area instead of leaving partial HERMES letters visible.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-brand \.runner-dashboard-brand-copy > span:not\(\.hermes-logo\)\s*\{[\s\S]*display:\s*none;/,
  'Collapsed runner sidebar should remove non-logo brand text from layout.',
);
assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-shell-brand \.runner-dashboard-brand-copy > span:not\(\.hermes-logo\)\s*\{[\s\S]*animation:\s*runner-brand-subtitle-reveal\s+360ms/,
  'Runner sidebar subtitle should use a short one-time reveal tied to the brand label entering the page.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-shell-brand:hover \.runner-dashboard-brand-copy > span:not\(\.hermes-logo\),\s*\n\.runner-dashboard-page \.runner-shell-brand:focus-within \.runner-dashboard-brand-copy > span:not\(\.hermes-logo\)\s*\{[\s\S]*transform:\s*translate3d\(1px, 0, 0\)/,
  'Runner sidebar subtitle motion should respond to brand hover/focus instead of running as decoration.',
);

assert.doesNotMatch(
  styleSource,
  /runner-brand-cue-inbound|runner-brand-text-arrive|runner-dashboard-brand-copy > span:not\(\.hermes-logo\)::before[\s\S]*animation:[^;]*infinite/,
  'Runner sidebar subtitle should not use a looping inbound dash animation.',
);

assert.match(
  styleSource,
  /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*runner-brand-subtitle-reveal[\s\S]*animation:\s*none;/,
  'Runner sidebar subtitle animation should respect reduced-motion preferences.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-brand \.hermes-logo__word,\s*\n\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-brand \.hermes-logo__mark\s*\{[\s\S]*display:\s*none;/,
  'Collapsed runner sidebar should show the compact icon mark instead of clipping the HERMES wordmark.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-side-link::before\s*\{[\s\S]*display:\s*none;/,
  'Collapsed runner sidebar should hide route numbers so active icons do not squeeze.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-dashboard-workout-btn,\s*\n\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-workout-btn\s*\{[\s\S]*width:\s*52px;[\s\S]*height:\s*60px;/,
  'Collapsed squeeze button should be a bounded pill, not an oversized red slab.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-sidebar-footer\s*\{[^}]*width:\s*100%;[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/,
  'Collapsed sidebar footer should center its workout arrow on the same horizontal axis as the collapse toggle.',
);
assert.match(
  runnerShellStyleSource,
  /\.runner-shell-sidebar-footer\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/,
  'Sidebar footer should retain the column axis that makes align-items control horizontal centering.',
);

console.log('[PASS] Runner shell sidebar redesign guardrails passed.');
