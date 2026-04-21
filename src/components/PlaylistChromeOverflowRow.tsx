import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'

/** Larghezza riservata per il pulsante «altri comandi» (chevron). */
const CHEVRON_RESERVE_PX = 34

function IconChevronDownRibbon() {
  return (
    <svg
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
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

type Props = {
  /** Ogni figlio diretto deve avere `key` stabile (es. `<Fragment key="…">`). */
  children: React.ReactNode
  /** Colonna destra fissa (es. volume); layout riga crossfade. */
  trailing?: React.ReactNode
  /** Classi sul contenitore esterno. */
  className?: string
  /** z-index base pannello per il menu a tendina. */
  zIndexBase?: number
  /** Avvolge il menu in portal (es. `floating-playlist has-theme` + `--playlist-theme`). */
  menuAppearanceRootClassName?: string
  menuAppearanceRootStyle?: CSSProperties
}

function parseGapPx(el: HTMLElement | null): number {
  if (!el) return 9
  const g = getComputedStyle(el).columnGap || getComputedStyle(el).gap
  const n = parseFloat(g)
  return Number.isFinite(n) ? n : 9
}

function rowWidthPx(
  widths: number[],
  count: number,
  gapPx: number,
): number {
  if (count <= 0) return 0
  let w = 0
  for (let i = 0; i < count; i++) {
    w += widths[i]!
    if (i < count - 1) w += gapPx
  }
  return w
}

export function PlaylistChromeOverflowRow({
  children,
  trailing,
  className,
  zIndexBase = 60,
  menuAppearanceRootClassName,
  menuAppearanceRootStyle,
}: Props) {
  const slots = Children.toArray(children).filter(
    (c): c is ReactElement => isValidElement(c),
  )
  const slotSignature = slots.map((s) => String(s.key ?? '')).join('|')
  const hostRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const chevronRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(slots.length)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{
    top: number
    left: number
    maxW: number
  } | null>(null)

  const remeasure = useCallback(() => {
    const host = hostRef.current
    const measureRow = measureRef.current
    if (!host || !measureRow || slots.length === 0) {
      setVisibleCount(slots.length)
      return
    }
    const gapPx = parseGapPx(measureRow)
    const spans = measureRow.querySelectorAll<HTMLElement>(
      '[data-playlist-chrome-slot-wrap]',
    )
    const widths = slots.map((_, i) => spans[i]?.offsetWidth ?? 0)
    const available = Math.max(0, host.clientWidth)

    const total = rowWidthPx(widths, slots.length, gapPx)
    if (total <= available + 0.5) {
      setVisibleCount(slots.length)
      setMenuOpen(false)
      return
    }

    const availWithChevron = Math.max(0, available - CHEVRON_RESERVE_PX)
    let v = 0
    for (let k = 1; k <= slots.length; k++) {
      if (rowWidthPx(widths, k, gapPx) <= availWithChevron + 0.5) v = k
      else break
    }
    setVisibleCount(v)
    if (v >= slots.length) setMenuOpen(false)
  }, [slotSignature, slots.length]) // eslint-disable-line react-hooks/exhaustive-deps -- slotSignature ≈ elenco slot

  useLayoutEffect(() => {
    remeasure()
  }, [remeasure, slotSignature])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver(() => remeasure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [remeasure])

  const updateMenuPos = useCallback(() => {
    const btn = chevronRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const pad = 8
    const maxW = Math.min(360, globalThis.innerWidth - pad * 2)
    let left = r.right - maxW
    if (left < pad) left = pad
    if (left + maxW > globalThis.innerWidth - pad) {
      left = Math.max(pad, globalThis.innerWidth - pad - maxW)
    }
    setMenuPos({
      top: r.bottom + 4,
      left,
      maxW,
    })
  }, [])

  useLayoutEffect(() => {
    if (!menuOpen) return
    updateMenuPos()
  }, [menuOpen, updateMenuPos, visibleCount])

  useEffect(() => {
    if (!menuOpen) return
    const onScroll = () => updateMenuPos()
    const onResize = () => updateMenuPos()
    globalThis.addEventListener('scroll', onScroll, true)
    globalThis.addEventListener('resize', onResize)
    return () => {
      globalThis.removeEventListener('scroll', onScroll, true)
      globalThis.removeEventListener('resize', onResize)
    }
  }, [menuOpen, updateMenuPos])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target
      if (!(t instanceof Node)) return
      if (menuRef.current?.contains(t)) return
      if (chevronRef.current?.contains(t)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [menuOpen])

  const overflowCount = slots.length - visibleCount
  const showChevron = overflowCount > 0

  const menu =
    menuOpen && showChevron && menuPos
      ? createPortal(
          <div
            className={menuAppearanceRootClassName}
            style={menuAppearanceRootStyle}
          >
            <div
              ref={menuRef}
              className="playlist-chrome-overflow-menu"
              role="menu"
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.maxW,
                zIndex: zIndexBase + 40,
              }}
            >
              <div className="playlist-chrome-overflow-menu-inner">
                {slots.slice(visibleCount).map((slot) => (
                  <div
                    key={String(slot.key ?? 'slot')}
                    className="playlist-chrome-overflow-menu-slot"
                  >
                    {slot}
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  const innerLeading = (
    <div
      ref={hostRef}
      className="playlist-chrome-overflow-leading-host"
    >
      <div
        ref={measureRef}
        className="playlist-chrome-overflow-measure floating-playlist-chrome-actions"
        aria-hidden
      >
        {slots.map((slot) => (
          <span
            key={`measure-${String(slot.key)}`}
            data-playlist-chrome-slot-wrap
            className="playlist-chrome-overflow-slot-wrap"
          >
            {cloneElement(slot)}
          </span>
        ))}
      </div>
      <div className="playlist-chrome-overflow-visible-row floating-playlist-chrome-actions">
        {slots.slice(0, visibleCount).map((slot) => (
          <Fragment key={String(slot.key)}>{slot}</Fragment>
        ))}
        {showChevron ? (
          <button
            ref={chevronRef}
            type="button"
            className="floating-playlist-icon-btn playlist-chrome-overflow-chevron"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Altri comandi"
            aria-label="Apri menu altri comandi della barra"
            onMouseDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation()
              setMenuOpen((o) => !o)
            }}
          >
            <IconChevronDownRibbon />
          </button>
        ) : null}
      </div>
    </div>
  )

  if (trailing != null) {
    return (
      <div
        className={`playlist-chrome-overflow-split${className ? ` ${className}` : ''}`}
      >
        {innerLeading}
        {trailing}
        {menu}
      </div>
    )
  }

  return (
    <div className={className ?? ''}>
      {innerLeading}
      {menu}
    </div>
  )
}
