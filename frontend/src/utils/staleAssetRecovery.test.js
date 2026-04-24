import assert from 'node:assert/strict'
import {
  clearStaleAssetReloadGuard,
  isChunkLoadFailure,
  isStaleAssetElement,
} from './staleAssetRecovery.js'

globalThis.window = {
  location: {
    origin: 'http://localhost:8080',
    href: 'http://localhost:8080/dashboard',
  },
  sessionStorage: {
    store: new Map(),
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null
    },
    setItem(key, value) {
      this.store.set(key, String(value))
    },
    removeItem(key) {
      this.store.delete(key)
    },
  },
}

clearStaleAssetReloadGuard()

assert.equal(isChunkLoadFailure(new Error('Failed to fetch dynamically imported module')), true)
assert.equal(isChunkLoadFailure(new Error('Something else failed')), false)

const staleStylesheet = { tagName: 'LINK', rel: 'stylesheet', href: '/assets/index-oldhash.css' }
assert.equal(isStaleAssetElement(staleStylesheet), true)

const preloadScript = { tagName: 'LINK', rel: 'modulepreload', href: '/assets/index-oldhash.js' }
assert.equal(isStaleAssetElement(preloadScript), true)

const normalStylesheet = { tagName: 'LINK', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter' }
assert.equal(isStaleAssetElement(normalStylesheet), false)

const staleScript = { tagName: 'SCRIPT', src: '/assets/chunk-oldhash.js' }
assert.equal(isStaleAssetElement(staleScript), true)

console.log('[PASS] stale asset recovery guardrails passed.')
