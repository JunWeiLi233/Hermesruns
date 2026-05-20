import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const comebackSource = readFileSync(path.join(here, '../components/ComebackMessage.jsx'), 'utf8');

assert.match(
  profileSource,
  /runner-dashboard-profile-purpose-cockpit runner-dashboard-profile-dossier/,
  'Profile dashboard should render the analysis-aligned profile purpose cockpit.',
);

assert.match(
  profileSource,
  /runner-shell-page runner-dashboard-page profile-dashboard-page/,
  'Profile dashboard should expose a route-specific class for full-width canvas repairs.',
);

assert.match(
  profileSource,
  /runner-dashboard-profile-reference-grid/,
  'Profile dashboard should render a reference grid for weekly load, distance, and VO2 signals.',
);

assert.match(
  profileSource,
  /runner-dashboard-profile-decision-map/,
  'Profile opening surface should include the runner decision map.',
);

assert.match(
  profileSource,
  /runner-dashboard-profile-bento-grid/,
  'Profile continuation cards should use the analysis-aligned bento grid.',
);

assert.match(
  profileSource,
  /runner-dashboard-profile-signal-ledger runner-dashboard-profile-signal-grid/,
  'Profile signal metrics should use the analysis-aligned signal ledger.',
);

assert.doesNotMatch(
  profileSource,
  /brandMsgIndex|runner-dashboard-brand-copy-carousel|runner-dashboard-brand-dots/,
  'Profile dashboard brand carousel should not keep the old rotating brand-message state or dot UI.',
);

assert.match(
  styleSource,
  /Profile cockpit collapse repair/,
  'Profile cockpit should include the runtime repair block for the current app shell.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-coach-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.18fr\)\s*minmax\(380px,\s*0\.82fr\)/,
  'Profile cockpit should use the wide decision-map grid instead of collapsing the primary card.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-shell-canvas\s*\{[\s\S]*width:\s*calc\(100% - 24px\) !important;[\s\S]*max-width:\s*none !important;/,
  'Profile shell canvas should not inherit the older capped runner width that leaves right blank space.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-main\s*\{[\s\S]*width:\s*100% !important;[\s\S]*max-width:\s*none !important;/,
  'Profile main content should occupy the available runner shell width.',
);

assert.doesNotMatch(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-coach-secondary\s*\{[^}]*display:\s*contents/,
  'Profile right rail must not use display: contents because it collapses the primary card in the live shell.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-coach-secondary\s*\{[\s\S]*align-self:\s*stretch !important;[\s\S]*align-content:\s*end !important;/,
  'Profile next-session rail should stretch and bottom-anchor so the prescription card lands with the bottom reference grid.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-coach-secondary\s*\{[\s\S]*grid-template-rows:\s*auto auto !important;[\s\S]*grid-auto-flow:\s*row !important;/,
  'Profile next-session rail should keep the prescription card and reference grid in separate stacked rows instead of overlapping stale named grid areas.',
);

const legacyContentsRailIndex = styleSource.indexOf(
  '.hermes-site-frame[data-gpt-taste-system="gpt-taste"][data-route-path="/profile"] .runner-dashboard-profile-purpose-cockpit .runner-dashboard-coach-secondary',
);
const bottomAnchoredRailIndex = styleSource.lastIndexOf(
  '.hermes-site-frame[data-gpt-taste-system="gpt-taste"][data-route-path="/profile"] .runner-dashboard-page .runner-dashboard-profile-purpose-cockpit .runner-dashboard-coach-secondary',
);

assert.ok(
  bottomAnchoredRailIndex > legacyContentsRailIndex,
  'Profile bottom-anchor rail override should come after the older route-scoped display: contents rule.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-profile-next-session\s*\{[\s\S]*background:[\s\S]*linear-gradient/,
  'Profile next-session card should get the dark Analysis-style contrast panel.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-profile-next-session\s*\{[\s\S]*grid-area:\s*auto !important;[\s\S]*grid-row:\s*1 !important;[\s\S]*align-self:\s*end !important;/,
  'Profile next-session card should reset stale route-scoped grid-area placement and sit directly above the bottom reference-grid cluster.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-profile-reference-grid\s*\{[\s\S]*grid-area:\s*auto !important;[\s\S]*grid-row:\s*2 !important;/,
  'Profile reference grid should reset stale route-scoped grid-area placement so it does not overlap the next-session card.',
);

