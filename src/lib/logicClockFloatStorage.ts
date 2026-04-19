const LS_KEY = 'regia-logic-clock-float-v1'

const DEFAULT_W = 220
const DEFAULT_H = 46

/** Indice in OPACITY_LEVELS (25%, 50%, 75%, 100%). */
export type ClockOpacityStep = 0 | 1 | 2 | 3

export type LogicClockFloatLayout = {
  x: number
  y: number
  width: number
  height: number
  opacityStep?: ClockOpacityStep
}

export function readLogicClockFloatLayout(): LogicClockFloatLayout | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<LogicClockFloatLayout>
    if (typeof j?.x !== 'number' || typeof j?.y !== 'number') return null
    const width =
      typeof j.width === 'number' && Number.isFinite(j.width) && j.width >= 120
        ? j.width
        : DEFAULT_W
    const height =
      typeof j.height === 'number' && Number.isFinite(j.height) && j.height >= 38
        ? j.height
        : DEFAULT_H
    let opacityStep: ClockOpacityStep = 3
    if (
      j.opacityStep === 0 ||
      j.opacityStep === 1 ||
      j.opacityStep === 2 ||
      j.opacityStep === 3
    ) {
      opacityStep = j.opacityStep
    }
    return { x: j.x, y: j.y, width, height, opacityStep }
  } catch {
    /* ignore */
  }
  return null
}

export function persistLogicClockFloatLayout(p: LogicClockFloatLayout): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

export function defaultLogicClockSize(): Pick<
  LogicClockFloatLayout,
  'width' | 'height'
> {
  return { width: DEFAULT_W, height: DEFAULT_H }
}
