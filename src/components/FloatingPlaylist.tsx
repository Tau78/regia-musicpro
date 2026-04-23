import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  applyResizeDelta,
  clampPanelInViewport,
  clampPosToViewport,
  hitTestPanelResizeEdge,
  resizeEdgeToCssCursor,
  type PanelPos,
  type ResizeEdge,
} from '../lib/floatingPanelGeometry.ts'
import {
  buildPeerDimensionTargets,
  PLANCIA_DOCK_SCREEN_RIGHT_PX,
  PLANCIA_UNDOCK_DRAG_LEFT_PX,
  queryPlanciaContentRect,
  snapFloatingPanelDragPos,
  snapFloatingPanelResize,
  type PeerSnapRect,
  type SessionSnapDims,
} from '../lib/planciaSnap.ts'
import { readPreviewLayoutFromLs } from '../lib/previewLayoutStorage.ts'
import {
  useLaunchPadCueEnabled,
} from '../lib/launchPadSettings.ts'
import { usePlanciaSnapEnabled } from '../lib/planciaSnapSettings.ts'
import { useRegiaFloatingFloaterExperimental } from '../lib/regiaFloatingFloaterSettings.ts'
import {
  dataTransferHasFileList,
  mediaPathsFromDataTransfer,
} from '../lib/isMediaFilePath.ts'
import {
  dataTransferHasFloatingInternal,
  parseRegiaFloatingDnDPayload,
  REGIA_FLOATING_DND_MIME,
  stringifyRegiaFloatingDnDPayload,
} from '../lib/regiaFloatingDnD.ts'
import { setRegiaDnDDragImage } from '../lib/regiaDnDDragImage.ts'
import {
  canAssignLaunchPadKeyCode,
  launchPadKeyLabel,
} from '../lib/launchPadKeyboard.ts'
import {
  getLaunchpadSampleProgress,
  isLaunchpadSamplePausedWithSrc,
  launchpadAnyVoiceInSession,
  launchpadSlotHasAnyVoice,
  launchpadSlotHasPlayingVoice,
} from '../lib/launchpadSamplePlayer.ts'
import {
  normalizePlaylistThemeColor,
  PLAYLIST_THEME_COLOR_INPUT_DEFAULT,
} from '../lib/playlistThemeColor.ts'
import { normalizePlaylistWatermarkAbsPath } from '../lib/playlistWatermarkPath.ts'
import { formatDurationMmSs } from '../lib/formatDurationMmSs.ts'
import { sessionIsLiveOnRegiaOutput } from '../lib/sessionLiveOutput.ts'
import { normalizePlaylistCrossfadeSec } from '../lib/playlistCrossfade.ts'
import {
  cycleLoopMode,
  loopCycleModeShortLabel,
} from '../lib/loopModeCycle.ts'
import {
  formatPlaylistDurationLabel,
  usePlaylistMediaDurations,
} from '../hooks/usePlaylistMediaDurations.ts'
import { useRegia, type LoopMode } from '../state/RegiaContext.tsx'
import MediaDurationRing from './MediaDurationRing.tsx'
import RegiaPanelHintHost from './RegiaPanelHintHost.tsx'
import ChalkboardPanel from './ChalkboardPanel.tsx'
import { PresenterKeyWizardDialog } from './PresenterKeyWizardDialog.tsx'
import { PlaylistChromeOverflowRow } from './PlaylistChromeOverflowRow.tsx'
import {
  cloneChalkboardPlacementsByBank,
  DEFAULT_FLOATING_PANEL_SIZE,
  emptyChalkboardPlacementsByBank,
  LAUNCHPAD_BANK_COUNT,
  LAUNCHPAD_CELL_COUNT,
  LAUNCHPAD_CUE_HOLD_MS,
  defaultLaunchPadCells,
  launchPadCellShownLabel,
  normalizeChalkboardBackgroundHex,
  normalizeChalkboardOutputMode,
  type ChalkboardPlacedImage,
  type LaunchPadCell,
  type FloatingPlaylistPanelSize,
} from '../state/floatingPlaylistSession.ts'

/** Evita `?? []` inline: nuovo array a ogni render → useEffect Chalkboard in loop. */
const FALLBACK_CHALKBOARD_BANK_PATHS: string[] = []
const FALLBACK_CHALKBOARD_PLACEMENTS: ChalkboardPlacedImage[] = []

const LAUNCHPAD_CATEGORY_SWATCHES = [
  '#e63946',
  '#2a9d8f',
  '#4361ee',
  '#f4a261',
  '#8338ec',
] as const
/** Movimento oltre questa distanza annulla tap / CUE in attesa (prima della soglia). */
const LAUNCHPAD_CANCEL_MOVE_PX = 14

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

function IconRegiaCloudCopy() {
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
        d="M7 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7v14"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21h7a2 2 0 0 0 2-2v-7h-9v9z"
      />
    </svg>
  )
}

function IconPanelLock({ locked }: { locked: boolean }) {
  return (
    <svg
      className={`floating-playlist-header-icon${locked ? ' is-lock-on' : ''}`}
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
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
        d="M8 11V8a4 4 0 0 1 8 0v3"
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

/** Lavagna a tutto schermo (corners). */
function IconChalkboardFullscreen() {
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
      <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
    </svg>
  )
}

function IconChalkboardFullscreenExit() {
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
      <path d="M4 10V4h6M14 4h6v6M20 14v6h-6M10 20H4v-6" />
    </svg>
  )
}

