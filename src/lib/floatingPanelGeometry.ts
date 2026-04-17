export type PanelPos = { x: number; y: number }

export type PanelSize = { width: number; height: number }

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export function clampPanelInViewport(
  pos: PanelPos,
  size: PanelSize,
  minW: number,
  minH: number,
): { pos: PanelPos; size: PanelSize } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 6
  let w = Math.min(
    Math.max(minW, size.width),
    Math.max(minW, vw - margin * 2),
  )
  let h = Math.min(
    Math.max(minH, size.height),
    Math.max(minH, vh - margin * 2),
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

  return clampPanelInViewport({ x, y }, { width: w, height: h }, minW, minH)
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
