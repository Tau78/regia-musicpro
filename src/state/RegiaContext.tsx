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
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { isMediaFilePath } from '../lib/isMediaFilePath.ts'
import type { RegiaFloatingDnDPayload } from '../lib/regiaFloatingDnD.ts'
import { isStillImagePath } from '../mediaPaths.ts'
import { normalizePersistedPadKeyCode } from '../lib/launchPadKeyboard.ts'
import {
  readLaunchPadCueEnabled,
  readLaunchPadDefaultKeyMode,
} from '../lib/launchPadSettings.ts'
import {
  isLaunchpadSamplePausedWithSrc,
  launchpadAnyVoicePlaying,
  launchpadSlotHasAnyVoice,
  launchpadVoiceCount,
  pauseLaunchpadSample,
  pickAnyLaunchpadVoiceSlot,
  playLaunchpadSample,
  resumeLaunchpadSample,
  setLaunchpadSampleLevels,
  setLaunchpadSampleSink,
  stopLaunchpadSample,
  stopLaunchpadVoice,
  stopLaunchpadVoicesForSlot,
} from '../lib/launchpadSamplePlayer.ts'
import {
  buildRegiaBugReportSnapshot,
  type RegiaBugReportSnapshotFields,
  type RegiaBugReportSnapshotV1,
} from '../lib/regiaBugReportSnapshot.ts'
import { deriveOutputTrackListSession } from '../lib/deriveOutputTrackListSession.ts'
import { planFirstDiskLinkForUnlinkedSession } from '../lib/playlistFirstDiskLinkPolicy.ts'
import { normalizePlaylistThemeColor } from '../lib/playlistThemeColor.ts'
import { normalizePlaylistWatermarkAbsPath } from '../lib/playlistWatermarkPath.ts'
import { totalDurationSecForPlaylistSave } from '../lib/sumMediaDurationsSec.ts'
import {
  cyclePlaylistCrossfadeSec as cycleCrossfadeSecValue,
  normalizePlaylistCrossfadeSec,
  playlistCrossfadeSecToMs,
  type PlaylistCrossfadeSec,
} from '../lib/playlistCrossfade.ts'
import type { SavedPlaylistMeta } from '../playlistTypes.ts'
import { clampPanelInViewport } from '../lib/floatingPanelGeometry.ts'
import {
  computeNewFloatingPanelPos,
  computeRightPlanciaDockColumnWidthPx,
  queryPlanciaContentRect,
} from '../lib/planciaSnap.ts'
import {
  persistPreviewDisplayMode,
  type PreviewDisplayMode,
} from '../lib/previewDetachedStorage.ts'
import { readPreviewLayoutFromLs, writePreviewLayoutToLs } from '../lib/previewLayoutStorage.ts'
import { buildPlaylistFloaterSyncPayload } from '../floater/playlistFloaterSync.ts'
import {
  clampSidebarWidth,
  persistSidebarOpen,
  persistSidebarWidthPx,
} from '../lib/sidebarLayout.ts'
import {
  buildBlankWorkspaceShellPersist,
  dispatchShellLayoutEvents,
  dispatchSidebarMainTab,
  clampStillImageDurationSec,
  DEFAULT_STILL_IMAGE_DURATION_SEC,
  parseWorkspaceShell,
  persistShellToLocalStorage,
  readSidebarMainTabFromLs,
  readStandaloneWorkspaceShell,
  REGIA_LS_CUE_SINK_KEY,
  type WorkspaceShellPersist,
} from '../lib/workspaceShell.ts'
import { readOnAirOnAtStartup } from '../lib/onAirStartupSettings.ts'
import { useRegiaFloatingFloaterExperimental } from '../lib/regiaFloatingFloaterSettings.ts'
import {
  outputIdleCapToPlaybackCommand,
  readOutputIdleCapFromLs,
} from '../lib/outputIdleCapStorage.ts'
import { isTypingTarget } from '../hooks/useKeyboardShortcuts.ts'
import {
  LAUNCHPAD_BANK_COUNT,
  LAUNCHPAD_CELL_COUNT,
  LAUNCHPAD_CUE_HOLD_MS,
  cloneLaunchPadBanksDeep,
  cloneLaunchPadCellsSnapshot,
  defaultLaunchPadCells,
  launchPadCellsEqual,
  migrateLaunchPadBanksFromCells,
  normalizeLaunchPadDisplayName,
  normalizeLaunchPadKeyMode,
  type LaunchPadCell,
  type FloatingPlaylistPanelSize,
  type FloatingPlaylistPos,
  type FloatingPlaylistSession,
  type ChalkboardOutputMode,
  type ChalkboardPlacedImage,
  CHALKBOARD_DEFAULT_BG,
  CHALKBOARD_PANEL_SIZE,
  createChalkboardFloatingSession,
  createSottofondoFloatingSession,
  normalizeChalkboardBackgroundHex,
  createEmptyFloatingSession,
  createLaunchPadFloatingSession,
  createLaunchPadFloatingSessionWithKit,
  isListPlaylistWithPaths,
  DEFAULT_FLOATING_PANEL_SIZE,
  LAUNCHPAD_PANEL_SIZE,
  chalkboardPathsEqual,
  chalkboardPlacementsEqual,
  cloneChalkboardPlacementsByBank,
  isTracksPlaylistMode,
  normalizeChalkboardPlacementsFromDisk,
  normalizeChalkboardOutputMode,
  normalizePlanciaDockMode,
  type PlanciaDockMode,
} from './floatingPlaylistSession.ts'

function sessionHasSavedEditLink(
  s: FloatingPlaylistSession,
): s is FloatingPlaylistSession & { editingSavedPlaylistId: string } {
  return (
    s.editingSavedPlaylistId != null &&
    (s.savedEditPathsBaseline != null ||
      s.savedEditLaunchPadBaseline != null ||
      s.savedEditChalkboardPathsBaseline != null)
  )
}

/** Sessione collegata a un file JSON in `Regia Video/Playlist` (manifest cloud). */
function sessionHasCloudEditLink(s: FloatingPlaylistSession): boolean {
  const f =
    typeof s.regiaVideoCloudSourceFile === 'string'
      ? s.regiaVideoCloudSourceFile.trim()
      : ''
  if (f === '') return false
  return (
    s.savedEditPathsBaseline != null ||
    s.savedEditLaunchPadBaseline != null ||
    s.savedEditChalkboardPathsBaseline != null
  )
}

function sessionHasLinkedPersistTarget(s: FloatingPlaylistSession): boolean {
  return sessionHasSavedEditLink(s) || sessionHasCloudEditLink(s)
}

function watermarkPathForDiskSave(s: FloatingPlaylistSession): string | null {
  const p = normalizePlaylistWatermarkAbsPath(s.playlistWatermarkPngPath)
  return p === '' ? null : p
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
    padDisplayName: null,
  }
  p = 1
  for (let off = 1; off < LAUNCHPAD_CELL_COUNT && p < paths.length; off++) {
    const si = (startSlot + off) % LAUNCHPAD_CELL_COUNT
    if (!next[si].samplePath) {
      next[si] = {
        ...next[si],
        samplePath: paths[p]!,
        padDisplayName: null,
      }
      p++
    }
  }
  return next
}

function insertBeforeIndexToReorderToIndex(
  fromIndex: number,
  insertBefore: number,
  pathCount: number,
): number {
  const ib = Math.max(0, Math.min(pathCount, Math.floor(insertBefore)))
  if (fromIndex < ib) return ib - 1
  return ib
}

function dedupeLaunchPadKeysInBank(cells: LaunchPadCell[]): LaunchPadCell[] {
  const seen = new Set<string>()
  return cells.map((c) => {
    const k = c.padKeyCode
    if (typeof k !== 'string' || !k.length) return { ...c }
    if (seen.has(k)) {
      return {
        ...c,
        padKeyCode: null,
        padKeyMode: readLaunchPadDefaultKeyMode(),
      }
    }
    seen.add(k)
    return { ...c }
  })
}

function clearedLaunchPadSlotCell(
  slotIndex: number,
  keepPadColor: string,
): LaunchPadCell {
  const d = defaultLaunchPadCells()[slotIndex]!
  return {
    ...d,
    padColor: keepPadColor,
    samplePath: null,
    padGain: 1,
    padDisplayName: null,
  }
}

/** Prossima traccia sottofondo con audio da file: salta immagini fisse. */
function firstPlayableSottofondoIndex(
  paths: string[],
  start: number,
  wrapAll: boolean,
): number | null {
  for (let i = start; i < paths.length; i++) {
    if (!isStillImagePath(paths[i]!)) return i
  }
  if (wrapAll) {
    for (let i = 0; i < start && i < paths.length; i++) {
      if (!isStillImagePath(paths[i]!)) return i
    }
  }
  return null
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
  /**
   * Uscita dedicata al pre-ascolto CUE / PFL (cuffia). `''` = predefinito di sistema.
   * Il routing audio verso questo dispositivo sarà usato dalle funzioni di cue (separate dal program).
   */
  cueSinkId: string
  setCueSinkId: (sinkId: string) => void
  /** True se il brano della playlist sta andando in anteprima / uscita video. */
  videoPlaying: boolean
  /** True se un sample launchpad è in riproduzione (non in pausa CUE). */
  launchpadAudioPlaying: boolean
  /** Sottofondo: canale audio in uscita, non collegato al play/pausa globale. */
  sottofondoPlaying: boolean
  sottofondoLoadedTrack: { sessionId: string; index: number } | null
  /** Ferma l’audio sottofondo (non influisce su video program o launchpad). */
  stopSottofondoPlayback: () => Promise<void>
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
  addPathsToPlaylistFromPaths: (
    sessionId: string,
    paths: string[],
    /** Indice 0…length: inserisci prima di quella riga; omesso = in coda. */
    insertBeforeIndex?: number | null,
  ) => void
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
  loadSavedPlaylist: (
    id: string,
    opts?: {
      /**
       * Se `false`, il trasporto / PGM passa al nuovo pannello e viene inviato `programVacant`
       * (come caricare e comandare da lì). Omesso o `true`: aggiunge il pannello senza fermare
       * ciò che è già in onda.
       */
      preservePlayback?: boolean
    },
  ) => Promise<string | null>
  /** Carica un manifest JSON da `Regia Video/Playlist` (Drive desktop). */
  loadPlaylistFromRegiaVideoCloudFile: (
    fileName: string,
  ) => Promise<string | null>
  /** Salva una copia del pannello corrente come nuovo file JSON cloud (chiede il nome). */
  saveFloatingPlaylistCopyToRegiaVideoCloud: (
    sessionId: string,
  ) => Promise<boolean>
  setFloatingPlaylistPanelLocked: (
    sessionId: string,
    locked: boolean,
  ) => void
  deleteSavedPlaylist: (id: string) => Promise<void>
  /** Persiste l’ordine delle playlist/launchpad salvati (id nell’ordine desiderato). */
  reorderSavedPlaylists: (orderedIds: string[]) => Promise<void>
  /** Crea una nuova playlist salvata copiando percorsi, nome (con suffisso) e crossfade. */
  duplicateSavedPlaylist: (id: string) => Promise<void>
  loadIndexAndPlay: (index: number, sessionId?: string) => Promise<void>
  loadLaunchPadSlotAndPlay: (
    sessionId: string,
    slotIndex: number,
  ) => Promise<number | undefined>
  /** Ferma l’audio launchpad e azzera lo stato di brano caricato (es. rilascio CUE). */
  stopLaunchPadCueRelease: () => void
  /** Ferma una singola voce CUE (polifonia) o tutte le voci dello slot se `voiceId` è null. */
  releaseLaunchPadCueVoice: (
    voiceId: number | null,
    sessionId: string,
    bankIndex: number,
    slotIndex: number,
  ) => void
  updateLaunchPadCell: (
    sessionId: string,
    slotIndex: number,
    patch: Partial<
      Pick<
        LaunchPadCell,
        | 'samplePath'
        | 'padColor'
        | 'padGain'
        | 'padDisplayName'
        | 'padKeyCode'
        | 'padKeyMode'
      >
    >,
    options?: { skipUndo?: boolean },
  ) => Promise<void>
  /** Cambia pagina pad (0…`LAUNCHPAD_BANK_COUNT`-1) per il launchpad indicato. */
  setLaunchPadBankIndex: (sessionId: string, bankIndex: number) => void
  togglePlay: () => Promise<void>
  /** Pausa video in uscita e ferma il sample Launchpad (stato riproduzione off). */
  stopPlayback: () => Promise<void>
  setLoopMode: (m: LoopMode) => void
  setMuted: (m: boolean) => void
  toggleSecondScreen: () => void
  goNext: () => Promise<void>
  goPrev: () => Promise<void>
  /**
   * Brano armato come prossimo (stile load-to-preview): al prossimo avanzamento
   * manuale o a fine clip viene caricato questo indice, se la playlist comanda l’uscita.
   */
  playbackArmedNext: { sessionId: string; index: number } | null
  /** Imposta il brano che sarà caricato al prossimo take (decode warm-up in background). */
  armPlayNext: (sessionId: string, index: number) => void
  clearPlaybackArmedNext: () => void
  selectItem: (index: number, sessionId: string) => void
  reorderPaths: (
    fromIndex: number,
    toIndex: number,
    sessionId: string,
    options?: { skipUndo?: boolean },
  ) => void
  /** Sposta brano o slot launchpad tra pannelli floating (DnD interno). */
  applyFloatingInternalDrop: (args: {
    target:
      | { kind: 'playlist'; sessionId: string; insertBeforeIndex: number }
      | { kind: 'launchpad'; sessionId: string; slotIndex: number }
    payload: RegiaFloatingDnDPayload
  }) => Promise<void>
  /** Titolo mostrato nella playlist mobile (sessione corrente). */
  playlistTitle: string
  setPlaylistTitle: (title: string, sessionId: string) => void
  /** Colore tema pannello (#rrggbb) o null per predefinito. */
  setPlaylistThemeColor: (hex: string | null, sessionId: string) => void
  /**
   * Path assoluto del watermark attivo in uscita/anteprima (lavagna in onda ha priorità sul PGM a elenco).
   */
  programWatermarkAbsPath: string | null
  setPlaylistWatermarkPngPath: (
    sessionId: string,
    absPath: string | null,
  ) => void
  /** Dissolvenza tra brani in uscita: 0 = off, 3 o 6 s (video/immagine o sottofondo audio). */
  playlistCrossfadeSec: PlaylistCrossfadeSec
  cyclePlaylistCrossfadeSec: (sessionId: string) => void
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
  /**
   * Apre un Launchpad 4×4; `base` e `sfx` usano cartelle distinte (stesso tipo di
   * campioni se rigenerati con gli script npm; vedi `public/launchpad-*`).
   */
  addFloatingLaunchPad: (kit?: 'base' | 'sfx') => Promise<void>
  /** Nuova lavagna (4 banchi PNG, risoluzione uscita). */
  addFloatingChalkboard: () => Promise<void>
  /** Sottofondo: playlist a elenco con play/stop indipendente dal trasporto globale. */
  addFloatingSottofondo: () => void
  removeFloatingPlaylist: (id: string) => Promise<void>
  /** True se chiudere il pannello interromperebbe video o sample launchpad in play. */
  floatingCloseWouldInterruptPlay: (sessionId: string) => boolean
  closeFloatingPlaylist: (sessionId: string) => Promise<void>
  openFloatingPlaylist: () => void
  /** Nasconde i pannelli floating senza eliminare le sessioni. */
  hideFloatingPlaylistPanels: () => void
  /**
   * Larghezza della colonna pannelli agganciati a destra della plancia (0 se assente).
   * Usata per non far sovrapporre i pannelli flottanti alla colonna.
   */
  rightPlanciaDockWidthPx: number
  /** Aggancia playlist / launchpad / lavagna alla colonna destra (restringe l’anteprima). */
  dockFloatingPlaylistToPlanciaRight: (sessionId: string) => void
  updateFloatingPlaylistChrome: (
    sessionId: string,
    patch: {
      pos?: FloatingPlaylistPos
      collapsed?: boolean
      panelSize?: FloatingPlaylistPanelSize
      playlistOutputMuted?: boolean
      playlistOutputVolume?: number
      windowAlwaysOnTopPinned?: boolean
      chalkboardFullscreen?: boolean
      planciaDock?: PlanciaDockMode
    },
  ) => void
  /** Dispone i pannelli flottanti a cascata dentro l’area plancia (anti fuori schermo). */
  repositionAllFloatingPanels: () => void
  /** Aggiornamento parziale di una sessione floating (lavagna, ecc.). */
  patchFloatingPlaylistSession: (
    sessionId: string,
    patch:
      | Partial<FloatingPlaylistSession>
      | ((s: FloatingPlaylistSession) => FloatingPlaylistSession),
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
  /**
   * Brano caricato in anteprima/uscita: una sola riga evidenziabile tra più pannelli.
   * Launchpad: `launchPadBankIndex` = pagina 0…N-1 del banco slot.
   */
  playbackLoadedTrack: {
    sessionId: string
    index: number
    launchPadBankIndex?: number
  } | null
  /** Playlist a elenco che comanda l’uscita video (`null` se in uso solo launchpad). */
  outputTrackListSession: FloatingPlaylistSession | null
  /** Sessione associata al trasporto (`playbackSessionId` risolto). */
  playbackControlSession: FloatingPlaylistSession | null
  videoOutputSessionId: string | null
  /** Id sessione playback (persistenza workspace). */
  playbackSessionId: string | null
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
  /** Modalità anteprima: layout principale, finestra OS, o nascosta. */
  previewDisplayMode: PreviewDisplayMode
  /** Ciclo occhio: agganciata → flottante → off → agganciata. */
  cyclePreviewDisplayMode: () => void
  setPreviewDocked: () => void
  setPreviewFloating: () => void
  /**
   * Sessioni la cui playlist è mostrata in una finestra OS separata (puntina),
   * non nel DOM della finestra Regia.
   */
  playlistFloaterOsSessionIds: string[]
  /** Pannello sinistro playlist / workspace. */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebarOpen: () => void
  sidebarWidthPx: number
  /** Larghezza sidebar; con `persist` false (default true) non scrive su disco fino al commit (es. trascinamento). */
  setSidebarWidthPx: (w: number, persist?: boolean) => void
  /** Snapshot JSON per segnalazione bug (playlist, trasporto, routing). */
  exportBugReportSnapshot: () => RegiaBugReportSnapshotV1
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

function buildBlankNamedWorkspaceSnapshot(
  outputResolution: { width: number; height: number },
): FloatingWorkspacePersistV2 {
  return {
    v: 2,
    open: false,
    activeFloatingSessionId: '',
    playbackSessionId: null,
    sessions: [],
    shell: buildBlankWorkspaceShellPersist(outputResolution),
  }
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
  const sessionPlaylistCrossfadeSec = normalizePlaylistCrossfadeSec(
    (r as Record<string, unknown>).playlistCrossfadeSec,
    (r as Record<string, unknown>).playlistCrossfade,
  )
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
      : r.playlistMode === 'chalkboard'
        ? ('chalkboard' as const)
        : r.playlistMode === 'sottofondo'
          ? ('sottofondo' as const)
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
        const padDisplayName = normalizeLaunchPadDisplayName(c.padDisplayName)
        return {
          samplePath,
          padColor,
          padGain,
          padDisplayName,
          padKeyCode,
          padKeyMode,
        }
      })
    } else {
      launchPadCells = defaults
    }
  }

  let launchPadBanks: LaunchPadCell[][] | undefined
  let launchPadBankIndex: number | undefined
  if (playlistMode === 'launchpad' && launchPadCells) {
    const rawBanks = (r as Record<string, unknown>).launchPadBanks
    if (Array.isArray(rawBanks) && rawBanks.length > 0) {
      launchPadBanks = cloneLaunchPadBanksDeep(rawBanks as LaunchPadCell[][])
      const rawBi = (r as Record<string, unknown>).launchPadBankIndex
      const bi =
        typeof rawBi === 'number' && Number.isFinite(rawBi)
          ? Math.max(0, Math.min(LAUNCHPAD_BANK_COUNT - 1, Math.floor(rawBi)))
          : 0
      launchPadBankIndex = bi
      launchPadCells = launchPadBanks[bi]!.map((c) => ({ ...c }))
    } else {
      launchPadBanks = migrateLaunchPadBanksFromCells(launchPadCells)
      launchPadBankIndex = 0
      launchPadCells = launchPadBanks[0]!.map((c) => ({ ...c }))
    }
  }

  let chalkboardBankPaths: string[] | undefined
  let chalkboardBankIndex: number | undefined
  let chalkboardContentRev: number | undefined
  let chalkboardOutputMode: ChalkboardOutputMode | undefined
  let chalkboardFullscreenSaved: boolean | undefined
  let chalkboardPlacementsByBank: ChalkboardPlacedImage[][] | undefined
  let chalkboardBackgroundColor: string | undefined
  let savedEditChalkboardPathsBaseline: string[] | null = null
  let savedEditChalkboardContentRevBaseline: number | undefined
  let savedEditChalkboardPlacementsBaseline:
    | ChalkboardPlacedImage[][]
    | null
    | undefined
  let savedEditChalkboardBackgroundBaseline: string | undefined
  if (playlistMode === 'chalkboard') {
    const rawCb = r.chalkboardBankPaths
    if (Array.isArray(rawCb)) {
      chalkboardBankPaths = rawCb.filter(
        (p): p is string => typeof p === 'string',
      )
    }
    const rawCbi = r.chalkboardBankIndex
    chalkboardBankIndex =
      typeof rawCbi === 'number' && Number.isFinite(rawCbi)
        ? Math.max(0, Math.min(3, Math.floor(rawCbi)))
        : 0
    const rev = r.chalkboardContentRev
    chalkboardContentRev =
      typeof rev === 'number' && Number.isFinite(rev) ? Math.floor(rev) : 0
    chalkboardOutputMode = normalizeChalkboardOutputMode(
      r.chalkboardOutputMode,
      r.chalkboardOutputToProgram,
    )
    if (r.chalkboardFullscreen === true) {
      chalkboardFullscreenSaved = true
    }
    if (r.savedEditChalkboardPathsBaseline === null) {
      savedEditChalkboardPathsBaseline = null
    } else if (Array.isArray(r.savedEditChalkboardPathsBaseline)) {
      savedEditChalkboardPathsBaseline =
        r.savedEditChalkboardPathsBaseline.filter(
          (p): p is string => typeof p === 'string',
        )
    }
    const br = r.savedEditChalkboardContentRevBaseline
    if (typeof br === 'number' && Number.isFinite(br)) {
      savedEditChalkboardContentRevBaseline = Math.floor(br)
    }
    if (Array.isArray(r.chalkboardPlacementsByBank)) {
      chalkboardPlacementsByBank = normalizeChalkboardPlacementsFromDisk(
        r.chalkboardPlacementsByBank,
      )
    }
    chalkboardBackgroundColor = normalizeChalkboardBackgroundHex(
      r.chalkboardBackgroundColor,
    )
    if (typeof r.savedEditChalkboardBackgroundBaseline === 'string') {
      savedEditChalkboardBackgroundBaseline = normalizeChalkboardBackgroundHex(
        r.savedEditChalkboardBackgroundBaseline,
      )
    }
    if (r.savedEditChalkboardPlacementsBaseline === null) {
      savedEditChalkboardPlacementsBaseline = null
    } else if (Array.isArray(r.savedEditChalkboardPlacementsBaseline)) {
      savedEditChalkboardPlacementsBaseline = cloneChalkboardPlacementsByBank(
        normalizeChalkboardPlacementsFromDisk(
          r.savedEditChalkboardPlacementsBaseline,
        ),
      )
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
  const savedEditCrossfadeSecBaseline = normalizePlaylistCrossfadeSec(
    (r as Record<string, unknown>).savedEditCrossfadeSecBaseline,
    (r as Record<string, unknown>).savedEditCrossfadeBaseline,
  )
  const playlistLoopMode = parsePersistedPlaylistLoopMode(r.playlistLoopMode)
  const savedEditPlaylistLoopBaseline = parsePersistedPlaylistLoopMode(
    r.savedEditPlaylistLoopBaseline,
  )
  const savedEditThemeColorBaseline =
    typeof r.savedEditThemeColorBaseline === 'string'
      ? normalizePlaylistThemeColor(r.savedEditThemeColorBaseline)
      : ''

  const playlistWatermarkPngPath = normalizePlaylistWatermarkAbsPath(
    (r as Record<string, unknown>).playlistWatermarkPngPath,
  )
  const savedEditWatermarkBaseline = normalizePlaylistWatermarkAbsPath(
    typeof (r as Record<string, unknown>).savedEditWatermarkBaseline ===
      'string'
      ? ((r as Record<string, unknown>).savedEditWatermarkBaseline as string)
      : '',
  )

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
          const padDisplayName = normalizeLaunchPadDisplayName(c.padDisplayName)
          return {
            samplePath,
            padColor,
            padGain,
            padDisplayName,
            padKeyCode,
            padKeyMode,
          }
        })
    }
  }

  let playlistWatchFolder: string | undefined
  if (isListPlaylistWithPaths(playlistMode)) {
    const rawWf = (r as Record<string, unknown>).playlistWatchFolder
    if (typeof rawWf === 'string') {
      const t = rawWf.trim()
      if (t) playlistWatchFolder = t
    }
  }

  return {
    id,
    pos,
    panelSize,
    collapsed,
    playlistMode,
    launchPadCells,
    ...(launchPadBanks ? { launchPadBanks, launchPadBankIndex } : {}),
    paths,
    currentIndex,
    playlistTitle,
    playlistCrossfadeSec: sessionPlaylistCrossfadeSec,
    ...(playlistLoopMode !== undefined ? { playlistLoopMode } : {}),
    playlistOutputMuted,
    playlistOutputVolume,
    playlistThemeColor,
    editingSavedPlaylistId,
    savedEditPathsBaseline,
    savedEditTitleBaseline,
    savedEditCrossfadeSecBaseline,
    ...(savedEditPlaylistLoopBaseline !== undefined
      ? { savedEditPlaylistLoopBaseline }
      : {}),
    savedEditThemeColorBaseline,
    savedEditWatermarkBaseline,
    playlistWatermarkPngPath,
    savedEditLaunchPadBaseline,
    ...(playlistMode === 'chalkboard'
      ? {
          chalkboardBankPaths,
          chalkboardBankIndex,
          chalkboardContentRev,
          chalkboardBackgroundColor:
            chalkboardBackgroundColor ?? CHALKBOARD_DEFAULT_BG,
          ...(chalkboardPlacementsByBank
            ? { chalkboardPlacementsByBank }
            : {}),
          ...(chalkboardOutputMode && chalkboardOutputMode !== 'off'
            ? { chalkboardOutputMode }
            : {}),
          ...(chalkboardFullscreenSaved
            ? { chalkboardFullscreen: true as const }
            : {}),
          savedEditChalkboardPathsBaseline,
          ...(savedEditChalkboardContentRevBaseline !== undefined
            ? { savedEditChalkboardContentRevBaseline }
            : {}),
          ...(savedEditChalkboardPlacementsBaseline !== undefined
            ? { savedEditChalkboardPlacementsBaseline }
            : {}),
          ...(savedEditChalkboardBackgroundBaseline !== undefined
            ? { savedEditChalkboardBackgroundBaseline }
            : {}),
        }
      : {}),
    ...(r.windowAlwaysOnTopPinned === true
      ? { windowAlwaysOnTopPinned: true as const }
      : {}),
    ...(normalizePlanciaDockMode(r.planciaDock) === 'right'
      ? { planciaDock: 'right' as const }
      : {}),
    ...(() => {
      const rawCf = (r as Record<string, unknown>).regiaVideoCloudSourceFile
      const cf =
        typeof rawCf === 'string' && rawCf.trim() !== ''
          ? rawCf.trim()
          : null
      return cf != null ? { regiaVideoCloudSourceFile: cf } : {}
    })(),
    ...(playlistWatchFolder ? { playlistWatchFolder } : {}),
    ...(r.panelLocked === true ? { panelLocked: true as const } : {}),
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

function shellWithOnAirStartupPref(shell: WorkspaceShellPersist): WorkspaceShellPersist {
  return { ...shell, secondScreenOn: readOnAirOnAtStartup() }
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
        shell: shellWithOnAirStartupPref(readStandaloneWorkspaceShell()),
      }
    }
    const n = normalizeWorkspaceFile(JSON.parse(raw))
    if (!n) {
      return {
        floating: { ...EMPTY_FLOATING_WORKSPACE_STATE },
        shell: shellWithOnAirStartupPref(readStandaloneWorkspaceShell()),
      }
    }
    return {
      floating: n.floating,
      shell: shellWithOnAirStartupPref(n.shell ?? readStandaloneWorkspaceShell()),
    }
  } catch {
    return {
      floating: { ...EMPTY_FLOATING_WORKSPACE_STATE },
      shell: shellWithOnAirStartupPref(readStandaloneWorkspaceShell()),
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

/** Directory padre dal path assoluto di un file (slash normalizzati). */
function parentDirFromAbsFilePath(absPath: string): string | undefined {
  const norm = absPath.replace(/\\/g, '/')
  const lastSlash = norm.lastIndexOf('/')
  if (lastSlash <= 0) return undefined
  return norm.slice(0, lastSlash)
}

/**
 * Risposta di `selectFolder`: oggetto `{ folder, paths }` oppure solo l’array
 * `paths` (main Electron più vecchio). Senza normalizzazione, `picked.paths` su
 * un array è `undefined` e la playlist non si aggiorna.
 */
function normalizeSelectFolderPayload(raw: unknown): {
  paths: string[]
  folder: string | undefined
} | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const paths = raw.filter((p): p is string => typeof p === 'string')
    if (!paths.length) return null
    return {
      paths,
      folder: parentDirFromAbsFilePath(paths[0]!),
    }
  }
  if (typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const pathsRaw = o.paths
  const paths = Array.isArray(pathsRaw)
    ? pathsRaw.filter((p): p is string => typeof p === 'string')
    : []
  if (!paths.length) return null
  const folderFromField =
    typeof o.folder === 'string' && o.folder.trim() ? o.folder.trim() : ''
  return {
    paths,
    folder: folderFromField || parentDirFromAbsFilePath(paths[0]!),
  }
}

const CLEAR_PLAYLIST_WATCH_FOLDER: Partial<FloatingPlaylistSession> = {
  playlistWatchFolder: undefined,
}

function pathsEqual(a: string[], b: string[] | null): boolean {
  if (!b || a.length !== b.length) return false
  return a.every((p, i) => p === b[i])
}

function floatingPlaylistSessionDirty(
  s: FloatingPlaylistSession,
  shellLoopMode: LoopMode,
): boolean {
  if (s.playlistMode === 'launchpad') {
    if (
      !launchPadCellsEqual(
        s.launchPadCells,
        s.savedEditLaunchPadBaseline ?? undefined,
      )
    )
      return true
  } else if (s.playlistMode === 'chalkboard') {
    if (
      (s.chalkboardContentRev ?? 0) !==
      (s.savedEditChalkboardContentRevBaseline ?? 0)
    )
      return true
    if (
      !chalkboardPathsEqual(
        s.chalkboardBankPaths,
        s.savedEditChalkboardPathsBaseline ?? undefined,
      )
    )
      return true
    if (
      !chalkboardPlacementsEqual(
        s.chalkboardPlacementsByBank,
        s.savedEditChalkboardPlacementsBaseline ?? undefined,
      )
    )
      return true
    if (
      normalizeChalkboardBackgroundHex(s.chalkboardBackgroundColor) !==
      normalizeChalkboardBackgroundHex(
        s.savedEditChalkboardBackgroundBaseline ?? CHALKBOARD_DEFAULT_BG,
      )
    )
      return true
  } else if (!pathsEqual(s.paths, s.savedEditPathsBaseline!)) {
    return true
  }
  if (s.playlistTitle.trim() !== s.savedEditTitleBaseline.trim()) return true
  if (
    isTracksPlaylistMode(s.playlistMode) &&
    s.playlistCrossfadeSec !== s.savedEditCrossfadeSecBaseline
  )
    return true
  if (isTracksPlaylistMode(s.playlistMode)) {
    const curLoop = s.playlistLoopMode ?? shellLoopMode
    const baseLoop = s.savedEditPlaylistLoopBaseline ?? shellLoopMode
    if (curLoop !== baseLoop) return true
  }
  if (
    normalizePlaylistWatermarkAbsPath(s.playlistWatermarkPngPath) !==
    normalizePlaylistWatermarkAbsPath(s.savedEditWatermarkBaseline)
  )
    return true
  return (
    normalizePlaylistThemeColor(s.playlistThemeColor ?? '') !==
    normalizePlaylistThemeColor(s.savedEditThemeColorBaseline ?? '')
  )
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
    if (p && isTracksPlaylistMode(p.playlistMode)) return playbackId
  }
  const first = sessions.find((s) => isTracksPlaylistMode(s.playlistMode))
  return first?.id ?? null
}

