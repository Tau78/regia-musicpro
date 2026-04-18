import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  applyResizeDelta,
  clampPanelInViewport,
  clampPosToViewport,
  hitTestPanelResizeEdge,
  type PanelPos,
  type PanelSize,
  type ResizeEdge,
} from '../lib/floatingPanelGeometry.ts'
import {
  buildPeerDimensionTargets,
  queryPlanciaContentRect,
  snapFloatingPanelDragPos,
  snapFloatingPanelResize,
  type PeerSnapRect,
} from '../lib/planciaSnap.ts'
import { usePlanciaSnapEnabled } from '../lib/planciaSnapSettings.ts'
import {
  REGIA_FLOATING_PREVIEW_ZORDER_KEY,
  useRegia,
} from '../state/RegiaContext.tsx'
import {
  PREVIEW_LAYOUT_APPLIED_EVENT,
  readPreviewLayoutFromLs,
  writePreviewLayoutToLs,
} from '../lib/previewLayoutStorage.ts'
import PreviewBlock from './PreviewBlock.tsx'

const MIN_W = 280
const MIN_H = 240
const MAX_W = 960
const MAX_H = 780
const PREVIEW_CLAMP_OPTS = { maxW: MAX_W, maxH: MAX_H } as const
const COLLAPSED_FLOAT_PANEL_H_PX = 84

const DEFAULT_LAYOUT: { pos: PanelPos; size: PanelSize } = {
  pos: { x: 72, y: 80 },
  size: { width: 520, height: 420 },
}

function readLayoutFromLs(): { pos: PanelPos; size: PanelSize } {
  const L = readPreviewLayoutFromLs()
  const pos: PanelPos = { x: L.x, y: L.y }
  const size: PanelSize = { width: L.width, height: L.height }
  const { pos: np, size: ns } = clampPanelInViewport(
    pos,
    size,
    MIN_W,
    MIN_H,
    PREVIEW_CLAMP_OPTS,
  )
  return { pos: np, size: ns }
}

function persistLayoutToLs(pos: PanelPos, size: PanelSize): void {
  writePreviewLayoutToLs({
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
  })
}

