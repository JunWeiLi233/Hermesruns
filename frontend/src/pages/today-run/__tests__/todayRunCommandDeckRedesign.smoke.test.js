import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(path.join(here, '../TodayRun.jsx'), 'utf8');
const styles = readFileSync(path.join(here, '../../../styles/_split/today-run.css'), 'utf8');
const design = styles.slice(styles.indexOf('/* Session-first Today Run.'));

assert.match(page, /today-run-session-page today-run-plan-page today-run-command-page/);
assert.match(page, /className="tr-session-hero tr-session-surface" aria-labelledby="tr-session-title"/);
assert.match(page, /<h1 id="tr-session-title">\{isDownshifted \? recommendation.type : coachSessionTitle\}/);
assert.match(page, /className="tr-session-timeline"/);
assert.equal((page.match(/blueprintSteps\.map/g) || []).length, 1,
  'Render the real training stages once, beside the session target.');
assert.equal((page.match(/<CoachIdentityBadge/g) || []).length, 1,
  'Keep a single coach explanation instead of duplicate coach panels.');
assert.match(page, /className="tr-session-evidence-note">\{t\('today_run.readiness_load_only'\)\}/);
assert.match(page, /<details className="tr-session-context">/);
assert.match(page, /aria-pressed=\{isDownshifted\}/);
assert.match(page, /navigate\('\/schedule'\)/);
assert.match(page, /navigate\('\/shoes'\)/);
assert.match(design, /--tr-surface:\s*var\(--ahs-surface/);
assert.match(design, /font-family:\s*var\(--ahs-font\)/);
assert.match(design, /\.theme-midnight, \.theme-high-contrast/);
assert.match(design, /@media \(max-width: 760px\)[\s\S]*\.tr-session-hero-layout \{ grid-template-columns: minmax\(0,1fr\)/);
assert.doesNotMatch(design, /min-height:\s*(?:[6-9]\d\d|\d{4,})px/,
  'The session layout must size to its content.');
console.log('[PASS] Today Run session-first design guard passed.');
