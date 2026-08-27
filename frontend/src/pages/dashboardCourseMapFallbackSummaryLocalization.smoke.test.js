import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const zhComponents = readFileSync(path.join(here, '..', 'i18n', 'locales', 'zh-CN', 'components.js'), 'utf8');
const enComponents = readFileSync(path.join(here, '..', 'i18n', 'locales', 'en', 'components.js'), 'utf8');

assert.match(
  dashboardSource,
  /\^Hermes aligned this upload through the extraction pipeline fallback after the direct AI scan could not produce a trustworthy route preview\\\.\$\/i\.test\(summary\)[\s\S]*?return t\('dashboard\.course_maps_summary_extraction_fallback'\)/,
  'Course Maps should localize the extraction-pipeline fallback summary in the Chinese UI.',
);

assert.match(
  zhComponents,
  /"course_maps_summary_extraction_fallback":\s*"[^"]*[\u4e00-\u9fff][^"]*"/,
  'The Chinese locale should provide a Chinese extraction-pipeline fallback summary.',
);

assert.match(
  enComponents,
  /"course_maps_summary_extraction_fallback":\s*"Hermes aligned this upload through the extraction pipeline fallback after the direct AI scan could not produce a trustworthy route preview\."/,
  'The English locale should retain the source-language extraction-pipeline fallback summary.',
);

console.log('[PASS] Course-map fallback summary localization guard passed.');
