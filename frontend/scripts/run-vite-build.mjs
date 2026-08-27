import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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

  const failedOperation = new Error(`${description} failed after retries: ${lastError?.message ?? 'unknown error'}`)
  failedOperation.code = lastError?.code
  throw failedOperation
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

// --- Build completeness assertion ------------------------------------------------
// A previously shipped index.html referenced asset chunks that did not exist in
// the published static dir (observed 2026-08-24 19:11), breaking the app at
// runtime while the build reported success. Instead of warning, fail loudly:
// every local asset referenced by the produced index.html must exist.
function collectMissingIndexAssets(staticDir) {
  const indexPath = path.join(staticDir, 'index.html')
  if (!fs.existsSync(indexPath)) return ['index.html']

  const html = fs.readFileSync(indexPath, 'utf8')
  const references = new Set()

  for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    let ref = match[1].trim()
    if (!ref) continue
    ref = ref.split('#')[0].split('?')[0]
    if (!ref) continue
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) continue // http:, https:, data:, mailto:, ...
    if (ref.startsWith('//')) continue
    const relative = ref.replace(/^\/+/, '')
    if (!relative) continue
    references.add(relative)
  }

  const missing = []
  for (const ref of references) {
    if (!fs.existsSync(path.join(staticDir, ...ref.split('/')))) missing.push(ref)
  }
  return missing.sort()
}

function assertIndexAssetsExist(staticDir, label) {
  const missing = collectMissingIndexAssets(staticDir)
  if (missing.length === 0) return

  console.error(`[frontend] ${label} is INCOMPLETE: index.html references ${missing.length} missing asset(s):`)
  missing.forEach((ref) => console.error(` - ${ref}`))
  console.error('[frontend] Failing the build instead of shipping an index.html that references nonexistent chunks.')
  process.exit(1)
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

function isLockedDirectoryRenameError(error) {
  return error?.code === 'EBUSY' || error?.code === 'EPERM' || error?.code === 'EACCES'
}

function cleanUpStagingDirectory(stagingDir) {
  if (!fs.existsSync(stagingDir)) return

  try {
    retryFileOperation(() => fs.rmSync(stagingDir, { recursive: true, force: true }), `Cleanup staging ${stagingDir}`)
  } catch (cleanupError) {
    console.warn(`[frontend] Staging dir ${stagingDir} could not be removed yet: ${cleanupError.message}. It can be deleted manually.`)
  }
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

  let movedOld = false
  let promotedStaging = false

  try {
    // 1. Stage a complete copy beside the target.
    retryFileOperation(() => fs.rmSync(stagingDir, { recursive: true, force: true }), `Clear staging ${stagingDir}`)
    syncDirectory(sourceDir, stagingDir)

    // 2. Move the current live dir aside (if present), then move the staging dir
    //    into the target path. Best-effort cleanup of the retired dir follows.
    if (fs.existsSync(targetDir)) {
      retryFileOperation(() => fs.renameSync(targetDir, retiredDir), `Retire ${targetDir} -> ${retiredDir}`)
      movedOld = true
    }
    retryFileOperation(() => fs.renameSync(stagingDir, targetDir), `Promote ${stagingDir} -> ${targetDir}`)
    promotedStaging = true
  } catch (error) {
    if (movedOld && !promotedStaging && !fs.existsSync(targetDir) && fs.existsSync(retiredDir)) {
      try {
        retryFileOperation(() => fs.renameSync(retiredDir, targetDir), `Restore ${retiredDir} -> ${targetDir}`)
      } catch (restoreError) {
        console.error(`[frontend] Live static restore failed: ${restoreError.message}`)
      }
    }
    throw error
  } finally {
    cleanUpStagingDirectory(stagingDir)
  }

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

const DEFAULT_KEEP_BUILDS = 3
const generationStateDir = path.resolve(projectRoot, '.asset-generations')

function listAssetFiles(assetsDir) {
  const files = []
  if (!fs.existsSync(assetsDir)) return files

  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name)
        continue
      }
      files.push(prefix ? `${prefix}/${entry.name}` : entry.name)
    }
  }

  walk(assetsDir)
  return files
}

