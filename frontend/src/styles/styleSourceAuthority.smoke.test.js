import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const indexCssPath = path.join(root, 'frontend/src/index.css');
const generatorPath = path.join(root, '.tools/generate-legacy-style-bundle.mjs');
const legacySplitToolPath = path.join(root, '.tools/split-styles.mjs');
const suggestTasksPath = path.join(root, '.tools/suggest-tasks.mjs');
const autoHermesControllerPath = path.join(root, '.tools/auto-hermes-controller.mjs');

assert.ok(existsSync(generatorPath), 'The active CSS import graph must have a compatibility-bundle generator.');

const indexCss = readFileSync(indexCssPath, 'utf8');
const generator = readFileSync(generatorPath, 'utf8');
const legacySplitTool = readFileSync(legacySplitToolPath, 'utf8');
const suggestTasks = readFileSync(suggestTasksPath, 'utf8');
const autoHermesController = readFileSync(autoHermesControllerPath, 'utf8');

assert.doesNotMatch(indexCss, /@import\s+['"]\.\/styles\/style\.css['"]/, 'Production CSS must not import the legacy bundle.');
assert.match(generator, /GENERATED FILE - DO NOT EDIT/, 'The compatibility bundle must identify itself as generated.');
assert.match(generator, /frontend\/src\/index\.css/, 'The runtime index must own compatibility bundle ordering.');
assert.doesNotMatch(
  legacySplitTool,
  /readFileSync\([^\n]*frontend\/src\/styles\/style\.css/,
  'The deprecated split command must not overwrite active styles from the legacy bundle.',
);
assert.doesNotMatch(suggestTasks, /frontend\/src\/styles\/style\.css/);
assert.doesNotMatch(autoHermesController, /frontend\/src\/styles\/style\.css/);

const check = spawnSync(process.execPath, [generatorPath, '--check'], {
  cwd: root,
  encoding: 'utf8',
});

assert.equal(check.status, 0, check.stderr || check.stdout || 'Generated style compatibility bundle is stale.');

console.log('[PASS] Runtime split CSS is the single style source of truth.');
