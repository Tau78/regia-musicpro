import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import AudioOutputBar from './AudioOutputBar.tsx'
import LogicClockStrip from './LogicClockStrip.tsx'
import LogicPreviewScreenStrip from './LogicPreviewScreenStrip.tsx'
import LogicSecondaryStrip from './LogicSecondaryStrip.tsx'
import LogicTransportStrip from './LogicTransportStrip.tsx'
import {
  clampAudioBarWidth,
  persistAudioBarLayout,
  readAudioBarLayout,
  type LogicBarCollapsibleSegId,
} from '../lib/audioBarLayoutStorage.ts'

const LOGIC_BAR_COLLAPSE_UI: Record<
  LogicBarCollapsibleSegId,
  { hideTitle: string; showTitle: string }
> = {
  preview: {
    hideTitle: 'Nascondi anteprima schermo',
    showTitle: 'Mostra anteprima schermo',
  },
  secondary: {
    hideTitle: 'Nascondi strumenti secondari',
    showTitle: 'Mostra strumenti secondari',
  },
  clock: {
    hideTitle: 'Nascondi orologio',
    showTitle: 'Mostra orologio',
  },
  audio: {
    hideTitle: 'Nascondi uscita audio',
    showTitle: 'Mostra uscita audio',
  },
}

function LogicBarCollapsibleSeg({
  segId,
  collapsed,
  onToggle,
  className,
  children,
}: {
  segId: LogicBarCollapsibleSegId
  collapsed: boolean
  onToggle: () => void
  className?: string
  children: ReactNode
}) {
  const ui = LOGIC_BAR_COLLAPSE_UI[segId]
  const panelId = `regia-logic-bar-panel-${segId}`
  const segClass = [
    'regia-logic-bar-seg',
    'regia-logic-bar-seg--split',
    collapsed ? 'is-collapsed' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={segClass}>
      <button
        type="button"
        className={`logic-bar-divider-btn ${collapsed ? 'is-collapsed' : ''}`}
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={panelId}
        title={collapsed ? ui.showTitle : ui.hideTitle}
        aria-label={collapsed ? ui.showTitle : ui.hideTitle}
      />
      <div id={panelId} className="regia-logic-bar-seg-panel" hidden={collapsed}>
        {children}
      </div>
    </div>
  )
}

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

/** Freccia nel vassoio (come “Download” / Lucide): standard per “porta qui in basso” — aggancia. */
function IconDockIntoBar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

/** Finestra + freccia in alto a destra (Lucide “External link”): standard per stacca / apri separato. */
function IconDetachExternalLink() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  )
}

