import { useSyncExternalStore } from 'react'
import { normalizePersistedPadKeyCode } from './launchPadKeyboard.ts'

export const LS_PRESENTER_KEY_PREV = 'regia-presenter-key-prev'
export const LS_PRESENTER_KEY_NEXT = 'regia-presenter-key-next'
export const LS_PRESENTER_KEY_PLAY = 'regia-presenter-key-playpause'

export const PRESENTER_KEYS_CHANGED_EVENT = 'regia-presenter-keys-changed'

/** Brano precedente (default come telecomandi comuni). */
export const DEFAULT_PRESENTER_PREV_CODE = 'PageUp'
/** Brano successivo. */
export const DEFAULT_PRESENTER_NEXT_CODE = 'PageDown'
export const DEFAULT_PRESENTER_PLAY_CODE = 'Space'

export type PresenterLearnRole = 'prev' | 'next' | 'playPause'

function dispatchPresenterKeysChanged(): void {
  try {
    window.dispatchEvent(new Event(PRESENTER_KEYS_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function readOne(lsKey: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(lsKey)
    const n = normalizePersistedPadKeyCode(raw)
    if (n) return n
  } catch {
    /* ignore */
  }
  return fallback
}

export function readPresenterPrevCode(): string {
  return readOne(LS_PRESENTER_KEY_PREV, DEFAULT_PRESENTER_PREV_CODE)
}

export function readPresenterNextCode(): string {
  return readOne(LS_PRESENTER_KEY_NEXT, DEFAULT_PRESENTER_NEXT_CODE)
}

export function readPresenterPlayPauseCode(): string {
  return readOne(LS_PRESENTER_KEY_PLAY, DEFAULT_PRESENTER_PLAY_CODE)
}

export function readPresenterKeyBindings(): {
  prevCode: string
  nextCode: string
  playPauseCode: string
} {
  return {
    prevCode: readPresenterPrevCode(),
    nextCode: readPresenterNextCode(),
    playPauseCode: readPresenterPlayPauseCode(),
  }
}

export function writePresenterKey(
  role: PresenterLearnRole,
  code: string,
): void {
  const key =
    role === 'prev'
      ? LS_PRESENTER_KEY_PREV
      : role === 'next'
        ? LS_PRESENTER_KEY_NEXT
        : LS_PRESENTER_KEY_PLAY
  try {
    localStorage.setItem(key, code)
  } catch {
    /* ignore */
  }
  dispatchPresenterKeysChanged()
}

export function resetPresenterKeysToDefaults(): void {
  try {
    localStorage.removeItem(LS_PRESENTER_KEY_PREV)
    localStorage.removeItem(LS_PRESENTER_KEY_NEXT)
    localStorage.removeItem(LS_PRESENTER_KEY_PLAY)
  } catch {
    /* ignore */
  }
  dispatchPresenterKeysChanged()
}

function subscribePresenterKeys(onStoreChange: () => void): () => void {
  const run = () => onStoreChange()
  window.addEventListener(PRESENTER_KEYS_CHANGED_EVENT, run)
  window.addEventListener('storage', run)
  return () => {
    window.removeEventListener(PRESENTER_KEYS_CHANGED_EVENT, run)
    window.removeEventListener('storage', run)
  }
}

export function usePresenterKeyBindings(): {
  prevCode: string
  nextCode: string
  playPauseCode: string
} {
  return useSyncExternalStore(
    subscribePresenterKeys,
    () => readPresenterKeyBindings(),
    () => ({
      prevCode: DEFAULT_PRESENTER_PREV_CODE,
      nextCode: DEFAULT_PRESENTER_NEXT_CODE,
      playPauseCode: DEFAULT_PRESENTER_PLAY_CODE,
    }),
  )
}
