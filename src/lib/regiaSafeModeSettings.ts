const LS_REGIA_SAFE_MODE = 'regia-safe-mode'

export const REGIA_SAFE_MODE_CHANGED_EVENT = 'regia-safe-mode-changed'

export function readRegiaSafeMode(): boolean {
  try {
    return localStorage.getItem(LS_REGIA_SAFE_MODE) === '1'
  } catch {
    return false
  }
}

export function writeRegiaSafeMode(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(LS_REGIA_SAFE_MODE, '1')
    else localStorage.removeItem(LS_REGIA_SAFE_MODE)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(REGIA_SAFE_MODE_CHANGED_EVENT))
}
