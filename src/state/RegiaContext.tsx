/* eslint-disable react-refresh/only-export-components -- hook co-located with provider */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { isMediaFilePath } from '../lib/isMediaFilePath.ts'
import { normalizePersistedPadKeyCode } from '../lib/launchPadKeyboard.ts'
import {
  readLaunchPadCueEnabled,
  readLaunchPadDefaultKeyMode,
} from '../lib/launchPadSettings.ts'
import {
  isLaunchpadSamplePausedWithSrc,
  pauseLaunchpadSample,
  playLaunchpadSample,
  resumeLaunchpadSample,
  setLaunchpadSampleLevels,
  setLaunchpadSampleSink,
  stopLaunchpadSample,
} from '../lib/launchpadSamplePlayer.ts'
import { planFirstDiskLinkForUnlinkedSession } from '../lib/playlistFirstDiskLinkPolicy.ts'
import { normalizePlaylistThemeColor } from '../lib/playlistThemeColor.ts'
import { totalDurationSecForPlaylistSave } from '../lib/sumMediaDurationsSec.ts'
import type { SavedPlaylistMeta } from '../playlistTypes.ts'
import { persistPreviewDetached } from '../lib/previewDetachedStorage.ts'
import { readPreviewLayoutFromLs, writePreviewLayoutToLs } from '../lib/previewLayoutStorage.ts'
import {
  clampSidebarWidth,
  persistSidebarOpen,
  persistSidebarWidthPx,
} from '../lib/sidebarLayout.ts'
import {
  dispatchShellLayoutEvents,
  dispatchSidebarMainTab,
  clampStillImageDurationSec,
  DEFAULT_STILL_IMAGE_DURATION_SEC,
  parseWorkspaceShell,
  persistShellToLocalStorage,
  readSidebarMainTabFromLs,
  readStandaloneWorkspaceShell,
  type WorkspaceShellPersist,
} from '../lib/workspaceShell.ts'
import { isTypingTarget } from '../hooks/useKeyboardShortcuts.ts'
import {
  LAUNCHPAD_CELL_COUNT,
  LAUNCHPAD_CUE_HOLD_MS,
  cloneLaunchPadCellsSnapshot,
  defaultLaunchPadCells,
  launchPadCellsEqual,
  normalizeLaunchPadKeyMode,
  type LaunchPadCell,
  type FloatingPlaylistPanelSize,
  type FloatingPlaylistPos,
  type FloatingPlaylistSession,
  createEmptyFloatingSession,
  createLaunchPadFloatingSession,
  createLaunchPadFloatingSessionWithKit,
} from './floatingPlaylistSession.ts'

function sessionHasSavedEditLink(
  s: FloatingPlaylistSession,
): s is FloatingPlaylistSession & { editingSavedPlaylistId: string } {
  return (
    s.editingSavedPlaylistId != null &&
    (s.savedEditPathsBaseline != null || s.savedEditLaunchPadBaseline != null)
  )
}

function mergeLaunchPadCellsWithDrop(
  cells: LaunchPadCell[],
  startSlot: number,
  paths: string[],
): LaunchPadCell[] {
  if (!paths.length) return cells
  const next = cells.map((c) => ({ ...c }))
  let p = 0
  next[startSlot] = {
    ...next[startSlot]!,
    samplePath: paths[p]!,
  }
  p = 1
  for (let off = 1; off < LAUNCHPAD_CELL_COUNT && p < paths.length; off++) {
    const si = (startSlot + off) % LAUNCHPAD_CELL_COUNT
    if (!next[si].samplePath) {
      next[si] = { ...next[si], samplePath: paths[p]! }
      p++
    }
  }
  return next
}

export type LoopMode = 'off' | 'one' | 'all'

/** Chiave in `floatingZOrder` per la finestra anteprima staccata. */
export const REGIA_FLOATING_PREVIEW_ZORDER_KEY = '__regia_preview__'

export type RegiaContextValue = {
  paths: string[]
  currentIndex: number
  loopMode: LoopMode
  muted: boolean
  /** Volume lineare 0–1 per l’audio dei video in uscita (indipendente dal mute). */
  outputVolume: number
  setOutputVolume: (v: number) => void
  /** deviceId Chromium per setSinkId; stringa vuota = predefinito. */
  outputSinkId: string
  setOutputSinkId: (sinkId: string) => void
  /** True se il brano della playlist sta andando in anteprima / uscita video. */
  videoPlaying: boolean
  /** True se un sample launchpad è in riproduzione (non in pausa CUE). */
  launchpadAudioPlaying: boolean
  /** Play combinato (video o sample launchpad) per il pulsante trasporto. */
  playing: boolean
  previewSrc: string | null
  previewSyncKey: number
  /** Finestra uscita visibile sul secondo schermo; se false la finestra è nascosta (monitor “libero”). */
  secondScreenOn: boolean
  savedPlaylists: SavedPlaylistMeta[]
  openFolder: (sessionId: string) => Promise<void>
  /** Aggiunge file alla playlist del pannello indicato. */
  addMediaToPlaylist: (sessionId: string) => Promise<void>
  /** Aggiunge percorsi assoluti (es. da drag-and-drop) alla playlist a elenco. */
  addPathsToPlaylistFromPaths: (sessionId: string, paths: string[]) => void
  /** Assegna file al launchpad a partire dallo slot (primo su slot, altri su slot vuoti in avanti). */
  applyLaunchPadDropFromPaths: (
    sessionId: string,
    startSlotIndex: number,
    paths: string[],
  ) => void
  /** Rimuove un brano dall’elenco del pannello indicato. */
  removePathAt: (index: number, sessionId: string) => Promise<void>
  refreshSavedPlaylists: () => Promise<void>
  saveCurrentPlaylist: (label: string) => Promise<void>
  loadSavedPlaylist: (id: string) => Promise<void>
  deleteSavedPlaylist: (id: string) => Promise<void>
  /** Persiste l’ordine delle playlist/launchpad salvati (id nell’ordine desiderato). */
  reorderSavedPlaylists: (orderedIds: string[]) => Promise<void>
  /** Crea una nuova playlist salvata copiando percorsi, nome (con suffisso) e crossfade. */
  duplicateSavedPlaylist: (id: string) => Promise<void>
  loadIndexAndPlay: (index: number, sessionId?: string) => Promise<void>
  loadLaunchPadSlotAndPlay: (
    sessionId: string,
    slotIndex: number,
  ) => Promise<void>
  /** Ferma l’audio launchpad e azzera lo stato di brano caricato (es. rilascio CUE). */
  stopLaunchPadCueRelease: () => void
  updateLaunchPadCell: (
    sessionId: string,
    slotIndex: number,
    patch: Partial<
      Pick<
        LaunchPadCell,
        'samplePath' | 'padColor' | 'padGain' | 'padKeyCode' | 'padKeyMode'
      >
    >,
    options?: { skipUndo?: boolean },
  ) => Promise<void>
  togglePlay: () => Promise<void>
  setLoopMode: (m: LoopMode) => void
  setMuted: (m: boolean) => void
  toggleSecondScreen: () => void
  goNext: () => Promise<void>
  goPrev: () => Promise<void>
  selectItem: (index: number, sessionId: string) => void
  reorderPaths: (
    fromIndex: number,
    toIndex: number,
    sessionId: string,
  ) => void
  /** Titolo mostrato nella playlist mobile (sessione corrente). */
  playlistTitle: string
  setPlaylistTitle: (title: string, sessionId: string) => void
  /** Colore tema pannello (#rrggbb) o null per predefinito. */
  setPlaylistThemeColor: (hex: string | null, sessionId: string) => void
  /** Dissolvenza incrociata in uscita tra brani dello stesso tipo (video/immagine). */
  playlistCrossfade: boolean
  setPlaylistCrossfade: (enabled: boolean, sessionId: string) => void
  /** Loop playlist/file per il pannello a elenco (assente = loop globale header). */
  setPlaylistLoopMode: (sessionId: string, mode: LoopMode) => void
  /**
   * Loop effettivo per il brano in anteprima/uscita (pannello che comanda il video).
   */
  outputTrackLoopMode: LoopMode
  /** Aggiornamento throttled durante la riproduzione anteprima video. */
  previewMediaTimesTick: number
  previewMediaTimesRef: MutableRefObject<{
    currentTime: number
    duration: number
  }>
  reportPreviewMediaTimes: (currentTime: number, duration: number) => void
  /** Secondi di permanenza di ogni immagine fissa in playlist (1–600). */
  stillImageDurationSec: number
  setStillImageDurationSec: (seconds: number) => void
  /** Mute uscita solo per questa playlist floating (memorizzato sul pannello). */
  setPlaylistOutputMuted: (enabled: boolean, sessionId: string) => void
  /** Volume uscita per questo pannello (0–1), moltiplicato al volume globale. */
  setPlaylistOutputVolume: (volume: number, sessionId: string) => void
  /** Playlist mobile (floating) visibile nella finestra regia. */
  floatingPlaylistOpen: boolean
  /** Pannelli floating (ognuno con propria lista). */
  floatingPlaylistSessions: FloatingPlaylistSession[]
  activeFloatingSessionId: string
  setActiveFloatingSession: (id: string) => void
  /**
   * Pannelli flottanti (playlist / launchpad / anteprima): dall’indietro al
   * davanti. Ultimo elemento = sopra a tutti. Valori: id sessione o
   * `REGIA_FLOATING_PREVIEW_ZORDER_KEY`.
   */
  floatingZOrder: string[]
  bringFloatingPanelToFront: (key: string) => void
  addFloatingPlaylist: () => void
  /** Apre un Launchpad 4×4; se esiste il kit in `public/launchpad-base`, lo riempie di sample. */
  addFloatingLaunchPad: () => Promise<void>
  removeFloatingPlaylist: (id: string) => Promise<void>
  /** True se chiudere il pannello interromperebbe video o sample launchpad in play. */
  floatingCloseWouldInterruptPlay: (sessionId: string) => boolean
  closeFloatingPlaylist: (sessionId: string) => Promise<void>
  openFloatingPlaylist: () => void
  /** Nasconde i pannelli floating senza eliminare le sessioni. */
  hideFloatingPlaylistPanels: () => void
  updateFloatingPlaylistChrome: (
    sessionId: string,
    patch: {
      pos?: FloatingPlaylistPos
      collapsed?: boolean
      panelSize?: FloatingPlaylistPanelSize
      playlistOutputMuted?: boolean
      playlistOutputVolume?: number
    },
  ) => void
  /** True se la playlist del pannello è una salvata modificata. */
  savedPlaylistDirty: (sessionId: string) => boolean
  /** Salva sovrascrivendo la playlist salvata associata a quel pannello. */
  saveLoadedPlaylistOverwrite: (sessionId: string) => Promise<void>
  /** Dopo commit titolo (blur/Invio): se la sessione modifica una playlist salvata, salva su disco se titolo, elenco o crossfade sono cambiati. */
  persistSavedPlaylistAfterFloatingTitleBlur: (
    trimmedTitle: string,
    sessionId: string,
  ) => Promise<void>
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** Cattura uno stato annullabile (es. prima di commit titolo da blur). */
  recordUndoPoint: () => void
  /** Brano caricato in anteprima/uscita: una sola riga evidenziabile tra più pannelli. */
  playbackLoadedTrack: { sessionId: string; index: number } | null
  /** Workspace nominati (layout plancia + pannelli). */
  namedWorkspaces: NamedWorkspaceMeta[]
  refreshNamedWorkspaces: () => void
  /** Crea un nuovo preset con lo snapshot corrente della plancia. */
  createNewNamedWorkspace: () => void
  saveNamedWorkspace: (label: string) => void
  loadNamedWorkspace: (id: string) => Promise<void>
  deleteNamedWorkspace: (id: string) => void
  renameNamedWorkspace: (id: string, label: string) => void
  overwriteNamedWorkspace: (id: string) => void
  duplicateNamedWorkspace: (id: string) => void
  /** Preset workspace attualmente caricato (per intestazione plancia). */
  activeNamedWorkspaceId: string | null
  activeNamedWorkspaceLabel: string
  /** Anteprima in finestra flottante (salvata nel workspace). */
  previewDetached: boolean
  setPreviewDocked: () => void
  setPreviewFloating: () => void
  /** Pannello sinistro playlist / workspace. */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebarOpen: () => void
  sidebarWidthPx: number
  /** Larghezza sidebar; con `persist` false (default true) non scrive su disco fino al commit (es. trascinamento). */
  setSidebarWidthPx: (w: number, persist?: boolean) => void
}

export type NamedWorkspaceMeta = {
  id: string
  label: string
  savedAt: number
}

const LS_FLOATING_VISIBLE = 'regia-floating-playlist-visible'
const LS_FLOATING_WORKSPACE = 'regia-floating-workspace'
const LS_NAMED_WORKSPACES = 'regia-named-workspaces'
const LS_OUTPUT_VOLUME = 'regia-output-volume'
const LS_OUTPUT_SINK = 'regia-output-sink-id'

type FloatingWorkspacePersistV1 = {
  v: 1
  open: boolean
  activeFloatingSessionId: string
  playbackSessionId: string | null
  sessions: FloatingPlaylistSession[]
}

type FloatingWorkspacePersistV2 = {
  v: 2
  open: boolean
  activeFloatingSessionId: string
  playbackSessionId: string | null
  sessions: FloatingPlaylistSession[]
  shell: WorkspaceShellPersist
}

type NormalizedFloatingWorkspace = {
  open: boolean
  sessions: FloatingPlaylistSession[]
  activeFloatingSessionId: string
  playbackSessionId: string | null
}

function parseFloatingPos(raw: unknown): FloatingPlaylistPos | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const x = Number(o.x)
  const y = Number(o.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return { x, y }
}

function parseFloatingPanelSize(
  raw: unknown,
): FloatingPlaylistPanelSize | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const width = Number(o.width)
  const height = Number(o.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined
  if (width < 120 || height < 80) return undefined
  return { width, height }
}

function parsePersistedPlaylistLoopMode(
  raw: unknown,
): 'off' | 'one' | 'all' | undefined {
  if (raw === 'off' || raw === 'one' || raw === 'all') return raw
  return undefined
}

