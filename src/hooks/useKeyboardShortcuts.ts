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
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onPrev,
  onNext,
  onUndo,
  onRedo,
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

      if (e.code === 'Space') {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        onTogglePlay()
        return
      }

      if (
        e.code === 'PageUp' ||
        e.code === 'ArrowLeft' ||
        (e.code === 'KeyP' && !e.shiftKey)
      ) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        onPrev()
        return
      }

      if (
        e.code === 'PageDown' ||
        e.code === 'ArrowRight' ||
        (e.code === 'KeyN' && !e.shiftKey)
      ) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTogglePlay, onPrev, onNext, onUndo, onRedo])
}
