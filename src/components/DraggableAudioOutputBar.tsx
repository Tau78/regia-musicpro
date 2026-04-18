import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import AudioOutputBar from './AudioOutputBar.tsx'
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
    const h = el.offsetHeight || 44
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

  const onGripPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (docked || e.button !== 0) return
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

  const onGripPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const nx = e.clientX - d.originX
      const ny = e.clientY - d.originY
      const el = wrapRef.current
      const w = el?.offsetWidth ?? 320
      const h = el?.offsetHeight ?? 44
      setPos(clampWindowPos(nx, ny, w, h))
    },
    [],
  )

  const onGripPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
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
      <div className="regia-audio-dock-inner">
        <button
          type="button"
          className="regia-audio-dock-grip"
          disabled={docked}
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          onPointerCancel={onGripPointerUp}
          title={
            docked
              ? 'Stacca la barra per poterla trascinare'
              : 'Trascina per spostare la barra'
          }
          aria-label="Trascina barra volume e uscita"
        >
          <span aria-hidden>⋮⋮</span>
        </button>
        <button
          type="button"
          className="regia-audio-dock-pin"
          onClick={() => {
            if (docked) undock()
            else setDocked(true)
          }}
          title={
            docked ? 'Stacca dalla barra superiore' : 'Aggancia nell’header'
          }
          aria-label={docked ? 'Stacca barra audio' : 'Aggancia barra audio nell’header'}
        >
          {docked ? 'Stacca' : 'Header'}
        </button>
        <AudioOutputBar variant="toolbar" />
      </div>
    </div>
  )
}