function reviveFloatingSession(raw: unknown): FloatingPlaylistSession | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const def = createEmptyFloatingSession()
  const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : def.id
  const pos = parseFloatingPos(r.pos) ?? def.pos
  const panelSize = parseFloatingPanelSize(r.panelSize) ?? def.panelSize
  const collapsed =
    typeof r.collapsed === 'boolean' ? r.collapsed : def.collapsed
  const paths = Array.isArray(r.paths)
    ? r.paths.filter((p): p is string => typeof p === 'string')
    : []
  let currentIndex = 0
  if (typeof r.currentIndex === 'number' && Number.isFinite(r.currentIndex)) {
    const maxI = Math.max(0, paths.length - 1)
    currentIndex = Math.max(
      0,
      Math.min(maxI, Math.floor(r.currentIndex)),
    )
  }
  const playlistTitle =
    typeof r.playlistTitle === 'string'
      ? r.playlistTitle.slice(0, 120)
      : def.playlistTitle
  const playlistCrossfade =
    typeof r.playlistCrossfade === 'boolean'
      ? r.playlistCrossfade
      : def.playlistCrossfade
  const playlistOutputMuted =
    typeof r.playlistOutputMuted === 'boolean'
      ? r.playlistOutputMuted
      : def.playlistOutputMuted
  let playlistOutputVolume = def.playlistOutputVolume
  if (
    typeof r.playlistOutputVolume === 'number' &&
    Number.isFinite(r.playlistOutputVolume)
  ) {
    playlistOutputVolume = Math.min(
      1,
      Math.max(0, r.playlistOutputVolume),
    )
  }
  const playlistThemeColor =
    typeof r.playlistThemeColor === 'string'
      ? normalizePlaylistThemeColor(r.playlistThemeColor)
      : def.playlistThemeColor
  const playlistMode =
    r.playlistMode === 'launchpad'
      ? ('launchpad' as const)
      : r.playlistMode === 'tracks'
        ? ('tracks' as const)
        : undefined

  let launchPadCells: LaunchPadCell[] | undefined
  if (playlistMode === 'launchpad') {
    const rawCells = r.launchPadCells
    const defaults = defaultLaunchPadCells()
    if (Array.isArray(rawCells) && rawCells.length >= LAUNCHPAD_CELL_COUNT) {
      launchPadCells = rawCells.slice(0, LAUNCHPAD_CELL_COUNT).map((cell, i) => {
        if (!cell || typeof cell !== 'object') return defaults[i]!
        const c = cell as Record<string, unknown>
        const samplePath =
          typeof c.samplePath === 'string' ? c.samplePath : null
        const padColor =
          typeof c.padColor === 'string' ? c.padColor : defaults[i]!.padColor
        const padGain =
          typeof c.padGain === 'number' && Number.isFinite(c.padGain)
            ? Math.min(1, Math.max(0, c.padGain))
            : 1
        const padKeyCode = normalizePersistedPadKeyCode(c.padKeyCode)
        const padKeyMode = normalizeLaunchPadKeyMode(c.padKeyMode)
        return { samplePath, padColor, padGain, padKeyCode, padKeyMode }
      })
    } else {
      launchPadCells = defaults
    }
  }

  const editingSavedPlaylistId =
    r.editingSavedPlaylistId === null
      ? null
      : typeof r.editingSavedPlaylistId === 'string'
        ? r.editingSavedPlaylistId
        : null

  let savedEditPathsBaseline: string[] | null = null
  if (r.savedEditPathsBaseline === null) {
    savedEditPathsBaseline = null
  } else if (Array.isArray(r.savedEditPathsBaseline)) {
    savedEditPathsBaseline = r.savedEditPathsBaseline.filter(
      (p): p is string => typeof p === 'string',
    )
  }

  const savedEditTitleBaseline =
    typeof r.savedEditTitleBaseline === 'string'
      ? r.savedEditTitleBaseline
      : ''
  const savedEditCrossfadeBaseline =
    typeof r.savedEditCrossfadeBaseline === 'boolean'
      ? r.savedEditCrossfadeBaseline
      : false
  const playlistLoopMode = parsePersistedPlaylistLoopMode(r.playlistLoopMode)
  const savedEditPlaylistLoopBaseline = parsePersistedPlaylistLoopMode(
    r.savedEditPlaylistLoopBaseline,
  )
  const savedEditThemeColorBaseline =
    typeof r.savedEditThemeColorBaseline === 'string'
      ? normalizePlaylistThemeColor(r.savedEditThemeColorBaseline)
      : ''

  let savedEditLaunchPadBaseline: LaunchPadCell[] | null = null
  if (r.savedEditLaunchPadBaseline === null) {
    savedEditLaunchPadBaseline = null
  } else if (Array.isArray(r.savedEditLaunchPadBaseline)) {
    const defB = defaultLaunchPadCells()
    const rawB = r.savedEditLaunchPadBaseline
    if (rawB.length >= LAUNCHPAD_CELL_COUNT) {
      savedEditLaunchPadBaseline = rawB
        .slice(0, LAUNCHPAD_CELL_COUNT)
        .map((cell, i) => {
          if (!cell || typeof cell !== 'object') return defB[i]!
          const c = cell as Record<string, unknown>
          const samplePath =
            typeof c.samplePath === 'string' ? c.samplePath : null
          const padColor =
            typeof c.padColor === 'string' ? c.padColor : defB[i]!.padColor
          const padGain =
            typeof c.padGain === 'number' && Number.isFinite(c.padGain)
              ? Math.min(1, Math.max(0, c.padGain))
              : 1
          const padKeyCode = normalizePersistedPadKeyCode(c.padKeyCode)
          const padKeyMode = normalizeLaunchPadKeyMode(c.padKeyMode)
          return { samplePath, padColor, padGain, padKeyCode, padKeyMode }
        })
    }
  }

  return {
    id,
    pos,
    panelSize,
    collapsed,
    playlistMode,
    launchPadCells,
    paths,
    currentIndex,
    playlistTitle,
    playlistCrossfade,
    ...(playlistLoopMode !== undefined ? { playlistLoopMode } : {}),
    playlistOutputMuted,
    playlistOutputVolume,
    playlistThemeColor,
    editingSavedPlaylistId,
    savedEditPathsBaseline,
    savedEditTitleBaseline,
    savedEditCrossfadeBaseline,
    ...(savedEditPlaylistLoopBaseline !== undefined
      ? { savedEditPlaylistLoopBaseline }
      : {}),
    savedEditThemeColorBaseline,
    savedEditLaunchPadBaseline,
  }
}

const EMPTY_FLOATING_WORKSPACE_STATE: NormalizedFloatingWorkspace = {
  open: false,
  sessions: [] as FloatingPlaylistSession[],
  activeFloatingSessionId: '',
  playbackSessionId: null as string | null,
}

function parseFloatingWorkspaceSessions(
  p: Record<string, unknown>,
): NormalizedFloatingWorkspace | null {
  if ((p.v !== 1 && p.v !== 2) || !Array.isArray(p.sessions)) return null
  const sessions = p.sessions
    .map(reviveFloatingSession)
    .filter((s): s is FloatingPlaylistSession => s != null)
  let open = Boolean(p.open)
  if (open && sessions.length === 0) open = false
  let activeFloatingSessionId =
    typeof p.activeFloatingSessionId === 'string'
      ? p.activeFloatingSessionId
      : ''
  if (!sessions.some((s) => s.id === activeFloatingSessionId)) {
    activeFloatingSessionId = sessions[0]?.id ?? ''
  }
  let playbackSessionId: string | null = null
  if (typeof p.playbackSessionId === 'string') {
    playbackSessionId = p.playbackSessionId
  } else if (p.playbackSessionId === null) {
    playbackSessionId = null
  }
  if (
    playbackSessionId &&
    !sessions.some((s) => s.id === playbackSessionId)
  ) {
    playbackSessionId = null
  }
  return {
    open,
    sessions,
    activeFloatingSessionId,
    playbackSessionId,
  }
}

function normalizeWorkspaceFile(parsed: unknown): {
  floating: NormalizedFloatingWorkspace
  shell: WorkspaceShellPersist | null
} | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Record<string, unknown>
  const floating = parseFloatingWorkspaceSessions(p)
  if (!floating) return null
  if (p.v === 2 && p.shell != null) {
    const shell =
      parseWorkspaceShell(p.shell) ?? readStandaloneWorkspaceShell()
    return { floating, shell }
  }
  return { floating, shell: null }
}

function readWorkspaceBootstrap(): {
  floating: NormalizedFloatingWorkspace
  shell: WorkspaceShellPersist
} {
  try {
    const raw = localStorage.getItem(LS_FLOATING_WORKSPACE)
    if (!raw) {
      return {
        floating: { ...EMPTY_FLOATING_WORKSPACE_STATE },
        shell: readStandaloneWorkspaceShell(),
      }
    }
    const n = normalizeWorkspaceFile(JSON.parse(raw))
    if (!n) {
      return {
        floating: { ...EMPTY_FLOATING_WORKSPACE_STATE },
        shell: readStandaloneWorkspaceShell(),
      }
    }
    return {
      floating: n.floating,
      shell: n.shell ?? readStandaloneWorkspaceShell(),
    }
  } catch {
    return {
      floating: { ...EMPTY_FLOATING_WORKSPACE_STATE },
      shell: readStandaloneWorkspaceShell(),
    }
  }
}

type NamedWorkspaceStoredV1 = {
  id: string
  label: string
  savedAt: number
  snapshot: FloatingWorkspacePersistV1 | FloatingWorkspacePersistV2
}

type NamedWorkspacesRootV1 = {
  v: 1
  items: NamedWorkspaceStoredV1[]
}

function readNamedWorkspacesRoot(): NamedWorkspacesRootV1 {
  try {
    const raw = localStorage.getItem(LS_NAMED_WORKSPACES)
    if (!raw) return { v: 1, items: [] }
    const p = JSON.parse(raw) as Partial<NamedWorkspacesRootV1>
    if (p?.v !== 1 || !Array.isArray(p.items)) return { v: 1, items: [] }
    const items = p.items.filter(
      (x): x is NamedWorkspaceStoredV1 =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as NamedWorkspaceStoredV1).id === 'string' &&
        typeof (x as NamedWorkspaceStoredV1).label === 'string' &&
        typeof (x as NamedWorkspaceStoredV1).savedAt === 'number' &&
        (x as NamedWorkspaceStoredV1).snapshot != null &&
        typeof (x as NamedWorkspaceStoredV1).snapshot === 'object',
    )
    return { v: 1, items }
  } catch {
    return { v: 1, items: [] }
  }
}

function writeNamedWorkspacesRoot(root: NamedWorkspacesRootV1): void {
  try {
    localStorage.setItem(LS_NAMED_WORKSPACES, JSON.stringify(root))
  } catch {
    /* ignore */
  }
}

function readNamedWorkspaceMetas(): NamedWorkspaceMeta[] {
  return readNamedWorkspacesRoot().items.map(({ id, label, savedAt }) => ({
    id,
    label,
    savedAt,
  }))
}

function nextUniqueWorkspaceLabel(preferred: string): string {
  const root = readNamedWorkspacesRoot()
  const used = new Set(
    root.items.map((x) => x.label.trim().toLowerCase()),
  )
  let label = preferred.trim().slice(0, 80) || 'Workspace'
  const base = label
  let n = 2
  while (used.has(label.toLowerCase())) {
    const suffix = ` (${n})`
    label = (base.slice(0, Math.max(1, 80 - suffix.length)) + suffix).slice(
      0,
      80,
    )
    n++
  }
  return label
}

/** Cartella comune del primo file (nome cartella) per titolo di default. */
function folderBasenameFromPaths(paths: string[]): string {
  if (!paths.length) return ''
  const first = paths[0].replace(/\\/g, '/')
  const lastSlash = first.lastIndexOf('/')
  if (lastSlash <= 0) return 'Playlist'
  const dir = first.slice(0, lastSlash)
  const parentSlash = dir.lastIndexOf('/')
  const base = parentSlash >= 0 ? dir.slice(parentSlash + 1) : dir
  return base.trim() || 'Playlist'
}

function pathsEqual(a: string[], b: string[] | null): boolean {
  if (!b || a.length !== b.length) return false
  return a.every((p, i) => p === b[i])
}

const MAX_UNDO = 50

type RegiaHistorySnapshot = {
  floatingSessions: FloatingPlaylistSession[]
  activeFloatingSessionId: string
  playbackSessionId: string | null
  previewSrc: string | null
  previewSyncKey: number
  videoPlaying: boolean
  launchpadAudioPlaying: boolean
  loadedIndex: number | null
}

function initialVideoOutputSessionId(
  sessions: FloatingPlaylistSession[],
  playbackId: string | null,
): string | null {
  if (playbackId) {
    const p = sessions.find((s) => s.id === playbackId)
    if (p && p.playlistMode !== 'launchpad') return playbackId
  }
  const first = sessions.find((s) => s.playlistMode !== 'launchpad')
  return first?.id ?? null
}

function deepCloneFloatingSessions(
  sessions: FloatingPlaylistSession[],
): FloatingPlaylistSession[] {
  return sessions.map((s) => ({
    ...s,
    paths: [...s.paths],
    launchPadCells: s.launchPadCells?.map((c) => ({ ...c })),
    playlistOutputMuted: s.playlistOutputMuted ?? false,
    playlistOutputVolume:
      typeof s.playlistOutputVolume === 'number' &&
      Number.isFinite(s.playlistOutputVolume)
        ? Math.min(1, Math.max(0, s.playlistOutputVolume))
        : 1,
    savedEditPathsBaseline: s.savedEditPathsBaseline
      ? [...s.savedEditPathsBaseline]
      : null,
    savedEditLaunchPadBaseline: s.savedEditLaunchPadBaseline
      ? s.savedEditLaunchPadBaseline.map((c) => ({ ...c }))
      : null,
  }))
}

const RegiaContext = createContext<RegiaContextValue | null>(null)

