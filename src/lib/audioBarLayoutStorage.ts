const LS_KEY = 'regia-audio-bar-layout-v1'

export type AudioBarLayoutPersist = {
  docked: boolean
  x: number
  y: number
}

const DEFAULT_FLOAT: AudioBarLayoutPersist = {
  docked: true,
  x: 24,
  y: 88,
}

export function readAudioBarLayout(): AudioBarLayoutPersist {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_FLOAT }
    const j = JSON.parse(raw) as Partial<AudioBarLayoutPersist>
    if (typeof j?.x === 'number' && typeof j?.y === 'number') {
      return {
        docked: j.docked !== false,
        x: j.x,
        y: j.y,
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_FLOAT }
}

export function persistAudioBarLayout(p: AudioBarLayoutPersist): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}
