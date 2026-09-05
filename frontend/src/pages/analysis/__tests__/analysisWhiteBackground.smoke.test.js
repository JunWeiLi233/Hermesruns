import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const analysisSource = readFileSync(path.join(srcRoot, 'pages/Analysis.jsx'), 'utf8');
const analysisStyle = readFileSync(path.join(srcRoot, 'styles/_split/analysis.css'), 'utf8');
const whiteStyle = readFileSync(path.join(srcRoot, 'styles/grid-cards-white.css'), 'utf8');
const appStyle = readFileSync(path.join(srcRoot, 'styles/app.css'), 'utf8');
const summaryStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');
const whiteSectionStart = whiteStyle.indexOf('/* Analysis white surfaces');
const whiteSection = whiteStyle.slice(whiteSectionStart);

assert.doesNotMatch(
  analysisSource,
  /analysis-profile-decision-spine|analysis-profile-decision-chip/,
  'The Analysis overview should not render the removed three-tile VO2 metric grid.',
);

assert.doesNotMatch(
  analysisSource,
  /analysis-overview-vo2-tag/,
  'The Analysis VO2 chart should not render a floating value pill above the current bar.',
);

assert.match(
  analysisSource,
  /<small>\{t\('analysis\.stitch_vo2_unit'\)\}<\/small>/,
  'The Analysis VO2 hover modal should display the translated ML/kg/min unit.',
);

assert.match(
  analysisSource,
  /const currentMonthVdot = snapshot\.currentMonthVdot;[\s\S]*<strong>\{currentMonthVdot != null \? currentMonthVdot\.toFixed\(1\) : '--'\}<\/strong>/,
  'The Analysis VO2 hero should display the current month value instead of the representative lookback VDOT.',
);

assert.match(
  summaryStyle,
  /#root \.analysis-page-shell \.analysis-profile-reference-card\.is-coach\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*border-color:\s*transparent\s*!important;/,
  'The Analysis Coach Insight card should not render an outer border.',
);
assert.match(
  summaryStyle,
  /@media\s*\(min-width:\s*1280px\)[\s\S]*#root \.analysis-page-shell \.analysis-profile-reference-card\.is-load\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(132px,\s*174px\)\s*!important;/,
  'The wide Analysis load-balance card should group the semi-circle status beside its value on the right.',
);
assert.match(
  summaryStyle,
  /@media\s*\(min-width:\s*1181px\)[\s\S]*#root \.analysis-page-shell \.analysis-profile-reference-grid\s*\{[\s\S]*grid-template-areas:[\s\S]*"load trend"[\s\S]*"coach injury"[\s\S]*#root \.analysis-page-shell \.analysis-profile-reference-card\.is-load\s*\{[\s\S]*grid-area:\s*load\s*!important;[\s\S]*#root \.analysis-page-shell \.analysis-profile-reference-card\.is-trend\s*\{[\s\S]*grid-area:\s*trend\s*!important;/,
  'The wide Analysis grid should place workload and fitness change on one row.',
);

assert.match(
  analysisStyle,
  /\.analysis-page-shell \.analysis-overview-vo2-tooltip\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*box-shadow:/,
  'The Analysis VO2 hover details should read as a borderless modal.',
);

assert.match(
  analysisSource,
  /<h2 className="analysis-overview-vdot-title">\s*<AppIcon name="directions_run" className="analysis-overview-vdot-runner-icon" \/>/,
  'The VO2max heading should use the shared runner icon on its left side.',
);

assert.match(
  analysisSource,
  /analysis-overview-hero-value-label[^>]*>\{t\('profile\.analysis_current_vo2'\)\}[\s\S]*analysis-overview-hero-value-row[\s\S]*analysis-overview-hero-value-unit/,
  'The VO2 metric should identify the 52.1 value above its unit using localized copy.',
);