assert.match(
  styleSource,
  /\/\* Profile first-fold decision-map refinement \*\//,
  'Profile first fold should include the latest decision-map refinement layer.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-decision-map\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  'Profile decision map should render as a readable 2x2 desktop decision board.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-coach-copy h1\s*\{[\s\S]*font-size:\s*clamp\(1\.95rem,\s*2\.2vw,\s*3rem\) !important;/,
  'Profile opening headline should stay restrained enough for the decision map to remain visible in the first fold.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-decision-map\s*\{[\s\S]*order:\s*3;/,
  'Profile decision map should appear before the repeated metric strip in the opening card.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-profile-next-session\s*\{[\s\S]*min-height:\s*clamp\(248px,\s*20vw,\s*306px\) !important;/,
  'Profile next-session card should be compact enough to keep the reference rail in the opening viewport.',
);

assert.match(
  styleSource,
  /@keyframes profileDossierRise/,
  'Profile first-fold surfaces should use transform/opacity-only entrance motion.',
);

assert.match(
  styleSource,
  /\/\* Profile workout media card contrast repair \*\//,
  'Profile workout media card should include a route-scoped contrast repair.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-support-grid > \.runner-dashboard-workout-card \.runner-dashboard-workout-content h3,[\s\S]*\.runner-dashboard-workout-stats strong\s*\{[\s\S]*color:\s*#fff7ec !important;/,
  'Profile workout media card title and stat values should stay readable on the dark image overlay.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-support-grid > \.runner-dashboard-workout-card \.runner-dashboard-workout-stats span\s*\{[\s\S]*color:\s*rgba\(255,\s*247,\s*236,\s*0\.68\) !important;/,
  'Profile workout media card labels should use light muted text instead of inherited light-theme dark text.',
);

assert.match(
  styleSource,
  /\/\* Profile support grid calm board final override \*\//,
  'Profile support grid should include the final calm-board redesign layer.',
);

const supportGridFinalOverrideIndex = styleSource.lastIndexOf('/* Profile support grid calm board final override */');
const legacySupportGridIndex = styleSource.lastIndexOf('grid-template-columns: repeat(16, minmax(0, 1fr)) !important;');

assert.ok(
  supportGridFinalOverrideIndex > legacySupportGridIndex,
  'Profile calm-board support-grid override should come after stale 16-column support-grid rules.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-support-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.08fr\)\s*minmax\(360px,\s*0\.92fr\) !important;[\s\S]*"workout readiness"[\s\S]*"workout weekly"[\s\S]*"sessions streak" !important;/,
  'Profile support grid should use a calm two-column training board instead of a busy three-column collage.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-support-grid > \.runner-dashboard-readiness-card\s*\{[\s\S]*grid-area:\s*readiness !important;[\s\S]*\}/,
  'Profile readiness card should occupy its named support-grid area instead of collapsing into one column.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-support-grid > \.runner-dashboard-workout-card\s*\{[\s\S]*grid-area:\s*workout !important;[\s\S]*\}/,
  'Profile workout card should occupy its named support-grid area instead of leaving a right blank lane.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-support-grid > \.runner-dashboard-readiness-card h2\s*\{[\s\S]*font-size:\s*clamp\(2rem,\s*3vw,\s*3\.5rem\) !important;/,
  'Profile readiness type should be restrained inside the redesigned support board.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page \.runner-dashboard-profile-support-grid > \.runner-dashboard-weekly-card \.runner-dashboard-bar-track\s*\{[\s\S]*height:\s*8\.8rem;/,
  'Profile weekly chart should be compact enough to sit calmly beside adjacent cards.',
);

const readinessSupportBlock = styleSource.match(/\.runner-dashboard-profile-support-grid > \.runner-dashboard-readiness-card\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
const workoutSupportBlock = styleSource.match(/\.runner-dashboard-profile-support-grid > \.runner-dashboard-workout-card\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';

assert.doesNotMatch(
  `${readinessSupportBlock}\n${workoutSupportBlock}`,
  /grid-column:\s*auto !important/,
  'Profile support-grid cards must not cancel their named grid areas with grid-column auto.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-feature-grid\.runner-dashboard-profile-bento-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(16,\s*minmax\(0,\s*1fr\)\) !important;[\s\S]*"race race race race predictions predictions predictions predictions predictions predictions predictions load load load load load"/,
  'Profile bento grid should use named 16-column areas so load fills the designed right rail.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-profile-bento-card--muscle\s*\{[\s\S]*grid-area:\s*muscle;/,
  'Profile muscle bento card should occupy its named bento area instead of becoming an undifferentiated full-width slab.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-bento-card--workout::after[\s\S]*\{[\s\S]*content:\s*none !important;[\s\S]*display:\s*none !important;/,
  'Profile workout bento card should not render the generated ::after layer.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-bento-card--stamina::after[\s\S]*\{[\s\S]*content:\s*none !important;[\s\S]*display:\s*none !important;/,
  'Profile stamina bento card should not render the generated ::after layer.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-bento-card--sessions::after[\s\S]*\{[\s\S]*content:\s*none !important;[\s\S]*display:\s*none !important;/,
  'Profile sessions bento card should not render the generated ::after layer.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-bento-card--predictions::after[\s\S]*\{[\s\S]*content:\s*none !important;[\s\S]*display:\s*none !important;/,
  'Profile predictions bento card should not render the generated ::after layer.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-bento-card--load::after[\s\S]*\{[\s\S]*content:\s*none !important;[\s\S]*display:\s*none !important;/,
  'Profile load bento card should not render the generated ::after layer.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-bento-card--muscle::after[\s\S]*\{[\s\S]*content:\s*none !important;[\s\S]*display:\s*none !important;/,
  'Profile muscle bento card should not render the generated ::after layer.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-purpose-cockpit \.runner-dashboard-profile-reference-grid\s*\{[\s\S]*align-items:\s*stretch !important;/,
  'Profile reference cards should stretch as one row so the distance card aligns with its neighboring cards.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-reference-card\.is-distance\s*\{[\s\S]*background:\s*#ffffff !important;[\s\S]*background-image:\s*none !important;/,
  'Profile distance reference card should use a plain white background without the old paper overlay.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-reference-card\s*\{[\s\S]*background:\s*#ffffff !important;[\s\S]*background-image:\s*none !important;/,
  'Profile reference cards should share a plain white background across the whole rail.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-profile-bento-grid:not\(:has\(\.runner-dashboard-profile-bento-card--muscle\)\)\s*\{[\s\S]*"stamina stamina stamina stamina stamina workout workout workout workout workout workout workout workout workout workout workout"/,
  'Profile bento grid should provide a no-muscle fallback that still fills the row.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-dashboard-profile-signal-card--vo2\s*\{[\s\S]*grid-column:\s*span 7;/,
  'Profile signal grid should promote VO2 as a wider first-class grid area.',
);

assert.match(
  styleSource,
  /\/\* Profile grid style refresh \*\//,
  'Profile grids should carry the latest route-scoped visual style refresh.',
);

assert.match(
  styleSource,
  /\.profile-dashboard-page\s*\{[\s\S]*--profile-grid-field:\s*#efe5d7;[\s\S]*--profile-grid-dark:\s*#2b261f;/,
  'Profile grid refresh should define its own calibrated warm field and graphite ink tokens.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-support-grid,[\s\S]*\.runner-dashboard-profile-bento-grid,[\s\S]*\.runner-dashboard-profile-signal-grid[\s\S]*linear-gradient\(90deg,\s*rgba\(72,\s*58,\s*42,\s*0\.055\) 1px,\s*transparent 1px\)/,
  'Profile grid containers should use the topographic field treatment instead of plain card rows.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-profile-bento-card--race,[\s\S]*\.runner-dashboard-profile-signal-card--vo2[\s\S]*linear-gradient\(145deg,\s*#302920,\s*var\(--profile-grid-dark\) 62%,\s*#211d18\)/,
  'Profile race and VO2 anchor cards should use the graphite command-slab treatment.',
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

assert.match(
  styleSource,
  /runner-dashboard-profile-signal-grid \.runner-dashboard-profile-signal-card--vo2/,
  'Profile signal grid should promote VO2 as the leading signal card.',
);

assert.doesNotMatch(
  profileSource,
  /runner-dashboard-pro-quota-card|runner-dashboard-pro-card|setSubscriptionState|const \[subscriptionState/,
  'Profile dashboard should not reintroduce profile upsell or quota cards.',
);

assert.doesNotMatch(
  styleSource,
  /runner-dashboard-brand-msg|runner-dashboard-brand-real-stats|runner-dashboard-brand-dots/,
  'Brand carousel styles should not keep the old message carousel selectors.',
);

console.log('[PASS] Profile dashboard brand carousel light-mode guardrails passed.');
