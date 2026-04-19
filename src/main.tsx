import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { regiaProgramDocumentTitle } from './lib/regiaAppBranding.ts'
import {
  readRegiaSafeMode,
  REGIA_SAFE_MODE_CHANGED_EVENT,
} from './lib/regiaSafeModeSettings.ts'
import App from './App.tsx'

document.title = regiaProgramDocumentTitle()
import PlaylistFloaterEntry from './floater/PlaylistFloaterEntry.tsx'

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
      <PlaylistFloaterEntry sessionId={playlistFloaterSessionId} />
    </StrictMode>,
  )
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <SafeModeClassSync />
      <App />
    </StrictMode>,
  )
}
