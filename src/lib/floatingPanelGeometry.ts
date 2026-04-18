export type PanelPos = { x: number; y: number }

export type PanelSize = { width: number; height: number }

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Hit invisibile sul bordo del pannello (px), senza elementi dedicati in layout. */
export const PANEL_RESIZE_BORDER_HIT_PX = 6

/**
 * Rileva se il puntatore è sul bordo del pannello per il ridimensionamento.
 * In modalità comprimibile solo il bordo destro (larghezza).
 */
export function hitTestPanelResizeEdge(
  clientX: number,
  clientY: number,
  panelRect: DOMRect,
  collapsed: boolean,
): ResizeEdge | null {
  const x = clientX - panelRect.left
  const y = clientY - panelRect.top
  const w = panelRect.width
  const h = panelRect.height
  const b = PANEL_RESIZE_BORDER_HIT_PX

  if (collapsed) {
    return x >= w - b ? 'e' : null
  }

  const inL = x <= b
  const inR = x >= w - b
  const inT = y <= b
  const inB = y >= h - b

  if (inT && inL) return 'nw'
  if (inT && inR) return 'ne'
  if (inB && inL) return 'sw'
  if (inB && inR) return 'se'
  if (inT) return 'n'
  if (inB) return 's'
  if (inL) return 'w'
  if (inR) return 'e'
  return null
}

export type ClampPanelOptions = {
  /** Larghezza massima del pannello (oltre al limite del viewport). */
  maxW?: number
  /** Altezza massima del pannello (oltre al limite del viewport). */
  maxH?: number
}

export function clampPanelInViewport(
  pos: PanelPos,
  size: PanelSize,
  minW: number,
  minH: number,
  opts?: ClampPanelOptions,
): { pos: PanelPos; size: PanelSize } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 6
  const capW =
    typeof opts?.maxW === 'number' && Number.isFinite(opts.maxW) && opts.maxW > minW
      ? opts.maxW
      : Number.POSITIVE_INFINITY
  const capH =
    typeof opts?.maxH === 'number' && Number.isFinite(opts.maxH) && opts.maxH > minH
      ? opts.maxH
      : Number.POSITIVE_INFINITY
  let w = Math.min(
    Math.max(minW, size.width),
    Math.max(minW, vw - margin * 2),
    capW,
  )
  let h = Math.min(
    Math.max(minH, size.height),
    Math.max(minH, vh - margin * 2),
    capH,
  )
  let x = pos.x
  let y = pos.y
  x = Math.min(Math.max(margin, x), vw - w - margin)
  y = Math.min(Math.max(margin, y), vh - h - margin)
  w = Math.min(w, vw - x - margin)
  h = Math.min(h, vh - y - margin)
  return { pos: { x, y }, size: { width: w, height: h } }
}

export function applyResizeDelta(
  edge: ResizeEdge,
  startPos: PanelPos,
  startSize: PanelSize,
  dx: number,
  dy: number,
  minW: number,
  minH: number,
  clampOpts?: ClampPanelOptions,
): { pos: PanelPos; size: PanelSize } {
  let x = startPos.x
  let y = startPos.y
  let w = startSize.width
  let h = startSize.height

  if (edge.includes('e')) {
    w = startSize.width + dx
  }
  if (edge.includes('s')) {
    h = startSize.height + dy
  }
  if (edge.includes('w')) {
    const nw = startSize.width - dx
    x = startPos.x + (startSize.width - nw)
    w = nw
  }
  if (edge.includes('n')) {
    const nh = startSize.height - dy
    y = startPos.y + (startSize.height - nh)
    h = nh
  }

  return clampPanelInViewport({ x, y }, { width: w, height: h }, minW, minH, clampOpts)
}

export function clampPosToViewport(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
): PanelPos {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxX = Math.max(0, vw - panelWidth)
  const maxY = Math.max(0, vh - panelHeight)
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}
