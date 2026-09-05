import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, "../ProfileDashboard.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8');
const comebackSource = readFileSync(path.join(here, "../../../components/ComebackMessage.jsx"), 'utf8');

assert.match(
  profileSource,
  /runner-shell-page runner-dashboard-page profile-dashboard-page/,
  'Profile dashboard should expose the route-specific runner shell class.',
);

for (const className of [
  'hd-content',
  'hd-hero',
  'hd-today-card',
  'hd-metric-strip',
  'hd-progression',
  'hd-rewards',
  'hd-training-grid',
]) {
  assert.match(profileSource, new RegExp(className), `Profile dashboard should keep ${className}.`);
}

assert.doesNotMatch(
  profileSource,
  /brandMsgIndex|runner-dashboard-brand-copy-carousel|runner-dashboard-brand-dots|runner-dashboard-pro-quota-card|runner-dashboard-pro-card|setSubscriptionState|const \[subscriptionState/,
  'Profile dashboard should not reintroduce the old brand carousel or upsell cards.',
);

assert.match(
  styleSource,
  /Profile workout media card contrast repair/,
  'Profile workout media card should keep the route-scoped contrast repair.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-shell-canvas\s*\{[\s\S]*width:\s*calc\(100% - 24px\) !important;[\s\S]*max-width:\s*none !important;/,
  'Profile shell canvas should not inherit the older capped runner width that leaves right blank space.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-support-grid > \.runner-dashboard-workout-card \.runner-dashboard-workout-content h3,[\s\S]*\.runner-dashboard-workout-stats strong\s*\{[\s\S]*color:\s*#fff7ec !important;/,
  'Profile workout media card title and stat values should stay readable on the dark image overlay.',
);

assert.match(
  styleSource,
  /\.runner-comeback-card\s*\{[\s\S]*background:[\s\S]*linear-gradient/,
  'The Profile comeback prompt should use local semantic styling instead of legacy utility classes.',
);

assert.doesNotMatch(
  comebackSource,
  /from-indigo-600|to-violet-700|text-indigo-100/,
  'The comeback prompt should not reintroduce the old purple utility-card treatment.',
);

assert.doesNotMatch(
  styleSource,
  /runner-dashboard-brand-msg|runner-dashboard-brand-real-stats|runner-dashboard-brand-dots/,
  'Brand carousel styles should not keep the old message carousel selectors.',
);

console.log('[PASS] Profile dashboard brand carousel light-mode guardrails passed.');
