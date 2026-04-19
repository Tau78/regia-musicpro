import type { PlaybackCommand } from '../playbackTypes.ts'

export const OUTPUT_IDLE_CAP_LS_KEY = 'regia-output-idle-cap'

export type OutputIdleCapMode = 'black' | 'color' | 'image'

export type OutputIdleCapPersist = {
  mode: OutputIdleCapMode
  /** Usato se `mode === 'color'` (es. `#1a2b3c`). */
  color: string
  /** Percorso assoluto immagine se `mode === 'image'`. */
  imagePath: string | null
}

export const DEFAULT_OUTPUT_IDLE_CAP: OutputIdleCapPersist = {
  mode: 'black',
  color: '#0a0a0a',
  imagePath: null,
}

function normalizeHexColor(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_OUTPUT_IDLE_CAP.color
  const t = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return DEFAULT_OUTPUT_IDLE_CAP.color
}

function normalizeImagePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length > 0 ? t : null
}

export function normalizeOutputIdleCap(raw: unknown): OutputIdleCapPersist {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_OUTPUT_IDLE_CAP }
  const o = raw as Record<string, unknown>
  const mode =
    o.mode === 'color' ? 'color' : o.mode === 'image' ? 'image' : 'black'
  const color = normalizeHexColor(o.color)
  const imagePath = normalizeImagePath(o.imagePath)
  if (mode === 'image') {
    return { mode: 'image', color, imagePath }
  }
  return { mode, color, imagePath: null }
}

export function readOutputIdleCapFromLs(): OutputIdleCapPersist {
  try {
    const s = localStorage.getItem(OUTPUT_IDLE_CAP_LS_KEY)
    if (!s) return { ...DEFAULT_OUTPUT_IDLE_CAP }
    return normalizeOutputIdleCap(JSON.parse(s) as unknown)
  } catch {
    return { ...DEFAULT_OUTPUT_IDLE_CAP }
  }
}

export function writeOutputIdleCapToLs(v: OutputIdleCapPersist): void {
  try {
    localStorage.setItem(OUTPUT_IDLE_CAP_LS_KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function outputIdleCapToPlaybackCommand(
  v: OutputIdleCapPersist,
): Extract<PlaybackCommand, { type: 'setOutputIdleCap' }> {
  return {
    type: 'setOutputIdleCap',
    mode: v.mode,
    color: v.color,
    imagePath: v.imagePath,
  }
}
