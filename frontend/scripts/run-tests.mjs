import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

// Portable frontend test runner. Discovers every *.test.js and *.smoke.test.js
// under src/ and runs each file with plain `node` (fail-fast on first failure).
// Cross-platform replacement for the previous Windows-only
// `powershell -Command "& 'C:\Program Files\nodejs\node.exe' ..."` script.

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = path.resolve(frontendDir, '..')
const srcDir = path.join(projectRoot, 'src')

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, files)
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(full)
    }
  }
  return files
}

const testFiles = walk(srcDir).sort()

if (testFiles.length === 0) {
  console.error('[hermes-tests] No *.test.js files found under src/.')
  process.exit(1)
}

const nodeBin = process.execPath
let passed = 0
let failed = 0
const failures = []

for (const file of testFiles) {
  const rel = path.relative(projectRoot, file)
  const result = spawnSync(nodeBin, [file], {
    cwd: projectRoot,
    stdio: 'inherit',
  })

  if (result.status === 0) {
    passed += 1
    console.log(`[hermes-tests] PASS  ${rel}`)
  } else {
    failed += 1
    failures.push(rel)
    console.error(`[hermes-tests] FAIL  ${rel} (exit ${result.status})`)
  }
}

console.log('-----------------------------------------')
console.log(`[hermes-tests] ${passed} passed, ${failed} failed (${testFiles.length} total)`)

if (failed > 0) {
  console.error('[hermes-tests] Failing files:')
  for (const rel of failures) {
    console.error(`  - ${rel}`)
  }
  process.exit(1)
}
