const LS_KEY = 'regia-audio-bar-layout-v1'

export const AUDIO_BAR_WIDTH_MIN = 280
export const AUDIO_BAR_WIDTH_MAX_CAP = 1600

/** Segmenti della barra logic che si possono nascondere cliccando il separatore a sinistra. */
export const LOGIC_BAR_COLLAPSIBLE_SEG_IDS = [
  'preview',
  'secondary',
  'clock',
  'audio',
] as const

export type LogicBarCollapsibleSegId = (typeof LOGIC_BAR_COLLAPSIBLE_SEG_IDS)[number]

const COLLAPSIBLE_SET = new Set<string>(LOGIC_BAR_COLLAPSIBLE_SEG_IDS)

function parseCollapsedLogicBarSegs(raw: unknown): LogicBarCollapsibleSegId[] {
  if (!Array.isArray(raw)) return []
  const out: LogicBarCollapsibleSegId[] = []
  for (const x of raw) {
    if (typeof x === 'string' && COLLAPSIBLE_SET.has(x)) {
      out.push(x as LogicBarCollapsibleSegId)
    }
  }
  return out
}

export type AudioBarLayoutPersist = {
  docked: boolean
  x: number
  y: number
  /** Larghezza barra (trasporto + controlli); il layout interno va a capo sotto questa soglia. */
  widthPx: number
  /** Id segmenti attualmente collassati (solo preview / secondari / orologio / audio). */
  collapsedLogicBarSegs: LogicBarCollapsibleSegId[]
}

const DEFAULT_FLOAT: AudioBarLayoutPersist = {
  docked: true,
  x: 24,
  y: 88,
  widthPx: 920,
  collapsedLogicBarSegs: [],
}

export function defaultAudioBarWidthPx(): number {
  if (typeof window === 'undefined') return DEFAULT_FLOAT.widthPx
  const vw = window.innerWidth
  const target = Math.min(1024, vw - 48)
  return clampAudioBarWidth(target)
}

export function clampAudioBarWidth(w: number): number {
  const min = AUDIO_BAR_WIDTH_MIN
  const vwCap =
    typeof window !== 'undefined' ?
      Math.max(min, Math.min(AUDIO_BAR_WIDTH_MAX_CAP, window.innerWidth - 16))
    : AUDIO_BAR_WIDTH_MAX_CAP
  if (!Number.isFinite(w)) return defaultAudioBarWidthPx()
  return Math.round(Math.min(Math.max(w, min), vwCap))
}

export function readAudioBarLayout(): AudioBarLayoutPersist {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) {
      return {
        ...DEFAULT_FLOAT,
        widthPx: defaultAudioBarWidthPx(),
      }
    }
    const j = JSON.parse(raw) as Partial<AudioBarLayoutPersist>
    if (typeof j?.x === 'number' && typeof j?.y === 'number') {
      const widthPx =
        typeof j.widthPx === 'number' && Number.isFinite(j.widthPx) ?
          clampAudioBarWidth(j.widthPx)
        : defaultAudioBarWidthPx()
      return {
        docked: j.docked !== false,
        x: j.x,
        y: j.y,
        widthPx,
        collapsedLogicBarSegs: parseCollapsedLogicBarSegs(j.collapsedLogicBarSegs),
      }
    }
  } catch {
    /* ignore */
  }
  return {
    ...DEFAULT_FLOAT,
    widthPx: defaultAudioBarWidthPx(),
  }
}

export function persistAudioBarLayout(p: AudioBarLayoutPersist): void {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        ...p,
        widthPx: clampAudioBarWidth(p.widthPx),
        collapsedLogicBarSegs: parseCollapsedLogicBarSegs(
          p.collapsedLogicBarSegs,
        ),
      }),
    )
  } catch {
    /* ignore */
  }
}
