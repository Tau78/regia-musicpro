/* eslint-disable react-refresh/only-export-components -- entry: mount + piccolo helper locale */
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { regiaProgramDocumentTitle } from './lib/regiaAppBranding.ts'
import {
  readRegiaSafeMode,
  REGIA_SAFE_MODE_CHANGED_EVENT,
} from './lib/regiaSafeModeSettings.ts'
import App from './App.tsx'
import PlaylistFloaterEntry from './floater/PlaylistFloaterEntry.tsx'
import RegiaAppErrorBoundary from './RegiaAppErrorBoundary.tsx'

document.title = regiaProgramDocumentTitle()

const playlistFloaterParams = new URLSearchParams(window.location.search)
const playlistFloaterSessionId =
  playlistFloaterParams.get('playlistOsFloater') === '1'
    ? playlistFloaterParams.get('session')
    : null

function SafeModeClassSync() {
  useEffect(() => {
    const sync = () => {
      document.documentElement.classList.toggle(
        'regia-safe-mode',
        readRegiaSafeMode(),
      )
    }
    sync()
    window.addEventListener(REGIA_SAFE_MODE_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(REGIA_SAFE_MODE_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return null
}

const rootEl = document.getElementById('root')!
if (playlistFloaterSessionId) {
  createRoot(rootEl).render(
    <StrictMode>
      <SafeModeClassSync />
      <RegiaAppErrorBoundary>
        <PlaylistFloaterEntry sessionId={playlistFloaterSessionId} />
      </RegiaAppErrorBoundary>
    </StrictMode>,
  )
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <SafeModeClassSync />
      <RegiaAppErrorBoundary>
        <App />
      </RegiaAppErrorBoundary>
    </StrictMode>,
  )
}
