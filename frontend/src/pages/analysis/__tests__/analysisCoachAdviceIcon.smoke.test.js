import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const analysisSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const analysisStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');

assert.ok(
  existsSync(path.join(srcRoot, 'assets/coach-advice-icon.png')),
  'The generated coach-advice icon should be stored in the frontend asset tree.',
);

assert.match(
  analysisSource,
  /import coachAdviceIcon from ['"]\.\.\/assets\/coach-advice-icon\.png['"];?/,
  'Analysis should import the generated coach-advice icon.',
);

assert.match(
  analysisSource,
  /<span className="analysis-overview-card-kicker">\s*<img src=\{coachAdviceIcon\} alt="" className="analysis-coach-advice-icon" \/>\s*\{t\('analysis\.stitch_coach_title'\)\}/,
  'The coach-advice icon should sit beside the localized coach label.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-coach-advice-icon\s*\{[\s\S]*width:\s*clamp\([^)]+\)\s*!important;[\s\S]*height:\s*clamp\([^)]+\)\s*!important;[\s\S]*object-fit:\s*contain\s*!important;/,
  'The coach-advice icon should remain compact and preserve its generated proportions.',
);

console.log('[PASS] Analysis coach-advice icon guard passed.');
