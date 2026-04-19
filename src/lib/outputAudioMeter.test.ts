import { describe, expect, it } from 'vitest'
import {
  outputMeterLevelFromPeak,
  rmsFromByteTimeDomain,
} from './outputAudioMeter.ts'

describe('rmsFromByteTimeDomain', () => {
  it('restituisce 0 per buffer vuoto', () => {
    expect(rmsFromByteTimeDomain(new Uint8Array(0))).toBe(0)
  })

  it('restituisce ~0 per silenzio (centro 128)', () => {
    const u = new Uint8Array(512)
    u.fill(128)
    expect(rmsFromByteTimeDomain(u)).toBeLessThan(1e-6)
  })

  it('rileva onda non nulla', () => {
    const u = new Uint8Array(512)
    u.fill(128)
    for (let i = 0; i < u.length; i++) u[i] = 128 + (i % 40)
    expect(rmsFromByteTimeDomain(u)).toBeGreaterThan(0.05)
  })
})

describe('outputMeterLevelFromPeak', () => {
  it('è 0 se muted', () => {
    expect(outputMeterLevelFromPeak(0.5, true, 1)).toBe(0)
  })

  it('scala col volume', () => {
    const full = outputMeterLevelFromPeak(0.25, false, 1)
    const half = outputMeterLevelFromPeak(0.25, false, 0.5)
    expect(half).toBeCloseTo(full * 0.5, 5)
  })
})
