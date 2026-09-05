import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
assert.equal(existsSync(new URL('tools/fixtures', root)), false, 'Removed sample fixture directory must not return.');
assert.equal(existsSync(new URL('tools/shoe-catalog-sources.example.json', root)), false, 'Removed fixture-only import manifest must not return.');
assert.ok(existsSync(new URL('tools/import-shoe-catalog.mjs', root)), 'The real catalog importer must remain available.');
for (const directory of ['frontend', 'backend', 'docs', 'tools']) {
  assert.ok(existsSync(new URL(directory, root)), `Missing project directory: ${directory}`);
}
for (const directory of ['ios', '.tools', '.ai-sync', '.ai-codex', 'tmp', '.tmp']) {
  assert.equal(existsSync(new URL(directory, root)), false, `Retired root directory returned: ${directory}`);
}
for (const file of ['stop_hermes.bat', 'start_hermes_local.ps1', 'CONTEXT.md']) {
  assert.equal(existsSync(new URL(file, root)), false, `Retired root file returned: ${file}`);
}
for (const file of ['tools/one-shot-muscle-inspect.mjs', 'tools/one-shot-shoes-add-inspect.mjs']) {
  assert.equal(existsSync(new URL(file, root)), false, `Retired one-off probe returned: ${file}`);
}
for (const file of ['tools/auto-hermes-browser.mjs', 'tools/auto-hermes-playwright.mjs', 'tools/auto-hermes-config.json', 'tools/auto-hermes-human-loop.json']) {
  assert.ok(existsSync(new URL(file, root)), `Required browser tooling or live configuration is missing: ${file}`);
}
for (const file of ['start_hermes.bat', 'start_hermes.sh', 'stop_hermes.cmd', 'stop_hermes.ps1', 'stop_hermes.sh', 'docs/domain-glossary.md']) {
  assert.ok(existsSync(new URL(file, root)), `Missing maintained entry point or document: ${file}`);
}
assert.match(readFileSync(new URL('stop_hermes.cmd', root), 'utf8'), /stop_hermes\.ps1/);
const startup = readFileSync(new URL('start_hermes.bat', root), 'utf8');
assert.doesNotMatch(startup, /stop_hermes\.bat/);
const encodedMessages = [...startup.matchAll(/\[char\[\]\]\(([^)]+)\)/g)]
  .map((match) => String.fromCharCode(...match[1].split(',').map((code) => Number(code))))
  .join('\n');
assert.doesNotMatch(encodedMessages, /stop_hermes\.bat/);
assert.match(encodedMessages, /stop_hermes\.cmd/);
for (const directory of ['.agents', '.codex', '.claude', '.gemini', '.opencode', '.github', '.railway', '.codeant']) {
  assert.ok(existsSync(new URL(directory, root)), `Tool discovery directory must stay at root: ${directory}`);
}
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
assert.equal(manifest.scripts['validate:ios'], undefined);
assert.equal(manifest.scripts['test:tooling'], 'node tools/run-tool-tests.mjs');
const workspace = JSON.parse(readFileSync(new URL('Hermes.code-workspace', root), 'utf8'));
assert.deepEqual(workspace.folders.slice(0, 2).map((folder) => folder.path), ['frontend', 'backend']);
for (const folder of workspace.folders) {
  assert.ok(existsSync(new URL(folder.path, root)), `Missing workspace folder: ${folder.path}`);
}
assert.ok(existsSync(new URL('docs/architecture/repository-layout.md', root)));
console.log(`[PASS] Web-only repository layout and integration discovery: ${fileURLToPath(root)}`);
