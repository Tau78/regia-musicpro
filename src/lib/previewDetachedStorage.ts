const LS_PREVIEW_DETACHED = 'regia-preview-detached'
const LS_PREVIEW_DISPLAY_MODE = 'regia-preview-display-mode-v1'

export type PreviewDisplayMode = 'docked' | 'floating' | 'hidden'

export function readPreviewDisplayMode(): PreviewDisplayMode {
  try {
    const m = localStorage.getItem(LS_PREVIEW_DISPLAY_MODE)
    if (m === 'docked' || m === 'floating' || m === 'hidden') return m
    if (localStorage.getItem(LS_PREVIEW_DETACHED) === 'true') return 'floating'
    return 'docked'
  } catch {
    return 'docked'
  }
}

export function persistPreviewDisplayMode(mode: PreviewDisplayMode): void {
  try {
    localStorage.setItem(LS_PREVIEW_DISPLAY_MODE, mode)
    localStorage.setItem(
      LS_PREVIEW_DETACHED,
      mode === 'floating' ? 'true' : 'false',
    )
  } catch {
    /* ignore */
  }
}

/** Compat: true solo in modalità finestra flottante. */
export function readPreviewDetached(): boolean {
  return readPreviewDisplayMode() === 'floating'
}

/** Compat: `true` → floating, `false` → docked (non imposta hidden). */
export function persistPreviewDetached(detached: boolean): void {
  persistPreviewDisplayMode(detached ? 'floating' : 'docked')
}

export { LS_PREVIEW_DETACHED }
