import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(path.join(here, '../TodayRun.jsx'), 'utf8');
const design = readFileSync(path.join(here, '../../../styles/today-run-v2.css'), 'utf8');

assert.match(page, /today-run-session-page today-run-plan-page today-run-command-page/);
assert.match(page, /tr-v2-hero\$\{isDownshifted[\s\S]*aria-labelledby="tr-session-title"/);
assert.match(page, /<h1 id="tr-session-title">\{isDownshifted \? recommendation.type : coachSessionTitle\}/);
assert.match(page, /className="tr-v2-structure-bar" aria-hidden="true"/);
assert.equal((page.match(/blueprintSteps\.map/g) || []).length, 2,
  'Render the duration bar and its accessible stage details from the same plan.');
assert.equal((page.match(/<CoachIdentityBadge/g) || []).length, 1,
  'Keep a single coach explanation instead of duplicate coach panels.');
assert.match(page, /className="tr-v2-gate-note">\{t\('today_run.readiness_load_only'\)\}/);
assert.match(page, /<details className="tr-v2-context">/);
assert.match(page, /aria-pressed=\{isDownshifted\}/);
assert.match(page, /navigate\('\/schedule'\)/);
assert.match(page, /navigate\('\/shoes'\)/);
assert.match(design, /--tr-gate-bg:\s*linear-gradient/);
assert.match(design, /font-family:\s*var\(--font-display\)/);
assert.match(design, /\.theme-midnight, \.theme-high-contrast/);
assert.match(design, /@media \(max-width: 1100px\)[\s\S]*\.tr-v2-hero \{ grid-template-columns: minmax\(0, 1fr\)/);
assert.doesNotMatch(design, /min-height:\s*(?:[6-9]\d\d|\d{4,})px/,
  'The session layout must size to its content.');
console.log('[PASS] Today Run session-first design guard passed.');
