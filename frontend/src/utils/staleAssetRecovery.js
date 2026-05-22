const CHUNK_RELOAD_KEY = 'hermes:chunk-reload-attempted'

function isAssetPath(value) {
  if (typeof value !== 'string' || !value) return false
  try {
    return new URL(value, window.location.origin).pathname.startsWith('/assets/')
  } catch {
    return value.includes('/assets/')
  }
}

export function reloadForStaleAsset() {
  if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return
  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  const url = new URL(window.location.href)
  url.searchParams.set('_v', String(Date.now()))
  window.location.replace(url.toString())
}

export function clearStaleAssetReloadGuard() {
  window.sessionStorage.removeItem(CHUNK_RELOAD_KEY)
}

export function isChunkLoadFailure(reason) {
  const message = typeof reason === 'string'
    ? reason
    : reason && typeof reason.message === 'string'
      ? reason.message
      : ''
  return message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('error loading dynamically imported module')
}

export function isStaleAssetElement(target) {
  if (!target || typeof target !== 'object') return false
  const tagName = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : ''
  if (tagName === 'LINK') {
    const rel = typeof target.rel === 'string' ? target.rel.toLowerCase() : ''
    if (rel !== 'stylesheet' && rel !== 'modulepreload') return false
    return isAssetPath(target.href)
  }
  if (tagName === 'SCRIPT') {
    return isAssetPath(target.src)
  }
  return false
}
