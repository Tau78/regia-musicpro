import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react'

/** Ultimi secondi di brano: avviso visivo in anteprima durante il play. */
const PREVIEW_END_WARN_SEC = 5

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  /** Cambia quando si carica un altro file (stessa ref, nuovo elemento). */
  videoSyncKey: number
  onSeekCommitted: (seconds: number) => void
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec % 60)
  const m = Math.floor(sec / 60)
  const h = Math.floor(m / 60)
  const mm = h > 0 ? m % 60 : m
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(mm)}:${pad(s)}` : `${mm}:${pad(s)}`
}

export default function PreviewSeekBar({
  videoRef,
  videoSyncKey,
  onSeekCommitted,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [displayTime, setDisplayTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const draggingRef = useRef(false)
  const displayTimeRef = useRef(0)
  const durationRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const outputSeekRafRef = useRef<number | null>(null)
  const pendingOutputSeekRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    durationRef.current = duration
  }, [duration])

  useLayoutEffect(() => {
    displayTimeRef.current = displayTime
  }, [displayTime])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const syncFromVideo = () => {
      const d = el.duration
      setDuration(Number.isFinite(d) && d > 0 ? d : 0)
    }
    const onTime = () => {
      if (!draggingRef.current) {
        const t = el.currentTime
        displayTimeRef.current = t
        setDisplayTime(t)
      }
    }
    const onDur = () => syncFromVideo()
    const onSeeked = () => {
      if (!draggingRef.current) {
        const t = el.currentTime
        displayTimeRef.current = t
        setDisplayTime(t)
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('durationchange', onDur)
    el.addEventListener('loadedmetadata', onDur)
    el.addEventListener('seeked', onSeeked)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    syncFromVideo()
    displayTimeRef.current = el.currentTime
    setDisplayTime(el.currentTime)
    setIsPlaying(!el.paused)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('durationchange', onDur)
      el.removeEventListener('loadedmetadata', onDur)
      el.removeEventListener('seeked', onSeeked)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [videoRef, videoSyncKey])

  useEffect(
    () => () => {
      if (outputSeekRafRef.current != null) {
        cancelAnimationFrame(outputSeekRafRef.current)
        outputSeekRafRef.current = null
      }
      pendingOutputSeekRef.current = null
    },
    [],
  )

  const scheduleOutputSeek = useCallback((t: number) => {
    pendingOutputSeekRef.current = t
    if (outputSeekRafRef.current != null) return
    outputSeekRafRef.current = requestAnimationFrame(() => {
      outputSeekRafRef.current = null
      const latest = pendingOutputSeekRef.current
      if (latest == null) return
      pendingOutputSeekRef.current = null
      onSeekCommitted(latest)
    })
  }, [onSeekCommitted])

  const setTimeFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const d = durationRef.current
      if (!(d > 0)) return
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const t = ratio * d
      displayTimeRef.current = t
      setDisplayTime(t)
      const el = videoRef.current
      if (el) {
        try {
          el.currentTime = t
        } catch {
          /* ignore */
        }
      }
      scheduleOutputSeek(t)
    },
    [scheduleOutputSeek, videoRef],
  )

  const commitSeek = useCallback(() => {
    const el = videoRef.current
    const d = durationRef.current
    if (!el || !(d > 0)) return
    const t = Math.max(0, Math.min(displayTimeRef.current, d))
    if (outputSeekRafRef.current != null) {
      cancelAnimationFrame(outputSeekRafRef.current)
      outputSeekRafRef.current = null
    }
    pendingOutputSeekRef.current = null
    el.currentTime = t
    onSeekCommitted(t)
  }, [onSeekCommitted, videoRef])

  const onTrackPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      if (!(durationRef.current > 0)) return
      const track = trackRef.current
      if (!track) return
      draggingRef.current = true
      pointerIdRef.current = e.pointerId
      setTimeFromClientX(e.clientX)
      try {
        track.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [setTimeFromClientX],
  )

  const onTrackPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return
      setTimeFromClientX(e.clientX)
    },
    [setTimeFromClientX],
  )

  const endDrag = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return
      const track = trackRef.current
      draggingRef.current = false
      pointerIdRef.current = null
      try {
        track?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      commitSeek()
    },
    [commitSeek],
  )

  const seekable = duration > 0 && Number.isFinite(duration)
  const pct = seekable ? Math.min(100, (displayTime / duration) * 100) : 0
  const inEndWarningZone =
    isPlaying &&
    seekable &&
    displayTime >= duration - PREVIEW_END_WARN_SEC - 1e-3 &&
    displayTime <= duration + 0.15
  const tailLeftPct = seekable
    ? Math.max(0, ((duration - PREVIEW_END_WARN_SEC) / duration) * 100)
    : 0
  const tailWidthPct = seekable
    ? Math.min(100, (PREVIEW_END_WARN_SEC / duration) * 100)
    : 0

  return (
    <div
      className={[
        'preview-seek',
        seekable ? '' : 'is-disabled',
        inEndWarningZone ? 'preview-seek--end-warn' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Posizione nel brano (anteprima)"
    >
      <span className="preview-seek-time preview-seek-time--left">
        {formatTime(displayTime)}
      </span>
      <div
        ref={trackRef}
        className="preview-seek-track-wrap"
        role={seekable ? 'slider' : undefined}
        tabIndex={seekable ? 0 : undefined}
        aria-valuemin={seekable ? 0 : undefined}
        aria-valuemax={seekable ? Math.max(0, Math.floor(duration)) : undefined}
        aria-valuenow={seekable ? Math.floor(displayTime) : undefined}
        aria-valuetext={
          seekable
            ? `${formatTime(displayTime)} / ${formatTime(duration)}`
            : undefined
        }
        aria-disabled={!seekable}
        onPointerDown={seekable ? onTrackPointerDown : undefined}
        onPointerMove={seekable ? onTrackPointerMove : undefined}
        onPointerUp={seekable ? endDrag : undefined}
        onPointerCancel={seekable ? endDrag : undefined}
      >
        <div className="preview-seek-track" role="presentation">
          {inEndWarningZone && seekable ? (
            <div
              className="preview-seek-tailwarn"
              style={{
                left: `${tailLeftPct}%`,
                width: `${tailWidthPct}%`,
              }}
              aria-hidden
            />
          ) : null}
          <div
            className="preview-seek-fill"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
          <div
            className={`preview-seek-thumb${inEndWarningZone ? ' preview-seek-thumb--end-warn' : ''}`}
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        </div>
      </div>
      <span className="preview-seek-time preview-seek-time--right">
        {formatTime(duration)}
      </span>
    </div>
  )
}
