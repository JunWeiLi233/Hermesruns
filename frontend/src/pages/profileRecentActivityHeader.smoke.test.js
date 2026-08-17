import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');
const redesignStyleSource = readFileSync(path.join(here, '../styles/_split/profile-dashboard-redesign.css'), 'utf8');
const liquidGlassStyleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

assert.match(
  profileSource,
  /className="hd-sessions-card"[\s\S]*className="hd-card-head"[\s\S]*sessions_kicker[\s\S]*sessions_title/,
  'Profile should keep the Recent activity and Training log labels in the sessions card header.',
);

assert.match(
  redesignStyleSource,
  /Keep recent-activity labels on the card surface[\s\S]*\.hd-sessions-card \.hd-card-head,[\s\S]*\.hd-sessions-card \.hd-card-head \*\s*\{[\s\S]*background:\s*transparent !important;/,
  'Recent activity and Training log header descendants should not render a colored background strip.',
);

assert.match(
  liquidGlassStyleSource,
  /The same sweep also matches the recent-activity header[\s\S]*\.hd-sessions-card \.hd-card-head,[\s\S]*\.hd-sessions-card \.hd-card-head \*\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;[\s\S]*backdrop-filter:\s*none !important;/,
  'The late shared liquid-glass sweep reset should remove gradients, shadows, and blur from the recent-activity header only.',
);

assert.match(
  redesignStyleSource,
  /\.runner-shell-page \.hd-content \.hd-sessions-card\s*\{[\s\S]*border-color:\s*var\(--hd-line-strong\) !important;[\s\S]*background:\s*var\(--hd-bg-card\) !important;[\s\S]*backdrop-filter:\s*none;/,
  'The recent-activity grid should stay on the plain white card surface while only the header strip is removed.',
);

assert.match(
  redesignStyleSource,
  /\.hd-session-row:hover\s*\{[\s\S]*background:\s*var\(--hd-bg-card-elevated\);/,
  'Session rows should keep their existing hover surface for interaction feedback.',
);

assert.match(
  redesignStyleSource,
  /\.runner-shell-page \.hd-content :is\([\s\S]*\.hd-predictions-card,[\s\S]*\.hd-stamina-card,[\s\S]*\.hd-streak-card,[\s\S]*\.profile-weekly-digest-card[\s\S]*\)\s*\{[\s\S]*background:\s*var\(--hd-bg-card\) !important;/,
  'The bottom-grid cards (predictions, stamina, streak, weekly digest) must stay on the white card surface, not the liquid-glass sweep.',
);

console.log('[PASS] Profile recent-activity header background guardrails passed.');
