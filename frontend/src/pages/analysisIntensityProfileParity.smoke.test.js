import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const pageSource = read('pages/AnalysisInsightDetail.jsx');
const indexSource = read('index.css');
const styleSource = read('styles/analysis-intensity-profile-alignment.css');

assert.match(
  pageSource,
  /insightKey === 'intensity'[\s\S]*?<div className="analysis-intensity-profile-content">/,
  'The intensity route should own a Profile-scoped content wrapper.',
);

const glassImport = indexSource.indexOf("@import './styles/all-pages-liquid-glass.css';");
const intensityImport = indexSource.indexOf("@import './styles/analysis-intensity-profile-alignment.css';");
assert.ok(intensityImport > glassImport, 'The intensity Profile alignment must load after the shared glass cascade.');

assert.match(styleSource, /--intensity-radius-xl:\s*20px/);
assert.match(styleSource, /\.analysis-intensity-command-zone-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(styleSource, /\.analysis-intensity-command-sample-visual\s*\{[\s\S]*min-height:\s*64px/);
assert.match(styleSource, /body:is\([^)]*\.theme-midnight[^)]*\)[\s\S]*\.analysis-intensity-profile-content/);
assert.match(styleSource, /@media \(max-width:\s*960px\)/);
assert.match(styleSource, /@media \(prefers-reduced-motion:\s*reduce\)/);

console.log('[PASS] Analysis intensity uses the compact Profile design hierarchy.');
