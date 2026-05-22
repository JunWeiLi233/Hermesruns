import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Run before `vite build` to prevent `backend/static/assets` from accumulating
// old hashed chunks across builds.
const frontendDir = fileURLToPath(new URL('.', import.meta.url))
const assetsDir = path.resolve(frontendDir, '../../backend/src/main/resources/static/assets')

fs.rmSync(assetsDir, { recursive: true, force: true })
fs.mkdirSync(assetsDir, { recursive: true })

console.log(`[frontend] Cleaned backend assets dir: ${assetsDir}`)

