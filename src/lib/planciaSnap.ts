import type { PanelPos, PanelSize, ResizeEdge } from './floatingPanelGeometry.ts'

/** Allineamento a larghezze/altezze di altri pannelli sulla plancia. */
export const SNAP_PEER_DIMENSION_PX = 12

/** Allineamento leggero ai bordi interni dell’area principale (`.regia-main-content`). */
export const SNAP_PLANCIA_EDGE_PX = 10

/** Spostamento: aggancio ai bordi di altri pannelli flottanti. */
export const SNAP_PEER_DRAG_PX = 10

export type SnapGuideSegment =
  | { kind: 'v'; x: number; top: number; bottom: number }
  | { kind: 'h'; y: number; left: number; right: number }

export const REGIA_SNAP_GUIDES_EVENT = 'regia-snap-guides'

export function dispatchRegiaSnapGuides(guides: SnapGuideSegment[]): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(REGIA_SNAP_GUIDES_EVENT, { detail: { guides } }),
  )
}

export type PeerSnapRect = {
  left: number
  top: number
  right: number
  bottom: number
}

const PLANCIA_SELECTOR = '.regia-main-content'

export type PlanciaRect = { left: number; top: number; right: number; bottom: number }

export function queryPlanciaContentRect(): PlanciaRect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(PLANCIA_SELECTOR)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return null
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

export type SessionSnapDims = { id: string; width: number; height: number }

function uniqueSortedNumbers(values: number[], min: number): number[] {
  const s = new Set<number>()
  for (const v of values) {
    if (Number.isFinite(v) && v >= min) s.add(Math.round(v))
  }
  return [...s].sort((a, b) => a - b)
}

/** Larghezze e altezze “note” degli altri oggetti flottanti (playlist / launchpad / anteprima). */
export function buildPeerDimensionTargets(
  sessions: SessionSnapDims[],
  excludeId: string | undefined,
  preview: { width: number; height: number } | null,
  minW: number,
  minH: number,
): { widths: number[]; heights: number[] } {
  const ws: number[] = []
  const hs: number[] = []
  for (const s of sessions) {
    if (excludeId && s.id === excludeId) continue
    ws.push(s.width)
    hs.push(s.height)
  }
  if (preview) {
    ws.push(preview.width)
    hs.push(preview.height)
  }
  return {
    widths: uniqueSortedNumbers(ws, minW),
    heights: uniqueSortedNumbers(hs, minH),
  }
}