function loadRetainedGenerations(keepBuilds) {
  if (!fs.existsSync(generationStateDir)) return []

  return fs.readdirSync(generationStateDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, Math.max(0, keepBuilds - 1))
    .map((name) => JSON.parse(fs.readFileSync(path.join(generationStateDir, name), 'utf8')))
}

// --- Unchanged-source fast path -------------------------------------------------
// start_hermes.bat runs this script on every boot. Rebuilding identical sources
// costs seconds warm (and far more on a cold disk) and rewrites classpath/static
// files that devtools and antivirus then have to re-scan. A fingerprint of all
// build inputs lets identical re-runs skip straight to success.

const fingerprintFile = path.resolve(projectRoot, '../.tmp/frontend-build-fingerprint.json')

function collectFingerprintEntries(dir, prefix = '') {
  const entries = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      entries.push(...collectFingerprintEntries(path.join(dir, entry.name), rel))
      continue
    }
    const stats = fs.statSync(path.join(dir, entry.name))
    entries.push(`${rel}\0${stats.size}\0${Math.round(stats.mtimeMs)}\n`)
  }
  return entries
}

function computeSourceFingerprint(extraArgs) {
  try {
    const hash = createHash('sha256')
    const rootFiles = [
      'index.html',
      'package.json',
      'package-lock.json',
      'vite.config.js',
      'vite.config.ts',
      'vite.config.mjs',
    ]
    for (const name of fs.readdirSync(projectRoot)) {
      if (name.startsWith('.env')) rootFiles.push(name)
    }
    for (const name of rootFiles) {
      const filePath = path.join(projectRoot, name)
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue
      const stats = fs.statSync(filePath)
      hash.update(`#${name}\0${stats.size}\0${Math.round(stats.mtimeMs)}\n`)
    }
    for (const dirName of ['public', 'src']) {
      const dir = path.join(projectRoot, dirName)
      if (!fs.existsSync(dir)) continue
      hash.update(`#${dirName}\n`)
      collectFingerprintEntries(dir).sort().forEach((line) => hash.update(line))
    }
    // --force only bypasses the skip; it does not change build output, so exclude
    // it from the fingerprint or a forced build would poison the next comparison.
    const outputAffectingArgs = extraArgs.filter((arg) => arg !== '--force')
    hash.update(`#args\0${outputAffectingArgs.join(' ')}\n`)
    hash.update(`#sourcemap\0${process.env.VITE_SOURCEMAP === 'true' ? 'true' : 'false'}\n`)
    return hash.digest('hex')
  } catch {
    // Any surprise while hashing inputs: fall back to a full build.
    return null
  }
}

function readSavedFingerprint() {
  try {
    const saved = JSON.parse(fs.readFileSync(fingerprintFile, 'utf8'))
    return typeof saved?.fingerprint === 'string' ? saved.fingerprint : null
  } catch {
    return null
  }
}

function saveFingerprint(fingerprint) {
  try {
    fs.mkdirSync(path.dirname(fingerprintFile), { recursive: true })
    fs.writeFileSync(fingerprintFile, JSON.stringify({ fingerprint, savedAt: new Date().toISOString() }, null, 2))
  } catch (error) {
    // A failed fingerprint write only means the next run rebuilds.
    console.warn(`[frontend] Could not save build fingerprint: ${error.message}`)
  }
}

function publishedOutputLooksComplete() {
  if (!fs.existsSync(path.join(backendStaticDir, 'index.html'))) return false
  const publishedAssets = fs.existsSync(backendAssetsDir) ? fs.readdirSync(backendAssetsDir) : []
  if (!publishedAssets.some((name) => name.endsWith('.js'))) return false
  if (fs.existsSync(backendLiveStaticDir) && !fs.existsSync(path.join(backendLiveStaticDir, 'index.html'))) return false
  if (collectMissingIndexAssets(backendStaticDir).length > 0) return false
  if (fs.existsSync(backendLiveStaticDir) && collectMissingIndexAssets(backendLiveStaticDir).length > 0) return false
  return true
}