export function RegiaProvider({ children }: { children: ReactNode }) {
  const [bootstrap] = useState(() => readWorkspaceBootstrap())

  const [floatingSessions, setFloatingSessions] = useState<
    FloatingPlaylistSession[]
  >(() => deepCloneFloatingSessions(bootstrap.floating.sessions))
  const [activeFloatingSessionId, setActiveFloatingSessionId] = useState(
    () => bootstrap.floating.activeFloatingSessionId,
  )
  const [floatingZOrder, setFloatingZOrder] = useState<string[]>(() => {
    const ids = bootstrap.floating.sessions.map((s) => s.id)
    if (bootstrap.shell.previewDetached)
      ids.push(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
    return ids
  })
  /** Sessione la cui playlist comanda trasporto / uscita dopo un load. */
  const [playbackSessionId, setPlaybackSessionId] = useState<string | null>(
    () => bootstrap.floating.playbackSessionId,
  )
  const [videoOutputSessionId, setVideoOutputSessionId] = useState<
    string | null
  >(() =>
    initialVideoOutputSessionId(
      bootstrap.floating.sessions,
      bootstrap.floating.playbackSessionId,
    ),
  )
  const [loopMode, setLoopModeState] = useState<LoopMode>(
    () => bootstrap.shell.loopMode,
  )
  const [stillImageDurationSec, setStillImageDurationSecState] = useState(() =>
    clampStillImageDurationSec(
      typeof bootstrap.shell.stillImageDurationSec === 'number'
        ? bootstrap.shell.stillImageDurationSec
        : DEFAULT_STILL_IMAGE_DURATION_SEC,
    ),
  )
  const stillImageDurationSecRef = useRef(stillImageDurationSec)
  useLayoutEffect(() => {
    stillImageDurationSecRef.current = stillImageDurationSec
  }, [stillImageDurationSec])
  /** Loop globale header (persistenza shell); distinto dal loop effettivo trasporto. */
  const shellLoopModeRef = useRef(loopMode)
  useLayoutEffect(() => {
    shellLoopModeRef.current = loopMode
  }, [loopMode])
  const previewMediaTimesRef = useRef({ currentTime: 0, duration: 0 })
  const previewMediaTimesLastBumpRef = useRef(0)
  const [previewMediaTimesTick, setPreviewMediaTimesTick] = useState(0)
  const reportPreviewMediaTimes = useCallback(
    (currentTime: number, duration: number) => {
      previewMediaTimesRef.current = {
        currentTime: Number.isFinite(currentTime)
          ? Math.max(0, currentTime)
          : 0,
        duration:
          typeof duration === 'number' &&
          Number.isFinite(duration) &&
          duration > 0
            ? duration
            : 0,
      }
      const now = performance.now()
      if (now - previewMediaTimesLastBumpRef.current >= 88) {
        previewMediaTimesLastBumpRef.current = now
        setPreviewMediaTimesTick((x) => x + 1)
      }
    },
    [],
  )
  const [muted, setMutedState] = useState(() => bootstrap.shell.muted)
  const [outputVolume, setOutputVolumeState] = useState(
    () => bootstrap.shell.outputVolume,
  )
  const [outputSinkId, setOutputSinkIdState] = useState(
    () => bootstrap.shell.outputSinkId,
  )
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [launchpadAudioPlaying, setLaunchpadAudioPlaying] = useState(false)
  const playing = videoPlaying || launchpadAudioPlaying
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewSyncKey, setPreviewSyncKey] = useState(0)
  const [secondScreenOn, setSecondScreenOn] = useState(
    () => bootstrap.shell.secondScreenOn,
  )
  const [previewDetached, setPreviewDetached] = useState(
    () => bootstrap.shell.previewDetached,
  )
  const [sidebarOpen, setSidebarOpenState] = useState(
    () => bootstrap.shell.sidebarOpen,
  )
  const [sidebarWidthPx, setSidebarWidthPxState] = useState(
    () => bootstrap.shell.sidebarWidthPx,
  )
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylistMeta[]>([])
  const [floatingPlaylistOpen, setFloatingPlaylistOpen] = useState(
    () => bootstrap.floating.open,
  )
  const floatingPlaylistOpenRef = useRef(bootstrap.floating.open)
  useLayoutEffect(() => {
    floatingPlaylistOpenRef.current = floatingPlaylistOpen
  }, [floatingPlaylistOpen])

  useLayoutEffect(() => {
    persistShellToLocalStorage(bootstrap.shell)
    writePreviewLayoutToLs(bootstrap.shell.previewLayout)
    void window.electronAPI
      .setOutputResolution(bootstrap.shell.outputResolution)
      .catch(() => {
        /* ignore */
      })
    dispatchShellLayoutEvents()
    dispatchSidebarMainTab(bootstrap.shell.sidebarMainTab)
  }, [bootstrap])

  const mutedRef = useRef(muted)
  useLayoutEffect(() => {
    mutedRef.current = muted
  }, [muted])

  const previewDetachedRef = useRef(previewDetached)
  useLayoutEffect(() => {
    previewDetachedRef.current = previewDetached
  }, [previewDetached])

  const sidebarOpenRef = useRef(sidebarOpen)
  useLayoutEffect(() => {
    sidebarOpenRef.current = sidebarOpen
  }, [sidebarOpen])

  const sidebarWidthPxRef = useRef(sidebarWidthPx)
  useLayoutEffect(() => {
    sidebarWidthPxRef.current = sidebarWidthPx
  }, [sidebarWidthPx])

  const [playbackLoadedTrack, setPlaybackLoadedTrack] = useState<{
    sessionId: string
    index: number
  } | null>(null)
  const playbackLoadedTrackRef = useRef(playbackLoadedTrack)
  useLayoutEffect(() => {
    playbackLoadedTrackRef.current = playbackLoadedTrack
  }, [playbackLoadedTrack])

  const [namedWorkspaces, setNamedWorkspaces] = useState<NamedWorkspaceMeta[]>(
    () => readNamedWorkspaceMetas(),
  )
  const [activeNamedWorkspaceId, setActiveNamedWorkspaceId] = useState<
    string | null
  >(null)
  const [activeNamedWorkspaceLabel, setActiveNamedWorkspaceLabel] =
    useState('')

  const activeFloatingSessionIdRef = useRef(activeFloatingSessionId)
  useLayoutEffect(() => {
    activeFloatingSessionIdRef.current = activeFloatingSessionId
  }, [activeFloatingSessionId])

  const playbackSessionIdStateRef = useRef(playbackSessionId)
  useLayoutEffect(() => {
    playbackSessionIdStateRef.current = playbackSessionId
  }, [playbackSessionId])

  const videoOutputSessionIdRef = useRef(videoOutputSessionId)
  useLayoutEffect(() => {
    videoOutputSessionIdRef.current = videoOutputSessionId
  }, [videoOutputSessionId])

  const floatingWorkspaceSaveTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  const previewSrcRef = useRef(previewSrc)
  const previewSyncKeyRef = useRef(previewSyncKey)
  const videoPlayingRef = useRef(videoPlaying)
  const launchpadAudioPlayingRef = useRef(launchpadAudioPlaying)
  useLayoutEffect(() => {
    previewSrcRef.current = previewSrc
    previewSyncKeyRef.current = previewSyncKey
    videoPlayingRef.current = videoPlaying
    launchpadAudioPlayingRef.current = launchpadAudioPlaying
  }, [previewSrc, previewSyncKey, videoPlaying, launchpadAudioPlaying])

  const undoStackRef = useRef<RegiaHistorySnapshot[]>([])
  const redoStackRef = useRef<RegiaHistorySnapshot[]>([])
  const isApplyingHistoryRef = useRef(false)
  const [historyRev, setHistoryRev] = useState(0)

  const resolvedActiveId =
    floatingSessions.some((s) => s.id === activeFloatingSessionId)
      ? activeFloatingSessionId
      : (floatingSessions[0]?.id ?? '')

  const resolvedPlaybackId =
    playbackSessionId &&
    floatingSessions.some((s) => s.id === playbackSessionId)
      ? playbackSessionId
      : resolvedActiveId

  const resolvedPlaybackIdRef = useRef(resolvedPlaybackId)
  useLayoutEffect(() => {
    resolvedPlaybackIdRef.current = resolvedPlaybackId
  }, [resolvedPlaybackId])

  useEffect(() => {
    setActiveFloatingSessionId((cur) =>
      cur && floatingSessions.some((s) => s.id === cur)
        ? cur
        : (floatingSessions[0]?.id ?? ''),
    )
  }, [floatingSessions])

  useLayoutEffect(() => {
    setFloatingZOrder((prev) => {
      const allowed = new Set<string>()
      for (const s of floatingSessions) allowed.add(s.id)
      if (previewDetached) allowed.add(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
      const kept = prev.filter((k) => allowed.has(k))
      const out = [...kept]
      for (const s of floatingSessions) {
        if (!out.includes(s.id)) out.push(s.id)
      }
      if (
        previewDetached &&
        !out.includes(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
      ) {
        out.push(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
      }
      return out
    })
  }, [floatingSessions, previewDetached])

  useEffect(() => {
    setPlaybackSessionId((cur) =>
      cur && floatingSessions.some((s) => s.id === cur)
        ? cur
        : (floatingSessions[0]?.id ?? null),
    )
  }, [floatingSessions])

  useEffect(() => {
    setVideoOutputSessionId((cur) => {
      if (
        cur &&
        floatingSessions.some(
          (s) => s.id === cur && s.playlistMode !== 'launchpad',
        )
      )
        return cur
      return initialVideoOutputSessionId(
        floatingSessions,
        playbackSessionId,
      )
    })
  }, [floatingSessions, playbackSessionId])

  const activeSession = useMemo((): FloatingPlaylistSession | null => {
    return (
      floatingSessions.find((s) => s.id === resolvedActiveId) ??
      floatingSessions[0] ??
      null
    )
  }, [floatingSessions, resolvedActiveId])

  const playbackSession = useMemo((): FloatingPlaylistSession | null => {
    return (
      floatingSessions.find((s) => s.id === resolvedPlaybackId) ??
      floatingSessions[0] ??
      null
    )
  }, [floatingSessions, resolvedPlaybackId])

  const outputTrackLoopMode = useMemo((): LoopMode => {
    const videoS =
      videoOutputSessionId &&
      floatingSessions.some((s) => s.id === videoOutputSessionId)
        ? floatingSessions.find((s) => s.id === videoOutputSessionId)
        : null
    const pathSource =
      videoS && videoS.playlistMode !== 'launchpad'
        ? videoS
        : playbackSession && playbackSession.playlistMode !== 'launchpad'
          ? playbackSession
          : null
    return pathSource?.playlistLoopMode !== undefined
      ? pathSource.playlistLoopMode
      : loopMode
  }, [
    videoOutputSessionId,
    floatingSessions,
    playbackSession,
    loopMode,
  ])

  const videoOutputSession = useMemo((): FloatingPlaylistSession | null => {
    if (!videoOutputSessionId) return null
    return floatingSessions.find((s) => s.id === videoOutputSessionId) ?? null
  }, [floatingSessions, videoOutputSessionId])

  /** Elenco della sessione attiva (sidebar «Salva», ecc.). */
  const paths = activeSession?.paths ?? []
  const currentIndex = activeSession?.currentIndex ?? 0
  const playlistTitle = activeSession?.playlistTitle ?? ''
  const playlistCrossfade = activeSession?.playlistCrossfade ?? false

  const floatingSessionsRef = useRef(floatingSessions)
  useLayoutEffect(() => {
    floatingSessionsRef.current = floatingSessions
  }, [floatingSessions])

  const patchFloatingSession = useCallback(
    (
      id: string,
      patch:
        | Partial<FloatingPlaylistSession>
        | ((s: FloatingPlaylistSession) => FloatingPlaylistSession),
    ) => {
      setFloatingSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== id) return s
          return typeof patch === 'function' ? patch(s) : { ...s, ...patch }
        })
        /** Subito dopo un salvataggio su disco il blur del titolo può girare nello stesso tick: il ref altrimenti resta indietro rispetto allo stato fino al layout. */
        floatingSessionsRef.current = next
        return next
      })
    },
    [],
  )

  const pathsRef = useRef(paths)
  const currentIndexRef = useRef(currentIndex)
  const loopModeRef = useRef(loopMode)
  const loadedIndexRef = useRef<number | null>(null)
  const secondScreenOnRef = useRef(secondScreenOn)
  const outputVolumeRef = useRef(outputVolume)
  const outputSinkIdRef = useRef(outputSinkId)
  useLayoutEffect(() => {
    outputVolumeRef.current = outputVolume
  }, [outputVolume])
  useLayoutEffect(() => {
    outputSinkIdRef.current = outputSinkId
  }, [outputSinkId])

  useLayoutEffect(() => {
    const videoS =
      videoOutputSessionId &&
      floatingSessions.some((s) => s.id === videoOutputSessionId)
        ? floatingSessions.find((s) => s.id === videoOutputSessionId)
        : null
    const pathSource =
      videoS && videoS.playlistMode !== 'launchpad'
        ? videoS
        : playbackSession && playbackSession.playlistMode !== 'launchpad'
          ? playbackSession
          : null
    pathsRef.current = pathSource?.paths ?? []
    currentIndexRef.current = pathSource?.currentIndex ?? 0
    loopModeRef.current =
      pathSource?.playlistLoopMode !== undefined
        ? pathSource.playlistLoopMode
        : loopMode
    secondScreenOnRef.current = secondScreenOn
  }, [
    videoOutputSessionId,
    playbackSession,
    floatingSessions,
    loopMode,
    secondScreenOn,
  ])

  const lastOutputResolutionRef = useRef(bootstrap.shell.outputResolution)

  const persistFloatingWorkspaceBlob = useCallback(async () => {
    try {
      let outputResolution = lastOutputResolutionRef.current
      try {
        const r = await window.electronAPI.getOutputResolution()
        if (r) {
          outputResolution = { width: r.width, height: r.height }
          lastOutputResolutionRef.current = outputResolution
        }
      } catch {
        /* ignore */
      }
      const shell: WorkspaceShellPersist = {
        previewDetached: previewDetachedRef.current,
        previewLayout: readPreviewLayoutFromLs(),
        sidebarOpen: sidebarOpenRef.current,
        sidebarWidthPx: sidebarWidthPxRef.current,
        outputResolution,
        loopMode: shellLoopModeRef.current,
        muted: mutedRef.current,
        outputVolume: outputVolumeRef.current,
        outputSinkId: outputSinkIdRef.current,
        secondScreenOn: secondScreenOnRef.current,
        sidebarMainTab: readSidebarMainTabFromLs(),
        stillImageDurationSec: stillImageDurationSecRef.current,
      }
      const payload: FloatingWorkspacePersistV2 = {
        v: 2,
        open: floatingPlaylistOpenRef.current,
        activeFloatingSessionId: activeFloatingSessionIdRef.current,
        playbackSessionId: playbackSessionIdStateRef.current,
        sessions: deepCloneFloatingSessions(floatingSessionsRef.current),
        shell,
      }
      localStorage.setItem(LS_FLOATING_WORKSPACE, JSON.stringify(payload))
      localStorage.setItem(
        LS_FLOATING_VISIBLE,
        floatingPlaylistOpenRef.current ? 'true' : 'false',
      )
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (floatingWorkspaceSaveTimerRef.current) {
      clearTimeout(floatingWorkspaceSaveTimerRef.current)
    }
    floatingWorkspaceSaveTimerRef.current = setTimeout(() => {
      floatingWorkspaceSaveTimerRef.current = null
      void persistFloatingWorkspaceBlob()
    }, 450)
    return () => {
      if (floatingWorkspaceSaveTimerRef.current) {
        clearTimeout(floatingWorkspaceSaveTimerRef.current)
        floatingWorkspaceSaveTimerRef.current = null
      }
    }
  }, [
    floatingPlaylistOpen,
    activeFloatingSessionId,
    playbackSessionId,
    floatingSessions,
    previewDetached,
    sidebarOpen,
    sidebarWidthPx,
    loopMode,
    muted,
    outputVolume,
    outputSinkId,
    secondScreenOn,
    stillImageDurationSec,
    persistFloatingWorkspaceBlob,
  ])

  useEffect(() => {
    const flushFloatingWorkspace = () => {
      void persistFloatingWorkspaceBlob()
    }
    window.addEventListener('pagehide', flushFloatingWorkspace)
    window.addEventListener('beforeunload', flushFloatingWorkspace)
    return () => {
      window.removeEventListener('pagehide', flushFloatingWorkspace)
      window.removeEventListener('beforeunload', flushFloatingWorkspace)
    }
  }, [persistFloatingWorkspaceBlob])

  const send = useCallback(
    (cmd: Parameters<typeof window.electronAPI.sendPlayback>[0]) =>
      window.electronAPI.sendPlayback(cmd),
    [],
  )

  const takeHistorySnapshot = useCallback((): RegiaHistorySnapshot => {
    return {
      floatingSessions: deepCloneFloatingSessions(floatingSessionsRef.current),
      activeFloatingSessionId: activeFloatingSessionIdRef.current,
      playbackSessionId: playbackSessionIdStateRef.current,
      previewSrc: previewSrcRef.current,
      previewSyncKey: previewSyncKeyRef.current,
      videoPlaying: videoPlayingRef.current,
      launchpadAudioPlaying: launchpadAudioPlayingRef.current,
      loadedIndex: loadedIndexRef.current,
    }
  }, [])

  const bumpHistory = useCallback(() => {
    setHistoryRev((n) => n + 1)
  }, [])

  const recordUndoPoint = useCallback(() => {
    if (isApplyingHistoryRef.current) return
    undoStackRef.current.push(takeHistorySnapshot())
    redoStackRef.current = []
    if (undoStackRef.current.length > MAX_UNDO) {
      undoStackRef.current.shift()
    }
    bumpHistory()
  }, [takeHistorySnapshot, bumpHistory])

  const applyHistorySnapshot = useCallback((snap: RegiaHistorySnapshot) => {
    isApplyingHistoryRef.current = true
    stopLaunchpadSample()
    const fs = deepCloneFloatingSessions(snap.floatingSessions)
    setFloatingSessions(fs)
    if (fs.length === 0) {
      setFloatingPlaylistOpen(false)
      try {
        localStorage.setItem(LS_FLOATING_VISIBLE, 'false')
      } catch {
        /* ignore */
      }
    }
    setActiveFloatingSessionId(snap.activeFloatingSessionId)
    setPlaybackSessionId(snap.playbackSessionId)
    setPreviewSrc(snap.previewSrc)
    setPreviewSyncKey(snap.previewSyncKey)
    setVideoPlaying(snap.videoPlaying)
    setLaunchpadAudioPlaying(snap.launchpadAudioPlaying)
    loadedIndexRef.current = snap.loadedIndex
    const li = snap.loadedIndex
    const pb = snap.playbackSessionId
    const pbSession = fs.find((s) => s.id === pb)
    if (li != null && pb && pbSession) {
      if (
        pbSession.playlistMode === 'launchpad' &&
        pbSession.launchPadCells &&
        li >= 0 &&
        li < LAUNCHPAD_CELL_COUNT
      ) {
        setPlaybackLoadedTrack({ sessionId: pb, index: li })
      } else if (li >= 0 && li < pbSession.paths.length) {
        setPlaybackLoadedTrack({ sessionId: pb, index: li })
      } else {
        setPlaybackLoadedTrack(null)
      }
    } else {
      setPlaybackLoadedTrack(null)
    }
    setVideoOutputSessionId(initialVideoOutputSessionId(fs, pb))
    isApplyingHistoryRef.current = false
  }, [])

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const target = undoStackRef.current.pop()!
    redoStackRef.current.push(takeHistorySnapshot())
    applyHistorySnapshot(target)
    bumpHistory()
  }, [takeHistorySnapshot, applyHistorySnapshot, bumpHistory])

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    const target = redoStackRef.current.pop()!
    undoStackRef.current.push(takeHistorySnapshot())
    applyHistorySnapshot(target)
    bumpHistory()
  }, [takeHistorySnapshot, applyHistorySnapshot, bumpHistory])

  const applyPathsList = useCallback(
    async (
      list: string[],
      sessionId: string,
      opts?: { skipHistory?: boolean },
    ) => {
      if (!list.length) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (s0?.playlistMode === 'launchpad') return
      if (!opts?.skipHistory) {
        recordUndoPoint()
      }
      const preserveSavedEdit = s0 != null && sessionHasSavedEditLink(s0)
      if (preserveSavedEdit) {
        patchFloatingSession(sessionId, {
          paths: list,
          currentIndex: 0,
        })
      } else {
        patchFloatingSession(sessionId, {
          paths: list,
          currentIndex: 0,
          editingSavedPlaylistId: null,
          savedEditPathsBaseline: null,
          savedEditLaunchPadBaseline: null,
          savedEditTitleBaseline: '',
          savedEditCrossfadeBaseline: false,
          savedEditPlaylistLoopBaseline: undefined,
          savedEditThemeColorBaseline: '',
          playlistCrossfade: true,
        })
      }
      setPlaybackSessionId(sessionId)
      setActiveFloatingSessionId(sessionId)
      setVideoOutputSessionId(sessionId)
      setPreviewSrc(null)
      setPreviewSyncKey(0)
      setVideoPlaying(false)
      setLaunchpadAudioPlaying(false)
      loadedIndexRef.current = null
      setPlaybackLoadedTrack(null)
      await send({ type: 'pause' })
    },
    [patchFloatingSession, recordUndoPoint, send],
  )

  const refreshSavedPlaylists = useCallback(async () => {
    const list = await window.electronAPI.playlistsList()
    setSavedPlaylists(list)
  }, [])

  const hideFloatingPlaylistPanels = useCallback(() => {
    setFloatingPlaylistOpen(false)
    try {
      localStorage.setItem(LS_FLOATING_VISIBLE, 'false')
    } catch {
      /* ignore */
    }
  }, [])

  const openFloatingPlaylist = useCallback(() => {
    setFloatingPlaylistOpen(true)
    try {
      localStorage.setItem(LS_FLOATING_VISIBLE, 'true')
    } catch {
      /* ignore */
    }
    setFloatingSessions((prev) => {
      if (prev.length > 0) return prev
      const s = createEmptyFloatingSession()
      setActiveFloatingSessionId(s.id)
      return [s]
    })
  }, [])

  const setPreviewDocked = useCallback(() => {
    setPreviewDetached(false)
    persistPreviewDetached(false)
  }, [])

  const setPreviewFloating = useCallback(() => {
    setPreviewDetached(true)
    persistPreviewDetached(true)
    setFloatingZOrder((prev) => {
      const k = REGIA_FLOATING_PREVIEW_ZORDER_KEY
      return [...prev.filter((x) => x !== k), k]
    })
  }, [])

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open)
    persistSidebarOpen(open)
  }, [])

  const toggleSidebarOpen = useCallback(() => {
    setSidebarOpenState((o) => {
      const next = !o
      persistSidebarOpen(next)
      return next
    })
  }, [])

  const setSidebarWidthPx = useCallback((w: number, persist = true) => {
    const c = clampSidebarWidth(w)
    setSidebarWidthPxState(c)
    if (persist) persistSidebarWidthPx(c)
  }, [])

  const applyWorkspaceShell = useCallback(async (shell: WorkspaceShellPersist) => {
    setPreviewDetached(shell.previewDetached)
    previewDetachedRef.current = shell.previewDetached
    setSidebarOpen(shell.sidebarOpen)
    sidebarOpenRef.current = shell.sidebarOpen
    setSidebarWidthPx(shell.sidebarWidthPx)
    sidebarWidthPxRef.current = shell.sidebarWidthPx
    setLoopModeState(shell.loopMode as LoopMode)
    const nextStill = clampStillImageDurationSec(
      typeof shell.stillImageDurationSec === 'number'
        ? shell.stillImageDurationSec
        : DEFAULT_STILL_IMAGE_DURATION_SEC,
    )
    setStillImageDurationSecState(nextStill)
    stillImageDurationSecRef.current = nextStill
    setMutedState(shell.muted)
    const v = Math.min(1, Math.max(0, shell.outputVolume))
    setOutputVolumeState(v)
    try {
      localStorage.setItem(LS_OUTPUT_VOLUME, String(v))
    } catch {
      /* ignore */
    }
    setOutputSinkIdState(shell.outputSinkId)
    try {
      localStorage.setItem(LS_OUTPUT_SINK, shell.outputSinkId)
    } catch {
      /* ignore */
    }
    setSecondScreenOn(shell.secondScreenOn)
    lastOutputResolutionRef.current = shell.outputResolution
    persistShellToLocalStorage(shell)
    try {
      await window.electronAPI.setOutputResolution(shell.outputResolution)
    } catch {
      /* ignore */
    }
    dispatchShellLayoutEvents()
    dispatchSidebarMainTab(shell.sidebarMainTab)
  }, [setSidebarOpen, setSidebarWidthPx])

  const buildNamedWorkspaceSnapshot =
    useCallback((): FloatingWorkspacePersistV2 => {
      const shell: WorkspaceShellPersist = {
        previewDetached: previewDetachedRef.current,
        previewLayout: readPreviewLayoutFromLs(),
        sidebarOpen: sidebarOpenRef.current,
        sidebarWidthPx: sidebarWidthPxRef.current,
        outputResolution: lastOutputResolutionRef.current,
        loopMode: shellLoopModeRef.current,
        muted: mutedRef.current,
        outputVolume: outputVolumeRef.current,
        outputSinkId: outputSinkIdRef.current,
        secondScreenOn: secondScreenOnRef.current,
        sidebarMainTab: readSidebarMainTabFromLs(),
        stillImageDurationSec: stillImageDurationSecRef.current,
      }
      return {
        v: 2,
        open: floatingPlaylistOpenRef.current,
        activeFloatingSessionId: activeFloatingSessionIdRef.current,
        playbackSessionId: playbackSessionIdStateRef.current,
        sessions: deepCloneFloatingSessions(floatingSessionsRef.current),
        shell,
      }
    }, [])

  const refreshNamedWorkspaces = useCallback(() => {
    setNamedWorkspaces(readNamedWorkspaceMetas())
  }, [])

  const createNewNamedWorkspace = useCallback(() => {
    const label = nextUniqueWorkspaceLabel('Nuovo workspace')
    const snapshot = buildNamedWorkspaceSnapshot()
    const id = `nw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const root = readNamedWorkspacesRoot()
    root.items.push({
      id,
      label,
      savedAt: Date.now(),
      snapshot,
    })
    writeNamedWorkspacesRoot(root)
    setNamedWorkspaces(readNamedWorkspaceMetas())
    setActiveNamedWorkspaceId(id)
    setActiveNamedWorkspaceLabel(label)
  }, [buildNamedWorkspaceSnapshot])

  const saveNamedWorkspace = useCallback(
    (label: string) => {
      const trimmed = nextUniqueWorkspaceLabel(
        label.trim().slice(0, 80) || 'Workspace',
      )
      const snapshot = buildNamedWorkspaceSnapshot()
      const id = `nw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const root = readNamedWorkspacesRoot()
      root.items.push({
        id,
        label: trimmed,
        savedAt: Date.now(),
        snapshot,
      })
      writeNamedWorkspacesRoot(root)
      setNamedWorkspaces(readNamedWorkspaceMetas())
      setActiveNamedWorkspaceId(id)
      setActiveNamedWorkspaceLabel(trimmed)
    },
    [buildNamedWorkspaceSnapshot],
  )

  const loadNamedWorkspace = useCallback(
    async (id: string) => {
      const root = readNamedWorkspacesRoot()
      const entry = root.items.find((x) => x.id === id)
      if (!entry) return
      const parsed = normalizeWorkspaceFile(entry.snapshot)
      if (!parsed) return
      const { floating, shell } = parsed
      recordUndoPoint()
      isApplyingHistoryRef.current = true
      setFloatingSessions(deepCloneFloatingSessions(floating.sessions))
      setFloatingPlaylistOpen(floating.open)
      try {
        localStorage.setItem(
          LS_FLOATING_VISIBLE,
          floating.open ? 'true' : 'false',
        )
      } catch {
        /* ignore */
      }
      setActiveFloatingSessionId(floating.activeFloatingSessionId)
      setPlaybackSessionId(floating.playbackSessionId)
      floatingPlaylistOpenRef.current = floating.open
      stopLaunchpadSample()
      setLaunchpadAudioPlaying(false)
      setPreviewSrc(null)
      setPreviewSyncKey((k) => k + 1)
      setVideoPlaying(false)
      loadedIndexRef.current = null
      setPlaybackLoadedTrack(null)
      await send({ type: 'pause' })
      setVideoOutputSessionId(
        initialVideoOutputSessionId(
          floating.sessions,
          floating.playbackSessionId,
        ),
      )
      if (shell) await applyWorkspaceShell(shell)
      isApplyingHistoryRef.current = false
      setActiveNamedWorkspaceId(id)
      setActiveNamedWorkspaceLabel(entry.label)
    },
    [applyWorkspaceShell, recordUndoPoint, send],
  )

  const deleteNamedWorkspace = useCallback(
    (id: string) => {
      const root = readNamedWorkspacesRoot()
      root.items = root.items.filter((x) => x.id !== id)
      writeNamedWorkspacesRoot(root)
      setNamedWorkspaces(readNamedWorkspaceMetas())
      if (activeNamedWorkspaceId === id) {
        setActiveNamedWorkspaceId(null)
        setActiveNamedWorkspaceLabel('')
      }
    },
    [activeNamedWorkspaceId],
  )

  const renameNamedWorkspace = useCallback(
    (id: string, label: string) => {
      const trimmed = label.trim().slice(0, 80)
      if (!trimmed) return
      const root = readNamedWorkspacesRoot()
      const ix = root.items.findIndex((x) => x.id === id)
      if (ix < 0) return
      root.items[ix]!.label = trimmed
      writeNamedWorkspacesRoot(root)
      setNamedWorkspaces(readNamedWorkspaceMetas())
      if (activeNamedWorkspaceId === id) {
        setActiveNamedWorkspaceLabel(trimmed)
      }
    },
    [activeNamedWorkspaceId],
  )

  const overwriteNamedWorkspace = useCallback(
    (id: string) => {
      const root = readNamedWorkspacesRoot()
      const ix = root.items.findIndex((x) => x.id === id)
      if (ix < 0) return
      const entry = root.items[ix]!
      entry.snapshot = buildNamedWorkspaceSnapshot()
      entry.savedAt = Date.now()
      writeNamedWorkspacesRoot(root)
      setNamedWorkspaces(readNamedWorkspaceMetas())
      setActiveNamedWorkspaceId(id)
      setActiveNamedWorkspaceLabel(entry.label)
    },
    [buildNamedWorkspaceSnapshot],
  )

  const duplicateNamedWorkspace = useCallback((id: string) => {
    const root = readNamedWorkspacesRoot()
    const entry = root.items.find((x) => x.id === id)
    if (!entry) return
    const newLabel = nextUniqueWorkspaceLabel(`${entry.label} copia`)
    const newId = `nw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const snapCopy = JSON.parse(
      JSON.stringify(entry.snapshot),
    ) as FloatingWorkspacePersistV1 | FloatingWorkspacePersistV2
    root.items.push({
      id: newId,
      label: newLabel,
      savedAt: Date.now(),
      snapshot: snapCopy,
    })
    writeNamedWorkspacesRoot(root)
    setNamedWorkspaces(readNamedWorkspaceMetas())
    setActiveNamedWorkspaceId(newId)
    setActiveNamedWorkspaceLabel(newLabel)
  }, [])

  const updateFloatingPlaylistChrome = useCallback(
    (
      sessionId: string,
      patch: {
        pos?: FloatingPlaylistPos
        collapsed?: boolean
        panelSize?: FloatingPlaylistPanelSize
        playlistOutputMuted?: boolean
        playlistOutputVolume?: number
      },
    ) => {
      patchFloatingSession(sessionId, patch)
    },
    [patchFloatingSession],
  )

  const bringFloatingPanelToFront = useCallback((key: string) => {
    if (!key) return
    setFloatingZOrder((prev) => {
      const without = prev.filter((k) => k !== key)
      return [...without, key]
    })
  }, [])

  const setActiveFloatingSession = useCallback(
    (id: string) => {
      setActiveFloatingSessionId(id)
      if (id) bringFloatingPanelToFront(id)
    },
    [bringFloatingPanelToFront],
  )

  const addFloatingPlaylist = useCallback(() => {
    recordUndoPoint()
    setFloatingSessions((prev) => {
      const last = prev[prev.length - 1]
      const pos = last
        ? { x: last.pos.x + 28, y: last.pos.y + 28 }
        : { x: 24, y: 96 }
      const s = createEmptyFloatingSession(pos)
      setActiveFloatingSessionId(s.id)
      return [...prev, s]
    })
  }, [recordUndoPoint])

  const addFloatingLaunchPad = useCallback(async () => {
    recordUndoPoint()
    let kitPaths: string[] = []
    try {
      kitPaths = await window.electronAPI.launchpadBaseKitPaths()
    } catch {
      kitPaths = []
    }
    setFloatingSessions((prev) => {
      const last = prev[prev.length - 1]
      const pos = last
        ? { x: last.pos.x + 28, y: last.pos.y + 28 }
        : { x: 24, y: 96 }
      const s =
        kitPaths.length > 0
          ? createLaunchPadFloatingSessionWithKit(kitPaths, pos)
          : createLaunchPadFloatingSession(pos)
      setActiveFloatingSessionId(s.id)
      return [...prev, s]
    })
  }, [recordUndoPoint])

  const setPlaylistTitle = useCallback((title: string, sessionId: string) => {
    patchFloatingSession(sessionId, {
      playlistTitle: title.slice(0, 120),
    })
  }, [patchFloatingSession])

  const setPlaylistCrossfade = useCallback(
    (enabled: boolean, sessionId: string) => {
      recordUndoPoint()
      patchFloatingSession(sessionId, { playlistCrossfade: enabled })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const setPlaylistLoopMode = useCallback(
    (sessionId: string, mode: LoopMode) => {
      recordUndoPoint()
      patchFloatingSession(sessionId, { playlistLoopMode: mode })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const setPlaylistThemeColor = useCallback(
    (hex: string | null, sessionId: string) => {
      const next =
        hex == null || hex === ''
          ? ''
          : normalizePlaylistThemeColor(hex)
      patchFloatingSession(sessionId, {
        playlistThemeColor: next,
      })
    },
    [patchFloatingSession],
  )

  const setPlaylistOutputMuted = useCallback(
    (enabled: boolean, sessionId: string) => {
      recordUndoPoint()
      patchFloatingSession(sessionId, { playlistOutputMuted: enabled })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const setPlaylistOutputVolume = useCallback(
    (volume: number, sessionId: string) => {
      const v = Math.min(1, Math.max(0, volume))
      patchFloatingSession(sessionId, { playlistOutputVolume: v })
    },
    [patchFloatingSession],
  )

  const playbackCrossfade = videoOutputSession?.playlistCrossfade ?? false
  useEffect(() => {
    void send({ type: 'setCrossfade', enabled: playbackCrossfade })
  }, [playbackCrossfade, send])

  const savedPlaylistDirty = useCallback(
    (sessionId: string) => {
      const s = floatingSessions.find((x) => x.id === sessionId)
      if (!s || !sessionHasSavedEditLink(s)) return false
      if (s.playlistMode === 'launchpad') {
        if (
          !launchPadCellsEqual(
            s.launchPadCells,
            s.savedEditLaunchPadBaseline ?? undefined,
          )
        )
          return true
      } else if (!pathsEqual(s.paths, s.savedEditPathsBaseline!)) {
        return true
      }
      if (s.playlistTitle.trim() !== s.savedEditTitleBaseline.trim()) return true
      if (
        s.playlistMode !== 'launchpad' &&
        s.playlistCrossfade !== s.savedEditCrossfadeBaseline
      )
        return true
      if (s.playlistMode !== 'launchpad') {
        const curLoop = s.playlistLoopMode ?? loopMode
        const baseLoop = s.savedEditPlaylistLoopBaseline ?? loopMode
        if (curLoop !== baseLoop) return true
      }
      return (
        normalizePlaylistThemeColor(s.playlistThemeColor ?? '') !==
        normalizePlaylistThemeColor(s.savedEditThemeColorBaseline ?? '')
      )
    },
    [floatingSessions, loopMode],
  )

  const saveLoadedPlaylistOverwrite = useCallback(
    async (sessionId: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s || !sessionHasSavedEditLink(s)) return
      const id = s.editingSavedPlaylistId
      const label = s.playlistTitle.trim() || 'Senza titolo'
      const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')
      const themeBase = normalizePlaylistThemeColor(
        s.savedEditThemeColorBaseline ?? '',
      )
      if (s.playlistMode === 'launchpad') {
        const cells = s.launchPadCells ?? defaultLaunchPadCells()
        const baseCells = s.savedEditLaunchPadBaseline ?? defaultLaunchPadCells()
        if (
          launchPadCellsEqual(cells, baseCells) &&
          label.trim() === s.savedEditTitleBaseline.trim() &&
          themeCur === themeBase
        )
          return
        recordUndoPoint()
        const totalDurationSec = await totalDurationSecForPlaylistSave({
          playlistMode: 'launchpad',
          paths: [],
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
        })
        await window.electronAPI.playlistsSave({
          id,
          label,
          paths: [],
          crossfade: false,
          themeColor: themeCur === '' ? undefined : themeCur,
          playlistMode: 'launchpad',
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
          totalDurationSec,
        })
        await refreshSavedPlaylists()
        patchFloatingSession(sessionId, {
          savedEditPathsBaseline: [],
          savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(cells),
          savedEditTitleBaseline: label.trim(),
          savedEditThemeColorBaseline: themeCur,
        })
        return
      }
      const list = s.paths
      const trackLoop = s.playlistLoopMode ?? loopMode
      const baseLoop = s.savedEditPlaylistLoopBaseline ?? loopMode
      if (
        pathsEqual(list, s.savedEditPathsBaseline!) &&
        label.trim() === s.savedEditTitleBaseline.trim() &&
        s.playlistCrossfade === s.savedEditCrossfadeBaseline &&
        trackLoop === baseLoop &&
        themeCur === themeBase
      )
        return
      recordUndoPoint()
      const totalDurationSec = await totalDurationSecForPlaylistSave({
        playlistMode: 'tracks',
        paths: list,
      })
      await window.electronAPI.playlistsSave({
        id,
        label,
        paths: list,
        crossfade: s.playlistCrossfade,
        loopMode: trackLoop,
        themeColor: themeCur === '' ? undefined : themeCur,
        playlistMode: 'tracks',
        totalDurationSec,
      })
      await refreshSavedPlaylists()
      patchFloatingSession(sessionId, {
        savedEditPathsBaseline: [...list],
        savedEditTitleBaseline: label.trim(),
        savedEditCrossfadeBaseline: s.playlistCrossfade,
        savedEditPlaylistLoopBaseline: trackLoop,
        savedEditThemeColorBaseline: themeCur,
      })
    },
    [patchFloatingSession, recordUndoPoint, refreshSavedPlaylists, loopMode],
  )

  const persistSavedPlaylistAfterFloatingTitleBlur = useCallback(
    async (trimmedTitle: string, sessionId: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s) return
      const label = trimmedTitle.trim().slice(0, 120) || 'Senza titolo'
      const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')

      /** Pannello non ancora collegato a una voce su disco (playlist o launchpad). */
      if (!sessionHasSavedEditLink(s)) {
        const plan = planFirstDiskLinkForUnlinkedSession({
          session: s,
          trimmedTitle,
          shellLoopMode: shellLoopModeRef.current,
        })
        if (plan.kind === 'skip') return
        if (plan.kind === 'launchpad_new') {
          const totalDurationSec = await totalDurationSecForPlaylistSave({
            playlistMode: 'launchpad',
            paths: [],
            launchPadCells: cloneLaunchPadCellsSnapshot(plan.cells),
          })
          const { id: newId } = await window.electronAPI.playlistsSave({
            label: plan.label,
            paths: [],
            crossfade: false,
            themeColor: plan.themeColor === '' ? undefined : plan.themeColor,
            playlistMode: 'launchpad',
            launchPadCells: cloneLaunchPadCellsSnapshot(plan.cells),
            totalDurationSec,
          })
          await refreshSavedPlaylists()
          patchFloatingSession(sessionId, {
            editingSavedPlaylistId: newId,
            savedEditPathsBaseline: [],
            savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(plan.cells),
            savedEditTitleBaseline: plan.label.trim(),
            savedEditCrossfadeBaseline: false,
            savedEditThemeColorBaseline: plan.themeColor,
          })
          return
        }
        const totalDurationSec = await totalDurationSecForPlaylistSave({
          playlistMode: 'tracks',
          paths: plan.paths,
        })
        const { id: newId } = await window.electronAPI.playlistsSave({
          label: plan.label,
          paths: [...plan.paths],
          crossfade: plan.crossfade,
          loopMode: plan.loopMode,
          themeColor: plan.themeColor === '' ? undefined : plan.themeColor,
          playlistMode: 'tracks',
          totalDurationSec,
        })
        await refreshSavedPlaylists()
        patchFloatingSession(sessionId, {
          editingSavedPlaylistId: newId,
          savedEditPathsBaseline: [...plan.paths],
          savedEditLaunchPadBaseline: null,
          savedEditTitleBaseline: plan.label.trim(),
          savedEditCrossfadeBaseline: plan.crossfade,
          savedEditPlaylistLoopBaseline: plan.loopMode,
          savedEditThemeColorBaseline: plan.themeColor,
        })
        return
      }

      const id = s.editingSavedPlaylistId
      const titleDirty =
        label.trim() !== s.savedEditTitleBaseline.trim()
      const pathsDirty =
        s.playlistMode !== 'launchpad' &&
        !pathsEqual(s.paths, s.savedEditPathsBaseline!)
      const cellsDirty =
        s.playlistMode === 'launchpad' &&
        !launchPadCellsEqual(
          s.launchPadCells,
          s.savedEditLaunchPadBaseline ?? undefined,
        )
      const crossfadeDirty =
        s.playlistMode !== 'launchpad' &&
        s.playlistCrossfade !== s.savedEditCrossfadeBaseline
      const shellLoop = shellLoopModeRef.current
      const loopDirty =
        s.playlistMode !== 'launchpad' &&
        (s.playlistLoopMode ?? shellLoop) !==
          (s.savedEditPlaylistLoopBaseline ?? shellLoop)
      const themeBase = normalizePlaylistThemeColor(
        s.savedEditThemeColorBaseline ?? '',
      )
      const themeDirty = themeCur !== themeBase
      if (
        !titleDirty &&
        !pathsDirty &&
        !cellsDirty &&
        !crossfadeDirty &&
        !loopDirty &&
        !themeDirty
      )
        return
      if (s.playlistMode === 'launchpad') {
        const cells = s.launchPadCells ?? defaultLaunchPadCells()
        const totalDurationSec = await totalDurationSecForPlaylistSave({
          playlistMode: 'launchpad',
          paths: [],
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
        })
        await window.electronAPI.playlistsSave({
          id,
          label,
          paths: [],
          crossfade: false,
          themeColor: themeCur === '' ? undefined : themeCur,
          playlistMode: 'launchpad',
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
          totalDurationSec,
        })
        await refreshSavedPlaylists()
        patchFloatingSession(sessionId, {
          savedEditPathsBaseline: [],
          savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(cells),
          savedEditTitleBaseline: label.trim(),
          savedEditThemeColorBaseline: themeCur,
        })
        return
      }
      const list = s.paths
      const trackLoop = s.playlistLoopMode ?? shellLoopModeRef.current
      const totalDurationSec = await totalDurationSecForPlaylistSave({
        playlistMode: 'tracks',
        paths: list,
      })
      await window.electronAPI.playlistsSave({
        id,
        label,
        paths: list,
        crossfade: s.playlistCrossfade,
        loopMode: trackLoop,
        themeColor: themeCur === '' ? undefined : themeCur,
        playlistMode: 'tracks',
        totalDurationSec,
      })
      await refreshSavedPlaylists()
      patchFloatingSession(sessionId, {
        savedEditPathsBaseline: [...list],
        savedEditTitleBaseline: label.trim(),
        savedEditCrossfadeBaseline: s.playlistCrossfade,
        savedEditPlaylistLoopBaseline: trackLoop,
        savedEditThemeColorBaseline: themeCur,
      })
    },
    [patchFloatingSession, refreshSavedPlaylists],
  )

  const removeFloatingPlaylist = useCallback(
    async (id: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === id)
      if (s && sessionHasSavedEditLink(s)) {
        await persistSavedPlaylistAfterFloatingTitleBlur(s.playlistTitle, id)
      }
      recordUndoPoint()
      setPlaybackLoadedTrack((h) => (h?.sessionId === id ? null : h))
      const prev = floatingSessionsRef.current
      const next = prev.filter((s) => s.id !== id)
      if (s?.playlistMode === 'launchpad') {
        stopLaunchpadSample()
        setLaunchpadAudioPlaying(false)
      }
      if (videoOutputSessionIdRef.current === id) {
        const nv =
          next.find((x) => x.playlistMode !== 'launchpad')?.id ?? null
        setVideoOutputSessionId(nv)
        setPreviewSrc(null)
        setPreviewSyncKey((k) => k + 1)
        loadedIndexRef.current = null
        setVideoPlaying(false)
        void send({ type: 'pause' })
      }
      setFloatingSessions(next)
      if (next.length === 0) {
        hideFloatingPlaylistPanels()
      }
    },
    [
      recordUndoPoint,
      hideFloatingPlaylistPanels,
      persistSavedPlaylistAfterFloatingTitleBlur,
      send,
    ],
  )

  const closeFloatingPlaylist = useCallback(
    async (sessionId: string) => {
      await removeFloatingPlaylist(sessionId)
    },
    [removeFloatingPlaylist],
  )

  const floatingCloseWouldInterruptPlay = useCallback(
    (sessionId: string): boolean => {
      if (!sessionId) return false
      if (
        videoOutputSessionIdRef.current === sessionId &&
        videoPlayingRef.current
      )
        return true
      if (
        launchpadAudioPlayingRef.current &&
        playbackLoadedTrackRef.current?.sessionId === sessionId
      )
        return true
      return false
    },
    [],
  )

  const saveCurrentPlaylist = useCallback(
    async (label: string) => {
      const id = resolvedActiveId
      const s = floatingSessionsRef.current.find((x) => x.id === id)
      if (!s) return
      const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')
      if (s.playlistMode === 'launchpad') {
        const cells = s.launchPadCells ?? defaultLaunchPadCells()
        const totalDurationSec = await totalDurationSecForPlaylistSave({
          playlistMode: 'launchpad',
          paths: [],
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
        })
        await window.electronAPI.playlistsSave({
          label,
          paths: [],
          crossfade: false,
          themeColor: themeCur === '' ? null : themeCur,
          playlistMode: 'launchpad',
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
          totalDurationSec,
        })
        await refreshSavedPlaylists()
        return
      }
      const list = s.paths ?? []
      if (!list.length) return
      const trackLoop = s.playlistLoopMode ?? shellLoopModeRef.current
      const totalDurationSec = await totalDurationSecForPlaylistSave({
        playlistMode: 'tracks',
        paths: list,
      })
      await window.electronAPI.playlistsSave({
        label,
        paths: list,
        crossfade: s.playlistCrossfade ?? false,
        loopMode: trackLoop,
        themeColor: themeCur === '' ? null : themeCur,
        playlistMode: 'tracks',
        totalDurationSec,
      })
      await refreshSavedPlaylists()
    },
    [resolvedActiveId, refreshSavedPlaylists],
  )

  const loadSavedPlaylist = useCallback(
    async (id: string) => {
      const data = await window.electronAPI.playlistsLoad(id)
      if (!data) return
      const isLaunchpad = data.playlistMode === 'launchpad'
      if (!isLaunchpad && !data.paths.length) return
      if (
        isLaunchpad &&
        (!data.launchPadCells || data.launchPadCells.length < LAUNCHPAD_CELL_COUNT)
      )
        return
      recordUndoPoint()
      const prev = floatingSessionsRef.current
      const last = prev[prev.length - 1]
      const pos = last
        ? { x: last.pos.x + 28, y: last.pos.y + 28 }
        : { x: 24, y: 96 }
      const label = data.label.trim() || 'Senza titolo'
      const loadedTheme = normalizePlaylistThemeColor(data.themeColor)
      let newS: FloatingPlaylistSession
      if (isLaunchpad) {
        const cells = cloneLaunchPadCellsSnapshot(
          data.launchPadCells as LaunchPadCell[],
        )
        newS = {
          ...createLaunchPadFloatingSession(pos),
          playlistTitle: label,
          launchPadCells: cells,
          playlistThemeColor: loadedTheme,
          playlistCrossfade: false,
          editingSavedPlaylistId: id,
          savedEditPathsBaseline: [],
          savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(cells),
          savedEditTitleBaseline: label.trim(),
          savedEditCrossfadeBaseline: false,
          savedEditThemeColorBaseline: loadedTheme,
        }
      } else {
        const loadedLoop = parsePersistedPlaylistLoopMode(data.loopMode) ?? 'off'
        newS = {
          ...createEmptyFloatingSession(pos),
          paths: data.paths,
          currentIndex: 0,
          playlistTitle: label,
          editingSavedPlaylistId: id,
          savedEditPathsBaseline: [...data.paths],
          savedEditLaunchPadBaseline: null,
          savedEditTitleBaseline: label.trim(),
          savedEditCrossfadeBaseline: data.crossfade,
          savedEditPlaylistLoopBaseline: loadedLoop,
          savedEditThemeColorBaseline: loadedTheme,
          playlistCrossfade: data.crossfade,
          playlistLoopMode: loadedLoop,
          playlistThemeColor: loadedTheme,
        }
      }
      setFloatingSessions((p) => [...p, newS])
      setActiveFloatingSessionId(newS.id)
      setPlaybackSessionId(newS.id)
      const firstTracks = [...prev, newS].find(
        (x) => x.playlistMode !== 'launchpad',
      )
      setVideoOutputSessionId(
        newS.playlistMode === 'launchpad'
          ? (firstTracks?.id ?? null)
          : newS.id,
      )
      setPreviewSrc(null)
      setPreviewSyncKey(0)
      setVideoPlaying(false)
      setLaunchpadAudioPlaying(false)
      loadedIndexRef.current = null
      setPlaybackLoadedTrack(null)
      await send({ type: 'pause' })
      openFloatingPlaylist()
    },
    [recordUndoPoint, send, openFloatingPlaylist],
  )

  const deleteSavedPlaylist = useCallback(
    async (id: string) => {
      await window.electronAPI.playlistsDelete(id)
      await refreshSavedPlaylists()
      setFloatingSessions((prev) =>
        prev.map((s) =>
          s.editingSavedPlaylistId === id
            ? {
                ...s,
                editingSavedPlaylistId: null,
                savedEditPathsBaseline: null,
                savedEditLaunchPadBaseline: null,
                savedEditTitleBaseline: '',
                savedEditCrossfadeBaseline: false,
                savedEditThemeColorBaseline: '',
              }
            : s,
        ),
      )
    },
    [refreshSavedPlaylists],
  )

  const duplicateSavedPlaylist = useCallback(
    async (id: string) => {
      const r = await window.electronAPI.playlistsDuplicate(id)
      if (!r?.id) return
      await refreshSavedPlaylists()
    },
    [refreshSavedPlaylists],
  )

  const reorderSavedPlaylists = useCallback(
    async (orderedIds: string[]) => {
      await window.electronAPI.playlistsSetOrder(orderedIds)
      await refreshSavedPlaylists()
    },
    [refreshSavedPlaylists],
  )

  const loadIndexAndPlay = useCallback(
    async (index: number, sessionId?: string) => {
      const fallbackPlaybackId =
        resolvedPlaybackIdRef.current ||
        floatingSessionsRef.current[0]?.id ||
        ''
      const sid = sessionId ?? fallbackPlaybackId
      if (!sid) return
      const sess = floatingSessionsRef.current.find((x) => x.id === sid)
      if (sess?.playlistMode === 'launchpad') return
      const list = sess?.paths ?? []
      if (list.length === 0 || index < 0 || index >= list.length) return
      const playlistMuted = Boolean(sess?.playlistOutputMuted)
      const panelVol =
        typeof sess?.playlistOutputVolume === 'number' &&
        Number.isFinite(sess.playlistOutputVolume)
          ? Math.min(1, Math.max(0, sess.playlistOutputVolume))
          : 1
      patchFloatingSession(sid, { currentIndex: index })
      setPlaybackSessionId(sid)
      setActiveFloatingSessionId(sid)
      const p = list[index]
      const url = await window.electronAPI.toFileUrl(p)
      setVideoOutputSessionId(sid)
      setPreviewSrc(url)
      setPreviewSyncKey((k) => k + 1)
      const mode = loopModeRef.current
      const effectiveMuted = muted || playlistMuted
      const crossfadeForLoad = Boolean(sess?.playlistCrossfade)
      await send({
        type: 'load',
        src: p,
        crossfade: crossfadeForLoad,
      })
      await send({ type: 'setLoopOne', loop: mode === 'one' })
      await send({ type: 'setMuted', muted: effectiveMuted })
      await send({
        type: 'setVolume',
        volume: outputVolumeRef.current * panelVol,
      })
      await send({ type: 'setSinkId', sinkId: outputSinkIdRef.current })
      if (secondScreenOnRef.current) {
        await send({ type: 'play' })
      } else {
        await send({ type: 'pause' })
      }
      loadedIndexRef.current = index
      setPlaybackLoadedTrack({ sessionId: sid, index })
      setVideoPlaying(true)
    },
    [muted, send, patchFloatingSession],
  )

  const loadLaunchPadSlotAndPlay = useCallback(
    async (sessionId: string, slotIndex: number) => {
      if (
        slotIndex < 0 ||
        slotIndex >= LAUNCHPAD_CELL_COUNT ||
        !sessionId
      )
        return
      const sess = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (sess?.playlistMode !== 'launchpad' || !sess.launchPadCells) return
      const cell0 = sess.launchPadCells[slotIndex]
      const p = cell0?.samplePath
      if (!p) return
      const playlistMuted = Boolean(sess.playlistOutputMuted)
      const panelVol =
        typeof sess.playlistOutputVolume === 'number' &&
        Number.isFinite(sess.playlistOutputVolume)
          ? Math.min(1, Math.max(0, sess.playlistOutputVolume))
          : 1
      const padVol =
        typeof cell0.padGain === 'number' && Number.isFinite(cell0.padGain)
          ? Math.min(1, Math.max(0, cell0.padGain))
          : 1
      patchFloatingSession(sessionId, { currentIndex: slotIndex })
      setPlaybackSessionId(sessionId)
      setActiveFloatingSessionId(sessionId)
      const url = await window.electronAPI.toFileUrl(p)
      playLaunchpadSample({
        src: url,
        volume: panelVol * padVol,
        muted: playlistMuted,
        sinkId: outputSinkIdRef.current,
        onEnded: () => {
          setLaunchpadAudioPlaying(false)
          loadedIndexRef.current = null
          setPlaybackLoadedTrack(null)
        },
      })
      loadedIndexRef.current = slotIndex
      setPlaybackLoadedTrack({ sessionId, index: slotIndex })
      setLaunchpadAudioPlaying(true)
    },
    [patchFloatingSession],
  )

  const stopLaunchPadCueRelease = useCallback(() => {
    stopLaunchpadSample()
    setLaunchpadAudioPlaying(false)
    loadedIndexRef.current = null
    setPlaybackLoadedTrack(null)
  }, [])

  const loadLaunchPadSlotAndPlayRef = useRef(loadLaunchPadSlotAndPlay)
  useLayoutEffect(() => {
    loadLaunchPadSlotAndPlayRef.current = loadLaunchPadSlotAndPlay
  }, [loadLaunchPadSlotAndPlay])

  const stopLaunchPadCueReleaseRef = useRef(stopLaunchPadCueRelease)
  useLayoutEffect(() => {
    stopLaunchPadCueReleaseRef.current = stopLaunchPadCueRelease
  }, [stopLaunchPadCueRelease])

  type PadKeyboardGesture = {
    code: string
    sessionId: string
    slotIndex: number
    keyMode: 'play' | 'toggle'
    timer: ReturnType<typeof setTimeout> | null
    cueCommitted: boolean
  }
  const padKeyboardGestureRef = useRef<PadKeyboardGesture | null>(null)

  useEffect(() => {
    function findPadKeyBinding(code: string): {
      sessionId: string
      slotIndex: number
      keyMode: 'play' | 'toggle'
    } | null {
      const sessions = floatingSessionsRef.current
      const activeId = activeFloatingSessionIdRef.current
      const trySid = (sid: string) => {
        const sess = sessions.find((s) => s.id === sid)
        if (sess?.playlistMode !== 'launchpad' || !sess.launchPadCells)
          return null
        const cells = sess.launchPadCells
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i]
          const bound = cell.padKeyCode ?? null
          if (bound === code && cell.samplePath) {
            const keyMode =
              cell.padKeyMode === 'toggle'
                ? ('toggle' as const)
                : ('play' as const)
            return { sessionId: sid, slotIndex: i, keyMode }
          }
        }
        return null
      }
      const fromActive = trySid(activeId)
      if (fromActive) return fromActive
      for (const sess of sessions) {
        if (sess.id === activeId) continue
        const r = trySid(sess.id)
        if (r) return r
      }
      return null
    }

    const clearGestureTimer = () => {
      const g = padKeyboardGestureRef.current
      if (g?.timer != null) {
        clearTimeout(g.timer)
        g.timer = null
      }
    }

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      const bound = findPadKeyBinding(e.code)
      if (!bound) return

      if (padKeyboardGestureRef.current?.code === e.code && e.repeat) return

      if (
        padKeyboardGestureRef.current &&
        padKeyboardGestureRef.current.code !== e.code
      ) {
        clearGestureTimer()
        padKeyboardGestureRef.current = null
      }

      e.preventDefault()
      e.stopPropagation()

      const g: PadKeyboardGesture = {
        code: e.code,
        sessionId: bound.sessionId,
        slotIndex: bound.slotIndex,
        keyMode: bound.keyMode,
        timer: null,
        cueCommitted: false,
      }
      padKeyboardGestureRef.current = g

      if (readLaunchPadCueEnabled()) {
        g.timer = window.setTimeout(() => {
          const cur = padKeyboardGestureRef.current
          if (!cur || cur.code !== g.code || cur.cueCommitted) return
          cur.cueCommitted = true
          cur.timer = null
          void loadLaunchPadSlotAndPlayRef.current(
            cur.sessionId,
            cur.slotIndex,
          )
        }, LAUNCHPAD_CUE_HOLD_MS)
      }
    }

    const onKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const g = padKeyboardGestureRef.current
      if (!g || g.code !== e.code) return

      e.preventDefault()
      e.stopPropagation()
      clearGestureTimer()
      padKeyboardGestureRef.current = null

      if (g.cueCommitted) {
        stopLaunchPadCueReleaseRef.current()
        return
      }

      const loadedThisSlot =
        playbackLoadedTrackRef.current?.sessionId === g.sessionId &&
        playbackLoadedTrackRef.current?.index === g.slotIndex
      const stillActiveThisSlot =
        loadedThisSlot &&
        (launchpadAudioPlayingRef.current ||
          isLaunchpadSamplePausedWithSrc())

      if (g.keyMode === 'toggle' && stillActiveThisSlot) {
        stopLaunchPadCueReleaseRef.current()
        return
      }
      void loadLaunchPadSlotAndPlayRef.current(g.sessionId, g.slotIndex)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      clearGestureTimer()
      padKeyboardGestureRef.current = null
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [])

  const updateLaunchPadCell = useCallback(
    async (
      sessionId: string,
      slotIndex: number,
      patch: Partial<
        Pick<
          LaunchPadCell,
          'samplePath' | 'padColor' | 'padGain' | 'padKeyCode' | 'padKeyMode'
        >
      >,
      options?: { skipUndo?: boolean },
    ) => {
      if (slotIndex < 0 || slotIndex >= LAUNCHPAD_CELL_COUNT) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (
        !s0 ||
        s0.playlistMode !== 'launchpad' ||
        !s0.launchPadCells
      )
        return
      const hasPatch =
        ('samplePath' in patch && patch.samplePath !== undefined) ||
        ('padColor' in patch && patch.padColor !== undefined) ||
        ('padGain' in patch && patch.padGain !== undefined) ||
        ('padKeyCode' in patch && patch.padKeyCode !== undefined) ||
        ('padKeyMode' in patch && patch.padKeyMode !== undefined)
      if (!hasPatch) return
      const touchesSampleOrColor =
        ('samplePath' in patch && patch.samplePath !== undefined) ||
        ('padColor' in patch && patch.padColor !== undefined)
      const touchesPadKey =
        ('padKeyCode' in patch && patch.padKeyCode !== undefined) ||
        ('padKeyMode' in patch && patch.padKeyMode !== undefined)
      const touchesGainOnly =
        !touchesSampleOrColor &&
        !touchesPadKey &&
        'padGain' in patch &&
        patch.padGain !== undefined
      if (touchesSampleOrColor || touchesPadKey) {
        recordUndoPoint()
      } else if (touchesGainOnly && !options?.skipUndo) {
        recordUndoPoint()
      }
      const prevCells = s0.launchPadCells.map((c) => ({
        ...c,
        padKeyCode: c.padKeyCode ?? null,
        padKeyMode: normalizeLaunchPadKeyMode(c.padKeyMode),
      }))
      const assignKey =
        'padKeyCode' in patch ? patch.padKeyCode : undefined
      const clearedDupes =
        typeof assignKey === 'string' && assignKey.length > 0
          ? prevCells.map((c, i) =>
              i !== slotIndex && c.padKeyCode === assignKey
                ? {
                    ...c,
                    padKeyCode: null,
                    padKeyMode: readLaunchPadDefaultKeyMode(),
                  }
                : { ...c },
            )
          : prevCells.map((c) => ({ ...c }))
      const cells = clearedDupes.map((c, i) => {
        if (i !== slotIndex) return { ...c }
        let padColor = c.padColor
        if ('padColor' in patch && patch.padColor !== undefined) {
          const n = normalizePlaylistThemeColor(patch.padColor)
          padColor = n || c.padColor
        }
        let samplePath = c.samplePath
        let padGain =
          typeof c.padGain === 'number' && Number.isFinite(c.padGain)
            ? Math.min(1, Math.max(0, c.padGain))
            : 1
        let padKeyCode = c.padKeyCode ?? null
        let padKeyMode = normalizeLaunchPadKeyMode(c.padKeyMode)
        if ('samplePath' in patch && patch.samplePath !== undefined) {
          samplePath = patch.samplePath
          if (patch.samplePath === null) {
            padGain = 1
          }
        }
        if ('padGain' in patch && patch.padGain !== undefined) {
          padGain = Math.min(1, Math.max(0, patch.padGain))
        }
        if ('padKeyCode' in patch && patch.padKeyCode !== undefined) {
          padKeyCode =
            patch.padKeyCode === null
              ? null
              : normalizePersistedPadKeyCode(patch.padKeyCode)
          if (patch.padKeyCode === null) {
            padKeyMode = readLaunchPadDefaultKeyMode()
          }
        }
        if ('padKeyMode' in patch && patch.padKeyMode !== undefined) {
          padKeyMode = normalizeLaunchPadKeyMode(patch.padKeyMode)
        }
        return { padColor, samplePath, padGain, padKeyCode, padKeyMode }
      })
      const loaded = playbackLoadedTrackRef.current
      const clearingPlayingOrLoadedPad =
        loaded != null &&
        loaded.sessionId === sessionId &&
        loaded.index === slotIndex &&
        'samplePath' in patch &&
        patch.samplePath === null
      patchFloatingSession(sessionId, { launchPadCells: cells })
      if (clearingPlayingOrLoadedPad) {
        stopLaunchpadSample()
        setLaunchpadAudioPlaying(false)
        loadedIndexRef.current = null
        setPlaybackLoadedTrack(null)
      }
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const loadIndexAndPlayRef = useRef(loadIndexAndPlay)
  useLayoutEffect(() => {
    loadIndexAndPlayRef.current = loadIndexAndPlay
  }, [loadIndexAndPlay])

  const togglePlay = useCallback(async () => {
    if (launchpadAudioPlaying) {
      pauseLaunchpadSample()
      setLaunchpadAudioPlaying(false)
      return
    }
    if (videoPlaying) {
      await send({ type: 'pause' })
      setVideoPlaying(false)
      return
    }
    const list = pathsRef.current
    if (list.length > 0) {
      const idx = currentIndexRef.current
      const p = list[idx]
      if (!p) return
      if (loadedIndexRef.current === idx) {
        const vid = videoOutputSessionIdRef.current
        const playSess = vid
          ? floatingSessionsRef.current.find((x) => x.id === vid)
          : null
        const sm = playSess?.playlistOutputMuted ?? false
        const panelVol =
          typeof playSess?.playlistOutputVolume === 'number' &&
          Number.isFinite(playSess.playlistOutputVolume)
            ? Math.min(1, Math.max(0, playSess.playlistOutputVolume))
            : 1
        await send({ type: 'setMuted', muted: muted || sm })
        await send({
          type: 'setVolume',
          volume: outputVolumeRef.current * panelVol,
        })
        await send({ type: 'setSinkId', sinkId: outputSinkIdRef.current })
        if (secondScreenOnRef.current) {
          await send({ type: 'play' })
        } else {
          await send({ type: 'pause' })
        }
        setVideoPlaying(true)
        return
      }
      await loadIndexAndPlay(idx)
      return
    }
    const pb = resolvedPlaybackIdRef.current
    const sess =
      pb != null
        ? floatingSessionsRef.current.find((x) => x.id === pb)
        : undefined
    if (sess?.playlistMode !== 'launchpad' || !sess.launchPadCells) return
    const idx = currentIndexRef.current
    const p = sess.launchPadCells[idx]?.samplePath
    if (!p) return
    if (
      loadedIndexRef.current === idx &&
      isLaunchpadSamplePausedWithSrc()
    ) {
      const playlistMuted = Boolean(sess.playlistOutputMuted)
      const panelVol =
        typeof sess.playlistOutputVolume === 'number' &&
        Number.isFinite(sess.playlistOutputVolume)
          ? Math.min(1, Math.max(0, sess.playlistOutputVolume))
          : 1
      const lpCell = sess.launchPadCells[idx]
      const padVol =
        typeof lpCell?.padGain === 'number' && Number.isFinite(lpCell.padGain)
          ? Math.min(1, Math.max(0, lpCell.padGain))
          : 1
      setLaunchpadSampleLevels(panelVol * padVol, playlistMuted)
      void setLaunchpadSampleSink(outputSinkIdRef.current)
      resumeLaunchpadSample()
      setLaunchpadAudioPlaying(true)
      return
    }
    if (!pb) return
    await loadLaunchPadSlotAndPlay(pb, idx)
  }, [
    launchpadAudioPlaying,
    videoPlaying,
    muted,
    send,
    loadIndexAndPlay,
    loadLaunchPadSlotAndPlay,
  ])

  const goNext = useCallback(async () => {
    const list = pathsRef.current
    if (list.length === 0) {
      const pb = resolvedPlaybackIdRef.current
      const sess =
        pb != null
          ? floatingSessionsRef.current.find((x) => x.id === pb)
          : undefined
      if (sess?.playlistMode === 'launchpad') return
      return
    }
    const idx = currentIndexRef.current
    const mode = loopModeRef.current
    if (idx < list.length - 1) {
      await loadIndexAndPlayRef.current(idx + 1)
    } else if (mode === 'all') {
      await loadIndexAndPlayRef.current(0)
    }
  }, [])

  const goPrev = useCallback(async () => {
    const list = pathsRef.current
    if (list.length === 0) {
      const pb = resolvedPlaybackIdRef.current
      const sess =
        pb != null
          ? floatingSessionsRef.current.find((x) => x.id === pb)
          : undefined
      if (sess?.playlistMode === 'launchpad') return
      return
    }
    const idx = currentIndexRef.current
    const mode = loopModeRef.current
    if (idx > 0) {
      await loadIndexAndPlayRef.current(idx - 1)
    } else if (mode === 'all') {
      await loadIndexAndPlayRef.current(list.length - 1)
    }
  }, [])

  const handleEnded = useCallback(() => {
    const len = pathsRef.current.length
    if (len === 0) return
    const idx = currentIndexRef.current
    const mode = loopModeRef.current
    if (mode === 'one') return
    if (mode === 'all') {
      const next = (idx + 1) % len
      void loadIndexAndPlayRef.current(next)
      return
    }
    if (idx < len - 1) {
      void loadIndexAndPlayRef.current(idx + 1)
    } else {
      void send({ type: 'pause' })
      setVideoPlaying(false)
    }
  }, [send])

  useEffect(() => {
    const off = window.electronAPI.onVideoEndedFromOutput(handleEnded)
    return off
  }, [handleEnded])

  useEffect(() => {
    void send({ type: 'setLoopOne', loop: loopMode === 'one' })
  }, [loopMode, send])

  useEffect(() => {
    void send({
      type: 'setStillImageDurationSec',
      seconds: stillImageDurationSec,
    })
  }, [stillImageDurationSec, send])

  const videoOutputPlaylistMuted =
    videoOutputSession?.playlistOutputMuted ?? false

  const videoOutputPanelVolume =
    typeof videoOutputSession?.playlistOutputVolume === 'number' &&
    Number.isFinite(videoOutputSession.playlistOutputVolume)
      ? Math.min(1, Math.max(0, videoOutputSession.playlistOutputVolume))
      : 1

  useEffect(() => {
    void send({
      type: 'setMuted',
      muted: muted || videoOutputPlaylistMuted,
    })
  }, [muted, videoOutputPlaylistMuted, send])

  useEffect(() => {
    const v = outputVolume * videoOutputPanelVolume
    void send({ type: 'setVolume', volume: v })
  }, [outputVolume, videoOutputPanelVolume, send])

  useEffect(() => {
    void send({ type: 'setSinkId', sinkId: outputSinkId })
  }, [outputSinkId, send])

  useEffect(() => {
    void window.electronAPI.setOutputPresentationVisible(secondScreenOn)
  }, [secondScreenOn])

  useEffect(() => {
    if (!secondScreenOn || !videoPlaying) return
    void send({ type: 'play' })
  }, [secondScreenOn, videoPlaying, send])

  useEffect(() => {
    if (!launchpadAudioPlaying || !playbackLoadedTrack) return
    const s = floatingSessions.find(
      (x) => x.id === playbackLoadedTrack.sessionId,
    )
    if (!s || s.playlistMode !== 'launchpad' || !s.launchPadCells) return
    const cell = s.launchPadCells[playbackLoadedTrack.index]
    if (!cell) return
    const panelVol =
      typeof s.playlistOutputVolume === 'number' &&
      Number.isFinite(s.playlistOutputVolume)
        ? Math.min(1, Math.max(0, s.playlistOutputVolume))
        : 1
    const padVol =
      typeof cell.padGain === 'number' && Number.isFinite(cell.padGain)
        ? Math.min(1, Math.max(0, cell.padGain))
        : 1
    setLaunchpadSampleLevels(
      panelVol * padVol,
      Boolean(s.playlistOutputMuted),
    )
    setLaunchpadSampleSink(outputSinkId)
  }, [
    launchpadAudioPlaying,
    playbackLoadedTrack,
    floatingSessions,
    outputSinkId,
  ])

  const openFolder = useCallback(
    async (sessionId: string) => {
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (s0?.playlistMode === 'launchpad') return
      const list = await window.electronAPI.selectFolder()
      if (!list?.length) return
      recordUndoPoint()
      const preserveTitle = s0 != null && sessionHasSavedEditLink(s0)
      await applyPathsList(list, sessionId, { skipHistory: true })
      if (!preserveTitle) {
        patchFloatingSession(sessionId, {
          playlistTitle: folderBasenameFromPaths(list),
        })
      }
    },
    [applyPathsList, patchFloatingSession, recordUndoPoint],
  )

  const addMediaToPlaylist = useCallback(
    async (sessionId: string) => {
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (s0?.playlistMode === 'launchpad') return
      const picked = await window.electronAPI.selectMediaFiles({
        context: 'playlist',
      })
      if (!picked?.length) return
      recordUndoPoint()
      let titleFromFirstFolder: string | null = null
      setFloatingSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s
          const seen = new Set(s.paths)
          const merged = [...s.paths]
          for (const f of picked) {
            if (!seen.has(f)) {
              seen.add(f)
              merged.push(f)
            }
          }
          if (s.paths.length === 0 && merged.length > 0)
            titleFromFirstFolder = folderBasenameFromPaths(merged)
          return { ...s, paths: merged }
        }),
      )
      if (titleFromFirstFolder)
        patchFloatingSession(sessionId, {
          playlistTitle: titleFromFirstFolder,
        })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const addPathsToPlaylistFromPaths = useCallback(
    (sessionId: string, rawPaths: string[]) => {
      const picked = rawPaths.filter(isMediaFilePath)
      if (!picked.length) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s0 || s0.playlistMode === 'launchpad') return
      recordUndoPoint()
      let titleFromFirstFolder: string | null = null
      setFloatingSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s
          const seen = new Set(s.paths)
          const merged = [...s.paths]
          for (const f of picked) {
            if (!seen.has(f)) {
              seen.add(f)
              merged.push(f)
            }
          }
          if (s.paths.length === 0 && merged.length > 0)
            titleFromFirstFolder = folderBasenameFromPaths(merged)
          return { ...s, paths: merged }
        }),
      )
      if (titleFromFirstFolder)
        patchFloatingSession(sessionId, {
          playlistTitle: titleFromFirstFolder,
        })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const applyLaunchPadDropFromPaths = useCallback(
    (sessionId: string, startSlotIndex: number, rawPaths: string[]) => {
      const paths = rawPaths.filter(isMediaFilePath)
      if (!paths.length) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (
        !s0 ||
        s0.playlistMode !== 'launchpad' ||
        !s0.launchPadCells
      )
        return
      if (
        startSlotIndex < 0 ||
        startSlotIndex >= LAUNCHPAD_CELL_COUNT
      )
        return
      recordUndoPoint()
      patchFloatingSession(sessionId, (s) => {
        if (s.playlistMode !== 'launchpad' || !s.launchPadCells) return s
        const cells = mergeLaunchPadCellsWithDrop(
          s.launchPadCells,
          startSlotIndex,
          paths,
        )
        return { ...s, launchPadCells: cells }
      })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const removePathAt = useCallback(
    async (index: number, sessionId: string) => {
      const playbackSid = videoOutputSessionIdRef.current
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s || s.playlistMode === 'launchpad') return
      const prev = s.paths
      if (index < 0 || index >= prev.length) return
      recordUndoPoint()

      const affectsPlayback = sessionId === playbackSid
      const li = loadedIndexRef.current
      const loadedPath =
        affectsPlayback && li != null && li >= 0 && li < prev.length
          ? prev[li]
          : null

      const next = [...prev.slice(0, index), ...prev.slice(index + 1)]

      if (next.length === 0) {
        patchFloatingSession(sessionId, { paths: [], currentIndex: 0 })
        if (affectsPlayback) {
          setPreviewSrc(null)
          setPreviewSyncKey((k) => k + 1)
          loadedIndexRef.current = null
          setPlaybackLoadedTrack(null)
          setVideoPlaying(false)
          await send({ type: 'pause' })
        }
        return
      }

      let nextCi = s.currentIndex
      if (index < nextCi) nextCi = nextCi - 1
      else if (index === nextCi) nextCi = Math.min(index, next.length - 1)

      if (affectsPlayback) {
        const newLi =
          loadedPath != null ? next.findIndex((p) => p === loadedPath) : -1
        if (newLi < 0) {
          loadedIndexRef.current = null
          setPlaybackLoadedTrack(null)
          setVideoPlaying(false)
          setPreviewSrc(null)
          setPreviewSyncKey((k) => k + 1)
          await send({ type: 'pause' })
        } else {
          loadedIndexRef.current = newLi
          setPlaybackLoadedTrack({ sessionId: playbackSid, index: newLi })
        }
      }

      patchFloatingSession(sessionId, {
        paths: next,
        currentIndex: Math.max(0, nextCi),
      })
    },
    [patchFloatingSession, recordUndoPoint, send],
  )

  const selectItem = useCallback(
    (index: number, sessionId: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s) return
      if (s.playlistMode === 'launchpad') {
        if (index >= 0 && index < LAUNCHPAD_CELL_COUNT)
          patchFloatingSession(sessionId, { currentIndex: index })
        return
      }
      if (index >= 0 && index < s.paths.length)
        patchFloatingSession(sessionId, { currentIndex: index })
    },
    [patchFloatingSession],
  )

  const reorderPaths = useCallback(
    (fromIndex: number, toIndex: number, sessionId: string) => {
      if (fromIndex === toIndex) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (s0?.playlistMode === 'launchpad') return
      const prev0 = s0?.paths ?? []
      if (
        fromIndex < 0 ||
        fromIndex >= prev0.length ||
        toIndex < 0 ||
        toIndex >= prev0.length
      )
        return
      recordUndoPoint()
      const playbackSid = videoOutputSessionIdRef.current
      patchFloatingSession(sessionId, (s) => {
        const prev = s.paths
        if (
          fromIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex < 0 ||
          toIndex >= prev.length
        )
          return s
        const selectedPath = prev[s.currentIndex]
        const affectsPlayback = sessionId === playbackSid
        const li = loadedIndexRef.current
        const loadedPath =
          affectsPlayback && li != null && li >= 0 && li < prev.length
            ? prev[li]
            : null
        const next = [...prev]
        const [item] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, item)
        let newCi = s.currentIndex
        const ni = next.findIndex((p) => p === selectedPath)
        if (ni >= 0) newCi = ni
        const nli =
          affectsPlayback && loadedPath != null
            ? next.findIndex((p) => p === loadedPath)
            : -1
        if (affectsPlayback && nli >= 0) {
          loadedIndexRef.current = nli
          setPlaybackLoadedTrack({ sessionId: playbackSid, index: nli })
        }
        return { ...s, paths: next, currentIndex: newCi }
      })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const setStillImageDurationSec = useCallback((sec: number) => {
    setStillImageDurationSecState(clampStillImageDurationSec(sec))
  }, [])

  const setLoopMode = useCallback((m: LoopMode) => {
    setLoopModeState(m)
  }, [])

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m)
  }, [])

  const setOutputVolume = useCallback((v: number) => {
    const c = Math.min(1, Math.max(0, v))
    setOutputVolumeState(c)
    try {
      localStorage.setItem(LS_OUTPUT_VOLUME, String(c))
    } catch {
      /* ignore */
    }
  }, [])

  const setOutputSinkId = useCallback((sinkId: string) => {
    setOutputSinkIdState(sinkId)
    try {
      localStorage.setItem(LS_OUTPUT_SINK, sinkId)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleSecondScreen = useCallback(() => {
    setSecondScreenOn((v) => !v)
  }, [])

  const canUndo = useMemo(
    () => undoStackRef.current.length > 0,
    [historyRev],
  )
  const canRedo = useMemo(
    () => redoStackRef.current.length > 0,
    [historyRev],
  )

  const value = useMemo<RegiaContextValue>(
    () => ({
      paths,
      currentIndex,
      loopMode,
      muted,
      outputVolume,
      setOutputVolume,
      outputSinkId,
      setOutputSinkId,
      playing,
      videoPlaying,
      launchpadAudioPlaying,
      previewSrc,
      previewSyncKey,
      secondScreenOn,
      savedPlaylists,
      floatingPlaylistOpen,
      floatingPlaylistSessions: floatingSessions,
      activeFloatingSessionId: resolvedActiveId,
      setActiveFloatingSession,
      floatingZOrder,
      bringFloatingPanelToFront,
      addFloatingPlaylist,
      addFloatingLaunchPad,
      removeFloatingPlaylist,
      floatingCloseWouldInterruptPlay,
      openFolder,
      addMediaToPlaylist,
      addPathsToPlaylistFromPaths,
      applyLaunchPadDropFromPaths,
      removePathAt,
      refreshSavedPlaylists,
      saveCurrentPlaylist,
      loadSavedPlaylist,
      deleteSavedPlaylist,
      reorderSavedPlaylists,
      duplicateSavedPlaylist,
      loadIndexAndPlay,
      loadLaunchPadSlotAndPlay,
      stopLaunchPadCueRelease,
      updateLaunchPadCell,
      togglePlay,
      setLoopMode,
      setMuted,
      toggleSecondScreen,
      goNext,
      goPrev,
      selectItem,
      reorderPaths,
      playlistTitle,
      setPlaylistTitle,
      setPlaylistThemeColor,
      playlistCrossfade,
      setPlaylistCrossfade,
      setPlaylistLoopMode,
      outputTrackLoopMode,
      previewMediaTimesTick,
      previewMediaTimesRef,
      reportPreviewMediaTimes,
      stillImageDurationSec,
      setStillImageDurationSec,
      setPlaylistOutputMuted,
      setPlaylistOutputVolume,
      closeFloatingPlaylist,
      openFloatingPlaylist,
      hideFloatingPlaylistPanels,
      updateFloatingPlaylistChrome,
      savedPlaylistDirty,
      saveLoadedPlaylistOverwrite,
      persistSavedPlaylistAfterFloatingTitleBlur,
      canUndo,
      canRedo,
      undo,
      redo,
      recordUndoPoint,
      playbackLoadedTrack,
      namedWorkspaces,
      refreshNamedWorkspaces,
      createNewNamedWorkspace,
      saveNamedWorkspace,
      loadNamedWorkspace,
      deleteNamedWorkspace,
      renameNamedWorkspace,
      overwriteNamedWorkspace,
      duplicateNamedWorkspace,
      activeNamedWorkspaceId,
      activeNamedWorkspaceLabel,
      previewDetached,
      setPreviewDocked,
      setPreviewFloating,
      sidebarOpen,
      setSidebarOpen,
      toggleSidebarOpen,
      sidebarWidthPx,
      setSidebarWidthPx,
    }),
    [
      paths,
      currentIndex,
      loopMode,
      muted,
      outputVolume,
      setOutputVolume,
      outputSinkId,
      setOutputSinkId,
      playing,
      videoPlaying,
      launchpadAudioPlaying,
      previewSrc,
      previewSyncKey,
      secondScreenOn,
      savedPlaylists,
      floatingPlaylistOpen,
      floatingSessions,
      resolvedActiveId,
      setActiveFloatingSession,
      floatingZOrder,
      bringFloatingPanelToFront,
      addFloatingPlaylist,
      addFloatingLaunchPad,
      removeFloatingPlaylist,
      floatingCloseWouldInterruptPlay,
      openFolder,
      addMediaToPlaylist,
      addPathsToPlaylistFromPaths,
      applyLaunchPadDropFromPaths,
      removePathAt,
      refreshSavedPlaylists,
      saveCurrentPlaylist,
      loadSavedPlaylist,
      deleteSavedPlaylist,
      reorderSavedPlaylists,
      duplicateSavedPlaylist,
      loadIndexAndPlay,
      loadLaunchPadSlotAndPlay,
      stopLaunchPadCueRelease,
      updateLaunchPadCell,
      togglePlay,
      setLoopMode,
      setMuted,
      setOutputVolume,
      setOutputSinkId,
      toggleSecondScreen,
      goNext,
      goPrev,
      selectItem,
      reorderPaths,
      playlistTitle,
      setPlaylistTitle,
      setPlaylistThemeColor,
      playlistCrossfade,
      setPlaylistCrossfade,
      setPlaylistLoopMode,
      outputTrackLoopMode,
      previewMediaTimesTick,
      previewMediaTimesRef,
      reportPreviewMediaTimes,
      stillImageDurationSec,
      setStillImageDurationSec,
      setPlaylistOutputMuted,
      setPlaylistOutputVolume,
      closeFloatingPlaylist,
      openFloatingPlaylist,
      hideFloatingPlaylistPanels,
      updateFloatingPlaylistChrome,
      savedPlaylistDirty,
      saveLoadedPlaylistOverwrite,
      persistSavedPlaylistAfterFloatingTitleBlur,
      canUndo,
      canRedo,
      undo,
      redo,
      recordUndoPoint,
      playbackLoadedTrack,
      namedWorkspaces,
      refreshNamedWorkspaces,
      createNewNamedWorkspace,
      saveNamedWorkspace,
      loadNamedWorkspace,
      deleteNamedWorkspace,
      renameNamedWorkspace,
      overwriteNamedWorkspace,
      duplicateNamedWorkspace,
      activeNamedWorkspaceId,
      activeNamedWorkspaceLabel,
      previewDetached,
      setPreviewDocked,
      setPreviewFloating,
      sidebarOpen,
      setSidebarOpen,
      toggleSidebarOpen,
      sidebarWidthPx,
      setSidebarWidthPx,
    ],
  )

  return (
    <RegiaContext.Provider value={value}>{children}</RegiaContext.Provider>
  )
}

export function useRegia(): RegiaContextValue {
  const v = useContext(RegiaContext)
  if (!v) throw new Error('useRegia must be used within RegiaProvider')
  return v
}
