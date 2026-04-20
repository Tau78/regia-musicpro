import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  defaultLogicClockSize,
  persistLogicClockFloatLayout,
  readLogicClockFloatLayout,
  type ClockOpacityStep,
} from '../lib/logicClockFloatStorage.ts'

const OPACITY_LEVELS = [0.25, 0.5, 0.75, 1] as const
const DRAG_CLICK_SLOP_PX = 6

function IconClock() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  )
}

function formatHms(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const CLOCK_MIN_W = 168
const CLOCK_MIN_H = 40

function maxClockW() {
  return Math.min(720, window.innerWidth - 16)
}

function maxClockH() {
  return Math.min(480, window.innerHeight - 16)
}

function clampClockPos(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(8, window.innerWidth - w - 8)
  const maxY = Math.max(8, window.innerHeight - h - 8)
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  }
}

function clampClockSize(w: number, h: number) {
  return {
    w: Math.min(maxClockW(), Math.max(CLOCK_MIN_W, w)),
    h: Math.min(maxClockH(), Math.max(CLOCK_MIN_H, h)),
  }
}

type Corner = 'nw' | 'ne' | 'sw' | 'se'

/** Allineato a `.logic-clock-digits` in CSS (misura canvas ≈ DOM). */
const CLOCK_DIGITS_FONT_STACK =
  'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Monaco, Consolas, monospace'

function measureClockTextBlock(
  ctx: CanvasRenderingContext2D,
  fontSizePx: number,
  text: string,
): { w: number; h: number } {
  ctx.font = `600 ${fontSizePx}px ${CLOCK_DIGITS_FONT_STACK}`
  const m = ctx.measureText(text)
  const w = m.width
  const ascent = m.actualBoundingBoxAscent ?? fontSizePx * 0.72
  const descent = m.actualBoundingBoxDescent ?? fontSizePx * 0.28
  return { w, h: ascent + descent }
}

/** Massima `font-size` (px) affinché `text` stia in maxW × maxH. */
function maxFontSizeForClockText(
  text: string,
  maxW: number,
  maxH: number,
): number {
  if (maxW < 6 || maxH < 6) return 10
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 16
  const pad = 1
  const mw = maxW - pad * 2
  const mh = maxH - pad * 2
  if (mw < 4 || mh < 4) return 10
  let lo = 6
  let hi = Math.min(mw * 4, mh * 14, 4000)
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2
    const { w, h } = measureClockTextBlock(ctx, mid, text)
    if (w <= mw && h <= mh) lo = mid
    else hi = mid
  }
  return Math.max(8, Math.floor(lo))
}

function applyCornerResize(
  corner: Corner,
  orig: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
): { x: number; y: number; w: number; h: number } {
  const { x: ox, y: oy, w: ow, h: oh } = orig
  let w = ow
  let h = oh
  switch (corner) {
    case 'se':
      w = ow + dx
      h = oh + dy
      break
    case 'ne':
      w = ow + dx
      h = oh - dy
      break
    case 'sw':
      w = ow - dx
      h = oh + dy
      break
    case 'nw':
      w = ow - dx
      h = oh - dy
      break
  }
  const { w: cw, h: ch } = clampClockSize(w, h)
  switch (corner) {
    case 'se':
      return { x: ox, y: oy, w: cw, h: ch }
    case 'ne':
      return { x: ox, y: oy + oh - ch, w: cw, h: ch }
    case 'sw':
      return { x: ox + ow - cw, y: oy, w: cw, h: ch }
    case 'nw':
      return { x: ox + ow - cw, y: oy + oh - ch, w: cw, h: ch }
  }
}