function trySkipUnchangedBuild(buildArgs) {
  if (buildArgs.includes('--force') || process.env.HERMES_FORCE_FRONTEND_BUILD === '1') return false

  const fingerprint = computeSourceFingerprint(buildArgs)
  if (fingerprint === null) return false
  if (fingerprint !== readSavedFingerprint()) return false
  if (!publishedOutputLooksComplete()) return false

  console.log('[frontend] Skipping Vite build — sources unchanged since the last successful build (use --force to rebuild).')
  return true
}

function writeGenerationManifest(files) {
  retryFileOperation(() => fs.mkdirSync(generationStateDir, { recursive: true }), `Create ${generationStateDir}`)
  retryFileOperation(
    () => fs.writeFileSync(path.join(generationStateDir, `${Date.now()}.json`), JSON.stringify(files)),
    `Write generation manifest`,
  )
}

function rotateGenerationManifests(keepBuilds) {
  if (!fs.existsSync(generationStateDir)) return

  const manifests = fs.readdirSync(generationStateDir).filter((name) => name.endsWith('.json')).sort().reverse()
  for (const name of manifests.slice(Math.max(0, keepBuilds - 1))) {
    retryFileOperation(() => fs.rmSync(path.join(generationStateDir, name), { force: true }), `Remove manifest ${name}`)
  }
}

function pruneAssetsToGenerations(assetsDir, keepSet) {
  if (!fs.existsSync(assetsDir)) return 0
  let removed = 0

  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(entryPath, relative)
        if (fs.readdirSync(entryPath).length === 0) {
          retryFileOperation(() => fs.rmSync(entryPath, { recursive: true, force: true }), `Remove empty ${entryPath}`)
        }
        continue
      }
      // Security-sensitive retired entry points must disappear immediately,
      // even while ordinary hashed chunks remain available for older tabs.
      // The former public admin sign-in page is intentionally not retained.
      if (entry.name.startsWith('AdminLogin-')) {
        retryFileOperation(() => fs.rmSync(entryPath, { force: true }), `Prune retired admin login ${entryPath}`)
        removed += 1
        continue
      }
      if (keepSet.has(relative)) continue
      retryFileOperation(() => fs.rmSync(entryPath, { force: true }), `Prune ${entryPath}`)
      removed += 1
    }
  }

  walk(assetsDir)
  return removed
}

