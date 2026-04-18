import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { regiaProgramDocumentTitle } from './lib/regiaAppBranding.ts'
import App from './App.tsx'

document.title = regiaProgramDocumentTitle()
import PlaylistFloaterEntry from './floater/PlaylistFloaterEntry.tsx'

const playlistFloaterParams = new URLSearchParams(window.location.search)
const playlistFloaterSessionId =
  playlistFloaterParams.get('playlistOsFloater') === '1'
    ? playlistFloaterParams.get('session')
    : null

const rootEl = document.getElementById('root')!
if (playlistFloaterSessionId) {
  createRoot(rootEl).render(
    <StrictMode>
      <PlaylistFloaterEntry sessionId={playlistFloaterSessionId} />
    </StrictMode>,
  )
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
