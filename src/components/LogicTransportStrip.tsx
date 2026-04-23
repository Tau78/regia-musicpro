import { isStillImagePath } from '../mediaPaths.ts'
import { launchPadKeyLabel } from '../lib/launchPadKeyboard.ts'
import { usePresenterKeyBindings } from '../lib/presenterKeySettings.ts'
import { useRegia } from '../state/RegiaContext.tsx'

function IconPrev() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M11 6v12L2 12 11 6z" />
      <path fill="currentColor" d="M20 6v12L11 12 20 6z" />
    </svg>
  )
}

function IconNext() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M13 6v12L22 12 13 6z" />
      <path fill="currentColor" d="M4 6v12L13 12 4 6z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
      />
    </svg>
  )
}

function IconStop() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M6 6h12v12H6V6z" />
    </svg>
  )
}

/** Trasporto in stile strip Logic Pro (grafite, play verde). */
export default function LogicTransportStrip() {
  const {
    playing,
    togglePlay,
    stopPlayback,
    goNext,
    goPrev,
    paths,
    currentIndex,
    outputTrackLoopMode,
    previewSrc,
  } = useRegia()

  const pk = usePresenterKeyBindings()
  const prevKeyHint = launchPadKeyLabel(pk.prevCode) || pk.prevCode
  const nextKeyHint = launchPadKeyLabel(pk.nextCode) || pk.nextCode
  const playKeyHint = launchPadKeyLabel(pk.playPauseCode) || pk.playPauseCode

  const stillPreview = previewSrc ? isStillImagePath(previewSrc) : false
  const canPrev =
    paths.length > 0 &&
    (currentIndex > 0 || outputTrackLoopMode === 'all')
  const canNext =
    paths.length > 0 &&
    (currentIndex < paths.length - 1 || outputTrackLoopMode === 'all')

  return (
    <div
      className="logic-transport"
      data-preview-hint="Trasporto: passa al brano precedente o successivo nella playlist attiva, play/pausa e stop (ferma anche i sample Launchpad in uscita)."
    >
      <div
        className="logic-transport-well"
        role="group"
        aria-label="Trasporto"
      >
        <button
          type="button"
          className="logic-tbtn logic-tbtn--step"
          disabled={!canPrev}
          onClick={() => void goPrev()}
          aria-label="Brano precedente"
          title={`Brano precedente (tasto: ${prevKeyHint})`}
          data-preview-hint={`Brano precedente nella playlist che comanda l’uscita video (tasto configurabile nel Wizard Presenter nel pannello playlist: ${prevKeyHint}).`}
        >
          <IconPrev />
        </button>
        <button
          type="button"
          className={`logic-tbtn logic-tbtn--play ${playing ? 'is-playing' : ''}`}
          onClick={() => void togglePlay()}
          aria-label={playing ? 'Pausa' : 'Play'}
          title={
            playing
              ? `Pausa (tasto: ${playKeyHint})`
              : `Play (tasto: ${playKeyHint})`
          }
          data-preview-hint={
            playing
              ? `Pausa: mette in pausa il programma in anteprima e in uscita (tasto ${playKeyHint}, Wizard Presenter nel pannello playlist).`
              : `Play: avvia o riprende il programma dalla posizione corrente (tasto ${playKeyHint}, Wizard Presenter nel pannello playlist).`
          }
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          className="logic-tbtn logic-tbtn--stop"
          onClick={() => void stopPlayback()}
          aria-label="Stop"
          title="Stop: pausa in uscita e ferma l’audio Launchpad"
          data-preview-hint="Stop: interrompe riproduzione e campioni Launchpad collegati all’uscita programma."
        >
          <IconStop />
        </button>
        <button
          type="button"
          className="logic-tbtn logic-tbtn--step"
          disabled={!canNext}
          onClick={() => void goNext()}
          aria-label="Brano successivo"
          title={`Brano successivo (tasto: ${nextKeyHint})`}
          data-preview-hint={`Brano successivo nella playlist attiva (tasto configurabile nel Wizard Presenter: ${nextKeyHint}).`}
        >
          <IconNext />
        </button>
      </div>
      {stillPreview ? (
        <span
          className="logic-transport-still"
          aria-live="polite"
          title="Slide fissa"
          data-preview-hint="Indicatore IMG: il brano in anteprima è un’immagine fissa (durata slide dalle impostazioni)."
        >
          IMG
        </span>
      ) : null}
    </div>
  )
}
