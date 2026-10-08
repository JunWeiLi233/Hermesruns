import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dockerfile = readFileSync(resolve(import.meta.dirname, '../Dockerfile'), 'utf8')
  .replace(/\\\r?\n[\t ]*/g, ' ')
const declaration = dockerfile.match(/^ENV JAVA_OPTS=("[^\r\n]+")$/m)
assert.ok(declaration, 'The image must declare one overridable JVM option set.')
const flags = JSON.parse(declaration[1]).trim().split(/\s+/)

assert.deepEqual(flags.filter(flag => /^-XX:\+Use\w+GC$/.test(flag)), ['-XX:+UseG1GC'],
  'Use one collector that can reclaim unused heap during idle periods.')
assert.ok(flags.includes('-XX:G1PeriodicGCInterval=60000'), 'Reclaim idle heap periodically without stopping the service.')
assert.ok(flags.includes('-Xms64m'), 'Keep a small initial heap.')
assert.ok(flags.includes('-Xmx640m'), 'Preserve the tested large-import heap headroom.')
assert.ok(flags.includes('-XX:MaxMetaspaceSize=192m'), 'Allow tested class-metadata headroom during full catalog initialization.')
assert.ok(flags.includes('-XX:ParallelGCThreads=2'))
assert.ok(flags.includes('-XX:ConcGCThreads=1'))
assert.ok(flags.includes('-XX:+ExitOnOutOfMemoryError'))

// Test the actual VM's option parser, rather than trusting string assertions.
// The image's JVM flags must remain compatible with the supported Java 17+
// local toolchain as well as the Java 25 production image.
const env = { ...process.env }
delete env.JAVA_TOOL_OPTIONS
delete env.JDK_JAVA_OPTIONS
delete env._JAVA_OPTIONS
const java = process.env.JAVA_MEMORY_TEST_BIN || 'java'
const vm = spawnSync(java, [...flags, '-XX:+PrintFlagsFinal', '-version'], {
  encoding: 'utf8', env, windowsHide: true, timeout: 30000,
})
{
  assert.equal(vm.error, undefined, 'Java is required for native validation; set JAVA_MEMORY_TEST_BIN to a Java 17+ executable.')
  assert.equal(vm.status, 0, `The production options must start a JVM: ${vm.stderr}`)
  assert.match(vm.stdout, /\bUseG1GC\s*=\s*true\b/)
  assert.match(vm.stdout, /\bG1PeriodicGCInterval\s*=\s*60000\b/)
  assert.match(vm.stdout, /\bMaxHeapSize\s*=\s*671088640\b/)
  assert.match(vm.stdout, /\bMaxMetaspaceSize\s*=\s*201326592\b/)
  assert.match(vm.stdout, /\bParallelGCThreads\s*=\s*2\b/)
  assert.match(vm.stdout, /\bConcGCThreads\s*=\s*1\b/)
  console.log('railway-jvm-runtime.smoke.test: source and native VM PASS')
}
