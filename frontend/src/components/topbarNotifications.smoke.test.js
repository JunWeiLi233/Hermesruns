import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'TopbarNotifications.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const profileStyleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

assert.match(
  componentSource,
  /runner-shell-notification-popover is-zh/,
  'TopbarNotifications should keep the Chinese notification popover variant hook.'
);

assert.match(
  styleSource,
  /body\.theme-light\s+\.runner-shell-notification-head strong,[\s\S]*\.runner-shell-notification-card strong/,
  'The light-theme notification popover should set readable heading colors for both the shell header and notification cards.'
);

assert.match(
  styleSource,
  /body\.theme-light\s+\.runner-shell-notification-head p,[\s\S]*\.runner-shell-notification-card p/,
  'The light-theme notification popover should set readable body-copy colors for both the shell header and notification cards.'
);

assert.match(
  styleSource,
  /\.runner-shell-notification-popover\s*\{[\s\S]*white-space:\s*normal;/,
  'Notification popovers must reset the topbar action nowrap so Chinese copy can wrap inside the card.'
);

assert.match(
  styleSource,
  /\.runner-shell-notification-popover\.is-zh\s*\{[\s\S]*line-break:\s*anywhere;/,
  'Chinese notification popovers should allow compact wrapping instead of clipping long mixed Chinese/Latin sentences.'
);

assert.match(
  componentSource,
  /NOTIFICATION_DELETED_STORAGE_KEY/,
  'Topbar notifications should persist deleted message ids.'
);

assert.match(
  componentSource,
  /className="runner-shell-notification-delete"/,
  'Each topbar notification message should expose a delete button.'
);

assert.match(
  componentSource,
  /runner-shell-notification-heading-icon/,
  'The notification header should provide a compact visual anchor.'
);

assert.match(
  componentSource,
  /runner-shell-notification-card-icon/,
  'Each notification row should provide a contextual leading icon.'
);

assert.doesNotMatch(
  componentSource,
  /runner-shell-notification-delete-label/,
  'The delete control should stay icon-only without a text label.'
);

assert.match(
  profileStyleSource,
  /\.runner-shell-page \.runner-shell-notification-popover\s*\{[\s\S]*border:\s*1px solid var\(--runner-profile-line\);[\s\S]*var\(--runner-profile-card-strong\) !important;/,
  'The training-message popover should use the Profile paper, border, and surface tokens.'
);

assert.match(
  profileStyleSource,
  /\.runner-shell-page \.runner-shell-notification-card\s*\{[\s\S]*grid-template-columns:\s*34px minmax\(0, 1fr\) 28px;[\s\S]*border-radius:\s*16px;[\s\S]*box-shadow:\s*none !important;/,
  'Training messages should use compact icon-led rows instead of oversized nested cards.'
);

assert.match(
  profileStyleSource,
  /\.runner-shell-page \.runner-shell-notification-card\s*\{[\s\S]*background:\s*transparent !important;/,
  'Training-message rows should sit directly on the notification paper without nested panel strips.'
);

assert.doesNotMatch(
  profileStyleSource,
  /\.runner-shell-page \.runner-shell-notification-card::before/,
  'Training-message rows should not render decorative color strips.'
);

assert.match(
  profileStyleSource,
  /\.runner-shell-page \.runner-shell-notification-delete\s*\{[\s\S]*width:\s*28px;[\s\S]*border-radius:\s*999px;[\s\S]*background:\s*transparent !important;[\s\S]*var\(--runner-profile-muted\) !important;/,
  'Delete actions should be quiet circular controls that reveal the destructive accent on interaction.'
);

assert.match(
  profileStyleSource,
  /\.runner-shell-page \.runner-shell-notification-popover\s*\{[\s\S]*backdrop-filter:\s*blur\(26px\) saturate\(135%\);[\s\S]*animation:\s*runner-shell-notification-in/,
  'The notification sheet should use the shared material treatment with a restrained entrance.'
);

assert.match(
  profileStyleSource,
  /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*runner-shell-notification-popover[\s\S]*animation:\s*none;/,
  'Notification motion should be disabled for reduced-motion preferences.'
);

assert.match(
  profileStyleSource,
  /\.runner-shell-page \.runner-shell-notification-list\s*\{[\s\S]*max-height:\s*min\(52vh, 390px\);[\s\S]*overflow-y:\s*auto;/,
  'The notification list should remain compact and scroll internally when more messages arrive.'
);

console.log('[PASS] Topbar notification contrast, wrapping, and delete guardrails passed.');
