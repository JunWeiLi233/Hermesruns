import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const CHUNK_RELOAD_KEY = 'hermes:chunk-reload-attempted'

function reloadForStaleChunk() {
  if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return
  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  const url = new URL(window.location.href)
  url.searchParams.set('_v', String(Date.now()))
  window.location.replace(url.toString())
}

function isChunkLoadFailure(reason) {
  const message = typeof reason === 'string'
    ? reason
    : reason && typeof reason.message === 'string'
      ? reason.message
      : ''
  return message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('error loading dynamically imported module')
}

window.addEventListener('load', () => {
  window.sessionStorage.removeItem(CHUNK_RELOAD_KEY)
})

window.addEventListener('error', (event) => {
  if (isChunkLoadFailure(event?.error || event?.message)) {
    reloadForStaleChunk()
  }
})

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadFailure(event?.reason)) {
    reloadForStaleChunk()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
