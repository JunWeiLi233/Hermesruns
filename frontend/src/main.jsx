import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import {
  clearStaleAssetReloadGuard,
  isChunkLoadFailure,
  isStaleAssetElement,
  reloadForStaleAsset,
} from './utils/staleAssetRecovery.js'
import { installLocalConsoleErrorTracker } from './utils/localConsoleErrorTracker.js'

installLocalConsoleErrorTracker()

window.addEventListener('load', () => {
  clearStaleAssetReloadGuard()
})

window.addEventListener('error', (event) => {
  if (isChunkLoadFailure(event?.error || event?.message) || isStaleAssetElement(event?.target)) {
    reloadForStaleAsset()
  }
}, true)

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadFailure(event?.reason)) {
    reloadForStaleAsset()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