assert.match(
  analysisSource,
  /analysis-overview-card--load[\s\S]*analysis-overview-card-kicker--load[\s\S]*<AppIcon name="load_balance" className="analysis-load-balance-icon"/,
  'The Analysis load-balance card should use its dedicated balance icon beside the localized label.',
);

assert.match(
  analysisStyle,
  /\.analysis-overview-card-head \.analysis-overview-vdot-title\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;/,
  'The VO2max heading should align its runner icon and title inline.',
);

assert.match(
  analysisStyle,
  /\.analysis-overview-card-head \.analysis-overview-vdot-runner-icon\s*\{[\s\S]*color:\s*var\(--accent-coral-strong\);/,
  'The VO2max runner icon should use the existing coral accent.',
);

assert.match(
  analysisStyle,
  /\.analysis-page-shell \.analysis-overview-card-kicker--load\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*\.analysis-page-shell \.analysis-load-balance-icon\s*\{[\s\S]*width:\s*18px;[\s\S]*color:\s*var\(--accent-coral-strong, #f07561\);/,
  'The load-balance icon should use a compact inline treatment in the Analysis card label.',
);

assert.match(
  analysisStyle,
  /Analysis VO2 hero full-width composition[\s\S]*@media\s*\(min-width:\s*1181px\)[\s\S]*\.analysis-page-shell \.analysis-profile-cockpit\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[\s\S]*\.analysis-profile-cockpit\s*>\s*\.analysis-profile-primary,[\s\S]*\.analysis-profile-cockpit\s*>\s*\.analysis-profile-reference-grid\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1;/,
  'The desktop Analysis layout should place the full-width VO2 card above its three-card reference stack.',
);

assert.match(
  analysisStyle,
  /Analysis VO2 chart lower-right composition[\s\S]*@media\s*\(min-width:\s*1280px\)[\s\S]*\.analysis-page-shell \.analysis-profile-primary\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*0\.34fr\)\s+minmax\(640px,\s*0\.66fr\)\s*!important;[\s\S]*grid-template-rows:\s*auto\s+minmax\(190px,\s*1fr\)\s+auto;[\s\S]*\.analysis-profile-primary \.analysis-overview-card-head\s*\{[\s\S]*display:\s*contents;[\s\S]*\.analysis-profile-primary \.analysis-overview-card-head h2\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*1;[\s\S]*\.analysis-profile-primary \.analysis-overview-hero-value\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*2;[\s\S]*align-self:\s*end;[\s\S]*justify-self:\s*start;[\s\S]*\.analysis-profile-primary \.analysis-overview-vo2-bars\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*1\s*\/\s*span\s*3;[\s\S]*align-self:\s*end;[\s\S]*justify-self:\s*end;[\s\S]*\.analysis-profile-primary \.analysis-overview-vo2-legend\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*3;/,
  'The wide Analysis VO2 card should keep the chart lower-right and the value card lower-left.',
);

assert.match(
  analysisStyle,
  /Analysis VO2 Apple Fitness language[\s\S]*@media\s*\(min-width:\s*761px\)[\s\S]*\.analysis-page-shell\.analysis-page-shell \.analysis-profile-primary\.analysis-profile-primary\s*\{[\s\S]*min-height:\s*clamp\(360px,\s*28rem,\s*440px\);[\s\S]*border-radius:\s*16px\s*!important;/,
  'The desktop VO2 card should use a compact Apple Fitness-style surface.',
);

assert.match(
  analysisStyle,
  /\.analysis-page-shell \.analysis-profile-primary \.analysis-overview-hero-value\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'The VO2 primary metric should remain a borderless value, not a nested card.',
);

assert.match(
  analysisStyle,
  /\.analysis-page-shell \.analysis-profile-primary \.analysis-overview-vo2-bars\s*\{[\s\S]*border:\s*0;[\s\S]*border-radius:\s*14px;[\s\S]*background:\s*#f5f5f7\s*!important;/,
  'The VO2 chart lane should use a quiet rounded Apple Fitness-style surface.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*#root \.analysis-page-shell > \.runner-shell-sidebar\s*\{[\s\S]*display:\s*flex !important;[\s\S]*#root \.analysis-page-shell > \.runner-shell-main\s*\{[\s\S]*margin-left:\s*0 !important;[\s\S]*grid-column:\s*2 !important;/,
  'The restored Analysis reference should retain the shared Profile side rail and collapsed main-column offset.',
);

assert.match(
  summaryStyle,
  /#root \.analysis-page-shell:not\(\.is-sidebar-collapsed\),\s*\r?\n\s*#root \.analysis-page-shell\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:hover\),\s*\r?\n\s*#root \.analysis-page-shell\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:focus-within\)\s*\{[\s\S]*grid-template-columns:\s*var\(--runner-nav-expanded-width,\s*156px\)\s+minmax\(0,\s*1fr\)\s*!important;/,
  'Analysis grids must squeeze into the remaining width when the left runner sidebar is expanded or hover-expanded.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*runner-shell-topbar\s*\{[\s\S]*position:\s*fixed !important;[\s\S]*left:\s*var\(--runner-nav-collapsed-width, 96px\) !important;[\s\S]*top:\s*0 !important;[\s\S]*background:\s*#f5f5f7 !important;[\s\S]*background-image:\s*none !important;/,
  'The Analysis topbar should match the page background and remain fixed while scrolling.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*analysis-profile-primary\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px, 0\.34fr\) minmax\(0, 0\.66fr\) !important;[\s\S]*height:\s*440px !important;/,
  'The restored Analysis reference should keep the 440px VO2 hero and lower-right chart structure.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*analysis-overview-vo2-bars\s*\{[\s\S]*width:\s*min\(72%, 640px\) !important;[\s\S]*height:\s*74% !important;/,
  'The restored Analysis reference should keep the VO2 bar chart compact within the hero.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*analysis-overview-vdot-runner-icon\s*\{[\s\S]*color:\s*#ff634f !important;[\s\S]*analysis-overview-vo2-bar\s*\{[\s\S]*background:\s*#ff634f !important;[\s\S]*analysis-overview-vo2-bar\.is-current,[\s\S]*analysis-overview-vo2-bar\.is-hovered[\s\S]*background:\s*#ff634f !important;/,
  'The VO2 bars should share the runner icon coral color in every visible state.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*h2\.analysis-overview-vdot-title\s*\{[\s\S]*color:\s*#ff634f !important;/,
  'The VO2max trend heading should share the runner icon coral color.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*analysis-overview-vo2-label\s*\{[\s\S]*color:\s*#8a8a92 !important;[\s\S]*analysis-overview-vo2-label\.is-current\s*\{[\s\S]*color:\s*#8a8a92 !important;/,
  'The VO2 month labels should use a light-grey color, including the current month.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*analysis-profile-reference-card\.is-load\s*\{[\s\S]*grid-template-areas:[\s\S]*min-height:\s*192px !important;[\s\S]*height:\s*192px !important;/,
  'The restored Analysis reference should keep the full-width 192px load-balance row.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*analysis-profile-reference-card\.is-load\s*\{[\s\S]*border:\s*0 !important;/,
  'The Analysis load-balance row should not render an outer border.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*analysis-profile-reference-card\.is-load\s*\{[\s\S]*box-shadow:\s*none !important;/,
  'The Analysis load-balance row should not render a shadow that reads as a grey outline.',
);

assert.match(
  summaryStyle,
  /DV-2026-09-04-006 Analysis reference restoration[\s\S]*analysis-profile-table-grid\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*border:\s*0 !important;[\s\S]*box-shadow:\s*none !important;/,
  'The Analysis table-grid wrapper should not connect the training and prediction cards with an outer surface.',
);

assert.ok(whiteSectionStart >= 0, 'The white-surface stylesheet should document the Analysis background override.');
assert.match(
  appStyle,
  /@import '\.\/grid-cards-white\.css';/,
  'The Analysis white-surface override must remain in the final app stylesheet cascade.',
);

assert.match(
  appStyle,
  /@import '\.\/analysis-summary\.css';/,
  'The Analysis restoration and compact chart rules must be included in the runtime app stylesheet cascade.',
);

assert.match(
  whiteSection,
  /body:is\(\.theme-light, \.theme-high-contrast-light\):has\(#root \.analysis-page-shell\)\s*\{[\s\S]*background:\s*#fff\s*!important;[\s\S]*background-image:\s*none\s*!important;/,
  'The light Analysis route should use a plain white page background.',
);

assert.match(
  whiteSection,
  /#root \.analysis-page-shell \.runner-shell-canvas::before\s*\{[\s\S]*content:\s*none\s*!important;[\s\S]*display:\s*none\s*!important;/,
  'The Analysis canvas should remove the decorative grid pseudo-element.',
);

assert.match(
  whiteSection,
  /#root \.analysis-page-shell :is\([\s\S]*\.analysis-overview-grid,[\s\S]*\.analysis-profile-cockpit,[\s\S]*\.analysis-profile-bento-grid,[\s\S]*\.analysis-profile-table-grid,[\s\S]*\.analysis-overview-card,[\s\S]*\.analysis-overview-vo2-bars[\s\S]*\)\s*\{[\s\S]*background:\s*#fff\s*!important;[\s\S]*background-image:\s*none\s*!important;/,
  'Analysis grids and cards should use plain white surfaces in light themes.',
);

assert.match(
  whiteSection,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-overview-hero-value\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*background-image:\s*none\s*!important;/,
  'The Analysis VO2 value should not render as a separate background card in light themes.',
);

const borderSectionStart = whiteStyle.indexOf('/* Analysis Apple card borders');
const borderSection = whiteStyle.slice(borderSectionStart);
assert.ok(borderSectionStart >= 0, 'The white-surface stylesheet should document the Analysis Apple card border override.');
assert.doesNotMatch(
  borderSection,
  /#root \.analysis-page-shell\s*\{[\s\S]*border:/,
  'The Analysis page should not use the former custom outer frame.',
);
assert.match(
  borderSection,
  /#root \.analysis-page-shell :is\([\s\S]*\.analysis-overview-card,[\s\S]*\.analysis-injury-prevention-section\s*\)\s*\{[\s\S]*border:\s*1px\s+solid\s+rgba\(60,\s*60,\s*67,\s*0\.18\)\s*!important;[\s\S]*border-radius:\s*12px\s*!important;[\s\S]*box-shadow:\s*0\s+1px\s+3px\s+rgba\(0,\s*0,\s*0,\s*0\.08\)\s*!important;/,
  'Analysis cards should use subtle Apple-style borders.',
);
assert.match(
  borderSection,
  /#root \.analysis-page-shell \.analysis-profile-primary\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*border-radius:\s*16px\s*!important;[\s\S]*0\s+8px\s+24px\s+rgba\(60,\s*60,\s*67,\s*0\.045\)\s*!important;/,
  'The light-theme VO2 hero should use shadow-only separation like the reference.',
);
assert.match(
  whiteSection,
  /#root \.analysis-page-shell \.runner-shell-canvas\s*\{[\s\S]*background:\s*#f5f5f7\s*!important;[\s\S]*background-image:\s*none\s*!important;/,
  'The light Analysis canvas should provide the pale backdrop around white cards.',
);
assert.doesNotMatch(
  borderSection,
  /#root \.analysis-page-shell :is\([\s\S]*\.analysis-overview-vo2-bars[\s\S]*\)\s*\{[\s\S]*border:/,
  'The Analysis VO2 graph should not render an outer border.',
);
assert.doesNotMatch(
  analysisStyle,
  /\.analysis-page-shell \.analysis-overview-vo2-bars\s*\{[^}]*border:/,
  'The Analysis VO2 graph base container should not render an outer border.',
);

console.log('[PASS] Analysis white background and grid surface contract passed.');