function deepCloneFloatingSessions(
  sessions: FloatingPlaylistSession[],
): FloatingPlaylistSession[] {
  return sessions.map((s) => ({
    ...s,
    paths: [...s.paths],
    launchPadCells: s.launchPadCells?.map((c) => ({ ...c })),
    launchPadBanks: s.launchPadBanks
      ? cloneLaunchPadBanksDeep(s.launchPadBanks)
      : undefined,
    launchPadBankIndex: s.launchPadBankIndex,
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
    chalkboardBankPaths: s.chalkboardBankPaths
      ? [...s.chalkboardBankPaths]
      : undefined,
    chalkboardBankIndex: s.chalkboardBankIndex,
    chalkboardContentRev: s.chalkboardContentRev,
    chalkboardOutputMode: normalizeChalkboardOutputMode(
      s.chalkboardOutputMode,
      (s as { chalkboardOutputToProgram?: boolean }).chalkboardOutputToProgram,
    ),
    chalkboardFullscreen: s.chalkboardFullscreen,
    chalkboardPlacementsByBank: cloneChalkboardPlacementsByBank(
      s.chalkboardPlacementsByBank,
    ),
    chalkboardBackgroundColor: normalizeChalkboardBackgroundHex(
      s.chalkboardBackgroundColor,
    ),
    savedEditChalkboardPathsBaseline: s.savedEditChalkboardPathsBaseline
      ? [...s.savedEditChalkboardPathsBaseline]
      : null,
    savedEditChalkboardContentRevBaseline: s.savedEditChalkboardContentRevBaseline,
    savedEditChalkboardPlacementsBaseline:
      s.savedEditChalkboardPlacementsBaseline === null
        ? null
        : cloneChalkboardPlacementsByBank(s.savedEditChalkboardPlacementsBaseline),
    savedEditChalkboardBackgroundBaseline:
      s.savedEditChalkboardBackgroundBaseline !== undefined
        ? normalizeChalkboardBackgroundHex(s.savedEditChalkboardBackgroundBaseline)
        : undefined,
    playlistWatermarkPngPath: s.playlistWatermarkPngPath ?? '',
    savedEditWatermarkBaseline: s.savedEditWatermarkBaseline ?? '',
  }))
}

const RegiaContext = createContext<RegiaContextValue | null>(null)

