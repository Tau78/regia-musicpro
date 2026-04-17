import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  applyResizeDelta,
  clampPanelInViewport,
  clampPosToViewport,
  type PanelPos,
  type ResizeEdge,
} from '../lib/floatingPanelGeometry.ts'
import {
  normalizePlaylistThemeColor,
  PLAYLIST_THEME_COLOR_INPUT_DEFAULT,
} from '../lib/playlistThemeColor.ts'
import { useRegia } from '../state/RegiaContext.tsx'
import {
  DEFAULT_FLOATING_PANEL_SIZE,
  type FloatingPlaylistPanelSize,
} from '../state/floatingPlaylistSession.ts'

function IconFolder() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
      />
    </svg>
  )
}

function IconAddFiles() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M12 8v8M8 12h8"
      />
    </svg>
  )
}

function IconSaveDisk() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 21v-8H7v8M7 3v5h8"
      />
    </svg>
  )
}

function IconNewPlaylistPanel() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="6"
        width="13"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M15 3v4M13 5h4"
      />
    </svg>
  )
}

function IconPanelCollapse() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M6 12h12"
      />
    </svg>
  )
}

function IconPanelExpand() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
    </svg>
  )
}

function IconClosePanel() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M18 6 6 18M6 6l12 12"
      />
    </svg>
  )
}

function IconPalette() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3C9 7 6 10 6 13a4 4 0 0 0 8 0c0-3-3-6-6-10z"
      />
      <circle cx="9" cy="11" r="1.25" fill="currentColor" />
      <circle cx="15" cy="11" r="1.25" fill="currentColor" />
    </svg>
  )
}

function IconCrossfade() {
  return (
    <svg
      className="floating-playlist-header-icon floating-playlist-crossfade-icon"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7c5 0 11 10 16 10" />
      <path d="M4 17c5 0 11-10 16-10" />
    </svg>
  )
}

function IconUndo() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 14 4 9l5-5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M4 9h10.5a5.5 5.5 0 0 1 0 11H5"
      />
    </svg>
  )
}

function IconRedo() {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <g transform="translate(24 0) scale(-1 1)">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 14 4 9l5-5"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          d="M4 9h10.5a5.5 5.5 0 0 1 0 11H5"
        />
      </g>
    </svg>
  )
}

