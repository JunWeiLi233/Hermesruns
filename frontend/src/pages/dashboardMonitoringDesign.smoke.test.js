import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const indexSource = readFileSync(path.join(here, '../index.css'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/admin-monitoring-dashboard.css'), 'utf8');

assert.match(
  indexSource,
  /@import '\.\/styles\/admin-monitoring-dashboard\.css';/,
  'The admin monitoring layer must be loaded after the shared glass layer.',
);

assert.match(
  dashboardSource,
  /admin-command-route admin-command-route--\$\{activeTab \|\| 'overview'\}/,
  'Dashboard must keep a route-specific wrapper so the monitoring hierarchy can stay scoped.',
);

assert(
  dashboardSource.includes("import RunnerShellTopNav from '../components/RunnerShellTopNav';")
    && /<RunnerShellTopNav[\s\S]*activeLabel=\{activeRouteSurface\.eyebrow\}[\s\S]*navigate=\{navigate\}/.test(dashboardSource)
    && !dashboardSource.includes('ops-topbar-breadcrumb'),
  'Admin pages should use the shared runner top bar instead of repeating a multi-line breadcrumb and route summary.',
);

for (const selector of ['ops-metric-strip', 'ops-two-col', 'ops-action-grid']) {
  assert.match(
    dashboardSource,
    new RegExp(selector),
    `Overview markup should expose the monitoring block: ${selector}`,
  );
}

assert.match(
  dashboardSource,
  /adminStatusItems\.map[\s\S]*ops-health-row/,
  'The overview health panel must continue to use live queue/job/audit status data.',
);

assert.match(
  styleSource,
  /admin-command-route--overview > \.admin-command-route__summary\s*\{[\s\S]*display:\s*none/,
  'Overview should avoid duplicating the route summary above the monitoring strip.',
);

assert.match(
  styleSource,
  /admin-command-route--overview \.ops-metric-strip \{\s*order:\s*0/,
  'The metric strip must lead the overview hierarchy.',
);

assert.match(
  styleSource,
  /admin-command-route--overview \.ops-two-col \{\s*order:\s*1/,
  'Health and recent audit must appear before navigation actions.',
);

for (const legacyOverviewBlock of [
  'admin-overview-users-tracks',
  'admin-overview-review-feed',
  'admin-overview-bento',
  'admin-quick-actions',
  'history-summary-grid--spaced',
  'admin-shoe-grid',
]) {
  assert.match(
    styleSource,
    new RegExp(`admin-command-route--overview \\s*\\.${legacyOverviewBlock}[^}]*display:\\s*none`),
    `Overview should hide the duplicated legacy block: ${legacyOverviewBlock}`,
  );
}

assert.match(
  styleSource,
  /admin-command-sidebar__nav-copy\s*\{[\s\S]*?flex:\s*1 1 auto[\s\S]*?\}/,
  'Admin rail labels should keep the same compact geometry as the runner profile shell.',
);

assert.match(
  styleSource,
  /admin-command-sidebar__nav-copy > span\s*\{\s*display:\s*none/,
  'Admin rail should not render long secondary descriptions inside the narrow profile rail.',
);

assert.match(
  styleSource,
  /--admin-profile-card:\s*rgba\(255, 253, 248, 0\.7\)/,
  'Admin surfaces should share the profile page paper/glass token family.',
);

for (const rule of [
  /--runner-shell-rail-width:\s*240px/,
  /--runner-shell-rail-width:\s*clamp\(156px, 9\.2vw, 178px\)/,
  /--runner-shell-topbar-height:\s*76px/,
  /\.admin-command-sidebar\s*\{[\s\S]*position:\s*fixed[\s\S]*width:\s*var\(--runner-shell-rail-width\)[\s\S]*border-radius:\s*0/,
  /\.admin-command-topbar\s*\{[\s\S]*top:\s*0[\s\S]*min-height:\s*var\(--runner-shell-topbar-height\)[\s\S]*border-radius:\s*0/,
  /\.admin-command-topbar\.runner-shell-topbar\s*\{[\s\S]*height:\s*var\(--runner-shell-topbar-height\)[\s\S]*padding:\s*0 28px[\s\S]*backdrop-filter:\s*blur\(20px\)/,
]) {
  assert.match(
    styleSource,
    rule,
    'Admin sidebar/topbar geometry must stay aligned with the runner profile shell.',
  );
}

for (const rule of [
  /@media \(min-width: 861px\)[\s\S]*\.dashboard-body\.admin-command-page \.admin-command-layout[\s\S]*display:\s*block\s*!important[\s\S]*padding-inline-start:\s*var\(--runner-shell-rail-width\)\s*!important[\s\S]*box-sizing:\s*border-box[\s\S]*\.dashboard-body\.admin-command-page \.admin-command-sidebar[\s\S]*position:\s*fixed[\s\S]*height:\s*100dvh[\s\S]*\.dashboard-body\.admin-command-page \.admin-command-main[\s\S]*margin-left:\s*0\s*!important[\s\S]*width:\s*100%\s*!important[\s\S]*box-sizing:\s*border-box[\s\S]*overflow:\s*visible/,
  /@media \(max-width: 860px\)[\s\S]*\.dashboard-body\.admin-command-page \.admin-command-layout[\s\S]*padding-inline-start:\s*0\s*!important[\s\S]*\.dashboard-body\.admin-command-page \.admin-command-sidebar[\s\S]*position:\s*relative[\s\S]*height:\s*auto[\s\S]*\.dashboard-body\.admin-command-page \.admin-command-main[\s\S]*margin-left:\s*0\s*!important[\s\S]*width:\s*100%\s*!important[\s\S]*box-sizing:\s*border-box/,
]) {
  assert.match(
    styleSource,
    rule,
    'Long admin routes must keep the desktop rail anchored and reset the rail cleanly on mobile.',
  );
}

assert.match(
  styleSource,
  /@media \(prefers-reduced-motion: reduce\)/,
  'Admin monitoring interactions must honor reduced-motion preferences.',
);

assert.match(
  styleSource,
  /\.admin-command-page :is\([\s\S]*\.admin-command-route--users,[\s\S]*\.admin-command-route--courseMaps,[\s\S]*\.admin-command-route--shoes,[\s\S]*\.admin-command-route--jobs,[\s\S]*\.admin-command-route--audit,[\s\S]*\.admin-command-route--settings[\s\S]*padding:\s*clamp\(22px,\s*2\.8vw,\s*42px\)/,
  'Long-form admin workspaces should share a responsive outer inset around their content.',
);

assert(
  !dashboardSource.includes('admin-command-route__summary'),
  'Dashboard routes should enter through their Profile-style hero instead of rendering a duplicate global summary band.',
);

assert(
  !dashboardSource.includes('ops-settings-grid'),
  'Dashboard settings should expose one Profile-aligned control surface instead of a duplicated legacy grid.',
);

for (const profileSurface of [
  'admin-users-command-hero',
  'admin-track-hub-hero',
  'admin-shoe-stitch-hero',
  'admin-jobs-command-deck__hero',
  'admin-audit-terminal__hero',
  'admin-settings-studio__hero',
]) {
  assert.match(
    styleSource,
    new RegExp(`Profile-aligned admin workspace[\\s\\S]*\\.${profileSurface.replaceAll('_', '\\_')}`),
    `Admin route hero should participate in the shared Profile surface contract: ${profileSurface}`,
  );
}

assert.match(
  styleSource,
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.14fr\)\s+minmax\(280px,\s*0\.86fr\)[\s\S]*var\(--admin-profile-shadow\)/,
  'Course-map hero should use the same compact profile-style split grid as the users workspace.',
);

assert.match(
  styleSource,
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-grid,[\s\S]*\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*0\.38fr\)\s+minmax\(0,\s*0\.92fr\)/,
  'Course-map queue and map stage should share the profile-style two-column workbench.',
);

assert.match(
  styleSource,
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-sidebar__panel,[\s\S]*\.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-stage__header,[\s\S]*background:\s*var\(--course-map-surface-strong\)[\s\S]*box-shadow:\s*var\(--admin-profile-shadow-soft\)/,
  'Course-map queue, stage, and publish surfaces should use the profile paper/glass card tokens.',
);

assert.match(
  styleSource,
  /Liquid-glass pass for the course-map workspace[\s\S]*--course-map-surface:\s*rgba\(255, 251, 242, 0\.62\)[\s\S]*backdrop-filter:\s*blur\(24px\) saturate\(138%\)/,
  'Course-map shells should use a translucent liquid-glass layer rather than opaque cards.',
);

assert.match(
  styleSource,
  /admin-track-hub-map-panel__frame[\s\S]*backdrop-filter:\s*none/,
  'Interactive Leaflet map frames should stay crisp and outside the glass blur layer.',
);

assert.match(
  styleSource,
  /@media \(min-width: 1181px\)[\s\S]*admin-command-route--courseMaps \.admin-track-hub-footer-grid\.admin-coursemap-publish-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)\s+minmax\(0, 1fr\)[\s\S]*grid-template-areas:[\s\S]*"publish publish"[\s\S]*"review ops"/,
  'Course-map extraction output should span the desktop stage while review and operator panels share the row below.',
);

assert.match(
  styleSource,
  /admin-command-route--shoes \.admin-shoe-stitch-feature-card\s*\{[\s\S]*min-height:\s*0[\s\S]*height:\s*auto[\s\S]*\}[\s\S]*admin-command-route--shoes \.admin-shoe-stitch-feature-card__media\s*\{[\s\S]*aspect-ratio:\s*auto[\s\S]*align-self:\s*stretch[\s\S]*\}[\s\S]*admin-command-route--shoes \.admin-shoe-stitch-feature-card__media-image\s*\{[\s\S]*height:\s*100%[\s\S]*object-fit:\s*cover[\s\S]*\}[\s\S]*admin-command-route--shoes \.admin-shoe-stitch-feature-card__actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
      'Shoe review spotlight cards should stay content-sized, fill the card height with full-bleed media, and wrap actions inside the card.',
);

for (const route of ['/dashboard', '/dashboard/users', '/dashboard/course-maps', '/dashboard/shoes', '/dashboard/jobs', '/dashboard/audit', '/dashboard/settings']) {
  assert.match(
    dashboardSource,
    new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Dashboard route contract should remain present: ${route}`,
  );
}

console.log('[PASS] Dashboard monitoring design guardrails passed.');
