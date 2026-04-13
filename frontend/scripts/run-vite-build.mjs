import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = path.resolve(frontendDir, '..')
const cleanScript = path.join(projectRoot, 'scripts', 'clean-backend-static-assets.mjs')
const backendStaticDir = path.resolve(projectRoot, '../backend/src/main/resources/static')
const backendLiveStaticDir = path.resolve(projectRoot, '../backend/target/classes/static')
const backendAssetsDir = path.join(backendStaticDir, 'assets')
const backupAssetsDir = path.join(backendStaticDir, '.assets-backup')

function syncDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true })

  const sourceEntries = fs.readdirSync(sourceDir, { withFileTypes: true })
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name))

  for (const entry of sourceEntries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      syncDirectory(sourcePath, targetPath)
      continue
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(sourcePath, targetPath)
  }

  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (sourceNames.has(entry.name)) continue
    fs.rmSync(path.join(targetDir, entry.name), { recursive: true, force: true })
  }
}

function collectMissingPaths(sourceDir, targetDir, prefix = '') {
  const missing = []

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    const relativePath = prefix ? path.join(prefix, entry.name) : entry.name

    if (entry.isDirectory()) {
      if (!fs.existsSync(targetPath)) {
        missing.push(relativePath)
        continue
      }
      missing.push(...collectMissingPaths(sourcePath, targetPath, relativePath))
      continue
    }

    if (!fs.existsSync(targetPath)) {
      missing.push(relativePath)
    }
  }

  return missing
}

function replaceDirectory(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(targetDir), { recursive: true })
  fs.renameSync(sourceDir, targetDir)
}

fs.rmSync(backupAssetsDir, { recursive: true, force: true })
if (fs.existsSync(backendAssetsDir)) {
  fs.cpSync(backendAssetsDir, backupAssetsDir, { recursive: true })
}

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
  if (fs.existsSync(backupAssetsDir)) {
    replaceDirectory(backupAssetsDir, backendAssetsDir)
  }
  console.error('[frontend] Clean step failed:', cleanResult.error)
  process.exit(1)
}
if (cleanResult.status !== 0) {
  if (fs.existsSync(backupAssetsDir)) {
    replaceDirectory(backupAssetsDir, backendAssetsDir)
  }
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
  if (fs.existsSync(backupAssetsDir)) {
    replaceDirectory(backupAssetsDir, backendAssetsDir)
  }
  console.error('[frontend] Vite build failed:', result.error)
  process.exit(1)
}
if (result.status !== 0) {
  if (fs.existsSync(backupAssetsDir)) {
    replaceDirectory(backupAssetsDir, backendAssetsDir)
  }
  console.error(`[frontend] Vite build failed with exit code: ${result.status}`)
  process.exit(result.status ?? 1)
}

fs.rmSync(backupAssetsDir, { recursive: true, force: true })

if (fs.existsSync(backendLiveStaticDir)) {
  syncDirectory(backendStaticDir, backendLiveStaticDir)

  const missingRuntimeFiles = collectMissingPaths(backendStaticDir, backendLiveStaticDir)
  if (missingRuntimeFiles.length > 0) {
    console.error('[frontend] Live backend static sync is incomplete. Missing files:')
    missingRuntimeFiles.forEach((filePath) => console.error(` - ${filePath}`))
    process.exit(1)
  }

  console.log(`[frontend] Synced live backend static dir: ${backendLiveStaticDir}`)
}

process.exitCode = 0
