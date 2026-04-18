import { useCallback, useEffect, useState } from 'react'
import { useRegia } from '../state/RegiaContext.tsx'

function OutputSpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  )
}

type Props = {
  /** `toolbar`: una riga compatta (per barra trascinabile / header). */
  variant?: 'stack' | 'toolbar'
}

export default function AudioOutputBar({ variant = 'stack' }: Props) {
  const {
    outputVolume,
    setOutputVolume,
    outputSinkId,
    setOutputSinkId,
    muted,
    setMuted,
  } = useRegia()

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [outputLevel, setOutputLevel] = useState(0)

  useEffect(() => {
    const api = window.electronAPI
    const sub = api?.onOutputAudioLevel
    if (typeof sub !== 'function') return
    return sub((lv) => {
      const x = Math.min(1, Math.max(0, lv))
      setOutputLevel((prev) => Math.max(prev * 0.86, x))
    })
  }, [])

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
    void refreshDevices()
    const md = navigator.mediaDevices
    md?.addEventListener?.('devicechange', refreshDevices)
    return () => md?.removeEventListener?.('devicechange', refreshDevices)
  }, [refreshDevices])

  const pct = Math.round(outputVolume * 100)

  const peakBars = variant === 'toolbar' ? 10 : 14
  const lit = Math.round(outputLevel * peakBars)

  const idVol = variant === 'toolbar' ? 'regia-output-volume-tb' : 'regia-output-volume'
  const idSink = variant === 'toolbar' ? 'regia-output-sink-tb' : 'regia-output-sink'

  if (variant === 'toolbar') {
    return (
      <div
        className="regia-audio-out regia-audio-out--toolbar"
        aria-label="Audio in uscita (monitor 2)"
      >
        <div
          className="regia-audio-out-meter regia-audio-out-meter--toolbar"
          aria-hidden
          title="Livello stimato uscita video (Schermo 2)"
        >
          {Array.from({ length: peakBars }, (_, i) => (
            <span
              key={i}
              className={`regia-audio-out-meter-seg ${i < lit ? 'is-on' : ''}`}
            />
          ))}
        </div>
        <div className="regia-audio-out-toolbar-main">
          <label className="regia-audio-out-toolbar-lbl" htmlFor={idVol}>
            Vol
          </label>
          <input
            id={idVol}
            type="range"
            className="regia-volume-slider regia-audio-out-toolbar-slider"
            min={0}
            max={100}
            value={pct}
            onChange={(e) =>
              setOutputVolume(Number.parseInt(e.target.value, 10) / 100)
            }
            aria-valuetext={`${pct}%`}
          />
          <span className="regia-volume-pct regia-audio-out-toolbar-pct" aria-hidden>
            {pct}%
          </span>
          <label className="regia-audio-out-toolbar-lbl" htmlFor={idSink}>
            Uscita
          </label>
          <select
            id={idSink}
            className="regia-output-sink-select regia-audio-out-toolbar-select"
            value={outputSinkId}
            onChange={(e) => setOutputSinkId(e.target.value)}
            title="Dispositivo audio per i video sul secondo schermo"
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
            className={`btn-icon regia-output-mute-btn ${muted ? 'is-on' : ''}`}
            onClick={() => setMuted(!muted)}
            aria-pressed={muted}
            title="Silenzia l'uscita sul secondo schermo (l'anteprima resta sempre muta). Se la playlist in riproduzione ha «Mute uscita» attivo, l'audio resta spento finché non disattivi entrambi."
            aria-label={
              muted
                ? 'Audio in uscita silenziato: clic per riattivare'
                : 'Silenzia audio in uscita sul secondo schermo'
            }
          >
            <OutputSpeakerIcon muted={muted} />
          </button>
          <button
            type="button"
            className="btn-icon regia-output-sink-refresh"
            onClick={() => void refreshDevices()}
            title="Aggiorna elenco dispositivi"
            aria-label="Aggiorna elenco dispositivi di uscita"
          >
            ↻
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="regia-audio-out" aria-label="Audio in uscita (monitor 2)">
      <div className="regia-audio-out-meter" aria-hidden title="Livello stimato uscita video (Schermo 2)">
        {Array.from({ length: peakBars }, (_, i) => (
          <span
            key={i}
            className={`regia-audio-out-meter-seg ${i < lit ? 'is-on' : ''}`}
          />
        ))}
      </div>
      <div className="regia-audio-out-line">
        <label className="regia-audio-out-label" htmlFor={idVol}>
          Volume
        </label>
        <div className="regia-audio-out-volume">
          <input
            id={idVol}
            type="range"
            className="regia-volume-slider"
            min={0}
            max={100}
            value={pct}
            onChange={(e) =>
              setOutputVolume(Number.parseInt(e.target.value, 10) / 100)
            }
            aria-valuetext={`${pct}%`}
          />
          <span className="regia-volume-pct" aria-hidden>
            {pct}%
          </span>
        </div>
      </div>
      <div className="regia-audio-out-line">
        <label className="regia-audio-out-label" htmlFor={idSink}>
          Uscita
        </label>
        <div className="regia-audio-out-sink-row">
          <select
            id={idSink}
            className="regia-output-sink-select"
            value={outputSinkId}
            onChange={(e) => setOutputSinkId(e.target.value)}
            title="Dispositivo audio per i video sul secondo schermo"
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
            className={`btn-icon regia-output-mute-btn ${muted ? 'is-on' : ''}`}
            onClick={() => setMuted(!muted)}
            aria-pressed={muted}
            title="Silenzia l'uscita sul secondo schermo (l'anteprima resta sempre muta). Se la playlist in riproduzione ha «Mute uscita» attivo, l'audio resta spento finché non disattivi entrambi."
            aria-label={
              muted
                ? 'Audio in uscita silenziato: clic per riattivare'
                : 'Silenzia audio in uscita sul secondo schermo'
            }
          >
            <OutputSpeakerIcon muted={muted} />
          </button>
          <button
            type="button"
            className="btn-icon regia-output-sink-refresh"
            onClick={() => void refreshDevices()}
            title="Aggiorna elenco dispositivi"
            aria-label="Aggiorna elenco dispositivi di uscita"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  )
}
