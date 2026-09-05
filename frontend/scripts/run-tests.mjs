import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

// Portable frontend test runner. Discovers every *.test.js and *.smoke.test.js
// under src/ and runs each file with plain `node`.
// Cross-platform replacement for the previous Windows-only
// `powershell -Command "& 'C:\Program Files\nodejs\node.exe' ..."` script.

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = path.resolve(frontendDir, '..')
const srcDir = path.join(projectRoot, 'src')
const styleBundleGenerator = path.resolve(projectRoot, '../tools/generate-legacy-style-bundle.mjs')

const styleBundleResult = spawnSync(process.execPath, [styleBundleGenerator], {
  cwd: path.resolve(projectRoot, '..'),
  stdio: 'inherit',
})

if (styleBundleResult.status !== 0) {
  console.error('[hermes-tests] Failed to generate the active-style compatibility bundle.')
  process.exit(styleBundleResult.status ?? 1)
}

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

const selections = process.argv.slice(2)
const allTestFiles = walk(srcDir).sort()
const selectedRoots = selections.map((selection) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selection)) {
    throw new Error(`Invalid test feature: ${selection}. Use a directory name such as runs or today-run.`)
  }
  const selected = selection === 'shared'
    ? path.join(srcDir, 'test', 'contracts')
    : path.resolve(srcDir, 'pages', selection)
  const relative = path.relative(srcDir, selected)
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(selected)) {
    throw new Error(`Unknown test feature: ${selection}. Use a directory under src/pages/ or shared.`)
  }
  return selected
})
const testFiles = selectedRoots.length
  ? allTestFiles.filter((file) => selectedRoots.some((selected) => file.startsWith(selected + path.sep)))
  : allTestFiles

if (testFiles.length === 0) {
  console.error(`[hermes-tests] No *.test.js files found for ${selections.join(', ') || 'src/'}.`)
  process.exit(1)
}

const nodeBin = process.execPath
let passed = 0
let failed = 0
const failures = []

function summarizeFailure(result) {
  if (result.error) return result.error.message
  const output = `${result.stderr || ''}\n${result.stdout || ''}`
  const assertion = output.match(/AssertionError(?: \[ERR_ASSERTION\])?:\s*([^\r\n]+)/)
  if (assertion) return assertion[1]
  const thrown = output.match(/(?:^|\n)Error:\s*([^\r\n]+)/)
  if (thrown) return thrown[1]
  const syntax = output.match(/SyntaxError:\s*([^\r\n]+)/)
  if (syntax) return `SyntaxError: ${syntax[1]}`
  return `exit ${result.status ?? 'unknown'}`
}

for (const file of testFiles) {
  const rel = path.relative(projectRoot, file)
  const result = spawnSync(nodeBin, [file], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })

  if (result.status === 0) {
    passed += 1
    console.log(`[hermes-tests] PASS  ${rel}`)
  } else {
    failed += 1
    failures.push(rel)
    console.error(`[hermes-tests] FAIL  ${rel} :: ${summarizeFailure(result)}`)
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
