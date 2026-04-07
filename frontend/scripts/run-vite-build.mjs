import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = path.resolve(frontendDir, '..')
const cleanScript = path.join(projectRoot, 'scripts', 'clean-backend-static-assets.mjs')
const backendStaticDir = path.resolve(projectRoot, '../backend/src/main/resources/static')
const backendLiveStaticDir = path.resolve(projectRoot, '../backend/target/classes/static')

// Defaults: minified output.
let minify = true
let cssMinify = true

for (const arg of process.argv.slice(2)) {
  if (arg === '--minify=false' || arg === '--minify=0') minify = false
  if (arg === '--cssMinify=false' || arg === '--cssMinify=0' || arg === '--css-minify=false' || arg === '--css-minify=0') cssMinify = false
}

process.env.VITE_MINIFY = minify ? 'true' : 'false'
process.env.VITE_CSS_MINIFY = cssMinify ? 'true' : 'false'
process.env.VITE_SOURCEMAP = 'true'

// Clean only the assets bundle directory, not backend-owned static files.
const cleanResult = spawnSync(process.execPath, [cleanScript], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: process.env,
})
if (cleanResult.error) {
  console.error('[frontend] Clean step failed:', cleanResult.error)
  process.exit(1)
}
if (cleanResult.status !== 0) {
  console.error(`[frontend] Clean step failed with exit code: ${cleanResult.status}`)
  process.exit(cleanResult.status ?? 1)
}

const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
if (!fs.existsSync(viteEntry)) {
  throw new Error(`Cannot find Vite entrypoint at: ${viteEntry}`)
}

const result = spawnSync(process.execPath, [viteEntry, 'build'], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: process.env,
  shell: false,
})
if (result.error) {
  console.error('[frontend] Vite build failed:', result.error)
  process.exit(1)
}
if (result.status !== 0) {
  console.error(`[frontend] Vite build failed with exit code: ${result.status}`)
  process.exit(result.status ?? 1)
}

if (fs.existsSync(backendLiveStaticDir)) {
  fs.rmSync(path.join(backendLiveStaticDir, 'assets'), { recursive: true, force: true })
  fs.cpSync(backendStaticDir, backendLiveStaticDir, { recursive: true, force: true })
  console.log(`[frontend] Synced live backend static dir: ${backendLiveStaticDir}`)
}

process.exitCode = 0
