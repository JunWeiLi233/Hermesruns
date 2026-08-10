import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) =>
  readFileSync(path.join(here, relativePath), 'utf8');
const login = read('Login.jsx');
const signup = read('Signup.jsx');
const legal = read('LegalPage.jsx');
const styles = read('../styles/auth-liquid-glass.css');
const carousel = read('../components/AuthBrandCarousel.jsx');

for (const [name, source] of [
  ['login', login],
  ['signup', signup],
]) {
  assert.match(
    source,
    /import AuthDotField from ['"]\.\.\/components\/AuthDotField['"];?/,
    `${name} should mount the dot field.`,
  );
  assert.match(
    source,
    /auth-page--liquid-glass/,
    `${name} should opt into the shared glass surface.`,
  );
  assert.match(
    source,
    /auth-page--liquid-glass">\s*<AuthDotField\s*\/>/,
    `${name} should render the dot field on the page background.`,
  );
  assert.doesNotMatch(
    source,
    /<div className="auth-flow-card">\s*<AuthDotField\s*\/>/,
    `${name} should not nest the page field inside the form card.`,
  );
  assert.ok(
    source.indexOf('auth-flow-form') < source.indexOf('auth-flow-social'),
    `${name} should keep the email form before optional provider actions.`,
  );
  assert.doesNotMatch(
    source,
    /<div className="auth-flow-divider">/,
    `${name} should not render a redundant authentication divider.`,
  );
}

assert.match(
  styles,
  /--auth-dot-color: 91, 77, 66/,
  'The dot field should use the warm, restrained paper palette.',
);
assert.match(
  styles,
  /auth-page--liquid-glass > \.auth-dot-field\s*\{[\s\S]*opacity: 0\.86/,
  'The page-level dot field should remain visible behind the glass card.',
);
assert.match(
  styles,
  /auth-flow-formside::before\s*\{[\s\S]*display: none/,
  'The secondary outside form panel should be removed.',
);
assert.match(
  styles,
  /\.auth-page--liquid-glass \.auth-flow-formside\s*\{[\s\S]*background: transparent;[\s\S]*box-shadow: none;[\s\S]*backdrop-filter: none;/,
  'The auth form-side parent should not render a second glass surface.',
);
assert.match(
  styles,
  /\.auth-page--liquid-glass \.auth-flow-card\s*\{[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*box-shadow: none;[\s\S]*backdrop-filter: none;/,
  'The outer auth card shell should be visually removed while its form layout remains intact.',
);
assert.match(
  styles,
  /\.auth-page--liquid-glass \.auth-flow-card::before\s*\{\s*content: none;/,
  'Login and signup glass cards should not render the crosshair decoration.',
);
assert.match(
  styles,
  /@media \(min-width: 760px\)[\s\S]*\.auth-flow-formside\s*\{[\s\S]*align-items: stretch;[\s\S]*\.auth-flow-card\s*\{[\s\S]*width: min\(100%, 560px\);[\s\S]*margin-left: auto;/,
  'Desktop auth cards should fill the right column while preserving an outer inset.',
);
assert.match(
  styles,
  /@media \(min-width: 760px\) and \(min-height: 640px\)[\s\S]*auth-page--login \.auth-flow-card\s*\{[\s\S]*transform: translateY\(clamp\(22px, 4vh, 36px\)\)/,
  'Desktop login credentials should sit below the geometric center for stronger optical focus.',
);
assert.match(
  styles,
  /auth-page--login \.auth-flow-header::before\s*\{[\s\S]*width: 3px;[\s\S]*background: linear-gradient\(180deg, #9d3428, #f07561\)/,
  'The login heading should keep a restrained coral focus rail.',
);
assert.doesNotMatch(
  styles,
  /auth-page--signup \.auth-flow-card\s*\{[\s\S]*translateY/,
  'The login optical offset should not change signup positioning.',
);
assert.match(
  styles,
  /legal-page--privacy\.auth-page--liquid-glass \.legal-page-shell\s*\{[\s\S]*width: min\(1040px, 100%\)/,
  'Privacy should use a compact reading frame.',
);
assert.match(
  styles,
  /legal-page--privacy\.auth-page--liquid-glass \.legal-page-row-copy p\s*\{[\s\S]*line-height: 1\.62/,
  'Privacy section copy should keep a dense but readable rhythm.',
);
assert.match(
  styles,
  /\.auth-page--liquid-glass \.auth-flow-dots\s*\{\s*display: none;/,
  'Login and signup glass cards should not render the animated carousel indicator bars.',
);
assert.match(
  styles,
  /\.auth-page--liquid-glass \.auth-flow-slide-track\s*\{[\s\S]*height: 100%;[\s\S]*animation: none;[\s\S]*transform: none;/,
  'Login and signup glass pages should keep the random slide in one stable viewport.',
);
assert.match(
  styles,
  /\.auth-page--liquid-glass \.auth-flow-slide\s*\{[\s\S]*position: relative;[\s\S]*opacity: 1;[\s\S]*animation: authGlassSlideEnter 560ms/,
  'Login and signup glass pages should animate one active brand slide at a time.',
);
assert.match(
  styles,
  /@keyframes authGlassSlideEnter[\s\S]*opacity: 1/,
  'The auth brand loop should enter each randomly selected information frame smoothly.',
);
assert.match(
  styles,
  /\.auth-page--liquid-glass \.auth-flow-slide-details\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  'Auth brand frames should expose compact supplemental details.',
);
assert.match(
  carousel,
  /MIN_SLIDE_DURATION_MS = 6800/,
  'Auth brand loop should stay long enough to read each expanded frame.',
);
assert.match(
  carousel,
  /prefers-reduced-motion: reduce/,
  'Auth brand loop should stop changing content when reduced motion is requested.',
);
assert.match(
  styles,
  /\.auth-flow-social\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  'Provider actions should be compact horizontal secondary actions on desktop.',
);
assert.match(
  styles,
  /prefers-reduced-motion: reduce/,
  'The background motion should respect reduced-motion preferences.',
);
assert.match(
  styles,
  /\.legal-page--terms\.auth-page--liquid-glass \.legal-page-hero--editorial h1\s*\{\s*font-size: clamp\(2\.8rem, 5vw, 5rem\);/,
  'Terms should use a compact title scale so the document starts higher in the viewport.',
);
assert.match(
  styles,
  /\.legal-page--terms\.auth-page--liquid-glass \.legal-page-row\s*\{[\s\S]*padding: clamp\(20px, 2\.4vw, 30px\) 0;/,
  'Terms should use compact section spacing for faster scanning.',
);
assert.match(
  legal,
  /legal-page legal-page--\$\{variant\} auth-page--liquid-glass/,
  'Terms and Privacy should opt into the shared glass surface without an outside grid.',
);

console.log('[PASS] Warm glass auth and legal guardrails passed.');