function IconOutputSpeaker({ muted }: { muted: boolean }) {
  return (
    <svg
      className="floating-playlist-header-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  )
}

/** Spessore virtuale del bordo: trascinamento pannello senza maniglia dedicata. */
const PANEL_BORDER_DRAG_INSET = 10

function clientPointOnFloatingPanelBorder(
  clientX: number,
  clientY: number,
  el: HTMLElement,
  inset: number,
): boolean {
  const r = el.getBoundingClientRect()
  const x = clientX - r.left
  const y = clientY - r.top
  if (x < 0 || y < 0 || x > r.width || y > r.height) return false
  return x <= inset || y <= inset || x >= r.width - inset || y >= r.height - inset
}

function lsLayoutKey(sessionId: string): string {
  return `regia-playlist-panel-pos-${sessionId}`
}

type LayoutLs = {
  x: number
  y: number
  width?: number
  height?: number
  playlistOutputMuted?: boolean
}

const MIN_PANEL_W = 220
const MIN_PANEL_H = 180

function loadLayoutFromLs(sessionId: string): Partial<{
  pos: PanelPos
  panelSize: FloatingPlaylistPanelSize
  playlistOutputMuted: boolean
}> | null {
  try {
    const raw = localStorage.getItem(lsLayoutKey(sessionId))
    if (!raw) return null
    const p = JSON.parse(raw) as LayoutLs
    if (typeof p.x !== 'number' || typeof p.y !== 'number') return null
    const out: Partial<{
      pos: PanelPos
      panelSize: FloatingPlaylistPanelSize
      playlistOutputMuted: boolean
    }> = {
      pos: { x: p.x, y: p.y },
    }
    if (
      typeof p.width === 'number' &&
      typeof p.height === 'number' &&
      Number.isFinite(p.width) &&
      Number.isFinite(p.height)
    ) {
      out.panelSize = { width: p.width, height: p.height }
    }
    if (typeof p.playlistOutputMuted === 'boolean') {
      out.playlistOutputMuted = p.playlistOutputMuted
    }
    return out
  } catch {
    /* ignore */
  }
  return null
}

function persistLayoutToLs(
  sessionId: string,
  pos: PanelPos,
  panelSize: FloatingPlaylistPanelSize,
  playlistOutputMuted: boolean,
): void {
  try {
    localStorage.setItem(
      lsLayoutKey(sessionId),
      JSON.stringify({
        x: pos.x,
        y: pos.y,
        width: panelSize.width,
        height: panelSize.height,
        playlistOutputMuted,
      }),
    )
  } catch {
    /* ignore */
  }
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

const REORDER_LONG_PRESS_MS = 420
const REORDER_CANCEL_MOVE_PX = 12

function pickPlaylistDropIndex(
  ul: HTMLUListElement | null,
  clientX: number,
  clientY: number,
  pathCount: number,
): number {
  if (!ul || pathCount <= 0) return 0
  const nodes = ul.querySelectorAll<HTMLElement>(
    'li.floating-playlist-item[data-pl-idx]',
  )
  if (nodes.length === 0) return 0
  for (let k = 0; k < nodes.length; k++) {
    const el = nodes[k]!
    const r = el.getBoundingClientRect()
    if (
      clientY >= r.top &&
      clientY <= r.bottom &&
      clientX >= r.left &&
      clientX <= r.right
    ) {
      const raw = el.dataset.plIdx
      const n = raw != null ? parseInt(raw, 10) : NaN
      if (!Number.isNaN(n))
        return Math.max(0, Math.min(pathCount - 1, n))
    }
  }
  let best = 0
  let bestDist = Infinity
  for (let k = 0; k < nodes.length; k++) {
    const el = nodes[k]!
    const r = el.getBoundingClientRect()
    const mid = (r.top + r.bottom) / 2
    const d = Math.abs(clientY - mid)
    if (d < bestDist) {
      bestDist = d
      const raw = el.dataset.plIdx
      best = raw != null ? parseInt(raw, 10) : 0
    }
  }
  return Math.max(0, Math.min(pathCount - 1, best))
}

type ReorderSession =
  | {
      phase: 'pending'
      index: number
      startX: number
      startY: number
      pointerId: number
      timer: ReturnType<typeof setTimeout>
      li: HTMLLIElement
    }
  | {
      phase: 'dragging'
      index: number
      pointerId: number
      li: HTMLLIElement
      lastOver: number
    }

export default function FloatingPlaylist({
  sessionId,
}: {
  sessionId: string
}) {
  const {
    floatingPlaylistSessions,
    activeFloatingSessionId,
    setActiveFloatingSession,
    loadIndexAndPlay,
    openFolder,
    addMediaToPlaylist,
    removePathAt,
    reorderPaths,
    removeFloatingPlaylist,
    setPlaylistTitle,
    setPlaylistThemeColor,
    setPlaylistCrossfade,
    setPlaylistOutputMuted,
    savedPlaylistDirty,
    saveLoadedPlaylistOverwrite,
    persistSavedPlaylistAfterFloatingTitleBlur,
    addFloatingPlaylist,
    updateFloatingPlaylistChrome,
    recordUndoPoint,
    canUndo,
    canRedo,
    undo,
    redo,
    playbackLoadedTrack,
  } = useRegia()

  const session = floatingPlaylistSessions.find((s) => s.id === sessionId)
  const paths = session?.paths ?? []
  const currentIndex = session?.currentIndex ?? 0
  const playlistTitle = session?.playlistTitle ?? ''
  const playlistCrossfade = session?.playlistCrossfade ?? false
  const playlistOutputMuted = session?.playlistOutputMuted ?? false
  const collapsed = session?.collapsed ?? false
  const pos = session?.pos ?? { x: 24, y: 96 }
  const panelSize =
    session?.panelSize ?? DEFAULT_FLOATING_PANEL_SIZE

  const panelRef = useRef<HTMLDivElement>(null)
  const playlistColorInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [pendingReorderIndex, setPendingReorderIndex] = useState<number | null>(
    null,
  )
  const [isResizing, setIsResizing] = useState(false)
  const reorderSessionRef = useRef<ReorderSession | null>(null)
  const docListenersRef = useRef<{
    move: (e: globalThis.PointerEvent) => void
    up: (e: globalThis.PointerEvent) => void
  } | null>(null)
  const suppressPlaylistRowClickRef = useRef(false)
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
    startSize: FloatingPlaylistPanelSize
  } | null>(null)
  const hydratedLayoutFromLs = useRef(false)

  useLayoutEffect(() => {
    if (hydratedLayoutFromLs.current) return
    hydratedLayoutFromLs.current = true
    const fromLs = loadLayoutFromLs(sessionId)
    if (!fromLs) return
    const hasPos = Boolean(fromLs.pos)
    const hasSize = Boolean(fromLs.panelSize)
    const hasMute = typeof fromLs.playlistOutputMuted === 'boolean'
    if (!hasPos && !hasSize && !hasMute) return
    const patch: {
      pos?: PanelPos
      panelSize?: FloatingPlaylistPanelSize
      playlistOutputMuted?: boolean
    } = {}
    if (fromLs.pos) patch.pos = fromLs.pos
    if (fromLs.panelSize) patch.panelSize = fromLs.panelSize
    if (hasMute) patch.playlistOutputMuted = fromLs.playlistOutputMuted
    updateFloatingPlaylistChrome(sessionId, patch)
  }, [sessionId, updateFloatingPlaylistChrome])

  const reclampIntoView = useCallback(() => {
    const el = panelRef.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 6
    if (collapsed) {
      const w = Math.min(
        Math.max(MIN_PANEL_W, panelSize.width),
        vw - margin * 2,
      )
      const h = el?.offsetHeight ?? 88
      const x = Math.min(Math.max(margin, pos.x), vw - w - margin)
      const y = Math.min(Math.max(margin, pos.y), vh - h - margin)
      if (x !== pos.x || y !== pos.y || w !== panelSize.width)
        updateFloatingPlaylistChrome(sessionId, {
          pos: { x, y },
          panelSize: { width: w, height: panelSize.height },
        })
      return
    }
    const { pos: np, size: ns } = clampPanelInViewport(
      pos,
      panelSize,
      MIN_PANEL_W,
      MIN_PANEL_H,
    )
    if (
      np.x !== pos.x ||
      np.y !== pos.y ||
      ns.width !== panelSize.width ||
      ns.height !== panelSize.height
    )
      updateFloatingPlaylistChrome(sessionId, { pos: np, panelSize: ns })
  }, [collapsed, panelSize, pos, sessionId, updateFloatingPlaylistChrome])

  useLayoutEffect(() => {
    reclampIntoView()
  }, [collapsed, paths.length, panelSize, reclampIntoView])

  useEffect(() => {
    const onResize = () => reclampIntoView()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [reclampIntoView])

  const onPanelChromePointerDownCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const root = panelRef.current
      if (!root) return
      const t = e.target as HTMLElement | null
      if (!t || !root.contains(t)) return
      if (t.closest('.floating-playlist-resize')) return
      if (t.closest('input, textarea, button, [role="slider"]')) return

      const onBorder = clientPointOnFloatingPanelBorder(
        e.clientX,
        e.clientY,
        root,
        PANEL_BORDER_DRAG_INSET,
      )
      const onToolbar = Boolean(t.closest('.floating-playlist-toolbar'))
      if (!onBorder && !onToolbar) return

      setActiveFloatingSession(sessionId)
      root.setPointerCapture(e.pointerId)
      drag.current = {
        active: true,
        dx: pos.x,
        dy: pos.y,
        startX: e.clientX,
        startY: e.clientY,
      }
    },
    [pos.x, pos.y, sessionId, setActiveFloatingSession],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d?.active) return
      const el = panelRef.current
      if (!el) return
      const nx = d.dx + (e.clientX - d.startX)
      const ny = d.dy + (e.clientY - d.startY)
      const c = clampPosToViewport(nx, ny, el.offsetWidth, el.offsetHeight)
      updateFloatingPlaylistChrome(sessionId, { pos: c })
    },
    [sessionId, updateFloatingPlaylistChrome],
  )

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d?.active) return
      d.active = false
      const el = panelRef.current
      const nx = d.dx + (e.clientX - d.startX)
      const ny = d.dy + (e.clientY - d.startY)
      const next = el
        ? clampPosToViewport(nx, ny, el.offsetWidth, el.offsetHeight)
        : { x: nx, y: ny }
      updateFloatingPlaylistChrome(sessionId, { pos: next })
      persistLayoutToLs(sessionId, next, panelSize, playlistOutputMuted)
      try {
        panelRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [panelSize, playlistOutputMuted, sessionId, updateFloatingPlaylistChrome],
  )

  const onResizePointerDown = useCallback(
    (edge: ResizeEdge, e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setActiveFloatingSession(sessionId)
      resizeStateRef.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startPos: { ...pos },
        startSize: { ...panelSize },
      }
      setIsResizing(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [panelSize, pos, sessionId, setActiveFloatingSession],
  )

  const onResizePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rs = resizeStateRef.current
      if (!rs) return
      const dx = e.clientX - rs.startX
      const dy = e.clientY - rs.startY
      const { pos: np, size: ns } = applyResizeDelta(
        rs.edge,
        rs.startPos,
        rs.startSize,
        dx,
        dy,
        MIN_PANEL_W,
        MIN_PANEL_H,
      )
      updateFloatingPlaylistChrome(sessionId, { pos: np, panelSize: ns })
    },
    [sessionId, updateFloatingPlaylistChrome],
  )

  const onResizePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rs = resizeStateRef.current
      if (!rs) return
      const dx = e.clientX - rs.startX
      const dy = e.clientY - rs.startY
      const { pos: np, size: ns } = applyResizeDelta(
        rs.edge,
        rs.startPos,
        rs.startSize,
        dx,
        dy,
        MIN_PANEL_W,
        MIN_PANEL_H,
      )
      updateFloatingPlaylistChrome(sessionId, { pos: np, panelSize: ns })
      persistLayoutToLs(sessionId, np, ns, playlistOutputMuted)
      resizeStateRef.current = null
      setIsResizing(false)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [playlistOutputMuted, sessionId, updateFloatingPlaylistChrome],
  )

  const onTogglePlaylistOutputMute = useCallback(() => {
    const next = !playlistOutputMuted
    setPlaylistOutputMuted(next, sessionId)
    persistLayoutToLs(sessionId, pos, panelSize, next)
  }, [
    panelSize,
    playlistOutputMuted,
    pos,
    sessionId,
    setPlaylistOutputMuted,
  ])

  const removeReorderDocListeners = useCallback(() => {
    const l = docListenersRef.current
    if (!l) return
    document.removeEventListener('pointermove', l.move, true)
    document.removeEventListener('pointerup', l.up, true)
    document.removeEventListener('pointercancel', l.up, true)
    docListenersRef.current = null
  }, [])

  const clearDragUi = useCallback(() => {
    const s = reorderSessionRef.current
    if (s?.phase === 'pending') clearTimeout(s.timer)
    reorderSessionRef.current = null
    removeReorderDocListeners()
    setPendingReorderIndex(null)
    setDragOverIndex(null)
    setDraggingIndex(null)
  }, [removeReorderDocListeners])

  const clearDragUiRef = useRef(clearDragUi)
  clearDragUiRef.current = clearDragUi
  useEffect(
    () => () => {
      clearDragUiRef.current()
    },
    [],
  )

  const onRowPointerDownCapture = useCallback(
    (index: number, e: PointerEvent<HTMLLIElement>) => {
      if (e.button !== 0) return
      const li = e.currentTarget
      if ((e.target as HTMLElement).closest('.playlist-remove-btn')) return
      if (reorderSessionRef.current) return

      const len = paths.length
      if (len === 0) return

      setActiveFloatingSession(sessionId)

      const startX = e.clientX
      const startY = e.clientY
      const pointerId = e.pointerId

      const onMove = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const s = reorderSessionRef.current
        if (!s) return
        if (s.phase === 'pending') {
          const dx = ev.clientX - s.startX
          const dy = ev.clientY - s.startY
          if (
            dx * dx + dy * dy >
            REORDER_CANCEL_MOVE_PX * REORDER_CANCEL_MOVE_PX
          ) {
            clearTimeout(s.timer)
            reorderSessionRef.current = null
            setPendingReorderIndex(null)
            removeReorderDocListeners()
          }
        } else if (s.phase === 'dragging') {
          const to = pickPlaylistDropIndex(
            listRef.current,
            ev.clientX,
            ev.clientY,
            len,
          )
          reorderSessionRef.current = { ...s, lastOver: to }
          setDragOverIndex(to)
        }
      }

      const onUp = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const s = reorderSessionRef.current
        if (!s) return
        if (s.phase === 'pending') {
          clearTimeout(s.timer)
          reorderSessionRef.current = null
          setPendingReorderIndex(null)
          removeReorderDocListeners()
          return
        }
        try {
          s.li.releasePointerCapture(pointerId)
        } catch {
          /* ignore */
        }
        const from = s.index
        const to = s.lastOver
        suppressPlaylistRowClickRef.current = true
        window.setTimeout(() => {
          suppressPlaylistRowClickRef.current = false
        }, 80)
        reorderSessionRef.current = null
        removeReorderDocListeners()
        setDragOverIndex(null)
        setDraggingIndex(null)
        reorderPaths(from, to, sessionId)
      }

      const timer = window.setTimeout(() => {
        const sess = reorderSessionRef.current
        if (!sess || sess.phase !== 'pending' || sess.pointerId !== pointerId)
          return
        try {
          sess.li.setPointerCapture(pointerId)
        } catch {
          /* ignore */
        }
        const initialTo = pickPlaylistDropIndex(
          listRef.current,
          startX,
          startY,
          len,
        )
        reorderSessionRef.current = {
          phase: 'dragging',
          index,
          pointerId,
          li: sess.li,
          lastOver: initialTo,
        }
        setPendingReorderIndex(null)
        setDraggingIndex(index)
        setDragOverIndex(initialTo)
      }, REORDER_LONG_PRESS_MS)

      reorderSessionRef.current = {
        phase: 'pending',
        index,
        startX,
        startY,
        pointerId,
        timer,
        li,
      }
      setPendingReorderIndex(index)

      docListenersRef.current = { move: onMove, up: onUp }
      document.addEventListener('pointermove', onMove, true)
      document.addEventListener('pointerup', onUp, true)
      document.addEventListener('pointercancel', onUp, true)
    },
    [
      paths.length,
      removeReorderDocListeners,
      reorderPaths,
      sessionId,
      setActiveFloatingSession,
    ],
  )

  const commitFloatingPlaylistTitle = useCallback(
    async (raw: string) => {
      const t = raw.trim().slice(0, 120)
      if (t !== playlistTitle.trim()) {
        recordUndoPoint()
        setPlaylistTitle(t, sessionId)
      }
      await persistSavedPlaylistAfterFloatingTitleBlur(t, sessionId)
    },
    [
      persistSavedPlaylistAfterFloatingTitleBlur,
      playlistTitle,
      recordUndoPoint,
      sessionId,
      setPlaylistTitle,
    ],
  )

  const onTitleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const el = e.currentTarget
      void (async () => {
        await commitFloatingPlaylistTitle(el.value)
        el.blur()
      })()
    },
    [commitFloatingPlaylistTitle],
  )

  const onPanelKeyDownCapture = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (collapsed || !paths.length) return
      const root = panelRef.current
      if (!root?.contains(e.target as Node)) return
      const listEl = root.querySelector('ul.floating-playlist-list')
      if (!(e.target instanceof Node) || !listEl?.contains(e.target)) return
      if (e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      if (
        e.code === 'ArrowDown' ||
        e.code === 'ArrowRight' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowLeft'
      ) {
        e.preventDefault()
        e.stopPropagation()
        const down = e.code === 'ArrowDown' || e.code === 'ArrowRight'
        const next = down
          ? Math.min(currentIndex + 1, paths.length - 1)
          : Math.max(currentIndex - 1, 0)
        void loadIndexAndPlay(next, sessionId)
      }
    },
    [collapsed, paths.length, currentIndex, loadIndexAndPlay, sessionId],
  )

  if (!session) return null

  const themeHex = normalizePlaylistThemeColor(session.playlistThemeColor)
  const colorPickerValue =
    themeHex || PLAYLIST_THEME_COLOR_INPUT_DEFAULT

  const zIndex = 40 + (activeFloatingSessionId === sessionId ? 10 : 0)

  const resizeEdges: readonly ResizeEdge[] = collapsed
    ? (['e'] as const)
    : (['n', 's', 'ne', 'nw', 'se', 'sw'] as const)

  return (
    <div
      ref={panelRef}
      className={`floating-playlist ${collapsed ? 'is-collapsed' : ''} ${isResizing ? 'is-panel-resizing' : ''} ${themeHex ? 'has-theme' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex,
        width: panelSize.width,
        height: collapsed ? undefined : panelSize.height,
        ...(themeHex ? { ['--playlist-theme' as string]: themeHex } : {}),
      }}
      onKeyDownCapture={onPanelKeyDownCapture}
      onPointerDownCapture={onPanelChromePointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <input
        ref={playlistColorInputRef}
        type="color"
        className="floating-playlist-color-input"
        value={colorPickerValue}
        aria-hidden
        tabIndex={-1}
        onChange={(ev) =>
          setPlaylistThemeColor(ev.target.value, sessionId)
        }
      />
      <div className="floating-playlist-top">
        <div className="floating-playlist-title-strip">
          <input
            type="text"
            className="floating-playlist-title-input"
            value={playlistTitle}
            onChange={(ev) => setPlaylistTitle(ev.target.value, sessionId)}
            onKeyDown={onTitleKeyDown}
            onBlur={(e) => void commitFloatingPlaylistTitle(e.currentTarget.value)}
            placeholder="Nuova Playlist"
            aria-label="Nome della playlist"
            maxLength={120}
            spellCheck={false}
          />
        </div>
        <div className="floating-playlist-toolbar">
          <div className="floating-playlist-actions">
          <div className="floating-playlist-actions-main">
            <button
              type="button"
              className="btn-icon floating-playlist-icon-btn"
              onClick={() => void openFolder(sessionId)}
              title="Apri cartella"
              aria-label="Apri cartella"
            >
              <IconFolder />
            </button>
            <button
              type="button"
              className="btn-icon floating-playlist-icon-btn"
              onClick={() => void addMediaToPlaylist(sessionId)}
              title="Aggiungi file alla playlist"
              aria-label="Aggiungi file alla playlist"
            >
              <IconAddFiles />
            </button>
            <button
              type="button"
              className="btn-icon floating-playlist-icon-btn"
              onClick={() => addFloatingPlaylist()}
              title="Nuovo pannello playlist"
              aria-label="Nuovo pannello playlist"
            >
              <IconNewPlaylistPanel />
            </button>
            <button
              type="button"
              className="btn-icon floating-playlist-icon-btn floating-playlist-theme-picker-btn"
              onClick={(ev) => {
                if (ev.altKey) {
                  ev.preventDefault()
                  setPlaylistThemeColor(null, sessionId)
                  return
                }
                playlistColorInputRef.current?.click()
              }}
              title="Colore tema playlist (Alt+clic: predefinito)"
              aria-label="Scegli colore tema playlist. Alt e clic per tema predefinito."
            >
              <IconPalette />
            </button>
            {savedPlaylistDirty(sessionId) ? (
              <button
                type="button"
                className="btn-icon floating-playlist-icon-btn floating-playlist-save-overwrite"
                onClick={() => void saveLoadedPlaylistOverwrite(sessionId)}
                title="Sovrascrive la playlist salvata che hai aperto con Carica"
                aria-label="Salva sovrascrivendo la playlist caricata"
              >
                <IconSaveDisk />
              </button>
            ) : null}
          </div>
          <div
            className="floating-playlist-actions-undo"
            role="group"
            aria-label="Annulla e ripristina"
          >
            <button
              type="button"
              className="btn-icon floating-playlist-icon-btn"
              disabled={!canUndo}
              onClick={() => {
                setActiveFloatingSession(sessionId)
                undo()
              }}
              title="Annulla (⌘Z / Ctrl+Z)"
              aria-label="Annulla"
            >
              <IconUndo />
            </button>
            <button
              type="button"
              className="btn-icon floating-playlist-icon-btn"
              disabled={!canRedo}
              onClick={() => {
                setActiveFloatingSession(sessionId)
                redo()
              }}
              title="Ripristina (⌘⇧Z / Ctrl+⇧Z)"
              aria-label="Ripristina"
            >
              <IconRedo />
            </button>
          </div>
          <div
            className="floating-playlist-actions-chrome"
            role="group"
            aria-label="Comprimi o chiudi pannello"
          >
            <button
              type="button"
              className="btn-icon floating-playlist-icon-btn"
              onClick={() =>
                updateFloatingPlaylistChrome(sessionId, {
                  collapsed: !collapsed,
                })
              }
              title={collapsed ? 'Espandi' : 'Comprimi'}
              aria-label={collapsed ? 'Espandi pannello' : 'Comprimi pannello'}
            >
              {collapsed ? <IconPanelExpand /> : <IconPanelCollapse />}
            </button>
            <button
              type="button"
              className="btn-icon floating-playlist-icon-btn floating-playlist-close"
              onClick={() => removeFloatingPlaylist(sessionId)}
              title="Chiudi questo pannello playlist"
              aria-label="Chiudi pannello playlist mobile"
            >
              <IconClosePanel />
            </button>
          </div>
          </div>
        </div>
      </div>
      {!collapsed && (
        <div className="floating-playlist-crossfade">
          <div className="floating-playlist-crossfade-row">
            <label
              className="floating-playlist-crossfade-label"
              title="Crossfade tra brani: dissolvenza incrociata in uscita tra due brani dello stesso tipo (solo video/video o immagine/immagine)."
            >
              <input
                type="checkbox"
                checked={playlistCrossfade}
                onChange={(ev) =>
                  setPlaylistCrossfade(ev.target.checked, sessionId)
                }
                aria-label="Crossfade tra brani"
              />
              <IconCrossfade />
            </label>
            <button
              type="button"
              className={`btn-toggle floating-playlist-icon-btn floating-playlist-mute-output ${playlistOutputMuted ? 'is-on' : ''}`}
              onClick={onTogglePlaylistOutputMute}
              aria-pressed={playlistOutputMuted}
              title="Silenzia solo l'uscita sul secondo schermo per i brani avviati da questa playlist (si somma al Mute globale in alto). Valore salvato per questo pannello."
              aria-label={
                playlistOutputMuted
                  ? 'Mute uscita attivo per questo pannello: clic per disattivare'
                  : 'Silenzia uscita sul secondo schermo per questo pannello'
              }
            >
              <IconOutputSpeaker muted={playlistOutputMuted} />
            </button>
          </div>
          <span className="floating-playlist-crossfade-hint">
            Solo tra video/video o immagine/immagine
          </span>
        </div>
      )}
      {!collapsed && (
        <ul
          ref={listRef}
          className={`floating-playlist-list ${draggingIndex != null ? 'is-reordering' : ''}`}
          tabIndex={0}
          aria-label="Elenco brani"
        >
          {draggingIndex != null ? (
            <li className="playlist-drag-status" aria-live="polite">
              {dragOverIndex != null && dragOverIndex !== draggingIndex ? (
                <>
                  Inserisci <strong>prima della posizione {dragOverIndex + 1}</strong>{' '}
                  (rilascia)
                </>
              ) : dragOverIndex != null && dragOverIndex === draggingIndex ? (
                <>Rilasciando qui non cambia l&apos;ordine.</>
              ) : (
                <>
                  Tieni premuto su una riga, poi trascina per inserire il brano nella
                  posizione evidenziata.
                </>
              )}
            </li>
          ) : null}
          {paths.length === 0 && (
            <li className="floating-playlist-empty">
              Nessun file. Apri una cartella o usa Aggiungi.
            </li>
          )}
          {paths.map((p, i) => {
            const name = p.split(/[/\\]/).pop() ?? p
            return (
              <li
                key={`${sessionId}-${i}-${p}`}
                data-pl-idx={i}
                className={`floating-playlist-item ${dragOverIndex === i ? 'is-drag-over' : ''} ${draggingIndex === i ? 'is-dragging-source' : ''} ${pendingReorderIndex === i && draggingIndex == null ? 'is-reorder-pending' : ''}`}
                onPointerDownCapture={(e) => onRowPointerDownCapture(i, e)}
              >
                <button
                  type="button"
                  className={`playlist-row ${
                    playbackLoadedTrack != null &&
                    playbackLoadedTrack.sessionId === sessionId &&
                    playbackLoadedTrack.index === i
                      ? 'is-current'
                      : ''
                  }`}
                  onClick={() => {
                    if (suppressPlaylistRowClickRef.current) {
                      suppressPlaylistRowClickRef.current = false
                      return
                    }
                    void loadIndexAndPlay(i, sessionId)
                  }}
                  title={`${p} — clic per riprodurre; tieni premuto sulla riga per riordinare; frecce sulla lista`}
                >
                  <span className="playlist-index">{i + 1}</span>
                  <span className="playlist-name">{name}</span>
                </button>
                <button
                  type="button"
                  className="playlist-remove-btn"
                  title="Rimuovi dalla playlist"
                  aria-label={`Rimuovi ${name} dalla playlist`}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    void removePathAt(i, sessionId)
                  }}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {resizeEdges.map((edge) => (
        <div
          key={edge}
          role="presentation"
          aria-label={`Ridimensiona (${edge})`}
          className={`floating-playlist-resize floating-playlist-resize--${edge}`}
          onPointerDown={(e) => onResizePointerDown(edge, e)}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
      ))}
    </div>
  )
}
