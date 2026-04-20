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
import {
  normalizeOutputIdleCap,
  readOutputIdleCapFromLs,
  writeOutputIdleCapToLs,
  type OutputIdleCapMode,
  type OutputIdleCapPersist,
} from '../lib/outputIdleCapStorage.ts'
import {
  readOutputProgramLogoVisibleFromLs,
  writeOutputProgramLogoVisibleToLs,
} from '../lib/outputProgramLogoStorage.ts'
import {
  readRegiaSafeMode,
  writeRegiaSafeMode,
} from '../lib/regiaSafeModeSettings.ts'
import {
  readOnAirOnAtStartup,
  writeOnAirOnAtStartup,
} from '../lib/onAirStartupSettings.ts'
import { useRegia } from '../state/RegiaContext.tsx'
import SettingsCueSinkSection from './SettingsCueSinkSection.tsx'

type UpdateCheckSchedulePref =
  | 'on_startup'
  | 'daily'
  | 'hourly'
  | 'every_5_minutes'

const UPDATE_CHECK_OPTIONS: {
  value: UpdateCheckSchedulePref
  label: string
}[] = [
  { value: 'on_startup', label: 'Predefinito (solo all’avvio)' },
  { value: 'daily', label: 'Una volta al giorno' },
  { value: 'hourly', label: 'Ogni ora' },
  { value: 'every_5_minutes', label: 'Ogni 5 minuti' },
]

function basenamePath(p: string): string {
  const n = p.replace(/\\/g, '/').split('/').pop()
  return n && n.length > 0 ? n : p
}

