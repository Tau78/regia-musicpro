import { useSyncExternalStore } from 'react'

const LS_REGIA_FLOATING_FLOATER_EXPERIMENTAL = 'regia-floating-floater-experimental'

export const REGIA_FLOATING_FLOATER_EXPERIMENTAL_CHANGED_EVENT =
  'regia-floating-floater-experimental-changed'

export function readRegiaFloatingFloaterExperimental(): boolean {
  try {
    return localStorage.getItem(LS_REGIA_FLOATING_FLOATER_EXPERIMENTAL) === '1'
  } catch {
    return false
  }
}

export function writeRegiaFloatingFloaterExperimental(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(LS_REGIA_FLOATING_FLOATER_EXPERIMENTAL, '1')
    } else {
      localStorage.removeItem(LS_REGIA_FLOATING_FLOATER_EXPERIMENTAL)
    }
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new Event(REGIA_FLOATING_FLOATER_EXPERIMENTAL_CHANGED_EVENT),
  )
}

function subscribeRegiaFloatingFloaterExperimental(
  onStoreChange: () => void,
): () => void {
  const onCustom = () => onStoreChange()
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === LS_REGIA_FLOATING_FLOATER_EXPERIMENTAL ||
      e.key === null
    ) {
      onStoreChange()
    }
  }
  window.addEventListener(
    REGIA_FLOATING_FLOATER_EXPERIMENTAL_CHANGED_EVENT,
    onCustom,
  )
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(
      REGIA_FLOATING_FLOATER_EXPERIMENTAL_CHANGED_EVENT,
      onCustom,
    )
    window.removeEventListener('storage', onStorage)
  }
}

/** Puntina / finestre playlist OS separate (sperimentale). Default: disattivo. */
export function useRegiaFloatingFloaterExperimental(): boolean {
  return useSyncExternalStore(
    subscribeRegiaFloatingFloaterExperimental,
    readRegiaFloatingFloaterExperimental,
    () => false,
  )
}
