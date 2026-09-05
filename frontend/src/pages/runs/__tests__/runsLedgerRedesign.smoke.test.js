import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8');
const splitRunsStyle = readFileSync(path.join(here, "../../../styles/_split/runs.css"), 'utf8');
const lateGridStyle = readFileSync(path.join(here, "../../../styles/grid-cards-white.css"), 'utf8');
const lateCascadeStyle = readFileSync(path.join(here, "../../../styles/analysis-detail-redesigns.css"), 'utf8');

function between(source, start, end, label) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `${label} should include ${start}.`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `${label} should include ${end} after ${start}.`);
  return source.slice(startIndex, endIndex);
}

const ledgerBlock = between(
  splitRunsStyle,
  '/* Runs ledger redesign. Reference source: design.md Kinetic Editorial. */',
  '/* Profile-aligned Run Detail cockpit polish */',
  'split Runs stylesheet',
);

assert.match(
  runsSource,
  /runs-dashboard-page runs-ledger-page/,
  'Runs page shell should expose the new ledger redesign scope.',
);

assert.match(
  runsSource,
  /className="integration-alert-shell runs-dashboard-shell runs-ledger-awaiting"/,
  'The no-data Runs state should use the ledger awaiting surface.',
);

assert.match(
  runsSource,
  /className="recent-runs-shell runs-dashboard-shell runs-profile-history runs-ledger-redesign"/,
  'The history Runs state should use the ledger redesign surface.',
);

assert.match(
  runsSource,
  /await apiJson\(`\/api\/activities\/\$\{run\.id\}`, \{ method: 'DELETE' \}\);/,
  'A confirmed deletion should await the shared JSON client before updating the ledger.',
);

assert.doesNotMatch(
  runsSource,
  /(?:const|let|var)\s+\w+\s*=\s*await apiJson\(`\/api\/activities\/\$\{run\.id\}`[\s\S]{0,180}\.ok/,
  'Runs must not inspect Response.ok on apiJson parsed payloads.',
);

assert.match(
  runsSource,
  /setIntegrationNoticeTone\('alert'\)/,
  'Delete failures should use the existing alert tone class.',
);

assert.doesNotMatch(
  runsSource,
  /strava_sync_app_inactive/,
  'Runs should not render the removed inactive-Strava warning copy.',
);

assert.match(
  runsSource,
  /awaiting_error_code_linked/,
  'Runs should keep the connected-Strava status kicker above the card title.',
);

assert.doesNotMatch(
  runsSource,
  /<p>\{awaitingStatus\}<\/p>/,
  'Runs should remove the connected-state status paragraph while keeping the card title and kicker.',
);

assert.match(
  ledgerBlock,
  /#root\s+\.runs-dashboard-page\.runs-ledger-page\s*\{/,
  'Runs ledger CSS should be scoped to the page marker.',
);

assert.match(
  ledgerBlock,
  /#root\s+\.runs-dashboard-page\.runs-ledger-page::before\s*\{[\s\S]*content:\s*none\s*!important;[\s\S]*display:\s*none\s*!important;/,
  'Runs ledger should remove the shared fixed background grid behind the recent-run cards.',
);

assert.match(
  lateGridStyle,
  /#root\s+\.runs-dashboard-page\.runs-ledger-page::before,\s*\n\s*#root\s+\.runs-dashboard-page\.runs-ledger-page\s+\.runner-shell-canvas::before\s*\{[\s\S]*content:\s*none\s*!important;[\s\S]*display:\s*none\s*!important;[\s\S]*visibility:\s*hidden\s*!important;[\s\S]*opacity:\s*0\s*!important;[\s\S]*background:\s*none\s*!important;/,
  'The final light-theme cascade should keep both Runs background-grid layers disabled.',
);

assert.match(
  lateGridStyle,
  /#root\s+\.runs-dashboard-page\.runs-ledger-page\s+\.runner-shell-canvas,\s*\n\s*#root\s+\.runs-dashboard-page\.runs-ledger-page\s+\.runs-profile-history,\s*\n\s*#root\s+\.runs-dashboard-page\.runs-ledger-page\s+\.recent-runs-card-list\s*\{[\s\S]*background-image:\s*none\s*!important;/,
  'The Runs canvas and card list should not reintroduce a grid background through a later theme or loading state.',
);

assert.match(
  lateGridStyle,
  /#root\s+\.runs-dashboard-page::before,\s*\n\s*#root\s+\.runs-dashboard-page\s+\.runner-shell-canvas::before\s*\{[\s\S]*content:\s*none\s*!important;[\s\S]*display:\s*none\s*!important;/,
  'The final grid guard should also cover older Runs renders that do not expose the ledger marker class.',
);

assert.match(
  ledgerBlock,
  /\.runs-ledger-awaiting\s+\.integration-alert-background\s*\{[\s\S]*display:\s*none;/,
  'Runs no-data state should hide the old decorative integration background.',
);

assert.match(
  ledgerBlock,
  /\.runs-profile-history\.runs-ledger-redesign\s+\.recent-runs-month-grid\s*\{[\s\S]*grid-template-columns:\s*1fr\s*!important;/,
  'Runs history should render as a ledger list instead of a dense card wall.',
);

assert.match(
  ledgerBlock,
  /\.runs-profile-history\.runs-ledger-redesign\s+button\.recent-runs-card\s*\{[\s\S]*grid-template-columns:\s*160px\s+minmax\(0,\s*1fr\);[\s\S]*border-radius:\s*8px\s*!important;/,
  'Run cards should use a compact route-preview ledger row.',
);

assert.match(
  ledgerBlock,
  /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*button\.recent-runs-card\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
  'Runs ledger rows should collapse to one column on mobile.',
);

assert.doesNotMatch(
  ledgerBlock,
  /font-size:[^;]*vw|letter-spacing:\s*-/,
  'New Runs ledger CSS should avoid viewport-scaled type and negative tracking.',
);

assert.match(
  lateCascadeStyle,
  /#root\s+\.runs-dashboard-page\s+\.runs-profile-history\.runs-ledger-redesign\s+\.recent-runs-insight-card\.recent-runs-insight-card--primary\s*\{[\s\S]*border-radius:\s*8px\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'The late imported CSS should preserve the ledger primary insight style in the live cascade.',
);

assert.match(
  lateCascadeStyle,
  /\.runs-profile-history\.runs-ledger-redesign\s+\.recent-runs-insight-card\.recent-runs-insight-card--primary::before\s*\{[\s\S]*display:\s*none\s*!important;/,
  'The late cascade should remove the old insight-card accent rail for the ledger redesign.',
);

assert.match(
  lateCascadeStyle,
  /\.runs-profile-history\.runs-ledger-redesign\s+\.recent-runs-insight-card\.recent-runs-insight-card--primary\s+strong\s*\{[\s\S]*font-size:\s*2rem\s*!important;[\s\S]*letter-spacing:\s*0\s*!important;/,
  'The final primary insight metric should use stable, non-viewport typography.',
);

console.log('[PASS] Runs ledger redesign guardrails passed.');
