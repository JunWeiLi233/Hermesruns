import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "../../../styles/_split/auth.css"), 'utf8');
const liquidGlassStyles = readFileSync(path.join(here, "../../../styles/auth-liquid-glass.css"), 'utf8');
const loginSource = readFileSync(path.join(here, "../Login.jsx"), 'utf8');
const signupSource = readFileSync(path.join(here, "../Signup.jsx"), 'utf8');
const brandRule = styles.split('.auth-page[data-auth-redesign="command-entry"] .auth-flow-brand {')[1]?.split('}')[0] || '';
const brandGridRule = styles.split('.auth-page[data-auth-redesign="command-entry"] .auth-flow-brand::before {')[1]?.split('}')[0] || '';
const brandInnerRule = styles.split('.auth-page[data-auth-redesign="command-entry"] .auth-flow-brand-inner {')[1]?.split('}')[0] || '';
const fullBleedShellRule = liquidGlassStyles.split('#root .auth-page--liquid-glass[data-auth-redesign="command-entry"] .auth-flow-shell {')[1]?.split('}')[0] || '';
const pageDotFieldRule = liquidGlassStyles.split('#root .auth-page--liquid-glass > .auth-dot-field {')[1]?.split('}')[0] || '';
const centeredSlideRule = styles.split('.auth-page[data-auth-redesign="command-entry"] .auth-flow-copy,')[1]?.split('}')[0] || '';
const centeredStatsRule = styles.split('.auth-page[data-auth-redesign="command-entry"] .auth-flow-stats {')[1]?.split('}')[0] || '';
const commandEntrySlideViewportSelector = '#root .auth-page--liquid-glass[data-auth-redesign="command-entry"] .auth-flow-slide-viewport {';
const commandEntryStatsSelector = '#root .auth-page--liquid-glass[data-auth-redesign="command-entry"] .auth-flow-stats {';
const compactSlideRuleStart = liquidGlassStyles.indexOf(commandEntrySlideViewportSelector);
const compactStatsRuleStart = liquidGlassStyles.indexOf(commandEntryStatsSelector);
const mobileMediaStart = liquidGlassStyles.indexOf('@media (max-width: 720px)');
const fullSlideRule = liquidGlassStyles.split(commandEntrySlideViewportSelector)[1]?.split('}')[0] || '';
const compactStatsRule = liquidGlassStyles.split(commandEntryStatsSelector)[1]?.split('}')[0] || '';
const compactStatValueRule = liquidGlassStyles.split('#root .auth-page--liquid-glass[data-auth-redesign="command-entry"] .auth-flow-stats strong {')[1]?.split('}')[0] || '';
const dotFieldBehindShell = /<div className="auth-page[^>]+data-auth-redesign="command-entry">\s*<AuthDotField \/>\s*<main className="auth-flow-shell">/g;

assert.match(
  brandRule,
  /background:\s*transparent;/,
  'The auth carousel should leave the mounted dot field visible behind its content.',
);
assert.doesNotMatch(
  brandRule,
  /background:\s*var\(--auth-track\);/,
  'The auth carousel should not restore the solid dark rail behind the dot field.',
);
assert.match(
  brandGridRule,
  /content:\s*none;/,
  'The auth carousel should not render the decorative background grid behind slide content.',
);
assert.match(
  brandInnerRule,
  /justify-content:\s*flex-start;/,
  'The carousel should follow the brand mark instead of being pinned to the bottom of a full-height column.',
);
assert.doesNotMatch(
  brandInnerRule,
  /justify-content:\s*space-between;/,
  'The auth column should not create a dead vertical band between the brand mark and carousel.',
);
assert.match(
  brandInnerRule,
  /align-items:\s*center;/,
  'The carousel rail should center its visible content.',
);
assert.match(
  brandInnerRule,
  /text-align:\s*center;/,
  'The carousel rail should center its visible content copy.',
);
assert.match(
  brandInnerRule,
  /transform:\s*translateX\(clamp\(10px,\s*2vw,\s*24px\)\);/,
  'The centered carousel should retain its small rightward visual offset.',
);
assert.match(
  fullBleedShellRule,
  /width:\s*100%;/,
  'The command-entry shell should not be capped below the viewport width.',
);
assert.match(
  fullBleedShellRule,
  /padding:\s*0;/,
  'The command-entry shell should not expose a pale background strip around the carousel rail.',
);
assert.match(
  pageDotFieldRule,
  /position:\s*absolute;/,
  'The dot field should cover the auth page behind both command-entry columns.',
);
assert.match(
  centeredSlideRule,
  /align-items:\s*center;/,
  'The carousel slide should center its heading and copy.',
);
assert.match(
  centeredStatsRule,
  /justify-content:\s*center;/,
  'The carousel metrics should be centered with the slide.',
);
assert.match(
  fullSlideRule,
  /height:\s*auto;/,
  'Command-entry slides should grow to show all detail and stat placeholders at every rail width.',
);
assert.match(
  fullSlideRule,
  /overflow:\s*visible;/,
  'Command-entry slides should not clip stat placeholders at desktop rail widths.',
);
assert.match(
  fullSlideRule,
  /clip-path:\s*none;/,
  'Command-entry slides should not use the carousel clipping mask.',
);
assert.match(
  compactStatsRule,
  /display:\s*grid;/,
  'Stat placeholders should use a compact grid so both values fit in the visible slide.',
);
assert.match(
  compactStatsRule,
  /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  'Stat placeholders should stay in one two-column row.',
);
assert.match(
  compactStatValueRule,
  /font-size:\s*1\.25rem;/,
  'Stat values should use the compact size needed to remain in view.',
);
assert.ok(
  compactSlideRuleStart > -1 && compactSlideRuleStart < mobileMediaStart,
  'The full-height slide rule must apply before the mobile breakpoint so desktop rails cannot clip stats.',
);
assert.ok(
  compactStatsRuleStart > -1 && compactStatsRuleStart < mobileMediaStart,
  'The compact stat grid must apply before the mobile breakpoint so desktop rails keep both values visible.',
);
assert.equal(
  [...loginSource.matchAll(dotFieldBehindShell)].length,
  1,
  'Login should mount one dot field directly behind its command-entry shell.',
);
assert.equal(
  [...signupSource.matchAll(dotFieldBehindShell)].length,
  2,
  'Both Signup states should mount one dot field directly behind their command-entry shells.',
);