function stripSourceMapReferences(filePath) {
  if (!/\.(?:js|css)$/i.test(filePath)) return false

  const source = fs.readFileSync(filePath, 'utf8')
  const sanitized = source
    .replace(/(?:\r?\n)?\/\*[#@]\s*sourceMappingURL=[^*]*\*\/\s*$/, '')
    .replace(/(?:\r?\n)?\/\/[#@]\s*sourceMappingURL=[^\r\n]*\s*$/, '')

  if (sanitized === source) return false
  retryFileOperation(() => fs.writeFileSync(filePath, sanitized), `Strip source map reference from ${filePath}`)
  return true
}

function removeSourceMapArtifacts(staticDir) {
  if (!fs.existsSync(staticDir)) return { removedMaps: 0, strippedReferences: 0 }

  let removedMaps = 0
  let strippedReferences = 0

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(entryPath)
        continue
      }
      if (entry.name.endsWith('.map')) {
        retryFileOperation(() => fs.rmSync(entryPath, { force: true }), `Remove source map ${entryPath}`)
        removedMaps += 1
        continue
      }
      if (stripSourceMapReferences(entryPath)) strippedReferences += 1
    }
  }

  walk(staticDir)
  return { removedMaps, strippedReferences }
}

function publishBuildOutput() {
  const buildAssetsDir = path.join(buildOutputDir, 'assets')

  if (fs.existsSync(buildAssetsDir)) {
    // Hashed assets are immutable. Keep bundles from the last few builds so a
    // tab holding a previously served index.html can still load its CSS/JS
    // after a rebuild — but bound retention by build generation. Without this
    // the directory grows without bound (~10k stale chunks / ~1GB observed)
    // and every backend start pays to scan and copy all of it.
    const rawKeep = Number.parseInt(process.env.HERMES_ASSET_KEEP_BUILDS ?? '', 10)
    const keepBuilds = Number.isFinite(rawKeep) && rawKeep >= 1 ? rawKeep : DEFAULT_KEEP_BUILDS
    const retainedGenerations = loadRetainedGenerations(keepBuilds)
    const newFiles = listAssetFiles(buildAssetsDir)

    copyDirectory(buildAssetsDir, backendAssetsDir)

    const keepSet = new Set(newFiles)
    for (const generation of retainedGenerations) {
      for (const file of generation) keepSet.add(file)
    }
    const removedCount = pruneAssetsToGenerations(backendAssetsDir, keepSet)

    writeGenerationManifest(newFiles)
    rotateGenerationManifests(keepBuilds)

    if (removedCount > 0) {
      console.log(`[frontend] Pruned ${removedCount} stale asset file(s) beyond the last ${keepBuilds} build(s).`)
    }
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

if (trySkipUnchangedBuild(process.argv.slice(2))) {
  process.exit(0)
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
// Source maps are opt-in for local debugging and must not ship by default.
process.env.VITE_SOURCEMAP = process.env.VITE_SOURCEMAP || 'false'
const sourceMapsEnabled = process.env.VITE_SOURCEMAP === 'true'

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
  if (!sourceMapsEnabled) {
    const sanitized = removeSourceMapArtifacts(backendStaticDir)
    if (sanitized.removedMaps > 0 || sanitized.strippedReferences > 0) {
      console.log(
        `[frontend] Removed ${sanitized.removedMaps} source map(s) and ${sanitized.strippedReferences} sourceMappingURL reference(s).`,
      )
    }
  }
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

// The final published index.html must not reference any asset that is missing
// from the backend static dir (build completeness assertion).
assertIndexAssetsExist(backendStaticDir, 'Published backend static')

if (fs.existsSync(backendLiveStaticDir)) {
  // Verify the source is complete first (stays a no-op if already in sync).
  const missingRuntimeFiles = collectMissingPaths(backendStaticDir, backendLiveStaticDir)

  // Atomically swap the live dir so a running Spring Boot dev server never
  // observes a mix of old and new build artifacts mid-publish. This replaces
  // the previous file-by-file syncDirectory() which could serve a previous
  // build's chunks alongside a new index.html (or vice versa) for several
  // seconds during a rebuild.
  let usedAtomicSwap = true
  try {
    atomicReplaceDirectory(backendStaticDir, backendLiveStaticDir)
  } catch (error) {
    if (!isLockedDirectoryRenameError(error)) throw error

    usedAtomicSwap = false
    console.warn('[frontend] Live static directory swap is locked; falling back to an in-place file sync.')
    syncDirectory(backendStaticDir, backendLiveStaticDir)
  }

  // Re-collect after the swap; the live dir is now an exact mirror of the source.
  const postSwapMissing = collectMissingPaths(backendStaticDir, backendLiveStaticDir)
  if (postSwapMissing.length > 0) {
    console.error('[frontend] Live backend static swap is incomplete. Missing files:')
    postSwapMissing.forEach((filePath) => console.error(` - ${filePath}`))
    process.exit(1)
  }

  if (usedAtomicSwap && missingRuntimeFiles.length === 0 && postSwapMissing.length === 0) {
    console.log(`[frontend] Atomic live static swap complete: ${backendLiveStaticDir}`)
  } else if (usedAtomicSwap) {
    console.log(`[frontend] Atomic live static swap complete (${postSwapMissing.length} stale) -> ${backendLiveStaticDir}`)
  } else {
    console.log(`[frontend] Live backend static sync complete after locked directory fallback: ${backendLiveStaticDir}`)
  }
}

saveFingerprint(computeSourceFingerprint(process.argv.slice(2)))

process.exitCode = 0
