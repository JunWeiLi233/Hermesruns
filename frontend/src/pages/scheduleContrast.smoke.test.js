import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const scheduleStyles = readFileSync(path.join(root, 'styles', 'style.css'), 'utf8');

assert.match(
  scheduleStyles,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+\.runner-shell-page\.schedule-plan-page\.runner-dashboard-page\s+\.runner-shell-canvas\.schedule-plan-canvas\s+:is\(\.schedule-plan-hero\.schedule-plan-hero,\s*\.schedule-plan-next-card\.schedule-plan-next-card\)\s+:is\(h1,\s*h2,\s*h3,\s*h4,\s*strong,\s*label\)\s*\{[\s\S]*?color:\s*var\(--runner-minimal-ink,\s*var\(--text-strong\)\)\s*!important;/,
  'Schedule light-mode hero and next-session headings should keep dark readable text.',
);

assert.match(
  scheduleStyles,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+\.runner-shell-page\.schedule-plan-page\.runner-dashboard-page\s+\.runner-shell-canvas\.schedule-plan-canvas\s+:is\(\.schedule-plan-hero\.schedule-plan-hero,\s*\.schedule-plan-next-card\.schedule-plan-next-card\)\s+:is\(\.schedule-plan-kicker,\s*\.schedule-plan-hero-metrics span,\s*\.schedule-plan-hero-summary-chip span,\s*\.schedule-plan-next-content > span\)\s*\{[\s\S]*?color:\s*var\(--runner-minimal-muted,\s*rgba\(57,\s*67,\s*82,\s*0\.82\)\)\s*!important;/,
  'Schedule light-mode hero labels should keep readable muted text.',
);

console.log('[PASS] Schedule contrast smoke test passed.');
