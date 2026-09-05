import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8').replace(/\r\n/g, '\n')

const dockerfile = read('Dockerfile')
const dockerIgnore = read('.dockerignore')
const applicationProperties = read('backend/src/main/resources/application.properties')
const railway = read('.railway/railway.ts')
const rootPackage = JSON.parse(read('package.json'))

// Read logical instructions so comments cannot satisfy checks and continuations/CRLF are harmless.
const instructions = dockerfile.replace(/\\\n[\t ]*/g, ' ')
  .split('\n')
  .map((line) => line.trim().replace(/[\t ]+/g, ' '))
  .filter((line) => line && !line.startsWith('#'))
const stages = []
for (const instruction of instructions) {
  if (instruction.startsWith('FROM ')) stages.push({ from: instruction, instructions: [] })
  else if (stages.length) stages.at(-1).instructions.push(instruction)
}

assert.deepEqual(stages.map((stage) => stage.from), [
  'FROM node:26-alpine AS frontend-build',
  'FROM eclipse-temurin:25-jdk-alpine AS backend-build',
  'FROM eclipse-temurin:25-jre-alpine',
], 'Keep the three canonical Node 26 / JDK 25 / JRE 25 stages in order.')

function assertOrdered(stage, required) {
  let previous = -1
  for (const instruction of required) {
    const index = stage.instructions.indexOf(instruction)
    assert.ok(index > previous, `${stage.from}: missing or out-of-order instruction: ${instruction}`)
    previous = index
  }
}

const [frontend, backend, runtime] = stages
assert.deepEqual(frontend.instructions.filter((line) => line.startsWith('ENV VITE_SOURCEMAP=')), [
  'ENV VITE_SOURCEMAP=false',
], 'The Docker frontend build must disable source maps without a later override.')
assertOrdered(frontend, [
  'WORKDIR /frontend',
  'ENV VITE_SOURCEMAP=false',
  'COPY frontend/package*.json ./',
  'RUN npm ci --ignore-scripts',
  'COPY frontend/index.html ./',
  'COPY frontend/vite.config.js ./',
  'COPY frontend/postcss.config.js ./',
  'COPY frontend/tailwind.config.js ./',
  'COPY frontend/eslint.config.js ./',
  'COPY frontend/public ./public',
  'COPY frontend/scripts ./scripts',
  'COPY frontend/src ./src',
  'RUN node scripts/run-vite-build.mjs',
])
assertOrdered(backend, [
  'WORKDIR /backend',
  'COPY backend/pom.xml ./',
  'COPY backend/mvnw ./',
  'COPY backend/.mvn ./.mvn',
  'COPY backend/src ./src',
  'COPY --from=frontend-build /backend/src/main/resources/static ./src/main/resources/static',
  'RUN chmod +x ./mvnw && ./mvnw -q -DskipTests package',
])
assertOrdered(runtime, [
  'WORKDIR /app',
  'RUN addgroup -S hermes && adduser -S -G hermes hermes && chown -R hermes:hermes /app',
  'COPY --chown=hermes:hermes --from=backend-build /backend/target/*.jar app.jar',
  'COPY --chown=hermes:hermes frontend/src/data/worldRaceCatalog.json ./frontend/src/data/worldRaceCatalog.json',
  'USER hermes',
])
assert.deepEqual(runtime.instructions.filter((line) => line.startsWith('USER ')), ['USER hermes'],
  'The final image must run as hermes, without switching back to root.')
assert.deepEqual(runtime.instructions.filter((line) => line.startsWith('EXPOSE ')), ['EXPOSE 8080'])

const javaOptions = runtime.instructions.filter((line) => line.startsWith('ENV JAVA_OPTS='))
assert.equal(javaOptions.length, 1, 'Keep one overridable JAVA_OPTS default in the runtime stage.')
const flags = JSON.parse(javaOptions[0].slice('ENV JAVA_OPTS='.length)).split(/\s+/)
assert.deepEqual(flags, [
  '-Xms64m',
  '-Xmx512m',
  '-XX:+UseSerialGC',
  '-XX:MaxMetaspaceSize=192m',
  '-XX:MinHeapFreeRatio=20',
  '-XX:MaxHeapFreeRatio=40',
  '-XX:+ExitOnOutOfMemoryError',
], 'Preserve bounded heap/metaspace, SerialGC, heap shrinking, and fail-fast OOM defaults.')

const entrypoints = runtime.instructions.filter((line) => line.startsWith('ENTRYPOINT '))
assert.equal(entrypoints.length, 1, 'Keep exactly one runtime ENTRYPOINT.')
assert.deepEqual(JSON.parse(entrypoints[0].slice('ENTRYPOINT '.length)), [
  'sh', '-c', 'exec java $JAVA_OPTS -jar app.jar',
], 'Use sh to expand deploy-time JAVA_OPTS and exec to make Java the signal-receiving process.')
assertOrdered(runtime, ['USER hermes', javaOptions[0], 'EXPOSE 8080', entrypoints[0]])

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
  '.workspace',
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
