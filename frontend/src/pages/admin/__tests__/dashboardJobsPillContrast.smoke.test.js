import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const lightThemeCss = readFileSync(path.join(here, "../../../styles/_split/light-theme-overrides.css"), 'utf8');

const jobsPillRule = lightThemeCss.match(/body\.theme-light \.admin-command-page \.admin-jobs-terminal__pills span\s*\{([^}]*)\}/)?.[1];
assert.ok(jobsPillRule, 'The light-theme jobs filter pills should have a dedicated contrast rule.');
assert.match(jobsPillRule, /color:\s*#475569/);

console.log('dashboard jobs pill contrast smoke test passed');
