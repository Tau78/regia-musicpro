import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  clampPanelInViewport,
  clampPosToViewport,
  type PanelPos,
  type PanelSize,
} from '../lib/floatingPanelGeometry.ts'
import PreviewBlock from './PreviewBlock.tsx'

const LS_LAYOUT = 'regia-preview-layout'

const MIN_W = 280
const MIN_H = 240

const DEFAULT_LAYOUT: { pos: PanelPos; size: PanelSize } = {
  pos: { x: 72, y: 80 },
  size: { width: 520, height: 420 },
}

type LayoutLs = { x?: number; y?: number; width?: number; height?: number }

function readLayoutFromLs(): { pos: PanelPos; size: PanelSize } {
  try {
    const raw = localStorage.getItem(LS_LAYOUT)
    if (!raw) return { ...DEFAULT_LAYOUT }
    const p = JSON.parse(raw) as LayoutLs
    const pos: PanelPos = {
      x: typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : DEFAULT_LAYOUT.pos.x,
      y: typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : DEFAULT_LAYOUT.pos.y,
    }
    const size: PanelSize = {
      width:
        typeof p.width === 'number' && Number.isFinite(p.width)
          ? p.width
          : DEFAULT_LAYOUT.size.width,
      height:
        typeof p.height === 'number' && Number.isFinite(p.height)
          ? p.height
          : DEFAULT_LAYOUT.size.height,
    }
    const { pos: np, size: ns } = clampPanelInViewport(pos, size, MIN_W, MIN_H)
    return { pos: np, size: ns }
  } catch {
    return { ...DEFAULT_LAYOUT }
  }
}

function persistLayoutToLs(pos: PanelPos, size: PanelSize): void {
  try {
    localStorage.setItem(
      LS_LAYOUT,
      JSON.stringify({
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
      }),
    )
  } catch {
    /* ignore */
  }
}

export default function FloatingPreview({ onDock }: { onDock: () => void }) {
  const [pos, setPos] = useState<PanelPos>(() => DEFAULT_LAYOUT.pos)
  const [panelSize, setPanelSize] = useState<PanelSize>(
    () => DEFAULT_LAYOUT.size,
  )
  const panelRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef({ pos: DEFAULT_LAYOUT.pos, size: DEFAULT_LAYOUT.size })
  layoutRef.current = { pos, size: panelSize }

  const drag = useRef<{
    active: boolean
    dx: number
    dy: number
    startX: number
    startY: number
  } | null>(null)

  useLayoutEffect(() => {
    const { pos: p, size: s } = readLayoutFromLs()
    const { pos: np, size: ns } = clampPanelInViewport(p, s, MIN_W, MIN_H)
    setPos(np)
    setPanelSize(ns)
  }, [])

  useEffect(() => {
    const onResize = () => {
      const { pos: p, size: s } = layoutRef.current
      const { pos: np, size: ns } = clampPanelInViewport(p, s, MIN_W, MIN_H)
      if (
        np.x !== p.x ||
        np.y !== p.y ||
        ns.width !== s.width ||
        ns.height !== s.height
      ) {
        setPos(np)
        setPanelSize(ns)
        persistLayoutToLs(np, ns)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDownHeader = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button')) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = {
        active: true,
        dx: pos.x,
        dy: pos.y,
        startX: e.clientX,
        startY: e.clientY,
      }
    },
    [pos.x, pos.y],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d?.active) return
      const el = panelRef.current
      if (!el) return
      const nx = d.dx + (e.clientX - d.startX)
      const ny = d.dy + (e.clientY - d.startY)
      const c = clampPosToViewport(nx, ny, el.offsetWidth, el.offsetHeight)
      setPos(c)
    },
    [],
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d?.active) return
      d.active = false
      const el = panelRef.current
      const nx = d.dx + (e.clientX - d.startX)
      const ny = d.dy + (e.clientY - d.startY)
      const next = el
        ? clampPosToViewport(nx, ny, el.offsetWidth, el.offsetHeight)
        : { x: nx, y: ny }
      setPos(next)
      persistLayoutToLs(next, panelSize)
    },
    [panelSize],
  )

  return (
    <div
      ref={panelRef}
      className="floating-playlist floating-preview"
      style={{
        left: pos.x,
        top: pos.y,
        zIndex: 45,
        width: panelSize.width,
        height: panelSize.height,
      }}
    >
      <div
        className="floating-playlist-header floating-preview-header"
        onPointerDown={onPointerDownHeader}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="floating-preview-title">Anteprima (monitor 1)</span>
        <div className="floating-playlist-actions">
          <button
            type="button"
            className="btn-icon floating-preview-dock-btn"
            onClick={onDock}
            title="Riporta l'anteprima nell'area principale"
          >
            Riaggancia
          </button>
        </div>
      </div>
      <div className="floating-preview-body">
        <PreviewBlock
          className="preview-panel--floating"
          frameClassName="preview-frame--floating"
        />
      </div>
    </div>
  )
}
