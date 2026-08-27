import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const robots = read('frontend/public/robots.txt')
const sitemap = read('frontend/public/sitemap.xml')
const security = read('backend/src/main/java/com/hermes/backend/SecurityConfig.java')

assert.match(robots, /^User-agent: \*$/m)
assert.match(robots, /^Allow: \/$/m)
for (const privatePrefix of [
  '/api/', '/admin', '/dashboard', '/workflows', '/login', '/signup',
  '/forgot-password', '/profile', '/runs', '/heatmap', '/analysis',
  '/prediction', '/today-run', '/rewards', '/settings', '/shoes',
  '/shoe-catalog', '/races', '/schedule', '/muscle-training', '/weather',
]) {
  assert.match(robots, new RegExp(`^Disallow: ${privatePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
}
assert.match(robots, /^Sitemap: https:\/\/hermesruns\.com\/sitemap\.xml$/m)

assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
for (const publicUrl of [
  'https://hermesruns.com/',
  'https://hermesruns.com/terms',
  'https://hermesruns.com/privacy',
]) {
  assert.match(sitemap, new RegExp(`<loc>${publicUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`))
}
for (const privateUrlSegment of ['/login', '/signup', '/dashboard', '/profile', '/runs']) {
  assert.doesNotMatch(sitemap, new RegExp(`<loc>[^<]*${privateUrlSegment.replace('/', '\\/')}`))
}

assert.match(security, /"\/robots\.txt",\s*"\/sitemap\.xml"/)

console.log('public-seo-files.smoke.test: PASS')
