import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Run before `vite build` to prevent `backend/static/assets` from accumulating
// old hashed chunks across builds.
const frontendDir = fileURLToPath(new URL('.', import.meta.url))
const assetsDir = path.resolve(frontendDir, '../../backend/src/main/resources/static/assets')

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function retryFileOperation(operation, description) {
  let lastError

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return operation()
    } catch (error) {
      lastError = error
      sleep(75 * (attempt + 1))
    }
  }

  throw new Error(`${description} failed after retries: ${lastError?.message ?? 'unknown error'}`)
}

retryFileOperation(() => fs.mkdirSync(assetsDir, { recursive: true }), 'Create backend assets dir')

for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
  const entryPath = path.join(assetsDir, entry.name)
  retryFileOperation(() => fs.rmSync(entryPath, { recursive: true, force: true }), `Remove ${entryPath}`)
}

console.log(`[frontend] Cleaned backend assets dir: ${assetsDir}`)

