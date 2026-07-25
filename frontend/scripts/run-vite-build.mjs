import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = path.resolve(frontendDir, '..')
const backendStaticDir = path.resolve(projectRoot, '../backend/src/main/resources/static')
const backendLiveStaticDir = path.resolve(projectRoot, '../backend/target/classes/static')
const backendAssetsDir = path.join(backendStaticDir, 'assets')
const buildOutputDir = path.resolve(projectRoot, '../.tmp/frontend-static-build')
const backupAssetsDir = path.resolve(projectRoot, '../.tmp/backend-static-assets-backup')

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function retryFileOperation(operation, description) {
  let lastError

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return operation()
    } catch (error) {
      lastError = error
      sleep(150 * (attempt + 1))
    }
  }

  throw new Error(`${description} failed after retries: ${lastError?.message ?? 'unknown error'}`)
}

function syncDirectory(sourceDir, targetDir) {
  retryFileOperation(() => fs.mkdirSync(targetDir, { recursive: true }), `Create ${targetDir}`)

  const sourceEntries = fs.readdirSync(sourceDir, { withFileTypes: true })
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name))

  for (const entry of sourceEntries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      syncDirectory(sourcePath, targetPath)
      continue
    }

    retryFileOperation(() => fs.mkdirSync(path.dirname(targetPath), { recursive: true }), `Create ${path.dirname(targetPath)}`)
    retryFileOperation(() => fs.copyFileSync(sourcePath, targetPath), `Copy ${targetPath}`)
  }

  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (sourceNames.has(entry.name)) continue
    retryFileOperation(
      () => fs.rmSync(path.join(targetDir, entry.name), { recursive: true, force: true }),
      `Remove ${path.join(targetDir, entry.name)}`,
    )
  }
}

function copyDirectory(sourceDir, targetDir) {
  retryFileOperation(() => fs.mkdirSync(targetDir, { recursive: true }), `Create ${targetDir}`)

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath)
      continue
    }

    retryFileOperation(() => fs.mkdirSync(path.dirname(targetPath), { recursive: true }), `Create ${path.dirname(targetPath)}`)
    retryFileOperation(() => fs.copyFileSync(sourcePath, targetPath), `Copy ${targetPath}`)
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

function emptyDirectory(targetDir) {
  retryFileOperation(() => fs.mkdirSync(targetDir, { recursive: true }), `Create ${targetDir}`)

  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    retryFileOperation(
      () => fs.rmSync(path.join(targetDir, entry.name), { recursive: true, force: true }),
      `Remove ${path.join(targetDir, entry.name)}`,
    )
  }
}

function replaceDirectory(sourceDir, targetDir) {
  emptyDirectory(targetDir)
  syncDirectory(sourceDir, targetDir)
  retryFileOperation(() => fs.rmSync(sourceDir, { recursive: true, force: true }), `Remove ${sourceDir}`)
}

// Replace a live directory atomically so a concurrent server never sees a
// half-written mix of old and new files. We stage a complete copy, then swap it
// into place with two renames. On POSIX each rename() is atomic; the only window
// is the microsecond gap between the two renames, during which the target path
// does not exist (a 404 at worst — never a stale or mixed version).
function atomicReplaceDirectory(sourceDir, targetDir) {
  const parent = path.dirname(targetDir)
  const base = path.basename(targetDir)
  const stamp = Date.now()
  const stagingDir = path.join(parent, `${base}.swap-${stamp}`)
  const retiredDir = path.join(parent, `${base}.old-${stamp}`)

  // 1. Stage a complete copy beside the target.
  retryFileOperation(() => fs.rmSync(stagingDir, { recursive: true, force: true }), `Clear staging ${stagingDir}`)
  syncDirectory(sourceDir, stagingDir)

  // 2. Move the current live dir aside (if present), then move the staging dir
  //    into the target path. Best-effort cleanup of the retired dir follows.
  let movedOld = false
  if (fs.existsSync(targetDir)) {
    retryFileOperation(() => fs.renameSync(targetDir, retiredDir), `Retire ${targetDir} -> ${retiredDir}`)
    movedOld = true
  }
  retryFileOperation(() => fs.renameSync(stagingDir, targetDir), `Promote ${stagingDir} -> ${targetDir}`)

  if (movedOld) {
    // Best-effort: the old dir is no longer served. Removal may fail transiently
    // (e.g. a reader holding a file handle) — retry but never fail the build.
    try {
      retryFileOperation(
        () => fs.rmSync(retiredDir, { recursive: true, force: true }),
        `Cleanup retired ${retiredDir}`,
      )
    } catch (cleanupError) {
      console.warn(`[frontend] Retired dir ${retiredDir} could not be removed yet: ${cleanupError.message}. It is no longer served; it can be deleted manually.`)
    }
  }
}

