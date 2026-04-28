import { useCallback, useEffect, useMemo, useState } from 'react'

type ControllerHidLearningStep =
  | 'jogRight'
  | 'jogLeft'
  | 'button1'
  | 'button2'
  | 'button3'
  | 'button4'

type ControllerHidDeviceInfo = Awaited<
  ReturnType<typeof window.electronAPI.controllerHidListDevices>
>[number]

type ControllerHidStatus = NonNullable<
  Awaited<ReturnType<typeof window.electronAPI.controllerHidStatus>>
>

const LEARNING_STEPS: Array<{
  id: ControllerHidLearningStep
  label: string
  prompt: string
}> = [
  { id: 'jogRight', label: 'Jog destra', prompt: 'Ruota il jog verso destra' },
  { id: 'jogLeft', label: 'Jog sinistra', prompt: 'Ruota il jog verso sinistra' },
  { id: 'button1', label: 'Pulsante 1', prompt: 'Premi il pulsante 1' },
  { id: 'button2', label: 'Pulsante 2', prompt: 'Premi il pulsante 2' },
  { id: 'button3', label: 'Pulsante 3', prompt: 'Premi il pulsante 3' },
  { id: 'button4', label: 'Pulsante 4', prompt: 'Premi il pulsante 4' },
]

function deviceLabel(device: ControllerHidDeviceInfo): string {
  const name = [device.manufacturer, device.product].filter(Boolean).join(' ')
  const vid =
    device.vendorId == null ? 'VID ?' : `VID ${device.vendorId.toString(16)}`
  const pid =
    device.productId == null ? 'PID ?' : `PID ${device.productId.toString(16)}`
  return `${name || 'Device HID senza nome'} (${vid} / ${pid})`
}

function formatEventTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function SettingsControllerHidSection() {
  const [devices, setDevices] = useState<ControllerHidDeviceInfo[]>([])
  const [status, setStatus] = useState<ControllerHidStatus | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  )

  const refreshStatus = useCallback(async () => {
    const next = await window.electronAPI.controllerHidStatus()
    setStatus(next)
    if (next?.selectedDeviceId) setSelectedDeviceId(next.selectedDeviceId)
  }, [])

  const refreshDevices = useCallback(async () => {
    const list = await window.electronAPI.controllerHidListDevices()
    setDevices(list)
    await refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshDevices()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshDevices])

  useEffect(() => {
    return window.electronAPI.onControllerHidEvent(() => {
      void refreshStatus()
    })
  }, [refreshStatus])

  const run = useCallback(
    async (fn: () => Promise<ControllerHidStatus | null>) => {
      setBusy(true)
      setFeedback(null)
      try {
        const next = await fn()
        setStatus(next)
        if (next?.selectedDeviceId) setSelectedDeviceId(next.selectedDeviceId)
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const onSelectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId)
      void run(() => window.electronAPI.controllerHidSelectDevice(deviceId || null))
    },
    [run],
  )

  const startLearning = useCallback(() => {
    void run(() =>
      window.electronAPI.controllerHidStartLearning(selectedDeviceId || null),
    )
  }, [run, selectedDeviceId])

  const captureStep = useCallback(
    (step: ControllerHidLearningStep) => {
      void run(() => window.electronAPI.controllerHidCaptureLearningStep(step))
    },
    [run],
  )

  const saveLearning = useCallback(() => {
    void run(() => window.electronAPI.controllerHidSaveLearningProfile())
  }, [run])

  const cancelLearning = useCallback(() => {
    void run(() => window.electronAPI.controllerHidCancelLearning())
  }, [run])

  const forgetProfile = useCallback(() => {
    const ok = window.confirm(
      'Rimuovere il controller appreso? Dovrai rifare il learning.',
    )
    if (!ok) return
    void run(() => window.electronAPI.controllerHidForgetProfile())
  }, [run])

  const learning = status?.learning
  const lastEvent = learning?.lastEvent ?? status?.recentEvents[0] ?? null
  const profileDevice = status?.profile?.device ?? null

  return (
    <div className="settings-panel-block settings-controller-hid">
      <h4 id="settings-controller-hid-label" className="settings-subsection-title">
        Controller Bluetooth / HID
      </h4>
      <p className="settings-modal-hint">
        Learning guidato per dedicare jog e 4 pulsanti a Regia Video. Regia salva
        il fingerprint del device HID scelto e ignora mouse o trackpad non appresi.
      </p>

      {status?.adapterError ? (
        <p className="settings-debug-inline-msg is-err" role="status">
          HID non disponibile: {status.adapterError}
        </p>
      ) : null}

      <div className="settings-modal-cue-sink-row">
        <label className="settings-modal-cue-sink-label" htmlFor="settings-hid-device">
          Device
        </label>
        <div className="settings-modal-cue-sink-controls">
          <select
            id="settings-hid-device"
            className="regia-output-sink-select settings-modal-cue-select"
            value={selectedDeviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
            aria-labelledby="settings-controller-hid-label"
          >
            <option value="">Seleziona un device HID…</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {deviceLabel(device)}
                {device.excludedHint ? ` — ${device.excludedHint}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="settings-modal-save-still-btn"
            disabled={busy}
            onClick={() => void refreshDevices()}
          >
            Aggiorna
          </button>
        </div>
      </div>

      {selectedDevice?.excludedHint ? (
        <p className="settings-debug-inline-msg is-err">
          Attenzione: questo device sembra un {selectedDevice.excludedHint.toLowerCase()}.
          Se e' il mouse o trackpad del computer, non usarlo per il learning.
        </p>
      ) : null}

      <p className="settings-modal-value-line" aria-live="polite">
        Profilo:{' '}
        <strong>{profileDevice ? deviceLabel(profileDevice) : 'nessun controller appreso'}</strong>
        <span className="settings-modal-value-sep">·</span>
        Connessione: <strong>{status?.connected ? 'attiva' : 'non attiva'}</strong>
      </p>

      <div className="settings-debug-actions-row">
        <button
          type="button"
          className="settings-modal-save-still-btn"
          disabled={busy || !selectedDeviceId}
          onClick={startLearning}
        >
          Avvia learning
        </button>
        <button
          type="button"
          className="settings-modal-save-still-btn"
          disabled={busy || !learning?.active}
          onClick={cancelLearning}
        >
          Annulla
        </button>
        <button
          type="button"
          className="settings-modal-save-still-btn"
          disabled={busy || !status?.profile}
          onClick={forgetProfile}
        >
          Rimuovi profilo
        </button>
      </div>

      {learning?.active ? (
        <div className="settings-controller-hid-learning">
          <p className="settings-modal-hint">
            Esegui ogni gesto sul controller selezionato, poi premi “Registra”.
            Tutti gli step devono arrivare dallo stesso endpoint HID.
          </p>
          <ol className="settings-controller-hid-steps">
            {LEARNING_STEPS.map((step) => {
              const captured = learning.captured[step.id]
              return (
                <li key={step.id} className={captured ? 'is-captured' : ''}>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.prompt}</span>
                    {captured ? <code>{captured}</code> : null}
                  </div>
                  <button
                    type="button"
                    className="settings-modal-save-still-btn"
                    disabled={busy || !learning.lastEvent}
                    onClick={() => captureStep(step.id)}
                  >
                    Registra
                  </button>
                </li>
              )
            })}
          </ol>
          <button
            type="button"
            className="settings-modal-save-still-btn"
            disabled={busy || !learning.readyToSave}
            onClick={saveLearning}
          >
            Salva controller appreso
          </button>
        </div>
      ) : null}

      {lastEvent ? (
        <p className="settings-modal-value-line">
          Ultimo report: <code className="settings-modal-code">{lastEvent.rawHex}</code>
          <span className="settings-modal-value-sep">·</span>
          {formatEventTime(lastEvent.ts)}
          {lastEvent.matchedStep ? (
            <>
              <span className="settings-modal-value-sep">·</span>
              Match: <strong>{lastEvent.matchedStep}</strong>
            </>
          ) : null}
        </p>
      ) : (
        <p className="settings-modal-hint">Nessun report HID ricevuto in questa sessione.</p>
      )}

      {feedback ? (
        <p className="settings-debug-inline-msg is-err" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  )
}
