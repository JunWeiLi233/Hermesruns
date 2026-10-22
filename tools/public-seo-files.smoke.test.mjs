import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { renderPublicDocument } from '../frontend/scripts/prerender-public-pages.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const robots = read('frontend/public/robots.txt')
const sitemap = read('frontend/public/sitemap.xml')
const privateIndex = read('frontend/index.html')
const frontendRequire = createRequire(resolve(repoRoot, 'frontend/package.json'))
const { createServer } = await import(pathToFileURL(frontendRequire.resolve('vite')).href)
const { default: react } = await import(pathToFileURL(frontendRequire.resolve('@vitejs/plugin-react')).href)
const { JSDOM } = frontendRequire('jsdom')
const server = await createServer({
  configFile: false, root: resolve(repoRoot, 'frontend'), plugins: [react()],
  appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, watch: null, hmr: false },
})
let index
try {
  const { renderPublicPage } = await server.ssrLoadModule('/src/publicPageEntry.jsx')
  index = renderPublicDocument(read('frontend/public.html'), renderPublicPage('/'))
} finally {
  await server.close()
}
const document = new JSDOM(index).window.document
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
assert.match(llms, /^# HermesRuns$/m)
assert.match(llms, /\[Home\]\(https:\/\/hermesruns\.com\/\):/)
assert.match(index, /<link rel="canonical" href="https:\/\/hermesruns\.com\/"/)
// The social card is PNG at the site root (what every platform reads); the no-script page displays
// a WebP copy, because displayed images under public/images are WebP only.
assert.match(index, /<meta property="og:image" content="https:\/\/hermesruns\.com\/og-image\.png"/)
assert.equal(document.querySelector('meta[property="og:image"]')?.content, 'https://hermesruns.com/og-image.png')
assert.ok(document.querySelector('#root img[fetchpriority="high"]'), 'The public hero image is discoverable before hydration')
assert.equal(existsSync(resolve(repoRoot, 'frontend/public/og-image.png')), true)
assert.equal(existsSync(resolve(repoRoot, 'frontend/public/images/og-image.webp')), true)
assert.match(index, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png/)
assert.equal(existsSync(resolve(repoRoot, 'frontend/public/apple-touch-icon.png')), true)
assert.equal(document.querySelector('#hermes-seo-jsonld')?.type, 'application/ld+json')
assert.ok(JSON.parse(document.querySelector('#hermes-seo-jsonld').textContent)['@graph']
  .some((entity) => entity['@type'] === 'WebApplication'))
assert.ok(document.querySelector('#root h1')?.textContent.trim().length > 10, 'The actual public React page renders its heading before hydration')
assert.equal(document.querySelectorAll('h1').length, 1, 'The public page has one crawlable primary heading')
// The product describes itself in its own words; Strava appears only as a source of runs.
assert.doesNotMatch(index, /<title>[^<]*Strava/)
assert.doesNotMatch(index, /<meta[^>]+name="description"[^>]+content="[^"]*Strava/)
assert.doesNotMatch(index, /support@hermes\.run\b/)
assert.ok(document.querySelectorAll('#root h2').length >= 2, 'The public page includes its feature sections before hydration')
for (const crawlablePath of ['/signup', '/terms', '/privacy']) {
  assert.match(index, new RegExp(`<a[^>]+href="${crawlablePath}"`))
}
assert.match(spaForwarding, /X-Robots-Tag/)
assert.match(spaForwarding, /noindex, nofollow, noarchive/)
assert.match(privateIndex, /name="robots" content="noindex,nofollow,noarchive"/)
assert.doesNotMatch(privateIndex, /rel="canonical"/, 'Private app shell must not pretend to be the public landing page')

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
// Root-level brand files must be public, or social cards and home-screen icons break in production.
assert.match(security, /"\/apple-touch-icon\.png", "\/og-image\.png"/)

// Brand files, from the hermes:runs logo kit (2026). The kit's own SVG and PNG files each carry a provenance
// blob (C2PA) of 5 to 8 KB; the copies we serve do not, and the tab icon stays a few hundred bytes.
const publicPath = (path) => resolve(repoRoot, 'frontend/public', path)
const pngChunkTypes = (path) => {
  const data = readFileSync(publicPath(path))
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} must be a PNG`)
  const types = []
  for (let at = 8; at < data.length; at += 12 + data.readUInt32BE(at)) types.push(data.toString('latin1', at + 4, at + 8))
  return { types, width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}
const faviconSvg = readFileSync(publicPath('favicon.svg'), 'utf8')
assert.equal(readFileSync(publicPath('hermes-tab-icon.svg'), 'utf8'), faviconSvg, 'hermes-tab-icon.svg is an alias of favicon.svg')
assert.ok(faviconSvg.length < 1024, 'The tab icon must stay small')
assert.match(faviconSvg, /<rect width="32" height="32" rx="8" fill="#1a1714"\/>/, 'The tab icon is the kit favicon: an ink tile')
assert.equal(faviconSvg.match(/fill="#ff5a3c"/g)?.length, 2, 'The tab icon is the kit colon: two coral squares')
for (const svg of ['favicon.svg', 'hermes-tab-icon.svg', 'images/hermesruns-logo.svg']) {
  assert.doesNotMatch(readFileSync(publicPath(svg), 'utf8'), /<metadata|c2pa|<script|<style|<image|href=/i, `${svg} must be plain artwork`)
}
assert.match(readFileSync(publicPath('images/hermesruns-logo.svg'), 'utf8'), /viewBox="0 0 464\.3 96"/, 'The horizontal logo is the kit lockup')
assert.match(index, /<meta name="theme-color" content="#1a1714"/)
assert.ok(document.querySelector('#root a[href="/"]'), 'The rendered brand links to the public home page')

const touchIcon = pngChunkTypes('apple-touch-icon.png')
assert.deepEqual([touchIcon.width, touchIcon.height], [180, 180])
const socialCard = pngChunkTypes('og-image.png')
assert.deepEqual([socialCard.width, socialCard.height], [1200, 630])
for (const png of [touchIcon, socialCard]) {
  assert.deepEqual(png.types.filter((type) => !['IHDR', 'IDAT', 'IEND'].includes(type)), [], 'Served PNGs carry no provenance or text chunks')
}
const ico = readFileSync(publicPath('favicon.ico'))
assert.equal(ico.readUInt16LE(2), 1, 'favicon.ico must be an icon file')
assert.deepEqual(
  Array.from({ length: ico.readUInt16LE(4) }, (_, frame) => ico[6 + frame * 16] || 256),
  [16, 32, 48],
  'favicon.ico holds the 16, 32 and 48 px frames',
)
const webp = readFileSync(publicPath('images/og-image.webp'))
assert.equal(webp.toString('latin1', 0, 4) + webp.toString('latin1', 8, 12), 'RIFFWEBP')

console.log('public-seo-files.smoke.test: PASS')
