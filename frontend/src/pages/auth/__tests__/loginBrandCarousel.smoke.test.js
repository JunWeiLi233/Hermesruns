import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const loginSource = readFileSync(path.join(here, "../Login.jsx"), 'utf8');
const signupSource = readFileSync(path.join(here, "../Signup.jsx"), 'utf8');
const carouselSource = readFileSync(path.join(here, "../../../components/AuthBrandCarousel.jsx"), 'utf8');
const slideSource = readFileSync(path.join(here, "../../../data/authBrandSlides.js"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8');
const translationsSource = [
  readFileSync(path.join(here, "../../../i18n/locales/en/pages.js"), 'utf8'),
  readFileSync(path.join(here, "../../../i18n/locales/zh-CN/pages.js"), 'utf8'),
].join('\n');

assert.match(
  loginSource,
  /import AuthBrandCarousel from '\.\.\/\.\.\/components\/AuthBrandCarousel';/,
  'Login should use the shared brand carousel component.',
);

assert.match(
  signupSource,
  /import AuthBrandCarousel from '\.\.\/\.\.\/components\/AuthBrandCarousel';/,
  'Signup should use the same shared brand carousel component.',
);

assert.match(
  slideSource,
  /const authBrandSlides\s*=\s*\[/,
  'Shared auth brand carousel data should define the reusable slide list.',
);

assert.match(
  loginSource,
  /<AuthBrandCarousel t=\{t\} \/>/,
  'Login brand intro should render the shared carousel inside auth-flow-brand-inner.',
);

assert.match(
  carouselSource,
  /Math\.random\(\)/,
  'The brand carousel should make random slide and timing choices.',
);

assert.match(
  carouselSource,
  /setActiveIndex\(\(currentIndex\) => randomIndex/,
  'The brand carousel should choose a different random slide after each interval.',
);

assert.match(
  carouselSource,
  /auth-flow-slide-details/,
  'The brand carousel should render the expanded slide details.',
);

assert.match(
  loginSource,
  /apiJson\('\/api\/auth\/providers'\)/,
  'Login should load provider readiness from the public backend provider endpoint.',
);

assert.doesNotMatch(
  loginSource,
  /apiFetch\('\/api\/auth\/strava\/status'\)/,
  'Login should not use a separate Strava status request as the provider visibility gate.',
);

assert.match(
  carouselSource,
  /auth-flow-slide/,
  'The shared brand carousel should render an individual slide panel instead of one static copy block.',
);

assert.match(
  styleSource,
  /@keyframes authFlowSlideRoll/,
  'Login brand intro styles should define the rolling slide animation.',
);

assert.match(
  styleSource,
  /\.auth-flow-slide-track\s*\{/,
  'Login brand intro styles should define the slide track.',
);

assert.match(
  styleSource,
  /prefers-reduced-motion:\s*reduce[\s\S]*auth-flow-slide-track/,
  'Login brand intro should respect reduced-motion users.',
);

assert.match(
  translationsSource,
  /"stitch_slide_1_kicker":/,
  'Login carousel copy should be translated in the index namespace.',
);

assert.match(
  translationsSource,
  /"stitch_slide_3_copy":/,
  'Login carousel should include all three translated slide copy entries.',
);

assert.match(
  translationsSource,
  /"stitch_slide_7_detail_three":/,
  'Expanded course-map details should be translated in both locales.',
);

assert.match(
  slideSource,
  /id: 'run-data-hub'/,
  'The auth carousel should introduce the data-import entry point.',
);

assert.match(
  translationsSource,
  /"stitch_slide_10_copy":/,
  'The auth carousel should include a translated progress overview slide.',
);

assert.match(
  slideSource,
  /id: 'today-run-decision'/,
  'The auth carousel should introduce the Today Run decision surface.',
);

assert.match(
  translationsSource,
  /"stitch_slide_14_copy":/,
  'The auth carousel should include a translated coach-reasoning slide.',
);

console.log('[PASS] Login brand carousel guardrails passed.');
