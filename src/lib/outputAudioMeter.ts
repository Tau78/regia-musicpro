/**
 * Livello VU uscita: il metering non deve usare `createMediaElementSource` sui `<video>`
 * di OutputApp, altrimenti Chromium ignora `setSinkId` sul media element e l’audio
 * può sparire (regressione). Usare `captureStream()` + `createMediaStreamSource`.
 */

/** RMS 0–1 da getByteTimeDomainData (centro 128). */
export function rmsFromByteTimeDomain(buf: Uint8Array): number {
  if (buf.length === 0) return 0
  let s = 0
  for (let i = 0; i < buf.length; i++) {
    const x = (buf[i] - 128) / 128
    s += x * x
  }
  return Math.sqrt(s / buf.length)
}

/** Livello 0–1 inviato alla regia (coerente con il fattore usato in OutputApp). */
export function outputMeterLevelFromPeak(
  peak: number,
  muted: boolean,
  volume: number,
  gain = 3.2,
): number {
  const g = muted ? 0 : volume
  return Math.min(1, peak * gain * g)
}
