import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const profileStyleSource = readFileSync(path.join(here, '../styles/_split/profile.css'), 'utf8');
const runnerShellStyleSource = readFileSync(path.join(here, '../styles/_split/runner-shell.css'), 'utf8');
const workoutButtonStyleSource = readFileSync(path.join(here, '../styles/runner-shell-workout-button.css'), 'utf8');
const authenticatedChromeSource = readFileSync(path.join(here, 'AuthenticatedPageChrome.jsx'), 'utf8');

assert.match(
  authenticatedChromeSource,
  /const \[isSidebarCollapsed, setIsSidebarCollapsed\] = useState\(true\);/,
  'The shared runner shell should start with the compact sidebar rail by default.',
);

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
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-dashboard-workout-btn,\s*\n\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-workout-btn\s*\{[^}]*width:\s*60px;[^}]*height:\s*60px;/,
  'Collapsed default squeeze button should remain a true circle.',
);

assert.match(
  workoutButtonStyleSource,
  /#root \.runner-dashboard-page\.is-sidebar-collapsed\s*>\s*\.runner-shell-sidebar\s*\{[^}]*overflow:\s*visible;/,
  'The compact sidebar should let the widened workout CTA occupy the adjacent right-side space.',
);

assert.match(
  workoutButtonStyleSource,
  /#root \.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:hover\) \.runner-shell-sidebar-footer > \.runner-shell-workout-btn,\s*\n\s*#root \.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:focus-within\) \.runner-shell-sidebar-footer > \.runner-shell-workout-btn\s*\{[^}]*width:\s*132px !important;[^}]*height:\s*60px !important;/,
  'Expanded runner navigation should use the wider CTA surface only after hover or keyboard focus enters the rail.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-side-link\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*margin-inline:\s*auto;/,
  'Collapsed sidebar links should keep every icon on the rail center axis.',
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

assert.match(
  profileStyleSource,
  /@media \(min-width:\s*1100px\)[\s\S]*?\.runner-dashboard-page\.runner-shell-page\.is-sidebar-collapsed\s*\{[\s\S]*?grid-template-columns:\s*var\(--runner-nav-collapsed-width\)/,
  'Desktop runner pages should reserve the compact rail width before pointer interaction.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:hover\)[\s\S]*?grid-template-columns:\s*var\(--runner-nav-expanded-width\)/,
  'Hovering over the compact rail should expand the desktop sidebar and its content column.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:focus-within\)[\s\S]*?\.runner-dashboard-side-link-label[\s\S]*?opacity:\s*1;/,
  'Keyboard focus within the compact rail should expose the same readable navigation labels as hover.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:hover\) \.runner-dashboard-workout-btn-label,\s*\n\s*\.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:focus-within\) \.runner-dashboard-workout-btn-label\s*\{[^}]*display:\s*inline;[^}]*opacity:\s*1;[^}]*width:\s*auto;[^}]*overflow:\s*visible;/,
  'Expanded runner sidebar should reveal the full 今日训练 CTA label instead of leaving only its arrow glyph.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:hover\) \.runner-shell-side-link,\s*\n\s*\.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:focus-within\) \.runner-shell-side-link\s*\{[\s\S]*?gap:\s*12px;[\s\S]*?padding:\s*9px 34px 9px 16px !important;/,
  'Expanded runner links should center icons in a stable icon lane before the text label.',
);

assert.match(
  workoutButtonStyleSource,
  /\s*#root \.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:hover\) \.runner-shell-sidebar-footer > \.runner-shell-workout-btn \.runner-dashboard-workout-btn-label,\s*\n\s*#root \.runner-dashboard-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:focus-within\) \.runner-shell-sidebar-footer > \.runner-shell-workout-btn \.runner-dashboard-workout-btn-label\s*\{[^}]*display:\s*inline;[^}]*opacity:\s*1;[^}]*width:\s*auto;[^}]*overflow:\s*visible;/,
  'The high-specificity workout button stylesheet must release the label when the sidebar expands.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.runner-shell-side-nav\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*justify-content:\s*flex-start;[^}]*gap:\s*12px;/,
  'Collapsed sidebar icons should stay in a compact fixed rhythm instead of stretching across the full rail height.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page \.runner-dashboard-sidebar-toggle\s*\{[^}]*display:\s*none;/,
  'The compact runner rail should not render a standalone toggle button above the icons.',
);

console.log('[PASS] Runner shell sidebar redesign guardrails passed.');
