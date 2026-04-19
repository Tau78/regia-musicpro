import PreviewBlock from './PreviewBlock.tsx'
import NextQueueRail from './NextQueueRail.tsx'

type Props = {
  /** Classi sulla colonna program (contenitore principale). */
  className?: string
  /** Classi passate a `PreviewBlock` (es. floating). */
  previewClassName?: string
  frameClassName?: string
}

export default function PreviewProgramNextLayout({
  className,
  previewClassName,
  frameClassName,
}: Props) {
  const programChip = (
    <span
      className="preview-bus-chip preview-bus-chip--program"
      title="Sequenza inviata al pubblico (finestra Output). Non è l’anteprima «prossimo» nel pannello a destra."
    >
      Uscita programma
    </span>
  )

  return (
    <div className={['preview-program-next-layout', className].filter(Boolean).join(' ')}>
      <div className="preview-program-next-layout-main">
        <div className="preview-program-next-layout-program">
          <PreviewBlock
            className={previewClassName}
            frameClassName={frameClassName}
            frameOverlay={programChip}
          />
        </div>
        <NextQueueRail />
      </div>
      <p className="preview-bus-safe-note">
        Il riquadro a destra è solo anteprima regia (prossimo / launch). La finestra Output mostra
        esclusivamente ciò che va al pubblico.
      </p>
    </div>
  )
}
