const LS_PREVIEW_DETACHED = 'regia-preview-detached'

export function readPreviewDetached(): boolean {
  try {
    return localStorage.getItem(LS_PREVIEW_DETACHED) === 'true'
  } catch {
    return false
  }
}

export function persistPreviewDetached(detached: boolean): void {
  try {
    localStorage.setItem(LS_PREVIEW_DETACHED, detached ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

export { LS_PREVIEW_DETACHED }
