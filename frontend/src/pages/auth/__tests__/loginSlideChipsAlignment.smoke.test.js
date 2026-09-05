import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const authGlassSource = readFileSync(
  path.join(here, "../../../styles/auth-liquid-glass.css"),
  'utf8',
);

// DV-2026-08-15-11 — the login carousel chip rows (slide details / stats) were
// shrink-wrapped and centered by the command-entry base rule, detaching them
// from the left-aligned text stack at wider viewports ("placed too outward").
// The liquid-glass skin must stretch slide children and span the details row.
assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-slide\s*\{[^}]*align-items:\s*stretch/,
  'Liquid-glass login slides should stretch children so chip rows align with the text stack.',
);

assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass \.auth-flow-slide-details\s*\{[^}]*width:\s*100%/,
  'Slide details chip row should span the slide width instead of shrink-wrapping.',
);

assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-text\s*\{[^}]*margin-inline:\s*0/,
  'Slide paragraph should stay flush with the left-aligned stack.',
);

// The copy column centers its children (base rule), and the slide viewport
// used to shrink-wrap (~373px). Per the user's placement drawing the block
// should sit centered in the brand panel like the wordmark, at a fixed
// reading-column width, with the rows inside left-aligned.
assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-slide-viewport\s*\{[^}]*width:\s*100%[^}]*max-width:\s*460px/,
  'Slide viewport should be a centered 460px reading column in the brand panel.',
);

// On tall windows (>=1080px) the command-entry base stretches the brand inner
// and packs its children at the top, leaving a dead zone under the carousel
// while the form column stays centered. The content group must center
// vertically, biased upward and rightward per the user's dot-grid nudges
// (padding shifts the centered group by half each value: 144px → 72px up,
// 96px → 48px right).
assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-brand-inner\s*\{[^}]*justify-content:\s*center[^}]*padding-bottom:\s*144px[^}]*padding-left:\s*96px/,
  'Brand column content should center vertically with upward+rightward biases.',
);

// On wide windows (>=1920px) the capped (660px) brand inner packed at the
// panel's left, leaving the slide block left of the panel center. The inner
// must center horizontally so the carousel reads central.
assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-brand\s*\{[^}]*justify-content:\s*center/,
  'Brand inner should center horizontally so the slide block sits central on wide windows.',
);

// The website logo sits left of the HERMES title and the whole wordmark
// block is pinned to the brand panel's top-left corner.
assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-wordmark-wrap\s*\{[^}]*position:\s*absolute[^}]*top:\s*34px[^}]*left:\s*44px/,
  'Wordmark block should be pinned to the top-left corner.',
);
assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-wordmark-row\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/,
  'Logo and title should sit on one centered row.',
);

const loginSource = readFileSync(path.join(here, "../Login.jsx"), 'utf8');
assert.match(
  loginSource,
  /auth-flow-wordmark-row[\s\S]*?HermesMarkSvg[\s\S]*?auth-flow-wordmark-logo[\s\S]*?auth-flow-wordmark">HERMES/,
  'Login should render the Hermes mark left of the HERMES title.',
);
assert.match(
  loginSource,
  /const stravaConfigured = authProviders\?\.stravaConfigured === true;/,
  'Login should fail closed until the backend reports Strava credentials are ready.',
);
assert.match(
  loginSource,
  /const googleConfigured = authProviders\?\.googleConfigured === true;/,
  'Login should fail closed until the backend reports Google credentials are ready.',
);
assert.doesNotMatch(
  loginSource,
  /apiFetch\('\/api\/auth\/strava\/status'\)/,
  'Login should use the shared backend provider-readiness response instead of a fail-open Strava status fallback.',
);
assert.match(
  loginSource,
  /hasConfiguredSocialProvider\s*=\s*stravaConfigured\s*\|\|\s*googleConfigured/,
  'Login should render the provider action group only when at least one provider is ready.',
);
assert.match(
  loginSource,
  /stravaConfigured\s*&&\s*\(\s*<button[\s\S]*?auth-flow-btn--strava/,
  'Login should render Strava only when the backend marks it configured.',
);
assert.match(
  loginSource,
  /googleConfigured\s*&&\s*\(\s*<button[\s\S]*?auth-flow-btn--google/,
  'Login should render Google only when the backend marks it configured.',
);

// The legal links row moved from the form side's bottom edge into the card,
// directly under the 还没有账号？立即注册 row.
assert.match(
  loginSource,
  /signup-link--auth[\s\S]*?auth-flow-legal auth-flow-legal--inline/,
  'Legal links should render right after the signup row inside the card.',
);
assert.match(
  authGlassSource,
  /\.auth-page--liquid-glass\.auth-page--login \.auth-flow-legal--inline,\s*#root \.auth-page--liquid-glass\.auth-page--signup \.auth-flow-legal--inline\s*\{[^}]*justify-content:\s*center[^}]*margin-top:\s*10px/,
  'Inline legal row should center under the prompt row on both cards.',
);

// Signup mirrors the login redesign: corner logo block + inline legal row.
const signupSource = readFileSync(path.join(here, "../Signup.jsx"), 'utf8');
assert.match(
  signupSource,
  /auth-flow-wordmark-row[\s\S]*?HermesMarkSvg[\s\S]*?auth-flow-wordmark-logo[\s\S]*?auth-flow-wordmark">HERMES/,
  'Signup should render the Hermes mark left of the HERMES title.',
);
assert.match(
  signupSource,
  /signup-link--auth[\s\S]*?auth-flow-legal auth-flow-legal--inline/,
  'Signup legal links should render right after the signin row inside the card.',
);

// Flow slides keep only the hero headline and paragraph; the kicker pill,
// details, and stats chip rows are hidden on the liquid-glass command-entry
// surfaces.
assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-slide > \.auth-flow-kicker,\s*#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-slide > \.auth-flow-slide-details,\s*#root \.auth-page--liquid-glass\[data-auth-redesign="command-entry"\] \.auth-flow-slide > \.auth-flow-stats\s*\{[^}]*display:\s*none/,
  'Flow slides should render only hero + paragraph (kicker/details/stats hidden).',
);

// The login provider group is visible when the backend says a provider is
// ready. Signup keeps its existing scoped hide rule until that surface is
// intentionally restored too.
assert.doesNotMatch(
  authGlassSource,
  /#root \.auth-page--liquid-glass\.auth-page--login \.auth-flow-social[\s\S]*?display:\s*none/,
  'Login should not hide the backend-gated social login block.',
);
assert.match(
  authGlassSource,
  /#root \.auth-page--liquid-glass\.auth-page--signup \.auth-flow-social\s*\{[^}]*display:\s*none/,
  'Signup should retain its existing scoped social-login hide rule.',
);
