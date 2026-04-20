import {
  persistPreviewDisplayMode,
  readPreviewDisplayMode,
  type PreviewDisplayMode,
} from './previewDetachedStorage.ts'
import {
  defaultPreviewLayoutPersist,
  dispatchPreviewLayoutApplied,
  readPreviewLayoutFromLs,
  writePreviewLayoutToLs,
  type PreviewLayoutPersist,
} from './previewLayoutStorage.ts'
import {
  clampSidebarWidth,
  persistSidebarOpen,
  persistSidebarWidthPx,
  readSidebarOpen,
  readSidebarWidthPx,
} from './sidebarLayout.ts'

const LS_OUTPUT_VOLUME = 'regia-output-volume'
const LS_OUTPUT_SINK = 'regia-output-sink-id'
/** Chiave localStorage per uscita audio CUE / PFL (pre-ascolto cuffia). */
export const REGIA_LS_CUE_SINK_KEY = 'regia-cue-sink-id'
const LS_SIDEBAR_MAIN_TAB = 'regia-sidebar-main-tab'

/** Storico: workspace/chalkboard erano tab sidebar; oggi si normalizza a playlist. */
export type SidebarMainTabPersist = 'playlist'

export type WorkspaceLoopModePersist = 'off' | 'one' | 'all'

/** Durata predefinita slide immagine in playlist (secondi), allineata a OutputApp. */
export const DEFAULT_STILL_IMAGE_DURATION_SEC = 8

export function clampStillImageDurationSec(sec: number): number {
  if (!Number.isFinite(sec)) return DEFAULT_STILL_IMAGE_DURATION_SEC
  return Math.min(600, Math.max(1, Math.round(sec)))
}

function parseStillImageDurationSec(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clampStillImageDurationSec(raw)
  }
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n)) return clampStillImageDurationSec(n)
  }
  return DEFAULT_STILL_IMAGE_DURATION_SEC
}

export type WorkspaceShellPersist = {
  /** Anteprima: nel layout, finestra OS separata, o nascosta (solo pulsante occhio cicla hidden). */
  previewDisplayMode: PreviewDisplayMode
  previewLayout: PreviewLayoutPersist
  sidebarOpen: boolean
  sidebarWidthPx: number
  outputResolution: { width: number; height: number }
  loopMode: WorkspaceLoopModePersist
  /** Secondi di visualizzazione per ogni immagine fissa in playlist (uscita e anello anteprima). */
  stillImageDurationSec: number
  muted: boolean
  outputVolume: number
  outputSinkId: string
  /**
   * DeviceId Chromium per pre-ascolto (CUE / PFL). `''` = dispositivo predefinito.
   * Il routing verso questo sink sarà usato da funzioni dedicate (es. anteprima audio next).
   */
  cueSinkId: string
  secondScreenOn: boolean
  sidebarMainTab: SidebarMainTabPersist
}

export const SIDEBAR_MAIN_TAB_EVENT = 'regia-sidebar-main-tab-applied'

function readOutputVolumeLs(): number {
  try {
    const v = parseFloat(localStorage.getItem(LS_OUTPUT_VOLUME) ?? '1')
    if (!Number.isFinite(v)) return 1
    return Math.min(1, Math.max(0, v))
  } catch {
    return 1
  }
}

function readOutputSinkLs(): string {
  try {
    return localStorage.getItem(LS_OUTPUT_SINK) ?? ''
  } catch {
    return ''
  }
}

function readCueSinkLs(): string {
  try {
    return localStorage.getItem(REGIA_LS_CUE_SINK_KEY) ?? ''
  } catch {
    return ''
  }
}

export function readSidebarMainTabFromLs(): SidebarMainTabPersist {
  return 'playlist'
}

export function persistSidebarMainTab(tab: SidebarMainTabPersist): void {
  try {
    localStorage.setItem(LS_SIDEBAR_MAIN_TAB, tab)
  } catch {
    /* ignore */
  }
}

export function dispatchSidebarMainTab(tab: SidebarMainTabPersist): void {
  window.dispatchEvent(
    new CustomEvent<SidebarMainTabPersist>(SIDEBAR_MAIN_TAB_EVENT, {
      detail: tab,
    }),
  )
}

export function readStandaloneWorkspaceShell(): WorkspaceShellPersist {
  return {
    previewDisplayMode: readPreviewDisplayMode(),
    previewLayout: readPreviewLayoutFromLs(),
    sidebarOpen: readSidebarOpen(),
    sidebarWidthPx: readSidebarWidthPx(),
    outputResolution: { width: 1280, height: 720 },
    loopMode: 'off',
    stillImageDurationSec: DEFAULT_STILL_IMAGE_DURATION_SEC,
    muted: false,
    outputVolume: readOutputVolumeLs(),
    outputSinkId: readOutputSinkLs(),
    cueSinkId: readCueSinkLs(),
    secondScreenOn: false,
    sidebarMainTab: readSidebarMainTabFromLs(),
  }
}

