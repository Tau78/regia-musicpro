import { useSyncExternalStore } from 'react'

export const LS_PLANCIA_SNAP = 'regia-plancia-snap-enabled'

export const PLANCIA_SNAP_CHANGED_EVENT = 'regia-plancia-snap-changed'

export function readPlanciaSnapEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LS_PLANCIA_SNAP)
    if (raw === null) return true
    return raw === 'true' || raw === '1'
  } catch {
    return true
  }
}

export function writePlanciaSnapEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_PLANCIA_SNAP, enabled ? 'true' : 'false')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PLANCIA_SNAP_CHANGED_EVENT))
}

function subscribePlanciaSnap(onStoreChange: () => void): () => void {
  const run = () => onStoreChange()
  window.addEventListener(PLANCIA_SNAP_CHANGED_EVENT, run)
  window.addEventListener('storage', run)
  return () => {
    window.removeEventListener(PLANCIA_SNAP_CHANGED_EVENT, run)
    window.removeEventListener('storage', run)
  }
}

export function usePlanciaSnapEnabled(): boolean {
  return useSyncExternalStore(
    subscribePlanciaSnap,
    readPlanciaSnapEnabled,
    () => true,
  )
}
