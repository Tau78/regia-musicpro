type Props = {
  playing: boolean
  onTogglePlay: () => void
  onStop: () => void
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  /** Slide fissa (jpg/png): etichetta a destra dei controlli. */
  isStillImage?: boolean
  className?: string
}

export default function TransportBar({
  playing,
  onTogglePlay,
  onStop,
  onPrev,
  onNext,
  canPrev,
  canNext,
  isStillImage = false,
  className,
}: Props) {
  const rootClass = ['transport-bar', className].filter(Boolean).join(' ')
  return (
    <div className={rootClass}>
      <div className="transport-buttons" role="group" aria-label="Trasporto">
        <button
          type="button"
          className="transport-step"
          disabled={!canPrev}
          onClick={onPrev}
          aria-label="Brano precedente"
          title="Brano precedente (PageUp, freccia sinistra o P)"
        >
          <span className="transport-step-icon" aria-hidden>
            ⏮
          </span>
        </button>
        <button
          type="button"
          className="transport-play"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pausa' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          className="transport-stop"
          onClick={onStop}
          aria-label="Stop"
          title="Stop: pausa in uscita e ferma l’audio Launchpad"
        >
          <span className="transport-stop-icon" aria-hidden>
            ■
          </span>
        </button>
        <button
          type="button"
          className="transport-step"
          disabled={!canNext}
          onClick={onNext}
          aria-label="Brano successivo"
          title="Brano successivo (PageDown, freccia destra o N)"
        >
          <span className="transport-step-icon" aria-hidden>
            ⏭
          </span>
        </button>
      </div>
      {isStillImage ? (
        <div className="transport-time" aria-live="polite">
          <span className="transport-still">Immagine</span>
        </div>
      ) : null}
    </div>
  )
}
