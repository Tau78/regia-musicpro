import { useSyncExternalStore } from 'react'

/** Stessa union usata sui pad (`LaunchPadKeyMode` in sessione). */
export type LaunchPadKeyModePref = 'play' | 'toggle'

export const LS_LAUNCHPAD_DEFAULT_KEY_MODE = 'regia-launchpad-default-key-mode'
export const LS_LAUNCHPAD_CUE_ENABLED = 'regia-launchpad-cue-enabled'

export const LAUNCHPAD_SETTINGS_CHANGED_EVENT = 'regia-launchpad-settings-changed'

function dispatchLaunchPadSettingsChanged(): void {
  try {
    window.dispatchEvent(new Event(LAUNCHPAD_SETTINGS_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

export function readLaunchPadDefaultKeyMode(): LaunchPadKeyModePref {
  try {
    const raw = localStorage.getItem(LS_LAUNCHPAD_DEFAULT_KEY_MODE)
    if (raw === 'play' || raw === 'toggle') return raw
  } catch {
    /* ignore */
  }
  return 'toggle'
}

export function writeLaunchPadDefaultKeyMode(mode: LaunchPadKeyModePref): void {
  try {
    localStorage.setItem(LS_LAUNCHPAD_DEFAULT_KEY_MODE, mode)
  } catch {
    /* ignore */
  }
  dispatchLaunchPadSettingsChanged()
}

/** CUE = tenere premuto pad/tasto per ascolto fino al rilascio (hold). */
export function readLaunchPadCueEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LS_LAUNCHPAD_CUE_ENABLED)
    if (raw === null) return true
    return raw === 'true' || raw === '1'
  } catch {
    return true
  }
}

export function writeLaunchPadCueEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_LAUNCHPAD_CUE_ENABLED, enabled ? 'true' : 'false')
  } catch {
    /* ignore */
  }
  dispatchLaunchPadSettingsChanged()
}

function subscribeLaunchPadSettings(onStoreChange: () => void): () => void {
  const run = () => onStoreChange()
  window.addEventListener(LAUNCHPAD_SETTINGS_CHANGED_EVENT, run)
  window.addEventListener('storage', run)
  return () => {
    window.removeEventListener(LAUNCHPAD_SETTINGS_CHANGED_EVENT, run)
    window.removeEventListener('storage', run)
  }
}

export function useLaunchPadCueEnabled(): boolean {
  return useSyncExternalStore(
    subscribeLaunchPadSettings,
    readLaunchPadCueEnabled,
    () => true,
  )
}