/** Contesto alternativo per `FloatingPlaylist` nella finestra OS separata. */
export const PlaylistFloaterMirrorContext =
  createContext<RegiaContextValue | null>(null)

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
    if (bootstrap.shell.previewDisplayMode === 'floating')
      ids.push(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
    return ids
  })
  const [playlistFloaterOsSessionIds, setPlaylistFloaterOsSessionIds] = useState<
    string[]
  >([])
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
  const [cueSinkId, setCueSinkIdState] = useState(
    () => bootstrap.shell.cueSinkId,
  )
  const [playbackArmedNext, setPlaybackArmedNext] = useState<{
    sessionId: string
    index: number
  } | null>(null)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [launchpadAudioPlaying, setLaunchpadAudioPlaying] = useState(false)
  const [sottofondoPlaying, setSottofondoPlaying] = useState(false)
  const [sottofondoLoadedTrack, setSottofondoLoadedTrack] = useState<{
    sessionId: string
    index: number
  } | null>(null)
  const playing = videoPlaying || launchpadAudioPlaying
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewSyncKey, setPreviewSyncKey] = useState(0)
  const [secondScreenOn, setSecondScreenOn] = useState(
    () => bootstrap.shell.secondScreenOn,
  )
  const [previewDisplayMode, setPreviewDisplayMode] = useState<
    PreviewDisplayMode
  >(() => bootstrap.shell.previewDisplayMode)
  const previewDetached = previewDisplayMode === 'floating'
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

  const previewDisplayModeRef = useRef(previewDisplayMode)
  useLayoutEffect(() => {
    previewDisplayModeRef.current = previewDisplayMode
  }, [previewDisplayMode])

  useEffect(() => {
    persistPreviewDisplayMode(previewDisplayMode)
  }, [previewDisplayMode])

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
    launchPadBankIndex?: number
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
  const sottofondoLoadedTrackRef = useRef(sottofondoLoadedTrack)
  const sottofondoPlayingRef = useRef(sottofondoPlaying)
  useLayoutEffect(() => {
    previewSrcRef.current = previewSrc
    previewSyncKeyRef.current = previewSyncKey
    videoPlayingRef.current = videoPlaying
    launchpadAudioPlayingRef.current = launchpadAudioPlaying
    sottofondoLoadedTrackRef.current = sottofondoLoadedTrack
    sottofondoPlayingRef.current = sottofondoPlaying
  }, [
    previewSrc,
    previewSyncKey,
    videoPlaying,
    launchpadAudioPlaying,
    sottofondoLoadedTrack,
    sottofondoPlaying,
  ])

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
      if (previewDisplayMode === 'floating')
        allowed.add(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
      const kept = prev.filter((k) => allowed.has(k))
      const out = [...kept]
      for (const s of floatingSessions) {
        if (!out.includes(s.id)) out.push(s.id)
      }
      if (
        previewDisplayMode === 'floating' &&
        !out.includes(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
      ) {
        out.push(REGIA_FLOATING_PREVIEW_ZORDER_KEY)
      }
      return out
    })
  }, [floatingSessions, previewDisplayMode])

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
          (s) => s.id === cur && isTracksPlaylistMode(s.playlistMode),
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

  const outputTrackListSession = useMemo((): FloatingPlaylistSession | null => {
    return deriveOutputTrackListSession(
      floatingSessions,
      videoOutputSessionId,
      resolvedPlaybackId,
    )
  }, [floatingSessions, videoOutputSessionId, resolvedPlaybackId])

  const outputTrackLoopMode = useMemo((): LoopMode => {
    const videoS =
      videoOutputSessionId &&
      floatingSessions.some((s) => s.id === videoOutputSessionId)
        ? floatingSessions.find((s) => s.id === videoOutputSessionId)
        : null
    const pathSource =
      videoS && isTracksPlaylistMode(videoS.playlistMode)
        ? videoS
        : playbackSession && isTracksPlaylistMode(playbackSession.playlistMode)
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

  const programWatermarkAbsPath = useMemo((): string | null => {
    const chalkOn = floatingSessions.find(
      (x) =>
        x.playlistMode === 'chalkboard' &&
        normalizeChalkboardOutputMode(
          x.chalkboardOutputMode,
          (x as { chalkboardOutputToProgram?: boolean })
            .chalkboardOutputToProgram,
        ) !== 'off',
    )
    if (chalkOn) {
      const w = normalizePlaylistWatermarkAbsPath(chalkOn.playlistWatermarkPngPath)
      if (w) return w
    }
    if (videoOutputSession) {
      const w = normalizePlaylistWatermarkAbsPath(
        videoOutputSession.playlistWatermarkPngPath,
      )
      if (w) return w
    }
    return null
  }, [floatingSessions, videoOutputSession])

  /** Elenco della sessione attiva (sidebar «Salva», ecc.). */
  const paths = activeSession?.paths ?? []
  const currentIndex = activeSession?.currentIndex ?? 0
  const playlistTitle = activeSession?.playlistTitle ?? ''
  const playlistCrossfadeSec: PlaylistCrossfadeSec =
    activeSession?.playlistCrossfadeSec ?? 3

  const floatingSessionsRef = useRef(floatingSessions)
  useLayoutEffect(() => {
    floatingSessionsRef.current = floatingSessions
  }, [floatingSessions])

  const rightPlanciaDockWidthPx = useMemo(
    () => computeRightPlanciaDockColumnWidthPx(floatingSessions),
    [floatingSessions],
  )

  /** Evita salvataggi duplicati se Invio (repeat) o blur girano mentre il primo `playlistsSave` è ancora in corso. */
  const persistFloatingTitleBlurBySessionRef = useRef(
    new Map<string, Promise<void>>(),
  )

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

  useEffect(() => {
    setPlaybackArmedNext((a) => {
      if (!a) return a
      const sess = floatingSessions.find((s) => s.id === a.sessionId)
      if (
        !sess ||
        sess.playlistMode === 'launchpad' ||
        sess.playlistMode === 'chalkboard'
      )
        return null
      if (a.index < 0 || a.index >= sess.paths.length) return null
      return a
    })
  }, [floatingSessions])

  const pathsRef = useRef(paths)
  const currentIndexRef = useRef(currentIndex)
  const loopModeRef = useRef(loopMode)
  const loadedIndexRef = useRef<number | null>(null)
  const secondScreenOnRef = useRef(secondScreenOn)
  const secondScreenToggleSyncSkipFirstRef = useRef(false)
  const prevSecondScreenOnForSyncRef = useRef(secondScreenOn)
  const outputVolumeRef = useRef(outputVolume)
  const outputSinkIdRef = useRef(outputSinkId)
  useLayoutEffect(() => {
    outputVolumeRef.current = outputVolume
  }, [outputVolume])
  useLayoutEffect(() => {
    outputSinkIdRef.current = outputSinkId
  }, [outputSinkId])

  const cueSinkIdRef = useRef(cueSinkId)
  useLayoutEffect(() => {
    cueSinkIdRef.current = cueSinkId
  }, [cueSinkId])

  const playbackArmedNextRef = useRef(playbackArmedNext)
  useLayoutEffect(() => {
    playbackArmedNextRef.current = playbackArmedNext
  }, [playbackArmedNext])

  /** Sessione la cui playlist comanda pathsRef / goNext (stesso criterio di `outputTrackListSession`). */
  const outputTrackListSessionIdRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    const videoS =
      videoOutputSessionId &&
      floatingSessions.some((s) => s.id === videoOutputSessionId)
        ? floatingSessions.find((s) => s.id === videoOutputSessionId)
        : null
    const pathSource =
      videoS && isTracksPlaylistMode(videoS.playlistMode)
        ? videoS
        : playbackSession && isTracksPlaylistMode(playbackSession.playlistMode)
          ? playbackSession
          : null
    outputTrackListSessionIdRef.current = pathSource?.id ?? null
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
        previewDisplayMode: previewDisplayModeRef.current,
        previewLayout: readPreviewLayoutFromLs(),
        sidebarOpen: sidebarOpenRef.current,
        sidebarWidthPx: sidebarWidthPxRef.current,
        outputResolution,
        loopMode: shellLoopModeRef.current,
        muted: mutedRef.current,
        outputVolume: outputVolumeRef.current,
        outputSinkId: outputSinkIdRef.current,
        cueSinkId: cueSinkIdRef.current,
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
    previewDisplayMode,
    sidebarOpen,
    sidebarWidthPx,
    loopMode,
    muted,
    outputVolume,
    outputSinkId,
    cueSinkId,
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

  const playlistFolderWatchPrevRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.playlistFolderWatchStart || !api?.playlistFolderWatchStop)
      return
    const desired = new Map<string, string>()
    for (const s of floatingSessions) {
      if (!isTracksPlaylistMode(s.playlistMode)) continue
      const f = s.playlistWatchFolder?.trim()
      if (f) desired.set(s.id, f)
    }
    const prev = playlistFolderWatchPrevRef.current
    for (const [id, folder] of desired) {
      if (prev.get(id) !== folder) {
        void api.playlistFolderWatchStart(id, folder)
      }
    }
    for (const id of prev.keys()) {
      if (!desired.has(id)) void api.playlistFolderWatchStop(id)
    }
    playlistFolderWatchPrevRef.current = desired
  }, [floatingSessions])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onPlaylistFolderMediaPathsUpdated) return
    return api.onPlaylistFolderMediaPathsUpdated((msg) => {
      const { sessionId, folder, paths } = msg
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s0 || !isTracksPlaylistMode(s0.playlistMode)) return
      if ((s0.playlistWatchFolder ?? '').trim() !== folder.trim()) return
      if (
        paths.length === s0.paths.length &&
        paths.every((p, i) => p === s0.paths[i])
      )
        return

      patchFloatingSession(sessionId, (cur) => {
        if ((cur.playlistWatchFolder ?? '').trim() !== folder.trim()) return cur
        const prevPaths = cur.paths
        const selPath = prevPaths[cur.currentIndex]
        const playbackSid = videoOutputSessionIdRef.current
        const li = loadedIndexRef.current
        const loadedPath =
          playbackSid === sessionId &&
          li != null &&
          li >= 0 &&
          li < prevPaths.length
            ? prevPaths[li]!
            : null

        let nextCi = cur.currentIndex
        if (selPath) {
          const ni = paths.findIndex((p) => p === selPath)
          if (ni >= 0) nextCi = ni
          else
            nextCi = Math.min(
              cur.currentIndex,
              Math.max(0, paths.length - 1),
            )
        } else {
          nextCi = Math.min(cur.currentIndex, Math.max(0, paths.length - 1))
        }

        if (playbackSid === sessionId && loadedPath != null) {
          const newLi = paths.findIndex((p) => p === loadedPath)
          if (newLi >= 0) {
            loadedIndexRef.current = newLi
            setPlaybackLoadedTrack({ sessionId, index: newLi })
          } else {
            loadedIndexRef.current = null
            setPlaybackLoadedTrack(null)
            setVideoPlaying(false)
            setPreviewSrc(null)
            setPreviewSyncKey((k) => k + 1)
            void send({ type: 'programVacant' })
          }
        }

        return {
          ...cur,
          paths,
          currentIndex: Math.max(0, nextCi),
        }
      })
    })
  }, [patchFloatingSession, send])

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
      opts?: { skipHistory?: boolean; playlistWatchFolder?: string },
    ) => {
      if (!list.length) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (
        s0?.playlistMode === 'launchpad' ||
        s0?.playlistMode === 'chalkboard'
      )
        return
      if (!opts?.skipHistory) {
        recordUndoPoint()
      }
      const wf =
        typeof opts?.playlistWatchFolder === 'string' &&
        opts.playlistWatchFolder.trim()
          ? opts.playlistWatchFolder.trim()
          : undefined
      const watchPatch =
        wf != null
          ? { playlistWatchFolder: wf }
          : CLEAR_PLAYLIST_WATCH_FOLDER
      const preserveSavedEdit = s0 != null && sessionHasLinkedPersistTarget(s0)
      if (preserveSavedEdit) {
        patchFloatingSession(sessionId, {
          ...watchPatch,
          paths: list,
          currentIndex: 0,
        })
      } else {
        patchFloatingSession(sessionId, {
          ...watchPatch,
          paths: list,
          currentIndex: 0,
          editingSavedPlaylistId: null,
          regiaVideoCloudSourceFile: null,
          savedEditPathsBaseline: null,
          savedEditLaunchPadBaseline: null,
          savedEditTitleBaseline: '',
          savedEditCrossfadeSecBaseline: 3,
          savedEditPlaylistLoopBaseline: undefined,
          savedEditThemeColorBaseline: '',
          playlistCrossfadeSec: 3,
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
      await send({ type: 'programVacant' })
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
      const pos = computeNewFloatingPanelPos(
        DEFAULT_FLOATING_PANEL_SIZE,
        0,
        prev,
      )
      const s = createEmptyFloatingSession(pos)
      setActiveFloatingSessionId(s.id)
      return [s]
    })
  }, [])

  const setPreviewDocked = useCallback(() => {
    setPreviewDisplayMode('docked')
  }, [])

  const setPreviewFloating = useCallback(() => {
    setPreviewDisplayMode('floating')
  }, [])

  const cyclePreviewDisplayMode = useCallback(() => {
    setPreviewDisplayMode((m) => {
      const order: PreviewDisplayMode[] = ['docked', 'floating', 'hidden']
      const i = order.indexOf(m)
      return order[(i + 1) % order.length]!
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
    setPreviewDisplayMode(shell.previewDisplayMode)
    previewDisplayModeRef.current = shell.previewDisplayMode
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
    const nextCue = typeof shell.cueSinkId === 'string' ? shell.cueSinkId : ''
    setCueSinkIdState(nextCue)
    cueSinkIdRef.current = nextCue
    try {
      localStorage.setItem(REGIA_LS_CUE_SINK_KEY, nextCue)
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
        previewDisplayMode: previewDisplayModeRef.current,
        previewLayout: readPreviewLayoutFromLs(),
        sidebarOpen: sidebarOpenRef.current,
        sidebarWidthPx: sidebarWidthPxRef.current,
        outputResolution: lastOutputResolutionRef.current,
        loopMode: shellLoopModeRef.current,
        muted: mutedRef.current,
        outputVolume: outputVolumeRef.current,
        outputSinkId: outputSinkIdRef.current,
        cueSinkId: cueSinkIdRef.current,
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
      await send({ type: 'programVacant' })
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

  const createNewNamedWorkspace = useCallback(() => {
    const label = nextUniqueWorkspaceLabel('Nuovo workspace')
    const id = `nw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    void (async () => {
      let outputResolution = lastOutputResolutionRef.current
      try {
        const r = await window.electronAPI.getOutputResolution()
        if (
          r &&
          Number.isFinite(r.width) &&
          Number.isFinite(r.height) &&
          r.width > 0 &&
          r.height > 0
        ) {
          outputResolution = { width: r.width, height: r.height }
        }
      } catch {
        /* ignore */
      }
      const snapshot = buildBlankNamedWorkspaceSnapshot(outputResolution)
      const root = readNamedWorkspacesRoot()
      root.items.push({
        id,
        label,
        savedAt: Date.now(),
        snapshot,
      })
      writeNamedWorkspacesRoot(root)
      setNamedWorkspaces(readNamedWorkspaceMetas())
      await loadNamedWorkspace(id)
    })()
  }, [loadNamedWorkspace])

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
        windowAlwaysOnTopPinned?: boolean
        chalkboardFullscreen?: boolean
        planciaDock?: PlanciaDockMode
      },
    ) => {
      patchFloatingSession(sessionId, patch)
    },
    [patchFloatingSession],
  )

  const dockFloatingPlaylistToPlanciaRight = useCallback(
    (sessionId: string) => {
      recordUndoPoint()
      setFloatingSessions((prev) => {
        const i = prev.findIndex((s) => s.id === sessionId)
        if (i < 0) return prev
        const cur = prev[i]!
        if (cur.planciaDock === 'right') return prev
        const updated: FloatingPlaylistSession = { ...cur, planciaDock: 'right' }
        const others = prev.filter((_, j) => j !== i)
        const undocked = others.filter((s) => s.planciaDock !== 'right')
        const docked = others.filter((s) => s.planciaDock === 'right')
        return [...undocked, ...docked, updated]
      })
    },
    [recordUndoPoint],
  )

  const repositionAllFloatingPanels = useCallback(() => {
    const pl = queryPlanciaContentRect()
    if (!pl) return
    recordUndoPoint()
    const MIN_W = 220
    const MIN_H = 180
    const MAX_W = 960
    const MAX_H = 780
    const M = 10
    const step = 28
    const snapshot = floatingSessionsRef.current
    if (snapshot.length === 0) return
    const dockInset = computeRightPlanciaDockColumnWidthPx(snapshot)
    let k = 0
    for (const s of snapshot) {
      if (s.planciaDock === 'right') continue
      const nx = pl.left + M + (k % 5) * step
      const ny = pl.top + M + (k % 5) * step
      k += 1
      const { pos, size } = clampPanelInViewport(
        { x: nx, y: ny },
        { width: s.panelSize.width, height: s.panelSize.height },
        MIN_W,
        MIN_H,
        { maxW: MAX_W, maxH: MAX_H, rightInset: dockInset },
      )
      patchFloatingSession(s.id, { pos, panelSize: size })
    }
  }, [patchFloatingSession, recordUndoPoint])

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
      const k = prev.filter((s) => s.planciaDock !== 'right').length
      const pos = computeNewFloatingPanelPos(
        DEFAULT_FLOATING_PANEL_SIZE,
        k,
        prev,
      )
      const s = createEmptyFloatingSession(pos)
      setActiveFloatingSessionId(s.id)
      return [...prev, s]
    })
  }, [recordUndoPoint])

  const addFloatingLaunchPad = useCallback(async (kit: 'base' | 'sfx' = 'base') => {
    recordUndoPoint()
    let kitPaths: string[] = []
    try {
      kitPaths =
        kit === 'sfx'
          ? await window.electronAPI.launchpadSfxKitPaths()
          : await window.electronAPI.launchpadBaseKitPaths()
    } catch {
      kitPaths = []
    }
    const kitTitle =
      kit === 'sfx' ? 'Launchpad SFX (reazioni)' : 'Launchpad base'
    setFloatingSessions((prev) => {
      const k = prev.filter((s) => s.planciaDock !== 'right').length
      const pos = computeNewFloatingPanelPos(LAUNCHPAD_PANEL_SIZE, k, prev)
      const s =
        kitPaths.length > 0
          ? createLaunchPadFloatingSessionWithKit(kitPaths, pos, kitTitle)
          : createLaunchPadFloatingSession(pos)
      setActiveFloatingSessionId(s.id)
      return [...prev, s]
    })
  }, [recordUndoPoint])

  const addFloatingChalkboard = useCallback(async () => {
    recordUndoPoint()
    setFloatingSessions((prev) => {
      const k = prev.filter((s) => s.planciaDock !== 'right').length
      const pos = computeNewFloatingPanelPos(CHALKBOARD_PANEL_SIZE, k, prev)
      const s = createChalkboardFloatingSession(pos)
      setActiveFloatingSessionId(s.id)
      return [...prev, s]
    })
  }, [recordUndoPoint])

  const addFloatingSottofondo = useCallback(() => {
    recordUndoPoint()
    setFloatingSessions((prev) => {
      const k = prev.filter((s) => s.planciaDock !== 'right').length
      const pos = computeNewFloatingPanelPos(
        DEFAULT_FLOATING_PANEL_SIZE,
        k,
        prev,
      )
      const s = createSottofondoFloatingSession(pos)
      setActiveFloatingSessionId(s.id)
      return [...prev, s]
    })
  }, [recordUndoPoint])

  const setPlaylistTitle = useCallback((title: string, sessionId: string) => {
    patchFloatingSession(sessionId, {
      playlistTitle: title.slice(0, 120),
    })
  }, [patchFloatingSession])

  const cyclePlaylistCrossfadeSec = useCallback(
    (sessionId: string) => {
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (s0?.panelLocked === true) return
      recordUndoPoint()
      const cur = normalizePlaylistCrossfadeSec(s0?.playlistCrossfadeSec)
      patchFloatingSession(sessionId, {
        playlistCrossfadeSec: cycleCrossfadeSecValue(cur),
      })
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

  const setPlaylistWatermarkPngPath = useCallback(
    (sessionId: string, absPath: string | null) => {
      recordUndoPoint()
      const next =
        absPath == null || absPath.trim() === ''
          ? ''
          : normalizePlaylistWatermarkAbsPath(absPath.trim())
      patchFloatingSession(sessionId, {
        playlistWatermarkPngPath: next,
      })
    },
    [patchFloatingSession, recordUndoPoint],
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

  const playbackCrossfadeMs = videoOutputSession
    ? playlistCrossfadeSecToMs(
        normalizePlaylistCrossfadeSec(videoOutputSession.playlistCrossfadeSec),
      )
    : 0
  useEffect(() => {
    void send({ type: 'setCrossfadeMs', ms: playbackCrossfadeMs })
  }, [playbackCrossfadeMs, send])

  useEffect(() => {
    if (!programWatermarkAbsPath) {
      void send({ type: 'playlistWatermark', visible: false })
      return
    }
    void send({
      type: 'playlistWatermark',
      visible: true,
      src: programWatermarkAbsPath,
    })
  }, [programWatermarkAbsPath, send])

  const savedPlaylistDirty = useCallback(
    (sessionId: string) => {
      const s = floatingSessions.find((x) => x.id === sessionId)
      if (!s || !sessionHasLinkedPersistTarget(s)) return false
      return floatingPlaylistSessionDirty(s, loopMode)
    },
    [floatingSessions, loopMode],
  )

  const writeFloatingSessionToRegiaVideoCloud = useCallback(
    async (
      sessionId: string,
      fileBaseName: string,
    ): Promise<
      | { ok: true; fileName: string }
      | { ok: false; error: string; pathsOutsideRoot?: string[] }
    > => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s) return { ok: false, error: 'Sessione non trovata' }
      const bn = fileBaseName.trim()
      if (!bn.endsWith('.json') || bn !== bn.replace(/[/\\]/g, '')) {
        return { ok: false, error: 'Nome file non valido' }
      }
      const label = s.playlistTitle.trim() || 'Senza titolo'
      const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')
      const wm = watermarkPathForDiskSave(s)
      const api = window.electronAPI
      if (s.playlistMode === 'launchpad') {
        const cells = s.launchPadCells ?? defaultLaunchPadCells()
        const totalDurationSec = await totalDurationSecForPlaylistSave({
          playlistMode: 'launchpad',
          paths: [],
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
        })
        const r = await api.regiaVideoCloudSaveFile({
          fileBaseName: bn,
          payload: {
            label,
            paths: [],
            crossfadeSec: 0,
            loopMode: 'off',
            themeColor: themeCur === '' ? null : themeCur,
            playlistMode: 'launchpad',
            launchPadCells: cloneLaunchPadCellsSnapshot(cells),
            watermarkPngPath: wm,
            totalDurationSec,
          },
        })
        if (!r.ok) return r
        const wmCur = normalizePlaylistWatermarkAbsPath(s.playlistWatermarkPngPath)
        patchFloatingSession(sessionId, {
          savedEditPathsBaseline: [],
          savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(cells),
          savedEditTitleBaseline: label.trim(),
          savedEditThemeColorBaseline: themeCur,
          savedEditWatermarkBaseline: wmCur,
          regiaVideoCloudSourceFile: r.fileName,
        })
        return r
      }
      if (s.playlistMode === 'chalkboard') {
        const pathsCb = s.chalkboardBankPaths ?? []
        if (pathsCb.length < 4) {
          return { ok: false, error: 'Chalkboard incompleta (servono 4 banchi)' }
        }
        const bgCur = normalizeChalkboardBackgroundHex(s.chalkboardBackgroundColor)
        const pl = cloneChalkboardPlacementsByBank(s.chalkboardPlacementsByBank)
        const totalDurationSec = await totalDurationSecForPlaylistSave({
          playlistMode: 'chalkboard',
          paths: [],
        })
        const r = await api.regiaVideoCloudSaveFile({
          fileBaseName: bn,
          payload: {
            label,
            paths: [],
            playlistMode: 'chalkboard',
            chalkboardBankPaths: [...pathsCb],
            chalkboardBackgroundColor: bgCur,
            chalkboardPlacementsByBank: pl,
            watermarkPngPath: wm,
            totalDurationSec,
          },
        })
        if (!r.ok) return r
        const wmCur = normalizePlaylistWatermarkAbsPath(s.playlistWatermarkPngPath)
        patchFloatingSession(sessionId, {
          savedEditChalkboardPathsBaseline: [...pathsCb],
          savedEditChalkboardContentRevBaseline: s.chalkboardContentRev ?? 0,
          savedEditChalkboardPlacementsBaseline:
            cloneChalkboardPlacementsByBank(pl),
          savedEditChalkboardBackgroundBaseline: bgCur,
          savedEditTitleBaseline: label.trim(),
          savedEditThemeColorBaseline: themeCur,
          savedEditWatermarkBaseline: wmCur,
          regiaVideoCloudSourceFile: r.fileName,
        })
        return r
      }
      if (s.playlistMode === 'sottofondo') {
        return {
          ok: false,
          error:
            'Il Sottofondo non si salva come preset su file: resta nel workspace. In futuro potranno esserci setlist interne al pannello.',
        }
      }
      const list = s.paths
      const trackLoop = s.playlistLoopMode ?? loopMode
      const totalDurationSec = await totalDurationSecForPlaylistSave({
        playlistMode: 'tracks',
        paths: list,
      })
      const r = await api.regiaVideoCloudSaveFile({
        fileBaseName: bn,
        payload: {
          label,
          paths: list,
          crossfadeSec: normalizePlaylistCrossfadeSec(s.playlistCrossfadeSec),
          loopMode: trackLoop,
          themeColor: themeCur === '' ? null : themeCur,
          playlistMode: 'tracks',
          watermarkPngPath: wm,
          totalDurationSec,
        },
      })
      if (!r.ok) return r
      const wmCur = normalizePlaylistWatermarkAbsPath(s.playlistWatermarkPngPath)
      patchFloatingSession(sessionId, {
        savedEditPathsBaseline: [...list],
        savedEditTitleBaseline: label.trim(),
        savedEditCrossfadeSecBaseline: normalizePlaylistCrossfadeSec(
          s.playlistCrossfadeSec,
        ),
        savedEditPlaylistLoopBaseline: trackLoop,
        savedEditThemeColorBaseline: themeCur,
        savedEditWatermarkBaseline: wmCur,
        regiaVideoCloudSourceFile: r.fileName,
      })
      return r
    },
    [patchFloatingSession, loopMode],
  )

  const saveLoadedPlaylistOverwrite = useCallback(
    async (sessionId: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s) return
      if (sessionHasCloudEditLink(s)) {
        if (!floatingPlaylistSessionDirty(s, loopMode)) return
        recordUndoPoint()
        const cloudName = s.regiaVideoCloudSourceFile!.trim()
        const r = await writeFloatingSessionToRegiaVideoCloud(
          sessionId,
          cloudName,
        )
        if (!r.ok) {
          const extra =
            r.pathsOutsideRoot?.length &&
            ` File fuori cartella: ${r.pathsOutsideRoot.slice(0, 3).join(', ')}${r.pathsOutsideRoot.length > 3 ? '…' : ''}.`
          window.alert(`${r.error}${extra ?? ''}`)
        }
        return
      }
      if (!sessionHasSavedEditLink(s)) return
      const id = s.editingSavedPlaylistId
      const label = s.playlistTitle.trim() || 'Senza titolo'
      const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')
      const themeBase = normalizePlaylistThemeColor(
        s.savedEditThemeColorBaseline ?? '',
      )
      const wmCur = normalizePlaylistWatermarkAbsPath(s.playlistWatermarkPngPath)
      const wmBase = normalizePlaylistWatermarkAbsPath(s.savedEditWatermarkBaseline)
      if (s.playlistMode === 'launchpad') {
        const cells = s.launchPadCells ?? defaultLaunchPadCells()
        const baseCells = s.savedEditLaunchPadBaseline ?? defaultLaunchPadCells()
        if (
          launchPadCellsEqual(cells, baseCells) &&
          label.trim() === s.savedEditTitleBaseline.trim() &&
          themeCur === themeBase &&
          wmCur === wmBase
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
          crossfadeSec: 0,
          themeColor: themeCur === '' ? undefined : themeCur,
          playlistMode: 'launchpad',
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
          totalDurationSec,
          watermarkPngPath: watermarkPathForDiskSave(s),
        })
        await refreshSavedPlaylists()
        patchFloatingSession(sessionId, {
          savedEditPathsBaseline: [],
          savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(cells),
          savedEditTitleBaseline: label.trim(),
          savedEditThemeColorBaseline: themeCur,
          savedEditWatermarkBaseline: wmCur,
        })
        return
      }
      if (s.playlistMode === 'chalkboard') {
        const pathsCb = s.chalkboardBankPaths ?? []
        const basePaths = s.savedEditChalkboardPathsBaseline ?? []
        const rev = s.chalkboardContentRev ?? 0
        const baseRev = s.savedEditChalkboardContentRevBaseline ?? 0
        const pl = cloneChalkboardPlacementsByBank(s.chalkboardPlacementsByBank)
        const basePl = cloneChalkboardPlacementsByBank(
          s.savedEditChalkboardPlacementsBaseline ?? undefined,
        )
        const bgCur = normalizeChalkboardBackgroundHex(s.chalkboardBackgroundColor)
        const bgBase = normalizeChalkboardBackgroundHex(
          s.savedEditChalkboardBackgroundBaseline,
        )
        if (
          chalkboardPathsEqual(pathsCb, basePaths) &&
          rev === baseRev &&
          chalkboardPlacementsEqual(pl, basePl) &&
          bgCur === bgBase &&
          label.trim() === s.savedEditTitleBaseline.trim() &&
          themeCur === themeBase &&
          wmCur === wmBase
        )
          return
        if (pathsCb.length < 4) return
        recordUndoPoint()
        const totalDurationSec = await totalDurationSecForPlaylistSave({
          playlistMode: 'chalkboard',
          paths: [],
        })
        await window.electronAPI.playlistsSave({
          id,
          label,
          paths: [],
          crossfadeSec: 0,
          themeColor: themeCur === '' ? undefined : themeCur,
          playlistMode: 'chalkboard',
          chalkboardBankPaths: [...pathsCb],
          chalkboardBackgroundColor: bgCur,
          chalkboardPlacementsByBank: pl,
          totalDurationSec,
          watermarkPngPath: watermarkPathForDiskSave(s),
        })
        await refreshSavedPlaylists()
        patchFloatingSession(sessionId, {
          savedEditChalkboardPathsBaseline: [...pathsCb],
          savedEditChalkboardContentRevBaseline: rev,
          savedEditChalkboardPlacementsBaseline: cloneChalkboardPlacementsByBank(pl),
          savedEditChalkboardBackgroundBaseline: bgCur,
          savedEditTitleBaseline: label.trim(),
          savedEditThemeColorBaseline: themeCur,
          savedEditWatermarkBaseline: wmCur,
        })
        return
      }
      const list = s.paths
      const trackLoop = s.playlistLoopMode ?? loopMode
      const baseLoop = s.savedEditPlaylistLoopBaseline ?? loopMode
      if (
        pathsEqual(list, s.savedEditPathsBaseline!) &&
        label.trim() === s.savedEditTitleBaseline.trim() &&
        s.playlistCrossfadeSec === s.savedEditCrossfadeSecBaseline &&
        trackLoop === baseLoop &&
        themeCur === themeBase &&
        wmCur === wmBase
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
        crossfadeSec: normalizePlaylistCrossfadeSec(s.playlistCrossfadeSec),
        loopMode: trackLoop,
        themeColor: themeCur === '' ? undefined : themeCur,
        playlistMode: 'tracks',
        totalDurationSec,
        watermarkPngPath: watermarkPathForDiskSave(s),
      })
      await refreshSavedPlaylists()
      patchFloatingSession(sessionId, {
        savedEditPathsBaseline: [...list],
        savedEditTitleBaseline: label.trim(),
        savedEditCrossfadeSecBaseline: normalizePlaylistCrossfadeSec(
          s.playlistCrossfadeSec,
        ),
        savedEditPlaylistLoopBaseline: trackLoop,
        savedEditThemeColorBaseline: themeCur,
        savedEditWatermarkBaseline: wmCur,
      })
    },
    [
      patchFloatingSession,
      recordUndoPoint,
      refreshSavedPlaylists,
      loopMode,
      writeFloatingSessionToRegiaVideoCloud,
    ],
  )

  const persistSavedPlaylistAfterFloatingTitleBlur = useCallback(
    async (trimmedTitle: string, sessionId: string) => {
      const chainMap = persistFloatingTitleBlurBySessionRef.current
      const prev = chainMap.get(sessionId) ?? Promise.resolve()
      const next = prev.catch(() => {}).then(async () => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s) return
      const label = trimmedTitle.trim().slice(0, 120) || 'Senza titolo'
      const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')

      if (sessionHasCloudEditLink(s)) {
        const shellLoop = shellLoopModeRef.current
        if (!floatingPlaylistSessionDirty(s, shellLoop)) return
        recordUndoPoint()
        const r = await writeFloatingSessionToRegiaVideoCloud(
          sessionId,
          s.regiaVideoCloudSourceFile!.trim(),
        )
        if (!r.ok) {
          const extra =
            r.pathsOutsideRoot?.length &&
            ` File fuori cartella: ${r.pathsOutsideRoot.slice(0, 3).join(', ')}${r.pathsOutsideRoot.length > 3 ? '…' : ''}.`
          window.alert(`${r.error}${extra ?? ''}`)
        }
        return
      }

      /** Pannello non ancora collegato a una voce su disco (playlist o launchpad). */
      if (!sessionHasSavedEditLink(s)) {
        const plan = planFirstDiskLinkForUnlinkedSession({
          session: s,
          trimmedTitle,
          shellLoopMode: shellLoopModeRef.current,
        })
        if (plan.kind === 'skip') return
        const wmForDisk = watermarkPathForDiskSave(s)
        const wmBaseline = normalizePlaylistWatermarkAbsPath(
          s.playlistWatermarkPngPath,
        )
        if (plan.kind === 'launchpad_new') {
          const totalDurationSec = await totalDurationSecForPlaylistSave({
            playlistMode: 'launchpad',
            paths: [],
            launchPadCells: cloneLaunchPadCellsSnapshot(plan.cells),
          })
          const { id: newId } = await window.electronAPI.playlistsSave({
            label: plan.label,
            paths: [],
            crossfadeSec: 0,
            themeColor: plan.themeColor === '' ? undefined : plan.themeColor,
            playlistMode: 'launchpad',
            launchPadCells: cloneLaunchPadCellsSnapshot(plan.cells),
            totalDurationSec,
            watermarkPngPath: wmForDisk,
          })
          await refreshSavedPlaylists()
          patchFloatingSession(sessionId, {
            editingSavedPlaylistId: newId,
            savedEditPathsBaseline: [],
            savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(plan.cells),
            savedEditTitleBaseline: plan.label.trim(),
            savedEditCrossfadeSecBaseline: 0,
            savedEditThemeColorBaseline: plan.themeColor,
            savedEditWatermarkBaseline: wmBaseline,
          })
          return
        }
        if (plan.kind === 'chalkboard_new') {
          const totalDurationSec = await totalDurationSecForPlaylistSave({
            playlistMode: 'chalkboard',
            paths: [],
          })
          const plNew = cloneChalkboardPlacementsByBank(s.chalkboardPlacementsByBank)
          const { id: newId } = await window.electronAPI.playlistsSave({
            label: plan.label,
            paths: [],
            crossfadeSec: 0,
            themeColor: plan.themeColor === '' ? undefined : plan.themeColor,
            playlistMode: 'chalkboard',
            chalkboardBankPaths: [...plan.chalkboardBankPaths],
            chalkboardBackgroundColor: normalizeChalkboardBackgroundHex(
              s.chalkboardBackgroundColor,
            ),
            chalkboardPlacementsByBank: plNew,
            chalkboardMigrateDraftSessionId: plan.chalkboardMigrateDraftSessionId,
            totalDurationSec,
            watermarkPngPath: wmForDisk,
          })
          await refreshSavedPlaylists()
          const migrated = await window.electronAPI.playlistsLoad(newId)
          const nextPaths =
            migrated?.playlistMode === 'chalkboard' &&
            migrated.chalkboardBankPaths.length >= 4
              ? [...migrated.chalkboardBankPaths]
              : [...plan.chalkboardBankPaths]
          patchFloatingSession(sessionId, {
            editingSavedPlaylistId: newId,
            chalkboardBankPaths: nextPaths,
            savedEditChalkboardPathsBaseline: [...nextPaths],
            savedEditChalkboardContentRevBaseline: s.chalkboardContentRev ?? 0,
            savedEditChalkboardPlacementsBaseline:
              cloneChalkboardPlacementsByBank(plNew),
            savedEditChalkboardBackgroundBaseline:
              normalizeChalkboardBackgroundHex(s.chalkboardBackgroundColor),
            savedEditPathsBaseline: null,
            savedEditLaunchPadBaseline: null,
            savedEditTitleBaseline: plan.label.trim(),
            savedEditCrossfadeSecBaseline: 0,
            savedEditThemeColorBaseline: plan.themeColor,
            savedEditWatermarkBaseline: wmBaseline,
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
          crossfadeSec: plan.crossfadeSec,
          loopMode: plan.loopMode,
          themeColor: plan.themeColor === '' ? undefined : plan.themeColor,
          playlistMode: 'tracks',
          totalDurationSec,
          watermarkPngPath: wmForDisk,
        })
        await refreshSavedPlaylists()
        patchFloatingSession(sessionId, {
          editingSavedPlaylistId: newId,
          savedEditPathsBaseline: [...plan.paths],
          savedEditLaunchPadBaseline: null,
          savedEditTitleBaseline: plan.label.trim(),
          savedEditCrossfadeSecBaseline: plan.crossfadeSec,
          savedEditPlaylistLoopBaseline: plan.loopMode,
          savedEditThemeColorBaseline: plan.themeColor,
          savedEditWatermarkBaseline: wmBaseline,
        })
        return
      }

      const id = s.editingSavedPlaylistId
      const titleDirty =
        label.trim() !== s.savedEditTitleBaseline.trim()
      const pathsDirty =
        isTracksPlaylistMode(s.playlistMode) &&
        !pathsEqual(s.paths, s.savedEditPathsBaseline!)
      const cellsDirty =
        s.playlistMode === 'launchpad' &&
        !launchPadCellsEqual(
          s.launchPadCells,
          s.savedEditLaunchPadBaseline ?? undefined,
        )
      const chalkboardDirty =
        s.playlistMode === 'chalkboard' &&
        ((s.chalkboardContentRev ?? 0) !==
          (s.savedEditChalkboardContentRevBaseline ?? 0) ||
          !chalkboardPathsEqual(
            s.chalkboardBankPaths,
            s.savedEditChalkboardPathsBaseline ?? undefined,
          ) ||
          !chalkboardPlacementsEqual(
            s.chalkboardPlacementsByBank,
            s.savedEditChalkboardPlacementsBaseline ?? undefined,
          ) ||
          normalizeChalkboardBackgroundHex(s.chalkboardBackgroundColor) !==
            normalizeChalkboardBackgroundHex(
              s.savedEditChalkboardBackgroundBaseline ?? CHALKBOARD_DEFAULT_BG,
            ))
      const crossfadeDirty =
        isTracksPlaylistMode(s.playlistMode) &&
        s.playlistCrossfadeSec !== s.savedEditCrossfadeSecBaseline
      const shellLoop = shellLoopModeRef.current
      const loopDirty =
        isTracksPlaylistMode(s.playlistMode) &&
        (s.playlistLoopMode ?? shellLoop) !==
          (s.savedEditPlaylistLoopBaseline ?? shellLoop)
      const themeBase = normalizePlaylistThemeColor(
        s.savedEditThemeColorBaseline ?? '',
      )
      const themeDirty = themeCur !== themeBase
      const wmCur = normalizePlaylistWatermarkAbsPath(s.playlistWatermarkPngPath)
      const wmBase = normalizePlaylistWatermarkAbsPath(s.savedEditWatermarkBaseline)
      const watermarkDirty = wmCur !== wmBase
      if (
        !titleDirty &&
        !pathsDirty &&
        !cellsDirty &&
        !chalkboardDirty &&
        !crossfadeDirty &&
        !loopDirty &&
        !themeDirty &&
        !watermarkDirty
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
          crossfadeSec: 0,
          themeColor: themeCur === '' ? undefined : themeCur,
          playlistMode: 'launchpad',
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
          totalDurationSec,
          watermarkPngPath: watermarkPathForDiskSave(s),
        })
        await refreshSavedPlaylists()
        patchFloatingSession(sessionId, {
          savedEditPathsBaseline: [],
          savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(cells),
          savedEditTitleBaseline: label.trim(),
          savedEditThemeColorBaseline: themeCur,
          savedEditWatermarkBaseline: wmCur,
        })
        return
      }
      if (s.playlistMode === 'chalkboard') {
        const pathsCb = s.chalkboardBankPaths ?? []
        if (pathsCb.length < 4) return
        const totalDurationSec = await totalDurationSecForPlaylistSave({
          playlistMode: 'chalkboard',
          paths: [],
        })
        const plPersist = cloneChalkboardPlacementsByBank(
          s.chalkboardPlacementsByBank,
        )
        await window.electronAPI.playlistsSave({
          id,
          label,
          paths: [],
          crossfadeSec: 0,
          themeColor: themeCur === '' ? undefined : themeCur,
          playlistMode: 'chalkboard',
          chalkboardBankPaths: [...pathsCb],
          chalkboardBackgroundColor: normalizeChalkboardBackgroundHex(
            s.chalkboardBackgroundColor,
          ),
          chalkboardPlacementsByBank: plPersist,
          totalDurationSec,
          watermarkPngPath: watermarkPathForDiskSave(s),
        })
        await refreshSavedPlaylists()
        patchFloatingSession(sessionId, {
          savedEditChalkboardPathsBaseline: [...pathsCb],
          savedEditChalkboardContentRevBaseline: s.chalkboardContentRev ?? 0,
          savedEditChalkboardPlacementsBaseline:
            cloneChalkboardPlacementsByBank(plPersist),
          savedEditChalkboardBackgroundBaseline: normalizeChalkboardBackgroundHex(
            s.chalkboardBackgroundColor,
          ),
          savedEditTitleBaseline: label.trim(),
          savedEditThemeColorBaseline: themeCur,
          savedEditWatermarkBaseline: wmCur,
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
        crossfadeSec: normalizePlaylistCrossfadeSec(s.playlistCrossfadeSec),
        loopMode: trackLoop,
        themeColor: themeCur === '' ? undefined : themeCur,
        playlistMode: 'tracks',
        totalDurationSec,
        watermarkPngPath: watermarkPathForDiskSave(s),
      })
      await refreshSavedPlaylists()
      patchFloatingSession(sessionId, {
        savedEditPathsBaseline: [...list],
        savedEditTitleBaseline: label.trim(),
        savedEditCrossfadeSecBaseline: normalizePlaylistCrossfadeSec(
          s.playlistCrossfadeSec,
        ),
        savedEditPlaylistLoopBaseline: trackLoop,
        savedEditThemeColorBaseline: themeCur,
        savedEditWatermarkBaseline: wmCur,
      })
      })
      chainMap.set(sessionId, next)
      await next
    },
    [
      patchFloatingSession,
      refreshSavedPlaylists,
      recordUndoPoint,
      writeFloatingSessionToRegiaVideoCloud,
    ],
  )

  const removeFloatingPlaylist = useCallback(
    async (id: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === id)
      if (s && sessionHasLinkedPersistTarget(s)) {
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
      if (s?.playlistMode === 'sottofondo') {
        if (sottofondoLoadedTrackRef.current?.sessionId === id) {
          void send({ type: 'sottofondoStop' })
          setSottofondoPlaying(false)
          setSottofondoLoadedTrack(null)
        }
      }
      if (
        s?.playlistMode === 'chalkboard' &&
        normalizeChalkboardOutputMode(
          s.chalkboardOutputMode,
          (s as { chalkboardOutputToProgram?: boolean }).chalkboardOutputToProgram,
        ) !== 'off'
      ) {
        void send({ type: 'chalkboardLayer', visible: false })
      }
      if (videoOutputSessionIdRef.current === id) {
        const nv =
          next.find((x) => isTracksPlaylistMode(x.playlistMode))?.id ?? null
        setVideoOutputSessionId(nv)
        setPreviewSrc(null)
        setPreviewSyncKey((k) => k + 1)
        loadedIndexRef.current = null
        setVideoPlaying(false)
        void send({ type: 'programVacant' })
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
      if (sottofondoLoadedTrackRef.current?.sessionId === sessionId)
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
      if (s.playlistMode === 'chalkboard') return
      /** Sottofondo: nessun preset `tracks` su disco (solo workspace). */
      if (s.playlistMode === 'sottofondo') return
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
          crossfadeSec: 0,
          themeColor: themeCur === '' ? null : themeCur,
          playlistMode: 'launchpad',
          launchPadCells: cloneLaunchPadCellsSnapshot(cells),
          totalDurationSec,
          watermarkPngPath: watermarkPathForDiskSave(s),
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
        crossfadeSec: normalizePlaylistCrossfadeSec(s.playlistCrossfadeSec),
        loopMode: trackLoop,
        themeColor: themeCur === '' ? null : themeCur,
        playlistMode: 'tracks',
        totalDurationSec,
        watermarkPngPath: watermarkPathForDiskSave(s),
      })
      await refreshSavedPlaylists()
    },
    [resolvedActiveId, refreshSavedPlaylists],
  )

  const loadSavedPlaylist = useCallback(
    async (
      id: string,
      opts?: {
        preservePlayback?: boolean
      },
    ): Promise<string | null> => {
      const data = await window.electronAPI.playlistsLoad(id)
      if (!data) return null
      const isLaunchpad = data.playlistMode === 'launchpad'
      const isChalkboard = data.playlistMode === 'chalkboard'
      if (!isLaunchpad && !isChalkboard && !data.paths.length) return null
      if (
        isLaunchpad &&
        (!data.launchPadCells || data.launchPadCells.length < LAUNCHPAD_CELL_COUNT)
      )
        return null
      if (
        isChalkboard &&
        (!data.chalkboardBankPaths ||
          data.chalkboardBankPaths.length < 4)
      )
        return null
      recordUndoPoint()
      const prev = floatingSessionsRef.current
      const k = prev.filter((s) => s.planciaDock !== 'right').length
      const panelSizeForPos = isLaunchpad
        ? LAUNCHPAD_PANEL_SIZE
        : isChalkboard
          ? CHALKBOARD_PANEL_SIZE
          : DEFAULT_FLOATING_PANEL_SIZE
      const pos = computeNewFloatingPanelPos(panelSizeForPos, k, prev)
      const label = data.label.trim() || 'Senza titolo'
      const loadedTheme = normalizePlaylistThemeColor(data.themeColor)
      const loadedWm = normalizePlaylistWatermarkAbsPath(data.watermarkPngPath)
      const loadedCrossfadeSec = normalizePlaylistCrossfadeSec(
        (data as { crossfadeSec?: unknown }).crossfadeSec,
        (data as { crossfade?: unknown }).crossfade,
      )
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
          playlistCrossfadeSec: 0,
          editingSavedPlaylistId: id,
          regiaVideoCloudSourceFile: null,
          savedEditPathsBaseline: [],
          savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(cells),
          savedEditTitleBaseline: label.trim(),
          savedEditCrossfadeSecBaseline: 0,
          savedEditThemeColorBaseline: loadedTheme,
          playlistWatermarkPngPath: loadedWm,
          savedEditWatermarkBaseline: loadedWm,
        }
      } else if (isChalkboard) {
        const cbPaths = [...data.chalkboardBankPaths]
        const plLoaded = normalizeChalkboardPlacementsFromDisk(
          data.chalkboardPlacementsByBank,
        )
        const bgLoaded = normalizeChalkboardBackgroundHex(
          data.chalkboardBackgroundColor,
        )
        newS = {
          ...createChalkboardFloatingSession(pos),
          playlistTitle: label,
          chalkboardBankPaths: cbPaths,
          chalkboardBankIndex: 0,
          chalkboardContentRev: 0,
          chalkboardOutputMode: 'off',
          chalkboardBackgroundColor: bgLoaded,
          chalkboardPlacementsByBank: plLoaded,
          playlistThemeColor: loadedTheme,
          playlistCrossfadeSec: 0,
          editingSavedPlaylistId: id,
          regiaVideoCloudSourceFile: null,
          savedEditPathsBaseline: null,
          savedEditLaunchPadBaseline: null,
          savedEditChalkboardPathsBaseline: [...cbPaths],
          savedEditChalkboardContentRevBaseline: 0,
          savedEditChalkboardPlacementsBaseline:
            cloneChalkboardPlacementsByBank(plLoaded),
          savedEditChalkboardBackgroundBaseline: bgLoaded,
          savedEditTitleBaseline: label.trim(),
          savedEditCrossfadeSecBaseline: 0,
          savedEditThemeColorBaseline: loadedTheme,
          playlistWatermarkPngPath: loadedWm,
          savedEditWatermarkBaseline: loadedWm,
        }
      } else {
        const loadedLoop = parsePersistedPlaylistLoopMode(data.loopMode) ?? 'off'
        newS = {
          ...createEmptyFloatingSession(pos),
          paths: data.paths,
          currentIndex: 0,
          playlistTitle: label,
          editingSavedPlaylistId: id,
          regiaVideoCloudSourceFile: null,
          savedEditPathsBaseline: [...data.paths],
          savedEditLaunchPadBaseline: null,
          savedEditTitleBaseline: label.trim(),
          savedEditCrossfadeSecBaseline: loadedCrossfadeSec,
          savedEditPlaylistLoopBaseline: loadedLoop,
          savedEditThemeColorBaseline: loadedTheme,
          playlistCrossfadeSec: loadedCrossfadeSec,
          playlistLoopMode: loadedLoop,
          playlistThemeColor: loadedTheme,
          playlistWatermarkPngPath: loadedWm,
          savedEditWatermarkBaseline: loadedWm,
        }
      }
      const nextFloating = [...floatingSessionsRef.current, newS]
      floatingSessionsRef.current = nextFloating
      setFloatingSessions(nextFloating)
      setActiveFloatingSessionId(newS.id)
      activeFloatingSessionIdRef.current = newS.id
      const preservePlayback = opts?.preservePlayback !== false
      if (!preservePlayback) {
        setPlaybackSessionId(newS.id)
        playbackSessionIdStateRef.current = newS.id
        const firstTracks = [...prev, newS].find(
          (x) => isTracksPlaylistMode(x.playlistMode),
        )
        setVideoOutputSessionId(
          newS.playlistMode === 'launchpad' || newS.playlistMode === 'chalkboard'
            ? (firstTracks?.id ?? null)
            : newS.id,
        )
        setPreviewSrc(null)
        setPreviewSyncKey(0)
        setVideoPlaying(false)
        setLaunchpadAudioPlaying(false)
        loadedIndexRef.current = null
        setPlaybackLoadedTrack(null)
        await send({ type: 'programVacant' })
      }
      openFloatingPlaylist()
      return newS.id
    },
    [recordUndoPoint, send, openFloatingPlaylist],
  )

  const loadPlaylistFromRegiaVideoCloudFile = useCallback(
    async (fileName: string): Promise<string | null> => {
      const res = await window.electronAPI.regiaVideoCloudLoadFile(fileName)
      if (!res.ok) {
        window.alert(res.error)
        return null
      }
      const data = res.data
      const loadedCrossfadeSecCloud = normalizePlaylistCrossfadeSec(
        (data as { crossfadeSec?: unknown }).crossfadeSec,
        (data as { crossfade?: unknown }).crossfade,
      )
      const isLaunchpad = data.playlistMode === 'launchpad'
      const isChalkboard = data.playlistMode === 'chalkboard'
      if (!isLaunchpad && !isChalkboard && !data.paths.length) return null
      if (
        isLaunchpad &&
        (!data.launchPadCells || data.launchPadCells.length < LAUNCHPAD_CELL_COUNT)
      )
        return null
      if (
        isChalkboard &&
        (!data.chalkboardBankPaths || data.chalkboardBankPaths.length < 4)
      )
        return null
      recordUndoPoint()
      const prev = floatingSessionsRef.current
      const k = prev.filter((s) => s.planciaDock !== 'right').length
      const panelSizeForPos = isLaunchpad
        ? LAUNCHPAD_PANEL_SIZE
        : isChalkboard
          ? CHALKBOARD_PANEL_SIZE
          : DEFAULT_FLOATING_PANEL_SIZE
      const pos = computeNewFloatingPanelPos(panelSizeForPos, k, prev)
      const label = data.label.trim() || 'Senza titolo'
      const loadedTheme = normalizePlaylistThemeColor(data.themeColor)
      const loadedWm = normalizePlaylistWatermarkAbsPath(data.watermarkPngPath)
      const safeName = fileName.trim().replace(/[/\\]/g, '')
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
          playlistCrossfadeSec: 0,
          editingSavedPlaylistId: null,
          regiaVideoCloudSourceFile: safeName,
          savedEditPathsBaseline: [],
          savedEditLaunchPadBaseline: cloneLaunchPadCellsSnapshot(cells),
          savedEditTitleBaseline: label.trim(),
          savedEditCrossfadeSecBaseline: 0,
          savedEditThemeColorBaseline: loadedTheme,
          playlistWatermarkPngPath: loadedWm,
          savedEditWatermarkBaseline: loadedWm,
        }
      } else if (isChalkboard) {
        const cbPaths = [...data.chalkboardBankPaths]
        const plLoaded = normalizeChalkboardPlacementsFromDisk(
          data.chalkboardPlacementsByBank,
        )
        const bgLoaded = normalizeChalkboardBackgroundHex(
          data.chalkboardBackgroundColor,
        )
        newS = {
          ...createChalkboardFloatingSession(pos),
          playlistTitle: label,
          chalkboardBankPaths: cbPaths,
          chalkboardBankIndex: 0,
          chalkboardContentRev: 0,
          chalkboardOutputMode: 'off',
          chalkboardBackgroundColor: bgLoaded,
          chalkboardPlacementsByBank: plLoaded,
          playlistThemeColor: loadedTheme,
          playlistCrossfadeSec: 0,
          editingSavedPlaylistId: null,
          regiaVideoCloudSourceFile: safeName,
          savedEditPathsBaseline: null,
          savedEditLaunchPadBaseline: null,
          savedEditChalkboardPathsBaseline: [...cbPaths],
          savedEditChalkboardContentRevBaseline: 0,
          savedEditChalkboardPlacementsBaseline:
            cloneChalkboardPlacementsByBank(plLoaded),
          savedEditChalkboardBackgroundBaseline: bgLoaded,
          savedEditTitleBaseline: label.trim(),
          savedEditCrossfadeSecBaseline: 0,
          savedEditThemeColorBaseline: loadedTheme,
          playlistWatermarkPngPath: loadedWm,
          savedEditWatermarkBaseline: loadedWm,
        }
      } else {
        const loadedLoop = parsePersistedPlaylistLoopMode(data.loopMode) ?? 'off'
        newS = {
          ...createEmptyFloatingSession(pos),
          paths: data.paths,
          currentIndex: 0,
          playlistTitle: label,
          editingSavedPlaylistId: null,
          regiaVideoCloudSourceFile: safeName,
          savedEditPathsBaseline: [...data.paths],
          savedEditLaunchPadBaseline: null,
          savedEditTitleBaseline: label.trim(),
          savedEditCrossfadeSecBaseline: loadedCrossfadeSecCloud,
          savedEditPlaylistLoopBaseline: loadedLoop,
          savedEditThemeColorBaseline: loadedTheme,
          playlistCrossfadeSec: loadedCrossfadeSecCloud,
          playlistLoopMode: loadedLoop,
          playlistThemeColor: loadedTheme,
          playlistWatermarkPngPath: loadedWm,
          savedEditWatermarkBaseline: loadedWm,
        }
      }
      const nextFloating = [...floatingSessionsRef.current, newS]
      floatingSessionsRef.current = nextFloating
      setFloatingSessions(nextFloating)
      setActiveFloatingSessionId(newS.id)
      activeFloatingSessionIdRef.current = newS.id
      setPlaybackSessionId(newS.id)
      playbackSessionIdStateRef.current = newS.id
      const firstTracks = [...prev, newS].find(
        (x) => isTracksPlaylistMode(x.playlistMode),
      )
      setVideoOutputSessionId(
        newS.playlistMode === 'launchpad' || newS.playlistMode === 'chalkboard'
          ? (firstTracks?.id ?? null)
          : newS.id,
      )
      setPreviewSrc(null)
      setPreviewSyncKey(0)
      setVideoPlaying(false)
      setLaunchpadAudioPlaying(false)
      loadedIndexRef.current = null
      setPlaybackLoadedTrack(null)
      await send({ type: 'programVacant' })
      openFloatingPlaylist()
      return newS.id
    },
    [recordUndoPoint, send, openFloatingPlaylist],
  )

  const saveFloatingPlaylistCopyToRegiaVideoCloud = useCallback(
    async (sessionId: string): Promise<boolean> => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s) return false
      if (s.playlistMode === 'sottofondo') {
        window.alert(
          'Il Sottofondo non si salva come file JSON: è un pannello unico nel workspace. Le modifiche restano nel layout; in futuro si potranno avere setlist interne.',
        )
        return false
      }
      const api = window.electronAPI
      if (
        !api ||
        !('regiaVideoCloudSaveFile' in api) ||
        typeof (api as { regiaVideoCloudSaveFile?: unknown }).regiaVideoCloudSaveFile !==
          'function'
      ) {
        window.alert(
          'Salvataggio cloud Regia Video è disponibile solo nell’app desktop Electron.',
        )
        return false
      }
      let suggested: string
      try {
        suggested = await api.regiaVideoCloudSuggestFileName(
          s.playlistTitle.trim() || 'playlist',
        )
      } catch {
        suggested = 'playlist.json'
      }
      const raw = window.prompt(
        'Nome file JSON in Regia Video/Playlist (solo nome file, es. mia_playlist.json)',
        suggested,
      )
      if (raw == null) return false
      let name = raw.trim().replace(/[/\\]/g, '')
      if (!name) return false
      if (!name.toLowerCase().endsWith('.json')) {
        name = `${name}.json`
      }
      let existing: { fileName: string }[] = []
      try {
        existing = await api.regiaVideoCloudList()
      } catch {
        existing = []
      }
      if (existing.some((x) => x.fileName === name)) {
        const ok = window.confirm(
          `Esiste già «${name}». Vuoi sovrascriverlo con il contenuto di questo pannello?`,
        )
        if (!ok) return false
      }
      recordUndoPoint()
      const r = await writeFloatingSessionToRegiaVideoCloud(sessionId, name)
      if (!r.ok) {
        const extra =
          r.pathsOutsideRoot?.length &&
          ` File fuori cartella: ${r.pathsOutsideRoot.slice(0, 3).join(', ')}${r.pathsOutsideRoot.length > 3 ? '…' : ''}.`
        window.alert(`${r.error}${extra ?? ''}`)
        return false
      }
      return true
    },
    [recordUndoPoint, writeFloatingSessionToRegiaVideoCloud],
  )

  const setFloatingPlaylistPanelLocked = useCallback(
    (sessionId: string, locked: boolean) => {
      patchFloatingSession(sessionId, { panelLocked: locked })
    },
    [patchFloatingSession],
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
                regiaVideoCloudSourceFile: null,
                savedEditPathsBaseline: null,
                savedEditLaunchPadBaseline: null,
                savedEditChalkboardPathsBaseline: null,
                savedEditChalkboardContentRevBaseline: undefined,
                savedEditChalkboardPlacementsBaseline: undefined,
                savedEditChalkboardBackgroundBaseline: undefined,
                savedEditTitleBaseline: '',
                savedEditCrossfadeSecBaseline: 0,
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

  const stopSottofondoPlayback = useCallback(async () => {
    await send({ type: 'sottofondoStop' })
    setSottofondoPlaying(false)
    setSottofondoLoadedTrack(null)
  }, [send])

  const sottofondoLoadIndexAndPlay = useCallback(
    async (index: number, sessionId: string) => {
      const sess = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!sess || sess.playlistMode !== 'sottofondo') return
      const list = sess.paths
      if (list.length === 0) return
      if (index < 0 || index >= list.length) return
      const mode = sess.playlistLoopMode ?? loopModeRef.current
      const j = firstPlayableSottofondoIndex(
        list,
        index,
        mode === 'all',
      )
      if (j == null) {
        await stopSottofondoPlayback()
        return
      }
      const p = list[j]!
      patchFloatingSession(sessionId, { currentIndex: j })
      const playlistMuted = Boolean(sess.playlistOutputMuted)
      const panelVol =
        typeof sess.playlistOutputVolume === 'number' &&
        Number.isFinite(sess.playlistOutputVolume)
          ? Math.min(1, Math.max(0, sess.playlistOutputVolume))
          : 1
      const effMuted = muted || playlistMuted
      const loopOne = mode === 'one'
      const xMs = playlistCrossfadeSecToMs(
        normalizePlaylistCrossfadeSec(sess.playlistCrossfadeSec),
      )
      await send({
        type: 'sottofondoLoad',
        src: p,
        loop: loopOne,
        crossfadeMs: xMs,
      })
      await send({ type: 'sottofondoSetMuted', muted: effMuted })
      await send({
        type: 'sottofondoSetVolume',
        volume: outputVolumeRef.current * panelVol,
      })
      await send({ type: 'sottofondoPlay' })
      setSottofondoPlaying(true)
      setSottofondoLoadedTrack({ sessionId, index: j })
    },
    [muted, send, patchFloatingSession, stopSottofondoPlayback],
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
      if (
        sess?.playlistMode === 'launchpad' ||
        sess?.playlistMode === 'chalkboard'
      )
        return
      if (sess?.playlistMode === 'sottofondo') {
        await sottofondoLoadIndexAndPlay(index, sid)
        return
      }
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
      const crossfadeMsForLoad = playlistCrossfadeSecToMs(
        normalizePlaylistCrossfadeSec(sess?.playlistCrossfadeSec),
      )
      await send({
        type: 'load',
        src: p,
        crossfadeMs: crossfadeMsForLoad,
      })
      await send({ type: 'setLoopOne', loop: mode === 'one' })
      await send({ type: 'setMuted', muted: effectiveMuted })
      await send({
        type: 'setVolume',
        volume: outputVolumeRef.current * panelVol,
      })
      await send({ type: 'setSinkId', sinkId: outputSinkIdRef.current })
      /* Sempre play: finestra uscita può essere nascosta ma deve restare il motore
       * audio (anteprima muta); Schermo 2 controlla solo la visibilità. */
      await send({ type: 'play' })
      loadedIndexRef.current = index
      setPlaybackLoadedTrack({ sessionId: sid, index })
      setVideoPlaying(true)
      setPlaybackArmedNext(null)
    },
    [muted, send, patchFloatingSession, sottofondoLoadIndexAndPlay],
  )

  const sottofondoLoadIndexAndPlayRef = useRef(sottofondoLoadIndexAndPlay)
  useLayoutEffect(() => {
    sottofondoLoadIndexAndPlayRef.current = sottofondoLoadIndexAndPlay
  }, [sottofondoLoadIndexAndPlay])

  const handleSottofondoEnded = useCallback(() => {
    const t = sottofondoLoadedTrackRef.current
    if (!t) return
    const id = t.sessionId
    const sess = floatingSessionsRef.current.find((s) => s.id === id)
    if (!sess || sess.playlistMode !== 'sottofondo') return
    const list = sess.paths
    if (list.length === 0) {
      void stopSottofondoPlayback()
      return
    }
    const mode = sess.playlistLoopMode ?? loopModeRef.current
    const idx = sess.currentIndex
    if (mode === 'one') return
    if (mode === 'all') {
      const from = (idx + 1) % list.length
      const j = firstPlayableSottofondoIndex(list, from, true)
      if (j == null) {
        void stopSottofondoPlayback()
        return
      }
      void sottofondoLoadIndexAndPlayRef.current(j, id)
      return
    }
    const j = firstPlayableSottofondoIndex(list, idx + 1, false)
    if (j == null) {
      void stopSottofondoPlayback()
    } else {
      void sottofondoLoadIndexAndPlayRef.current(j, id)
    }
  }, [stopSottofondoPlayback])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onSottofondoEndedFromOutput) return
    return api.onSottofondoEndedFromOutput(handleSottofondoEnded)
  }, [handleSottofondoEnded])

  useEffect(() => {
    if (!sottofondoPlaying || !sottofondoLoadedTrack) return
    const sess = floatingSessions.find(
      (s) => s.id === sottofondoLoadedTrack.sessionId,
    )
    if (!sess || sess.playlistMode !== 'sottofondo') return
    const panelVol =
      typeof sess.playlistOutputVolume === 'number' &&
      Number.isFinite(sess.playlistOutputVolume)
        ? Math.min(1, Math.max(0, sess.playlistOutputVolume))
        : 1
    void send({
      type: 'sottofondoSetVolume',
      volume: outputVolume * panelVol,
    })
    void send({
      type: 'sottofondoSetMuted',
      muted: muted || Boolean(sess.playlistOutputMuted),
    })
  }, [
    sottofondoPlaying,
    sottofondoLoadedTrack,
    floatingSessions,
    outputVolume,
    muted,
    send,
  ])

  const clearPlaybackArmedNext = useCallback(() => {
    setPlaybackArmedNext(null)
  }, [])

  const armPlayNext = useCallback((sessionId: string, index: number) => {
    const sess = floatingSessionsRef.current.find((s) => s.id === sessionId)
    if (
      !sess ||
      sess.playlistMode === 'launchpad' ||
      sess.playlistMode === 'chalkboard' ||
      sess.playlistMode === 'sottofondo'
    )
      return
    if (index < 0 || index >= sess.paths.length) return
    setPlaybackArmedNext({ sessionId, index })
  }, [])

  const syncLaunchpadPlaybackAfterVoiceChangeRef = useRef<() => void>(() => {})

  const syncLaunchpadPlaybackAfterVoiceChange = useCallback(() => {
    if (launchpadVoiceCount() === 0) {
      setLaunchpadAudioPlaying(false)
      loadedIndexRef.current = null
      setPlaybackLoadedTrack(null)
      return
    }
    setLaunchpadAudioPlaying(launchpadAnyVoicePlaying())
    const pl = playbackLoadedTrackRef.current
    if (
      pl != null &&
      'index' in pl &&
      !launchpadSlotHasAnyVoice(
        pl.sessionId,
        pl.launchPadBankIndex ?? 0,
        pl.index,
      )
    ) {
      const pick = pickAnyLaunchpadVoiceSlot()
      if (pick) {
        loadedIndexRef.current = pick.slotIndex
        setPlaybackLoadedTrack({
          sessionId: pick.sessionId,
          index: pick.slotIndex,
          launchPadBankIndex: pick.bankIndex,
        })
      }
    }
  }, [])

  useLayoutEffect(() => {
    syncLaunchpadPlaybackAfterVoiceChangeRef.current =
      syncLaunchpadPlaybackAfterVoiceChange
  }, [syncLaunchpadPlaybackAfterVoiceChange])

  const releaseLaunchPadCueVoice = useCallback(
    (
      voiceId: number | null,
      sessionId: string,
      bankIndex: number,
      slotIndex: number,
    ) => {
      if (typeof voiceId === 'number') {
        stopLaunchpadVoice(voiceId)
      } else {
        stopLaunchpadVoicesForSlot(sessionId, bankIndex, slotIndex)
      }
      syncLaunchpadPlaybackAfterVoiceChange()
    },
    [syncLaunchpadPlaybackAfterVoiceChange],
  )

  const loadLaunchPadSlotAndPlay = useCallback(
    async (sessionId: string, slotIndex: number) => {
      if (
        slotIndex < 0 ||
        slotIndex >= LAUNCHPAD_CELL_COUNT ||
        !sessionId
      )
        return undefined
      const sess = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (sess?.playlistMode !== 'launchpad' || !sess.launchPadCells)
        return undefined
      const bi = Math.max(
        0,
        Math.min(LAUNCHPAD_BANK_COUNT - 1, sess.launchPadBankIndex ?? 0),
      )
      const banks =
        sess.launchPadBanks ??
        migrateLaunchPadBanksFromCells(sess.launchPadCells)
      const cell0 = banks[bi]![slotIndex]
      const p = cell0?.samplePath
      if (!p) return undefined
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
      const voiceId = playLaunchpadSample({
        sessionId,
        bankIndex: bi,
        slotIndex,
        src: url,
        volume: panelVol * padVol,
        muted: playlistMuted,
        sinkId: outputSinkIdRef.current,
        onEnded: () => {
          syncLaunchpadPlaybackAfterVoiceChangeRef.current()
        },
      })
      loadedIndexRef.current = slotIndex
      setPlaybackLoadedTrack({ sessionId, index: slotIndex, launchPadBankIndex: bi })
      setLaunchpadAudioPlaying(true)
      return voiceId
    },
    [patchFloatingSession],
  )

  const stopLaunchPadCueRelease = useCallback(() => {
    stopLaunchpadSample()
    setLaunchpadAudioPlaying(false)
    loadedIndexRef.current = null
    setPlaybackLoadedTrack(null)
  }, [])

  /** Tap / rilascio tasto su pad: toggle ferma se stesso slot; altrimenti patch banco e play (come keyup tastiera). */
  const handleLaunchPadShortTap = useCallback(
    async (sessionId: string, slotIndex: number) => {
      const sess = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (sess?.playlistMode !== 'launchpad' || !sess.launchPadCells) return
      const bi = Math.max(
        0,
        Math.min(LAUNCHPAD_BANK_COUNT - 1, sess.launchPadBankIndex ?? 0),
      )
      const banks =
        sess.launchPadBanks ??
        migrateLaunchPadBanksFromCells(sess.launchPadCells)
      const cell0 = banks[bi]![slotIndex]
      if (!cell0?.samplePath) return
      const keyMode =
        cell0.padKeyMode === 'toggle' ? ('toggle' as const) : ('play' as const)
      const stillActiveThisSlot = launchpadSlotHasAnyVoice(
        sessionId,
        bi,
        slotIndex,
      )
      if (keyMode === 'toggle' && stillActiveThisSlot) {
        stopLaunchpadVoicesForSlot(sessionId, bi, slotIndex)
        syncLaunchpadPlaybackAfterVoiceChange()
        return
      }
      const bnk = cloneLaunchPadBanksDeep(
        sess.launchPadBanks ??
          migrateLaunchPadBanksFromCells(sess.launchPadCells),
      )
      patchFloatingSession(sessionId, {
        launchPadBankIndex: bi,
        launchPadBanks: bnk,
        launchPadCells: bnk[bi]!.map((c) => ({ ...c })),
      })
      await loadLaunchPadSlotAndPlay(sessionId, slotIndex)
    },
    [
      patchFloatingSession,
      loadLaunchPadSlotAndPlay,
      syncLaunchpadPlaybackAfterVoiceChange,
    ],
  )

  const loadLaunchPadSlotAndPlayRef = useRef(loadLaunchPadSlotAndPlay)
  useLayoutEffect(() => {
    loadLaunchPadSlotAndPlayRef.current = loadLaunchPadSlotAndPlay
  }, [loadLaunchPadSlotAndPlay])

  const stopLaunchPadCueReleaseRef = useRef(stopLaunchPadCueRelease)
  useLayoutEffect(() => {
    stopLaunchPadCueReleaseRef.current = stopLaunchPadCueRelease
  }, [stopLaunchPadCueRelease])

  const releaseLaunchPadCueVoiceRef = useRef(releaseLaunchPadCueVoice)
  useLayoutEffect(() => {
    releaseLaunchPadCueVoiceRef.current = releaseLaunchPadCueVoice
  }, [releaseLaunchPadCueVoice])

  type RemoteLaunchPadGesture = {
    sessionId: string
    bankIndex: number
    slotIndex: number
    timer: ReturnType<typeof setTimeout> | null
    cueCommitted: boolean
    cancelled: boolean
    cueVoiceId: number | null
  }
  const remoteLaunchPadGesturesRef = useRef(
    new Map<string, RemoteLaunchPadGesture>(),
  )

  useEffect(() => {
    return () => {
      for (const g of remoteLaunchPadGesturesRef.current.values()) {
        if (g.timer != null) clearTimeout(g.timer)
      }
      remoteLaunchPadGesturesRef.current.clear()
    }
  }, [])

  type PadKeyboardGesture = {
    code: string
    sessionId: string
    bankIndex: number
    slotIndex: number
    keyMode: 'play' | 'toggle'
    /** `window.setTimeout` nel renderer (compatibile con tipi DOM + Node). */
    timer: number | null
    cueCommitted: boolean
    cueVoiceId: number | null
  }
  const padKeyboardGesturesRef = useRef(
    new Map<string, PadKeyboardGesture>(),
  )

  useEffect(() => {
    function findPadKeyBinding(code: string): {
      sessionId: string
      bankIndex: number
      slotIndex: number
      keyMode: 'play' | 'toggle'
    } | null {
      const sessions = floatingSessionsRef.current
      const activeId = activeFloatingSessionIdRef.current
      const trySid = (sid: string) => {
        const sess = sessions.find((s) => s.id === sid)
        if (sess?.playlistMode !== 'launchpad' || !sess.launchPadCells)
          return null
        const banks =
          sess.launchPadBanks ??
          migrateLaunchPadBanksFromCells(sess.launchPadCells)
        for (let bi = 0; bi < LAUNCHPAD_BANK_COUNT; bi++) {
          const cells = banks[bi]!
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i]
            const bound = cell.padKeyCode ?? null
            if (bound === code && cell.samplePath) {
              const keyMode =
                cell.padKeyMode === 'toggle'
                  ? ('toggle' as const)
                  : ('play' as const)
              return { sessionId: sid, bankIndex: bi, slotIndex: i, keyMode }
            }
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

    const clearGestureTimerFor = (code: string) => {
      const g = padKeyboardGesturesRef.current.get(code)
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

      if (e.repeat) return
      if (padKeyboardGesturesRef.current.has(e.code)) return

      e.preventDefault()
      e.stopPropagation()

      const g: PadKeyboardGesture = {
        code: e.code,
        sessionId: bound.sessionId,
        bankIndex: bound.bankIndex,
        slotIndex: bound.slotIndex,
        keyMode: bound.keyMode,
        timer: null,
        cueCommitted: false,
        cueVoiceId: null,
      }
      padKeyboardGesturesRef.current.set(e.code, g)

      if (readLaunchPadCueEnabled()) {
        g.timer = window.setTimeout(() => {
          const cur = padKeyboardGesturesRef.current.get(g.code)
          if (!cur || cur.code !== g.code || cur.cueCommitted) return
          cur.cueCommitted = true
          cur.timer = null
          const sAct = floatingSessionsRef.current.find(
            (x) => x.id === cur.sessionId,
          )
          if (sAct?.playlistMode === 'launchpad') {
            const bnk = cloneLaunchPadBanksDeep(
              sAct.launchPadBanks ??
                migrateLaunchPadBanksFromCells(sAct.launchPadCells),
            )
            const bix = Math.max(
              0,
              Math.min(LAUNCHPAD_BANK_COUNT - 1, cur.bankIndex),
            )
            patchFloatingSession(cur.sessionId, {
              launchPadBankIndex: bix,
              launchPadBanks: bnk,
              launchPadCells: bnk[bix]!.map((c) => ({ ...c })),
            })
          }
          void loadLaunchPadSlotAndPlayRef
            .current(cur.sessionId, cur.slotIndex)
            .then((vid) => {
              const live = padKeyboardGesturesRef.current.get(g.code)
              if (!live || live.code !== g.code) return
              if (typeof vid === 'number') live.cueVoiceId = vid
            })
        }, LAUNCHPAD_CUE_HOLD_MS)
      }
    }

    const onKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const g = padKeyboardGesturesRef.current.get(e.code)
      if (!g) return

      e.preventDefault()
      e.stopPropagation()
      clearGestureTimerFor(e.code)
      padKeyboardGesturesRef.current.delete(e.code)

      if (g.cueCommitted) {
        releaseLaunchPadCueVoiceRef.current(
          g.cueVoiceId,
          g.sessionId,
          g.bankIndex,
          g.slotIndex,
        )
        return
      }

      const stillActiveThisSlot = launchpadSlotHasAnyVoice(
        g.sessionId,
        g.bankIndex,
        g.slotIndex,
      )

      if (g.keyMode === 'toggle' && stillActiveThisSlot) {
        stopLaunchpadVoicesForSlot(
          g.sessionId,
          g.bankIndex,
          g.slotIndex,
        )
        syncLaunchpadPlaybackAfterVoiceChangeRef.current()
        return
      }
      const sUp = floatingSessionsRef.current.find((x) => x.id === g.sessionId)
      if (sUp?.playlistMode === 'launchpad') {
        const bnk = cloneLaunchPadBanksDeep(
          sUp.launchPadBanks ??
            migrateLaunchPadBanksFromCells(sUp.launchPadCells),
        )
        const bix = Math.max(
          0,
          Math.min(LAUNCHPAD_BANK_COUNT - 1, g.bankIndex),
        )
        patchFloatingSession(g.sessionId, {
          launchPadBankIndex: bix,
          launchPadBanks: bnk,
          launchPadCells: bnk[bix]!.map((c) => ({ ...c })),
        })
      }
      void loadLaunchPadSlotAndPlayRef.current(g.sessionId, g.slotIndex)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      for (const code of padKeyboardGesturesRef.current.keys()) {
        clearGestureTimerFor(code)
      }
      padKeyboardGesturesRef.current.clear()
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [patchFloatingSession])

  const updateLaunchPadCell = useCallback(
    async (
      sessionId: string,
      slotIndex: number,
      patch: Partial<
        Pick<
          LaunchPadCell,
          | 'samplePath'
          | 'padColor'
          | 'padGain'
          | 'padDisplayName'
          | 'padKeyCode'
          | 'padKeyMode'
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
      if (s0.panelLocked === true) return
      const hasPatch =
        ('samplePath' in patch && patch.samplePath !== undefined) ||
        ('padColor' in patch && patch.padColor !== undefined) ||
        ('padGain' in patch && patch.padGain !== undefined) ||
        ('padDisplayName' in patch && patch.padDisplayName !== undefined) ||
        ('padKeyCode' in patch && patch.padKeyCode !== undefined) ||
        ('padKeyMode' in patch && patch.padKeyMode !== undefined)
      if (!hasPatch) return
      const touchesSampleOrColor =
        ('samplePath' in patch && patch.samplePath !== undefined) ||
        ('padColor' in patch && patch.padColor !== undefined)
      const touchesPadKey =
        ('padKeyCode' in patch && patch.padKeyCode !== undefined) ||
        ('padKeyMode' in patch && patch.padKeyMode !== undefined)
      const touchesDisplayName =
        'padDisplayName' in patch && patch.padDisplayName !== undefined
      const touchesGainOnly =
        !touchesSampleOrColor &&
        !touchesPadKey &&
        !touchesDisplayName &&
        'padGain' in patch &&
        patch.padGain !== undefined
      if (touchesSampleOrColor || touchesPadKey || touchesDisplayName) {
        recordUndoPoint()
      } else if (touchesGainOnly && !options?.skipUndo) {
        recordUndoPoint()
      }
      const bi = Math.max(
        0,
        Math.min(LAUNCHPAD_BANK_COUNT - 1, s0.launchPadBankIndex ?? 0),
      )
      const banks = cloneLaunchPadBanksDeep(
        s0.launchPadBanks ?? migrateLaunchPadBanksFromCells(s0.launchPadCells),
      )
      const prevCells = banks[bi]!.map((c) => ({
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
        let padDisplayName = normalizeLaunchPadDisplayName(c.padDisplayName)
        if ('samplePath' in patch && patch.samplePath !== undefined) {
          samplePath = patch.samplePath
          if (patch.samplePath === null) {
            padGain = 1
            padDisplayName = null
          }
        }
        if ('padGain' in patch && patch.padGain !== undefined) {
          padGain = Math.min(1, Math.max(0, patch.padGain))
        }
        if ('padDisplayName' in patch && patch.padDisplayName !== undefined) {
          padDisplayName = normalizeLaunchPadDisplayName(patch.padDisplayName)
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
        return {
          padColor,
          samplePath,
          padGain,
          padDisplayName,
          padKeyCode,
          padKeyMode,
        }
      })
      banks[bi] = cells
      const clearingSampleFromSlot =
        'samplePath' in patch && patch.samplePath === null
      patchFloatingSession(sessionId, {
        launchPadBanks: banks,
        launchPadCells: cells,
      })
      if (clearingSampleFromSlot) {
        stopLaunchpadVoicesForSlot(sessionId, bi, slotIndex)
        syncLaunchpadPlaybackAfterVoiceChange()
      }
    },
    [patchFloatingSession, recordUndoPoint, syncLaunchpadPlaybackAfterVoiceChange],
  )

  const setLaunchPadBankIndex = useCallback(
    (sessionId: string, bankIndex: number) => {
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s0 || s0.playlistMode !== 'launchpad' || !s0.launchPadCells) return
      const bix = Math.max(
        0,
        Math.min(LAUNCHPAD_BANK_COUNT - 1, Math.floor(bankIndex)),
      )
      const banks = cloneLaunchPadBanksDeep(
        s0.launchPadBanks ?? migrateLaunchPadBanksFromCells(s0.launchPadCells),
      )
      patchFloatingSession(sessionId, {
        launchPadBankIndex: bix,
        launchPadBanks: banks,
        launchPadCells: banks[bix]!.map((c) => ({ ...c })),
      })
    },
    [patchFloatingSession],
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
        await send({ type: 'play' })
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
    const outSid = outputTrackListSessionIdRef.current
    const armed = playbackArmedNextRef.current
    if (
      list.length > 0 &&
      armed &&
      armed.sessionId === outSid &&
      armed.index >= 0 &&
      armed.index < list.length
    ) {
      await loadIndexAndPlayRef.current(armed.index)
      return
    }
    if (list.length === 0) {
      const pb = resolvedPlaybackIdRef.current
      const sess =
        pb != null
          ? floatingSessionsRef.current.find((x) => x.id === pb)
          : undefined
      if (
        sess?.playlistMode === 'launchpad' ||
        sess?.playlistMode === 'chalkboard'
      )
        return
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
      if (
        sess?.playlistMode === 'launchpad' ||
        sess?.playlistMode === 'chalkboard'
      )
        return
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

  const stopPlayback = useCallback(async () => {
    stopLaunchpadSample()
    setLaunchpadAudioPlaying(false)
    await send({ type: 'programVacant' })
    setVideoPlaying(false)
  }, [send])

  const handleEnded = useCallback(() => {
    const len = pathsRef.current.length
    if (len === 0) return
    const outSid = outputTrackListSessionIdRef.current
    const armed = playbackArmedNextRef.current
    if (
      armed &&
      armed.sessionId === outSid &&
      armed.index >= 0 &&
      armed.index < len
    ) {
      void loadIndexAndPlayRef.current(armed.index)
      return
    }
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
      void send({ type: 'programVacant' })
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

  useLayoutEffect(() => {
    const api = window.electronAPI
    if (!api?.ensureOutputIdleCap) {
      void send(outputIdleCapToPlaybackCommand(readOutputIdleCapFromLs()))
      return
    }
    void api.ensureOutputIdleCap(readOutputIdleCapFromLs())
  }, [send])

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

  /**
   * Solo passaggio Schermo 2 off → on: seek + play come l’anteprima.
   * Alla chiusura non inviamo IPC (l’uscita resta in play per l’audio in regia).
   */
  useEffect(() => {
    if (!secondScreenToggleSyncSkipFirstRef.current) {
      secondScreenToggleSyncSkipFirstRef.current = true
      prevSecondScreenOnForSyncRef.current = secondScreenOn
      return
    }
    const wasOn = prevSecondScreenOnForSyncRef.current
    prevSecondScreenOnForSyncRef.current = secondScreenOn
    if (wasOn || !secondScreenOn) return
    const src = previewSrcRef.current
    if (!src) return
    if (isStillImagePath(src)) {
      if (!videoPlayingRef.current) void send({ type: 'pause' })
      return
    }
    void (async () => {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      })
      if (!videoPlayingRef.current) {
        await send({ type: 'pause' })
        return
      }
      const t = previewMediaTimesRef.current.currentTime
      await send({ type: 'seek', seconds: t })
      await send({ type: 'play' })
    })()
  }, [secondScreenOn, send])

  useEffect(() => {
    if (!launchpadAudioPlaying || !playbackLoadedTrack) return
    const s = floatingSessions.find(
      (x) => x.id === playbackLoadedTrack.sessionId,
    )
    if (!s || isTracksPlaylistMode(s.playlistMode) || !s.launchPadCells) return
    const bi = Math.max(
      0,
      Math.min(
        LAUNCHPAD_BANK_COUNT - 1,
        playbackLoadedTrack.launchPadBankIndex ?? s.launchPadBankIndex ?? 0,
      ),
    )
    const banks =
      s.launchPadBanks ?? migrateLaunchPadBanksFromCells(s.launchPadCells)
    const cell = banks[bi]![playbackLoadedTrack.index]
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
      if (s0?.playlistMode === 'launchpad' || s0?.playlistMode === 'chalkboard')
        return
      const raw = await window.electronAPI.selectFolder()
      const picked = normalizeSelectFolderPayload(raw)
      if (!picked) return
      recordUndoPoint()
      const preserveTitle = s0 != null && sessionHasLinkedPersistTarget(s0)
      await applyPathsList(picked.paths, sessionId, {
        skipHistory: true,
        ...(picked.folder ? { playlistWatchFolder: picked.folder } : {}),
      })
      if (!preserveTitle) {
        patchFloatingSession(sessionId, {
          playlistTitle: folderBasenameFromPaths(picked.paths),
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
          return { ...s, ...CLEAR_PLAYLIST_WATCH_FOLDER, paths: merged }
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
    (
      sessionId: string,
      rawPaths: string[],
      insertBeforeIndex?: number | null,
    ) => {
      const picked = rawPaths.filter(isMediaFilePath)
      if (!picked.length) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s0 || s0.playlistMode === 'launchpad') return
      if (s0.panelLocked === true) return
      recordUndoPoint()
      const prev = s0.paths
      const insertAt =
        insertBeforeIndex != null && Number.isFinite(insertBeforeIndex)
          ? Math.max(0, Math.min(prev.length, Math.floor(insertBeforeIndex)))
          : prev.length

      const playbackSid = videoOutputSessionIdRef.current
      const li = loadedIndexRef.current
      const loadedPath =
        playbackSid === sessionId &&
        li != null &&
        li >= 0 &&
        li < prev.length
          ? prev[li]!
          : null

      const seen = new Set(prev)
      const next = [...prev]
      let idx = insertAt
      for (const f of picked) {
        if (seen.has(f)) continue
        seen.add(f)
        next.splice(idx, 0, f)
        idx++
      }

      const selectedPath = prev[s0.currentIndex]
      const ni = next.findIndex((p) => p === selectedPath)
      const nextCi =
        ni >= 0 ? ni : Math.min(s0.currentIndex, Math.max(0, next.length - 1))

      if (playbackSid === sessionId && loadedPath != null) {
        const newLi = next.findIndex((p) => p === loadedPath)
        if (newLi >= 0) {
          loadedIndexRef.current = newLi
          setPlaybackLoadedTrack({ sessionId: playbackSid, index: newLi })
        }
      }

      let titleFromFirstFolder: string | null = null
      if (prev.length === 0 && next.length > 0)
        titleFromFirstFolder = folderBasenameFromPaths(next)

      patchFloatingSession(sessionId, {
        ...CLEAR_PLAYLIST_WATCH_FOLDER,
        paths: next,
        currentIndex: nextCi,
        ...(titleFromFirstFolder
          ? { playlistTitle: titleFromFirstFolder }
          : {}),
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
      if (s0.panelLocked === true) return
      if (
        startSlotIndex < 0 ||
        startSlotIndex >= LAUNCHPAD_CELL_COUNT
      )
        return
      recordUndoPoint()
      patchFloatingSession(sessionId, (s) => {
        if (s.playlistMode !== 'launchpad' || !s.launchPadCells) return s
        const bi = Math.max(
          0,
          Math.min(LAUNCHPAD_BANK_COUNT - 1, s.launchPadBankIndex ?? 0),
        )
        const banks = cloneLaunchPadBanksDeep(
          s.launchPadBanks ?? migrateLaunchPadBanksFromCells(s.launchPadCells),
        )
        const row = banks[bi]!.map((c) => ({ ...c }))
        const cells = mergeLaunchPadCellsWithDrop(row, startSlotIndex, paths)
        banks[bi] = cells
        return { ...s, launchPadBanks: banks, launchPadCells: cells }
      })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const removePathAt = useCallback(
    async (index: number, sessionId: string) => {
      const playbackSid = videoOutputSessionIdRef.current
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s || s.playlistMode === 'launchpad' || s.playlistMode === 'chalkboard')
        return
      if (s.panelLocked === true) return
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
        patchFloatingSession(sessionId, {
          ...CLEAR_PLAYLIST_WATCH_FOLDER,
          paths: [],
          currentIndex: 0,
        })
        if (affectsPlayback) {
          setPreviewSrc(null)
          setPreviewSyncKey((k) => k + 1)
          loadedIndexRef.current = null
          setPlaybackLoadedTrack(null)
          setVideoPlaying(false)
          await send({ type: 'programVacant' })
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
          await send({ type: 'programVacant' })
        } else {
          loadedIndexRef.current = newLi
          setPlaybackLoadedTrack({ sessionId: playbackSid, index: newLi })
        }
      }

      patchFloatingSession(sessionId, {
        ...CLEAR_PLAYLIST_WATCH_FOLDER,
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
    (
      fromIndex: number,
      toIndex: number,
      sessionId: string,
      options?: { skipUndo?: boolean },
    ) => {
      if (fromIndex === toIndex) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (s0?.panelLocked === true) return
      if (s0?.playlistMode === 'launchpad') return
      const prev0 = s0?.paths ?? []
      if (
        fromIndex < 0 ||
        fromIndex >= prev0.length ||
        toIndex < 0 ||
        toIndex >= prev0.length
      )
        return
      if (!options?.skipUndo) recordUndoPoint()
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
        return {
          ...s,
          ...CLEAR_PLAYLIST_WATCH_FOLDER,
          paths: next,
          currentIndex: newCi,
        }
      })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const applyFloatingInternalDrop = useCallback(
    async (args: {
      target:
        | { kind: 'playlist'; sessionId: string; insertBeforeIndex: number }
        | { kind: 'launchpad'; sessionId: string; slotIndex: number }
      payload: RegiaFloatingDnDPayload
    }) => {
      const { target, payload } = args
      if (payload.v !== 1) return
      const tgtLocked = floatingSessionsRef.current.find(
        (x) => x.id === target.sessionId,
      )?.panelLocked
      if (tgtLocked === true) return

      const clampBank = (b: number) =>
        Math.max(0, Math.min(LAUNCHPAD_BANK_COUNT - 1, Math.floor(b)))
      const clampSlot = (x: number) =>
        Math.max(0, Math.min(LAUNCHPAD_CELL_COUNT - 1, Math.floor(x)))

      const stopPadAt = (sid: string, bi: number, si: number) => {
        stopLaunchpadVoicesForSlot(sid, bi, si)
        syncLaunchpadPlaybackAfterVoiceChange()
      }

      const syncLaunchPadCellsForSession = (
        s: FloatingPlaylistSession,
        banks: LaunchPadCell[][],
      ): Partial<FloatingPlaylistSession> => {
        const vis = clampBank(s.launchPadBankIndex ?? 0)
        return {
          launchPadBanks: banks,
          launchPadCells: banks[vis]!.map((c) => ({ ...c })),
        }
      }

      if (payload.kind === 'playlist-track') {
        const srcSid = payload.sessionId
        const srcIx = payload.index
        const srcS = floatingSessionsRef.current.find((x) => x.id === srcSid)
        if (!srcS || srcS.playlistMode === 'launchpad') return
        const len = srcS.paths.length
        if (srcIx < 0 || srcIx >= len) return
        const pathToMove = srcS.paths[srcIx]
        if (!pathToMove || !isMediaFilePath(pathToMove)) return

        if (target.kind === 'playlist') {
          const tgtSid = target.sessionId
          const tgtS = floatingSessionsRef.current.find((x) => x.id === tgtSid)
          if (!tgtS || tgtS.playlistMode === 'launchpad') return
          const insertBefore = Math.max(
            0,
            Math.min(tgtS.paths.length, Math.floor(target.insertBeforeIndex)),
          )

          if (tgtSid === srcSid) {
            const toIdx = insertBeforeIndexToReorderToIndex(
              srcIx,
              insertBefore,
              len,
            )
            if (toIdx === srcIx) return
            recordUndoPoint()
            reorderPaths(srcIx, toIdx, srcSid, { skipUndo: true })
            return
          }

          recordUndoPoint()

          const fromPaths = [...srcS.paths]
          const toPaths = [...tgtS.paths]
          fromPaths.splice(srcIx, 1)
          toPaths.splice(insertBefore, 0, pathToMove)

          let fromCi = srcS.currentIndex
          if (srcIx < fromCi) fromCi--
          else if (srcIx === fromCi)
            fromCi = Math.min(fromCi, Math.max(0, fromPaths.length - 1))

          let toCi = tgtS.currentIndex
          if (insertBefore <= toCi) toCi++

          const playbackSid = videoOutputSessionIdRef.current
          const li = loadedIndexRef.current

          if (playbackSid === tgtSid && li != null && li >= 0 && srcSid !== tgtSid) {
            let nli = li
            if (insertBefore <= li) nli = li + 1
            loadedIndexRef.current = nli
            setPlaybackLoadedTrack({ sessionId: tgtSid, index: nli })
          }

          const loadedPath =
            playbackSid === srcSid &&
            li != null &&
            li >= 0 &&
            li < srcS.paths.length
              ? srcS.paths[li]!
              : null

          if (fromPaths.length === 0 && playbackSid === srcSid) {
            setPreviewSrc(null)
            setPreviewSyncKey((k) => k + 1)
            loadedIndexRef.current = null
            setPlaybackLoadedTrack(null)
            setVideoPlaying(false)
            await send({ type: 'programVacant' })
          } else if (playbackSid === srcSid && loadedPath != null) {
            const newLi = fromPaths.findIndex((p) => p === loadedPath)
            if (newLi < 0) {
              loadedIndexRef.current = null
              setPlaybackLoadedTrack(null)
              setVideoPlaying(false)
              setPreviewSrc(null)
              setPreviewSyncKey((k) => k + 1)
              await send({ type: 'programVacant' })
            } else {
              loadedIndexRef.current = newLi
              setPlaybackLoadedTrack({ sessionId: playbackSid, index: newLi })
            }
          }

          const extraTo: Partial<FloatingPlaylistSession> = {
            ...CLEAR_PLAYLIST_WATCH_FOLDER,
            paths: toPaths,
            currentIndex: Math.max(0, toCi),
          }
          if (tgtS.paths.length === 0 && toPaths.length > 0) {
            extraTo.playlistTitle = folderBasenameFromPaths(toPaths)
          }

          setFloatingSessions((prev) => {
            const next = prev.map((s) => {
              if (s.id === srcSid) {
                if (fromPaths.length === 0)
                  return {
                    ...s,
                    ...CLEAR_PLAYLIST_WATCH_FOLDER,
                    paths: [],
                    currentIndex: 0,
                  }
                return {
                  ...s,
                  ...CLEAR_PLAYLIST_WATCH_FOLDER,
                  paths: fromPaths,
                  currentIndex: Math.max(0, fromCi),
                }
              }
              if (s.id === tgtSid) return { ...s, ...extraTo }
              return s
            })
            floatingSessionsRef.current = next
            return next
          })
          return
        }

        const tgtSid = target.sessionId
        const tgtSlot = clampSlot(target.slotIndex)
        const tgtS = floatingSessionsRef.current.find((x) => x.id === tgtSid)
        if (!tgtS || tgtS.playlistMode !== 'launchpad' || !tgtS.launchPadCells)
          return

        recordUndoPoint()

        const tgtBi = clampBank(tgtS.launchPadBankIndex ?? 0)
        stopPadAt(tgtSid, tgtBi, tgtSlot)

        const fromPaths = [...srcS.paths]
        fromPaths.splice(srcIx, 1)

        let fromCi = srcS.currentIndex
        if (srcIx < fromCi) fromCi--
        else if (srcIx === fromCi)
          fromCi = Math.min(fromCi, Math.max(0, fromPaths.length - 1))

        const playbackSid = videoOutputSessionIdRef.current
        const li = loadedIndexRef.current
        const loadedPath =
          playbackSid === srcSid &&
          li != null &&
          li >= 0 &&
          li < srcS.paths.length
            ? srcS.paths[li]!
            : null

        if (fromPaths.length === 0 && playbackSid === srcSid) {
          setPreviewSrc(null)
          setPreviewSyncKey((k) => k + 1)
          loadedIndexRef.current = null
          setPlaybackLoadedTrack(null)
          setVideoPlaying(false)
          await send({ type: 'programVacant' })
        } else if (playbackSid === srcSid && loadedPath != null) {
          const newLi = fromPaths.findIndex((p) => p === loadedPath)
          if (newLi < 0) {
            loadedIndexRef.current = null
            setPlaybackLoadedTrack(null)
            setVideoPlaying(false)
            setPreviewSrc(null)
            setPreviewSyncKey((k) => k + 1)
            await send({ type: 'programVacant' })
          } else {
            loadedIndexRef.current = newLi
            setPlaybackLoadedTrack({ sessionId: playbackSid, index: newLi })
          }
        }

        const banks = cloneLaunchPadBanksDeep(
          tgtS.launchPadBanks ??
            migrateLaunchPadBanksFromCells(tgtS.launchPadCells),
        )
        const row = banks[tgtBi]!.map((c) => ({ ...c }))
        const merged = mergeLaunchPadCellsWithDrop(row, tgtSlot, [pathToMove])
        banks[tgtBi] = dedupeLaunchPadKeysInBank(merged)

        setFloatingSessions((prev) => {
          const next = prev.map((s) => {
            if (s.id === srcSid) {
              if (fromPaths.length === 0)
                return {
                  ...s,
                  ...CLEAR_PLAYLIST_WATCH_FOLDER,
                  paths: [],
                  currentIndex: 0,
                }
              return {
                ...s,
                ...CLEAR_PLAYLIST_WATCH_FOLDER,
                paths: fromPaths,
                currentIndex: Math.max(0, fromCi),
              }
            }
            if (s.id === tgtSid) {
              return {
                ...s,
                ...syncLaunchPadCellsForSession(s, banks),
              }
            }
            return s
          })
          floatingSessionsRef.current = next
          return next
        })
        return
      }

      if (payload.kind === 'launchpad-slot') {
        const srcSid = payload.sessionId
        const srcBi = clampBank(payload.bankIndex)
        const srcSi = clampSlot(payload.slotIndex)
        const srcS = floatingSessionsRef.current.find((x) => x.id === srcSid)
        if (!srcS || srcS.playlistMode !== 'launchpad' || !srcS.launchPadCells)
          return

        const banksSrc0 = cloneLaunchPadBanksDeep(
          srcS.launchPadBanks ??
            migrateLaunchPadBanksFromCells(srcS.launchPadCells),
        )
        const srcCell = banksSrc0[srcBi]![srcSi]
        if (!srcCell?.samplePath || !isMediaFilePath(srcCell.samplePath)) return

        if (target.kind === 'playlist') {
          const tgtSid = target.sessionId
          const tgtS = floatingSessionsRef.current.find((x) => x.id === tgtSid)
          if (!tgtS || tgtS.playlistMode === 'launchpad') return
          const insertBefore = Math.max(
            0,
            Math.min(tgtS.paths.length, Math.floor(target.insertBeforeIndex)),
          )

          recordUndoPoint()
          stopPadAt(srcSid, srcBi, srcSi)

          const pathAdd = srcCell.samplePath
          banksSrc0[srcBi]![srcSi] = clearedLaunchPadSlotCell(
            srcSi,
            srcCell.padColor,
          )
          banksSrc0[srcBi] = dedupeLaunchPadKeysInBank(banksSrc0[srcBi]!)

          const toPaths = [...tgtS.paths]
          toPaths.splice(insertBefore, 0, pathAdd)
          let toCi = tgtS.currentIndex
          if (insertBefore <= toCi) toCi++

          const playbackSid = videoOutputSessionIdRef.current
          const li = loadedIndexRef.current
          if (playbackSid === tgtSid && li != null && li >= 0) {
            let nli = li
            if (insertBefore <= li) nli = li + 1
            loadedIndexRef.current = nli
            setPlaybackLoadedTrack({ sessionId: tgtSid, index: nli })
          }

          const extraTo: Partial<FloatingPlaylistSession> = {
            ...CLEAR_PLAYLIST_WATCH_FOLDER,
            paths: toPaths,
            currentIndex: Math.max(0, toCi),
          }
          if (tgtS.paths.length === 0 && toPaths.length > 0) {
            extraTo.playlistTitle = folderBasenameFromPaths(toPaths)
          }

          setFloatingSessions((prev) => {
            const next = prev.map((s) => {
              if (s.id === srcSid) {
                return {
                  ...s,
                  ...syncLaunchPadCellsForSession(s, banksSrc0),
                }
              }
              if (s.id === tgtSid) return { ...s, ...extraTo }
              return s
            })
            floatingSessionsRef.current = next
            return next
          })
          return
        }

        const tgtSid = target.sessionId
        const tgtSi = clampSlot(target.slotIndex)
        const tgtS = floatingSessionsRef.current.find((x) => x.id === tgtSid)
        if (!tgtS || tgtS.playlistMode !== 'launchpad' || !tgtS.launchPadCells)
          return
        const tgtBi = clampBank(tgtS.launchPadBankIndex ?? 0)

        if (srcSid === tgtSid && srcBi === tgtBi && srcSi === tgtSi) return

        recordUndoPoint()
        stopPadAt(srcSid, srcBi, srcSi)
        stopPadAt(tgtSid, tgtBi, tgtSi)

        if (srcSid === tgtSid) {
          const banks = cloneLaunchPadBanksDeep(
            srcS.launchPadBanks ??
              migrateLaunchPadBanksFromCells(srcS.launchPadCells),
          )
          const a = { ...banks[srcBi]![srcSi]! }
          const b = { ...banks[tgtBi]![tgtSi]! }
          const bHad = Boolean(b.samplePath)
          if (!bHad) {
            banks[tgtBi]![tgtSi] = {
              ...a,
              padKeyMode: normalizeLaunchPadKeyMode(a.padKeyMode),
            }
            banks[srcBi]![srcSi] = clearedLaunchPadSlotCell(srcSi, a.padColor)
          } else {
            banks[srcBi]![srcSi] = {
              ...b,
              padKeyMode: normalizeLaunchPadKeyMode(b.padKeyMode),
            }
            banks[tgtBi]![tgtSi] = {
              ...a,
              padKeyMode: normalizeLaunchPadKeyMode(a.padKeyMode),
            }
          }
          banks[srcBi] = dedupeLaunchPadKeysInBank(banks[srcBi]!)
          banks[tgtBi] = dedupeLaunchPadKeysInBank(banks[tgtBi]!)

          setFloatingSessions((prev) => {
            const next = prev.map((s) => {
              if (s.id !== srcSid) return s
              return { ...s, ...syncLaunchPadCellsForSession(s, banks) }
            })
            floatingSessionsRef.current = next
            return next
          })
          return
        }

        const banksTgt = cloneLaunchPadBanksDeep(
          tgtS.launchPadBanks ??
            migrateLaunchPadBanksFromCells(tgtS.launchPadCells),
        )
        const a = { ...banksSrc0[srcBi]![srcSi]! }
        const b = { ...banksTgt[tgtBi]![tgtSi]! }
        const bHad = Boolean(b.samplePath)
        if (!bHad) {
          banksTgt[tgtBi]![tgtSi] = {
            ...a,
            padKeyMode: normalizeLaunchPadKeyMode(a.padKeyMode),
          }
          banksSrc0[srcBi]![srcSi] = clearedLaunchPadSlotCell(srcSi, a.padColor)
        } else {
          banksTgt[tgtBi]![tgtSi] = {
            ...a,
            padKeyMode: normalizeLaunchPadKeyMode(a.padKeyMode),
          }
          banksSrc0[srcBi]![srcSi] = {
            ...b,
            padKeyMode: normalizeLaunchPadKeyMode(b.padKeyMode),
          }
        }
        banksSrc0[srcBi] = dedupeLaunchPadKeysInBank(banksSrc0[srcBi]!)
        banksTgt[tgtBi] = dedupeLaunchPadKeysInBank(banksTgt[tgtBi]!)

        setFloatingSessions((prev) => {
          const next = prev.map((s) => {
            if (s.id === srcSid)
              return { ...s, ...syncLaunchPadCellsForSession(s, banksSrc0) }
            if (s.id === tgtSid)
              return { ...s, ...syncLaunchPadCellsForSession(s, banksTgt) }
            return s
          })
          floatingSessionsRef.current = next
          return next
        })
      }
    },
    [
      recordUndoPoint,
      reorderPaths,
      send,
      setFloatingSessions,
      setLaunchpadAudioPlaying,
      setPlaybackLoadedTrack,
      setPreviewSrc,
      setPreviewSyncKey,
      setVideoPlaying,
      syncLaunchpadPlaybackAfterVoiceChange,
    ],
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

  const setCueSinkId = useCallback((sinkId: string) => {
    setCueSinkIdState(sinkId)
    cueSinkIdRef.current = sinkId
    try {
      localStorage.setItem(REGIA_LS_CUE_SINK_KEY, sinkId)
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

  useEffect(() => {
    if (!window.electronAPI?.onRemoteDispatch) return
    return window.electronAPI.onRemoteDispatch(
      async (msg: { reqId: number; payload: unknown }) => {
        const finish = (ok: boolean, error?: string) => {
          window.electronAPI.remoteDispatchResult(msg.reqId, ok, error)
        }
        try {
          const p = msg.payload as Record<string, unknown>
          const type = p.type
          if (type === 'loadSavedPlaylist' && typeof p.savedId === 'string') {
            const sid = await loadSavedPlaylist(p.savedId)
            if (!sid) finish(false, 'load_failed')
            else finish(true)
            return
          }
          if (
            type === 'playTrack' &&
            typeof p.savedId === 'string' &&
            typeof p.index === 'number'
          ) {
            let sid = floatingSessionsRef.current.find(
              (s) => s.editingSavedPlaylistId === p.savedId,
            )?.id
            if (!sid) {
              const nid = await loadSavedPlaylist(p.savedId)
              if (!nid) {
                finish(false, 'load_failed')
                return
              }
              sid = nid
            } else {
              setActiveFloatingSession(sid)
              setPlaybackSessionId(sid)
              activeFloatingSessionIdRef.current = sid
              playbackSessionIdStateRef.current = sid
            }
            await loadIndexAndPlay(p.index, sid)
            finish(true)
            return
          }
          if (
            type === 'playPad' &&
            typeof p.savedId === 'string' &&
            typeof p.slotIndex === 'number'
          ) {
            const rawPhase = p.pointerPhase
            const pointerPhase =
              rawPhase === 'down' || rawPhase === 'up' || rawPhase === 'cancel'
                ? rawPhase
                : undefined

            let sid = floatingSessionsRef.current.find(
              (s) => s.editingSavedPlaylistId === p.savedId,
            )?.id
            if (!sid) {
              const nid = await loadSavedPlaylist(p.savedId)
              if (!nid) {
                finish(false, 'load_failed')
                return
              }
              sid = nid
            } else {
              setActiveFloatingSession(sid)
              setPlaybackSessionId(sid)
              activeFloatingSessionIdRef.current = sid
              playbackSessionIdStateRef.current = sid
            }

            const remotePadKey = `${sid}:${p.slotIndex}`

            const clearRemotePadTimerFor = (key: string) => {
              const g0 = remoteLaunchPadGesturesRef.current.get(key)
              if (g0?.timer != null) {
                clearTimeout(g0.timer)
                g0.timer = null
              }
            }

            if (!pointerPhase) {
              await handleLaunchPadShortTap(sid, p.slotIndex)
              finish(true)
              return
            }

            if (pointerPhase === 'down') {
              clearRemotePadTimerFor(remotePadKey)
              const sess0 = floatingSessionsRef.current.find(
                (x) => x.id === sid,
              )
              if (sess0?.playlistMode !== 'launchpad' || !sess0.launchPadCells) {
                finish(false, 'not_launchpad')
                return
              }
              const bi0 = Math.max(
                0,
                Math.min(
                  LAUNCHPAD_BANK_COUNT - 1,
                  sess0.launchPadBankIndex ?? 0,
                ),
              )
              const g: RemoteLaunchPadGesture = {
                sessionId: sid,
                bankIndex: bi0,
                slotIndex: p.slotIndex,
                timer: null,
                cueCommitted: false,
                cancelled: false,
                cueVoiceId: null,
              }
              remoteLaunchPadGesturesRef.current.set(remotePadKey, g)
              if (readLaunchPadCueEnabled()) {
                g.timer = setTimeout(() => {
                  const cur =
                    remoteLaunchPadGesturesRef.current.get(remotePadKey)
                  if (
                    !cur ||
                    cur.sessionId !== sid ||
                    cur.slotIndex !== p.slotIndex ||
                    cur.cancelled
                  )
                    return
                  cur.cueCommitted = true
                  cur.timer = null
                  void loadLaunchPadSlotAndPlay(sid, p.slotIndex).then(
                    (vid) => {
                      const live =
                        remoteLaunchPadGesturesRef.current.get(remotePadKey)
                      if (
                        !live ||
                        live.sessionId !== sid ||
                        live.slotIndex !== p.slotIndex
                      )
                        return
                      if (typeof vid === 'number') live.cueVoiceId = vid
                    },
                  )
                }, LAUNCHPAD_CUE_HOLD_MS)
              }
              finish(true)
              return
            }

            if (pointerPhase === 'cancel') {
              const g1 = remoteLaunchPadGesturesRef.current.get(remotePadKey)
              if (
                g1 &&
                g1.sessionId === sid &&
                g1.slotIndex === p.slotIndex
              ) {
                g1.cancelled = true
                clearRemotePadTimerFor(remotePadKey)
              }
              finish(true)
              return
            }

            const g2 = remoteLaunchPadGesturesRef.current.get(remotePadKey)
            if (
              !g2 ||
              g2.sessionId !== sid ||
              g2.slotIndex !== p.slotIndex
            ) {
              finish(true)
              return
            }
            clearRemotePadTimerFor(remotePadKey)
            remoteLaunchPadGesturesRef.current.delete(remotePadKey)
            if (g2.cueCommitted) {
              releaseLaunchPadCueVoice(
                g2.cueVoiceId,
                sid,
                g2.bankIndex,
                g2.slotIndex,
              )
              finish(true)
              return
            }
            if (g2.cancelled) {
              finish(true)
              return
            }
            await handleLaunchPadShortTap(sid, p.slotIndex)
            finish(true)
            return
          }
          if (
            type === 'chalkboardBankToOutput' &&
            typeof p.savedId === 'string' &&
            typeof p.bankIndex === 'number'
          ) {
            const bankIndex = Math.max(0, Math.min(3, Math.floor(p.bankIndex)))
            let sid = floatingSessionsRef.current.find(
              (s) => s.editingSavedPlaylistId === p.savedId,
            )?.id
            if (!sid) {
              const nid = await loadSavedPlaylist(p.savedId)
              if (!nid) {
                finish(false, 'load_failed')
                return
              }
              sid = nid
            } else {
              setActiveFloatingSession(sid)
              setPlaybackSessionId(sid)
              activeFloatingSessionIdRef.current = sid
              playbackSessionIdStateRef.current = sid
            }
            const data = await window.electronAPI.playlistsLoad(p.savedId)
            if (data?.playlistMode !== 'chalkboard') {
              finish(false, 'not_chalkboard')
              return
            }
            const paths = data.chalkboardBankPaths
            if (!Array.isArray(paths) || bankIndex >= paths.length) {
              finish(false, 'no_bank')
              return
            }
            const absPath = paths[bankIndex]
            if (typeof absPath !== 'string' || !absPath.trim()) {
              finish(false, 'no_bank_path')
              return
            }
            patchFloatingSession(sid, { chalkboardBankIndex: bankIndex })
            const composite =
              p.composite === 'solid' ? ('solid' as const) : ('transparent' as const)
            const boardBg = normalizeChalkboardBackgroundHex(
              data.chalkboardBackgroundColor,
            )
            await send({
              type: 'chalkboardLayer',
              visible: true,
              src: absPath,
              composite,
              ...(composite === 'solid'
                ? { boardBackgroundColor: boardBg }
                : {}),
            })
            finish(true)
            return
          }
          if (type === 'chalkboardHide') {
            await send({ type: 'chalkboardLayer', visible: false })
            finish(true)
            return
          }
          if (type === 'transport') {
            const a = p.action
            if (a === 'togglePlay') void togglePlay()
            else if (a === 'prev') void goPrev()
            else if (a === 'next') void goNext()
            else if (a === 'setVolume' && typeof p.volume === 'number')
              setOutputVolume(p.volume)
            else if (a === 'undo') {
              undo()
            } else if (a === 'setLoopMode') {
              const lm = p.loopMode
              if (lm !== 'off' && lm !== 'one' && lm !== 'all') {
                finish(false, 'bad_loop')
                return
              }
              const outSess = deriveOutputTrackListSession(
                floatingSessionsRef.current,
                videoOutputSessionIdRef.current,
                playbackSessionIdStateRef.current,
              )
              if (outSess) setPlaylistLoopMode(outSess.id, lm)
              else setLoopMode(lm)
            } else {
              finish(false, 'unknown_transport')
              return
            }
            finish(true)
            return
          }
          finish(false, 'unknown_command')
        } catch (err) {
          finish(false, err instanceof Error ? err.message : 'error')
        }
      },
    )
  }, [
    loadSavedPlaylist,
    loadIndexAndPlay,
    loadLaunchPadSlotAndPlay,
    handleLaunchPadShortTap,
    stopLaunchPadCueRelease,
    releaseLaunchPadCueVoice,
    togglePlay,
    goPrev,
    goNext,
    setOutputVolume,
    setActiveFloatingSession,
    setPlaybackSessionId,
    undo,
    setPlaylistLoopMode,
    setLoopMode,
    patchFloatingSession,
    send,
  ])

  useEffect(() => {
    if (!window.electronAPI?.reportRemotePlaybackSnapshotPatch) return
    const pl = playbackLoadedTrack
    const sess = pl
      ? floatingSessions.find((s) => s.id === pl.sessionId)
      : undefined
    let launchpadTitle: string | null = null
    const launchpadRemoteActive = launchpadVoiceCount() > 0
    if (launchpadRemoteActive && pl && sess?.playlistMode === 'launchpad') {
      const banks =
        sess.launchPadBanks ??
        migrateLaunchPadBanksFromCells(sess.launchPadCells ?? [])
      const bi = Math.max(
        0,
        Math.min(LAUNCHPAD_BANK_COUNT - 1, sess.launchPadBankIndex ?? 0),
      )
      const cell = banks[bi]![pl.index]
      const rawPath = cell?.samplePath ?? null
      const base =
        (typeof cell?.padDisplayName === 'string' && cell.padDisplayName.trim()) ||
        (rawPath
          ? rawPath.replace(/\\/g, '/').split('/').pop() ?? ''
          : '')
      const plLab = (sess.playlistTitle || '').trim()
      launchpadTitle = plLab
        ? `${plLab} — ${base || `Pad ${pl.index + 1}`}`
        : base || `Pad ${pl.index + 1}`
    }
    window.electronAPI.reportRemotePlaybackSnapshotPatch({
      launchpadActive: launchpadRemoteActive,
      launchpadSlot: launchpadRemoteActive && pl ? pl.index : null,
      launchpadTitle,
      outputVolume,
      playlistLoopMode: outputTrackLoopMode,
      canUndo,
    })
  }, [
    playbackLoadedTrack,
    launchpadAudioPlaying,
    floatingSessions,
    outputVolume,
    outputTrackLoopMode,
    canUndo,
  ])

  const bugReportSnapshotRef = useRef<RegiaBugReportSnapshotFields | null>(null)
  useLayoutEffect(() => {
    bugReportSnapshotRef.current = {
      scope: 'main',
      appVersionFromUi: __REGIA_APP_VERSION__,
      buildHashFromUi: __REGIA_BUILD_HASH__,
      transport: {
        playing,
        videoPlaying,
        launchpadAudioPlaying,
        muted,
        outputVolume,
        loopMode,
        secondScreenOn,
        previewSrc,
        previewSyncKey,
        previewMediaTimes: { ...previewMediaTimesRef.current },
      },
      routing: {
        activeFloatingSessionId: resolvedActiveId,
        playbackSessionId,
        videoOutputSessionId,
        playbackLoadedTrack,
        playbackArmedNext,
        outputTrackLoopMode,
        floatingZOrder: [...floatingZOrder],
        previewDetached,
        floatingPlaylistOpen,
        playlistFloaterOsSessionIds: [...playlistFloaterOsSessionIds],
      },
      workspaceUi: {
        sidebarOpen,
        sidebarWidthPx,
      },
      namedWorkspaces: namedWorkspaces.map((w) => ({
        id: w.id,
        label: w.label,
        savedAt: w.savedAt,
      })),
      activeNamedWorkspaceId,
      activeNamedWorkspaceLabel,
      savedPlaylists: savedPlaylists.map((p) => ({
        id: p.id,
        label: p.label,
        trackCount: p.trackCount,
      })),
      floatingSessions,
    }
  }, [
    playing,
    videoPlaying,
    launchpadAudioPlaying,
    muted,
    outputVolume,
    loopMode,
    secondScreenOn,
    previewSrc,
    previewSyncKey,
    resolvedActiveId,
    playbackSessionId,
    videoOutputSessionId,
    playbackLoadedTrack,
    playbackArmedNext,
    outputTrackLoopMode,
    floatingZOrder,
    previewDetached,
    floatingPlaylistOpen,
    playlistFloaterOsSessionIds,
    sidebarOpen,
    sidebarWidthPx,
    namedWorkspaces,
    activeNamedWorkspaceId,
    activeNamedWorkspaceLabel,
    savedPlaylists,
    floatingSessions,
    previewMediaTimesTick,
  ])

  const exportBugReportSnapshot = useCallback((): RegiaBugReportSnapshotV1 => {
    const cur = bugReportSnapshotRef.current
    if (!cur) {
      return buildRegiaBugReportSnapshot({
        scope: 'main',
        appVersionFromUi: __REGIA_APP_VERSION__,
        buildHashFromUi: __REGIA_BUILD_HASH__,
        transport: {
          playing: false,
          videoPlaying: false,
          launchpadAudioPlaying: false,
          muted: false,
          outputVolume: 0,
          loopMode: 'off',
          secondScreenOn: false,
          previewSrc: null,
          previewSyncKey: 0,
          previewMediaTimes: { currentTime: 0, duration: 0 },
        },
        routing: {
          activeFloatingSessionId: '',
          playbackSessionId: null,
          videoOutputSessionId: null,
          playbackLoadedTrack: null,
          playbackArmedNext: null,
          outputTrackLoopMode: 'off',
          floatingZOrder: [],
          previewDetached: false,
          floatingPlaylistOpen: false,
          playlistFloaterOsSessionIds: [],
        },
        workspaceUi: { sidebarOpen: false, sidebarWidthPx: 0 },
        namedWorkspaces: [],
        activeNamedWorkspaceId: null,
        activeNamedWorkspaceLabel: '',
        savedPlaylists: [],
        floatingSessions: [],
      })
    }
    return buildRegiaBugReportSnapshot(cur)
  }, [])

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
      cueSinkId,
      setCueSinkId,
      playing,
      videoPlaying,
      launchpadAudioPlaying,
      sottofondoPlaying,
      sottofondoLoadedTrack,
      stopSottofondoPlayback,
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
      addFloatingChalkboard,
      addFloatingSottofondo,
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
      loadPlaylistFromRegiaVideoCloudFile,
      saveFloatingPlaylistCopyToRegiaVideoCloud,
      setFloatingPlaylistPanelLocked,
      deleteSavedPlaylist,
      reorderSavedPlaylists,
      duplicateSavedPlaylist,
      loadIndexAndPlay,
      loadLaunchPadSlotAndPlay,
      stopLaunchPadCueRelease,
      releaseLaunchPadCueVoice,
      updateLaunchPadCell,
      setLaunchPadBankIndex,
      togglePlay,
      stopPlayback,
      setLoopMode,
      setMuted,
      toggleSecondScreen,
      goNext,
      goPrev,
      playbackArmedNext,
      armPlayNext,
      clearPlaybackArmedNext,
      selectItem,
      reorderPaths,
      applyFloatingInternalDrop,
      playlistTitle,
      setPlaylistTitle,
      setPlaylistThemeColor,
      programWatermarkAbsPath,
      setPlaylistWatermarkPngPath,
      playlistCrossfadeSec,
      cyclePlaylistCrossfadeSec,
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
      rightPlanciaDockWidthPx,
      dockFloatingPlaylistToPlanciaRight,
      updateFloatingPlaylistChrome,
      repositionAllFloatingPanels,
      patchFloatingPlaylistSession: patchFloatingSession,
      savedPlaylistDirty,
      saveLoadedPlaylistOverwrite,
      persistSavedPlaylistAfterFloatingTitleBlur,
      canUndo,
      canRedo,
      undo,
      redo,
      recordUndoPoint,
      playbackLoadedTrack,
      outputTrackListSession,
      playbackControlSession: playbackSession,
      videoOutputSessionId,
      playbackSessionId,
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
      previewDisplayMode,
      cyclePreviewDisplayMode,
      setPreviewDocked,
      setPreviewFloating,
      sidebarOpen,
      setSidebarOpen,
      toggleSidebarOpen,
      sidebarWidthPx,
      setSidebarWidthPx,
      playlistFloaterOsSessionIds,
      exportBugReportSnapshot,
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
      cueSinkId,
      setCueSinkId,
      playing,
      videoPlaying,
      launchpadAudioPlaying,
      sottofondoPlaying,
      sottofondoLoadedTrack,
      stopSottofondoPlayback,
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
      addFloatingChalkboard,
      addFloatingSottofondo,
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
      loadPlaylistFromRegiaVideoCloudFile,
      saveFloatingPlaylistCopyToRegiaVideoCloud,
      setFloatingPlaylistPanelLocked,
      deleteSavedPlaylist,
      reorderSavedPlaylists,
      duplicateSavedPlaylist,
      loadIndexAndPlay,
      loadLaunchPadSlotAndPlay,
      stopLaunchPadCueRelease,
      releaseLaunchPadCueVoice,
      updateLaunchPadCell,
      setLaunchPadBankIndex,
      togglePlay,
      stopPlayback,
      setLoopMode,
      setMuted,
      toggleSecondScreen,
      goNext,
      goPrev,
      playbackArmedNext,
      armPlayNext,
      clearPlaybackArmedNext,
      selectItem,
      reorderPaths,
      applyFloatingInternalDrop,
      playlistTitle,
      setPlaylistTitle,
      setPlaylistThemeColor,
      programWatermarkAbsPath,
      setPlaylistWatermarkPngPath,
      playlistCrossfadeSec,
      cyclePlaylistCrossfadeSec,
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
      rightPlanciaDockWidthPx,
      dockFloatingPlaylistToPlanciaRight,
      updateFloatingPlaylistChrome,
      repositionAllFloatingPanels,
      patchFloatingSession,
      savedPlaylistDirty,
      saveLoadedPlaylistOverwrite,
      persistSavedPlaylistAfterFloatingTitleBlur,
      canUndo,
      canRedo,
      undo,
      redo,
      recordUndoPoint,
      playbackLoadedTrack,
      outputTrackListSession,
      playbackSession,
      videoOutputSessionId,
      playbackSessionId,
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
      previewDisplayMode,
      cyclePreviewDisplayMode,
      setPreviewDocked,
      setPreviewFloating,
      sidebarOpen,
      setSidebarOpen,
      toggleSidebarOpen,
      sidebarWidthPx,
      setSidebarWidthPx,
      playlistFloaterOsSessionIds,
      exportBugReportSnapshot,
    ],
  )

  return (
    <RegiaContext.Provider value={value}>
      {children}
      <FloaterOsPlaylistBridge
        setPlaylistFloaterOsSessionIds={setPlaylistFloaterOsSessionIds}
        floatingSessionsRef={floatingSessionsRef}
      />
    </RegiaContext.Provider>
  )
}

export function useRegia(): RegiaContextValue {
  const mirror = useContext(PlaylistFloaterMirrorContext)
  if (mirror) return mirror
  const v = useContext(RegiaContext)
  if (!v) throw new Error('useRegia must be used within RegiaProvider')
  return v
}

const FLOATER_ACTION_ALLOWLIST = new Set([
  'bringFloatingPanelToFront',
  'setActiveFloatingSession',
  'loadIndexAndPlay',
  'openFolder',
  'addMediaToPlaylist',
  'removePathAt',
  'reorderPaths',
  'applyFloatingInternalDrop',
  'removeFloatingPlaylist',
  'setPlaylistTitle',
  'setPlaylistThemeColor',
  'setPlaylistWatermarkPngPath',
  'cyclePlaylistCrossfadeSec',
  'setPlaylistOutputMuted',
  'setPlaylistOutputVolume',
  'recordUndoPoint',
  'saveLoadedPlaylistOverwrite',
  'persistSavedPlaylistAfterFloatingTitleBlur',
  'addPathsToPlaylistFromPaths',
  'applyLaunchPadDropFromPaths',
  'loadLaunchPadSlotAndPlay',
  'stopLaunchPadCueRelease',
  'releaseLaunchPadCueVoice',
  'updateLaunchPadCell',
  'setLaunchPadBankIndex',
  'updateFloatingPlaylistChrome',
  'dockFloatingPlaylistToPlanciaRight',
  'undo',
  'redo',
  'setPlaylistLoopMode',
  'setOutputVolume',
  'setOutputSinkId',
  'setCueSinkId',
  'togglePlay',
  'stopPlayback',
  'setLoopMode',
  'setMuted',
  'toggleSecondScreen',
  'goNext',
  'goPrev',
  'armPlayNext',
  'clearPlaybackArmedNext',
  'selectItem',
  'refreshSavedPlaylists',
  'saveCurrentPlaylist',
  'loadSavedPlaylist',
  'loadPlaylistFromRegiaVideoCloudFile',
  'saveFloatingPlaylistCopyToRegiaVideoCloud',
  'setFloatingPlaylistPanelLocked',
  'deleteSavedPlaylist',
  'reorderSavedPlaylists',
  'duplicateSavedPlaylist',
  'closeFloatingPlaylist',
  'openFloatingPlaylist',
  'hideFloatingPlaylistPanels',
  'repositionAllFloatingPanels',
  'refreshNamedWorkspaces',
  'createNewNamedWorkspace',
  'saveNamedWorkspace',
  'loadNamedWorkspace',
  'deleteNamedWorkspace',
  'renameNamedWorkspace',
  'overwriteNamedWorkspace',
  'duplicateNamedWorkspace',
  'setPreviewDocked',
  'setPreviewFloating',
  'cyclePreviewDisplayMode',
  'setSidebarOpen',
  'toggleSidebarOpen',
  'setSidebarWidthPx',
  'setStillImageDurationSec',
  'addFloatingPlaylist',
  'addFloatingLaunchPad',
  'addFloatingChalkboard',
  'addFloatingSottofondo',
  'stopSottofondoPlayback',
  'patchFloatingPlaylistSession',
])

function FloaterOsPlaylistBridge({
  setPlaylistFloaterOsSessionIds,
  floatingSessionsRef,
}: {
  setPlaylistFloaterOsSessionIds: Dispatch<SetStateAction<string[]>>
  floatingSessionsRef: MutableRefObject<FloatingPlaylistSession[]>
}) {
  const regia = useRegia()
  const { floatingPlaylistSessions, playlistFloaterOsSessionIds } = regia
  const floatingFloaterExperimental = useRegiaFloatingFloaterExperimental()
  const regiaRef = useRef(regia)
  useLayoutEffect(() => {
    regiaRef.current = regia
  }, [regia])

  const buildFloaterPayload = useCallback((floaterSessionId: string) => {
    const r = regiaRef.current
    const sessions = floatingSessionsRef.current
    return buildPlaylistFloaterSyncPayload(
      { ...r, floatingPlaylistSessions: sessions },
      floaterSessionId,
    )
  }, [floatingSessionsRef])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onPlaylistFloaterActionFromMain) return
    const off = api.onPlaylistFloaterActionFromMain(
      (msg: { sessionId: string; method: string; args: unknown[] }) => {
        if (!FLOATER_ACTION_ALLOWLIST.has(msg.method)) return
        const fn = (regiaRef.current as Record<string, unknown>)[msg.method]
        if (typeof fn !== 'function') return
        void Promise.resolve(
          (fn as (...a: unknown[]) => unknown)(...msg.args),
        )
      },
    )
    return off
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (
      !api?.onPlaylistFloaterRequestStateFromMain ||
      !api.playlistFloaterBroadcastState
    )
      return
    return api.onPlaylistFloaterRequestStateFromMain((msg) => {
      const id =
        typeof msg?.sessionId === 'string' && msg.sessionId.trim()
          ? msg.sessionId.trim()
          : ''
      if (!id) return
      void api.playlistFloaterBroadcastState(id, buildFloaterPayload(id))
    })
  }, [buildFloaterPayload])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onPlaylistFloaterOsClosedFromMain) return
    return api.onPlaylistFloaterOsClosedFromMain(
      (msg: {
        sessionId: string
        bounds: { x: number; y: number; width: number; height: number } | null
      }) => {
        const { sessionId, bounds } = msg
        setPlaylistFloaterOsSessionIds((p) => p.filter((x) => x !== sessionId))
        void (async () => {
          const c = await api.getRegiaContentBounds?.()
          if (bounds && c) {
            await Promise.resolve(
              regiaRef.current.updateFloatingPlaylistChrome(sessionId, {
                pos: {
                  x: Math.round(bounds.x - c.x),
                  y: Math.round(bounds.y - c.y),
                },
                panelSize: {
                  width: Math.round(bounds.width),
                  height: Math.round(bounds.height),
                },
                windowAlwaysOnTopPinned: false,
              }),
            )
          } else {
            await Promise.resolve(
              regiaRef.current.updateFloatingPlaylistChrome(sessionId, {
                windowAlwaysOnTopPinned: false,
              }),
            )
          }
        })()
      },
    )
  }, [setPlaylistFloaterOsSessionIds])

  useEffect(() => {
    if (floatingFloaterExperimental) return
    const api = window.electronAPI
    const hasOs = playlistFloaterOsSessionIds.length > 0
    const hasPinned = floatingPlaylistSessions.some(
      (s) => s.windowAlwaysOnTopPinned === true,
    )
    if (!hasOs && !hasPinned) return

    for (const id of [...playlistFloaterOsSessionIds]) {
      void api.closePlaylistFloaterWindow?.(id)
    }
    setPlaylistFloaterOsSessionIds([])

    for (const s of floatingPlaylistSessions) {
      if (s.windowAlwaysOnTopPinned === true) {
        void regiaRef.current.updateFloatingPlaylistChrome(s.id, {
          windowAlwaysOnTopPinned: false,
        })
      }
    }
  }, [
    floatingFloaterExperimental,
    floatingPlaylistSessions,
    playlistFloaterOsSessionIds,
    setPlaylistFloaterOsSessionIds,
  ])

  useEffect(() => {
    const api = window.electronAPI
    if (!floatingFloaterExperimental) return
    if (!api?.openPlaylistFloaterWindow || !api.getRegiaContentBounds) return
    for (const s of floatingPlaylistSessions) {
      if (!s.windowAlwaysOnTopPinned) continue
      if (playlistFloaterOsSessionIds.includes(s.id)) continue
      void (async () => {
        const bounds = await api.getRegiaContentBounds()
        if (!bounds) return
        const h = s.collapsed ? 84 : s.panelSize.height
        const opened = await api.openPlaylistFloaterWindow({
          sessionId: s.id,
          x: Math.round(bounds.x + s.pos.x),
          y: Math.round(bounds.y + s.pos.y),
          width: Math.round(s.panelSize.width),
          height: Math.round(h),
        })
        if (!opened?.ok) return
        regiaRef.current.updateFloatingPlaylistChrome(s.id, { pos: { x: 0, y: 0 } })
        setPlaylistFloaterOsSessionIds((prev) =>
          prev.includes(s.id) ? prev : [...prev, s.id],
        )
      })()
    }
  }, [
    floatingFloaterExperimental,
    floatingPlaylistSessions,
    playlistFloaterOsSessionIds,
    setPlaylistFloaterOsSessionIds,
  ])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.closePlaylistFloaterWindow) return
    for (const id of playlistFloaterOsSessionIds) {
      const s = floatingPlaylistSessions.find((x) => x.id === id)
      if (!s?.windowAlwaysOnTopPinned) {
        void api.closePlaylistFloaterWindow(id)
        setPlaylistFloaterOsSessionIds((prev) => prev.filter((x) => x !== id))
      }
    }
  }, [
    floatingPlaylistSessions,
    playlistFloaterOsSessionIds,
    setPlaylistFloaterOsSessionIds,
  ])

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    const api = window.electronAPI
    if (!api?.playlistFloaterBroadcastState) return
    if (playlistFloaterOsSessionIds.length === 0) return
    if (pushTimerRef.current != null) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null
      for (const id of playlistFloaterOsSessionIds) {
        void api.playlistFloaterBroadcastState(id, buildFloaterPayload(id))
      }
    }, 48)
    return () => {
      if (pushTimerRef.current != null) clearTimeout(pushTimerRef.current)
    }
  }, [regia, playlistFloaterOsSessionIds, buildFloaterPayload])

  return null
}
