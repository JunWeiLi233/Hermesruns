import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');
const liquidGlassStyleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

assert.match(
  profileSource,
  /shellClassName="runner-pr-modal-shell"[\s\S]*?cardClassName="runner-pr-modal-card"[\s\S]*?runner-pr-modal-hero[\s\S]*?runner-pr-modal-list[\s\S]*?runner-pr-modal-primary/,
  'The personal-record modal should retain its dedicated shell, hero, record list, and dismissal action.',
);

assert.match(
  profileSource,
  /icon={<AppIcon name="emoji_events" className="runner-pr-modal-icon" \/>}/,
  'The personal-record modal should use an achievement icon in the reference modal header.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-pr-modal-card\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 32px\);[\s\S]*?border:\s*1px solid color-mix\(in srgb, var\(--runner-profile-line\) 78%, white 22%\);[\s\S]*?background:[\s\S]*?var\(--runner-profile-card-strong\)/,
  'The personal-record dialog should use the bounded Profile paper surface rather than a dark celebration card.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-pr-modal-card \.modal-header::before\s*\{[\s\S]*?background:\s*var\(--runner-profile-flame\);/,
  'The personal-record header should use the same restrained coral marker as Profile modals.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-pr-modal-entry\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?box-shadow:\s*inset 0 -1px 0 var\(--runner-profile-line\);/,
  'Personal records should be a compact divided ledger instead of stacked dark tiles.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-pr-modal-primary\s*\{[\s\S]*?background:\s*var\(--runner-profile-action-bg\);[\s\S]*?color:\s*var\(--runner-profile-action-ink\);/,
  'The dismissal action should use the Profile primary-button colors.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-pr-modal-card \.modal-header-icon\s*\{[\s\S]*?background:\s*#fff0ec;[\s\S]*?color:\s*#f26956;/,
  'The personal-record dialog should expose the coral achievement icon treatment.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-pr-modal-primary\s*\{[\s\S]*?border-radius:\s*6px;[\s\S]*?background:\s*#111111;[\s\S]*?color:\s*#ffffff;/,
  'The PR dismissal action should follow the reference modal black action treatment.',
);

console.log('[PASS] Profile personal-record modal redesign guardrails passed.');
