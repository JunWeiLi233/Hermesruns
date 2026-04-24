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

console.log('[PASS] Topbar notification contrast guardrails passed.');
