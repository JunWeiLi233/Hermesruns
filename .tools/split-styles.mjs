#!/usr/bin/env node
/**
 * Splits frontend/src/styles/style.css into per-surface files under
 * frontend/src/styles/_split/. Routes each top-level CSS block by the
 * first class in its selector (or, for @media blocks, by the first class
 * inside the wrapper). Preserves source order inside each bucket so
 * intra-surface cascade is unchanged.
 *
 * Cascade ordering across files is reconstructed in index.css by importing
 * tokens / shell first, then surfaces alphabetically, then theme overrides
 * and the quarantined legacy-frame block last.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'frontend/src/styles/style.css');
const OUT_DIR = join(ROOT, 'frontend/src/styles/_split');

const text = readFileSync(SRC, 'utf8');

function tokenize(src) {
  const blocks = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    while (i < n && /\s/.test(src[i])) i++;
    if (i >= n) break;

    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) break;
      blocks.push({ kind: 'comment', head: '', text: src.slice(i, end + 2) });
      i = end + 2;
      continue;
    }

    const startI = i;
    let head = '';
    let inString = null;

    while (i < n) {
      const c = src[i];
      if (inString) {
        head += c;
        if (c === '\\' && i + 1 < n) { i++; head += src[i]; i++; continue; }
        if (c === inString) inString = null;
        i++;
        continue;
      }
      if (c === '"' || c === "'") { inString = c; head += c; i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        if (end < 0) { i = n; break; }
        head += src.slice(i, end + 2);
        i = end + 2;
        continue;
      }
      if (c === '{' || c === ';') break;
      head += c;
      i++;
    }

    if (i >= n) break;

    if (src[i] === ';') {
      blocks.push({ kind: 'atrule-flat', head: head.trim(), text: src.slice(startI, i + 1) });
      i++;
      continue;
    }

    let depth = 1;
    i++;
    inString = null;
    while (i < n && depth > 0) {
      const c = src[i];
      if (inString) {
        if (c === '\\' && i + 1 < n) { i += 2; continue; }
        if (c === inString) inString = null;
        i++;
        continue;
      }
      if (c === '"' || c === "'") { inString = c; i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        if (end < 0) { i = n; break; }
        i = end + 2;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }

    blocks.push({ kind: 'block', head: head.trim(), text: src.slice(startI, i) });
  }

  return blocks;
}

function firstClass(head) {
  const m = head.match(/\.([a-zA-Z][a-zA-Z0-9_-]*)/);
  return m ? m[1].toLowerCase() : null;
}

function classifyClass(cls) {
  if (!cls) return 'misc';
  if (cls.startsWith('hermes-site-frame')) return 'legacy-frame';
  if (cls.startsWith('weather-')) return 'weather';
  if (cls.startsWith('analysis-')) return 'analysis';
  if (cls.startsWith('coach-identity')) return 'analysis';
  if (cls.startsWith('runner-dashboard-profile') || cls.startsWith('profile-dashboard') || cls.startsWith('profile-page')) return 'profile';
  if (cls.startsWith('runner-dashboard')) return 'profile';
  if (cls.startsWith('runner-streak') || cls.startsWith('streak-protection')) return 'profile';
  if (cls.startsWith('runner-pr-') || cls.startsWith('runner-comeback') || cls.startsWith('runner-progression')) return 'profile';
  if (cls.startsWith('runner-shell')) return 'runner-shell';
  if (cls.startsWith('races-') || cls.startsWith('race-')) return 'races';
  if (cls.startsWith('shoes-') || cls.startsWith('shoe-') || cls.startsWith('add-shoes') || cls === 'add' || cls.startsWith('scan-')) return 'shoes';
  if (cls.startsWith('today-run')) return 'today-run';
  if (cls.startsWith('mt-') || cls.startsWith('muscle-') || cls.startsWith('musclex') || cls.startsWith('strength-')) return 'muscle-training';
  if (cls.startsWith('admin-')) return 'admin';
  if (cls.startsWith('landing-')) return 'landing';
  if (cls.startsWith('schedule-')) return 'schedule';
  if (cls.startsWith('runs-dashboard') || cls.startsWith('runs-page')) return 'runs';
  if (cls.startsWith('recent-runs') || cls.startsWith('run-detail') || cls.startsWith('history-')) return 'runs';
  if (cls.startsWith('weekly-flashcard') || cls === 'weekly') return 'runs';
  if (cls.startsWith('territory-') || cls.startsWith('terr-')) return 'territory';
  if (cls.startsWith('rewards-') || cls.startsWith('reward-')) return 'rewards';
  if (cls.startsWith('workflow-') || cls.startsWith('wf-')) return 'workflow';
  if (cls.startsWith('glass-') || cls === 'theme-light' || cls === 'theme-midnight') return 'tokens';
  if (cls.startsWith('auth-') || cls.startsWith('login-') || cls.startsWith('signup')) return 'auth';
  if (cls.startsWith('heatmap-')) return 'heatmap';
  if (cls.startsWith('hermes-logo') || cls.startsWith('app-icon') || cls.startsWith('footer-')) return 'shared';
  if (cls.startsWith('topbar-') || cls === 'shared-topbar') return 'shared';
  if (cls.startsWith('predict')) return 'analysis';
  if (cls.startsWith('vo2max') || cls.startsWith('vdot') || cls.startsWith('injury-')) return 'analysis';
  if (cls.startsWith('settings-')) return 'settings';
  if (cls.startsWith('garmin-') || cls.startsWith('import-') || cls.startsWith('integration-') || cls.startsWith('strava-')) return 'integrations';
  if (cls.startsWith('subscription-') || cls.startsWith('billing-') || cls.startsWith('stripe-') || cls.startsWith('paywall')) return 'subscription';
  if (cls.startsWith('img-') || cls.startsWith('image-') || cls.startsWith('icon-')) return 'shared';
  if (cls.startsWith('section-') || cls.startsWith('page-') || cls.startsWith('btn-') || cls === 'btn') return 'shared';
  if (cls.startsWith('app-notice') || cls.startsWith('app-error') || cls.startsWith('status-chip') || cls.startsWith('premium-empty') || cls.startsWith('card-loading') || cls.startsWith('unit-toggle')) return 'shared';
  if (cls.startsWith('lv2-') || cls.startsWith('lv-') || cls === 'lv') return 'landing';
  if (cls.startsWith('world-race') || cls.startsWith('world-races')) return 'races';
  if (cls.startsWith('top-nav') || cls.startsWith('nav-brand') || cls.startsWith('user-menu') || cls.startsWith('profile-system') || cls.startsWith('provider-pill') || cls.startsWith('service-icon') || cls.startsWith('brand-content')) return 'shared';
  if (cls.startsWith('metric-card') || cls.startsWith('data-table') || cls.startsWith('table-card') || cls.startsWith('stats-row') || cls === 'card' || cls.startsWith('form-section') || cls.startsWith('data-freshness')) return 'shared';
  if (cls.startsWith('pwd-strength') || cls.startsWith('social-login') || cls.startsWith('forgot-password') || cls.startsWith('sync-btn')) return 'auth';
  if (cls.startsWith('run-item')) return 'runs';
  if (cls.startsWith('profile-')) return 'profile';
  if (cls.startsWith('strava-sync')) return 'integrations';
  if (cls === 'strava' || cls.startsWith('strava-')) return 'integrations';
  return 'misc';
}

function classifyHead(head) {
  const trimmed = head.trim();
  if (!trimmed) return 'misc';
  if (trimmed.startsWith(':root')) return 'tokens';
  if (/^\[data-theme/i.test(trimmed)) return 'tokens';
  if (/^body[:\.]?(is\()?\s*\.theme/i.test(trimmed)) return 'light-theme-overrides';
  if (trimmed.startsWith('body:is(.theme') || trimmed.startsWith('body.theme')) return 'light-theme-overrides';
  return classifyClass(firstClass(trimmed));
}

function classifyMediaBlock(block) {
  // Find first selector inside the @media body
  const idx = block.text.indexOf('{');
  if (idx < 0) return 'misc';
  const body = block.text.slice(idx + 1);
  // Skip whitespace + comments
  let j = 0;
  while (j < body.length && /\s/.test(body[j])) j++;
  while (body[j] === '/' && body[j + 1] === '*') {
    const e = body.indexOf('*/', j + 2);
    if (e < 0) break;
    j = e + 2;
    while (j < body.length && /\s/.test(body[j])) j++;
  }
  // Read first selector
  let head = '';
  while (j < body.length && body[j] !== '{' && body[j] !== '}') {
    head += body[j];
    j++;
  }
  return classifyHead(head) || 'misc';
}