function publishBuildOutput() {
  const buildAssetsDir = path.join(buildOutputDir, 'assets')

  if (fs.existsSync(buildAssetsDir)) {
    emptyDirectory(backendAssetsDir)
    syncDirectory(buildAssetsDir, backendAssetsDir)
  }

  for (const entry of fs.readdirSync(buildOutputDir, { withFileTypes: true })) {
    if (entry.name === 'assets') continue

    const sourcePath = path.join(buildOutputDir, entry.name)
    const targetPath = path.join(backendStaticDir, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath)
      continue
    }

    retryFileOperation(() => fs.mkdirSync(path.dirname(targetPath), { recursive: true }), `Create ${path.dirname(targetPath)}`)
    retryFileOperation(() => fs.copyFileSync(sourcePath, targetPath), `Copy ${targetPath}`)
  }
}

retryFileOperation(() => fs.rmSync(backupAssetsDir, { recursive: true, force: true }), `Remove ${backupAssetsDir}`)
if (fs.existsSync(backendAssetsDir)) {
  syncDirectory(backendAssetsDir, backupAssetsDir)
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

retryFileOperation(() => fs.rmSync(buildOutputDir, { recursive: true, force: true }), `Remove ${buildOutputDir}`)

const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
if (!fs.existsSync(viteEntry)) {
  throw new Error(`Cannot find Vite entrypoint at: ${viteEntry}`)
}

const result = spawnSync(process.execPath, [viteEntry, 'build', '--outDir', buildOutputDir, '--emptyOutDir'], {
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

try {
  publishBuildOutput()
} catch (error) {
  if (fs.existsSync(backupAssetsDir)) {
    try {
      replaceDirectory(backupAssetsDir, backendAssetsDir)
    } catch (restoreError) {
      console.error('[frontend] Static restore failed:', restoreError)
    }
  }
  console.error('[frontend] Static publish failed:', error)
  process.exit(1)
}

retryFileOperation(() => fs.rmSync(backupAssetsDir, { recursive: true, force: true }), `Remove ${backupAssetsDir}`)

if (fs.existsSync(backendLiveStaticDir)) {
  // Verify the source is complete first (stays a no-op if already in sync).
  const missingRuntimeFiles = collectMissingPaths(backendStaticDir, backendLiveStaticDir)

  // Atomically swap the live dir so a running Spring Boot dev server never
  // observes a mix of old and new build artifacts mid-publish. This replaces
  // the previous file-by-file syncDirectory() which could serve a previous
  // build's chunks alongside a new index.html (or vice versa) for several
  // seconds during a rebuild.
  atomicReplaceDirectory(backendStaticDir, backendLiveStaticDir)

  // Re-collect after the swap; the live dir is now an exact mirror of the source.
  const postSwapMissing = collectMissingPaths(backendStaticDir, backendLiveStaticDir)
  if (postSwapMissing.length > 0) {
    console.error('[frontend] Live backend static swap is incomplete. Missing files:')
    postSwapMissing.forEach((filePath) => console.error(` - ${filePath}`))
    process.exit(1)
  }

  if (missingRuntimeFiles.length === 0 && postSwapMissing.length === 0) {
    console.log(`[frontend] Atomic live static swap complete: ${backendLiveStaticDir}`)
  } else {
    console.log(`[frontend] Atomic live static swap complete (${postSwapMissing.length} stale) -> ${backendLiveStaticDir}`)
  }
}

process.exitCode = 0
