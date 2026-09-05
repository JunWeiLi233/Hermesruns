import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const robots = read('frontend/public/robots.txt')
const sitemap = read('frontend/public/sitemap.xml')
const index = read('frontend/index.html')
const llms = read('frontend/public/llms.txt')
const security = read('backend/src/main/java/com/hermes/backend/auth/SecurityConfig.java')
const spaForwarding = read('backend/src/main/java/com/hermes/backend/infrastructure/web/SpaForwardingController.java')

assert.match(robots, /^User-agent: \*$/m)
assert.match(robots, /^Allow: \/$/m)
for (const privatePrefix of [
  '/api/', '/admin', '/dashboard', '/workflows', '/login', '/signup',
  '/forgot-password', '/profile', '/runs', '/heatmap', '/analysis',
  '/prediction', '/today-run', '/rewards', '/settings', '/shoes',
  '/shoe-catalog', '/races', '/schedule', '/muscle-training', '/weather',
  '/run',
]) {
  assert.match(robots, new RegExp(`^Disallow: ${privatePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
}
assert.match(robots, /^Sitemap: https:\/\/hermesruns\.com\/sitemap\.xml$/m)
assert.match(llms, /^# Hermes$/m)
assert.match(llms, /\[Home\]\(https:\/\/hermesruns\.com\/\):/)
assert.match(index, /<link rel="canonical" href="https:\/\/hermesruns\.com\/"/)
assert.match(index, /<meta property="og:image" content="https:\/\/hermesruns\.com\/images\/hermes-og-image\.svg"/)
assert.equal(existsSync(resolve(repoRoot, 'frontend/public/images/hermes-og-image.svg')), true)
assert.match(index, /<script type="application\/ld\+json" id="hermes-seo-jsonld">/)
assert.match(index, /"@type": "WebApplication"/)
assert.match(index, /<h1 id="hermes-seo-title">Running analytics with Strava sync<\/h1>/)
assert.match(index, /<h2 id="hermes-features-title">One running analytics app for the decisions that matter<\/h2>/)
for (const crawlablePath of ['/signup', '/terms', '/privacy']) {
  assert.match(index, new RegExp(`<a[^>]+href="${crawlablePath}"`))
}
assert.match(spaForwarding, /X-Robots-Tag/)
assert.match(spaForwarding, /noindex, nofollow, noarchive/)

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
assert.match(security, /"\/llms\.txt"/)

console.log('public-seo-files.smoke.test: PASS')
