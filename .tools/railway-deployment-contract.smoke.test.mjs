import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const dockerfile = read('Dockerfile')
const dockerIgnore = read('.dockerignore')
const applicationProperties = read('backend/src/main/resources/application.properties')
const railway = read('.railway/railway.ts')
const rootPackage = JSON.parse(read('package.json'))

assert.match(dockerfile, /FROM\s+node:24-alpine\s+AS\s+frontend-build/i)
assert.match(dockerfile, /FROM\s+eclipse-temurin:17-jdk-alpine\s+AS\s+backend-build/i)
assert.match(dockerfile, /FROM\s+eclipse-temurin:17-jre-alpine/i)
assert.match(dockerfile, /ENV\s+VITE_SOURCEMAP=false/i)
assert.match(dockerfile, /addgroup[\s\S]*adduser[\s\S]*USER\s+hermes/i)
assert.match(dockerfile, /ENTRYPOINT\s*\[\s*"java"\s*,\s*"-jar"\s*,\s*"app\.jar"\s*\]/i)

assert.match(applicationProperties, /^server\.port=\$\{PORT:8080\}$/m)
assert.match(railway, /export\s+const\s+partial\s*=\s*"hermes-web"/)
assert.match(railway, /service\("hermes-web",\s*\{[\s\S]*healthcheck:\s*"\/"/)
assert.match(railway, /healthcheckTimeout:\s*180/)
assert.equal(existsSync(resolve(repoRoot, 'railway.json')), false)
assert.equal(rootPackage.devDependencies?.railway, '3.11.0')

for (const ignoredPath of [
  '.git',
  '.railway',
  '.tmp',
  '.env',
  '.env.*',
  'Hermes.local.env.ps1',
  'backend/target',
  'frontend/node_modules',
  'backend/*.mv.db',
  '*.dump',
]) {
  assert.ok(
    dockerIgnore.split(/\r?\n/).includes(ignoredPath),
    `.dockerignore must exclude ${ignoredPath}`,
  )
}

console.log('railway-deployment-contract.smoke.test: PASS')