export default function DraggableAudioOutputBar() {
  const init = useMemo(() => readAudioBarLayout(), [])
  const [docked, setDocked] = useState(init.docked)
  const [pos, setPos] = useState(() => ({ x: init.x, y: init.y }))
  const [barWidthPx, setBarWidthPx] = useState(() => init.widthPx)
  const [collapsedLogicBarSegs, setCollapsedLogicBarSegs] = useState<
    LogicBarCollapsibleSegId[]
  >(() => init.collapsedLogicBarSegs)
  const [barResizeActive, setBarResizeActive] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    originX: number
    originY: number
  } | null>(null)
  const barResizeDragRef = useRef<{
    pointerId: number
    startX: number
    startW: number
  } | null>(null)

  const collapsedSegSet = useMemo(
    () => new Set(collapsedLogicBarSegs),
    [collapsedLogicBarSegs],
  )

  const toggleLogicBarSeg = useCallback((id: LogicBarCollapsibleSegId) => {
    setCollapsedLogicBarSegs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  useEffect(() => {
    persistAudioBarLayout({
      docked,
      x: pos.x,
      y: pos.y,
      widthPx: barWidthPx,
      collapsedLogicBarSegs,
    })
  }, [docked, pos.x, pos.y, barWidthPx, collapsedLogicBarSegs])

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

  useEffect(() => {
    const onWin = () => {
      setBarWidthPx((w) => clampAudioBarWidth(w))
    }
    window.addEventListener('resize', onWin)
    return () => window.removeEventListener('resize', onWin)
  }, [])

  const onBarResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      barResizeDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startW: barWidthPx,
      }
      setBarResizeActive(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [barWidthPx],
  )

  const onBarResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = barResizeDragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const dx = e.clientX - d.startX
      setBarWidthPx(clampAudioBarWidth(d.startW + dx))
    },
    [],
  )

  const endBarResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = barResizeDragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    barResizeDragRef.current = null
    setBarResizeActive(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onBarResizeKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const step = 16
      const delta = e.key === 'ArrowRight' ? step : -step
      setBarWidthPx((w) => clampAudioBarWidth(w + delta))
    },
    [],
  )

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

  const wrapStyle = {
    ...floatingStyle,
    width: barWidthPx,
    maxWidth: '100%',
  } as const

  return (
    <div
      ref={wrapRef}
      className={`regia-audio-dock-wrap ${!docked ? 'is-floating' : ''}`}
      style={wrapStyle}
    >
      <div
        className={`regia-audio-dock-inner regia-audio-dock-inner--single-row ${!docked ? 'is-drag-surface' : ''}`}
        onPointerDown={onRowPointerDown}
        onPointerMove={onRowPointerMove}
        onPointerUp={onRowPointerUp}
        onPointerCancel={onRowPointerUp}
      >
        <div className="regia-logic-bar-seg">
          <LogicTransportStrip />
        </div>
        <LogicBarCollapsibleSeg
          segId="preview"
          collapsed={collapsedSegSet.has('preview')}
          onToggle={() => toggleLogicBarSeg('preview')}
        >
          <LogicPreviewScreenStrip />
        </LogicBarCollapsibleSeg>
        <LogicBarCollapsibleSeg
          segId="secondary"
          collapsed={collapsedSegSet.has('secondary')}
          onToggle={() => toggleLogicBarSeg('secondary')}
        >
          <LogicSecondaryStrip />
        </LogicBarCollapsibleSeg>
        <LogicBarCollapsibleSeg
          segId="clock"
          collapsed={collapsedSegSet.has('clock')}
          onToggle={() => toggleLogicBarSeg('clock')}
        >
          <LogicClockStrip />
        </LogicBarCollapsibleSeg>
        <LogicBarCollapsibleSeg
          segId="audio"
          className="regia-logic-bar-seg--audio"
          collapsed={collapsedSegSet.has('audio')}
          onToggle={() => toggleLogicBarSeg('audio')}
        >
          <div className="regia-audio-dock-audio">
            <AudioOutputBar variant="inline" />
          </div>
        </LogicBarCollapsibleSeg>
        <div className="regia-logic-bar-seg regia-logic-bar-seg--split regia-logic-bar-seg--pin">
          <span className="logic-bar-divider" aria-hidden />
          <button
            type="button"
            className="regia-audio-dock-pin-icon"
            onClick={() => {
              if (docked) undock()
              else setDocked(true)
            }}
            title={
              docked
                ? 'Stacca in finestra libera (poi trascina dalle zone vuote)'
                : 'Aggancia sotto l’intestazione (barra fissa nella plancia)'
            }
            aria-label={
              docked
                ? 'Stacca la barra in una finestra libera sul desktop'
                : 'Aggancia la barra sotto l’intestazione nella plancia'
            }
          >
            {docked ? <IconDetachExternalLink /> : <IconDockIntoBar />}
          </button>
        </div>
      </div>
      <div
        className={`regia-audio-dock-resize-handle-e ${barResizeActive ? 'is-active' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Trascina per ridimensionare la barra di trasporto in larghezza"
        tabIndex={0}
        onPointerDown={onBarResizePointerDown}
        onPointerMove={onBarResizePointerMove}
        onPointerUp={endBarResize}
        onPointerCancel={endBarResize}
        onKeyDown={onBarResizeKeyDown}
      />
    </div>
  )
}
