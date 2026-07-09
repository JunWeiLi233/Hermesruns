import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'TopbarNotifications.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  componentSource,
  /runner-shell-notification-popover is-zh/,
  'TopbarNotifications should keep the Chinese notification popover variant hook.'
);

assert.match(
  styleSource,
  /body\.theme-light\s+\.runner-shell-notification-head strong[\s\S]*body\.theme-light\s+\.runner-shell-notification-card strong/,
  'The light-theme notification popover should set readable heading colors for both the shell header and notification cards.'
);

assert.match(
  styleSource,
  /body\.theme-light\s+\.runner-shell-notification-head p[\s\S]*body\.theme-light\s+\.runner-shell-notification-card p/,
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

assert.doesNotMatch(
  componentSource,
  /runner-shell-notification-delete-label/,
  'The delete control should stay icon-only without a text label.'
);

assert.match(
  styleSource,
  /\.runner-shell-notification-delete\s*\{[\s\S]*background:\s*#a0392a;/,
  'The message delete button should use a high-contrast filled background.'
);

assert.match(
  styleSource,
  /\.runner-shell-notification-delete \.runner-dashboard-side-link-icon\s*\{[\s\S]*width:\s*24px;/,
  'The icon-only delete button should render a large, readable trash icon.'
);

console.log('[PASS] Topbar notification contrast, wrapping, and delete guardrails passed.');
