import { useCallback, useEffect, type PointerEvent as ReactPointerEvent } from 'react'
import { formatRegiaProgramCreatedIt } from '../lib/regiaAppBranding.ts'

export default function AppAboutModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const onBackdropPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const created =
    __REGIA_APP_CREATED__ && __REGIA_APP_CREATED__.trim().length > 0
      ? formatRegiaProgramCreatedIt(__REGIA_APP_CREATED__)
      : null
  const author = __REGIA_APP_AUTHOR__?.trim() ?? ''
  const description = __REGIA_APP_DESCRIPTION__?.trim() ?? ''

  return (
    <div
      className="settings-modal-backdrop"
      role="presentation"
      onPointerDown={onBackdropPointerDown}
    >
      <div
        id="app-about-modal"
        className="settings-modal app-about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-about-modal-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="settings-modal-head">
          <h2 id="app-about-modal-title" className="settings-modal-title">
            Informazioni
          </h2>
          <button
            type="button"
            className="btn-icon settings-modal-close"
            onClick={onClose}
            aria-label="Chiudi informazioni"
            title="Chiudi"
          >
            ×
          </button>
        </div>
        <div className="settings-modal-body">
          <p className="settings-modal-intro app-about-modal-product">REGIA MUSICPRO</p>

          <section
            className="settings-modal-section"
            aria-labelledby="app-about-version-label"
          >
            <h3 id="app-about-version-label" className="settings-modal-section-title">
              Versione
            </h3>
            <p className="settings-modal-value-line" aria-live="polite">
              <strong>v{__REGIA_APP_VERSION__}</strong>
              {created ? (
                <>
                  <span className="settings-modal-value-sep">·</span>
                  programma del <strong>{created}</strong>
                </>
              ) : null}
            </p>
          </section>

          {(author || description) && (
            <section
              className="settings-modal-section"
              aria-labelledby="app-about-credits-label"
            >
              <h3 id="app-about-credits-label" className="settings-modal-section-title">
                Crediti
              </h3>
              {author ? (
                <p className="settings-modal-hint app-about-modal-credits-line">
                  <strong>Progetto</strong>: {author}
                </p>
              ) : null}
              {description ? (
                <p className="settings-modal-hint app-about-modal-description">{description}</p>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
