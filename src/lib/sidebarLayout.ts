const LS_SIDEBAR = 'regia-sidebar-saved-open'
const LS_SIDEBAR_WIDTH = 'regia-sidebar-width'

export const SIDEBAR_WIDTH_MIN = 260

export function sidebarWidthMax(): number {
  if (typeof window === 'undefined') return 580
  return Math.min(580, Math.floor(window.innerWidth * 0.72))
}

export function clampSidebarWidth(w: number): number {
  return Math.round(
    Math.min(Math.max(w, SIDEBAR_WIDTH_MIN), sidebarWidthMax()),
  )
}

export function readSidebarOpen(): boolean {
  try {
    return localStorage.getItem(LS_SIDEBAR) !== 'false'
  } catch {
    return true
  }
}

export function readSidebarWidthPx(): number {
  try {
    const v = parseInt(localStorage.getItem(LS_SIDEBAR_WIDTH) || '', 10)
    if (!Number.isFinite(v)) return 308
    return clampSidebarWidth(v)
  } catch {
    return 308
  }
}

export function persistSidebarOpen(open: boolean): void {
  try {
    localStorage.setItem(LS_SIDEBAR, open ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

export function persistSidebarWidthPx(w: number): void {
  try {
    localStorage.setItem(LS_SIDEBAR_WIDTH, String(w))
  } catch {
    /* ignore */
  }
}

export { LS_SIDEBAR, LS_SIDEBAR_WIDTH }
