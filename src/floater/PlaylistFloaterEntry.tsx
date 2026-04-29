import { useCallback, useEffect, useMemo, useState } from 'react'
import FloatingPlaylist from '../components/FloatingPlaylist.tsx'
import { PlaylistFloaterMirrorContext } from '../state/RegiaContext.tsx'
import {
  buildPlaylistFloaterMirrorRegiaValue,
  type PlaylistFloaterSyncPayload,
} from './playlistFloaterSync.ts'

export default function PlaylistFloaterEntry({
  sessionId,
}: {
  sessionId: string
}) {
  const [sync, setSync] = useState<PlaylistFloaterSyncPayload | null>(null)
  const send = useCallback((method: string, args: unknown[]) => {
    window.electronAPI.playlistFloaterSendAction(method, args)
  }, [])

  const mirrorValue = useMemo(() => {
    if (!sync) return null
    return buildPlaylistFloaterMirrorRegiaValue(sync, sessionId, send)
  }, [sync, sessionId, send])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onPlaylistFloaterState) return
    const off = api.onPlaylistFloaterState((payload) => {
      const p = payload as PlaylistFloaterSyncPayload
      setSync(p)
    })
    /** Evita “Caricamento…” infinito: i broadcast dalla regia possono essere partiti prima che questo listener esistesse (StrictMode / load). */
    void api.playlistFloaterRequestState?.()
    return off
  }, [])

  if (!mirrorValue) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#13151a',
          color: '#a1a7b3',
          fontSize: 14,
        }}
      >
        Caricamento playlist…
      </div>
    )
  }

  return (
    <PlaylistFloaterMirrorContext.Provider value={mirrorValue}>
      <FloatingPlaylist sessionId={sessionId} />
    </PlaylistFloaterMirrorContext.Provider>
  )
}
