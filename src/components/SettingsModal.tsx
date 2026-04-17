import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  readLaunchPadCueEnabled,
  readLaunchPadDefaultKeyMode,
  writeLaunchPadCueEnabled,
  writeLaunchPadDefaultKeyMode,
  type LaunchPadKeyModePref,
} from '../lib/launchPadSettings.ts'
import {
  readPlanciaSnapEnabled,
  writePlanciaSnapEnabled,
} from '../lib/planciaSnapSettings.ts'
import {
  SCREEN2_RESOLUTION_OPTIONS,
  resolutionMatchesOption,
} from '../lib/screen2Resolutions.ts'
import { DEFAULT_STILL_IMAGE_DURATION_SEC } from '../lib/workspaceShell.ts'
import { useRegia } from '../state/RegiaContext.tsx'

type OutputResolution = { width: number; height: number }

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { stillImageDurationSec, setStillImageDurationSec } = useRegia()
  const [resolution, setResolution] = useState<OutputResolution>({
    width: 1280,
    height: 720,
  })
  const [busy, setBusy] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [launchPadDefaultKeyMode, setLaunchPadDefaultKeyMode] =
    useState<LaunchPadKeyModePref>('toggle')
  const [launchPadCueEnabled, setLaunchPadCueEnabled] = useState(true)
  const [stillDraft, setStillDraft] = useState(
    String(DEFAULT_STILL_IMAGE_DURATION_SEC),
  )

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

  useEffect(() => {
    if (!open) return
    setSnapEnabled(readPlanciaSnapEnabled())
    setLaunchPadDefaultKeyMode(readLaunchPadDefaultKeyMode())
    setLaunchPadCueEnabled(readLaunchPadCueEnabled())
  }, [open])

  useEffect(() => {
    if (!open) return
    setStillDraft(String(stillImageDurationSec))
  }, [open, stillImageDurationSec])

  const onStillSave = useCallback(() => {
    const n = Number.parseInt(stillDraft.trim(), 10)
    if (!Number.isFinite(n)) return
    setStillImageDurationSec(n)
  }, [stillDraft, setStillImageDurationSec])

  const onSnapChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.checked
    writePlanciaSnapEnabled(v)
    setSnapEnabled(v)
  }, [])

  const onLaunchPadDefaultKeyModeChange = useCallback(
    (mode: LaunchPadKeyModePref) => {
      writeLaunchPadDefaultKeyMode(mode)
      setLaunchPadDefaultKeyMode(mode)
    },
    [],
  )

  const onLaunchPadCueChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.checked
    writeLaunchPadCueEnabled(v)
    setLaunchPadCueEnabled(v)
  }, [])

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
          <p className="settings-modal-intro">
            Uscita video, playlist, finestre e Launchpad.
          </p>

          <section
            className="settings-modal-section"
            aria-labelledby="settings-screen2-label"
          >
            <h3 id="settings-screen2-label" className="settings-modal-section-title">
              Schermo 2 — Uscita
            </h3>
            <p className="settings-modal-hint">
              Risoluzione della finestra sul secondo monitor.
            </p>
            <ul
              className="settings-resolution-list"
              role="radiogroup"
              aria-label="Risoluzione uscita"
            >
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

          <section
            className="settings-modal-section"
            aria-labelledby="settings-still-image-label"
          >
            <h3
              id="settings-still-image-label"
              className="settings-modal-section-title"
            >
              Slide in playlist (JPEG / PNG)
            </h3>
            <p className="settings-modal-hint">
              Secondi in anteprima e in uscita prima del brano successivo (come a fine
              video). Valore salvato nel workspace.
            </p>
            <p className="settings-modal-value-line" aria-live="polite">
              Attivo: <strong>{stillImageDurationSec} s</strong>
              <span className="settings-modal-value-sep">·</span>
              Predefinito: {DEFAULT_STILL_IMAGE_DURATION_SEC} s
            </p>
            <div className="settings-modal-numeric-row">
              <label htmlFor="settings-still-seconds">Modifica (s)</label>
              <input
                id="settings-still-seconds"
                type="number"
                min={1}
                max={600}
                step={1}
                value={stillDraft}
                onChange={(e) => setStillDraft(e.target.value)}
                aria-label="Nuova durata in secondi"
              />
              <button
                type="button"
                className="settings-modal-save-still-btn"
                onClick={onStillSave}
              >
                Salva
              </button>
            </div>
          </section>

          <section
            className="settings-modal-section"
            aria-labelledby="settings-plancia-snap-label"
          >
            <h3
              id="settings-plancia-snap-label"
              className="settings-modal-section-title"
            >
              Finestre flottanti
            </h3>
            <p className="settings-modal-hint">
              SNAP: allinea trascinamento e ridimensionamento (playlist, Launchpad,
              anteprima) a pannelli e bordi area principale.
            </p>
            <label className="settings-modal-checkbox-row">
              <input
                type="checkbox"
                checked={snapEnabled}
                onChange={onSnapChange}
              />
              <span>SNAP attivo</span>
            </label>
          </section>

          <section
            className="settings-modal-section"
            aria-labelledby="settings-launchpad-label"
          >
            <h3
              id="settings-launchpad-label"
              className="settings-modal-section-title"
            >
              Launchpad
            </h3>
            <p className="settings-modal-hint">
              Default per pad nuovi (tastiera). I pad già configurati non cambiano.
            </p>
            <fieldset className="settings-modal-fieldset">
              <legend className="settings-modal-fieldset-legend">
                Tasto predefinito
              </legend>
              <label className="settings-modal-checkbox-row">
                <input
                  type="radio"
                  name="launchpad-default-key-mode"
                  checked={launchPadDefaultKeyMode === 'toggle'}
                  onChange={() => onLaunchPadDefaultKeyModeChange('toggle')}
                />
                <span>Toggle — play / stop sullo stesso slot</span>
              </label>
              <label className="settings-modal-checkbox-row">
                <input
                  type="radio"
                  name="launchpad-default-key-mode"
                  checked={launchPadDefaultKeyMode === 'play'}
                  onChange={() => onLaunchPadDefaultKeyModeChange('play')}
                />
                <span>Play — ogni pressione corta, brano intero</span>
              </label>
            </fieldset>
            <label className="settings-modal-checkbox-row settings-modal-checkbox-row--spaced">
              <input
                type="checkbox"
                checked={launchPadCueEnabled}
                onChange={onLaunchPadCueChange}
              />
              <span>CUE — tieni premuto per ascolto fino al rilascio</span>
            </label>
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export { IconSettingsGear }
