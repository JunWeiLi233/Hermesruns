import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shoesSource = readFileSync(path.join(here, "../Shoes.jsx"), 'utf8');

const sources = [
  ['bundled style.css', path.join(here, "../../../styles/style.generated.css")],
  ['split shoes.css', path.join(here, "../../../styles/_split/shoes.css")],
];

const assertContains = (source, expected, label) => {
  assert.ok(source.includes(expected), `${label} should include ${expected}`);
};

assertContains(shoesSource, 'className="shoe-scan-modal-preview-upload"', 'Shoes scan modal preview upload control');
assertContains(shoesSource, '<input type="file" accept="image/*" multiple onChange={onScanFilesSelected} />', 'Shoes scan modal preview file input');
assert.match(
  shoesSource,
  /title=\{scanStatus === 'done' \? t\('shoes\.scan_confirm'\) : t\('shoes\.scan_title'\)\}/,
  'The shared modal title should represent the active scan state.',
);

for (const [label, filePath] of sources) {
  const source = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const referenceStylesStart = source.indexOf('/* Scan modal Apple reference surface */');
  assert.ok(referenceStylesStart >= 0, `${label} should define the approved scan modal reference surface.`);
  const nextSourceMarker = source.indexOf('\n/* Source:', referenceStylesStart + 1);
  const referenceStyles = source.slice(referenceStylesStart, nextSourceMarker >= 0 ? nextSourceMarker : undefined);

  assert.match(
    referenceStyles,
    /\.modal-card\.shoe-scan-modal-card\s*\{[\s\S]*?width: min\(980px, calc\(100vw - 32px\)\);[\s\S]*?max-width: 980px;[\s\S]*?border-radius: 32px;[\s\S]*?background: #ffffff;/,
    `${label} should use the wide opaque white scan modal card from the supplied reference.`,
  );
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-layout\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    `${label} should keep the scan form in one column.`,
  );
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-visual\s*\{[\s\S]*?display: none !important;/,
    `${label} should remove the preview and metrics column from the focused scan modal.`,
  );
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-card \.modal-header h3\s*\{[\s\S]*?display: block;[\s\S]*?font-style: normal;[\s\S]*?font-size:/,
    `${label} should show the upright shared modal title instead of duplicating it in the form.`,
  );
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-card \.modal-close\s*\{[\s\S]*?display: none;/,
    `${label} should omit the extra close chrome shown absent in the supplied reference.`,
  );
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-copy h4\s*\{[\s\S]*?display: none;/,
    `${label} should hide the duplicate state heading.`,
  );
  assert.doesNotMatch(referenceStyles, /linear-gradient\(/, `${label} should not use gradients in the approved modal surface.`);
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-upload\s*\{[\s\S]*?border: 1px dashed #/,
    `${label} should use a restrained dashed upload boundary.`,
  );
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-primary:disabled\s*\{[\s\S]*?background: #f1f1f3;[\s\S]*?opacity: 1;/,
    `${label} should make the unavailable confirming action visibly disabled without opacity washout.`,
  );
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-actions\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?gap: clamp\(12px, 2\.2vw, 34px\);/,
    `${label} should keep the wide equal action pills from the supplied reference.`,
  );
  assert.match(
    referenceStyles,
    /\.shoe-scan-modal-card \.shoe-scan-modal-actions :is\(\.shoe-scan-modal-secondary, \.shoe-scan-modal-primary\)\s*\{[\s\S]*?min-height: clamp\(56px, 5\.6vw, 86px\);/,
    `${label} should size the action pills to the supplied reference proportions.`,
  );

  const fullTrackGuardrailStart = source.indexOf('/* Shoes scan modal full-track guard */');
  assert.ok(fullTrackGuardrailStart >= 0, `${label} should define a final full-track scan layout guard.`);
  const fullTrackGuardrails = source.slice(fullTrackGuardrailStart);
  assert.match(
    fullTrackGuardrails,
    /\.shoe-scan-modal-layout\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
    `${label} should override the earlier important desktop columns when the preview is hidden.`,
  );
  assert.match(
    fullTrackGuardrails,
    /\.shoe-scan-modal-panel\s*\{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?width: 100%;/,
    `${label} should make the scan panel consume the full modal width.`,
  );
}

console.log('[PASS] shoe scan modal Apple reference guardrails passed.');
