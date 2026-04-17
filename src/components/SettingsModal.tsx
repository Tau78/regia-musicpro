import {
  useCallback,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  SCREEN2_RESOLUTION_OPTIONS,
  resolutionMatchesOption,
} from '../lib/screen2Resolutions.ts'

type OutputResolution = { width: number; height: number }

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [resolution, setResolution] = useState<OutputResolution>({
    width: 1280,
    height: 720,
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const r = await window.electronAPI.getOutputResolution()
        if (!cancelled && r) setResolution(r)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const onPickResolution = useCallback(
    async (width: number, height: number) => {
      if (busy) return
      setBusy(true)
      try {
        const { ok } = await window.electronAPI.setOutputResolution({
          width,
          height,
        })
        if (ok) setResolution({ width, height })
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )

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

  return (
    <div
      className="settings-modal-backdrop"
      role="presentation"
      onPointerDown={onBackdropPointerDown}
    >
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="settings-modal-head">
          <h2 id="settings-modal-title" className="settings-modal-title">
            Impostazioni
          </h2>
          <button
            type="button"
            className="btn-icon settings-modal-close"
            onClick={onClose}
            aria-label="Chiudi impostazioni"
            title="Chiudi"
          >
            ×
          </button>
        </div>
        <div className="settings-modal-body">
          <section className="settings-modal-section" aria-labelledby="settings-screen2-label">
            <h3 id="settings-screen2-label" className="settings-modal-section-title">
              Schermo 2 (uscita)
            </h3>
            <p className="settings-modal-hint">
              Dimensione della finestra di uscita sul secondo monitor (centrata quando
              Schermo 2 è attivo).
            </p>
            <ul className="settings-resolution-list" role="radiogroup" aria-label="Risoluzione schermo 2">
              {SCREEN2_RESOLUTION_OPTIONS.map((opt) => {
                const selected = resolutionMatchesOption(
                  resolution.width,
                  resolution.height,
                  opt,
                )
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={busy}
                      className={`settings-resolution-option ${selected ? 'is-selected' : ''}`}
                      onClick={() => void onPickResolution(opt.width, opt.height)}
                    >
                      <span className="settings-resolution-label">{opt.label}</span>
                      <span className="settings-resolution-dim">
                        {opt.width}×{opt.height}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function IconSettingsGear() {
  return (
    <svg
      className="regia-settings-icon"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

export { IconSettingsGear }
