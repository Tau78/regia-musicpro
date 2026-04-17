import { useCallback, useEffect, useRef } from 'react'
import PreviewSeekBar from './PreviewSeekBar.tsx'
import TransportBar from './TransportBar.tsx'
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
  const {
    previewSrc,
    previewSyncKey,
    playing,
    videoPlaying,
    togglePlay,
    goNext,
    goPrev,
    paths,
    currentIndex,
    outputTrackLoopMode,
    reportPreviewMediaTimes,
    stillImageDurationSec,
  } = useRegia()

  const stillPreview = previewSrc ? isStillImagePath(previewSrc) : false

  const canTransportPrev =
    paths.length > 0 &&
    (currentIndex > 0 || outputTrackLoopMode === 'all')
  const canTransportNext =
    paths.length > 0 &&
    (currentIndex < paths.length - 1 || outputTrackLoopMode === 'all')

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

  const rootClass = ['preview-panel', className].filter(Boolean).join(' ')
  const frameClass = ['preview-frame', frameClassName].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <div className={frameClass}>
        {stillPreview ? (
          <img
            key={previewSyncKey}
            src={previewSrc ?? undefined}
            alt=""
            className="preview-video"
            draggable={false}
          />
        ) : (
          <video
            key={previewSyncKey}
            ref={previewRef}
            className="preview-video"
            playsInline
            controls={false}
            muted
            aria-label="Anteprima video (sempre muta; audio solo sull'uscita)"
          />
        )}
        {!previewSrc ? (
          <div className="preview-placeholder">
            Apri una cartella dalla playlist mobile o carica una playlist salvata:
            basta un clic su un brano per l'anteprima e l'uscita. Il doppio
            clic, se lo usi, serve eventualmente solo per partire.
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
      <TransportBar
        playing={playing}
        isStillImage={stillPreview}
        onTogglePlay={() => void togglePlay()}
        onPrev={() => void goPrev()}
        onNext={() => void goNext()}
        canPrev={canTransportPrev}
        canNext={canTransportNext}
      />
    </div>
  )
}
