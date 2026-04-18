import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import AudioOutputBar from './AudioOutputBar.tsx'
import LogicPreviewScreenStrip from './LogicPreviewScreenStrip.tsx'
import LogicSecondaryStrip from './LogicSecondaryStrip.tsx'
import LogicTransportStrip from './LogicTransportStrip.tsx'
import {
  persistAudioBarLayout,
  readAudioBarLayout,
} from '../lib/audioBarLayoutStorage.ts'

function clampWindowPos(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(8, window.innerWidth - w - 8)
  const maxY = Math.max(8, window.innerHeight - h - 8)
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  }
}

/** True se il target è (dentro) un controllo che non deve avviare il drag. */
function isInteractiveDragBlocker(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'button, input, select, textarea, option, label, a, [data-no-drag]',
    ),
  )
}

/** Aggancia nell’header (quando la barra è flottante). */
function IconPinDock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
    </svg>
  )
}

/** Stacca (quando la barra è nell’header). */
function IconPinFloat() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" />
    </svg>
  )
}

export default function DraggableAudioOutputBar() {
  const init = useMemo(() => readAudioBarLayout(), [])
  const [docked, setDocked] = useState(init.docked)
  const [pos, setPos] = useState(() => ({ x: init.x, y: init.y }))
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    originX: number
    originY: number
  } | null>(null)

  useEffect(() => {
    persistAudioBarLayout({ docked, x: pos.x, y: pos.y })
  }, [docked, pos.x, pos.y])

  const clampToViewport = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const w = el.offsetWidth || 320
    const h = el.offsetHeight || 52
    setPos((p) => clampWindowPos(p.x, p.y, w, h))
  }, [])

  useEffect(() => {
    if (!docked) clampToViewport()
  }, [docked, clampToViewport])

  useEffect(() => {
    window.addEventListener('resize', clampToViewport)
    return () => window.removeEventListener('resize', clampToViewport)
  }, [clampToViewport])

  const undock = useCallback(() => {
    const el = wrapRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const c = clampWindowPos(r.left, r.top, r.width, r.height)
      setPos(c)
    }
    setDocked(false)
  }, [])

  const onRowPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (docked || e.button !== 0) return
      if (isInteractiveDragBlocker(e.target)) return
      e.preventDefault()
      dragRef.current = {
        pointerId: e.pointerId,
        originX: e.clientX - pos.x,
        originY: e.clientY - pos.y,
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [docked, pos.x, pos.y],
  )

  const onRowPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const nx = e.clientX - d.originX
      const ny = e.clientY - d.originY
      const el = wrapRef.current
      const w = el?.offsetWidth ?? 320
      const h = el?.offsetHeight ?? 52
      setPos(clampWindowPos(nx, ny, w, h))
    },
    [],
  )

  const onRowPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      dragRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [],
  )

  const floatingStyle =
    !docked ?
      {
        position: 'fixed' as const,
        left: pos.x,
        top: pos.y,
        zIndex: 160,
      }
    : undefined

  return (
    <div
      ref={wrapRef}
      className={`regia-audio-dock-wrap ${!docked ? 'is-floating' : ''}`}
      style={floatingStyle}
    >
      <div
        className={`regia-audio-dock-inner regia-audio-dock-inner--single-row ${!docked ? 'is-drag-surface' : ''}`}
        onPointerDown={onRowPointerDown}
        onPointerMove={onRowPointerMove}
        onPointerUp={onRowPointerUp}
        onPointerCancel={onRowPointerUp}
      >
        <LogicTransportStrip />
        <span className="logic-bar-divider" aria-hidden />
        <LogicSecondaryStrip />
        <span className="logic-bar-divider" aria-hidden />
        <LogicPreviewScreenStrip />
        <span className="logic-bar-divider" aria-hidden />
        <div className="regia-audio-dock-audio">
          <AudioOutputBar variant="inline" />
        </div>
        <button
          type="button"
          className="regia-audio-dock-pin-icon"
          onClick={() => {
            if (docked) undock()
            else setDocked(true)
          }}
          title={docked ? 'Stacca barra (trascina da zone vuote)' : 'Aggancia nell’header'}
          aria-label={
            docked ? 'Stacca barra dalla barra superiore' : 'Aggancia barra nell’header'
          }
        >
          {docked ? <IconPinFloat /> : <IconPinDock />}
        </button>
      </div>
    </div>
  )
}
