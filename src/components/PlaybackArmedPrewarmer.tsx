import { useEffect, useMemo, useState } from 'react'
import { isStillImagePath } from '../mediaPaths.ts'
import { useRegia } from '../state/RegiaContext.tsx'

/**
 * Decode warm-up in background per il brano armato come «prossimo» (nessun audio / video visibile).
 */
export default function PlaybackArmedPrewarmer() {
  const { playbackArmedNext, floatingPlaylistSessions } = useRegia()

  const absPath = useMemo(() => {
    if (!playbackArmedNext) return null
    const s = floatingPlaylistSessions.find(
      (x) => x.id === playbackArmedNext.sessionId,
    )
    if (!s || s.playlistMode === 'launchpad') return null
    const p = s.paths[playbackArmedNext.index]
    return p ?? null
  }, [playbackArmedNext, floatingPlaylistSessions])

  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!absPath) {
      queueMicrotask(() => setUrl(null))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const u = await window.electronAPI.toFileUrl(absPath)
        if (!cancelled) setUrl(u)
      } catch {
        if (!cancelled) setUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [absPath])

  if (!url || !absPath) return null

  if (isStillImagePath(absPath)) {
    return (
      <img
        src={url}
        alt=""
        className="playback-armed-prewarm"
        decoding="async"
        loading="eager"
        draggable={false}
      />
    )
  }

  return (
    <video
      src={url}
      className="playback-armed-prewarm"
      muted
      playsInline
      preload="auto"
      aria-hidden
    />
  )
}
