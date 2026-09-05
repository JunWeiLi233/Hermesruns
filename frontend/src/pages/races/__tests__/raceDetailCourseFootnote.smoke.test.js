import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = fs.readFileSync(path.join(currentDir, "../RacesDetail.jsx"), 'utf8');
const stylesSource = fs.readFileSync(path.join(currentDir, "../../../styles/_split/races.css"), 'utf8');
const lightThemeSource = fs.readFileSync(path.join(currentDir, "../../../styles/_split/light-theme-overrides.css"), 'utf8');

assert.doesNotMatch(
  pageSource,
  /className="race-detail-course-footnote"/,
  'Race detail should not render the explanatory elevation footnote block.',
);
assert.doesNotMatch(
  stylesSource,
  /\.race-detail-course-footnote\s*\{/,
  'Race detail should not retain dead styling for the removed elevation footnote block.',
);
assert.doesNotMatch(
  lightThemeSource,
  /race-detail-course-footnote/,
  'Race detail light-theme overrides should not retain selectors for the removed elevation footnote block.',
);
console.log('[PASS] Race detail explanatory footnote removal guardrails passed.');
