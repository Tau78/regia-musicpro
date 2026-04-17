type Props = {
  playing: boolean
  onTogglePlay: () => void
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  /** Slide fissa (jpg/png): etichetta a destra dei controlli. */
  isStillImage?: boolean
}

export default function TransportBar({
  playing,
  onTogglePlay,
  onPrev,
  onNext,
  canPrev,
  canNext,
  isStillImage = false,
}: Props) {
  return (
    <div className="transport-bar">
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