function IconWindowPin() {
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
      <circle cx="9.75" cy="8" r="3.35" />
      <line x1="11.35" y1="10.35" x2="18.25" y2="19.25" />
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

function IconColorWheel() {
  /** Pinwheel a 6 petali (settori 60°), colori fissi — non usa currentColor così resta leggibile con tema playlist. */
  return (
    <svg
      className="floating-playlist-header-icon floating-playlist-color-wheel-pinwheel"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M12 12 12 4.5 18.495 8.25Z"
        fill="#ef4444"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <path
        d="M12 12 18.495 8.25 18.495 15.75Z"
        fill="#f97316"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <path
        d="M12 12 18.495 15.75 12 19.5Z"
        fill="#eab308"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <path
        d="M12 12 12 19.5 5.505 15.75Z"
        fill="#22c55e"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <path
        d="M12 12 5.505 15.75 5.505 8.25Z"
        fill="#3b82f6"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <path
        d="M12 12 5.505 8.25 12 4.5Z"
        fill="#a855f7"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.35"
        fill="#f1f5f9"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={0.45}
      />
    </svg>
  )
}

function IconWatermark() {
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
        y="5"
        width="16"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        d="M8 9h5M8 12h8M8 15h6"
        opacity={0.85}
      />
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

/**
 * True se il target non deve avviare resize bordo né trascinamento del pannello.
 *
 * IMPORTANTE: in `onPanelChromePointerDownCapture` questa funzione va valutata
 * **prima** di `hitTestPanelResizeEdge`. Altrimenti un clic sulla lista che cade
 * nella fascia resize (es. ultima riga nei 12px inferiori) cattura il pointer sul
 * root e il riordino righe (long-press + document pointer listeners) smette di funzionare.
 */
function isFloatingPlaylistPanelDragBlockedTarget(
  t: HTMLElement,
  root: HTMLElement,
): boolean {
  if (!root.contains(t)) return true
  if (t.closest('.floating-playlist-panel-help-popover')) return true
  /** Lavagna: canvas, toolbar e testo non devono trascinare il pannello. */
  if (t.closest('.floating-playlist-chalkboard-viewport')) return true
  if (t.closest('.floating-playlist-chalkboard-stack')) return true
  if (
    t.closest(
      'button, [role="button"], input, textarea, select, a, [role="slider"]',
    )
  )
    return true
  if (
    t.closest('ul.floating-playlist-list') &&
    !t.closest('li.floating-playlist-empty')
  )
    return true
  return false
}

const PANEL_HELP_POPOVER_MAX_W_PX = 352

function getPanelHelpClampBounds(): {
  left: number
  top: number
  right: number
  bottom: number
} {
  const pad = 8
  const vv = globalThis.visualViewport
  const vLeft = (vv?.offsetLeft ?? 0) + pad
  const vTop = (vv?.offsetTop ?? 0) + pad
  const vRight =
    (vv?.offsetLeft ?? 0) +
    (vv?.width && vv.width > 0 ? vv.width : globalThis.innerWidth) -
    pad
  const vBottom =
    (vv?.offsetTop ?? 0) +
    (vv?.height && vv.height > 0 ? vv.height : globalThis.innerHeight) -
    pad

  const pl = queryPlanciaContentRect()
  if (!pl) {
    return { left: vLeft, top: vTop, right: vRight, bottom: vBottom }
  }
  /** Intersezione plancia × viewport: i pannelli flottanti possono stare fuori da `.regia-main-content`. */
  return {
    left: Math.max(vLeft, pl.left + pad),
    top: Math.max(vTop, pl.top + pad),
    right: Math.min(vRight, pl.right - pad),
    bottom: Math.min(vBottom, pl.bottom - pad),
  }
}

type PanelHelpPopoverLayout = {
  top: number
  left: number
  width: number
  maxHeight: number
}

function computePanelHelpPopoverLayout(
  btnR: DOMRect,
  contentScrollHeight: number,
  bounds: { left: number; top: number; right: number; bottom: number },
): PanelHelpPopoverLayout {
  const gap = 6
  const minH = 96
  const innerW = Math.max(0, bounds.right - bounds.left)
  if (innerW < 1) {
    return {
      top: bounds.top,
      left: bounds.left,
      width: Math.min(PANEL_HELP_POPOVER_MAX_W_PX, 280),
      maxHeight: Math.round(Math.max(72, Math.min(320, contentScrollHeight))),
    }
  }
  const maxW = Math.min(
    PANEL_HELP_POPOVER_MAX_W_PX,
    innerW < 100 ? innerW : Math.max(100, innerW),
  )

  const spaceAbove = btnR.top - bounds.top - gap
  const spaceBelow = bounds.bottom - btnR.bottom - gap

  let top: number
  let maxHeight: number

  if (spaceAbove >= minH && spaceAbove >= spaceBelow) {
    maxHeight = Math.min(contentScrollHeight, spaceAbove)
    top = btnR.top - gap - maxHeight
  } else if (spaceBelow >= minH) {
    top = btnR.bottom + gap
    maxHeight = Math.min(contentScrollHeight, spaceBelow)
  } else {
    top = bounds.top
    maxHeight = bounds.bottom - bounds.top
    maxHeight = Math.min(contentScrollHeight, Math.max(minH, maxHeight))
  }

  if (top < bounds.top) top = bounds.top
  if (top + maxHeight > bounds.bottom) {
    maxHeight = Math.max(72, bounds.bottom - top)
  }
  maxHeight = Math.min(maxHeight, contentScrollHeight)
  maxHeight = Math.max(72, maxHeight)
  if (top + maxHeight > bounds.bottom) {
    top = Math.max(bounds.top, bounds.bottom - maxHeight)
  }

  /**
   * Allinea il bordo destro del popover al pulsante, ma mai oltre il bordo destro
   * visibile (il `?` può trovarsi a destra del rect `.regia-main-content`).
   */
  const anchorRight = Math.min(btnR.right, bounds.right)
  let left = anchorRight - maxW
  if (left < bounds.left) {
    left = bounds.left
  }
  if (left + maxW > bounds.right) {
    left = Math.max(bounds.left, bounds.right - maxW)
  }

  /** Ancoraggio viewport reale (il popover è in `document.body`). */
  const vvPad = 8
  const vv = globalThis.visualViewport
  const screenRight = vv
    ? vv.offsetLeft + (vv.width > 0 ? vv.width : globalThis.innerWidth) - vvPad
    : globalThis.innerWidth - vvPad
  const screenLeft = vv ? vv.offsetLeft + vvPad : vvPad
  if (left + maxW > screenRight) {
    left = Math.max(screenLeft, screenRight - maxW)
  }
  if (left < screenLeft) {
    left = screenLeft
  }

  return {
    top,
    left,
    width: maxW,
    maxHeight: Math.round(maxHeight),
  }
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
  playlistOutputVolume?: number
  planciaDock?: 'none' | 'right'
}

const MIN_PANEL_W = 220
const MIN_PANEL_H = 180
const MAX_PANEL_W = 960
const MAX_PANEL_H = 780
const PANEL_CLAMP_OPTS = { maxW: MAX_PANEL_W, maxH: MAX_PANEL_H } as const
/** Altezza approssimativa pannello comprimibile (solo barra) per snap tra peer. */
const COLLAPSED_FLOAT_PANEL_H_PX = 84

function loadLayoutFromLs(sessionId: string): Partial<{
  pos: PanelPos
  panelSize: FloatingPlaylistPanelSize
  playlistOutputMuted: boolean
  playlistOutputVolume: number
  planciaDock: 'none' | 'right'
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
      playlistOutputVolume: number
      planciaDock: 'none' | 'right'
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
    if (
      typeof p.playlistOutputVolume === 'number' &&
      Number.isFinite(p.playlistOutputVolume)
    ) {
      out.playlistOutputVolume = Math.min(
        1,
        Math.max(0, p.playlistOutputVolume),
      )
    }
    if (p.planciaDock === 'right' || p.planciaDock === 'none') {
      out.planciaDock = p.planciaDock
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
  output: { muted: boolean; volume: number; planciaDock?: 'none' | 'right' },
): void {
  try {
    localStorage.setItem(
      lsLayoutKey(sessionId),
      JSON.stringify({
        x: pos.x,
        y: pos.y,
        width: panelSize.width,
        height: panelSize.height,
        playlistOutputMuted: output.muted,
        playlistOutputVolume: output.volume,
        ...(output.planciaDock === 'right' || output.planciaDock === 'none'
          ? { planciaDock: output.planciaDock }
          : {}),
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

/** Stesso riferimento quando `session` è assente, così gli effetti non dipendono da `[]` nuovo ogni render. */
const EMPTY_PLAYLIST_PATHS: string[] = []

function readPlaylistGridColumnCount(ul: HTMLElement): number {
  const st = getComputedStyle(ul)
  if (st.display !== 'grid') return 1
  const gtc = st.gridTemplateColumns
  if (!gtc || gtc === 'none') return 1
  const parts = gtc.trim().split(/\s+/).filter(Boolean)
  return Math.max(1, parts.length)
}

/** Punto clampato nel rettangolo + indice playlist → indice di inserimento (0…pathCount). */
function resolveInsertFromPointerInItem(
  r: DOMRect,
  idx: number,
  pathCount: number,
  cols: number,
  x: number,
  y: number,
): number {
  const midX = (r.left + r.right) / 2
  const midY = (r.top + r.bottom) / 2
  const isLast = idx >= pathCount - 1
  if (!isLast) {
    if ((idx + 1) % cols !== 0) {
      return x < midX ? idx : idx + 1
    }
    return y < midY ? idx : idx + 1
  }
  const lastInRow = cols <= 1 || idx % cols === cols - 1
  if (lastInRow) {
    return y < midY ? idx : pathCount
  }
  return x < midX ? idx : pathCount
}

/** Indice di inserimento 0…`pathCount` (prima del brano `i`, oppure in coda). */
function pickPlaylistInsertBeforeIndex(
  ul: HTMLUListElement | null,
  clientX: number,
  clientY: number,
  pathCount: number,
): number {
  if (!ul) return 0
  if (pathCount <= 0) {
    const r = ul.getBoundingClientRect()
    if (
      clientX >= r.left &&
      clientX <= r.right &&
      clientY >= r.top &&
      clientY <= r.bottom
    )
      return 0
    return 0
  }
  const cols = readPlaylistGridColumnCount(ul)
  const nodes = ul.querySelectorAll<HTMLElement>(
    'li.floating-playlist-item[data-pl-idx]',
  )
  if (nodes.length === 0) return pathCount
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
      const idx = raw != null ? parseInt(raw, 10) : 0
      const insertBefore = resolveInsertFromPointerInItem(
        r,
        idx,
        pathCount,
        cols,
        clientX,
        clientY,
      )
      return Math.max(0, Math.min(pathCount, insertBefore))
    }
  }
  let best = pathCount
  let bestDist = Infinity
  for (let k = 0; k < nodes.length; k++) {
    const el = nodes[k]!
    const r = el.getBoundingClientRect()
    const raw = el.dataset.plIdx
    const idx = raw != null ? parseInt(raw, 10) : 0
    const px = Math.min(r.right, Math.max(r.left, clientX))
    const py = Math.min(r.bottom, Math.max(r.top, clientY))
    const d = (clientX - px) ** 2 + (clientY - py) ** 2
    if (d < bestDist) {
      bestDist = d
      best = resolveInsertFromPointerInItem(r, idx, pathCount, cols, px, py)
    }
  }
  return Math.max(0, Math.min(pathCount, best))
}

function playlistDropCueClasses(
  internalDropInsertBefore: number | null,
  idx: number,
  pathCount: number,
  cols: number,
): string {
  if (internalDropInsertBefore == null) return ''
  const ib = internalDropInsertBefore
  if (ib === idx) {
    if (idx === 0) return ' is-drop-cue-top'
    if (idx % cols !== 0) return ' is-drop-cue-left'
    return ' is-drop-cue-top'
  }
  if (ib === pathCount && idx === pathCount - 1) {
    if (cols > 1 && pathCount > 0 && idx % cols !== cols - 1) {
      return ' is-drop-cue-right'
    }
    return ' is-drop-cue-bottom'
  }
  return ''
}

function playlistEmptyDropCueClasses(
  internalDropInsertBefore: number | null,
): string {
  if (internalDropInsertBefore === 0) return ' is-drop-cue-top'
  return ''
}

export default function FloatingPlaylist({
  sessionId,
}: {
  sessionId: string
}) {
  const {
    floatingPlaylistSessions,
    previewDetached,
    floatingZOrder,
    bringFloatingPanelToFront,
    setActiveFloatingSession,
    loadIndexAndPlay,
    openFolder,
    addMediaToPlaylist,
    removePathAt,
    removeFloatingPlaylist,
    floatingCloseWouldInterruptPlay,
    setPlaylistTitle,
    setPlaylistThemeColor,
    setPlaylistWatermarkPngPath,
    cyclePlaylistCrossfadeSec,
    setPlaylistOutputMuted,
    setPlaylistOutputVolume,
    recordUndoPoint,
    savedPlaylistDirty,
    saveLoadedPlaylistOverwrite,
    saveFloatingPlaylistCopyToRegiaVideoCloud,
    setFloatingPlaylistPanelLocked,
    persistSavedPlaylistAfterFloatingTitleBlur,
    addPathsToPlaylistFromPaths,
    applyFloatingInternalDrop,
    applyLaunchPadDropFromPaths,
    loadLaunchPadSlotAndPlay,
    releaseLaunchPadCueVoice,
    updateLaunchPadCell,
    setLaunchPadBankIndex,
    updateFloatingPlaylistChrome,
    canUndo,
    canRedo,
    undo,
    redo,
    playbackLoadedTrack,
    videoOutputSessionId,
    videoPlaying,
    loopMode,
    setPlaylistLoopMode,
    launchpadAudioPlaying,
    sottofondoLoadedTrack,
    sottofondoPlaying,
    stopSottofondoPlayback,
    previewMediaTimesRef,
    previewMediaTimesTick,
    playbackArmedNext,
    armPlayNext,
    clearPlaybackArmedNext,
    patchFloatingPlaylistSession,
    rightPlanciaDockWidthPx,
    dockFloatingPlaylistToPlanciaRight,
  } = useRegia()

  const launchPadCueEnabled = useLaunchPadCueEnabled()
  const floatingFloaterExperimental = useRegiaFloatingFloaterExperimental()

  const panelClampWithDock = useMemo(
    () => ({ ...PANEL_CLAMP_OPTS, rightInset: rightPlanciaDockWidthPx }),
    [rightPlanciaDockWidthPx],
  )

  const dragSnapPeerRects = useMemo((): PeerSnapRect[] => {
    const out: PeerSnapRect[] = []
    for (const s of floatingPlaylistSessions) {
      if (s.id === sessionId) continue
      if (s.planciaDock === 'right') continue
      const h = s.collapsed ? COLLAPSED_FLOAT_PANEL_H_PX : s.panelSize.height
      out.push({
        left: s.pos.x,
        top: s.pos.y,
        right: s.pos.x + s.panelSize.width,
        bottom: s.pos.y + h,
      })
    }
    if (previewDetached) {
      const L = readPreviewLayoutFromLs()
      out.push({
        left: L.x,
        top: L.y,
        right: L.x + L.width,
        bottom: L.y + L.height,
      })
    }
    return out
  }, [floatingPlaylistSessions, previewDetached, sessionId])

  const session = floatingPlaylistSessions.find((s) => s.id === sessionId)
  const isLiveOnRegiaOutput = useMemo(() => {
    if (!session) return false
    return sessionIsLiveOnRegiaOutput(session, {
      videoOutputSessionId,
      videoPlaying,
      launchpadAudioPlaying,
      playbackLoadedTrack,
      sottofondoLoadedTrack,
    })
  }, [
    session,
    videoOutputSessionId,
    videoPlaying,
    launchpadAudioPlaying,
    playbackLoadedTrack,
    sottofondoLoadedTrack,
  ])
  const isLaunchpad = session?.playlistMode === 'launchpad'
  const isChalkboard = session?.playlistMode === 'chalkboard'
  const isSottofondo = session?.playlistMode === 'sottofondo'
  const panelDefaultHint = useMemo(() => {
    if (isLaunchpad) {
      return 'Launchpad: passa il mouse su intestazione, pagine, griglia pad e menu contestuale per le descrizioni. Il pulsante «?» mostra i tasti rapidi.'
    }
    if (isChalkboard) {
      return 'Lavagna: passa il mouse su intestazione, strumenti e area disegno per le descrizioni. Tab per i banchi; tasto angoli per tutto schermo.'
    }
    return 'Playlist: passa il mouse su intestazione, barra controlli, loop ed elenco brani per le descrizioni.'
  }, [isLaunchpad, isChalkboard])
  const panelHeaderStripHint = useMemo(() => {
    if (isLaunchpad) {
      return 'Intestazione launchpad: nome modificabile, aiuto «?», puntina finestra separata, riduci e chiudi. Sotto: pagine e griglia 4×4.'
    }
    if (isChalkboard) {
      return 'Intestazione lavagna: nome, tutto schermo (angoli), aiuto «?», puntina finestra separata, riduci e chiudi.'
    }
    return 'Intestazione playlist: nome, tema colore, file/cartella, carica e salva, loop (se visibile), aiuto «?», puntina, riduci e chiudi.'
  }, [isLaunchpad, isChalkboard])
  const paths = session?.paths ?? EMPTY_PLAYLIST_PATHS
  const trackDurations = usePlaylistMediaDurations(paths)
  const launchPadCells =
    session?.launchPadCells ??
    (isLaunchpad ? defaultLaunchPadCells() : null)
  const currentIndex = session?.currentIndex ?? 0
  const playlistTitle = session?.playlistTitle ?? ''
  const playlistCrossfadeSec = normalizePlaylistCrossfadeSec(
    session?.playlistCrossfadeSec,
  )
  const playlistCrossfadeLabel =
    playlistCrossfadeSec === 0 ? 'Off' : `${playlistCrossfadeSec} s`
  const playlistLoopMode = session?.playlistLoopMode
  const panelLoopEffective: LoopMode = playlistLoopMode ?? loopMode
  const playlistOutputMuted = session?.playlistOutputMuted ?? false
  const playlistOutputVolume =
    typeof session?.playlistOutputVolume === 'number' &&
    Number.isFinite(session.playlistOutputVolume)
      ? Math.min(1, Math.max(0, session.playlistOutputVolume))
      : 1
  const collapsed = session?.collapsed ?? false
  const windowAlwaysOnTopPinned = session?.windowAlwaysOnTopPinned === true
  const planciaDockRight = session?.planciaDock === 'right'
  const isPlaylistOsFloaterWindow =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('playlistOsFloater') === '1'
  const snapEnabled =
    usePlanciaSnapEnabled() &&
    !isPlaylistOsFloaterWindow &&
    (!windowAlwaysOnTopPinned || isPlaylistOsFloaterWindow) &&
    !planciaDockRight
  const launchPadBankIndex = session?.launchPadBankIndex ?? 0
  const pos = session?.pos ?? { x: 24, y: 96 }
  const panelSize =
    session?.panelSize ?? DEFAULT_FLOATING_PANEL_SIZE
  const chalkboardFullscreen = session?.chalkboardFullscreen === true
  const panelLocked = session?.panelLocked === true
  /** Cartella osservata: elenco ancora allineato alla cartella (si spegne se modifichi l’elenco a mano). */
  const folderWatchLinked = Boolean(
    session &&
      !isLaunchpad &&
      !isChalkboard &&
      session.playlistWatchFolder?.trim(),
  )
  const folderOpenBtnClass = `floating-playlist-icon-btn floating-playlist-folder-open-btn${folderWatchLinked ? ' is-folder-watch-linked' : ''}`
  const folderOpenBtnTitle = folderWatchLinked
    ? 'Cartella collegata: l’elenco si aggiorna automaticamente dal disco. Clic per aprire un’altra cartella.'
    : 'Apri cartella'
  const folderOpenBtnAriaLabel = folderWatchLinked
    ? 'Cartella collegata: aggiornamento automatico dal disco. Scegli un’altra cartella'
    : 'Apri cartella'

  const chalkboardPreFullscreenRef = useRef<{
    pos: { x: number; y: number }
    panelSize: FloatingPlaylistPanelSize
  } | null>(null)

  const [launchPadClipboard, setLaunchPadClipboard] =
    useState<LaunchPadCell | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const playlistColorInputRef = useRef<HTMLInputElement>(null)
  const padColorInputRef = useRef<HTMLInputElement>(null)
  const [padFlashSlot, setPadFlashSlot] = useState<number | null>(null)
  const [padColorPickIndex, setPadColorPickIndex] = useState<number | null>(
    null,
  )
  const launchPadMenuRef = useRef<HTMLDivElement>(null)
  const playlistTrackCtxMenuRef = useRef<HTMLDivElement>(null)
  const [playlistTrackCtxSlot, setPlaylistTrackCtxSlot] = useState<
    number | null
  >(null)
  const [launchPadCtx, setLaunchPadCtx] = useState<{
    slot: number
  } | null>(null)
  /** Slot index in modalità “impara tasto”, o `null`. */
  const [padKeyLearnSlot, setPadKeyLearnSlot] = useState<number | null>(null)
  const [presenterWizardOpen, setPresenterWizardOpen] = useState(false)
  const launchPadSampleGesturesRef = useRef(
    new Map<
      number,
      {
        slotIndex: number
        pointerId: number
        startX: number
        startY: number
        cueActive: boolean
        cancelled: boolean
        timer: ReturnType<typeof setTimeout> | null
        cueVoiceId: number | null
      }
    >(),
  )
  const suppressLaunchPadClickSlotRef = useRef<number | null>(null)
  const suppressLaunchPadClickClearTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null)
  /** Evita doppia apertura menu se sia pointerdown(tasto destro) sia contextmenu arrivano nello stesso gesto. */
  const skipLaunchPadCtxMenuDupRef = useRef(false)
  /** Invio su titolo fa commit poi blur: evita secondo persist (duplicati in PLAYLIST salvate). */
  const suppressNextTitleBlurPersistRef = useRef(false)
  const [playlistDropHover, setPlaylistDropHover] = useState(false)
  const [launchpadDropHover, setLaunchpadDropHover] = useState(false)
  const playlistDndDepth = useRef(0)
  const launchpadDndDepth = useRef(0)
  const listRef = useRef<HTMLUListElement>(null)
  const [playlistGridCols, setPlaylistGridCols] = useState(1)
  /** Inserimento DnD interno (0…paths.length) durante passaggio su questa lista. */
  const [internalDropInsertBefore, setInternalDropInsertBefore] = useState<
    number | null
  >(null)
  /** Riga playlist in corso di trascinamento HTML5 (stile elenco). */
  const [playlistRowDragSourceIndex, setPlaylistRowDragSourceIndex] = useState<
    number | null
  >(null)
  /** Slot launchpad in corso di trascinamento. */
  const [launchPadDragSourceSlot, setLaunchPadDragSourceSlot] = useState<
    number | null
  >(null)
  const [isResizing, setIsResizing] = useState(false)
  const [closePlayConfirmOpen, setClosePlayConfirmOpen] = useState(false)
  const [panelHelpOpen, setPanelHelpOpen] = useState(false)
  const panelHelpButtonRef = useRef<HTMLButtonElement>(null)
  const panelHelpPopoverRef = useRef<HTMLDivElement>(null)
  const panelHelpPanelId = useId()
  const [panelHelpLayout, setPanelHelpLayout] =
    useState<PanelHelpPopoverLayout | null>(null)
  const closePlayConfirmCancelRef = useRef<HTMLButtonElement>(null)
  /** Evita un click «play» subito dopo un drag sulla riga. */
  const suppressPlaylistRowClickRef = useRef(false)
  const padProgressRafRef = useRef<number | null>(null)
  const [padProgressTick, setPadProgressTick] = useState(0)

  useEffect(() => {
    if (!isLaunchpad || !launchpadAnyVoiceInSession(sessionId)) {
      if (padProgressRafRef.current != null) {
        cancelAnimationFrame(padProgressRafRef.current)
        padProgressRafRef.current = null
      }
      return
    }
    let lastBump = 0
    const step = (t: number) => {
      if (t - lastBump >= 72) {
        lastBump = t
        setPadProgressTick((n) => n + 1)
      }
      padProgressRafRef.current = requestAnimationFrame(step)
    }
    padProgressRafRef.current = requestAnimationFrame(step)
    return () => {
      if (padProgressRafRef.current != null) {
        cancelAnimationFrame(padProgressRafRef.current)
        padProgressRafRef.current = null
      }
    }
  }, [isLaunchpad, sessionId])

  useEffect(() => {
    setPanelHelpOpen(false)
  }, [isLaunchpad])

  useEffect(() => {
    if (collapsed) setPanelHelpOpen(false)
  }, [collapsed])

  useLayoutEffect(() => {
    if (!panelHelpOpen) {
      setPanelHelpLayout(null)
      return
    }
    const run = () => {
      const btn = panelHelpButtonRef.current
      const pop = panelHelpPopoverRef.current
      if (!btn || !pop) return
      const bounds = getPanelHelpClampBounds()
      void pop.offsetHeight
      setPanelHelpLayout(
        computePanelHelpPopoverLayout(
          btn.getBoundingClientRect(),
          pop.scrollHeight,
          bounds,
        ),
      )
    }
    run()
    globalThis.addEventListener('resize', run)
    globalThis.addEventListener('scroll', run, true)
    return () => {
      globalThis.removeEventListener('resize', run)
      globalThis.removeEventListener('scroll', run, true)
    }
  }, [
    panelHelpOpen,
    isLaunchpad,
    launchPadCueEnabled,
    pos.x,
    pos.y,
    panelSize.width,
    panelSize.height,
  ])

  useEffect(() => {
    if (!panelHelpOpen) return
    const onDocDown = (ev: globalThis.MouseEvent) => {
      const t = ev.target
      if (!(t instanceof Node)) return
      if (panelHelpPopoverRef.current?.contains(t)) return
      if (panelHelpButtonRef.current?.contains(t)) return
      setPanelHelpOpen(false)
    }
    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape') setPanelHelpOpen(false)
    }
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [panelHelpOpen])

  const drag = useRef<{
    active: boolean
    dx: number
    dy: number
    startX: number
    startY: number
    /** Trascinamento nella finestra OS separata: muove la BrowserWindow. */
    floater?: {
      startPtrScreenX: number
      startPtrScreenY: number
      winStartX: number
      winStartY: number
      winW: number
      winH: number
    }
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
    const hasVol =
      typeof fromLs.playlistOutputVolume === 'number' &&
      Number.isFinite(fromLs.playlistOutputVolume)
    const hasDock =
      fromLs.planciaDock === 'right' || fromLs.planciaDock === 'none'
    if (!hasPos && !hasSize && !hasMute && !hasVol && !hasDock) return
    const patch: {
      pos?: PanelPos
      panelSize?: FloatingPlaylistPanelSize
      playlistOutputMuted?: boolean
      playlistOutputVolume?: number
      planciaDock?: 'none' | 'right'
    } = {}
    if (fromLs.pos) patch.pos = fromLs.pos
    if (fromLs.panelSize) patch.panelSize = fromLs.panelSize
    if (hasMute) patch.playlistOutputMuted = fromLs.playlistOutputMuted
    if (hasVol) {
      patch.playlistOutputVolume = Math.min(
        1,
        Math.max(0, fromLs.playlistOutputVolume!),
      )
    }
    if (hasDock) patch.planciaDock = fromLs.planciaDock
    updateFloatingPlaylistChrome(sessionId, patch)
  }, [sessionId, updateFloatingPlaylistChrome])

  const currentPlayIndexInThisPanel =
    isSottofondo && sottofondoLoadedTrack?.sessionId === sessionId
      ? sottofondoLoadedTrack.index
      : !isSottofondo && playbackLoadedTrack?.sessionId === sessionId
        ? playbackLoadedTrack.index
        : null

  useLayoutEffect(() => {
    if (collapsed || isLaunchpad) {
      return
    }
    const ul = listRef.current
    if (!ul) return
    const update = () => {
      setPlaylistGridCols(readPlaylistGridColumnCount(ul))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(ul)
    return () => {
      ro.disconnect()
    }
  }, [collapsed, isLaunchpad, paths.length, sessionId])

  useLayoutEffect(() => {
    if (
      isLaunchpad ||
      collapsed ||
      currentPlayIndexInThisPanel == null ||
      paths.length === 0
    )
      return
    const root = listRef.current
    if (!root) return
    const row = root.querySelector(
      `li.floating-playlist-item[data-pl-idx="${currentPlayIndexInThisPanel}"]`,
    ) as HTMLElement | null
    if (!row) return
    const rootRect = root.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const margin = 6
    const fullyVisible =
      rowRect.top >= rootRect.top + margin &&
      rowRect.bottom <= rootRect.bottom - margin
    if (fullyVisible) return
    row.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  }, [
    collapsed,
    currentPlayIndexInThisPanel,
    isLaunchpad,
    paths,
    sessionId,
  ])

  const reclampIntoView = useCallback(() => {
    if (isPlaylistOsFloaterWindow || planciaDockRight) return
    const el = panelRef.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 6
    if (collapsed) {
      const w = Math.min(
        Math.max(MIN_PANEL_W, panelSize.width),
        MAX_PANEL_W,
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
      panelClampWithDock,
    )
    if (
      np.x !== pos.x ||
      np.y !== pos.y ||
      ns.width !== panelSize.width ||
      ns.height !== panelSize.height
    )
      updateFloatingPlaylistChrome(sessionId, { pos: np, panelSize: ns })
  }, [
    collapsed,
    isPlaylistOsFloaterWindow,
    panelClampWithDock,
    panelSize,
    planciaDockRight,
    pos,
    sessionId,
    updateFloatingPlaylistChrome,
  ])

  useLayoutEffect(() => {
    reclampIntoView()
  }, [
    collapsed,
    isLaunchpad,
    isPlaylistOsFloaterWindow,
    paths.length,
    panelSize,
    planciaDockRight,
    reclampIntoView,
  ])

  useEffect(() => {
    const onResize = () => reclampIntoView()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [reclampIntoView])

  const resizePlaylistWithSnap = useCallback(
    (
      edge: ResizeEdge,
      startPos: PanelPos,
      startSize: FloatingPlaylistPanelSize,
      dx: number,
      dy: number,
    ) => {
      const raw = applyResizeDelta(
        edge,
        startPos,
        startSize,
        dx,
        dy,
        MIN_PANEL_W,
        MIN_PANEL_H,
        panelClampWithDock,
      )
      if (!snapEnabled) return raw
      const previewDims = previewDetached
        ? (() => {
            const L = readPreviewLayoutFromLs()
            return { width: L.width, height: L.height }
          })()
        : null
      const sessionsMeta: SessionSnapDims[] = floatingPlaylistSessions.map(
        (s) => ({
          id: s.id,
          width: s.panelSize.width,
          height: s.panelSize.height,
        }),
      )
      const { widths, heights } = buildPeerDimensionTargets(
        sessionsMeta,
        sessionId,
        previewDims,
        MIN_PANEL_W,
        MIN_PANEL_H,
      )
      const sn = snapFloatingPanelResize(edge, raw.pos, raw.size, {
        plancia: queryPlanciaContentRect(),
        peerWidths: widths,
        peerHeights: heights,
        minW: MIN_PANEL_W,
        minH: MIN_PANEL_H,
      })
      return clampPanelInViewport(
        sn.pos,
        sn.size,
        MIN_PANEL_W,
        MIN_PANEL_H,
        panelClampWithDock,
      )
    },
    [
      floatingPlaylistSessions,
      panelClampWithDock,
      previewDetached,
      sessionId,
      snapEnabled,
    ],
  )

  const onPanelChromePointerDownCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const root = panelRef.current
      if (!root) return
      const t = e.target as HTMLElement | null
      if (!t || !root.contains(t)) return

      bringFloatingPanelToFront(sessionId)

      if (isFloatingPlaylistPanelDragBlockedTarget(t, root)) return

      if (isChalkboard && chalkboardFullscreen) return

      const rect = root.getBoundingClientRect()
      const resizeEdge = hitTestPanelResizeEdge(
        e.clientX,
        e.clientY,
        rect,
        collapsed,
      )
      if (resizeEdge) {
        if (planciaDockRight) return
        e.preventDefault()
        setActiveFloatingSession(sessionId)
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
        return
      }

      setActiveFloatingSession(sessionId)
      try {
        root.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const dragBase = {
        active: true as const,
        dx: pos.x,
        dy: pos.y,
        startX: e.clientX,
        startY: e.clientY,
      }
      drag.current = isPlaylistOsFloaterWindow
        ? {
            ...dragBase,
            floater: {
              startPtrScreenX: e.screenX,
              startPtrScreenY: e.screenY,
              winStartX: window.screenX,
              winStartY: window.screenY,
              winW: window.outerWidth,
              winH: window.outerHeight,
            },
          }
        : dragBase
    },
    [
      bringFloatingPanelToFront,
      chalkboardFullscreen,
      collapsed,
      isChalkboard,
      isPlaylistOsFloaterWindow,
      panelSize.height,
      panelSize.width,
      planciaDockRight,
      pos.x,
      pos.y,
      sessionId,
      setActiveFloatingSession,
    ],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const chrome = e.currentTarget
      const rs = resizeStateRef.current
      if (rs) {
        const dx = e.clientX - rs.startX
        const dy = e.clientY - rs.startY
        const { pos: np, size: ns } = resizePlaylistWithSnap(
          rs.edge,
          rs.startPos,
          rs.startSize,
          dx,
          dy,
        )
        updateFloatingPlaylistChrome(sessionId, { pos: np, panelSize: ns })
        chrome.style.cursor = resizeEdgeToCssCursor(rs.edge)
        if (isPlaylistOsFloaterWindow) {
          void window.electronAPI?.playlistFloaterSetBounds?.({
            x: Math.round(window.screenX + np.x),
            y: Math.round(window.screenY + np.y),
            width: Math.round(ns.width),
            height: Math.round(ns.height),
          })
        }
        return
      }
      const d = drag.current
      if (d?.active) {
        chrome.style.cursor = 'grabbing'
      } else {
        const root = panelRef.current
        if (
          root &&
          !(isChalkboard && chalkboardFullscreen) &&
          !isFloatingPlaylistPanelDragBlockedTarget(
            e.target as HTMLElement,
            root,
          )
        ) {
          const rect = root.getBoundingClientRect()
          const edge = hitTestPanelResizeEdge(
            e.clientX,
            e.clientY,
            rect,
            collapsed,
          )
          chrome.style.cursor = edge ? resizeEdgeToCssCursor(edge) : ''
        } else {
          chrome.style.cursor = ''
        }
      }
      if (!d?.active) return
      if (d.floater) {
        const f = d.floater
        const nx = Math.round(
          f.winStartX + (e.screenX - f.startPtrScreenX),
        )
        const ny = Math.round(
          f.winStartY + (e.screenY - f.startPtrScreenY),
        )
        void window.electronAPI?.playlistFloaterSetBounds?.({
          x: nx,
          y: ny,
          width: f.winW,
          height: f.winH,
        })
        return
      }
      let undockedThisMove = false
      if (planciaDockRight) {
        const plUnd = queryPlanciaContentRect()
        if (
          !plUnd ||
          e.clientX >= plUnd.right - PLANCIA_UNDOCK_DRAG_LEFT_PX
        ) {
          return
        }
        const elUnd = panelRef.current
        if (elUnd) {
          const r = elUnd.getBoundingClientRect()
          patchFloatingPlaylistSession(sessionId, {
            planciaDock: 'none',
            pos: { x: r.left, y: r.top },
          })
          drag.current = {
            active: true,
            dx: r.left,
            dy: r.top,
            startX: e.clientX,
            startY: e.clientY,
          }
          undockedThisMove = true
        } else {
          return
        }
      }
      const dWork = drag.current
      if (!dWork?.active) return
      const el = panelRef.current
      if (!el) return
      if (planciaDockRight && !undockedThisMove) return
      const nx = dWork.dx + (e.clientX - dWork.startX)
      const ny = dWork.dy + (e.clientY - dWork.startY)
      const plancia = snapEnabled ? queryPlanciaContentRect() : null
      let c = clampPosToViewport(nx, ny, el.offsetWidth, el.offsetHeight, {
        rightInset: rightPlanciaDockWidthPx,
      })
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
          { rightInset: rightPlanciaDockWidthPx },
        )
      }
      updateFloatingPlaylistChrome(sessionId, { pos: c })
    },
    [
      chalkboardFullscreen,
      collapsed,
      dragSnapPeerRects,
      isChalkboard,
      isPlaylistOsFloaterWindow,
      patchFloatingPlaylistSession,
      planciaDockRight,
      resizePlaylistWithSnap,
      rightPlanciaDockWidthPx,
      sessionId,
      snapEnabled,
      updateFloatingPlaylistChrome,
    ],
  )

  const onPanelPointerLeave = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (resizeStateRef.current || drag.current?.active) return
      e.currentTarget.style.cursor = ''
    },
    [],
  )

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rs = resizeStateRef.current
      if (rs) {
        const dx = e.clientX - rs.startX
        const dy = e.clientY - rs.startY
        const { pos: np, size: ns } = resizePlaylistWithSnap(
          rs.edge,
          rs.startPos,
          rs.startSize,
          dx,
          dy,
        )
        updateFloatingPlaylistChrome(sessionId, { pos: np, panelSize: ns })
        if (isPlaylistOsFloaterWindow) {
          void window.electronAPI?.playlistFloaterSetBounds?.({
            x: Math.round(window.screenX + np.x),
            y: Math.round(window.screenY + np.y),
            width: Math.round(ns.width),
            height: Math.round(ns.height),
          })
        }
        persistLayoutToLs(sessionId, np, ns, {
          muted: playlistOutputMuted,
          volume: playlistOutputVolume,
          ...(planciaDockRight ? { planciaDock: 'right' as const } : {}),
        })
        resizeStateRef.current = null
        setIsResizing(false)
        if (panelRef.current) panelRef.current.style.cursor = ''
        try {
          panelRef.current?.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }
      const d = drag.current
      if (!d?.active) return
      d.active = false
      if (panelRef.current) panelRef.current.style.cursor = ''
      if (planciaDockRight) {
        persistLayoutToLs(sessionId, pos, panelSize, {
          muted: playlistOutputMuted,
          volume: playlistOutputVolume,
          planciaDock: 'right',
        })
        try {
          panelRef.current?.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }
      if (d.floater) {
        const f = d.floater
        const nx = Math.round(
          f.winStartX + (e.screenX - f.startPtrScreenX),
        )
        const ny = Math.round(
          f.winStartY + (e.screenY - f.startPtrScreenY),
        )
        void window.electronAPI?.playlistFloaterSetBounds?.({
          x: nx,
          y: ny,
          width: f.winW,
          height: f.winH,
        })
        const zero = { x: 0, y: 0 }
        updateFloatingPlaylistChrome(sessionId, { pos: zero })
        persistLayoutToLs(sessionId, zero, panelSize, {
          muted: playlistOutputMuted,
          volume: playlistOutputVolume,
        })
        try {
          panelRef.current?.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }
      const el = panelRef.current
      const nx = d.dx + (e.clientX - d.startX)
      const ny = d.dy + (e.clientY - d.startY)
      const plancia = snapEnabled ? queryPlanciaContentRect() : null
      let next = el
        ? clampPosToViewport(nx, ny, el.offsetWidth, el.offsetHeight, {
            rightInset: rightPlanciaDockWidthPx,
          })
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
          { rightInset: rightPlanciaDockWidthPx },
        )
      }
      if (
        snapEnabled &&
        el &&
        session?.planciaDock !== 'right'
      ) {
        const panelW = el.offsetWidth
        const panelH = el.offsetHeight
        const nearScreenRight =
          window.innerWidth - (next.x + panelW) <=
          PLANCIA_DOCK_SCREEN_RIGHT_PX
        const overlapsPlanciaVert =
          plancia &&
          next.y + panelH >= plancia.top &&
          next.y <= plancia.bottom
        if (nearScreenRight && overlapsPlanciaVert) {
          updateFloatingPlaylistChrome(sessionId, { pos: next })
          dockFloatingPlaylistToPlanciaRight(sessionId)
          persistLayoutToLs(sessionId, next, panelSize, {
            muted: playlistOutputMuted,
            volume: playlistOutputVolume,
            planciaDock: 'right',
          })
          try {
            panelRef.current?.releasePointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
          return
        }
      }
      updateFloatingPlaylistChrome(sessionId, { pos: next })
      persistLayoutToLs(sessionId, next, panelSize, {
        muted: playlistOutputMuted,
        volume: playlistOutputVolume,
        planciaDock: 'none',
      })
      try {
        panelRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [
      dockFloatingPlaylistToPlanciaRight,
      dragSnapPeerRects,
      isPlaylistOsFloaterWindow,
      panelSize,
      planciaDockRight,
      playlistOutputMuted,
      playlistOutputVolume,
      pos,
      resizePlaylistWithSnap,
      rightPlanciaDockWidthPx,
      session,
      sessionId,
      snapEnabled,
      updateFloatingPlaylistChrome,
    ],
  )

  const onPlaylistPanelVolumePointerDown = useCallback(() => {
    recordUndoPoint()
  }, [recordUndoPoint])

  const onPlaylistPanelVolumeChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = Number.parseInt(e.target.value, 10) / 100
      const c = Math.min(1, Math.max(0, v))
      setPlaylistOutputVolume(c, sessionId)
      persistLayoutToLs(sessionId, pos, panelSize, {
        muted: playlistOutputMuted,
        volume: c,
        ...(session?.planciaDock === 'right'
          ? { planciaDock: 'right' as const }
          : {}),
      })
    },
    [
      panelSize,
      playlistOutputMuted,
      pos,
      session,
      sessionId,
      setPlaylistOutputVolume,
    ],
  )

  const onTogglePlaylistOutputMute = useCallback(() => {
    const next = !playlistOutputMuted
    setPlaylistOutputMuted(next, sessionId)
    persistLayoutToLs(sessionId, pos, panelSize, {
      muted: next,
      volume: playlistOutputVolume,
      ...(session?.planciaDock === 'right'
        ? { planciaDock: 'right' as const }
        : {}),
    })
  }, [
    panelSize,
    playlistOutputMuted,
    playlistOutputVolume,
    pos,
    session,
    sessionId,
    setPlaylistOutputMuted,
  ])

  useEffect(() => {
    const onDocDragEnd = () => {
      setInternalDropInsertBefore(null)
      setPlaylistRowDragSourceIndex(null)
      setLaunchPadDragSourceSlot(null)
    }
    document.addEventListener('dragend', onDocDragEnd)
    return () => document.removeEventListener('dragend', onDocDragEnd)
  }, [])

  const onPlaylistRowDragStart = useCallback(
    (index: number, e: DragEvent<HTMLLIElement>) => {
      if (!session || isLaunchpad || panelLocked) return
      const t = e.target as HTMLElement
      if (t.closest('.playlist-remove-btn')) {
        e.preventDefault()
        return
      }
      e.dataTransfer.effectAllowed = 'move'
      setPlaylistRowDragSourceIndex(index)
      const p = paths[index]
      const label = p ? (p.split(/[/\\]/).pop() ?? p) : `Brano ${index + 1}`
      setRegiaDnDDragImage(e, label)
      const payload = {
        v: 1 as const,
        kind: 'playlist-track' as const,
        sessionId,
        index,
      }
      const raw = stringifyRegiaFloatingDnDPayload(payload)
      e.dataTransfer.setData(REGIA_FLOATING_DND_MIME, raw)
      e.dataTransfer.setData('text/plain', raw)
    },
    [isLaunchpad, panelLocked, paths, session, sessionId],
  )

  const onPlaylistRowContextMenu = useCallback(
    (slotIndex: number, e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (isLaunchpad) return
      setPlaylistTrackCtxSlot(slotIndex)
    },
    [isLaunchpad],
  )

  const onPlaylistRowDragEnd = useCallback(() => {
    setPlaylistRowDragSourceIndex(null)
    suppressPlaylistRowClickRef.current = true
    window.setTimeout(() => {
      suppressPlaylistRowClickRef.current = false
    }, 80)
  }, [])

  const onLaunchPadCellDragStart = useCallback(
    (slotIndex: number, e: DragEvent<HTMLButtonElement>) => {
      if (!session || !isLaunchpad || panelLocked) return
      const cell = launchPadCells?.[slotIndex]
      if (!cell?.samplePath) return
      e.dataTransfer.effectAllowed = 'move'
      setLaunchPadDragSourceSlot(slotIndex)
      const bi = Math.max(
        0,
        Math.min(LAUNCHPAD_BANK_COUNT - 1, launchPadBankIndex),
      )
      const payload = {
        v: 1 as const,
        kind: 'launchpad-slot' as const,
        sessionId,
        bankIndex: bi,
        slotIndex,
      }
      const raw = stringifyRegiaFloatingDnDPayload(payload)
      e.dataTransfer.setData(REGIA_FLOATING_DND_MIME, raw)
      e.dataTransfer.setData('text/plain', raw)
      const label = launchPadCellShownLabel(cell)
      setRegiaDnDDragImage(e, label, { maxWidthPx: 240 })
    },
    [isLaunchpad, launchPadBankIndex, launchPadCells, panelLocked, session, sessionId],
  )

  const commitFloatingPlaylistTitle = useCallback(
    async (raw: string) => {
      if (panelLocked) return
      const t = raw.trim().slice(0, 120)
      if (t !== playlistTitle.trim()) {
        recordUndoPoint()
        setPlaylistTitle(t, sessionId)
      }
      await persistSavedPlaylistAfterFloatingTitleBlur(t, sessionId)
    },
    [
      panelLocked,
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
      /** Tenendo premuto Invio il browser emette keydown con `repeat`: ogni tick richiamerebbe il salvataggio. */
      if (e.repeat) return
      e.preventDefault()
      const el = e.currentTarget
      suppressNextTitleBlurPersistRef.current = true
      void (async () => {
        try {
          await commitFloatingPlaylistTitle(el.value)
        } finally {
          el.blur()
        }
      })()
    },
    [commitFloatingPlaylistTitle],
  )

  useEffect(() => {
    if (!launchPadCtx) return
    const close = () => setLaunchPadCtx(null)
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onMouseDown = (e: globalThis.MouseEvent) => {
      if (e.button !== 0) return
      const t = e.target
      if (t instanceof Node && launchPadMenuRef.current?.contains(t)) return
      close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouseDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [launchPadCtx])

  useEffect(() => {
    if (!isLaunchpad || collapsed) setPadKeyLearnSlot(null)
  }, [isLaunchpad, collapsed])

  useEffect(() => {
    if (padKeyLearnSlot === null) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.code === 'Escape') {
        setPadKeyLearnSlot(null)
        return
      }
      if (!canAssignLaunchPadKeyCode(e.code)) return
      void updateLaunchPadCell(sessionId, padKeyLearnSlot, {
        padKeyCode: e.code,
      })
      setPadKeyLearnSlot(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [padKeyLearnSlot, sessionId, updateLaunchPadCell])

  const openLaunchPadPlanciaMenu = useCallback(
    (slotIndex: number) => {
      setActiveFloatingSession(sessionId)
      setPadKeyLearnSlot(null)
      setLaunchPadCtx({ slot: slotIndex })
    },
    [sessionId, setActiveFloatingSession],
  )

  const onLaunchPadCellContextMenu = useCallback(
    (slotIndex: number, e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (skipLaunchPadCtxMenuDupRef.current) {
        skipLaunchPadCtxMenuDupRef.current = false
        return
      }
      openLaunchPadPlanciaMenu(slotIndex)
    },
    [openLaunchPadPlanciaMenu],
  )

  const armSuppressNextLaunchPadClick = useCallback((slotIndex: number) => {
    if (suppressLaunchPadClickClearTimeoutRef.current) {
      clearTimeout(suppressLaunchPadClickClearTimeoutRef.current)
      suppressLaunchPadClickClearTimeoutRef.current = null
    }
    suppressLaunchPadClickSlotRef.current = slotIndex
    suppressLaunchPadClickClearTimeoutRef.current = setTimeout(() => {
      suppressLaunchPadClickClearTimeoutRef.current = null
      if (suppressLaunchPadClickSlotRef.current === slotIndex) {
        suppressLaunchPadClickSlotRef.current = null
      }
    }, 500)
  }, [])

  const onLaunchPadCellClick = useCallback(
    (slotIndex: number, e: MouseEvent<HTMLButtonElement>) => {
      if (suppressLaunchPadClickSlotRef.current === slotIndex) {
        suppressLaunchPadClickSlotRef.current = null
        if (suppressLaunchPadClickClearTimeoutRef.current) {
          clearTimeout(suppressLaunchPadClickClearTimeoutRef.current)
          suppressLaunchPadClickClearTimeoutRef.current = null
        }
        e.preventDefault()
        e.stopPropagation()
        return
      }
      setActiveFloatingSession(sessionId)
      if (e.shiftKey) {
        e.preventDefault()
        void (async () => {
          const picked = await window.electronAPI.selectMediaFiles({
            context: 'launchpad',
          })
          if (!picked?.length) return
          applyLaunchPadDropFromPaths(sessionId, slotIndex, picked)
        })()
        return
      }
      if (e.altKey) {
        e.preventDefault()
        setPadColorPickIndex(slotIndex)
        queueMicrotask(() => padColorInputRef.current?.click())
        return
      }
      const cell = launchPadCells?.[slotIndex]
      if (!cell?.samplePath) {
        e.preventDefault()
        void (async () => {
          const picked = await window.electronAPI.selectMediaFiles({
            context: 'launchpad',
          })
          if (!picked?.length) return
          applyLaunchPadDropFromPaths(sessionId, slotIndex, picked)
        })()
        return
      }
      setPadFlashSlot(slotIndex)
      window.setTimeout(() => {
        setPadFlashSlot((cur) => (cur === slotIndex ? null : cur))
      }, 200)
      void loadLaunchPadSlotAndPlay(sessionId, slotIndex)
    },
    [
      sessionId,
      launchPadCells,
      loadLaunchPadSlotAndPlay,
      setActiveFloatingSession,
      applyLaunchPadDropFromPaths,
    ],
  )

  const onLaunchPadSamplePointerDown = useCallback(
    (slotIndex: number, e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      if (e.shiftKey || e.altKey) return
      const cell = launchPadCells?.[slotIndex]
      if (!cell?.samplePath) return

      const pointerId = e.pointerId
      if (launchPadSampleGesturesRef.current.has(pointerId)) return

      setActiveFloatingSession(sessionId)

      const el = e.currentTarget
      try {
        el.setPointerCapture(pointerId)
      } catch {
        /* setPointerCapture non disponibile */
      }

      const bi = launchPadBankIndex
      const gesture = {
        slotIndex,
        pointerId,
        startX: e.clientX,
        startY: e.clientY,
        cueActive: false,
        cancelled: false,
        timer: null as ReturnType<typeof setTimeout> | null,
        cueVoiceId: null as number | null,
      }
      launchPadSampleGesturesRef.current.set(pointerId, gesture)

      const clearTimer = () => {
        const g = launchPadSampleGesturesRef.current.get(pointerId)
        if (g?.timer != null) {
          clearTimeout(g.timer)
          g.timer = null
        }
      }

      const onMove = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const g = launchPadSampleGesturesRef.current.get(pointerId)
        if (!g || g.slotIndex !== slotIndex || g.cueActive) return
        const dx = ev.clientX - g.startX
        const dy = ev.clientY - g.startY
        if (
          dx * dx + dy * dy >
          LAUNCHPAD_CANCEL_MOVE_PX * LAUNCHPAD_CANCEL_MOVE_PX
        ) {
          g.cancelled = true
          clearTimer()
        }
      }

      const onUpOrCancel = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const g = launchPadSampleGesturesRef.current.get(pointerId)
        if (!g || g.slotIndex !== slotIndex) return
        if (ev.type === 'pointercancel') {
          g.cancelled = true
        }
        clearTimer()
        armSuppressNextLaunchPadClick(slotIndex)
        if (!g.cueActive && g.cancelled) {
          detachListeners()
          return
        }
        if (g.cueActive) {
          releaseLaunchPadCueVoice(
            g.cueVoiceId,
            sessionId,
            bi,
            slotIndex,
          )
        } else {
          setPadFlashSlot(slotIndex)
          window.setTimeout(() => {
            setPadFlashSlot((cur) => (cur === slotIndex ? null : cur))
          }, 200)
          void loadLaunchPadSlotAndPlay(sessionId, slotIndex)
        }
        detachListeners()
      }

      const detachListeners = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUpOrCancel)
        el.removeEventListener('pointercancel', onUpOrCancel)
        try {
          el.releasePointerCapture(pointerId)
        } catch {
          /* */
        }
        launchPadSampleGesturesRef.current.delete(pointerId)
      }

      if (launchPadCueEnabled) {
        gesture.timer = setTimeout(() => {
          const g = launchPadSampleGesturesRef.current.get(pointerId)
          if (!g || g.slotIndex !== slotIndex || g.cancelled) return
          g.cueActive = true
          g.timer = null
          setPadFlashSlot(slotIndex)
          window.setTimeout(() => {
            setPadFlashSlot((cur) => (cur === slotIndex ? null : cur))
          }, 200)
          void loadLaunchPadSlotAndPlay(sessionId, slotIndex).then((vid) => {
            const live = launchPadSampleGesturesRef.current.get(pointerId)
            if (!live || live.slotIndex !== slotIndex) return
            if (typeof vid === 'number') live.cueVoiceId = vid
          })
        }, LAUNCHPAD_CUE_HOLD_MS)
      }

      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUpOrCancel)
      el.addEventListener('pointercancel', onUpOrCancel)
    },
    [
      sessionId,
      launchPadBankIndex,
      launchPadCells,
      setActiveFloatingSession,
      loadLaunchPadSlotAndPlay,
      releaseLaunchPadCueVoice,
      armSuppressNextLaunchPadClick,
      launchPadCueEnabled,
    ],
  )

  const onLaunchPadPadPointerDown = useCallback(
    (slotIndex: number, e: PointerEvent<HTMLButtonElement>) => {
      if (e.button === 2) {
        e.preventDefault()
        e.stopPropagation()
        skipLaunchPadCtxMenuDupRef.current = true
        openLaunchPadPlanciaMenu(slotIndex)
        return
      }
      onLaunchPadSamplePointerDown(slotIndex, e)
    },
    [openLaunchPadPlanciaMenu, onLaunchPadSamplePointerDown],
  )

  const onLaunchPadCellKeyDown = useCallback(
    (slotIndex: number, e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const cell = launchPadCells?.[slotIndex]
      if (!cell?.samplePath) return
      if (e.shiftKey || e.altKey) return
      e.preventDefault()
      setActiveFloatingSession(sessionId)
      armSuppressNextLaunchPadClick(slotIndex)
      setPadFlashSlot(slotIndex)
      window.setTimeout(() => {
        setPadFlashSlot((cur) => (cur === slotIndex ? null : cur))
      }, 200)
      void loadLaunchPadSlotAndPlay(sessionId, slotIndex)
    },
    [
      sessionId,
      launchPadCells,
      setActiveFloatingSession,
      loadLaunchPadSlotAndPlay,
      armSuppressNextLaunchPadClick,
    ],
  )

  const playlistListDragAllowed = useCallback((dt: DataTransfer | null) => {
    return dataTransferHasFileList(dt) || dataTransferHasFloatingInternal(dt)
  }, [])

  const onPlaylistDragEnter = useCallback(
    (e: DragEvent<HTMLUListElement>) => {
      if (panelLocked) return
      if (!playlistListDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      playlistDndDepth.current += 1
      setPlaylistDropHover(true)
      if (dataTransferHasFloatingInternal(e.dataTransfer)) {
        setInternalDropInsertBefore(
          pickPlaylistInsertBeforeIndex(
            listRef.current,
            e.clientX,
            e.clientY,
            paths.length,
          ),
        )
      } else if (dataTransferHasFileList(e.dataTransfer)) {
        setInternalDropInsertBefore(
          pickPlaylistInsertBeforeIndex(
            listRef.current,
            e.clientX,
            e.clientY,
            paths.length,
          ),
        )
      } else {
        setInternalDropInsertBefore(null)
      }
    },
    [panelLocked, paths.length, playlistListDragAllowed],
  )

  const onPlaylistDragLeave = useCallback(
    (e: DragEvent<HTMLUListElement>) => {
      if (panelLocked) return
      if (!playlistListDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      playlistDndDepth.current = Math.max(0, playlistDndDepth.current - 1)
      if (playlistDndDepth.current === 0) {
        setPlaylistDropHover(false)
        setInternalDropInsertBefore(null)
      }
    },
    [panelLocked, playlistListDragAllowed],
  )

  const onPlaylistDragOver = useCallback(
    (e: DragEvent<HTMLUListElement>) => {
      if (panelLocked) return
      if (!playlistListDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      const dt = e.dataTransfer
      if (dataTransferHasFloatingInternal(dt)) {
        dt.dropEffect = 'move'
        setInternalDropInsertBefore(
          pickPlaylistInsertBeforeIndex(
            listRef.current,
            e.clientX,
            e.clientY,
            paths.length,
          ),
        )
      } else if (dataTransferHasFileList(dt)) {
        dt.dropEffect = 'copy'
        setInternalDropInsertBefore(
          pickPlaylistInsertBeforeIndex(
            listRef.current,
            e.clientX,
            e.clientY,
            paths.length,
          ),
        )
      } else {
        dt.dropEffect = 'none'
        setInternalDropInsertBefore(null)
      }
    },
    [panelLocked, paths.length, playlistListDragAllowed],
  )

  const onPlaylistDrop = useCallback(
    async (e: DragEvent<HTMLUListElement>) => {
      if (panelLocked) return
      if (!playlistListDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      playlistDndDepth.current = 0
      setPlaylistDropHover(false)
      setInternalDropInsertBefore(null)
      const dt = e.dataTransfer
      const internal = parseRegiaFloatingDnDPayload(dt)
      if (internal) {
        const insertBefore = pickPlaylistInsertBeforeIndex(
          listRef.current,
          e.clientX,
          e.clientY,
          paths.length,
        )
        setActiveFloatingSession(sessionId)
        await applyFloatingInternalDrop({
          target: {
            kind: 'playlist',
            sessionId,
            insertBeforeIndex: insertBefore,
          },
          payload: internal,
        })
        return
      }
      const pathsDropped = mediaPathsFromDataTransfer(dt)
      if (!pathsDropped.length) return
      setActiveFloatingSession(sessionId)
      const insertBefore = pickPlaylistInsertBeforeIndex(
        listRef.current,
        e.clientX,
        e.clientY,
        paths.length,
      )
      addPathsToPlaylistFromPaths(sessionId, pathsDropped, insertBefore)
    },
    [
      addPathsToPlaylistFromPaths,
      applyFloatingInternalDrop,
      panelLocked,
      paths.length,
      playlistListDragAllowed,
      sessionId,
      setActiveFloatingSession,
    ],
  )

  const launchpadDragAllowed = useCallback((dt: DataTransfer | null) => {
    return dataTransferHasFileList(dt) || dataTransferHasFloatingInternal(dt)
  }, [])

  const onLaunchpadDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (panelLocked) return
      if (!launchpadDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      launchpadDndDepth.current += 1
      setLaunchpadDropHover(true)
    },
    [launchpadDragAllowed, panelLocked],
  )

  const onLaunchpadDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (panelLocked) return
      if (!launchpadDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      launchpadDndDepth.current = Math.max(0, launchpadDndDepth.current - 1)
      if (launchpadDndDepth.current === 0) setLaunchpadDropHover(false)
    },
    [launchpadDragAllowed, panelLocked],
  )

  const onLaunchpadDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (panelLocked) return
      if (!launchpadDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = dataTransferHasFloatingInternal(
        e.dataTransfer,
      )
        ? 'move'
        : 'copy'
    },
    [launchpadDragAllowed, panelLocked],
  )

  const onLaunchPadCellDrop = useCallback(
    async (slotIndex: number, e: DragEvent<HTMLDivElement>) => {
      if (panelLocked) return
      if (!launchpadDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
      launchpadDndDepth.current = 0
      setLaunchpadDropHover(false)
      const dt = e.dataTransfer
      const internal = parseRegiaFloatingDnDPayload(dt)
      if (internal) {
        setActiveFloatingSession(sessionId)
        await applyFloatingInternalDrop({
          target: { kind: 'launchpad', sessionId, slotIndex },
          payload: internal,
        })
        return
      }
      const pathsDropped = mediaPathsFromDataTransfer(dt)
      if (!pathsDropped.length) return
      setActiveFloatingSession(sessionId)
      applyLaunchPadDropFromPaths(sessionId, slotIndex, pathsDropped)
    },
    [
      applyFloatingInternalDrop,
      applyLaunchPadDropFromPaths,
      launchpadDragAllowed,
      panelLocked,
      sessionId,
      setActiveFloatingSession,
    ],
  )

  const onLaunchPadGridBackgroundDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      if (panelLocked) return
      if (e.target !== e.currentTarget) return
      if (!launchpadDragAllowed(e.dataTransfer)) return
      e.preventDefault()
      launchpadDndDepth.current = 0
      setLaunchpadDropHover(false)
      const dt = e.dataTransfer
      const internal = parseRegiaFloatingDnDPayload(dt)
      const cells = launchPadCells
      if (!cells) return
      const firstEmpty = cells.findIndex((c) => !c.samplePath)
      const start = firstEmpty >= 0 ? firstEmpty : 0
      if (internal) {
        setActiveFloatingSession(sessionId)
        await applyFloatingInternalDrop({
          target: { kind: 'launchpad', sessionId, slotIndex: start },
          payload: internal,
        })
        return
      }
      const pathsDropped = mediaPathsFromDataTransfer(dt)
      if (!pathsDropped.length) return
      setActiveFloatingSession(sessionId)
      applyLaunchPadDropFromPaths(sessionId, start, pathsDropped)
    },
    [
      applyFloatingInternalDrop,
      applyLaunchPadDropFromPaths,
      launchPadCells,
      launchpadDragAllowed,
      panelLocked,
      sessionId,
      setActiveFloatingSession,
    ],
  )

  const onSottofondoPanelPlay = useCallback(() => {
    if (!paths.length) return
    void loadIndexAndPlay(currentIndex, sessionId)
  }, [paths.length, currentIndex, sessionId, loadIndexAndPlay])

  const onSottofondoPanelStop = useCallback(() => {
    void stopSottofondoPlayback()
  }, [stopSottofondoPlayback])

  const onPanelKeyDownCapture = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (collapsed || isLaunchpad || isChalkboard || !paths.length) return
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
    [
      collapsed,
      isLaunchpad,
      isChalkboard,
      paths.length,
      currentIndex,
      loadIndexAndPlay,
      sessionId,
    ],
  )

  const onBackdropPointerDownClosePlayConfirm = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) setClosePlayConfirmOpen(false)
    },
    [],
  )

  const onRequestClosePanel = useCallback(() => {
    if (floatingCloseWouldInterruptPlay(sessionId)) {
      setClosePlayConfirmOpen(true)
      return
    }
    void removeFloatingPlaylist(sessionId)
  }, [floatingCloseWouldInterruptPlay, removeFloatingPlaylist, sessionId])

  const onConfirmClosePanelDespitePlay = useCallback(() => {
    setClosePlayConfirmOpen(false)
    void removeFloatingPlaylist(sessionId)
  }, [removeFloatingPlaylist, sessionId])

  useEffect(() => {
    if (!closePlayConfirmOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setClosePlayConfirmOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    queueMicrotask(() => {
      closePlayConfirmCancelRef.current?.focus()
    })
    return () => window.removeEventListener('keydown', onKey)
  }, [closePlayConfirmOpen])

  useEffect(() => {
    if (!session) setClosePlayConfirmOpen(false)
  }, [session])

  useEffect(() => {
    if (!isChalkboard) chalkboardPreFullscreenRef.current = null
  }, [isChalkboard])

  const toggleChalkboardFullscreen = useCallback(() => {
    const s = floatingPlaylistSessions.find((x) => x.id === sessionId)
    if (!s || s.playlistMode !== 'chalkboard') return
    if (s.chalkboardFullscreen === true) {
      const bak = chalkboardPreFullscreenRef.current
      updateFloatingPlaylistChrome(sessionId, {
        chalkboardFullscreen: false,
        pos: bak?.pos ?? s.pos,
        panelSize: bak?.panelSize ?? s.panelSize,
      })
      chalkboardPreFullscreenRef.current = null
      return
    }
    chalkboardPreFullscreenRef.current = {
      pos: { ...s.pos },
      panelSize: { ...s.panelSize },
    }
    updateFloatingPlaylistChrome(sessionId, {
      chalkboardFullscreen: true,
      collapsed: false,
    })
    bringFloatingPanelToFront(sessionId)
  }, [
    floatingPlaylistSessions,
    sessionId,
    updateFloatingPlaylistChrome,
    bringFloatingPanelToFront,
  ])

  useEffect(() => {
    if (!isChalkboard || !chalkboardFullscreen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const raw = e.target as HTMLElement | null
      if (raw?.closest('.floating-playlist-chalkboard-text-editor-wrap')) return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      const s = floatingPlaylistSessions.find((x) => x.id === sessionId)
      if (!s) return
      const bak = chalkboardPreFullscreenRef.current
      updateFloatingPlaylistChrome(sessionId, {
        chalkboardFullscreen: false,
        pos: bak?.pos ?? s.pos,
        panelSize: bak?.panelSize ?? s.panelSize,
      })
      chalkboardPreFullscreenRef.current = null
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    isChalkboard,
    chalkboardFullscreen,
    sessionId,
    floatingPlaylistSessions,
    updateFloatingPlaylistChrome,
  ])

  if (!session) {
    if (isPlaylistOsFloaterWindow) {
      return (
        <div
          className="floating-playlist floating-playlist--floater-missing-session"
          style={{
            boxSizing: 'border-box',
            width: '100%',
            minHeight: '100vh',
            padding: '1.25rem',
            background: '#13151a',
            color: '#a1a7b3',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: '0 0 0.75rem' }}>
            Sessione playlist non trovata nello stato sincronizzato. Chiudi la
            finestra e riprova dalla regia, oppure usa il pulsante puntina per
            disattivare.
          </p>
          <button
            type="button"
            className="floating-playlist-icon-btn"
            onClick={() => {
              void removeFloatingPlaylist(sessionId)
            }}
          >
            Chiudi finestra
          </button>
        </div>
      )
    }
    return null
  }

  const themeHex = normalizePlaylistThemeColor(session.playlistThemeColor)
  const colorPickerValue =
    themeHex || PLAYLIST_THEME_COLOR_INPUT_DEFAULT

  const zi = floatingZOrder.indexOf(sessionId)
  const zIndex = 40 + (zi >= 0 ? zi : 0)
  const presenterWizardZBase =
    isChalkboard && chalkboardFullscreen ? 20000 : zIndex

  const ctxSlotCell =
    launchPadCtx && launchPadCells
      ? launchPadCells[launchPadCtx.slot]
      : null
  const ctxMenuGain =
    typeof ctxSlotCell?.padGain === 'number' &&
    Number.isFinite(ctxSlotCell.padGain)
      ? Math.min(1, Math.max(0, ctxSlotCell.padGain))
      : 1

  const panelHelpMeasureBounds = panelHelpOpen
    ? getPanelHelpClampBounds()
    : null
  const panelHelpMeasureInnerW = panelHelpMeasureBounds
    ? Math.max(0, panelHelpMeasureBounds.right - panelHelpMeasureBounds.left)
    : PANEL_HELP_POPOVER_MAX_W_PX
  const panelHelpMeasureWidth = panelHelpMeasureBounds
    ? Math.min(
        PANEL_HELP_POPOVER_MAX_W_PX,
        panelHelpMeasureInnerW < 100
          ? panelHelpMeasureInnerW
          : Math.max(100, panelHelpMeasureInnerW),
      )
    : PANEL_HELP_POPOVER_MAX_W_PX

  return (
    <Fragment>
    <div
      ref={panelRef}
      className={`floating-playlist ${isLaunchpad ? 'is-launchpad' : ''} ${isChalkboard ? 'is-chalkboard' : ''} ${isSottofondo ? 'is-sottofondo' : ''} ${chalkboardFullscreen ? 'is-chalkboard-fullscreen' : ''} ${collapsed ? 'is-collapsed' : ''} ${isResizing ? 'is-panel-resizing' : ''} ${themeHex ? 'has-theme' : ''}${isLiveOnRegiaOutput ? ' is-live-output' : ''}${planciaDockRight ? ' floating-playlist--plancia-dock-right' : ''}`}
      style={{
        ...(chalkboardFullscreen
          ? {
              left: 0,
              top: 0,
              width: '100vw',
              height: collapsed ? undefined : '100vh',
              maxWidth: '100vw',
              maxHeight: collapsed ? undefined : '100vh',
              zIndex: 20000,
            }
          : planciaDockRight
            ? {
                width: '100%',
                zIndex: 1,
              }
            : {
                left: pos.x,
                top: pos.y,
                zIndex,
                width: panelSize.width,
                height: collapsed ? undefined : panelSize.height,
              }),
        ...(themeHex ? { ['--playlist-theme' as string]: themeHex } : {}),
      }}
      onKeyDownCapture={onPanelKeyDownCapture}
      onPointerDownCapture={onPanelChromePointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerLeave={onPanelPointerLeave}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <RegiaPanelHintHost
        className="floating-playlist-hint-column"
        mainClassName="floating-playlist-hint-main"
        defaultHint={panelDefaultHint}
        hintAriaLabel="Suggerimenti pannello"
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
      {isLaunchpad ? (
        <input
          ref={padColorInputRef}
          type="color"
          className="floating-playlist-color-input"
          aria-hidden
          tabIndex={-1}
          value={
            padColorPickIndex != null && launchPadCells
              ? normalizePlaylistThemeColor(
                  launchPadCells[padColorPickIndex]?.padColor ?? '',
                ) || PLAYLIST_THEME_COLOR_INPUT_DEFAULT
              : PLAYLIST_THEME_COLOR_INPUT_DEFAULT
          }
          onChange={(ev) => {
            if (padColorPickIndex == null) return
            void updateLaunchPadCell(sessionId, padColorPickIndex, {
              padColor: ev.target.value,
            })
          }}
          onBlur={() => setPadColorPickIndex(null)}
        />
      ) : null}
      <div
        className="floating-playlist-top"
        data-preview-hint={panelHeaderStripHint}
      >
        <div className="floating-playlist-title-strip">
          <div className="floating-playlist-title-strip-main">
            <span
              className={`floating-playlist-panel-kind ${
                isLaunchpad
                  ? 'is-launchpad'
                  : isChalkboard
                    ? 'is-chalkboard'
                    : isSottofondo
                      ? 'is-sottofondo'
                      : 'is-playlist'
              }`}
            >
              {isLaunchpad
                ? 'Launchpad'
                : isChalkboard
                  ? 'Chalkboard'
                  : isSottofondo
                    ? 'Sottofondo'
                    : 'Playlist'}
            </span>
            <input
              type="text"
              className="floating-playlist-title-input"
              value={playlistTitle}
              readOnly={panelLocked}
              aria-readonly={panelLocked || undefined}
              onChange={(ev) => setPlaylistTitle(ev.target.value, sessionId)}
              onKeyDown={onTitleKeyDown}
              onBlur={(e) => {
                if (suppressNextTitleBlurPersistRef.current) {
                  suppressNextTitleBlurPersistRef.current = false
                  return
                }
                void commitFloatingPlaylistTitle(e.currentTarget.value)
              }}
              placeholder={
                isLaunchpad
                  ? 'Nome o titolo…'
                  : isChalkboard
                    ? 'Nome o titolo…'
                    : isSottofondo
                      ? 'Nome sottofondo…'
                      : 'Nuova playlist'
              }
              aria-label={
                isLaunchpad
                  ? 'Nome del pannello Launchpad'
                  : isChalkboard
                    ? 'Nome del pannello Chalkboard'
                    : isSottofondo
                      ? 'Nome del pannello Sottofondo'
                      : 'Nome della playlist'
              }
              maxLength={120}
              spellCheck={false}
            />
          </div>
          <div
            className="floating-playlist-title-strip-chrome"
            role="group"
            aria-label="Aiuto, fissa in primo piano, tutto schermo lavagna, riduci o chiudi"
          >
            <div className="floating-playlist-help-popover-wrap">
              <button
                ref={panelHelpButtonRef}
                type="button"
                className="floating-playlist-icon-btn floating-playlist-panel-help-btn"
                aria-expanded={panelHelpOpen}
                aria-controls={panelHelpPanelId}
                onClick={() => setPanelHelpOpen((o) => !o)}
                title={
                  isLaunchpad
                    ? 'Istruzioni griglia Launchpad'
                    : isChalkboard
                      ? 'Istruzioni Chalkboard'
                      : 'Istruzioni uso playlist'
                }
                aria-label={
                  isLaunchpad
                    ? 'Apri istruzioni griglia Launchpad'
                    : isChalkboard
                      ? 'Apri istruzioni Chalkboard'
                      : 'Apri istruzioni playlist'
                }
              >
                ?
              </button>
              {panelHelpOpen
                ? createPortal(
                    <div
                      ref={panelHelpPopoverRef}
                      id={panelHelpPanelId}
                      className="floating-playlist-panel-help-popover"
                      role="dialog"
                      aria-label={
                        isLaunchpad
                          ? 'Istruzioni Launchpad'
                          : isChalkboard
                            ? 'Istruzioni Chalkboard'
                            : 'Istruzioni playlist'
                      }
                      onMouseDown={(ev) => ev.stopPropagation()}
                      style={
                        panelHelpLayout
                          ? ({
                              position: 'fixed',
                              top: panelHelpLayout.top,
                              left: panelHelpLayout.left,
                              width: panelHelpLayout.width,
                              maxHeight: panelHelpLayout.maxHeight,
                              zIndex: zIndex + 30,
                            } satisfies CSSProperties)
                          : ({
                              position: 'fixed',
                              left: 0,
                              top: 0,
                              width: panelHelpMeasureWidth,
                              maxHeight: 'none',
                              zIndex: zIndex + 30,
                              opacity: 0,
                              pointerEvents: 'none',
                            } satisfies CSSProperties)
                      }
                    >
                      {isChalkboard ? (
                        <>
                          Quattro banchi (tab 1–4) con lavagna alla risoluzione uscita:
                          pennello, gomma, testo, immagine da file. «In uscita» sovrappone
                          il banco corrente al video sul monitor 2. Il pulsante con angoli
                          accanto a «Riduci» apre la lavagna a tutto schermo (Esc per
                          uscire, tranne mentre scrivi nel campo testo). Salva su disco con
                          il pulsante disco in barra (come playlist e launchpad).
                        </>
                      ) : isLaunchpad ? (
                        <>
                          Griglia 4×4 (pagine 1–{LAUNCHPAD_BANK_COUNT}, 16 pad ciascuna):
                          slot vuoto → dialog file · trascina file su slot o griglia ·
                          Maiusc+clic file · Alt+clic colore ·{' '}
                          {launchPadCueEnabled
                            ? 'tap breve = play intero · tenere premuto = CUE (audio fino al rilascio)'
                            : 'clic = play intero (CUE disattivato in Impostazioni)'}
                          {' '}
                          · tasto destro: gain / tasto / svuota · tasto: Play sempre play,
                          Toggle play/stop
                          {launchPadCueEnabled
                            ? ' · tenere premuto il tasto = CUE (senza modificatori)'
                            : ''}{' '}
                          · puntina tra «?» e Riduci: apre questo pannello in una{' '}
                          <strong>finestra Electron separata</strong> sul desktop (anche
                          fuori dalla finestra Regia; resta visibile se riduci solo la
                          regia). Chiudendo quella finestra il pannello torna nella Regia.
                          Se nascondi <strong>tutta</strong> l’applicazione (es. «Nascondi»
                          su macOS), il sistema nasconde anche quella finestra.
                        </>
                      ) : (
                        <div className="floating-playlist-panel-help-popover-stack">
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Titolo</strong> — Modifica il nome nel campo in alto;
                            uscendo dal campo o premendo Invio il titolo viene aggiornato
                            nello stato del pannello.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Riduci / Chiudi</strong> — Riduci mostra solo la barra
                            compatta con i comandi principali. Chiudi rimuove questo
                            pannello dalla plancia.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Puntina (finestra separata)</strong> — Con la puntina
                            attiva questo pannello passa in una <strong>finestra Electron
                            propria</strong> sul desktop: puoi spostarla anche{' '}
                            <strong>fuori dalla finestra Regia</strong> e resta utilizzabile
                            anche se <strong>riduci a icona solo la regia principale</strong>.
                            Chiudi la finestra del pannello per riportarlo dentro la Regia.
                            Se nascondi <strong>tutta</strong> l’app (Dock / «Nascondi» su
                            macOS), il sistema nasconde tutte le sue finestre.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Cartella e Aggiungi</strong> — Cartella apre una
                            cartella sul disco per caricare i file. Aggiungi apre il
                            dialog per scegliere singoli media. Puoi anche{' '}
                            <strong>trascinare file</strong> (audio, video, immagini)
                            sull&apos;area dell&apos;elenco.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Colore tema</strong> — Clic sul pulsante colore per
                            il selettore. <strong>Alt+clic</strong> ripristina il tema
                            predefinito del pannello.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Salva (disco)</strong> — Sovrascrive la voce in
                            PLAYLIST che hai aperto con Carica; il pulsante si accende
                            solo se ci sono modifiche non ancora salvate su quel file. Sul{' '}
                            <strong>Sottofondo</strong> non si applica: pannello unico
                            nel workspace (in futuro: setlist interne al pannello).
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Annulla / Ripristina</strong> — Come in plancia:{' '}
                            <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd> e{' '}
                            <kbd>⌘⇧Z</kbd> / <kbd>Ctrl+⇧Z</kbd>.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>WIZARD PRESENTER</strong> — Nella barra strumenti
                            apre un popup per insegnare all&apos;app i tre tasti del
                            telecomando (o tastiera): <em>Su</em> (brano precedente),{' '}
                            <em>Giù</em> (successivo) e <em>Play/Pausa</em>. I valori
                            restano in memoria locale e valgono per tutta l&apos;app.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Crossfade</strong> — Clic cicla{' '}
                            <em>Off</em> → <em>3 s</em> → <em>6 s</em>. Sulla playlist
                            programma: dissolvenza in uscita tra due brani dello stesso
                            tipo (video↔video o immagine↔immagine). Sul sottofondo:
                            incrocio di volume tra brani audio. Passando il mouse sul
                            pulsante compare il promemoria.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Volume e mute pannello</strong> — Il cursore
                            moltiplica il volume globale in alto. Il mute silenzia solo
                            l&apos;uscita sul secondo schermo per i brani avviati da{' '}
                            <em>questa</em> playlist (si somma al mute globale).
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Loop</strong> — Un pulsante cicla{' '}
                            <em>OFF</em> → <em>1</em> (ripeti il brano) →{' '}
                            <em>Tutti</em> (dall&apos;ultimo torna al primo) →{' '}
                            <em>OFF</em>. Vale per playlist e sottofondo.
                          </p>
                          <p className="floating-playlist-panel-help-popover-p">
                            <strong>Elenco brani</strong> — Clic su una riga per
                            caricare/riprodurre quel file. <strong>Tieni premuto</strong>{' '}
                            su una riga e trascina per <strong>riordinare</strong>. Le
                            icone sulla riga servono a rimuovere il brano dalla playlist.
                            Con la lista a fuoco puoi usare le <strong>frecce</strong> per
                            spostarti tra le righe.
                          </p>
                        </div>
                      )}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
            {floatingFloaterExperimental ? (
              <button
                type="button"
                className={`floating-playlist-icon-btn floating-playlist-window-pin ${windowAlwaysOnTopPinned ? 'is-active' : ''}`}
                aria-pressed={windowAlwaysOnTopPinned}
                onClick={() => {
                  const next = !windowAlwaysOnTopPinned
                  updateFloatingPlaylistChrome(sessionId, {
                    windowAlwaysOnTopPinned: next,
                  })
                  if (next) bringFloatingPanelToFront(sessionId)
                }}
                title={
                  windowAlwaysOnTopPinned
                    ? 'Puntina attiva: pannello in una finestra Electron separata (resta visibile anche se riduci la finestra principale Regia). Trascina l’intestazione per spostarla. Clic per chiudere la finestra e riportare il pannello nella regia.'
                    : 'Puntina: apre questo pannello in una finestra Electron separata sul desktop (resta visibile anche con la regia ridotta a icona). Spostabile fuori dalla regia. Clic per attivare.'
                }
                aria-label={
                  windowAlwaysOnTopPinned
                    ? 'Disattiva puntina e chiudi finestra pannello separata'
                    : 'Attiva puntina: finestra pannello separata sul desktop'
                }
              >
                <IconWindowPin />
              </button>
            ) : null}
            {isChalkboard ? (
              <button
                type="button"
                className={`floating-playlist-icon-btn${chalkboardFullscreen ? ' is-active' : ''}`}
                onClick={() => void toggleChalkboardFullscreen()}
                title={
                  chalkboardFullscreen
                    ? 'Esci da tutto schermo (anche Esc)'
                    : 'Lavagna a tutto schermo'
                }
                aria-label={
                  chalkboardFullscreen
                    ? 'Esci da tutto schermo lavagna'
                    : 'Lavagna a tutto schermo'
                }
              >
                {chalkboardFullscreen ? (
                  <IconChalkboardFullscreenExit />
                ) : (
                  <IconChalkboardFullscreen />
                )}
              </button>
            ) : null}
            <button
              type="button"
              className="floating-playlist-icon-btn"
              onClick={() => {
                const fs = session.chalkboardFullscreen === true
                const bak = chalkboardPreFullscreenRef.current
                updateFloatingPlaylistChrome(sessionId, {
                  collapsed: !collapsed,
                  ...(isChalkboard && fs
                    ? {
                        chalkboardFullscreen: false,
                        ...(bak
                          ? {
                              pos: { ...bak.pos },
                              panelSize: { ...bak.panelSize },
                            }
                          : {}),
                      }
                    : {}),
                })
                if (isChalkboard && fs) chalkboardPreFullscreenRef.current = null
              }}
              title={collapsed ? 'Espandi' : 'Riduci'}
              aria-label={collapsed ? 'Espandi pannello' : 'Riduci pannello'}
            >
              {collapsed ? <IconPanelExpand /> : <IconPanelCollapse />}
            </button>
            <button
              type="button"
              className="floating-playlist-icon-btn floating-playlist-close"
              onClick={onRequestClosePanel}
              title="Chiudi"
              aria-label="Chiudi pannello playlist mobile"
            >
              <IconClosePanel />
            </button>
          </div>
        </div>
        {collapsed ? (
          <div className="floating-playlist-toolbar">
            <PlaylistChromeOverflowRow
              className="floating-playlist-toolbar-chrome floating-playlist-chrome-actions"
              zIndexBase={zIndex}
              menuAppearanceRootClassName={
                themeHex ? 'floating-playlist has-theme' : undefined
              }
              menuAppearanceRootStyle={
                themeHex
                  ? ({
                      ['--playlist-theme' as string]: themeHex,
                    } satisfies CSSProperties)
                  : undefined
              }
            >
              {!isLaunchpad && !isChalkboard ? (
                <Fragment key="chrome-slot-media">
                  <div
                    className="floating-playlist-chrome-group floating-playlist-chrome-group--media"
                    role="group"
                    aria-label="File e cartella"
                  >
                    <button
                      type="button"
                      className={folderOpenBtnClass}
                      disabled={panelLocked}
                      onClick={() => void openFolder(sessionId)}
                      title={folderOpenBtnTitle}
                      aria-label={folderOpenBtnAriaLabel}
                      aria-pressed={folderWatchLinked}
                    >
                      <IconFolder />
                    </button>
                    <button
                      type="button"
                      className="floating-playlist-icon-btn"
                      disabled={panelLocked}
                      onClick={() => void addMediaToPlaylist(sessionId)}
                      title="Aggiungi file alla playlist"
                      aria-label="Aggiungi file alla playlist"
                    >
                      <IconAddFiles />
                    </button>
                  </div>
                  <span
                    className="floating-playlist-chrome-sep"
                    aria-hidden
                  />
                </Fragment>
              ) : null}
              {!isLaunchpad && !isChalkboard ? (
                <Fragment key="chrome-slot-presenter-collapsed">
                  <span className="floating-playlist-chrome-sep" aria-hidden />
                  <button
                    type="button"
                    className="floating-playlist-presenter-wizard-btn"
                    onClick={() => setPresenterWizardOpen(true)}
                    title="Wizard Presenter: tasti SU, GIÙ e Play/Pausa (tutta l’app)."
                    aria-haspopup="dialog"
                    aria-expanded={presenterWizardOpen}
                    aria-label="Apri Wizard Presenter tasti telecomando"
                  >
                    WIZARD
                    <br />
                    PRESENTER
                  </button>
                </Fragment>
              ) : null}
              <Fragment key="chrome-slot-doc">
              <div
                className="floating-playlist-chrome-group floating-playlist-chrome-group--doc"
                role="group"
                aria-label="Tema e salva"
              >
                <button
                  type="button"
                  className="floating-playlist-icon-btn floating-playlist-theme-picker-btn"
                  onClick={(ev) => {
                    if (ev.altKey) {
                      ev.preventDefault()
                      setPlaylistThemeColor(null, sessionId)
                      return
                    }
                    playlistColorInputRef.current?.click()
                  }}
                  title="Colore tema (Alt+clic: predefinito)"
                  aria-label="Scegli colore tema pannello. Alt e clic per tema predefinito."
                >
                  <IconColorWheel />
                </button>
                <button
                  type="button"
                  className={`floating-playlist-icon-btn${
                    normalizePlaylistWatermarkAbsPath(
                      session.playlistWatermarkPngPath,
                    )
                      ? ' is-watermark-on'
                      : ''
                  }`}
                  onClick={async (ev) => {
                    if (ev.altKey) {
                      ev.preventDefault()
                      setPlaylistWatermarkPngPath(sessionId, null)
                      return
                    }
                    const api = window.electronAPI
                    if (!api?.selectPlaylistWatermarkPng) return
                    const p = await api.selectPlaylistWatermarkPng()
                    if (p) setPlaylistWatermarkPngPath(sessionId, p)
                  }}
                  title="Watermark PNG in uscita (Alt+clic: rimuovi)"
                  aria-label="Scegli watermark PNG. Alt e clic per rimuovere."
                >
                  <IconWatermark />
                </button>
                <button
                  type="button"
                  className={`floating-playlist-icon-btn${panelLocked ? ' is-active' : ''}`}
                  aria-pressed={panelLocked}
                  title={
                    panelLocked
                      ? 'Sblocca modifiche (drag, titolo, ecc.)'
                      : 'Blocca modifiche accidentali'
                  }
                  aria-label={
                    panelLocked ? 'Sblocca pannello' : 'Blocca pannello'
                  }
                  onClick={() =>
                    setFloatingPlaylistPanelLocked(sessionId, !panelLocked)
                  }
                >
                  <IconPanelLock locked={panelLocked} />
                </button>
                <button
                  type="button"
                  className="floating-playlist-icon-btn"
                  disabled={panelLocked || isSottofondo}
                  onClick={() =>
                    void saveFloatingPlaylistCopyToRegiaVideoCloud(sessionId)
                  }
                  title={
                    isSottofondo
                      ? 'Il Sottofondo non si salva come preset su file (resta nel workspace)'
                      : 'Salva una copia come nuovo file JSON in Regia Video/Playlist (app desktop)'
                  }
                  aria-label={
                    isSottofondo
                      ? 'Salvataggio cloud non disponibile per Sottofondo'
                      : 'Salva copia cloud Regia Video'
                  }
                >
                  <IconRegiaCloudCopy />
                </button>
                <button
                  type="button"
                  className="floating-playlist-icon-btn floating-playlist-save-disk"
                  disabled={
                    !savedPlaylistDirty(sessionId) || panelLocked || isSottofondo
                  }
                  onClick={() => void saveLoadedPlaylistOverwrite(sessionId)}
                  title={
                    isSottofondo
                      ? 'Il Sottofondo non si collega a PLAYLIST: elenco e impostazioni restano nel workspace'
                      : savedPlaylistDirty(sessionId)
                        ? typeof session.regiaVideoCloudSourceFile === 'string' &&
                          session.regiaVideoCloudSourceFile.trim() !== ''
                          ? 'Sovrascrive il file JSON cloud collegato'
                          : 'Sovrascrive la playlist o launchpad salvati che hai aperto con Carica'
                        : 'Nessuna modifica da salvare sul file collegato'
                  }
                  aria-label="Salva sovrascrivendo la voce caricata da PLAYLIST"
                >
                  <IconSaveDisk />
                </button>
              </div>
              <span className="floating-playlist-chrome-sep" aria-hidden />
              </Fragment>
              <Fragment key="chrome-slot-history">
              <div
                className="floating-playlist-chrome-group floating-playlist-chrome-group--history"
                role="group"
                aria-label="Annulla e ripristina"
              >
                <button
                  type="button"
                  className="floating-playlist-icon-btn"
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
                  className="floating-playlist-icon-btn"
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
              </Fragment>
            </PlaylistChromeOverflowRow>
          </div>
        ) : null}
      </div>
      {!collapsed && (
        <div
          className={
            isLaunchpad || isChalkboard
              ? 'floating-playlist-launchpad-stack'
              : 'floating-playlist-panel-body-slot'
          }
        >
        {/* Menu tasto destro Launchpad: stesso wrapper della griglia, non dentro crossfade (pannello overflow:hidden). */}
        <div className="floating-playlist-crossfade">
          <div className="floating-playlist-crossfade-row">
            <PlaylistChromeOverflowRow
              zIndexBase={zIndex}
              className="floating-playlist-chrome-row-left floating-playlist-chrome-actions"
              menuAppearanceRootClassName={
                themeHex ? 'floating-playlist has-theme' : undefined
              }
              menuAppearanceRootStyle={
                themeHex
                  ? ({
                      ['--playlist-theme' as string]: themeHex,
                    } satisfies CSSProperties)
                  : undefined
              }
              trailing={
                <div
                  className="floating-playlist-chrome-row-right"
                  role="group"
                  aria-label="Volume e mute uscita"
                >
                  <div
                    className="floating-playlist-panel-volume"
                    title="Volume uscita per questo pannello (moltiplicato con il volume globale in alto)"
                  >
                    <input
                      type="range"
                      className="regia-volume-slider floating-playlist-panel-volume-slider"
                      min={0}
                      max={100}
                      value={Math.round(playlistOutputVolume * 100)}
                      onPointerDown={onPlaylistPanelVolumePointerDown}
                      onChange={onPlaylistPanelVolumeChange}
                      aria-label={
                        isLaunchpad
                          ? 'Volume uscita Launchpad sul secondo schermo'
                          : isChalkboard
                            ? 'Volume uscita Chalkboard sul secondo schermo'
                            : 'Volume uscita playlist sul secondo schermo'
                      }
                      aria-valuetext={`${Math.round(playlistOutputVolume * 100)}% sul pannello`}
                    />
                  </div>
                  <button
                    type="button"
                    className={`floating-playlist-icon-btn floating-playlist-mute-output ${playlistOutputMuted ? 'is-on' : ''}`}
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
              }
            >
              {!isLaunchpad && !isChalkboard ? (
                <Fragment key="chrome-slot-media">
                  <div
                    className="floating-playlist-chrome-group floating-playlist-chrome-group--media"
                    role="group"
                    aria-label="File e cartella"
                  >
                    <button
                      type="button"
                      className={folderOpenBtnClass}
                      disabled={panelLocked}
                      onClick={() => void openFolder(sessionId)}
                      title={folderOpenBtnTitle}
                      aria-label={folderOpenBtnAriaLabel}
                      aria-pressed={folderWatchLinked}
                    >
                      <IconFolder />
                    </button>
                    <button
                      type="button"
                      className="floating-playlist-icon-btn"
                      disabled={panelLocked}
                      onClick={() => void addMediaToPlaylist(sessionId)}
                      title="Aggiungi file alla playlist"
                      aria-label="Aggiungi file alla playlist"
                    >
                      <IconAddFiles />
                    </button>
                  </div>
                  <span className="floating-playlist-chrome-sep" aria-hidden />
                </Fragment>
              ) : null}
              {!isLaunchpad && !isChalkboard ? (
                <Fragment key="chrome-slot-presenter-expanded">
                  <span className="floating-playlist-chrome-sep" aria-hidden />
                  <button
                    type="button"
                    className="floating-playlist-presenter-wizard-btn"
                    onClick={() => setPresenterWizardOpen(true)}
                    title="Wizard Presenter: tasti SU, GIÙ e Play/Pausa (tutta l’app)."
                    aria-haspopup="dialog"
                    aria-expanded={presenterWizardOpen}
                    aria-label="Apri Wizard Presenter tasti telecomando"
                  >
                    WIZARD
                    <br />
                    PRESENTER
                  </button>
                </Fragment>
              ) : null}
              <Fragment key="chrome-slot-doc">
                <div
                  className="floating-playlist-chrome-group floating-playlist-chrome-group--doc"
                  role="group"
                  aria-label="Tema e salva"
                >
                  <button
                    type="button"
                    className="floating-playlist-icon-btn floating-playlist-theme-picker-btn"
                    onClick={(ev) => {
                      if (ev.altKey) {
                        ev.preventDefault()
                        setPlaylistThemeColor(null, sessionId)
                        return
                      }
                      playlistColorInputRef.current?.click()
                    }}
                    title="Colore tema (Alt+clic: predefinito)"
                    aria-label="Scegli colore tema pannello. Alt e clic per tema predefinito."
                  >
                    <IconColorWheel />
                  </button>
                  <button
                    type="button"
                    className={`floating-playlist-icon-btn${
                      normalizePlaylistWatermarkAbsPath(
                        session.playlistWatermarkPngPath,
                      )
                        ? ' is-watermark-on'
                        : ''
                    }`}
                    onClick={async (ev) => {
                      if (ev.altKey) {
                        ev.preventDefault()
                        setPlaylistWatermarkPngPath(sessionId, null)
                        return
                      }
                      const api = window.electronAPI
                      if (!api?.selectPlaylistWatermarkPng) return
                      const p = await api.selectPlaylistWatermarkPng()
                      if (p) setPlaylistWatermarkPngPath(sessionId, p)
                    }}
                    title="Watermark PNG in uscita (Alt+clic: rimuovi)"
                    aria-label="Scegli watermark PNG. Alt e clic per rimuovere."
                  >
                    <IconWatermark />
                  </button>
                  <button
                    type="button"
                    className={`floating-playlist-icon-btn${panelLocked ? ' is-active' : ''}`}
                    aria-pressed={panelLocked}
                    title={
                      panelLocked
                        ? 'Sblocca modifiche (drag, titolo, ecc.)'
                        : 'Blocca modifiche accidentali'
                    }
                    aria-label={
                      panelLocked ? 'Sblocca pannello' : 'Blocca pannello'
                    }
                    onClick={() =>
                      setFloatingPlaylistPanelLocked(sessionId, !panelLocked)
                    }
                  >
                    <IconPanelLock locked={panelLocked} />
                  </button>
                  <button
                    type="button"
                    className="floating-playlist-icon-btn"
                    disabled={panelLocked || isSottofondo}
                    onClick={() =>
                      void saveFloatingPlaylistCopyToRegiaVideoCloud(sessionId)
                    }
                    title={
                      isSottofondo
                        ? 'Il Sottofondo non si salva come preset su file (resta nel workspace)'
                        : 'Salva una copia come nuovo file JSON in Regia Video/Playlist (app desktop)'
                    }
                    aria-label={
                      isSottofondo
                        ? 'Salvataggio cloud non disponibile per Sottofondo'
                        : 'Salva copia cloud Regia Video'
                    }
                  >
                    <IconRegiaCloudCopy />
                  </button>
                  <button
                    type="button"
                    className="floating-playlist-icon-btn floating-playlist-save-disk"
                    disabled={
                      !savedPlaylistDirty(sessionId) || panelLocked || isSottofondo
                    }
                    onClick={() => void saveLoadedPlaylistOverwrite(sessionId)}
                    title={
                      isSottofondo
                        ? 'Il Sottofondo non si collega a PLAYLIST: elenco e impostazioni restano nel workspace'
                        : savedPlaylistDirty(sessionId)
                          ? typeof session.regiaVideoCloudSourceFile === 'string' &&
                            session.regiaVideoCloudSourceFile.trim() !== ''
                            ? 'Sovrascrive il file JSON cloud collegato'
                            : 'Sovrascrive la playlist o launchpad salvati che hai aperto con Carica'
                          : 'Nessuna modifica da salvare sul file collegato'
                    }
                    aria-label="Salva sovrascrivendo la voce caricata da PLAYLIST"
                  >
                    <IconSaveDisk />
                  </button>
                </div>
                <span className="floating-playlist-chrome-sep" aria-hidden />
              </Fragment>
              <Fragment key="chrome-slot-history">
                <div
                  className="floating-playlist-chrome-group floating-playlist-chrome-group--history"
                  role="group"
                  aria-label="Annulla e ripristina"
                >
                  <button
                    type="button"
                    className="floating-playlist-icon-btn"
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
                    className="floating-playlist-icon-btn"
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
              </Fragment>
              {!isLaunchpad && !isChalkboard ? (
                <Fragment key="chrome-slot-xfade">
                  <span className="floating-playlist-chrome-sep" aria-hidden />
                  <div
                    className="floating-playlist-chrome-group floating-playlist-chrome-group--xfade"
                    role="group"
                    aria-label="Crossfade in uscita"
                  >
                    <button
                      type="button"
                      className={`floating-playlist-icon-btn floating-playlist-crossfade-toggle ${playlistCrossfadeSec > 0 ? 'is-active' : ''}`}
                      disabled={panelLocked}
                      title={
                        isSottofondo
                          ? `Crossfade audio tra brani: ${playlistCrossfadeLabel}. Clic: Off, 3 s, 6 s.`
                          : `Crossfade tra brani in uscita: ${playlistCrossfadeLabel} (solo stesso tipo: video/video o immagine/immagine). Clic: Off, 3 s, 6 s.`
                      }
                      aria-label={`Crossfade ${playlistCrossfadeLabel}`}
                      aria-pressed={playlistCrossfadeSec > 0}
                      onClick={() => {
                        setActiveFloatingSession(sessionId)
                        cyclePlaylistCrossfadeSec(sessionId)
                      }}
                    >
                      <IconCrossfade />
                      <span className="floating-playlist-crossfade-sec-label">
                        {playlistCrossfadeLabel}
                      </span>
                      <span
                        className="floating-playlist-crossfade-hint-tooltip"
                        aria-hidden="true"
                      >
                        {isSottofondo
                          ? 'Incrocio volume tra brani audio'
                          : 'Solo tra video/video o immagine/immagine'}
                      </span>
                    </button>
                  </div>
                </Fragment>
              ) : null}
            </PlaylistChromeOverflowRow>
          </div>
          {isSottofondo ? (
            <div
              className="floating-playlist-sottofondo-transport"
              role="group"
              aria-label="Sottofondo: play e stop indipendenti dal trasporto globale"
            >
              <button
                type="button"
                className="floating-playlist-loop-btn floating-playlist-sottofondo-play"
                disabled={panelLocked || paths.length === 0}
                onClick={() => onSottofondoPanelPlay()}
                title="Avvia dal brano evidenziato in elenco (audio in uscita, indipendente da play/pausa globale)"
              >
                Play
              </button>
              <button
                type="button"
                className="floating-playlist-loop-btn floating-playlist-sottofondo-stop"
                disabled={panelLocked || !sottofondoPlaying}
                onClick={() => onSottofondoPanelStop()}
                title="Ferma il sottofondo (non ferma il video program né il launchpad)"
              >
                Stop
              </button>
            </div>
          ) : null}
          {!isLaunchpad && !isChalkboard ? (
            <div
              className="floating-playlist-loop-row"
              role="group"
              aria-label="Loop playlist (questo pannello)"
            >
              <span className="floating-playlist-loop-label">Loop</span>
              <div className="floating-playlist-loop-toggles">
                <button
                  type="button"
                  disabled={panelLocked}
                  className={`floating-playlist-loop-btn floating-playlist-loop-cycle${panelLoopEffective !== 'off' ? ' is-active' : ''}`}
                  onClick={() => {
                    setActiveFloatingSession(sessionId)
                    setPlaylistLoopMode(
                      sessionId,
                      cycleLoopMode(panelLoopEffective),
                    )
                  }}
                  title={
                    panelLoopEffective === 'off'
                      ? 'Loop OFF. Clic: ripeti il brano corrente (1).'
                      : panelLoopEffective === 'one'
                        ? 'Loop brano (1). Clic: ripeti tutta la lista (Tutti).'
                        : 'Loop tutta la lista (Tutti). Clic: disattiva (OFF).'
                  }
                  aria-label={`Loop pannello: ${loopCycleModeShortLabel(panelLoopEffective)}. Clic per ciclo OFF, 1, Tutti.`}
                >
                  {loopCycleModeShortLabel(panelLoopEffective)}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {isLaunchpad && launchPadCells ? (
        <div
          className={`floating-playlist-launchpad ${launchpadDropHover ? 'is-file-drop-hover' : ''}`}
          role="group"
          aria-label="Launchpad 4 per 4"
          data-preview-hint="Launchpad: griglia 4×4 con pagine; trascina campioni sui pad o sulla griglia. Tap / tasti come da help «?». Tasto destro su un pad per gain, tasto e svuota."
          onDragEnter={onLaunchpadDragEnter}
          onDragLeave={onLaunchpadDragLeave}
          onDragOver={onLaunchpadDragOver}
        >
          {padKeyLearnSlot !== null ? (
            <div className="launchpad-key-learn-banner" role="status">
              Slot {padKeyLearnSlot + 1}: premi un tasto da assegnare (Esc annulla)
            </div>
          ) : null}
          <div
            className="launchpad-bank-tabs"
            role="tablist"
            aria-label="Pagine launchpad"
          >
            {Array.from({ length: LAUNCHPAD_BANK_COUNT }, (_, bi) => (
              <button
                key={`bank-${sessionId}-${bi}`}
                type="button"
                role="tab"
                aria-selected={bi === launchPadBankIndex}
                className={`launchpad-bank-tab ${bi === launchPadBankIndex ? 'is-active' : ''}`}
                onClick={() => setLaunchPadBankIndex(sessionId, bi)}
              >
                {bi + 1}
              </button>
            ))}
          </div>
          <div
            className="floating-playlist-launchpad-grid"
            onDragOver={onLaunchpadDragOver}
            onDrop={(e) => void onLaunchPadGridBackgroundDrop(e)}
          >
            {launchPadCells.slice(0, LAUNCHPAD_CELL_COUNT).map((cell, i) => {
              void padProgressTick
              const shown = launchPadCellShownLabel(cell)
              const fileBasename = cell.samplePath
                ? cell.samplePath.split(/[/\\]/).pop() ?? cell.samplePath
                : ''
              const isPrimarySlot =
                playbackLoadedTrack != null &&
                playbackLoadedTrack.sessionId === sessionId &&
                (playbackLoadedTrack.launchPadBankIndex ?? 0) ===
                  launchPadBankIndex &&
                playbackLoadedTrack.index === i
              const slotHasVoice = launchpadSlotHasAnyVoice(
                sessionId,
                launchPadBankIndex,
                i,
              )
              const slotIsPlaying = launchpadSlotHasPlayingVoice(
                sessionId,
                launchPadBankIndex,
                i,
              )
              const padProg = slotHasVoice
                ? getLaunchpadSampleProgress(
                    sessionId,
                    launchPadBankIndex,
                    i,
                  )
                : { currentTime: 0, duration: 0 }
              const padFrac =
                padProg.duration > 0
                  ? Math.min(1, padProg.currentTime / padProg.duration)
                  : 0
              const padRingActive =
                slotHasVoice &&
                (slotIsPlaying || isLaunchpadSamplePausedWithSrc())
              const showLoadedOutline = slotHasVoice || isPrimarySlot
              const showPadPlayingAnim =
                slotIsPlaying && launchpadAudioPlaying
              return (
                <div
                  key={`${sessionId}-pad-${i}`}
                  className="launchpad-cell-wrap"
                  data-launchpad-slot={i}
                  onDragOver={(ev) => {
                    if (!launchpadDragAllowed(ev.dataTransfer)) return
                    ev.preventDefault()
                    ev.dataTransfer.dropEffect =
                      dataTransferHasFloatingInternal(ev.dataTransfer)
                        ? 'move'
                        : 'copy'
                  }}
                  onDrop={(ev) => void onLaunchPadCellDrop(i, ev)}
                >
                  <button
                    type="button"
                    draggable={Boolean(cell.samplePath)}
                    onDragStart={(ev) => onLaunchPadCellDragStart(i, ev)}
                    onDragEnd={() => setLaunchPadDragSourceSlot(null)}
                    className={`launchpad-cell ${padFlashSlot === i ? 'is-lit' : ''} ${showPadPlayingAnim ? 'is-pad-playing' : ''} ${showLoadedOutline ? 'is-loaded' : ''} ${cell.samplePath ? 'has-sample' : 'is-empty'} ${launchPadDragSourceSlot === i ? 'is-dragging-source' : ''}`}
                    style={
                      {
                        ['--launchpad-pad' as string]: cell.padColor,
                      } as CSSProperties
                    }
                    onPointerDown={(ev) => onLaunchPadPadPointerDown(i, ev)}
                    onKeyDown={(ev) => onLaunchPadCellKeyDown(i, ev)}
                    onClick={(ev) => onLaunchPadCellClick(i, ev)}
                    onContextMenu={(ev) => onLaunchPadCellContextMenu(i, ev)}
                    title={
                      cell.samplePath
                        ? `Slot ${i + 1}: ${fileBasename}${
                            shown !== fileBasename
                              ? ` (etichetta: ${shown})`
                              : ''
                          } — ${
                            launchPadCueEnabled
                              ? 'tap breve play intero · tenere premuto CUE (stop al rilascio)'
                              : 'clic = play intero'
                          } · trascina il pad per spostarlo · tasto destro: gain / tasto / svuota${
                            cell.padKeyCode
                              ? ` · tasto: ${cell.padKeyCode} (${cell.padKeyMode === 'toggle' ? 'Toggle' : 'Play'})`
                              : ''
                          }`
                        : `Slot ${i + 1} vuoto — clic per file · tasto destro: gain / tasto${
                            cell.padKeyCode
                              ? ` (${cell.padKeyCode} ${cell.padKeyMode === 'toggle' ? 'Toggle' : 'Play'})`
                              : ''
                          }`
                    }
                  >
                    <span className="launchpad-cell-glow" aria-hidden />
                    {cell.padKeyCode ? (
                      <span
                        className="launchpad-cell-key"
                        aria-label={`Tasto ${cell.padKeyCode}, ${cell.padKeyMode === 'toggle' ? 'Toggle' : 'Play'}`}
                      >
                        {launchPadKeyLabel(cell.padKeyCode)}
                        <span className="launchpad-cell-key-mode" aria-hidden>
                          {cell.padKeyMode === 'toggle' ? 'T' : 'P'}
                        </span>
                      </span>
                    ) : null}
                    <span className="launchpad-cell-index">{i + 1}</span>
                    <span className="launchpad-cell-label">{shown}</span>
                  </button>
                  {cell.samplePath ? (
                    <div className="launchpad-cell-trailing">
                      <MediaDurationRing
                        fraction={padFrac}
                        active={padRingActive}
                        size={16}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
        {launchPadCtx && isLaunchpad && launchPadCells ? (
          <div
            className="launchpad-ctx-menu-plancia-layer"
            role="presentation"
            onMouseDown={(ev) => {
              if (ev.button !== 0) return
              const t = ev.target
              if (
                t instanceof Node &&
                launchPadMenuRef.current?.contains(t)
              )
                return
              setLaunchPadCtx(null)
            }}
          >
            <div
              ref={launchPadMenuRef}
              className="launchpad-ctx-menu"
              role="menu"
              aria-label={`Opzioni slot ${launchPadCtx.slot + 1}`}
              onMouseDown={(ev) => ev.stopPropagation()}
            >
              <div className="launchpad-ctx-menu-title">
                Slot {launchPadCtx.slot + 1}
                {launchPadCells[launchPadCtx.slot]?.samplePath
                  ? ''
                  : ' (vuoto)'}
              </div>
              <label
                className="launchpad-ctx-menu-label"
                htmlFor={`lp-gain-${sessionId}-${launchPadCtx.slot}`}
              >
                Gain uscita
              </label>
              <div className="launchpad-ctx-menu-gain-row">
                <input
                  id={`lp-gain-${sessionId}-${launchPadCtx.slot}`}
                  type="range"
                  className="regia-volume-slider launchpad-ctx-menu-slider"
                  min={0}
                  max={100}
                  value={Math.round(ctxMenuGain * 100)}
                  onPointerDown={() => recordUndoPoint()}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const v =
                      Number.parseInt(e.target.value, 10) / 100
                    const c = Math.min(1, Math.max(0, v))
                    void updateLaunchPadCell(
                      sessionId,
                      launchPadCtx.slot,
                      { padGain: c },
                      { skipUndo: true },
                    )
                  }}
                  aria-valuetext={`${Math.round(ctxMenuGain * 100)}%`}
                />
                <span className="launchpad-ctx-menu-gain-pct" aria-hidden>
                  {Math.round(ctxMenuGain * 100)}%
                </span>
              </div>
              <button
                type="button"
                className="launchpad-ctx-menu-learn"
                onClick={() => {
                  const slot = launchPadCtx.slot
                  setLaunchPadCtx(null)
                  setPadKeyLearnSlot(slot)
                }}
              >
                Learn…
              </button>
              {/*
                REGRESSION: mostrare sempre Play/Toggle; non nascondere la sezione
                dietro `padKeyCode` (altrimenti sparisce dal menu tasto destro).
              */}
              <div
                className="launchpad-ctx-menu-keymode"
                role="group"
                aria-label="Comportamento tasto assegnato"
              >
                <span className="launchpad-ctx-menu-label">Tasto</span>
                <div className="launchpad-ctx-menu-keymode-btns">
                  <button
                    type="button"
                    className={`launchpad-ctx-menu-seg ${ctxSlotCell && ctxSlotCell.padKeyMode !== 'toggle' ? 'is-active' : ''}`}
                    onClick={() =>
                      void updateLaunchPadCell(sessionId, launchPadCtx.slot, {
                        padKeyMode: 'play',
                      })
                    }
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className={`launchpad-ctx-menu-seg ${ctxSlotCell?.padKeyMode === 'toggle' ? 'is-active' : ''}`}
                    onClick={() =>
                      void updateLaunchPadCell(sessionId, launchPadCtx.slot, {
                        padKeyMode: 'toggle',
                      })
                    }
                  >
                    Toggle
                  </button>
                </div>
              </div>
              <label
                className="launchpad-ctx-menu-label"
                htmlFor={`lp-name-${sessionId}-${launchPadCtx.slot}`}
              >
                Nome sul pad
              </label>
              <input
                id={`lp-name-${sessionId}-${launchPadCtx.slot}`}
                key={`lp-name-${sessionId}-${launchPadCtx.slot}`}
                type="text"
                className="launchpad-ctx-menu-name-input"
                maxLength={120}
                defaultValue={ctxSlotCell?.padDisplayName ?? ''}
                placeholder="Vuoto = nome file"
                aria-describedby={`lp-name-hint-${sessionId}-${launchPadCtx.slot}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                onBlur={(e) => {
                  const raw = e.target.value
                  const v = raw.trim() === '' ? null : raw
                  void updateLaunchPadCell(sessionId, launchPadCtx.slot, {
                    padDisplayName: v,
                  })
                }}
              />
              <span
                id={`lp-name-hint-${sessionId}-${launchPadCtx.slot}`}
                className="launchpad-ctx-menu-name-hint"
              >
                Sovrascrive l’etichetta sul pad (il file resta lo stesso).
              </span>
              <button
                type="button"
                className="launchpad-ctx-menu-learn"
                disabled={!ctxSlotCell?.padKeyCode}
                onClick={() => {
                  void updateLaunchPadCell(sessionId, launchPadCtx.slot, {
                    padKeyCode: null,
                  })
                  setLaunchPadCtx(null)
                }}
              >
                Rimuovi tasto
              </button>
              <div className="launchpad-ctx-menu-label">Appunti</div>
              <div className="launchpad-ctx-menu-row-btns">
                <button
                  type="button"
                  className="launchpad-ctx-menu-mini"
                  disabled={!ctxSlotCell}
                  onClick={() => {
                    if (ctxSlotCell) setLaunchPadClipboard({ ...ctxSlotCell })
                    setLaunchPadCtx(null)
                  }}
                >
                  Copia slot
                </button>
                <button
                  type="button"
                  className="launchpad-ctx-menu-mini"
                  disabled={!launchPadClipboard}
                  onClick={() => {
                    const clip = launchPadClipboard
                    if (!clip) return
                    void updateLaunchPadCell(sessionId, launchPadCtx.slot, {
                      samplePath: clip.samplePath,
                      padColor: clip.padColor,
                      padGain: clip.padGain,
                      padDisplayName: clip.padDisplayName,
                      padKeyCode: null,
                      padKeyMode: clip.padKeyMode,
                    })
                    setLaunchPadCtx(null)
                  }}
                >
                  Incolla
                </button>
              </div>
              <div className="launchpad-ctx-menu-label">Categoria (colore)</div>
              <div className="launchpad-ctx-menu-cat-swatches">
                {LAUNCHPAD_CATEGORY_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className="launchpad-ctx-cat-swatch"
                    style={{ ['--sw' as string]: hex }}
                    title={`Imposta colore ${hex}`}
                    aria-label={`Categoria colore ${hex}`}
                    onClick={() => {
                      void updateLaunchPadCell(sessionId, launchPadCtx.slot, {
                        padColor: hex,
                      })
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                className="launchpad-ctx-menu-clear"
                disabled={!ctxSlotCell?.samplePath}
                onClick={() => {
                  void updateLaunchPadCell(sessionId, launchPadCtx.slot, {
                    samplePath: null,
                    padDisplayName: null,
                  })
                  setLaunchPadCtx(null)
                }}
              >
                Svuota pad
              </button>
            </div>
          </div>
        ) : isChalkboard ? (
          <div
            data-preview-hint="Lavagna: pennello, testo e immagini su più banchi; invio in uscita sul programma quando abilitato. Tab per cambiare banco; tasto angoli per tutto schermo."
          >
          <ChalkboardPanel
            sessionId={sessionId}
            bankPaths={
              session.chalkboardBankPaths ?? FALLBACK_CHALKBOARD_BANK_PATHS
            }
            bankIndex={session.chalkboardBankIndex ?? 0}
            placements={
              session.chalkboardPlacementsByBank?.[
                session.chalkboardBankIndex ?? 0
              ] ?? FALLBACK_CHALKBOARD_PLACEMENTS
            }
            onUpdateBankPlacements={(items) => {
              patchFloatingPlaylistSession(sessionId, (s) => {
                const bi = s.chalkboardBankIndex ?? 0
                const banks = cloneChalkboardPlacementsByBank(
                  s.chalkboardPlacementsByBank ??
                    emptyChalkboardPlacementsByBank(),
                )
                banks[bi] = items
                return {
                  ...s,
                  chalkboardPlacementsByBank: banks,
                  chalkboardContentRev: (s.chalkboardContentRev ?? 0) + 1,
                }
              })
            }}
            outputMode={normalizeChalkboardOutputMode(
              session.chalkboardOutputMode,
              (session as { chalkboardOutputToProgram?: boolean })
                .chalkboardOutputToProgram,
            )}
            onSetBankIndex={(i) =>
              patchFloatingPlaylistSession(sessionId, {
                chalkboardBankIndex: Math.max(0, Math.min(3, i)),
              })
            }
            patchSession={patchFloatingPlaylistSession}
            recordUndoPoint={recordUndoPoint}
            backgroundColor={normalizeChalkboardBackgroundHex(
              session.chalkboardBackgroundColor,
            )}
            onBackgroundColorChange={(hex) => {
              recordUndoPoint()
              patchFloatingPlaylistSession(sessionId, {
                chalkboardBackgroundColor:
                  normalizeChalkboardBackgroundHex(hex),
              })
            }}
          />
          </div>
        ) : null}
        </div>
      )}
      {!collapsed && !isLaunchpad && !isChalkboard && (
        <div
          className="floating-playlist-list-scroll"
          data-preview-hint="Elenco brani: clic per caricare in anteprima/uscita, trascina per riordinare, tasto destro per opzioni. Trascina file dall’esplora risorse per aggiungerli."
        >
          <ul
            ref={listRef}
            className={`floating-playlist-list ${playlistRowDragSourceIndex != null ? 'is-reordering' : ''} ${playlistDropHover ? 'is-file-drop-hover' : ''} ${internalDropInsertBefore != null ? 'has-internal-drop-cue' : ''}`}
            tabIndex={0}
            aria-label="Elenco brani"
            onDragEnter={onPlaylistDragEnter}
            onDragLeave={onPlaylistDragLeave}
            onDragOver={onPlaylistDragOver}
            onDrop={(e) => void onPlaylistDrop(e)}
          >
          {paths.length === 0 && (
            <li
              className={`floating-playlist-empty${playlistEmptyDropCueClasses(internalDropInsertBefore)}`}
            >
              Nessun file. Apri una cartella, usa Aggiungi o trascina file qui.
            </li>
          )}
          {paths.map((p, i) => {
            void previewMediaTimesTick
            const name = p.split(/[/\\]/).pop() ?? p
            const durationLabel = formatPlaylistDurationLabel(
              trackDurations[p],
              formatDurationMmSs,
            )
            const isCurrentRow = isSottofondo
              ? sottofondoLoadedTrack != null &&
                sottofondoLoadedTrack.sessionId === sessionId &&
                sottofondoLoadedTrack.index === i
              : playbackLoadedTrack != null &&
                playbackLoadedTrack.sessionId === sessionId &&
                playbackLoadedTrack.index === i
            const pv = previewMediaTimesRef.current
            const rowFrac =
              isCurrentRow && pv.duration > 0
                ? Math.min(1, pv.currentTime / pv.duration)
                : 0
            return (
              <li
                key={`${sessionId}-${i}-${p}`}
                data-pl-idx={i}
                draggable
                onDragStart={(ev) => onPlaylistRowDragStart(i, ev)}
                onDragEnd={onPlaylistRowDragEnd}
                className={`floating-playlist-item${playlistRowDragSourceIndex === i ? ' is-dragging-source' : ''}${playlistDropCueClasses(internalDropInsertBefore, i, paths.length, playlistGridCols)}`}
              >
                <button
                  type="button"
                  className={`playlist-row ${
                    isSottofondo
                      ? sottofondoLoadedTrack != null &&
                        sottofondoLoadedTrack.sessionId === sessionId &&
                        sottofondoLoadedTrack.index === i
                        ? 'is-current'
                        : ''
                      : playbackLoadedTrack != null &&
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
                  onContextMenu={(e) => onPlaylistRowContextMenu(i, e)}
                  title={`${p} — clic per riprodurre · tasto destro «prossimo» · trascina la riga · frecce sulla lista`}
                >
                  <span className="playlist-index">{i + 1}</span>
                  <span className="playlist-name">{name}</span>
                  {playbackArmedNext?.sessionId === sessionId &&
                  playbackArmedNext.index === i ? (
                    <span
                      className="playlist-armed-badge"
                      title="Pronto: sarà caricato al prossimo avanzamento (decode in anteprima)"
                    >
                      Pronto
                    </span>
                  ) : null}
                  <span
                    className="playlist-duration"
                    title="Durata del file"
                    aria-label={`Durata: ${durationLabel}`}
                  >
                    {durationLabel}
                  </span>
                </button>
                <span
                  className="floating-playlist-item-duration"
                  aria-hidden
                >
                  <MediaDurationRing
                    fraction={rowFrac}
                    active={isCurrentRow && !isSottofondo}
                    size={20}
                  />
                </span>
                <button
                  type="button"
                  draggable={false}
                  className="playlist-remove-btn"
                  disabled={panelLocked}
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
          {playlistTrackCtxSlot != null ? (
            <div
              className="playlist-track-ctx-layer"
              role="presentation"
              onMouseDown={(ev) => {
                if (ev.button !== 0) return
                const t = ev.target
                if (
                  t instanceof Node &&
                  playlistTrackCtxMenuRef.current?.contains(t)
                )
                  return
                setPlaylistTrackCtxSlot(null)
              }}
            >
              <div
                ref={playlistTrackCtxMenuRef}
                className="playlist-track-ctx-menu"
                role="menu"
                aria-label={`Opzioni brano ${playlistTrackCtxSlot + 1}`}
                onMouseDown={(ev) => ev.stopPropagation()}
              >
                <div className="playlist-track-ctx-menu-title">
                  Brano {playlistTrackCtxSlot + 1}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="playlist-track-ctx-menu-item"
                  onClick={() => {
                    armPlayNext(sessionId, playlistTrackCtxSlot)
                    setPlaylistTrackCtxSlot(null)
                  }}
                >
                  Riproduci come prossimo
                </button>
                {playbackArmedNext?.sessionId === sessionId &&
                playbackArmedNext.index === playlistTrackCtxSlot ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="playlist-track-ctx-menu-item playlist-track-ctx-menu-item--muted"
                    onClick={() => {
                      clearPlaybackArmedNext()
                      setPlaylistTrackCtxSlot(null)
                    }}
                  >
                    Annulla «prossimo»
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
      </RegiaPanelHintHost>
    </div>
    {closePlayConfirmOpen ? (
      <div
        className="settings-modal-backdrop floating-close-play-confirm-backdrop"
        role="presentation"
        onPointerDown={onBackdropPointerDownClosePlayConfirm}
      >
        <div
          className="settings-modal floating-close-play-confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="floating-close-play-confirm-title"
          aria-describedby="floating-close-play-confirm-desc"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="settings-modal-head">
            <h2
              id="floating-close-play-confirm-title"
              className="settings-modal-title"
            >
              Chiudere il pannello?
            </h2>
          </div>
          <div className="settings-modal-body">
            <p
              id="floating-close-play-confirm-desc"
              className="settings-modal-hint"
              style={{ marginBottom: 0 }}
            >
              {isLaunchpad
                ? 'C’è un sample del Launchpad in riproduzione: chiudere il pannello lo interrompe.'
                : 'C’è un video in uscita da questo pannello in riproduzione: chiudere lo interrompe.'}
            </p>
          </div>
          <div className="floating-close-play-confirm-actions">
            <button
              ref={closePlayConfirmCancelRef}
              type="button"
              className="floating-close-play-confirm-btn"
              onClick={() => setClosePlayConfirmOpen(false)}
            >
              Annulla
            </button>
            <button
              type="button"
              className="floating-close-play-confirm-btn floating-close-play-confirm-btn--danger"
              onClick={onConfirmClosePanelDespitePlay}
            >
              Chiudi comunque
            </button>
          </div>
        </div>
      </div>
    ) : null}
    <PresenterKeyWizardDialog
      open={presenterWizardOpen}
      onClose={() => setPresenterWizardOpen(false)}
      zIndex={presenterWizardZBase}
    />
    </Fragment>
  )
}