const blocks = tokenize(text);
console.error('Parsed', blocks.length, 'top-level blocks');

const buckets = new Map();
const stats = { byBucket: {}, atrules: 0, comments: 0 };

function push(name, text) {
  if (!buckets.has(name)) buckets.set(name, []);
  buckets.get(name).push(text);
  stats.byBucket[name] = (stats.byBucket[name] || 0) + 1;
}

let pendingComments = [];

for (const b of blocks) {
  if (b.kind === 'comment') {
    pendingComments.push(b.text);
    stats.comments++;
    continue;
  }
  if (b.kind === 'atrule-flat') {
    push('tokens', b.text);
    stats.atrules++;
    pendingComments = [];
    continue;
  }
  let target;
  if (b.head.startsWith('@media') || b.head.startsWith('@supports')) {
    target = classifyMediaBlock(b);
  } else if (b.head.startsWith('@keyframes') || b.head.startsWith('@font-face')) {
    target = 'tokens';
  } else {
    target = classifyHead(b.head);
  }
  if (!target) target = 'misc';
  // Attach pending comments to this block's bucket
  for (const c of pendingComments) push(target, c);
  pendingComments = [];
  push(target, b.text);
}
// Flush any trailing comments
for (const c of pendingComments) push('misc', c);

mkdirSync(OUT_DIR, { recursive: true });

