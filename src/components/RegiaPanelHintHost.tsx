import {
  useCallback,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { usePanelTooltipHintsEnabled } from '../lib/panelTooltipHintsSettings.ts'

type Props = {
  /** Testo mostrato quando il puntatore non è su un elemento con `data-preview-hint`. */
  defaultHint: string
  children: ReactNode
  className?: string
  /** Contenuto principale (sopra la barra suggerimenti). */
  mainClassName?: string
  hintAriaLabel?: string
}

/**
 * Barra inferiore con suggerimenti come in anteprima: al passaggio del mouse su
 * elementi con attributo `data-preview-hint="..."` il testo si aggiorna.
 * Disattivabile da Impostazioni → Interfaccia.
 */
export default function RegiaPanelHintHost({
  defaultHint,
  children,
  className,
  mainClassName,
  hintAriaLabel = 'Suggerimenti',
}: Props) {
  const hintsEnabled = usePanelTooltipHintsEnabled()
  const [statusLine, setStatusLine] = useState(defaultHint)

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const el = (e.target as HTMLElement | null)?.closest(
        '[data-preview-hint]',
      )
      if (el instanceof HTMLElement) {
        const raw = el.dataset.previewHint?.trim()
        if (raw) {
          setStatusLine((prev) => (prev === raw ? prev : raw))
          return
        }
      }
      setStatusLine((prev) =>
        prev === defaultHint ? prev : defaultHint,
      )
    },
    [defaultHint],
  )

  const onPointerLeave = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null
      if (next && e.currentTarget.contains(next)) return
      setStatusLine((prev) => (prev === defaultHint ? prev : defaultHint))
    },
    [defaultHint],
  )

  const outerClass = ['regia-panel-hint-host', className]
    .filter(Boolean)
    .join(' ')
  const mainClass = ['regia-panel-hint-host-main', mainClassName]
    .filter(Boolean)
    .join(' ')

  if (!hintsEnabled) {
    return (
      <div className={outerClass}>
        <div className={mainClass}>{children}</div>
      </div>
    )
  }

  return (
    <div
      className={outerClass}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className={mainClass}>{children}</div>
      <div
        className="preview-hint-bar regia-panel-hint-bar"
        role="region"
        aria-label={hintAriaLabel}
      >
        <p
          className="preview-hint-bar-text"
          data-preview-hint="Barra suggerimenti: altezza fissa; testo su due righe max. Passa il mouse sulle aree del pannello per le descrizioni."
        >
          {statusLine}
        </p>
      </div>
    </div>
  )
}