/**
 * Shell “minima” per un nuovo workspace: anteprima agganciata, sidebar chiusa,
 * nessun secondo schermo forzato; mantiene dispositivi audio/volume da preferenze utente.
 */
export function buildBlankWorkspaceShellPersist(
  outputResolution: { width: number; height: number },
): WorkspaceShellPersist {
  return {
    previewDisplayMode: 'docked',
    previewLayout: defaultPreviewLayoutPersist(),
    sidebarOpen: false,
    sidebarWidthPx: clampSidebarWidth(readSidebarWidthPx()),
    outputResolution,
    loopMode: 'off',
    stillImageDurationSec: DEFAULT_STILL_IMAGE_DURATION_SEC,
    muted: false,
    outputVolume: readOutputVolumeLs(),
    outputSinkId: readOutputSinkLs(),
    cueSinkId: readCueSinkLs(),
    secondScreenOn: false,
    sidebarMainTab: 'playlist',
  }
}

function parseLoopMode(raw: unknown): WorkspaceLoopModePersist {
  return raw === 'one' || raw === 'all' || raw === 'off' ? raw : 'off'
}

export function parseWorkspaceShell(raw: unknown): WorkspaceShellPersist | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const layoutRaw = s.previewLayout
  let previewLayout: PreviewLayoutPersist
  if (layoutRaw && typeof layoutRaw === 'object') {
    const L = layoutRaw as Record<string, unknown>
    const x = Number(L.x)
    const y = Number(L.y)
    const width = Number(L.width)
    const height = Number(L.height)
    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(width) &&
      Number.isFinite(height)
    ) {
      previewLayout = { x, y, width, height }
    } else {
      previewLayout = readPreviewLayoutFromLs()
    }
  } else {
    previewLayout = readPreviewLayoutFromLs()
  }
  const sw = Number(s.sidebarWidthPx)
  const previewDisplayMode = parsePreviewDisplayModeFromShell(s)
  return {
    previewDisplayMode,
    previewLayout,
    sidebarOpen: Boolean(s.sidebarOpen),
    sidebarWidthPx: Number.isFinite(sw)
      ? clampSidebarWidth(sw)
      : readSidebarWidthPx(),
    outputResolution: (() => {
      const r = s.outputResolution
      if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>
        const width = Number(o.width)
        const height = Number(o.height)
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
          return { width, height }
        }
      }
      return { width: 1280, height: 720 }
    })(),
    loopMode: parseLoopMode(s.loopMode),
    stillImageDurationSec: parseStillImageDurationSec(s.stillImageDurationSec),
    muted: Boolean(s.muted),
    outputVolume: (() => {
      const v = Number(s.outputVolume)
      if (Number.isFinite(v)) return Math.min(1, Math.max(0, v))
      return readOutputVolumeLs()
    })(),
    outputSinkId:
      typeof s.outputSinkId === 'string' ? s.outputSinkId : readOutputSinkLs(),
    cueSinkId:
      typeof s.cueSinkId === 'string' ? s.cueSinkId : readCueSinkLs(),
    secondScreenOn: Boolean(s.secondScreenOn),
    sidebarMainTab: 'playlist',
  }
}

function parsePreviewDisplayModeFromShell(
  s: Record<string, unknown>,
): PreviewDisplayMode {
  const m = s.previewDisplayMode
  if (m === 'docked' || m === 'floating' || m === 'hidden') return m
  if (Boolean(s.previewDetached)) return 'floating'
  return 'docked'
}

export function persistShellToLocalStorage(shell: WorkspaceShellPersist): void {
  persistPreviewDisplayMode(shell.previewDisplayMode)
  writePreviewLayoutToLs(shell.previewLayout)
  persistSidebarOpen(shell.sidebarOpen)
  persistSidebarWidthPx(shell.sidebarWidthPx)
  try {
    localStorage.setItem(LS_OUTPUT_VOLUME, String(shell.outputVolume))
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LS_OUTPUT_SINK, shell.outputSinkId)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(REGIA_LS_CUE_SINK_KEY, shell.cueSinkId)
  } catch {
    /* ignore */
  }
  persistSidebarMainTab(shell.sidebarMainTab)
}

export function dispatchShellLayoutEvents(): void {
  dispatchPreviewLayoutApplied()
}