const importOrder = [
  'tokens',
  'runner-shell',
  'shared',
  'auth',
  'landing',
  'profile',
  'analysis',
  'today-run',
  'runs',
  'races',
  'schedule',
  'shoes',
  'muscle-training',
  'territory',
  'heatmap',
  'weather',
  'rewards',
  'workflow',
  'settings',
  'integrations',
  'subscription',
  'admin',
  'misc',
  'light-theme-overrides',
  'legacy-frame',
];

const sizes = {};
const writtenBuckets = [];

for (const name of importOrder) {
  if (!buckets.has(name)) continue;
  const parts = buckets.get(name);
  const out = parts.join('\n\n') + '\n';
  writeFileSync(join(OUT_DIR, `${name}.css`), out);
  sizes[name] = {
    lines: out.split('\n').length,
    blocks: stats.byBucket[name] || 0,
    bytes: out.length,
  };
  writtenBuckets.push(name);
}

// Any buckets that the importOrder list missed
for (const [name, parts] of buckets) {
  if (sizes[name]) continue;
  const out = parts.join('\n\n') + '\n';
  writeFileSync(join(OUT_DIR, `${name}.css`), out);
  sizes[name] = { lines: out.split('\n').length, blocks: stats.byBucket[name] || 0, bytes: out.length };
  writtenBuckets.push(name);
}

console.error('Wrote', writtenBuckets.length, 'bucket files to', OUT_DIR);
console.log(JSON.stringify({ buckets: writtenBuckets, sizes, totals: stats }, null, 2));
