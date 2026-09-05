import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, "../../analysis/Analysis.jsx"), 'utf8');
const runsSource = readFileSync(path.join(here, "../../runs/Runs.jsx"), 'utf8');
const modalSource = readFileSync(path.join(here, "../../../components/Modal.jsx"), 'utf8');
const guideSource = readFileSync(path.join(here, "../../../components/ImportDataGuide.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/all-pages-liquid-glass.css"), 'utf8');
const analysisReferenceStyles = styleSource.slice(styleSource.indexOf('/* Analysis import modal reference surface.'));

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
  /const QUICK_STEP_COUNT = 3;[\s\S]*function ImportDataGuide\(\)[\s\S]*profile\.import_guide_quick_step_\$\{index \+ 1\}_title[\s\S]*profile\.import_guide_quick_step_\$\{index \+ 1\}_body/,
  'The import guide should prioritize three short action steps instead of seven equal-weight paragraphs.',
);

assert.match(
  guideSource,
  /<h3 id="import-guide-title" className="import-guide-title">[\s\S]*<span className="import-guide-kicker">/,
  'The three-step kicker should appear below the guide title.',
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
  analysisSource,
  /title=\{t\('profile\.import_modal_title'\)\}[\s\S]*icon=\{<AppIcon name="upload_file" className="profile-import-modal-icon" \/>\}/,
  'Analysis should use the upload icon in the reference import modal header.',
);

assert.doesNotMatch(
  analysisSource,
  /eyebrow=\{t\('profile\.import_guide_kicker'\)\}/,
  'Analysis should keep the three-step kicker inside the guide instead of the modal header.',
);

assert.match(
  analysisSource,
  /<ImportDataGuide \/>/,
  'Analysis should render the guide kicker below its title.',
);

assert.doesNotMatch(
  modalSource,
  /eyebrow = null[\s\S]*modal-header-copy[\s\S]*modal-header-eyebrow/,
  'The shared modal should not own the guide kicker layout.',
);

assert.doesNotMatch(
  runsSource,
  /title=\{t\('profile\.import_modal_title'\)\}[\s\S]*profile-import-modal-icon/,
  'The Analysis-only upload icon should not change the shared Runs import modal.',
);

