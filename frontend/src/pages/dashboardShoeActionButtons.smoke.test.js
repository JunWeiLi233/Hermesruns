import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/admin-monitoring-dashboard.css'), 'utf8');

assert.match(
  dashboardSource,
  /admin-shoe-stitch-feature-card__actions[\s\S]*className="btn-primary btn-inline-md"[\s\S]*className="btn-secondary btn-inline-md"[\s\S]*className="delete-btn"/,
  'Shoe review cards should keep a distinct primary, secondary, and destructive action hierarchy.',
);

assert.match(
  styleSource,
  /admin-shoe-stitch-feature-card__actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.15fr\)\s+minmax\(0,\s*1fr\)/,
  'Shoe review actions should use a balanced two-column row for the main actions.',
);

assert.match(
  styleSource,
  /admin-shoe-stitch-feature-card__actions > button\s*\{[\s\S]*white-space:\s*nowrap[\s\S]*clip-path:\s*none/,
  'Shoe review labels should stay readable in compact cards without clipped or vertical text.',
);

assert.match(
  styleSource,
  /admin-shoe-stitch-feature-card__actions > \.delete-btn\s*\{[\s\S]*grid-column:\s*1 \/ -1[\s\S]*width:\s*100%/,
  'The destructive action should be separated into a full-width row.',
);

console.log('[PASS] Dashboard shoe action button guardrails passed.');
