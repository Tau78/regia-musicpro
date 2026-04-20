import {
  clampPanelInViewport,
  type PanelPos,
  type PanelSize,
} from './floatingPanelGeometry.ts'

export const LS_PREVIEW_LAYOUT = 'regia-preview-layout'

const MIN_W = 280
const MIN_H = 240

const DEFAULT_LAYOUT: { pos: PanelPos; size: PanelSize } = {
  pos: { x: 72, y: 80 },
  size: { width: 520, height: 420 },
}

type LayoutLs = { x?: number; y?: number; width?: number; height?: number }

export type PreviewLayoutPersist = {
  x: number
  y: number
  width: number
  height: number
}

/** Layout finestra anteprima flottante di default (nuovo workspace pulito). */
export function defaultPreviewLayoutPersist(): PreviewLayoutPersist {
  return {
    x: DEFAULT_LAYOUT.pos.x,
    y: DEFAULT_LAYOUT.pos.y,
    width: DEFAULT_LAYOUT.size.width,
    height: DEFAULT_LAYOUT.size.height,
  }
}

/** Dopo restore da workspace: FloatingPreview rilegge layout da LS. */
export const PREVIEW_LAYOUT_APPLIED_EVENT = 'regia-preview-layout-applied'

export function readPreviewLayoutFromLs(): PreviewLayoutPersist {
  try {
    const raw = localStorage.getItem(LS_PREVIEW_LAYOUT)
    if (!raw) {
      return defaultPreviewLayoutPersist()
    }
    const p = JSON.parse(raw) as LayoutLs
    const pos: PanelPos = {
      x: typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : DEFAULT_LAYOUT.pos.x,
      y: typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : DEFAULT_LAYOUT.pos.y,
    }
    const size: PanelSize = {
      width:
        typeof p.width === 'number' && Number.isFinite(p.width)
          ? p.width
          : DEFAULT_LAYOUT.size.width,
      height:
        typeof p.height === 'number' && Number.isFinite(p.height)
          ? p.height
          : DEFAULT_LAYOUT.size.height,
    }
    const { pos: np, size: ns } = clampPanelInViewport(pos, size, MIN_W, MIN_H)
    return { x: np.x, y: np.y, width: ns.width, height: ns.height }
  } catch {
    return defaultPreviewLayoutPersist()
  }
}

export function writePreviewLayoutToLs(layout: PreviewLayoutPersist): void {
  try {
    const pos: PanelPos = { x: layout.x, y: layout.y }
    const size: PanelSize = { width: layout.width, height: layout.height }
    const { pos: np, size: ns } = clampPanelInViewport(pos, size, MIN_W, MIN_H)
    localStorage.setItem(
      LS_PREVIEW_LAYOUT,
      JSON.stringify({
        x: np.x,
        y: np.y,
        width: ns.width,
        height: ns.height,
      }),
    )
  } catch {
    /* ignore */
  }
}

export function dispatchPreviewLayoutApplied(): void {
  window.dispatchEvent(new Event(PREVIEW_LAYOUT_APPLIED_EVENT))
}
