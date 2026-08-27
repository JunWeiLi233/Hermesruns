import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-stat-card,\s*body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-coach-card,\s*body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-course-card,[^{]*\{\s*background:\s*#fff;/,
  'Race detail stat and outer card surfaces should use a pure white light-theme background.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-stat-card\.is-accent,\s*body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-coach-card\s*\{\s*background:\s*#fff;/,
  'Race detail accent stat and coach cards should use the same pure white light-theme background.',
);

console.log('[PASS] Race detail white-card surface guardrails passed.');