export default function FloatingPreview({ onDock }: { onDock: () => void }) {
  const {
    floatingPlaylistSessions,
    floatingZOrder,
    bringFloatingPanelToFront,
  } = useRegia()
  const snapEnabled = usePlanciaSnapEnabled()
  const dragSnapPeerRects = useMemo((): PeerSnapRect[] => {
    return floatingPlaylistSessions.map((s) => {
      const h = s.collapsed ? COLLAPSED_FLOAT_PANEL_H_PX : s.panelSize.height
      return {
        left: s.pos.x,
        top: s.pos.y,
        right: s.pos.x + s.panelSize.width,
        bottom: s.pos.y + h,
      }
    })
  }, [floatingPlaylistSessions])

  const [pos, setPos] = useState<PanelPos>(() => DEFAULT_LAYOUT.pos)
  const [panelSize, setPanelSize] = useState<PanelSize>(
    () => DEFAULT_LAYOUT.size,
  )
  const [isResizing, setIsResizing] = useState(false)
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
  const resizeStateRef = useRef<{
    edge: ResizeEdge
    startX: number
    startY: number
    startPos: PanelPos
    startSize: PanelSize
  } | null>(null)

  useLayoutEffect(() => {
    const { pos: p, size: s } = readLayoutFromLs()
    const { pos: np, size: ns } = clampPanelInViewport(
      p,
      s,
      MIN_W,
      MIN_H,
      PREVIEW_CLAMP_OPTS,
    )
    setPos(np)
    setPanelSize(ns)
  }, [])

  useEffect(() => {
    const onApplied = () => {
      const { pos: p, size: s } = readLayoutFromLs()
      const { pos: np, size: ns } = clampPanelInViewport(
        p,
        s,
        MIN_W,
        MIN_H,
        PREVIEW_CLAMP_OPTS,
      )
      setPos(np)
      setPanelSize(ns)
    }
    window.addEventListener(PREVIEW_LAYOUT_APPLIED_EVENT, onApplied)
    return () => window.removeEventListener(PREVIEW_LAYOUT_APPLIED_EVENT, onApplied)
  }, [])

  useEffect(() => {
    const onResize = () => {
      const { pos: p, size: s } = layoutRef.current
      const { pos: np, size: ns } = clampPanelInViewport(
        p,
        s,
        MIN_W,
        MIN_H,
        PREVIEW_CLAMP_OPTS,
      )
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

  const resizePreviewWithSnap = useCallback(
    (
      edge: ResizeEdge,
      startPos: PanelPos,
      startSize: PanelSize,
      dx: number,
      dy: number,
    ) => {
      const raw = applyResizeDelta(
        edge,
        startPos,
        startSize,
        dx,
        dy,
        MIN_W,
        MIN_H,
        PREVIEW_CLAMP_OPTS,
      )
      if (!snapEnabled) return raw
      const sessionsMeta = floatingPlaylistSessions.map((s) => ({
        id: s.id,
        width: s.panelSize.width,
        height: s.panelSize.height,
      }))
      const { widths, heights } = buildPeerDimensionTargets(
        sessionsMeta,
        undefined,
        null,
        MIN_W,
        MIN_H,
      )
      const sn = snapFloatingPanelResize(edge, raw.pos, raw.size, {
        plancia: queryPlanciaContentRect(),
        peerWidths: widths,
        peerHeights: heights,
        minW: MIN_W,
        minH: MIN_H,
      })
      return clampPanelInViewport(
        sn.pos,
        sn.size,
        MIN_W,
        MIN_H,
        PREVIEW_CLAMP_OPTS,
      )
    },
    [floatingPlaylistSessions, snapEnabled],
  )

  const onPanelPointerDownCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const root = panelRef.current
      if (!root) return

      bringFloatingPanelToFront(REGIA_FLOATING_PREVIEW_ZORDER_KEY)

      const rect = root.getBoundingClientRect()
      const resizeEdge = hitTestPanelResizeEdge(
        e.clientX,
        e.clientY,
        rect,
        false,
      )
      if (!resizeEdge) return
      e.preventDefault()
      resizeStateRef.current = {
        edge: resizeEdge,
        startX: e.clientX,
        startY: e.clientY,
        startPos: { ...pos },
        startSize: { ...panelSize },
      }
      setIsResizing(true)
      try {
        root.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [bringFloatingPanelToFront, panelSize.height, panelSize.width, pos.x, pos.y],
  )

  const onPanelPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rs = resizeStateRef.current
      if (!rs) return
      const dx = e.clientX - rs.startX
      const dy = e.clientY - rs.startY
      const { pos: np, size: ns } = resizePreviewWithSnap(
        rs.edge,
        rs.startPos,
        rs.startSize,
        dx,
        dy,
      )
      setPos(np)
      setPanelSize(ns)
    },
    [resizePreviewWithSnap],
  )

  const onPanelPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rs = resizeStateRef.current
      if (!rs) return
      const dx = e.clientX - rs.startX
      const dy = e.clientY - rs.startY
      const { pos: np, size: ns } = resizePreviewWithSnap(
        rs.edge,
        rs.startPos,
        rs.startSize,
        dx,
        dy,
      )
      setPos(np)
      setPanelSize(ns)
      persistLayoutToLs(np, ns)
      resizeStateRef.current = null
      setIsResizing(false)
      try {
        panelRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [resizePreviewWithSnap],
  )

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
      const plancia = snapEnabled ? queryPlanciaContentRect() : null
      let c = clampPosToViewport(nx, ny, el.offsetWidth, el.offsetHeight)
      if (snapEnabled && plancia) {
        const snapped = snapFloatingPanelDragPos(
          c,
          { width: el.offsetWidth, height: el.offsetHeight },
          plancia,
          dragSnapPeerRects,
        )
        c = clampPosToViewport(
          snapped.x,
          snapped.y,
          el.offsetWidth,
          el.offsetHeight,
        )
      }
      setPos(c)
    },
    [dragSnapPeerRects, snapEnabled],
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d?.active) return
      d.active = false
      const el = panelRef.current
      const nx = d.dx + (e.clientX - d.startX)
      const ny = d.dy + (e.clientY - d.startY)
      const plancia = snapEnabled ? queryPlanciaContentRect() : null
      let next = el
        ? clampPosToViewport(nx, ny, el.offsetWidth, el.offsetHeight)
        : { x: nx, y: ny }
      if (el && snapEnabled && plancia) {
        const snapped = snapFloatingPanelDragPos(
          next,
          { width: el.offsetWidth, height: el.offsetHeight },
          plancia,
          dragSnapPeerRects,
        )
        next = clampPosToViewport(
          snapped.x,
          snapped.y,
          el.offsetWidth,
          el.offsetHeight,
        )
      }
      setPos(next)
      persistLayoutToLs(next, panelSize)
    },
    [dragSnapPeerRects, panelSize, snapEnabled],
  )

  const previewZi = floatingZOrder.indexOf(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
  const previewZIndex = 40 + (previewZi >= 0 ? previewZi : 0)

  return (
    <div
      ref={panelRef}
      className={`floating-playlist floating-preview ${isResizing ? 'is-panel-resizing' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex: previewZIndex,
        width: panelSize.width,
        height: panelSize.height,
      }}
      onPointerDownCapture={onPanelPointerDownCapture}
      onPointerMove={onPanelPointerMove}
      onPointerUp={onPanelPointerUp}
      onPointerCancel={onPanelPointerUp}
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
