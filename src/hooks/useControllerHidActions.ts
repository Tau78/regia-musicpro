import { useEffect } from 'react'
import {
  readControllerHidActionMap,
  type ControllerHidAction,
  type ControllerHidInput,
} from '../lib/controllerHidSettings.ts'

type Handlers = {
  onTogglePlay: () => void
  onPrev: () => void
  onNext: () => void
  onStop: () => void
  onToggleSecondScreen: () => void
}

function runMappedAction(action: ControllerHidAction, handlers: Handlers): void {
  switch (action) {
    case 'togglePlay':
      handlers.onTogglePlay()
      return
    case 'prev':
      handlers.onPrev()
      return
    case 'next':
      handlers.onNext()
      return
    case 'stop':
      handlers.onStop()
      return
    case 'toggleSecondScreen':
      handlers.onToggleSecondScreen()
      return
    case 'none':
      return
  }
}

export function useControllerHidActions(handlers: Handlers): void {
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onControllerHidEvent) return
    return api.onControllerHidEvent((event) => {
      const input = event.matchedStep as ControllerHidInput | undefined
      if (!input || !event.learned) return
      const actionMap = readControllerHidActionMap()
      runMappedAction(actionMap[input], handlers)
    })
  }, [handlers])
}
