import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shoesSource = readFileSync(path.join(here, 'Shoes.jsx'), 'utf8');

const sources = [
  ['bundled style.css', path.join(here, '../styles/style.css')],
  ['split shoes.css', path.join(here, '../styles/_split/shoes.css')],
];

const assertContains = (source, expected, label) => {
  assert.ok(source.includes(expected), `${label} should include ${expected}`);
};

assertContains(shoesSource, 'className="shoe-scan-modal-preview-upload"', 'Shoes scan modal preview upload control');
assertContains(shoesSource, '<input type="file" accept="image/*" multiple onChange={onScanFilesSelected} />', 'Shoes scan modal preview file input');
assert.doesNotMatch(
  shoesSource,
  /shoe-scan-modal-preview-overlay" aria-hidden="true"/,
  'The visible scan preview controls must not be hidden from interaction.',
);

for (const [label, filePath] of sources) {
  const source = readFileSync(filePath, 'utf8');

  assertContains(source, '/* Shoe scan import compact repair */', label);
  assertContains(source, 'width: min(960px, calc(100vw - 32px));', label);
  assertContains(source, 'overflow-x: hidden;', label);
  assertContains(source, 'grid-template-columns: minmax(0, 1fr);', label);
  assertContains(source, '.shoe-scan-modal-preview-upload input {', label);
  assertContains(source, 'pointer-events: auto;', label);
  assertContains(source, '.shoe-scan-modal-upload::after {\n  content: none;\n}', label);
  assertContains(source, '@media (min-width: 981px)', label);
  assertContains(source, '@media (max-width: 640px)', label);
  assertContains(source, '/* Shoe scan narrow viewport hard stop: keep only the functional import form. */', label);
  assertContains(source, '.shoe-scan-modal-visual {\n    display: none !important;\n  }', label);
  assertContains(source, 'width: min(520px, calc(100vw - 24px));', label);

  assert.doesNotMatch(
    source,
    /\/\* Shoe scan import compact repair \*\/[\s\S]*?\.shoe-scan-modal-layout \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) minmax\(340px, 0\.82fr\);/,
    `${label} should not default to a two-column scan layout, because it squeezes narrow modals.`,
  );

  assert.match(
    source,
    /@media \(min-width: 981px\) \{[\s\S]*?\.shoe-scan-modal-layout \{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(340px, 0\.82fr\);\s*\}/,
    `${label} should only use the two-column scan layout on desktop-width viewports.`,
  );

  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*?\.shoe-scan-modal-actions,[\s\S]*?\.shoe-scan-result-actions \{\s*grid-template-columns: 1fr;\s*\}/,
    `${label} should keep scan actions usable on phones.`,
  );
}

console.log('[PASS] shoe scan modal compact repair guardrails passed.');