/** Orologio digitale flottante (HH:MM:SS), trascinabile, ridimensionabile agli angoli. */
export default function LogicClockStrip() {
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const initialSaved = useMemo(() => readLogicClockFloatLayout(), [])
  const shouldAnchorFromButtonOnce = useRef(!initialSaved)

  const [open, setOpen] = useState(false)
  const [time, setTime] = useState(() => formatHms(new Date()))
  const [floatPos, setFloatPos] = useState<{ x: number; y: number }>(() => {
    if (initialSaved) return { x: initialSaved.x, y: initialSaved.y }
    return { x: 48, y: 100 }
  })
  const [panelSize, setPanelSize] = useState(() => {
    const d = defaultLogicClockSize()
    return {
      width: initialSaved?.width ?? d.width,
      height: initialSaved?.height ?? d.height,
    }
  })
  const [opacityStep, setOpacityStep] = useState<ClockOpacityStep>(
    () => initialSaved?.opacityStep ?? 3,
  )
  const [digitsFontPx, setDigitsFontPx] = useState(32)

  const moveRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    origX: number
    origY: number
    dragging: boolean
  } | null>(null)

  const resizeRef = useRef<{
    pointerId: number
    corner: Corner
    startClientX: number
    startClientY: number
    origX: number
    origY: number
    origW: number
    origH: number
  } | null>(null)

  const clampPanelToViewport = useCallback(() => {
    const w = panelSize.width
    const h = panelSize.height
    setFloatPos((p) => clampClockPos(p.x, p.y, w, h))
  }, [panelSize.width, panelSize.height])

  useLayoutEffect(() => {
    if (!open || !shouldAnchorFromButtonOnce.current) return
    const btn = btnRef.current
    const panel = panelRef.current
    if (!btn || !panel) return
    const w = panelSize.width
    const h = panelSize.height
    const r = btn.getBoundingClientRect()
    setFloatPos(clampClockPos(r.left, r.bottom + 6, w, h))
    shouldAnchorFromButtonOnce.current = false
  }, [open, panelSize.width, panelSize.height])

  useEffect(() => {
    if (!open) return
    clampPanelToViewport()
  }, [open, clampPanelToViewport])

  useEffect(() => {
    window.addEventListener('resize', clampPanelToViewport)
    return () => window.removeEventListener('resize', clampPanelToViewport)
  }, [clampPanelToViewport])

  useEffect(() => {
    persistLogicClockFloatLayout({
      x: floatPos.x,
      y: floatPos.y,
      width: panelSize.width,
      height: panelSize.height,
      opacityStep,
    })
  }, [floatPos.x, floatPos.y, panelSize.width, panelSize.height, opacityStep])

  useEffect(() => {
    if (!open) return
    const tick = () => setTime(formatHms(new Date()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [open])

  const remeasureClockDigits = useCallback(() => {
    const el = bodyRef.current
    if (!el || !open) return
    const w = el.clientWidth
    const h = el.clientHeight
    if (w < 8 || h < 8) return
    const next = maxFontSizeForClockText(time, w, h)
    setDigitsFontPx((prev) => (Math.abs(prev - next) < 1 ? prev : next))
  }, [open, time])

  useLayoutEffect(() => {
    if (!open) return
    remeasureClockDigits()
    const id = requestAnimationFrame(() => remeasureClockDigits())
    const el = bodyRef.current
    if (!el || typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(id)
    }
    const ro = new ResizeObserver(() => remeasureClockDigits())
    ro.observe(el)
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
    }
  }, [open, remeasureClockDigits, panelSize.width, panelSize.height])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const onDragPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const t = e.target
      if (
        t instanceof Element &&
        t.closest('.logic-clock-resize-handle')
      ) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      moveRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origX: floatPos.x,
        origY: floatPos.y,
        dragging: false,
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [floatPos.x, floatPos.y],
  )

  const onDragPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = moveRef.current
      if (!d || e.pointerId !== d.pointerId) return
      e.stopPropagation()
      const dx = e.clientX - d.startClientX
      const dy = e.clientY - d.startClientY
      if (!d.dragging) {
        if (Math.hypot(dx, dy) < DRAG_CLICK_SLOP_PX) return
        d.dragging = true
      }
      const w = panelSize.width
      const h = panelSize.height
      const nx = d.origX + dx
      const ny = d.origY + dy
      setFloatPos(clampClockPos(nx, ny, w, h))
    },
    [panelSize.width, panelSize.height],
  )

  const onDragPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = moveRef.current
    if (!d || e.pointerId !== d.pointerId) return
    e.stopPropagation()
    const dist = Math.hypot(
      e.clientX - d.startClientX,
      e.clientY - d.startClientY,
    )
    const isClick = !d.dragging && dist < DRAG_CLICK_SLOP_PX
    if (isClick) {
      setOpacityStep(
        (s) => ((s + 1) % OPACITY_LEVELS.length) as ClockOpacityStep,
      )
    }
    moveRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onResizePointerDown = useCallback(
    (corner: Corner) => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = {
        pointerId: e.pointerId,
        corner,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origX: floatPos.x,
        origY: floatPos.y,
        origW: panelSize.width,
        origH: panelSize.height,
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [floatPos.x, floatPos.y, panelSize.width, panelSize.height],
  )

  const onResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const r = resizeRef.current
      if (!r || e.pointerId !== r.pointerId) return
      e.stopPropagation()
      const dx = e.clientX - r.startClientX
      const dy = e.clientY - r.startClientY
      const next = applyCornerResize(
        r.corner,
        { x: r.origX, y: r.origY, w: r.origW, h: r.origH },
        dx,
        dy,
      )
      setPanelSize({ width: next.w, height: next.h })
      setFloatPos(clampClockPos(next.x, next.y, next.w, next.h))
    },
    [],
  )

  const onResizePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current
    if (!r || e.pointerId !== r.pointerId) return
    e.stopPropagation()
    resizeRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const panelOpacity = OPACITY_LEVELS[opacityStep]

  const panelStyle: CSSProperties = {
    position: 'fixed',
    top: floatPos.y,
    left: floatPos.x,
    width: panelSize.width,
    height: panelSize.height,
    zIndex: 220,
    opacity: panelOpacity,
  }

  const popover =
    open ?
      createPortal(
        <div
          ref={panelRef}
          className="logic-clock-float"
          data-no-drag
          style={panelStyle}
          role="dialog"
          aria-label={`Orologio digitale, opacità ${Math.round(panelOpacity * 100)}%`}
          title="Trascina per spostare · clic per opacità (25% · 50% · 75% · 100%)"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <div
            ref={bodyRef}
            className="logic-clock-body"
            role="status"
            aria-live="polite"
          >
            <span
              className="logic-clock-digits"
              style={{ fontSize: `${digitsFontPx}px` }}
            >
              {time}
            </span>
          </div>
          {(
            [
              ['nw', 'nw-resize'],
              ['ne', 'ne-resize'],
              ['sw', 'sw-resize'],
              ['se', 'se-resize'],
            ] as const
          ).map(([corner, cursor]) => (
            <div
              key={corner}
              className={`logic-clock-resize-handle logic-clock-resize-handle--${corner}`}
              style={{ cursor }}
              onPointerDown={onResizePointerDown(corner)}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
              onPointerCancel={onResizePointerUp}
              title="Trascina per ridimensionare"
              role="presentation"
            />
          ))}
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div
        className="logic-transport-well"
        data-no-drag
        role="group"
        aria-label="Orologio"
      >
        <button
          ref={btnRef}
          type="button"
          className={`logic-tbtn logic-tbtn--icon ${open ? 'is-clock-toggle-on' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-pressed={open}
          title={
            open
              ? 'Chiudi orologio flottante'
              : 'Apri orologio flottante (trascina; clic per opacità; angoli per ridimensionare)'
          }
          aria-label={
            open ? 'Chiudi orologio flottante' : 'Apri orologio flottante'
          }
        >
          <IconClock />
        </button>
      </div>
      {popover}
    </>
  )
}
