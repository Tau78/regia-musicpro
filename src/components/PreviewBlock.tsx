import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import PreviewSeekBar from './PreviewSeekBar.tsx'
import { formatDurationMmSs } from '../lib/formatDurationMmSs.ts'
import {
  readPreviewAspectMode,
  readPreviewSafeAreaEnabled,
  readPreviewTimeOverlayEnabled,
  writePreviewAspectMode,
  writePreviewSafeAreaEnabled,
  writePreviewTimeOverlayEnabled,
  type PreviewAspectMode,
} from '../lib/previewDisplaySettings.ts'
import { isStillImagePath } from '../mediaPaths.ts'
import { useRegia } from '../state/RegiaContext.tsx'

type Props = {
  /** Classi extra sul wrapper colonna (es. dentro pannello flottante). */
  className?: string
  /** Classi sulla preview-frame (altezza minima diversa da docked). */
  frameClassName?: string
}

export default function PreviewBlock({ className, frameClassName }: Props) {
  const previewRef = useRef<HTMLVideoElement>(null)
  const lastVideoTimeRef = useRef(0)
  const lastVideoTickRef = useRef(0)
  const {
    previewSrc,
    previewSyncKey,
    videoPlaying,
    outputTrackLoopMode,
    reportPreviewMediaTimes,
    stillImageDurationSec,
    previewMediaTimesTick,
    previewMediaTimesRef,
  } = useRegia()

  const [safeArea, setSafeArea] = useState(readPreviewSafeAreaEnabled)
  const [aspectMode, setAspectMode] = useState<PreviewAspectMode>(
    readPreviewAspectMode,
  )
  const [timeOv, setTimeOv] = useState(readPreviewTimeOverlayEnabled)
  const [videoStalled, setVideoStalled] = useState(false)

  const stillPreview = previewSrc ? isStillImagePath(previewSrc) : false

  const handlePreviewSeekCommitted = useCallback((seconds: number) => {
    void window.electronAPI.sendPlayback({ type: 'seek', seconds })
  }, [])

  useEffect(() => {
    if (stillPreview) return
    const el = previewRef.current
    if (!el) return
    if (!previewSrc) {
      el.removeAttribute('src')
      return
    }
    el.src = previewSrc
    el.muted = true
    void el.load()
  }, [previewSrc, stillPreview])

  useEffect(() => {
    if (stillPreview) return
    const el = previewRef.current
    if (!el || !previewSrc) return
    el.muted = true
    if (videoPlaying) void el.play().catch(() => {})
    else el.pause()
  }, [videoPlaying, previewSrc, stillPreview])

  useEffect(() => {
    if (stillPreview) return
    const el = previewRef.current
    if (!el || !previewSrc) return
    el.loop = outputTrackLoopMode === 'one'
  }, [outputTrackLoopMode, previewSrc, previewSyncKey, stillPreview])

  useEffect(() => {
    if (stillPreview) return
    const el = previewRef.current
    if (!el || !previewSrc) return
    const push = () => {
      lastVideoTimeRef.current = el.currentTime
      lastVideoTickRef.current = performance.now()
      reportPreviewMediaTimes(el.currentTime, el.duration)
    }
    el.addEventListener('timeupdate', push)
    el.addEventListener('durationchange', push)
    el.addEventListener('loadedmetadata', push)
    el.addEventListener('seeked', push)
    push()
    return () => {
      el.removeEventListener('timeupdate', push)
      el.removeEventListener('durationchange', push)
      el.removeEventListener('loadedmetadata', push)
      el.removeEventListener('seeked', push)
    }
  }, [previewSrc, previewSyncKey, stillPreview, reportPreviewMediaTimes])

  useEffect(() => {
    if (!stillPreview || !previewSrc || !videoPlaying) return
    const dur = stillImageDurationSec
    const t0 = performance.now()
    reportPreviewMediaTimes(0, dur)
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - t0) / 1000
      reportPreviewMediaTimes(Math.min(elapsed, dur), dur)
    }, 100)
    return () => clearInterval(id)
  }, [
    stillPreview,
    previewSrc,
    previewSyncKey,
    videoPlaying,
    stillImageDurationSec,
    reportPreviewMediaTimes,
  ])

  useEffect(() => {
    setVideoStalled(false)
    if (stillPreview || !previewSrc || !videoPlaying) return
    const el = previewRef.current
    if (!el) return
    const onWait = () => setVideoStalled(true)
    const onPlay = () => setVideoStalled(false)
    const onSeeked = () => setVideoStalled(false)
    el.addEventListener('waiting', onWait)
    el.addEventListener('playing', onPlay)
    el.addEventListener('seeked', onSeeked)
    const id = window.setInterval(() => {
      if (!videoPlaying || el.paused || el.readyState < 2) return
      const d = el.duration
      if (!Number.isFinite(d) || d <= 0) return
      if (el.currentTime >= d - 0.05) return
      const now = performance.now()
      if (now - lastVideoTickRef.current > 2200) setVideoStalled(true)
    }, 900)
    return () => {
      el.removeEventListener('waiting', onWait)
      el.removeEventListener('playing', onPlay)
      el.removeEventListener('seeked', onSeeked)
      clearInterval(id)
    }
  }, [stillPreview, previewSrc, previewSyncKey, videoPlaying])

  const rootClass = ['preview-panel', className].filter(Boolean).join(' ')
  const frameClass = ['preview-frame', frameClassName].filter(Boolean).join(' ')

  const ratioStyle: CSSProperties =
    aspectMode === '16:9'
      ? { aspectRatio: '16 / 9', width: '100%', maxHeight: '100%', margin: '0 auto' }
      : aspectMode === '4:3'
        ? { aspectRatio: '4 / 3', width: '100%', maxHeight: '100%', margin: '0 auto' }
        : aspectMode === '9:16'
          ? {
              aspectRatio: '9 / 16',
              height: '100%',
              maxWidth: '100%',
              margin: '0 auto',
            }
          : { width: '100%', height: '100%' }

  const objectFitClass =
    aspectMode === 'cover'
      ? 'preview-video preview-video--cover'
      : 'preview-video'

  void previewMediaTimesTick
  const tCur = previewMediaTimesRef.current.currentTime
  const tDur = previewMediaTimesRef.current.duration
  const timeLabel =
    tDur > 0
      ? `${formatDurationMmSs(tCur)} / ${formatDurationMmSs(tDur)}`
      : previewSrc
        ? '— / —'
        : ''

  return (
    <div className={rootClass}>
      <div className="preview-display-toolbar" role="toolbar" aria-label="Opzioni anteprima">
        <label className="preview-display-toggle">
          <input
            type="checkbox"
            checked={safeArea}
            onChange={(e) => {
              const v = e.target.checked
              setSafeArea(v)
              writePreviewSafeAreaEnabled(v)
            }}
          />
          <span>Safe</span>
        </label>
        <label className="preview-display-toggle">
          <input
            type="checkbox"
            checked={timeOv}
            onChange={(e) => {
              const v = e.target.checked
              setTimeOv(v)
              writePreviewTimeOverlayEnabled(v)
            }}
          />
          <span>Tempo</span>
        </label>
        <label className="preview-display-select-wrap">
          <span className="preview-display-select-label">Aspect</span>
          <select
            className="preview-display-select"
            value={aspectMode}
            onChange={(e) => {
              const v = e.target.value as PreviewAspectMode
              setAspectMode(v)
              writePreviewAspectMode(v)
            }}
          >
            <option value="contain">Contenuto</option>
            <option value="cover">Riempi</option>
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
            <option value="9:16">9:16</option>
          </select>
        </label>
      </div>
      <div className={frameClass}>
        <div className="preview-aspect-wrap" style={ratioStyle}>
          {stillPreview ? (
            <img
              key={previewSyncKey}
              src={previewSrc ?? undefined}
              alt=""
              className={objectFitClass}
              draggable={false}
            />
          ) : (
            <video
              key={previewSyncKey}
              ref={previewRef}
              className={objectFitClass}
              playsInline
              controls={false}
              muted
              aria-label="Anteprima video (sempre muta; audio solo sull'uscita)"
            />
          )}
        </div>
        {safeArea && previewSrc ? (
          <div className="preview-safe-area-layer" aria-hidden>
            <div className="preview-safe-area-outer" />
            <div className="preview-safe-area-inner" />
          </div>
        ) : null}
        {timeOv && previewSrc ? (
          <div className="preview-timecode-badge" aria-live="polite">
            {timeLabel}
          </div>
        ) : null}
        {videoStalled && previewSrc && !stillPreview ? (
          <div className="preview-stall-badge" role="status">
            Segnale in pausa
          </div>
        ) : null}
        {!previewSrc ? (
          <div className="preview-placeholder preview-placeholder--idle">
            <strong>Nessun segnale in anteprima</strong>
            <span className="preview-placeholder-sub">
              Apri una cartella dalla playlist mobile o carica una playlist salvata:
              un clic su un brano per anteprima e uscita.
            </span>
          </div>
        ) : null}
      </div>
      {!stillPreview && previewSrc ? (
        <PreviewSeekBar
          videoRef={previewRef}
          videoSyncKey={previewSyncKey}
          onSeekCommitted={handlePreviewSeekCommitted}
        />
      ) : null}
    </div>
  )
}
