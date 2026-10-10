import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// The landing page and the Settings plan card state the free plan's monthly shoe-photo scans as a
// number. The real limit is app.quota.free.shoe-scan in application.properties, which overrides
// QuotaService's default, so the copy must follow the properties file, not the Java default.
const repoRoot = resolve(import.meta.dirname, '..')
const properties = readFileSync(resolve(repoRoot, 'backend/src/main/resources/application.properties'), 'utf8')
const match = properties.match(/^app\.quota\.free\.shoe-scan=(\d+)\s*$/m)
assert.ok(match, 'application.properties should set app.quota.free.shoe-scan to a number')
const limit = match[1]

for (const locale of ['en', 'zh-CN']) {
  const { default: copy } = await import(pathToFileURL(resolve(repoRoot, `frontend/src/i18n/locales/${locale}/index.js`)).href)
  for (const [namespace, key] of [['landing', 'studio_pricing_runner_scans'], ['settings', 'plan_free_copy']]) {
    const text = copy[namespace]?.[key]
    assert.equal(typeof text, 'string', `${locale} ${namespace}.${key} should exist`)
    const numbers = text.match(/\d+/g) || []
    assert.deepEqual(numbers, [limit], `${locale} ${namespace}.${key} should state ${limit} free scans a month, as app.quota.free.shoe-scan does: "${text}"`)
  }
}

console.log(`free-plan-copy: landing and plan card state ${limit} free scans a month, matching application.properties`)