assert.match(
  styleSource,
  /(?:^|\r?\n)\.profile-import-modal-card \.modal-close\s*\{[^}]*border:\s*0[^}]*border-radius:\s*0[^}]*background:\s*transparent/,
  'Runs import modal should use the same plain-X close control as Analysis.',
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

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-shell\s*\{[\s\S]*background:\s*rgba\(18, 22, 28, 0\.42\)[\s\S]*backdrop-filter:\s*blur\(8px\)/,
  'Analysis should use a neutral dimmed and lightly blurred modal overlay.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card\s*\{[\s\S]*width:\s*min\(760px,[\s\S]*border-radius:\s*30px[\s\S]*background:\s*#ffffff !important/,
  'Analysis should use the white 760px reference sheet with a 30px radius.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.modal-header\s*\{[\s\S]*padding:[\s\S]*#root \.analysis-page-shell \.profile-import-modal-card \.modal-header-icon\s*\{[\s\S]*width:\s*56px[\s\S]*height:\s*56px[\s\S]*border-radius:\s*50%[\s\S]*background:\s*#f17b68/,
  'Analysis should place a 56px coral circular upload badge above the title.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.profile-import-modal-icon\s*\{[\s\S]*display:\s*block;[\s\S]*width:\s*28px;[\s\S]*height:\s*28px;[\s\S]*transform:\s*translateY\(-2px\)/,
  'The upload glyph should use a square box and a small optical lift so its white artwork sits centered in the coral badge.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.modal-close\s*\{[\s\S]*position:\s*absolute[\s\S]*top:[\s\S]*right:/,
  'Analysis should keep the close control in the upper-right corner.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.modal-close\s*\{[^}]*border:\s*0[^}]*border-radius:\s*0[^}]*background:\s*transparent/,
  'Analysis close control should show only the X without a surrounding circle.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.modal-header\s*\{[^}]*align-items:\s*center[^}]*text-align:\s*left[^}]*\}/,
  'Analysis reference header content should remain left-aligned while centering the title with the upload icon.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.modal-header\s*\{[^}]*justify-content:\s*flex-start/,
  'Analysis import title should remain immediately beside the upload icon.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.modal-header\s*\{[^}]*padding:\s*30px 50px 18px/,
  'Analysis upload icon should share the guide title left edge.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.modal-header\s*\{[\s\S]*flex-direction:\s*row[\s\S]*align-items:\s*center/,
  'Analysis upload icon should sit to the left of the header copy with vertically centered content.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-card \.modal-header h3\s*\{[\s\S]*font-style:\s*normal/,
  'Analysis import title should use normal, non-italic styling.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.modal-button\s*\{[^}]*border-radius:\s*6px !important;[^}]*clip-path:\s*none !important;[^}]*font-style:\s*normal;/,
  'Analysis import actions should use the same plain rectangular, upright button geometry as Cancel.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.import-guide-title\s*\{[\s\S]*font-style:\s*normal/,
  'Analysis import guide title should use normal, non-italic styling.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.import-guide-details summary > span\s*\{[^}]*color:\s*#000000 !important;/,
  'The Analysis export-help title should use black text in the import modal.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*grid-template-areas:[\s\S]*"guide"[\s\S]*"help"[\s\S]*"sources"[\s\S]*"summary"[\s\S]*"status"[\s\S]*"actions"/,
  'Analysis import content should remain a single-column guide, help, sources, summary, status, and actions flow.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.import-guide,[\s\S]*\.import-source-card\s*\{[\s\S]*background:\s*#fff[\s\S]*#root \.analysis-page-shell \.profile-import-modal-form \.modal-actions\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*1fr 1fr/,
  'Analysis guide and source surfaces should be flattened while actions use rounded two-column controls.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.import-source-index\s*\{[\s\S]*display:\s*grid;[\s\S]*width:\s*40px;[\s\S]*height:\s*40px;[\s\S]*background:\s*#000000 !important;[\s\S]*color:\s*#ffffff !important;/,
  'Analysis import source number boxes should use a black surface with white numbering.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.import-guide-step-index\s*\{[\s\S]*background:\s*#000000 !important;[\s\S]*color:\s*#ffffff !important;[\s\S]*box-shadow:\s*none !important;/,
  'Analysis import guide step boxes should use the same black-and-white treatment as source numbering.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form input\[type="file"\]::file-selector-button\s*\{[\s\S]*border-color:\s*#000000 !important;[\s\S]*background:\s*#000000 !important;[\s\S]*color:\s*#ffffff !important;/,
  'Analysis file chooser buttons should use the same black surface and white text treatment.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.import-source-tag\s*\{[\s\S]*border-color:\s*#000000 !important;[\s\S]*background:\s*#000000 !important;[\s\S]*color:\s*#ffffff !important;[\s\S]*box-shadow:\s*none !important;/,
  'Analysis import source tags should use the same black surface and white text treatment.',
);

assert.match(
  analysisReferenceStyles,
  /body:is\(\.theme-midnight, \.theme-high-contrast\) #root \.analysis-page-shell \.profile-import-modal-card\s*\{[\s\S]*background:\s*#ffffff !important/,
  'Analysis should retain an opaque white fallback in dark themes for modal readability.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.modal-button\.modal-submit,[\s\S]*#root \.analysis-page-shell \.profile-import-modal-form \.modal-button\[type="submit"\]\s*\{[^}]*background:\s*linear-gradient\(110deg, #b64635 0%, #ed715f 100%\) !important;[^}]*color:\s*#fff !important;/,
  'Analysis import actions should use the runner CTA coral gradient with white text.',
);

assert.match(
  analysisReferenceStyles,
  /#root \.analysis-page-shell \.profile-import-modal-form \.modal-button\[type="submit"\]:disabled\s*\{[\s\S]*border:\s*1px solid #b64635 !important;[\s\S]*background:\s*linear-gradient\(110deg, #b64635 0%, #ed715f 100%\) !important;[\s\S]*color:\s*#fff !important;[\s\S]*box-shadow:\s*0 14px 28px rgba\(160, 57, 42, 0\.2\), inset 0 1px 0 rgba\(255, 255, 255, 0\.2\) !important;/,
  'The disabled import action should retain the coral primary color treatment instead of reverting to white.',
);

console.log('[PASS] Profile import modal design guardrails passed.');