type OutputResolution = { width: number; height: number }

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const {
    stillImageDurationSec,
    setStillImageDurationSec,
    exportBugReportSnapshot,
  } = useRegia()
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
  const [idleCapDraft, setIdleCapDraft] = useState<OutputIdleCapPersist>(() =>
    readOutputIdleCapFromLs(),
  )
  const [debugAccordionOpen, setDebugAccordionOpen] = useState(false)
  const [updateCheckSchedule, setUpdateCheckSchedule] =
    useState<UpdateCheckSchedulePref>('on_startup')
  const [buildInfo, setBuildInfo] = useState<{
    isPackaged: boolean
    version: string
    buildHash: string
    builtAt: string
  } | null>(null)
  const [updateCheckNowBusy, setUpdateCheckNowBusy] = useState(false)
  const [updateCheckNowFeedback, setUpdateCheckNowFeedback] = useState<{
    kind: 'ok' | 'err'
    text: string
  } | null>(null)
  const [safeModeEnabled, setSafeModeEnabled] = useState(false)
  const [onAirOnAtStartup, setOnAirOnAtStartup] = useState(false)
  const [outputProgramLogoVisible, setOutputProgramLogoVisible] =
    useState(true)

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
    setOnAirOnAtStartup(readOnAirOnAtStartup())
    setLaunchPadDefaultKeyMode(readLaunchPadDefaultKeyMode())
    setLaunchPadCueEnabled(readLaunchPadCueEnabled())
    void (async () => {
      try {
        const cap = await window.electronAPI?.getOutputIdleCap?.()
        if (cap) {
          const n = normalizeOutputIdleCap(cap)
          setIdleCapDraft(n)
          writeOutputIdleCapToLs(n)
          return
        }
      } catch {
        /* ignore */
      }
      setIdleCapDraft(readOutputIdleCapFromLs())
    })()
    void (async () => {
      try {
        const r = await window.electronAPI?.getOutputProgramLogoVisible?.()
        if (r && typeof r.visible === 'boolean') {
          setOutputProgramLogoVisible(r.visible)
          writeOutputProgramLogoVisibleToLs(r.visible)
          return
        }
      } catch {
        /* ignore */
      }
      setOutputProgramLogoVisible(readOutputProgramLogoVisibleFromLs())
    })()
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.electronAPI
      .getUpdateCheckSchedule()
      .then((s) => {
        if (!cancelled) setUpdateCheckSchedule(s)
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !debugAccordionOpen) return
    let cancelled = false
    void window.electronAPI
      .getBuildInfo()
      .then((b) => {
        if (!cancelled) setBuildInfo(b)
      })
      .catch(() => {
        if (!cancelled) setBuildInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, debugAccordionOpen])

  useEffect(() => {
    if (!open) return
    setSafeModeEnabled(readRegiaSafeMode())
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

  const onOnAirStartupChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.checked
    writeOnAirOnAtStartup(v)
    setOnAirOnAtStartup(v)
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

  const onUpdateCheckScheduleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value as UpdateCheckSchedulePref
      if (!UPDATE_CHECK_OPTIONS.some((o) => o.value === v)) return
      setUpdateCheckSchedule(v)
      void window.electronAPI
        .setUpdateCheckSchedule(v)
        .then((saved) => setUpdateCheckSchedule(saved))
        .catch(() => {
          /* ignore */
        })
    },
    [],
  )

  const onCheckUpdatesNow = useCallback(() => {
    setUpdateCheckNowBusy(true)
    setUpdateCheckNowFeedback(null)
    void window.electronAPI
      .checkForUpdatesNow()
      .then((r) => {
        if (r.ok) {
          setUpdateCheckNowFeedback({
            kind: 'ok',
            text:
              'Controllo avviato. Se c’è un aggiornamento, verrà scaricato in background.',
          })
        } else {
          setUpdateCheckNowFeedback({ kind: 'err', text: r.reason })
        }
      })
      .catch((e) => {
        setUpdateCheckNowFeedback({
          kind: 'err',
          text: e instanceof Error ? e.message : String(e),
        })
      })
      .finally(() => setUpdateCheckNowBusy(false))
  }, [])

  const onExportBugReportSnapshot = useCallback(() => {
    try {
      const snap = exportBugReportSnapshot()
      const json = JSON.stringify(snap, null, 2)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const name = `regia-bug-report-${stamp}.json`
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch {
      /* ignore */
    }
  }, [exportBugReportSnapshot])

  const onSafeModeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.checked
    writeRegiaSafeMode(v)
    document.documentElement.classList.toggle('regia-safe-mode', v)
    setSafeModeEnabled(v)
  }, [])

  const applyIdleCap = useCallback((nextRaw: Partial<OutputIdleCapPersist>) => {
    setIdleCapDraft((prev) => {
      const next = normalizeOutputIdleCap({ ...prev, ...nextRaw })
      writeOutputIdleCapToLs(next)
      void window.electronAPI?.setOutputIdleCap?.(next).catch(() => {})
      return next
    })
  }, [])

  const onIdleCapMode = useCallback((mode: OutputIdleCapMode) => {
    if (mode === 'black') {
      applyIdleCap({ mode: 'black', imagePath: null })
      return
    }
    if (mode === 'color') {
      applyIdleCap({ mode: 'color', imagePath: null })
      return
    }
    applyIdleCap({ mode: 'image' })
  }, [applyIdleCap])

  const onIdleCapPickImage = useCallback(async () => {
    const paths = await window.electronAPI?.selectMediaFiles?.({
      context: 'playlist',
    })
    if (!paths?.length) return
    const still = paths.find((p) => /\.(jpe?g|png)$/i.test(p))
    const p = still ?? paths[0]!
    applyIdleCap({ mode: 'image', imagePath: p })
  }, [applyIdleCap])

  const onIdleCapClearImage = useCallback(() => {
    applyIdleCap({ mode: 'black', imagePath: null })
  }, [applyIdleCap])

  const onOutputProgramLogoVisibleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.checked
      setOutputProgramLogoVisible(v)
      writeOutputProgramLogoVisibleToLs(v)
      void window.electronAPI?.setOutputProgramLogoVisible?.(v).catch(() => {})
    },
    [],
  )

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

  const [lan, setLan] = useState<{
    running: boolean
    port: number
    token: string | null
    lanUrl: string | null
    localUrl: string | null
    remotePath: string
    primaryLanIp: string | null
    firewallHint: string
  } | null>(null)
  const [lanQr, setLanQr] = useState<string | null>(null)
  const [lanBusy, setLanBusy] = useState(false)

  const refreshLan = useCallback(async () => {
    try {
      const s = await window.electronAPI.lanServerStatus()
      setLan(s)
    } catch {
      setLan(null)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      void refreshLan()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, refreshLan])

  useEffect(() => {
    if (!open) return
    const unsub = window.electronAPI.onLanServerIpChanged?.(() => {
      void refreshLan()
    })
    return () => {
      unsub?.()
    }
  }, [open, refreshLan])

  useEffect(() => {
    if (!lan?.running || !lan.token || !lan.lanUrl) {
      const t0 = window.setTimeout(() => setLanQr(null), 0)
      return () => window.clearTimeout(t0)
    }
    const full = `${lan.lanUrl}${lan.remotePath}?token=${encodeURIComponent(lan.token)}`
    let cancelled = false
    void import('qrcode')
      .then((QR) => QR.toDataURL(full, { width: 240, margin: 1 }))
      .then((url) => {
        if (!cancelled) setLanQr(url)
      })
      .catch(() => {
        if (!cancelled) setLanQr(null)
      })
    return () => {
      cancelled = true
    }
  }, [lan])

  const onLanStart = useCallback(async () => {
    setLanBusy(true)
    try {
      await window.electronAPI.lanServerStart({})
      await refreshLan()
    } finally {
      setLanBusy(false)
    }
  }, [refreshLan])

  const onLanStop = useCallback(async () => {
    setLanBusy(true)
    try {
      await window.electronAPI.lanServerStop()
      await refreshLan()
    } finally {
      setLanBusy(false)
    }
  }, [refreshLan])

  const copyLanLink = useCallback(async () => {
    if (!lan?.running || !lan.token || !lan.lanUrl) return
    const full = `${lan.lanUrl}${lan.remotePath}?token=${encodeURIComponent(lan.token)}`
    try {
      await navigator.clipboard.writeText(full)
    } catch {
      /* ignore */
    }
  }, [lan])

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
            Uscita pubblico, audio CUE, telecomando, playlist e comportamento
            dell’interfaccia — organizzati per area.
          </p>

          <div className="settings-panels">
            <section
              className="settings-panel"
              aria-labelledby="settings-panel-output-title"
            >
              <h3 id="settings-panel-output-title" className="settings-panel-title">
                Uscita programma
              </h3>

              <div className="settings-panel-block">
                <h4
                  id="settings-screen2-label"
                  className="settings-subsection-title"
                >
                  Schermo 2 — risoluzione
                </h4>
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
              </div>

              <div className="settings-panel-block">
                <h4
                  id="settings-output-logo-label"
                  className="settings-subsection-title"
                >
                  Logo su Schermo 2
                </h4>
                <p className="settings-modal-hint">
                  Il marchio in alto a sinistra sulla finestra di uscita programma (nessuna
                  anteprima «prossimo» in quella finestra).
                </p>
                <label className="settings-modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={outputProgramLogoVisible}
                    onChange={onOutputProgramLogoVisibleChange}
                    aria-labelledby="settings-output-logo-label"
                  />
                  <span>Mostra il logo</span>
                </label>
              </div>

              <div className="settings-panel-block">
                <h4
                  id="settings-idle-cap-label"
                  className="settings-subsection-title"
                >
                  Tappo senza segnale in onda
                </h4>
                <p className="settings-modal-hint">
                  Si sovrappone al programma quando il trasporto non è in play (pausa,
                  stop, fine brano o lista vuota). Nero = schermo pieno nero; colore o
                  immagine coprono anche l’ultimo fotogramma in pausa. La lavagna in
                  sovrimpressione resta sopra al tappo.
                </p>
                <fieldset className="settings-modal-fieldset">
                  <legend className="settings-modal-fieldset-legend">Sfondo</legend>
                  <label className="settings-modal-checkbox-row">
                    <input
                      type="radio"
                      name="output-idle-cap-mode"
                      checked={idleCapDraft.mode === 'black'}
                      onChange={() => onIdleCapMode('black')}
                    />
                    <span>Nero (predefinito)</span>
                  </label>
                  <label className="settings-modal-checkbox-row">
                    <input
                      type="radio"
                      name="output-idle-cap-mode"
                      checked={idleCapDraft.mode === 'color'}
                      onChange={() => onIdleCapMode('color')}
                    />
                    <span>Colore pieno</span>
                  </label>
                  {idleCapDraft.mode === 'color' ? (
                    <div className="settings-modal-numeric-row settings-modal-idle-color-row">
                      <label htmlFor="settings-idle-cap-color">Colore</label>
                      <input
                        id="settings-idle-cap-color"
                        type="color"
                        value={idleCapDraft.color}
                        onChange={(e) => applyIdleCap({ color: e.target.value })}
                        aria-label="Colore tappo uscita"
                      />
                    </div>
                  ) : null}
                  <label className="settings-modal-checkbox-row">
                    <input
                      type="radio"
                      name="output-idle-cap-mode"
                      checked={idleCapDraft.mode === 'image'}
                      onChange={() => onIdleCapMode('image')}
                    />
                    <span>Immagine (JPEG / PNG)</span>
                  </label>
                  {idleCapDraft.mode === 'image' ? (
                    <div className="settings-modal-idle-image-actions">
                      <button
                        type="button"
                        className="settings-modal-save-still-btn"
                        onClick={() => void onIdleCapPickImage()}
                      >
                        Scegli file…
                      </button>
                      {idleCapDraft.imagePath ? (
                        <>
                          <span
                            className="settings-modal-idle-image-name"
                            title={idleCapDraft.imagePath}
                          >
                            {basenamePath(idleCapDraft.imagePath)}
                          </span>
                          <button
                            type="button"
                            className="settings-modal-save-still-btn"
                            onClick={onIdleCapClearImage}
                          >
                            Rimuovi
                          </button>
                        </>
                      ) : (
                        <span className="settings-modal-hint">
                          Nessun file: scegli un’immagine o torna al nero.
                        </span>
                      )}
                    </div>
                  ) : null}
                </fieldset>
              </div>
            </section>

            <section
              className="settings-panel"
              aria-labelledby="settings-panel-audio-title"
            >
              <h3 id="settings-panel-audio-title" className="settings-panel-title">
                Audio
              </h3>
              <SettingsCueSinkSection />
            </section>

            <section
              className="settings-panel"
              aria-labelledby="settings-lan-remote-label"
            >
              <h3 id="settings-lan-remote-label" className="settings-panel-title">
                Telecomando (rete LAN)
              </h3>
              <p className="settings-modal-hint">
                Avvia il server sulla stessa Wi‑Fi del telefono. Il QR non va mostrato
                sulla finestra uscita pubblico.
              </p>
              {lan?.firewallHint ? (
                <p className="settings-modal-hint">{lan.firewallHint}</p>
              ) : null}
              <div className="settings-modal-numeric-row">
                <button
                  type="button"
                  className="settings-modal-save-still-btn"
                  disabled={lanBusy || Boolean(lan?.running)}
                  onClick={() => void onLanStart()}
                >
                  Avvia server
                </button>
                <button
                  type="button"
                  className="settings-modal-save-still-btn"
                  disabled={lanBusy || !lan?.running}
                  onClick={() => void onLanStop()}
                >
                  Ferma server
                </button>
                <button
                  type="button"
                  className="settings-modal-save-still-btn"
                  disabled={!lan?.running}
                  onClick={() => void copyLanLink()}
                >
                  Copia link
                </button>
              </div>
              {lan?.running ? (
                <>
                  <p className="settings-modal-value-line" aria-live="polite">
                    Porta: <strong>{lan.port}</strong>
                    {lan.primaryLanIp ? (
                      <>
                        <span className="settings-modal-value-sep">·</span>
                        IP: <strong>{lan.primaryLanIp}</strong>
                      </>
                    ) : null}
                  </p>
                  {lan.lanUrl && lan.token ? (
                    <p className="settings-modal-value-line">
                      URL:{' '}
                      <code className="settings-modal-code">
                        {lan.lanUrl}
                        {lan.remotePath}?token=…
                      </code>
                    </p>
                  ) : null}
                  {lan.localUrl ? (
                    <p className="settings-modal-hint">
                      Alternativa .local:{' '}
                      <code className="settings-modal-code">
                        {lan.localUrl}
                        {lan.remotePath}?token=…
                      </code>
                    </p>
                  ) : null}
                  {lanQr ? (
                    <div className="settings-modal-lan-qr">
                      <img src={lanQr} alt="QR telecomando" width={220} height={220} />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="settings-modal-hint">
                  Server spento: attivalo per generare il QR e il link.
                </p>
              )}
            </section>

            <section
              className="settings-panel"
              aria-labelledby="settings-panel-playlist-title"
            >
              <h3 id="settings-panel-playlist-title" className="settings-panel-title">
                Playlist
              </h3>
              <div className="settings-panel-block">
                <h4
                  id="settings-still-image-label"
                  className="settings-subsection-title"
                >
                  Slide (JPEG / PNG)
                </h4>
                <p className="settings-modal-hint">
                  Secondi in anteprima e in uscita prima del brano successivo (come a
                  fine video). Valore salvato nel workspace.
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
              </div>
            </section>

            <section
              className="settings-panel"
              aria-labelledby="settings-panel-ui-title"
            >
              <h3 id="settings-panel-ui-title" className="settings-panel-title">
                Interfaccia
              </h3>

              <div className="settings-panel-block">
                <h4
                  id="settings-plancia-snap-label"
                  className="settings-subsection-title"
                >
                  Finestre flottanti
                </h4>
                <p className="settings-modal-hint">
                  SNAP: allinea trascinamento e ridimensionamento (playlist, Launchpad,
                  anteprima) a pannelli e bordi area principale.
                </p>
                <label className="settings-modal-checkbox-row">
                  <input type="checkbox" checked={snapEnabled} onChange={onSnapChange} />
                  <span>SNAP attivo</span>
                </label>
              </div>

              <div className="settings-panel-block">
                <h4
                  id="settings-on-air-startup-label"
                  className="settings-subsection-title"
                >
                  ON AIR all’avvio
                </h4>
                <p className="settings-modal-hint">
                  All’apertura dell’app la finestra di uscita sul secondo schermo parte
                  visibile (ON) o nascosta (OFF), indipendentemente dall’ultimo stato
                  salvato nel workspace.
                </p>
                <label className="settings-modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={onAirOnAtStartup}
                    onChange={onOnAirStartupChange}
                    aria-labelledby="settings-on-air-startup-label"
                  />
                  <span>ON AIR on all’avvio</span>
                </label>
              </div>

              <div className="settings-panel-block">
                <h4 id="settings-launchpad-label" className="settings-subsection-title">
                  Launchpad
                </h4>
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
              </div>
            </section>

            <section
              className="settings-panel settings-panel--debug"
              aria-labelledby="settings-panel-debug-title"
            >
              <div className="settings-debug-accordion-head">
                <label className="settings-modal-checkbox-row settings-debug-accordion-toggle">
                  <input
                    type="checkbox"
                    checked={debugAccordionOpen}
                    onChange={(e) => setDebugAccordionOpen(e.target.checked)}
                    aria-controls="settings-debug-accordion-panel"
                    aria-expanded={debugAccordionOpen}
                  />
                  <span id="settings-panel-debug-title" className="settings-debug-heading">
                    DEBUG
                  </span>
                </label>
              </div>
              <div
                id="settings-debug-accordion-panel"
                className="settings-debug-accordion-panel"
                hidden={!debugAccordionOpen}
              >
                <div className="settings-panel-block">
                  <h4
                    id="settings-debug-build-label"
                    className="settings-subsection-title"
                  >
                    Build
                  </h4>
                  <p className="settings-modal-hint">
                    Dati dal processo principale (Electron) e dalla UI (Vite). Il
                    commit Git è disponibile dopo <code>npm run build:electron</code>{' '}
                    o build completa.
                  </p>
                  <dl
                    className="settings-debug-build-table"
                    aria-labelledby="settings-debug-build-label"
                  >
                    <dt>App pacchettizzata</dt>
                    <dd>
                      {buildInfo
                        ? buildInfo.isPackaged
                          ? 'Sì'
                          : 'No (sviluppo / non pacchettizzata)'
                        : '…'}
                    </dd>
                    <dt>Versione (package)</dt>
                    <dd>{buildInfo?.version ?? '…'}</dd>
                    <dt>Commit Git (main process)</dt>
                    <dd>{buildInfo?.buildHash || '—'}</dd>
                    <dt>Build main (data)</dt>
                    <dd>{buildInfo?.builtAt || '—'}</dd>
                    <dt>Commit Git (UI / Vite)</dt>
                    <dd>{__REGIA_BUILD_HASH__ || '—'}</dd>
                  </dl>
                </div>

                <div className="settings-panel-block">
                  <h4
                    id="settings-update-check-label"
                    className="settings-subsection-title"
                  >
                    Controllo aggiornamenti
                  </h4>
                  <p className="settings-modal-hint">
                    All’avvio del programma viene sempre verificata la presenza di
                    aggiornamenti. Scegli se ripetere il controllo mentre l’app resta
                    aperta (solo versione installata, non in sviluppo).
                  </p>
                  <div className="settings-debug-actions-row">
                    <button
                      type="button"
                      className="settings-modal-save-still-btn"
                      disabled={updateCheckNowBusy}
                      onClick={() => void onCheckUpdatesNow()}
                    >
                      Controlla aggiornamenti ora
                    </button>
                  </div>
                  {updateCheckNowFeedback ? (
                    <p
                      className={`settings-debug-inline-msg ${updateCheckNowFeedback.kind === 'ok' ? 'is-ok' : 'is-err'}`}
                      role="status"
                    >
                      {updateCheckNowFeedback.text}
                    </p>
                  ) : null}
                  <div className="settings-modal-cue-sink-row">
                    <label
                      className="settings-modal-cue-sink-label"
                      htmlFor="settings-update-check-interval"
                    >
                      Frequenza
                    </label>
                    <div className="settings-modal-cue-sink-controls">
                      <select
                        id="settings-update-check-interval"
                        className="regia-output-sink-select settings-modal-cue-select"
                        value={updateCheckSchedule}
                        onChange={onUpdateCheckScheduleChange}
                        aria-labelledby="settings-update-check-label"
                      >
                        {UPDATE_CHECK_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="settings-panel-block">
                  <h4
                    id="settings-debug-snapshot-label"
                    className="settings-subsection-title"
                  >
                    Segnalazione bug
                  </h4>
                  <p className="settings-modal-hint">
                    Esporta uno snapshot JSON di playlist, trasporto e routing (senza
                    dettaglio delle immagini posizionate sulla lavagna: solo conteggi).
                  </p>
                  <div className="settings-debug-actions-row">
                    <button
                      type="button"
                      className="settings-modal-save-still-btn"
                      onClick={onExportBugReportSnapshot}
                    >
                      Esporta snapshot JSON…
                    </button>
                  </div>
                </div>

                <div className="settings-panel-block">
                  <h4
                    id="settings-debug-safe-label"
                    className="settings-subsection-title"
                  >
                    Modalità sicura (UI)
                  </h4>
                  <p className="settings-modal-hint">
                    Riduce animazioni, transizioni e blur sui backdrop per isolare
                    problemi di interfaccia. Preferenza salvata in locale su questa
                    macchina.
                  </p>
                  <label className="settings-modal-checkbox-row">
                    <input
                      type="checkbox"
                      checked={safeModeEnabled}
                      onChange={onSafeModeChange}
                      aria-describedby="settings-debug-safe-label"
                    />
                    <span>Modalità sicura attiva</span>
                  </label>
                </div>
              </div>
            </section>
          </div>
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