function nearestSnap(
  value: number,
  candidates: number[],
  threshold: number,
): number | null {
  let bestD = threshold + 1
  let best: number | null = null
  for (const c of candidates) {
    const d = Math.abs(value - c)
    if (d <= threshold && d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

function affectsWidth(edge: ResizeEdge): boolean {
  return edge.includes('e') || edge.includes('w')
}

function affectsHeight(edge: ResizeEdge): boolean {
  return edge.includes('n') || edge.includes('s')
}

/** True se il bordo ovest (o angoli nw/sw) ridimensiona anche la larghezza da sinistra. */
function resizesFromWest(edge: ResizeEdge): boolean {
  return edge.includes('w')
}

function resizesFromNorth(edge: ResizeEdge): boolean {
  return edge.includes('n')
}

/**
 * Dopo `applyResizeDelta`: allinea larghezze/altezze a quelle degli altri pannelli
 * e applica uno snap morbido ai bordi dell’area `.regia-main-content`.
 */
export function snapFloatingPanelResize(
  edge: ResizeEdge,
  pos: PanelPos,
  size: PanelSize,
  opts: {
    plancia: PlanciaRect | null
    peerWidths: number[]
    peerHeights: number[]
    minW: number
    minH: number
    peerThresholdPx?: number
    planciaThresholdPx?: number
  },
): { pos: PanelPos; size: PanelSize } {
  const peerT = opts.peerThresholdPx ?? SNAP_PEER_DIMENSION_PX
  const planT = opts.planciaThresholdPx ?? SNAP_PLANCIA_EDGE_PX
  let x = pos.x
  let y = pos.y
  let w = size.width
  let h = size.height

  if (affectsWidth(edge) && opts.peerWidths.length) {
    const nw = nearestSnap(w, opts.peerWidths, peerT)
    if (nw != null && nw >= opts.minW) {
      if (resizesFromWest(edge)) {
        const right = x + w
        w = nw
        x = right - w
      } else {
        w = nw
      }
    }
  }

  if (affectsHeight(edge) && opts.peerHeights.length) {
    const nh = nearestSnap(h, opts.peerHeights, peerT)
    if (nh != null && nh >= opts.minH) {
      if (resizesFromNorth(edge)) {
        const bottom = y + h
        h = nh
        y = bottom - h
      } else {
        h = nh
      }
    }
  }

  const P = opts.plancia
  if (P) {
    if (affectsWidth(edge)) {
      if (edge.includes('e')) {
        const targetW = P.right - x
        if (Number.isFinite(targetW) && Math.abs(w - targetW) <= planT) {
          w = Math.max(opts.minW, targetW)
        }
      }
      if (edge.includes('w')) {
        if (Math.abs(x - P.left) <= planT) {
          const right = x + w
          x = P.left
          w = Math.max(opts.minW, right - x)
        }
      }
    }
    if (affectsHeight(edge)) {
      if (edge.includes('s')) {
        const targetH = P.bottom - y
        if (Number.isFinite(targetH) && Math.abs(h - targetH) <= planT) {
          h = Math.max(opts.minH, targetH)
        }
      }
      if (edge.includes('n')) {
        if (Math.abs(y - P.top) <= planT) {
          const bottom = y + h
          y = P.top
          h = Math.max(opts.minH, bottom - y)
        }
      }
    }
  }

  return { pos: { x, y }, size: { width: w, height: h } }
}

/** Durante lo spostamento: allinea leggermente i bordi al contenuto plancia. */
export function snapFloatingPanelDragPos(
  pos: PanelPos,
  size: PanelSize,
  plancia: PlanciaRect | null,
  thresholdPx: number = SNAP_PLANCIA_EDGE_PX,
): PanelPos {
  return snapFloatingPanelDragPosWithGuides(pos, size, plancia, [], thresholdPx)
    .pos
}

type AxisSnap = { next: number; guide: number }

function bestSnapLeftEdge(
  left: number,
  candidates: readonly AxisSnap[],
  threshold: number,
): AxisSnap | null {
  let best: AxisSnap | null = null
  let bestD = threshold + 1
  for (const c of candidates) {
    const d = Math.abs(left - c.next)
    if (d <= threshold && d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

/**
 * Snap in trascinamento: bordi area plancia + bordi di altri pannelli; restituisce linee guida per overlay.
 */
export function snapFloatingPanelDragPosWithGuides(
  pos: PanelPos,
  size: PanelSize,
  plancia: PlanciaRect | null,
  peers: readonly PeerSnapRect[],
  thresholdPx: number = SNAP_PLANCIA_EDGE_PX,
  peerThresholdPx: number = SNAP_PEER_DRAG_PX,
): { pos: PanelPos; guides: SnapGuideSegment[] } {
  const guides: SnapGuideSegment[] = []
  let x = pos.x
  let y = pos.y
  const w = size.width
  const h = size.height

  const pushV = (gx: number) => {
    if (!plancia) return
    guides.push({
      kind: 'v',
      x: gx,
      top: plancia.top,
      bottom: plancia.bottom,
    })
  }
  const pushH = (gy: number) => {
    if (!plancia) return
    guides.push({
      kind: 'h',
      y: gy,
      left: plancia.left,
      right: plancia.right,
    })
  }

  const xCand: AxisSnap[] = []
  if (plancia) {
    xCand.push({ next: plancia.left, guide: plancia.left })
    xCand.push({ next: plancia.right - w, guide: plancia.right })
  }
  for (const p of peers) {
    xCand.push({ next: p.left, guide: p.left })
    xCand.push({ next: p.right - w, guide: p.right })
    xCand.push({ next: p.right, guide: p.right })
    xCand.push({ next: p.left - w, guide: p.left })
  }
  const sx = bestSnapLeftEdge(
    x,
    xCand,
    Math.max(thresholdPx, peerThresholdPx),
  )
  if (sx) {
    x = sx.next
    pushV(sx.guide)
  }

  const yCand: AxisSnap[] = []
  if (plancia) {
    yCand.push({ next: plancia.top, guide: plancia.top })
    yCand.push({ next: plancia.bottom - h, guide: plancia.bottom })
  }
  for (const p of peers) {
    yCand.push({ next: p.top, guide: p.top })
    yCand.push({ next: p.bottom - h, guide: p.bottom })
    yCand.push({ next: p.bottom, guide: p.bottom })
    yCand.push({ next: p.top - h, guide: p.top })
  }
  const sy = bestSnapLeftEdge(
    y,
    yCand,
    Math.max(thresholdPx, peerThresholdPx),
  )
  if (sy) {
    y = sy.next
    pushH(sy.guide)
  }

  return { pos: { x, y }, guides }
}
