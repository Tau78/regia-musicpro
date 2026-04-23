import { useEffect } from 'react'

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

type Handlers = {
  onTogglePlay: () => void
  onPrev: () => void
  onNext: () => void
  onUndo: () => void
  onRedo: () => void
  /** Codici `KeyboardEvent.code` da Wizard Presenter (localStorage). */
  presenterPrevCode: string
  presenterNextCode: string
  presenterPlayPauseCode: string
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onPrev,
  onNext,
  onUndo,
  onRedo,
  presenterPrevCode,
  presenterNextCode,
  presenterPlayPauseCode,
}: Handlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ' && !e.altKey) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
        return
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.code === presenterPlayPauseCode) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        onTogglePlay()
        return
      }

      if (e.code === presenterPrevCode) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        onPrev()
        return
      }

      if (e.code === presenterNextCode) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    onTogglePlay,
    onPrev,
    onNext,
    onUndo,
    onRedo,
    presenterPrevCode,
    presenterNextCode,
    presenterPlayPauseCode,
  ])
}
