import type { PanelPos, PanelSize, ResizeEdge } from './floatingPanelGeometry.ts'

/** Allineamento a larghezze/altezze di altri pannelli sulla plancia. */
export const SNAP_PEER_DIMENSION_PX = 12

/** Allineamento leggero ai bordi interni dell’area principale (`.regia-main-content`). */
export const SNAP_PLANCIA_EDGE_PX = 10

/** Distanza dal bordo destro finestra per agganciare un pannello alla colonna plancia destra. */
export const PLANCIA_DOCK_SCREEN_RIGHT_PX = 28

/**
 * Trascinando un pannello agganciato verso sinistra oltre questo margine dal bordo
 * destro dell’area plancia, si stacca e torna flottante.
 */
export const PLANCIA_UNDOCK_DRAG_LEFT_PX = 56

const PLANCIA_DOCK_COL_MIN_W = 220
const PLANCIA_DOCK_COL_MAX_W = 960

/** Larghezza colonna dock destra (0 se nessun pannello agganciato). */
export function computeRightPlanciaDockColumnWidthPx(
  sessions: readonly {
    planciaDock?: 'none' | 'right'
    panelSize: { width: number }
  }[],
): number {
  let maxW = 0
  for (const s of sessions) {
    if (s.planciaDock !== 'right') continue
    const w = s.panelSize.width
    if (typeof w === 'number' && Number.isFinite(w)) maxW = Math.max(maxW, w)
  }
  if (maxW <= 0) return 0
  return Math.min(
    PLANCIA_DOCK_COL_MAX_W,
    Math.max(PLANCIA_DOCK_COL_MIN_W, Math.round(maxW)),
  )
}

/** Spostamento: aggancio ai bordi di altri pannelli flottanti. */
export const SNAP_PEER_DRAG_PX = 10

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

type AxisSnap = { next: number }

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
 * Durante lo spostamento: allinea i bordi all’area plancia e ai bordi di altri pannelli flottanti.
 */
export function snapFloatingPanelDragPos(
  pos: PanelPos,
  size: PanelSize,
  plancia: PlanciaRect | null,
  peers: readonly PeerSnapRect[] = [],
  thresholdPx: number = SNAP_PLANCIA_EDGE_PX,
  peerThresholdPx: number = SNAP_PEER_DRAG_PX,
): PanelPos {
  let x = pos.x
  let y = pos.y
  const w = size.width
  const h = size.height

  const xCand: AxisSnap[] = []
  if (plancia) {
    xCand.push({ next: plancia.left })
    xCand.push({ next: plancia.right - w })
  }
  for (const p of peers) {
    xCand.push({ next: p.left })
    xCand.push({ next: p.right - w })
    xCand.push({ next: p.right })
    xCand.push({ next: p.left - w })
  }
  const sx = bestSnapLeftEdge(
    x,
    xCand,
    Math.max(thresholdPx, peerThresholdPx),
  )
  if (sx) {
    x = sx.next
  }

  const yCand: AxisSnap[] = []
  if (plancia) {
    yCand.push({ next: plancia.top })
    yCand.push({ next: plancia.bottom - h })
  }
  for (const p of peers) {
    yCand.push({ next: p.top })
    yCand.push({ next: p.bottom - h })
    yCand.push({ next: p.bottom })
    yCand.push({ next: p.top - h })
  }
  const sy = bestSnapLeftEdge(
    y,
    yCand,
    Math.max(thresholdPx, peerThresholdPx),
  )
  if (sy) {
    y = sy.next
  }

  return { x, y }
}
