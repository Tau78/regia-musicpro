import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactPortal,
} from 'react'
import { createPortal } from 'react-dom'
import {
  canAssignLaunchPadKeyCode,
  launchPadKeyLabel,
} from '../lib/launchPadKeyboard.ts'
import {
  type PresenterLearnRole,
  PRESENTER_KEYS_CHANGED_EVENT,
  readPresenterKeyBindings,
  resetPresenterKeysToDefaults,
  writePresenterKey,
} from '../lib/presenterKeySettings.ts'

type Props = {
  open: boolean
  onClose: () => void
  /** z-index sopra il pannello playlist */
  zIndex: number
}

function roleLabel(role: PresenterLearnRole): string {
  switch (role) {
    case 'prev':
      return 'Su (brano precedente)'
    case 'next':
      return 'Giù (brano successivo)'
    default:
      return 'Play / Pausa'
  }
}

export function PresenterKeyWizardDialog({
  open,
  onClose,
  zIndex,
}: Props): ReactPortal | null {
  const titleId = useId()
  const descId = useId()
  const [learnRole, setLearnRole] = useState<PresenterLearnRole | null>(null)
  const [bindings, setBindings] = useState(readPresenterKeyBindings)

  const refreshBindings = useCallback(() => {
    setBindings(readPresenterKeyBindings())
  }, [])

  useEffect(() => {
    if (!open) {
      setLearnRole(null)
      return
    }
    refreshBindings()
    const onChanged = () => refreshBindings()
    window.addEventListener(PRESENTER_KEYS_CHANGED_EVENT, onChanged)
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener(PRESENTER_KEYS_CHANGED_EVENT, onChanged)
      window.removeEventListener('storage', onChanged)
    }
  }, [open, refreshBindings])

  useEffect(() => {
    if (!open || learnRole !== null) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [open, learnRole, onClose])

  useEffect(() => {
    if (!open || learnRole === null) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        setLearnRole(null)
        return
      }
      if (e.repeat) return
      if (!canAssignLaunchPadKeyCode(e.code)) return

      const cur = readPresenterKeyBindings()
      const takenByOther =
        (learnRole !== 'prev' && cur.prevCode === e.code) ||
        (learnRole !== 'next' && cur.nextCode === e.code) ||
        (learnRole !== 'playPause' && cur.playPauseCode === e.code)
      if (takenByOther) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      e.stopPropagation()
      writePresenterKey(learnRole, e.code)
      setLearnRole(null)
      refreshBindings()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, learnRole, refreshBindings])

  const onReset = useCallback(() => {
    resetPresenterKeysToDefaults()
    refreshBindings()
  }, [refreshBindings])

  if (!open) return null

  return createPortal(
    <div
      className="presenter-wizard-overlay"
      style={{ zIndex: zIndex + 50 }}
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div
        className="presenter-wizard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <h2 id={titleId} className="presenter-wizard-title">
          Wizard Presenter
        </h2>
        <p id={descId} className="presenter-wizard-desc">
          Imposta i tasti del telecomando (o tastiera) per la plancia: premi
          «Learn» su una riga, poi il tasto da usare. Esc annulla
          l&apos;apprendimento. Le scorciatoie valgono per tutta l&apos;app.
        </p>

        {learnRole !== null ? (
          <div className="presenter-wizard-learn-banner" role="status">
            {roleLabel(learnRole)}: premi un tasto (Esc annulla)
          </div>
        ) : null}

        <table className="presenter-wizard-table">
          <tbody>
            {(
              [
                ['prev', bindings.prevCode] as const,
                ['next', bindings.nextCode] as const,
                ['playPause', bindings.playPauseCode] as const,
              ] as const
            ).map(([role, code]) => (
              <tr key={role}>
                <th scope="row">{roleLabel(role)}</th>
                <td>
                  <kbd className="presenter-wizard-kbd">
                    {launchPadKeyLabel(code) || code}
                  </kbd>
                  <span className="presenter-wizard-code">{code}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="presenter-wizard-learn-btn"
                    onClick={() =>
                      setLearnRole((r) => (r === role ? null : role))
                    }
                  >
                    {learnRole === role ? 'Annulla learn' : 'Learn'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="presenter-wizard-footer">
          <button
            type="button"
            className="presenter-wizard-secondary"
            onClick={onReset}
          >
            Predefiniti (PageUp / PageDown / Spazio)
          </button>
          <button
            type="button"
            className="presenter-wizard-primary"
            onClick={onClose}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
