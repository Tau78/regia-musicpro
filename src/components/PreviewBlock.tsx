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
    togglePlay,
    goNext,
    goPrev,
    paths,
    currentIndex,
    loopMode,
  } = useRegia()

  const stillPreview = previewSrc ? isStillImagePath(previewSrc) : false

  const canTransportPrev =
    paths.length > 0 && (currentIndex > 0 || loopMode === 'all')
  const canTransportNext =
    paths.length > 0 &&
    (currentIndex < paths.length - 1 || loopMode === 'all')

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
    if (playing) void el.play().catch(() => {})
    else el.pause()
  }, [playing, previewSrc, stillPreview])

  useEffect(() => {
    if (stillPreview) return
    const el = previewRef.current
    if (!el || !previewSrc) return
    el.loop = loopMode === 'one'
  }, [loopMode, previewSrc, previewSyncKey, stillPreview])

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
            Apri una cartella dalla playlist mobile, carica una playlist salvata,
            poi doppio click su un file per mandarlo in onda.
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
