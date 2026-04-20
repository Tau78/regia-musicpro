import { useSyncExternalStore } from 'react'

export const LS_PANEL_TOOLTIP_HINTS = 'regia-panel-tooltip-hints-enabled'

export const PANEL_TOOLTIP_HINTS_CHANGED_EVENT =
  'regia-panel-tooltip-hints-changed'

/** Barra inferiore con testo al passaggio del mouse (`data-preview-hint`). Default: attivo. */
export function readPanelTooltipHintsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LS_PANEL_TOOLTIP_HINTS)
    if (raw === null) return true
    return raw === 'true' || raw === '1'
  } catch {
    return true
  }
}

export function writePanelTooltipHintsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_PANEL_TOOLTIP_HINTS, enabled ? 'true' : 'false')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PANEL_TOOLTIP_HINTS_CHANGED_EVENT))
}

function subscribePanelTooltipHints(onStoreChange: () => void): () => void {
  const run = () => onStoreChange()
  window.addEventListener(PANEL_TOOLTIP_HINTS_CHANGED_EVENT, run)
  window.addEventListener('storage', run)
  return () => {
    window.removeEventListener(PANEL_TOOLTIP_HINTS_CHANGED_EVENT, run)
    window.removeEventListener('storage', run)
  }
}

export function usePanelTooltipHintsEnabled(): boolean {
  return useSyncExternalStore(
    subscribePanelTooltipHints,
    readPanelTooltipHintsEnabled,
    () => true,
  )
}
