import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');
const analysisStyleSource = readFileSync(path.join(here, '../styles/_split/analysis.css'), 'utf8');
const modalSource = readFileSync(path.join(here, '../components/Modal.jsx'), 'utf8');
const englishComponents = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const chineseComponents = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');

assert.match(
  analysisSource,
  /const \[sorenessModalLevel, setSorenessModalLevel\] = useState\(null\);/,
  'Analysis should track the soreness level awaiting confirmation.',
);
for (const level of ['low', 'medium', 'high']) {
  assert.match(
    analysisSource,
    new RegExp(`onClick=\\{\\(\\) => setSorenessModalLevel\\('${level}'\\)\\}`),
    `${level} soreness should open the confirmation modal before saving.`,
  );
}
assert.doesNotMatch(
  analysisSource,
  /className=\{cx\('analysis-injury-prevention-soreness-btn',[\s\S]*?onClick=\{\(\) => handleSorenessLog\('/,
  'Soreness buttons should not submit directly without confirmation.',
);
assert.match(
  analysisSource,
  /<Modal\s+isOpen=\{Boolean\(sorenessModalLevel\)\}[\s\S]*?onClose=\{\(\) => setSorenessModalLevel\(null\)\}[\s\S]*?analysis\.stitch_injury_prevention_soreness_modal_title/,
  'Analysis should render a closable confirmation modal for the selected soreness level.',
);
assert.match(
  analysisSource,
  /onClick=\{handleSorenessModalConfirm\}/,
  'The modal should confirm and save the selected soreness level.',
);
assert.match(
  analysisSource,
  /headerContent=\{sorenessModalLevel \? \([\s\S]*?analysis-soreness-modal-level[\s\S]*?\) : null\}/,
  'The selected soreness level should render above the modal title.',
);
assert.doesNotMatch(
  analysisSource,
  /<div className=\{cx\('analysis-soreness-modal-level',[\s\S]*?<\/div>\s*<p className="analysis-soreness-modal-copy">/,
  'The selected soreness level should not be duplicated inside the modal body.',
);
assert.match(
  modalSource,
  /headerContent = null/,
  'The shared modal should expose an optional header-content slot.',
);
assert.match(
  modalSource,
  /className="modal-header-main"[\s\S]*?headerContent[\s\S]*?<h3>\{title\}<\/h3>/,
  'The shared modal should place optional header content before its title.',
);
for (const localeSource of [englishComponents, chineseComponents]) {
  assert.match(localeSource, /stitch_injury_prevention_soreness_modal_title/);
  assert.match(localeSource, /stitch_injury_prevention_soreness_modal_copy/);
  assert.match(localeSource, /stitch_injury_prevention_soreness_modal_cancel/);
  assert.match(localeSource, /stitch_injury_prevention_soreness_modal_confirm/);
}

assert.match(
  analysisStyleSource,
  /\.analysis-soreness-modal-card\s*\{[\s\S]*?width:\s*min\(1370px, 84\.5vw\);[\s\S]*?max-width:\s*1370px;[\s\S]*?height:\s*min\(742px, 78\.5vh\);[\s\S]*?border-radius:\s*28px;[\s\S]*?background:\s*#ffffff;/,
  'The soreness modal should use the wide white confirmation-sheet surface.',
);
assert.match(
  analysisStyleSource,
  /\.analysis-soreness-modal-card \.modal-header h3\s*\{[\s\S]*?font-size:\s*clamp\(2\.2rem, 4\.4vw, 4\.5rem\);[\s\S]*?font-style:\s*normal;/,
  'The soreness modal should use the upright reference title scale.',
);
assert.match(
  analysisStyleSource,
  /\.analysis-soreness-modal-card \.modal-close\s*\{[\s\S]*?width:\s*clamp\(40px, 6\.3vw, 102px\);[\s\S]*?height:\s*clamp\(40px, 6\.3vw, 102px\);/,
  'The soreness modal should scale the close control with the reference sheet.',
);
assert.match(
  analysisStyleSource,
  /\.analysis-soreness-modal-level\s*\{[\s\S]*?width:\s*clamp\(116px, 15vw, 244px\);[\s\S]*?min-height:\s*clamp\(50px, 6\.9vw, 112px\);/,
  'The soreness modal should scale the selected-state pill with the reference sheet.',
);
assert.match(
  analysisStyleSource,
  /\.analysis-soreness-modal-actions \.modal-button\s*\{[\s\S]*?min-height:\s*clamp\(54px, 8\.6vw, 140px\)\s*!important;[\s\S]*?border-radius:\s*999px\s*!important;/,
  'The soreness modal should use equal rounded action pills.',
);
assert.match(
  analysisStyleSource,
  /\.analysis-soreness-modal-actions \.modal-button\.btn-primary\s*\{[\s\S]*?background:\s*#202124\s*!important;[\s\S]*?color:\s*#ffffff\s*!important;/,
  'The non-destructive Save action should be the dark trailing action.',
);
assert.match(
  analysisStyleSource,
  /\.analysis-soreness-modal-content\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*clamp\(22px, 3\.7vw, 60px\);/,
  'The soreness modal should preserve the airy vertical rhythm from the reference.',
);
assert.match(
  analysisStyleSource,
  /\.analysis-soreness-modal-card \.modal-header-main\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*18px;/,
  'The soreness modal header should stack the selected level above the title.',
);

const idealGuardrailStart = analysisStyleSource.indexOf('/* Soreness modal ideal wide-sheet guardrails */');
assert.ok(idealGuardrailStart >= 0, 'The soreness modal should define final wide-sheet guardrails.');
const idealGuardrails = analysisStyleSource.slice(idealGuardrailStart);

assert.match(
  idealGuardrails,
  /\.analysis-soreness-modal-card\s*\{[\s\S]*?width:\s*min\(1370px, 84\.5vw\) !important;[\s\S]*?max-width:\s*1370px !important;[\s\S]*?height:\s*min\(742px, 78\.5vh\) !important;/,
  'The soreness modal should keep the reference margins and balanced height at the final cascade.',
);
assert.match(
  idealGuardrails,
  /\.analysis-soreness-modal-card \.modal-header h3\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?white-space:\s*nowrap;/,
  'The soreness title should remain a single horizontal heading on the wide sheet.',
);
assert.match(
  idealGuardrails,
  /\.analysis-soreness-modal-card \.modal-close\s*\{[\s\S]*?width:\s*clamp\(44px, 6\.3vw, 102px\);[\s\S]*?height:\s*clamp\(44px, 6\.3vw, 102px\);/,
  'The close control should retain a large reference-sized target without shrinking below touch size.',
);
assert.match(
  idealGuardrails,
  /\.analysis-soreness-modal-copy\s*\{[\s\S]*?white-space:\s*nowrap;/,
  'The confirmation copy should remain on one line at the reference width.',
);
assert.match(
  idealGuardrails,
  /\.analysis-soreness-modal-actions\s*\{[\s\S]*?display:\s*grid !important;[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;/,
  'The final cascade should keep the confirmation actions in equal tracks.',
);
assert.match(
  idealGuardrails,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.analysis-soreness-modal-card,[\s\S]*?background:\s*#ffffff !important;/,
  'The final light-theme cascade should keep the modal surface white.',
);
assert.match(
  idealGuardrails,
  /@media \(max-width: 540px\)\s*\{[\s\S]*?\.analysis-soreness-modal-card \.modal-header h3\s*\{[\s\S]*?font-size:\s*clamp\(1\.35rem, 7vw, 2rem\);/,
  'The mobile fallback should scale the title instead of allowing vertical character wrapping.',
);

const compactScaleStart = analysisStyleSource.indexOf('/* Soreness modal compact scale */');
assert.ok(compactScaleStart >= 0, 'The soreness modal should define a compact scale refinement.');
const compactScale = analysisStyleSource.slice(compactScaleStart);

assert.match(
  compactScale,
  /\.analysis-soreness-modal-card\s*\{[\s\S]*?width:\s*min\(1080px, 78vw\) !important;[\s\S]*?max-width:\s*1080px !important;[\s\S]*?height:\s*min\(620px, 72vh\) !important;/,
  'The soreness modal should use a smaller desktop card footprint.',
);
assert.match(
  compactScale,
  /\.analysis-soreness-modal-card \.modal-header h3\s*\{[\s\S]*?font-size:\s*clamp\(1\.75rem, 3\.3vw, 3\.3rem\);/,
  'The compact soreness title should remain prominent without using the oversized reference scale.',
);
assert.match(
  compactScale,
  /\.analysis-soreness-modal-card \.modal-close\s*\{[\s\S]*?width:\s*clamp\(44px, 4\.6vw, 72px\);[\s\S]*?height:\s*clamp\(44px, 4\.6vw, 72px\);/,
  'The compact close control should remain touch-safe while reducing visual weight.',
);
assert.match(
  compactScale,
  /\.analysis-soreness-modal-level\s*\{[\s\S]*?width:\s*clamp\(110px, 13vw, 190px\);[\s\S]*?min-height:\s*clamp\(48px, 5\.5vw, 78px\);/,
  'The compact selected-state pill should scale with the smaller card.',
);
assert.match(
  compactScale,
  /\.analysis-soreness-modal-actions \.modal-button\s*\{[\s\S]*?min-height:\s*clamp\(52px, 5vw, 72px\) !important;/,
  'The compact action controls should reduce with the modal while staying usable.',
);

const properCompactStart = analysisStyleSource.indexOf('/* Soreness modal proper compact scale */');
assert.ok(properCompactStart >= 0, 'The soreness modal should define a proper compact scale refinement.');
const properCompactScale = analysisStyleSource.slice(properCompactStart);

assert.match(
  properCompactScale,
  /\.analysis-soreness-modal-card\s*\{[\s\S]*?width:\s*min\(760px, calc\(100vw - 32px\)\) !important;[\s\S]*?max-width:\s*760px !important;[\s\S]*?height:\s*auto !important;/,
  'The soreness modal should use a proper compact auto-height card.',
);
assert.match(
  properCompactScale,
  /\.analysis-soreness-modal-card \.modal-header h3\s*\{[\s\S]*?font-size:\s*clamp\(1\.6rem, 4vw, 2\.7rem\);/,
  'The proper compact title should remain readable without dominating the sheet.',
);
assert.match(
  properCompactScale,
  /\.analysis-soreness-modal-card \.modal-form\s*\{[\s\S]*?padding:\s*22px 40px 30px;/,
  'The proper compact form should use balanced internal spacing.',
);
assert.match(
  properCompactScale,
  /\.analysis-soreness-modal-level\s*\{[\s\S]*?width:\s*clamp\(110px, 16vw, 160px\);[\s\S]*?min-height:\s*clamp\(48px, 6vw, 64px\);/,
  'The proper compact state pill should have a restrained footprint.',
);

console.log('[PASS] Analysis soreness confirmation modal guardrails passed.');
