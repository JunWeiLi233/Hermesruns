import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const guideSource = readFileSync(path.join(here, '../components/ImportDataGuide.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

for (const [name, source] of [['Analysis', analysisSource], ['Runs', runsSource]]) {
  assert.match(source, /shellClassName="profile-import-modal-shell"/, `${name} should opt into the Profile import overlay.`);
  assert.match(source, /cardClassName="profile-import-modal-card"/, `${name} should opt into the Profile import sheet.`);
  assert.match(source, /<form className="profile-import-modal-form" onSubmit=\{handleImport\}>/, `${name} should scope the import layout without changing its submit handler.`);
  assert.match(source, /className="import-upload-heading"/, `${name} should introduce the upload controls after the shared guide.`);
  assert.match(source, /className="import-source-index"/, `${name} should keep source-card numbering aligned with the shared grid.`);
}

assert.match(
  styleSource,
  /\.profile-import-modal-card\s*\{[\s\S]*width:\s*min\(1080px,[\s\S]*max-height:\s*calc\(100dvh - 32px\)[\s\S]*var\(--runner-profile-card-strong\)/,
  'The import sheet should use a wide, viewport-contained Profile surface.',
);

assert.match(
  styleSource,
  /\.profile-import-modal-form\s*\{[\s\S]*grid-template-columns:\s*minmax\(280px,[\s\S]*grid-template-areas:[\s\S]*"guide help"/,
  'Desktop import content should separate guidance from upload controls.',
);

assert.match(
  guideSource,
  /const QUICK_STEP_COUNT = 3;[\s\S]*profile\.import_guide_quick_step_\$\{index \+ 1\}_title[\s\S]*profile\.import_guide_quick_step_\$\{index \+ 1\}_body/,
  'The import guide should prioritize three short action steps instead of seven equal-weight paragraphs.',
);

assert.match(
  guideSource,
  /const PROVIDER_KEYS = \['generic', 'coros', 'huawei'\];[\s\S]*<details className="import-guide-details">[\s\S]*profile\.import_guide_detail_\$\{provider\}/,
  'Provider-specific export instructions should remain available on demand.',
);

assert.match(
  guideSource,
  /<details className="import-guide-strava">[\s\S]*profile\.import_guide_strava_title/,
  'Automatic Strava guidance should be discoverable without dominating the primary flow.',
);

assert.match(
  analysisSource,
  /const selectedFileCount = \[fitExportFiles, corosFiles, huaweiFiles\][\s\S]*files\?\.length \?\? 0/,
  'Analysis should total every selected import file before submission.',
);

assert.match(
  analysisSource,
  /aria-live="polite"[\s\S]*profile\.import_batch_failed/,
  'Import failures should be visible and announced instead of being silently swallowed.',
);

assert.match(
  analysisSource,
  /disabled=\{selectedFileCount === 0 \|\| importStatus === 'uploading'\}/,
  'The import action should remain disabled until files are ready and while an upload is running.',
);

assert.match(
  styleSource,
  /\.profile-import-modal-form input\[type="file"\]::file-selector-button\s*\{[\s\S]*var\(--runner-profile-ink\)/,
  'Native upload controls should carry the Profile visual treatment.',
);

assert.match(
  styleSource,
  /\.profile-import-modal-form \.import-guide-details\s*\{[\s\S]*\.profile-import-modal-form \.import-guide-details summary\s*\{/,
  'Detailed instructions should use a compact, styled disclosure pattern.',
);

assert.match(
  styleSource,
  /\.profile-import-modal-form \.modal-actions\s*\{[\s\S]*position:\s*sticky;[\s\S]*bottom:\s*0;/,
  'Import actions should remain reachable while the modal content scrolls.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-midnight, \.theme-high-contrast\) \.profile-import-modal-card\s*\{[\s\S]*var\(--runner-profile-card-strong\)/,
  'The import sheet should remain legible in dark themes.',
);

assert.match(
  styleSource,
  /@media \(max-width: 820px\)\s*\{[\s\S]*\.profile-import-modal-form\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*"guide"[\s\S]*"help"[\s\S]*"sources"/,
  'The Profile import sheet should stack into a single mobile column.',
);

console.log('[PASS] Profile import modal design guardrails passed.');
