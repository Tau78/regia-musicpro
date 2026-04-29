import { useCallback, useEffect, useState } from 'react'
import { useRegia } from '../state/RegiaContext.tsx'

/**
 * Selettore uscita audio per pre-ascolto CUE / PFL (cuffia), separato dal program.
 * Il routing effettivo verso questo sink sarà usato dalle funzioni di cue dedicate.
 */
export default function SettingsCueSinkSection() {
  const { cueSinkId, setCueSinkId } = useRegia()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const refreshDevices = useCallback(async () => {
    try {
      const md = navigator.mediaDevices
      if (!md?.enumerateDevices) {
        setDevices([])
        return
      }
      const all = await md.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'audiooutput'))
    } catch {
      setDevices([])
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshDevices()
    })
    const md = navigator.mediaDevices
    md?.addEventListener?.('devicechange', refreshDevices)
    return () => md?.removeEventListener?.('devicechange', refreshDevices)
  }, [refreshDevices])

  return (
    <div className="settings-panel-block" aria-labelledby="settings-cue-sink-label">
      <h4 id="settings-cue-sink-label" className="settings-subsection-title">
        Uscita CUE (pre-ascolto)
      </h4>
      <p className="settings-modal-hint">
        Dispositivo per cuffia / monitor da regia: pre-ascolto del prossimo brano o cue
        senza mandare il segnale sull’uscita program (Schermo 2). Scegli una scheda
        diversa da «Uscita» nella barra audio se usi due uscite fisiche.
      </p>
      <div className="settings-modal-cue-sink-row">
        <label className="settings-modal-cue-sink-label" htmlFor="settings-cue-sink">
          Dispositivo CUE
        </label>
        <div className="settings-modal-cue-sink-controls">
          <select
            id="settings-cue-sink"
            className="regia-output-sink-select settings-modal-cue-select"
            value={cueSinkId}
            onChange={(e) => setCueSinkId(e.target.value)}
            title="Uscita audio dedicata al pre-ascolto (PFL / CUE)"
          >
            <option value="">Predefinito di sistema</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label?.trim() || `Dispositivo (${d.deviceId.slice(0, 8)}…)`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-icon regia-output-sink-refresh"
            onClick={() => void refreshDevices()}
            title="Aggiorna elenco dispositivi"
            aria-label="Aggiorna elenco dispositivi di uscita CUE"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  )
}
