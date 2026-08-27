import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const viteConfigUrl = pathToFileURL(path.join(here, '../frontend/vite.config.js'))
const buildScriptPath = path.join(here, '../frontend/scripts/run-vite-build.mjs')

delete process.env.VITE_SOURCEMAP
const defaultConfig = (await import(`${viteConfigUrl.href}?source-map-default`)).default
assert.equal(
  defaultConfig.build?.sourcemap,
  false,
  'Production builds must disable source maps unless they are explicitly enabled.',
)

process.env.VITE_SOURCEMAP = 'true'
const debugConfig = (await import(`${viteConfigUrl.href}?source-map-debug`)).default
assert.equal(
  debugConfig.build?.sourcemap,
  true,
  'Debug builds should still support an explicit VITE_SOURCEMAP=true opt-in.',
)

const buildSource = readFileSync(buildScriptPath, 'utf8')
assert.match(
  buildSource,
  /process\.env\.VITE_SOURCEMAP\s*=\s*process\.env\.VITE_SOURCEMAP\s*\|\|\s*['"]false['"]/,
  'The production build wrapper must default VITE_SOURCEMAP to false.',
)

assert.match(
  buildSource,
  /#sourcemap\\0\$\{process\.env\.VITE_SOURCEMAP === ['"]true['"] \? ['"]true['"] : ['"]false['"]\}/,
  'The build fingerprint must distinguish debug-map builds from secure production builds.',
)

assert.match(
  buildSource,
  /if \(entry\.name\.endsWith\(['"]\.map['"]\)\)/,
  'Production publishing must remove source-map files retained from earlier build generations.',
)

assert.match(
  buildSource,
  /if \(!sourceMapsEnabled\)\s*\{[\s\S]*removeSourceMapArtifacts\(backendStaticDir\)/,
  'The secure production publish path must sanitize the complete served static tree.',
)

assert.match(
  buildSource,
  /stripSourceMapReferences\(entryPath\)/,
  'Production publishing must remove sourceMappingURL comments from retained JavaScript and CSS.',
)

console.log('[PASS] Frontend production source maps are disabled by default and debug-only by opt-in.')
