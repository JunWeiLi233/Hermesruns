import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const visited = new Set()

function readStyleFile(relativePath) {
  const absolutePath = path.resolve(sourceRoot, relativePath)
  if (visited.has(absolutePath)) return ''
  visited.add(absolutePath)

  const source = readFileSync(absolutePath, 'utf8')
  const imports = [...source.matchAll(/@import\s+['"](.+?)['"];?/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => path.relative(sourceRoot, path.resolve(path.dirname(absolutePath), specifier)))

  return [source, ...imports.map(readStyleFile)].join('\n')
}

export function readRuntimeStyles() {
  visited.clear()
  return readStyleFile('index.css')
}
