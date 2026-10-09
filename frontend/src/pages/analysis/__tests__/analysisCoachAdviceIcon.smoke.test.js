import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const analysisSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const analysisStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');

assert.ok(
  existsSync(path.join(srcRoot, 'assets/coach-advice-icon.webp')),
  'The generated coach-advice icon should be stored in the frontend asset tree.',
);

assert.doesNotMatch(
  analysisSource,
  /import coachAdviceIcon from ['"]\.\.\/\.\.\/assets\/coach-advice-icon\.webp['"];?/,
  'The v2 coach tile should not load the retired overview icon.',
);

assert.match(
  analysisSource,
  /analysis-v2-check--coach[\s\S]*?stitch_coach_title[\s\S]*?coachRecommendation\?\.purpose[\s\S]*?v2_coach_today/,
  'The coach tile should retain its localized heading, recommendation, and today session.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-coach-advice-icon\s*\{[\s\S]*width:\s*clamp\([^)]+\)\s*!important;[\s\S]*height:\s*clamp\([^)]+\)\s*!important;[\s\S]*object-fit:\s*contain\s*!important;/,
  'The coach-advice icon should remain compact and preserve its generated proportions.',
);

console.log('[PASS] Analysis coach-advice icon guard passed.');
