/** Documento titoli PGM (v1) — serializzabile in JSON via PlaybackCommand. */

export type RegiaTitleMotionV1 =
  | { mode: 'none' }
  | { mode: 'fade'; durationMs: number }
  | { mode: 'slide'; durationMs: number; direction: 'up' | 'down' | 'left' | 'right' }
  | { mode: 'crawl'; durationMs: number }
  | { mode: 'roll'; durationMs: number }

export type RegiaTitleAnchorV1 =
  | 'lowerThird'
  | 'center'
  | 'top'
  | 'ticker'

export type RegiaTitleDocumentV1 = {
  v: 1
  text: string
  fontFamily: string
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  fontSizePx: number
  lineHeight: number
  letterSpacingPx: number
  color: string
  textAlign: 'left' | 'center' | 'right'
  anchor: RegiaTitleAnchorV1
  opacity: number
  boxBackground: string
  boxPaddingPx: number
  boxRadiusPx: number
  boxOpacity: number
  textShadow: string
  motionIn: RegiaTitleMotionV1
  motionOut: RegiaTitleMotionV1
}

export const REGIA_TITLE_DOC_EMPTY_V1: RegiaTitleDocumentV1 = {
  v: 1,
  text: '',
  fontFamily:
    'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial',
  fontWeight: 600,
  fontStyle: 'normal',
  fontSizePx: 42,
  lineHeight: 1.15,
  letterSpacingPx: 0,
  color: '#ffffff',
  textAlign: 'center',
  anchor: 'lowerThird',
  opacity: 1,
  boxBackground: '#000000',
  boxPaddingPx: 12,
  boxRadiusPx: 6,
  boxOpacity: 0.55,
  textShadow: '0 2px 8px rgba(0,0,0,0.65)',
  motionIn: { mode: 'fade', durationMs: 400 },
  motionOut: { mode: 'fade', durationMs: 400 },
}

export function clampRegiaTitleDocument(
  raw: unknown,
): RegiaTitleDocumentV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null
  const text =
    typeof o.text === 'string' ? o.text.slice(0, 8000) : REGIA_TITLE_DOC_EMPTY_V1.text
  const base = { ...REGIA_TITLE_DOC_EMPTY_V1, text }
  const fontFamily =
    typeof o.fontFamily === 'string' && o.fontFamily.trim()
      ? o.fontFamily.trim().slice(0, 400)
      : base.fontFamily
  const fontWeight = Number(o.fontWeight)
  const fw =
    Number.isFinite(fontWeight) && fontWeight >= 100 && fontWeight <= 900
      ? Math.round(fontWeight)
      : base.fontWeight
  const fontStyle =
    o.fontStyle === 'italic' ? 'italic' : ('normal' as const)
  const fontSizePx = Number(o.fontSizePx)
  const fs = Number.isFinite(fontSizePx)
    ? Math.min(220, Math.max(8, Math.round(fontSizePx)))
    : base.fontSizePx
  const lineHeight = Number(o.lineHeight)
  const lh = Number.isFinite(lineHeight)
    ? Math.min(3, Math.max(0.8, lineHeight))
    : base.lineHeight
  const letterSpacingPx = Number(o.letterSpacingPx)
  const ls = Number.isFinite(letterSpacingPx)
    ? Math.min(48, Math.max(-4, letterSpacingPx))
    : base.letterSpacingPx
  const color =
    typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color.trim())
      ? o.color.trim().toLowerCase()
      : base.color
  const textAlign =
    o.textAlign === 'left' || o.textAlign === 'right'
      ? o.textAlign
      : ('center' as const)
  const anchorRaw = o.anchor
  const anchor: RegiaTitleAnchorV1 =
    anchorRaw === 'center' ||
    anchorRaw === 'top' ||
    anchorRaw === 'ticker' ||
    anchorRaw === 'lowerThird'
      ? anchorRaw
      : 'lowerThird'
  const opacity = Number(o.opacity)
  const op = Number.isFinite(opacity)
    ? Math.min(1, Math.max(0, opacity))
    : base.opacity
  let boxBackground = base.boxBackground
  if (
    typeof o.boxBackground === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(o.boxBackground.trim())
  ) {
    boxBackground = o.boxBackground.trim().toLowerCase()
  }
  const boxPaddingPx = Number(o.boxPaddingPx)
  const bp = Number.isFinite(boxPaddingPx)
    ? Math.min(120, Math.max(0, Math.round(boxPaddingPx)))
    : base.boxPaddingPx
  const boxRadiusPx = Number(o.boxRadiusPx)
  const br = Number.isFinite(boxRadiusPx)
    ? Math.min(80, Math.max(0, Math.round(boxRadiusPx)))
    : base.boxRadiusPx
  const boxOpacity = Number(o.boxOpacity)
  const bo = Number.isFinite(boxOpacity)
    ? Math.min(1, Math.max(0, boxOpacity))
    : base.boxOpacity
  const textShadow =
    typeof o.textShadow === 'string'
      ? o.textShadow.slice(0, 200)
      : base.textShadow

  const motionIn = clampMotion(o.motionIn, base.motionIn)
  const motionOut = clampMotion(o.motionOut, base.motionOut)

  return {
    v: 1,
    text,
    fontFamily,
    fontWeight: fw,
    fontStyle,
    fontSizePx: fs,
    lineHeight: lh,
    letterSpacingPx: ls,
    color,
    textAlign,
    anchor,
    opacity: op,
    boxBackground,
    boxPaddingPx: bp,
    boxRadiusPx: br,
    boxOpacity: bo,
    textShadow,
    motionIn,
    motionOut,
  }
}

function clampMotion(raw: unknown, fb: RegiaTitleMotionV1): RegiaTitleMotionV1 {
  if (!raw || typeof raw !== 'object') return fb
  const m = raw as Record<string, unknown>
  const mode = m.mode
  const dur = Number(m.durationMs)
  const durationMs = Number.isFinite(dur)
    ? Math.min(60000, Math.max(0, Math.round(dur)))
    : 400
  if (mode === 'none') return { mode: 'none' }
  if (mode === 'fade') return { mode: 'fade', durationMs }
  if (mode === 'slide') {
    const d =
      m.direction === 'up' ||
      m.direction === 'down' ||
      m.direction === 'left' ||
      m.direction === 'right'
        ? m.direction
        : 'up'
    return { mode: 'slide', durationMs, direction: d }
  }
  if (mode === 'crawl') return { mode: 'crawl', durationMs }
  if (mode === 'roll') return { mode: 'roll', durationMs }
  return fb
}
